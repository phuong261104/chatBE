import "module-alias/register";

import axios, { AxiosInstance } from "axios";
import express, { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import { AddressInfo } from "net";
import { Server as SocketIOServer } from "socket.io";
import { io as createSocketClient, Socket as ClientSocket } from "socket.io-client";

import { jwtProvider } from "@share/component/jwt";
import { responseFormatMiddleware } from "@share/middleware";
import { MessagingHttpService, MessagingSocketService } from "@modules/chat/infras";
import { ChatV2Controller } from "@modules/chat/infras/transport/http/v2-chat-controller";
import { setupChatV2Routes } from "@modules/chat/infras/transport/http/v2-chat.routes";
import { SearchHTTPService } from "@modules/search/infras/transport";
import { SearchUseCase } from "@modules/search/usecase";
import { ChatE2EStore } from "./chat-e2e-store";
import { buildUseCase, TestPresenceUseCase } from "./chat-e2e-usecase";
import { socketToken } from "./chat-e2e-socket";

export type EventRecord = {
  target: "user" | "group";
  targetId: string;
  event: string;
  data: any;
};

class RecordingMessagingSocketService extends MessagingSocketService {
  readonly emitted: EventRecord[] = [];

  public emitToUser(userId: string, event: string, data: any) {
    this.emitted.push({ target: "user", targetId: userId, event, data });
    super.emitToUser(userId, event, data);
  }

  public emitToGroupRoom(conversationId: string, event: string, data: any) {
    this.emitted.push({ target: "group", targetId: conversationId, event, data });
    super.emitToGroupRoom(conversationId, event, data);
  }
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("user:")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.requester = { sub: token.slice("user:".length) };
  next();
}

export type ChatE2EHarness = {
  api: AxiosInstance;
  store: ChatE2EStore;
  socketEvents: EventRecord[];
  connectMessagesSocket: (userId: string) => Promise<ClientSocket>;
  close: () => Promise<void>;
};

export async function createChatE2EHarness(): Promise<ChatE2EHarness> {
  const store = new ChatE2EStore();
  const { repos, useCase } = buildUseCase(store);
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });
  const presenceUseCase = new TestPresenceUseCase();
  const socketService = new RecordingMessagingSocketService(io, useCase as any, presenceUseCase as any);
  const httpService = new MessagingHttpService(useCase as any);
  httpService.setSocketService(socketService);
  const searchUseCase = new SearchUseCase({
    userRepo: repos.userRepo as any,
    conversationRepo: repos.conversationRepo as any,
    conversationMemberRepo: repos.memberRepo as any,
    messageRepo: repos.messageRepo as any,
    classificationRepo: repos.classificationRepo as any,
    blockRepo: repos.blockRepo as any,
  });
  const searchHttpService = new SearchHTTPService(searchUseCase);

  const mdlFactory = {
    auth,
    allowRoles: () => (_req: Request, _res: Response, next: NextFunction) => next(),
    upload: {},
  };
  const v2Controller = new ChatV2Controller(
    useCase as any,
    repos.conversationRepo as any,
    repos.memberRepo as any,
    repos.messageRepo as any,
    repos.friendshipRepo as any,
    repos.blockRepo as any,
    repos.userRepo as any,
    socketService,
    presenceUseCase as any,
  );

  app.use(express.json());
  app.use("/v1", responseFormatMiddleware);
  app.use("/v2", responseFormatMiddleware);

  const v1Router = express.Router();
  v1Router.get("/conversations", auth, httpService.getConversationsAPI.bind(httpService));
  v1Router.get("/conversations/cursor", auth, httpService.getConversationsCursorAPI.bind(httpService));
  v1Router.get("/conversations/:conversationId/messages", auth, httpService.loadMessagesAPI.bind(httpService));
  v1Router.post("/conversations/:conversationId/delivered", auth, httpService.markAsDeliveredAPI.bind(httpService));
  v1Router.post("/conversations/:conversationId/seen", auth, httpService.markAsSeenAPI.bind(httpService));
  v1Router.post("/messages/:messageId/revoke", auth, httpService.revokeMessageAPI.bind(httpService));
  v1Router.post("/messages/:messageId/delete", auth, httpService.deleteMessageForMeAPI.bind(httpService));
  v1Router.post(
    "/messages/:messageId/delete-for-everyone",
    auth,
    httpService.deleteMessageForEveryoneAPI.bind(httpService),
  );
  v1Router.post("/messages/forward", auth, httpService.forwardMessagesAPI.bind(httpService));
  v1Router.post("/messages/save-to-my-document", auth, httpService.saveMessagesToMyDocumentAPI.bind(httpService));
  v1Router.post("/messages/:messageId/pin", auth, httpService.pinMessageAPI.bind(httpService));
  v1Router.delete("/messages/:messageId/pin", auth, httpService.unpinMessageAPI.bind(httpService));
  v1Router.post(
    "/conversations/:conversationId/pin-conversation",
    auth,
    httpService.pinConversationAPI.bind(httpService),
  );
  v1Router.delete(
    "/conversations/:conversationId/pin-conversation",
    auth,
    httpService.unpinConversationAPI.bind(httpService),
  );
  v1Router.get(
    "/conversations/:conversationId/pinned-messages",
    auth,
    httpService.getPinnedMessagesAPI.bind(httpService),
  );
  v1Router.post("/messages/:messageId/react", auth, httpService.addReactionAPI.bind(httpService));
  v1Router.delete("/messages/:messageId/react", auth, httpService.removeReactionAPI.bind(httpService));
  v1Router.get("/messages/:messageId/reactions", auth, httpService.getReactionsAPI.bind(httpService));
  v1Router.post("/messages/:messageId/quote", auth, httpService.quoteMessageAPI.bind(httpService));
  v1Router.get("/conversations/:conversationId/search", auth, httpService.searchMessagesAPI.bind(httpService));
  v1Router.get("/conversations/:conversationId/media", auth, httpService.getConversationMediaAPI.bind(httpService));
  v1Router.get("/search", auth, searchHttpService.globalSearchAPI.bind(searchHttpService));
  v1Router.post("/groups/:groupId/set-admin", auth, httpService.setAdminAPI.bind(httpService));
  v1Router.post("/groups/:groupId/transfer-owner", auth, httpService.transferOwnerAPI.bind(httpService));
  v1Router.get("/groups/:groupId/pending-members", auth, httpService.getPendingMembersAPI.bind(httpService));
  v1Router.post("/groups/:groupId/members/:userId/approve", auth, httpService.approveMemberAPI.bind(httpService));
  v1Router.post("/groups/:groupId/members/:userId/reject", auth, httpService.rejectMemberAPI.bind(httpService));
  v1Router.post("/groups/:groupId/polls", auth, httpService.createPollAPI.bind(httpService));
  v1Router.get("/groups/:groupId/polls", auth, httpService.getPollsAPI.bind(httpService));
  v1Router.post("/groups/:groupId/polls/:pollId/vote", auth, httpService.votePollAPI.bind(httpService));
  v1Router.get("/groups/:groupId/polls/:pollId/results", auth, httpService.getPollResultsAPI.bind(httpService));
  v1Router.post("/groups/:groupId/polls/:pollId/lock", auth, httpService.closePollAPI.bind(httpService));
  v1Router.post("/groups/:groupId/polls/:pollId/pin", auth, httpService.pinPollAPI.bind(httpService));
  v1Router.delete("/groups/:groupId/polls/:pollId/pin", auth, httpService.unpinPollAPI.bind(httpService));
  v1Router.get("/groups/:groupId/reminders", auth, httpService.listGroupRemindersAPI.bind(httpService));
  v1Router.post("/groups/:groupId/reminders", auth, httpService.createGroupReminderAPI.bind(httpService));
  v1Router.put("/groups/:groupId/reminders/:reminderId", auth, httpService.updateGroupReminderAPI.bind(httpService));
  v1Router.delete("/groups/:groupId/reminders/:reminderId", auth, httpService.deleteGroupReminderAPI.bind(httpService));
  v1Router.get("/groups/:groupId/notes", auth, httpService.listGroupNotesAPI.bind(httpService));
  v1Router.post("/groups/:groupId/notes", auth, httpService.createGroupNoteAPI.bind(httpService));
  v1Router.put("/groups/:groupId/notes/:noteId", auth, httpService.updateGroupNoteAPI.bind(httpService));
  v1Router.delete("/groups/:groupId/notes/:noteId", auth, httpService.deleteGroupNoteAPI.bind(httpService));

  app.use("/v1", v1Router);
  app.use("/v2", setupChatV2Routes(v2Controller, mdlFactory as any));

  const jwtSpy = jest.spyOn(jwtProvider, "verifyToken").mockImplementation(async (token: string) => {
    const normalized = token.replace(/^Bearer\s+/i, "");
    if (!normalized.startsWith("user:")) return null;
    return { sub: normalized.slice("user:".length) } as any;
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const { port } = httpServer.address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${port}`;
  const clients: ClientSocket[] = [];
  const api = axios.create({
    baseURL,
    validateStatus: () => true,
    proxy: false,
  });

  return {
    api,
    store,
    socketEvents: socketService.emitted,
    connectMessagesSocket: async (userId: string) => {
      const socket = createSocketClient(`${baseURL}/messages`, {
        auth: { token: socketToken(userId) },
        transports: ["websocket"],
        forceNew: true,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out connecting messages socket")), 1000);
        socket.once("connect", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once("connect_error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      return socket;
    },
    close: async () => {
      for (const client of clients) {
        client.disconnect();
      }
      jwtSpy.mockRestore();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}
