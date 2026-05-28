import { Router } from "express";
import { ChatV2Controller } from "./v2-chat-controller";
import { MessagingHttpService } from "../http-service";

export const setupChatV2Routes = (
  controller: ChatV2Controller,
  mdlFactory: any,
  httpService: MessagingHttpService,
) => {
  const router = Router();

  router.get("/conversations", mdlFactory.auth, controller.getConversationsAPI);
  router.get("/conversations/cursor", mdlFactory.auth, controller.getConversationsCursorAPI);
  router.get("/conversations/strangers", mdlFactory.auth, controller.getStrangerConversationsAPI);
  router.get("/conversations/:conversationId/presence", mdlFactory.auth, controller.getConversationPresenceAPI);
  router.post("/conversations/:conversationId/messages", mdlFactory.auth, controller.sendConversationMessageAPI);
  router.post("/conversations/:conversationId/profile-cards", mdlFactory.auth, controller.sendProfileCardAPI);
  router.post("/conversations/:conversationId/hide", mdlFactory.auth, controller.hideConversationAPI);
  router.post("/conversations/:conversationId/unlock", mdlFactory.auth, controller.unlockHiddenConversationAPI);
  router.post("/conversations/:conversationId/unhide", mdlFactory.auth, controller.unhideConversationAPI);

  router.post("/messages/private", mdlFactory.auth, controller.sendPrivateMessageAPI);
  router.post("/messages/save-to-my-document", mdlFactory.auth, controller.saveMessagesToMyDocumentAPI);
  router.put("/messages/:messageId", mdlFactory.auth, controller.editMessageAPI);

  router.get("/message-requests", mdlFactory.auth, controller.listMessageRequestsAPI);
  router.post("/message-requests/:conversationId/accept", mdlFactory.auth, controller.acceptMessageRequestAPI);
  router.post("/message-requests/:conversationId/reject", mdlFactory.auth, controller.rejectMessageRequestAPI);

  router.post("/groups", mdlFactory.auth, controller.createGroupAPI);
  router.post("/groups/:groupId/members", mdlFactory.auth, controller.addMembersAPI);
  router.post("/groups/:groupId/leave", mdlFactory.auth, controller.leaveGroupAPI);
  router.patch("/groups/:groupId/settings", mdlFactory.auth, controller.updateGroupSettingsAPI);

  router.patch("/conversations/:conversationId/nickname", mdlFactory.auth, httpService.setNicknameAPI.bind(httpService));
  router.delete("/conversations/:conversationId/nickname/:targetUserId", mdlFactory.auth, httpService.removeNicknameAPI.bind(httpService));
  router.patch("/conversations/:conversationId/wallpaper", mdlFactory.auth, httpService.setWallpaperAPI.bind(httpService));
  router.delete("/conversations/:conversationId/wallpaper", mdlFactory.auth, httpService.removeWallpaperAPI.bind(httpService));

  return router;
};
