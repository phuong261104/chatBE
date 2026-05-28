import { Router, Request, Response } from "express";
import { z } from "zod";
import { uuidV7, uuidV4 } from "@share/utils/zod-validators";
import { AiUseCaseFacade } from "@modules/ai/usecase";
import { ToneType } from "@modules/ai/model/dto";
import { AiError } from "@modules/ai/model/errors";
import { aiRateLimitMiddleware } from "../middleware/ai-rate-limit";

const ToneTypeSchema = z.enum(["formal", "casual", "funny", "professional"]);

const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  AI_PROVIDER_ERROR: "Dịch vụ AI đang gặp sự cố. Vui lòng thử lại sau.",
  AI_RATE_LIMIT: "Bạn đã sử dụng quá nhiều yêu cầu AI. Vui lòng chờ một lát rồi thử lại.",
  AI_TIMEOUT: "Yêu cầu AI mất quá lâu. Vui lòng thử lại.",
  AI_INVALID_RESPONSE: "Kết quả từ AI không hợp lệ. Vui lòng thử lại.",
};

function handleAiError(error: unknown, res: Response) {
  if (error instanceof AiError) {
    const friendly = USER_FRIENDLY_MESSAGES[error.code] || error.message;
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: friendly,
        retryAfter: error.code === "AI_RATE_LIMIT" ? 60 : undefined,
      },
    });
  }
  const err = error as { message?: string; statusCode?: number };
  return res.status(err.statusCode || 500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.",
    },
  });
}

const SummarizeSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  maxMessages: z.number().optional(),
});

const SmartReplySchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  userId: uuidV4().optional(),
});

const ToneAdjustSchema = z.object({
  message: z.string().min(1).max(5000),
  tone: ToneTypeSchema,
});

const TranslateSchema = z.object({
  text: z.string().min(1).max(10000),
  targetLang: z.string().min(1).max(50),
  sourceLang: z.string().optional(),
});

const DetectLanguageSchema = z.object({
  text: z.string().min(1).max(5000),
});

const SmartSearchSchema = z.object({
  query: z.string().min(1).max(500),
  conversationId: uuidV7("Invalid conversation ID").optional(),
});

const ExtractTasksSchema = z.object({
  conversationId: uuidV7("Invalid conversation ID"),
  maxMessages: z.number().optional(),
});

const ModerateContentSchema = z.object({
  text: z.string().min(1).max(5000),
  conversationId: uuidV7("Invalid conversation ID").optional(),
});

export class AiHttpService {
  private _router: Router;

  constructor(private aiFacade: AiUseCaseFacade) {
    this._router = Router();
    this.registerRoutes();
  }

  get router() {
    return this._router;
  }

  private registerRoutes() {
    this._router.post("/summarize", aiRateLimitMiddleware, this.summarize.bind(this));
    this._router.post("/smart-reply", aiRateLimitMiddleware, this.smartReply.bind(this));
    this._router.post("/tone-adjust", aiRateLimitMiddleware, this.toneAdjust.bind(this));
    this._router.post("/translate", aiRateLimitMiddleware, this.translate.bind(this));
    this._router.post("/detect-language", aiRateLimitMiddleware, this.detectLanguage.bind(this));
    this._router.post("/smart-search", aiRateLimitMiddleware, this.smartSearch.bind(this));
    this._router.post("/extract-tasks", aiRateLimitMiddleware, this.extractTasks.bind(this));
    this._router.post("/moderate", aiRateLimitMiddleware, this.moderate.bind(this));
  }

  async summarize(req: Request, res: Response) {
    try {
      const parsed = SummarizeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.summarize(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }

  async smartReply(req: Request, res: Response) {
    try {
      const parsed = SmartReplySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const requester = res.locals["requester"];
      const userId = parsed.data.userId || requester?.sub;

      const result = await this.aiFacade.getSmartReplies({
        conversationId: parsed.data.conversationId,
        userId,
      });
      return res.json(result);
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }

  async toneAdjust(req: Request, res: Response) {
    try {
      const parsed = ToneAdjustSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.adjustTone(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }

  async translate(req: Request, res: Response) {
    try {
      const parsed = TranslateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.translate(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }

  async detectLanguage(req: Request, res: Response) {
    try {
      const parsed = DetectLanguageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const language = await this.aiFacade.detectLanguage(parsed.data);
      return res.json({ language });
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }

  async smartSearch(req: Request, res: Response) {
    try {
      const parsed = SmartSearchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.smartSearch({
        query: parsed.data.query,
        conversationId: parsed.data.conversationId,
      });
      return res.json(result);
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }

  async extractTasks(req: Request, res: Response) {
    try {
      const parsed = ExtractTasksSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.extractTasks(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      const err = error as { message?: string; statusCode?: number };
      return res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  async moderate(req: Request, res: Response) {
    try {
      const parsed = ModerateContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const result = await this.aiFacade.moderateContent(parsed.data);
      return res.json(result);
    } catch (error: unknown) {
      return handleAiError(error, res);
    }
  }
}
