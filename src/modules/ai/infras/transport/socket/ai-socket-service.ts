import { Server as SocketIOServer, Namespace } from "socket.io";
import { z } from "zod";
import { authenticateSocketConnection } from "@share/component/socket-io";
import { AiUseCaseFacade } from "../../../usecase";
import { ToneType } from "../../../model/dto";

const uuidV7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SummarizePayloadSchema = z.object({
  conversationId: z.string().regex(uuidV7Regex, "Invalid conversation ID"),
  maxMessages: z.number().optional(),
});

const SmartReplyPayloadSchema = z.object({
  conversationId: z.string().regex(uuidV7Regex, "Invalid conversation ID"),
  userId: z.string().regex(uuidV4Regex, "Invalid user ID").optional(),
});

const ToneAdjustPayloadSchema = z.object({
  message: z.string().min(1).max(5000),
  tone: z.enum(["formal", "casual", "funny", "professional"]),
});

const TranslatePayloadSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLang: z.string().min(1).max(50),
  sourceLang: z.string().optional(),
});

const SmartSearchPayloadSchema = z.object({
  query: z.string().min(1).max(500),
  conversationId: z.string().regex(uuidV7Regex, "Invalid conversation ID").optional(),
});

const ExtractTasksPayloadSchema = z.object({
  conversationId: z.string().regex(uuidV7Regex, "Invalid conversation ID"),
  maxMessages: z.number().optional(),
});

const ModeratePayloadSchema = z.object({
  text: z.string().min(1).max(5000),
});

export class AiSocketService {
  private readonly namespace: Namespace;

  constructor(
    io: SocketIOServer,
    private readonly aiFacade: AiUseCaseFacade
  ) {
    this.namespace = io.of("/ai");
    this.namespace.use(async (socket: any, next) => {
      await authenticateSocketConnection(socket, next);
    });
    this.registerHandlers();
  }

  private async safeEmit(
    socket: any,
    event: string,
    data: any,
    callback?: (response: any) => void
  ) {
    try {
      if (callback) {
        callback(data);
      } else {
        socket.emit(event, data);
      }
    } catch {
      if (callback) {
        callback({ error: "Emit failed" });
      }
    }
  }

  private emitError(socket: any, event: string, message: string, callback?: (response: any) => void) {
    const errorPayload = { event, error: message, timestamp: Date.now() };
    if (callback) {
      callback({ success: false, error: message });
    } else {
      socket.emit("ai:error", errorPayload);
    }
  }

  private registerHandlers() {
    this.namespace.on("connection", (socket: any) => {
      const userId = socket.userId;
      console.log(`[AI Socket] User ${userId} connected (socket: ${socket.id})`);

      socket.on("ai:summarize", async (payload: any, callback?: (r: any) => void) => {
        const parsed = SummarizePayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:summarize", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.summarize(parsed.data);
          return this.safeEmit(socket, "ai:summarize:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:summarize", err.message || "Internal error", callback);
        }
      });

      socket.on("ai:smart_reply", async (payload: any, callback?: (r: any) => void) => {
        const parsed = SmartReplyPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:smart_reply", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.getSmartReplies({
            conversationId: parsed.data.conversationId,
            userId: parsed.data.userId || userId,
          });
          return this.safeEmit(socket, "ai:smart_reply:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:smart_reply", err.message || "Internal error", callback);
        }
      });

      socket.on("ai:tone_adjust", async (payload: any, callback?: (r: any) => void) => {
        const parsed = ToneAdjustPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:tone_adjust", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.adjustTone(parsed.data);
          return this.safeEmit(socket, "ai:tone_adjust:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:tone_adjust", err.message || "Internal error", callback);
        }
      });

      socket.on("ai:translate", async (payload: any, callback?: (r: any) => void) => {
        const parsed = TranslatePayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:translate", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.translate(parsed.data);
          return this.safeEmit(socket, "ai:translate:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:translate", err.message || "Internal error", callback);
        }
      });

      socket.on("ai:smart_search", async (payload: any, callback?: (r: any) => void) => {
        const parsed = SmartSearchPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:smart_search", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.smartSearch({
            query: parsed.data.query,
            conversationId: parsed.data.conversationId,
          });
          return this.safeEmit(socket, "ai:smart_search:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:smart_search", err.message || "Internal error", callback);
        }
      });

      socket.on("ai:extract_tasks", async (payload: any, callback?: (r: any) => void) => {
        const parsed = ExtractTasksPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:extract_tasks", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.extractTasks(parsed.data);
          return this.safeEmit(socket, "ai:extract_tasks:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:extract_tasks", err.message || "Internal error", callback);
        }
      });

      socket.on("ai:moderate", async (payload: any, callback?: (r: any) => void) => {
        const parsed = ModeratePayloadSchema.safeParse(payload);
        if (!parsed.success) {
          return this.emitError(socket, "ai:moderate", "Invalid payload", callback);
        }
        try {
          const result = await this.aiFacade.moderateContent(parsed.data);
          return this.safeEmit(socket, "ai:moderate:result", result, callback);
        } catch (err: any) {
          return this.emitError(socket, "ai:moderate", err.message || "Internal error", callback);
        }
      });

      socket.on("disconnect", (reason: string) => {
        console.log(`[AI Socket] User ${userId} disconnected (socket: ${socket.id}, reason: ${reason})`);
      });
    });
  }
}
