import { IMessagingUseCase } from "../../interface";
import { Request, Response } from "express";
import { MessagingSocketService } from "./socket-service";
import { ConversationActionsController } from "./http/conversation-actions-controller";
import { ConversationController } from "./http/conversation-controller";
import { ConversationQueryController } from "./http/conversation-query-controller";
import { GroupController } from "./http/group-controller";
import { GroupUtilityController } from "./http/group-utility-controller";
import { MemberController } from "./http/member-controller";
import { MessageController } from "./http/message-controller";
import { MessageToolsController } from "./http/message-tools-controller";
import { PollController } from "./http/poll-controller";
import { ReactionController } from "./http/reaction-controller";
import { GroupInviteController } from "./http/group-invite-controller";
import { GroupBlockController } from "./http/group-block-controller";

export interface MessagingHttpServiceDeps {
  groupInviteController: GroupInviteController;
  groupBlockController: GroupBlockController;
}

export class MessagingHttpService {
  private readonly conversationActionsController: ConversationActionsController;
  private readonly conversationController: ConversationController;
  private readonly conversationQueryController: ConversationQueryController;
  private readonly groupController: GroupController;
  private readonly groupUtilityController: GroupUtilityController;
  private readonly memberController: MemberController;
  private readonly messageController: MessageController;
  private readonly messageToolsController: MessageToolsController;
  private readonly pollController: PollController;
  private readonly reactionController: ReactionController;
  private readonly groupInviteController: GroupInviteController;
  private readonly groupBlockController: GroupBlockController;

  constructor(useCase: IMessagingUseCase, deps?: MessagingHttpServiceDeps) {
    this.conversationActionsController = new ConversationActionsController(useCase);
    this.conversationController = new ConversationController(useCase);
    this.conversationQueryController = new ConversationQueryController(useCase);
    this.groupController = new GroupController(useCase);
    this.groupUtilityController = new GroupUtilityController(useCase);
    this.memberController = new MemberController(useCase);
    this.messageController = new MessageController(useCase);
    this.messageToolsController = new MessageToolsController(useCase);
    this.pollController = new PollController(useCase);
    this.reactionController = new ReactionController(useCase);

    if (!deps?.groupInviteController || !deps?.groupBlockController) {
      throw new Error("MessagingHttpService requires groupInviteController and groupBlockController deps");
    }
    this.groupInviteController = deps.groupInviteController;
    this.groupBlockController = deps.groupBlockController;
  }

  setSocketService(socketService: MessagingSocketService) {
    this.conversationActionsController.setSocketService(socketService);
    this.conversationController.setSocketService(socketService);
    this.conversationQueryController.setSocketService(socketService);
    this.groupController.setSocketService(socketService);
    this.groupUtilityController.setSocketService(socketService);
    this.memberController.setSocketService(socketService);
    this.messageController.setSocketService(socketService);
    this.messageToolsController.setSocketService(socketService);
    this.pollController.setSocketService(socketService);
    this.reactionController.setSocketService(socketService);
    this.groupInviteController.setSocketService(socketService);
    this.groupBlockController.setSocketService(socketService);
  }

  async getPrivateConversationAPI(req: Request, res: Response) {
    return this.conversationController.getPrivateConversationAPI(req, res);
  }

  async createGroupAPI(req: Request, res: Response) {
    return this.groupController.createGroupAPI(req, res);
  }

  async addMembersAPI(req: Request, res: Response) {
    return this.memberController.addMembersAPI(req, res);
  }

  async removeMemberAPI(req: Request, res: Response) {
    return this.memberController.removeMemberAPI(req, res);
  }

  async updateGroupAPI(req: Request, res: Response) {
    return this.groupController.updateGroupAPI(req, res);
  }

  async getConversationsAPI(req: Request, res: Response) {
    return this.conversationController.getConversationsAPI(req, res);
  }

  async getConversationsCursorAPI(req: Request, res: Response) {
    return this.conversationController.getConversationsCursorAPI(req, res);
  }

  async getConversationDetailAPI(req: Request, res: Response) {
    return this.conversationController.getConversationDetailAPI(req, res);
  }

  async loadMessagesAPI(req: Request, res: Response) {
    return this.conversationController.loadMessagesAPI(req, res);
  }

  async markAsSeenAPI(req: Request, res: Response) {
    return this.conversationController.markAsSeenAPI(req, res);
  }

  async markAsDeliveredAPI(req: Request, res: Response) {
    return this.conversationController.markAsDeliveredAPI(req, res);
  }

  async getTotalUnreadCountAPI(req: Request, res: Response) {
    return this.conversationController.getTotalUnreadCountAPI(req, res);
  }

  async leaveGroupAPI(req: Request, res: Response) {
    return this.groupController.leaveGroupAPI(req, res);
  }

  async getGroupMembersAPI(req: Request, res: Response) {
    return this.memberController.getGroupMembersAPI(req, res);
  }

  async sendMessageAPI(req: Request, res: Response) {
    return this.messageController.sendMessageAPI(req, res);
  }

  async revokeMessageAPI(req: Request, res: Response) {
    return this.messageController.revokeMessageAPI(req, res);
  }

  async deleteMessageForMeAPI(req: Request, res: Response) {
    return this.messageController.deleteMessageForMeAPI(req, res);
  }

  async deleteMessageForEveryoneAPI(req: Request, res: Response) {
    return this.messageController.deleteMessageForEveryoneAPI(req, res);
  }

  async forwardMessagesAPI(req: Request, res: Response) {
    return this.messageController.forwardMessagesAPI(req, res);
  }

  async saveMessagesToMyDocumentAPI(req: Request, res: Response) {
    return this.conversationActionsController.saveMessagesToMyDocumentAPI(req, res);
  }

  async muteConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.muteConversationAPI(req, res);
  }

  async unmuteConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.unmuteConversationAPI(req, res);
  }

  async pinConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.pinConversationAPI(req, res);
  }

  async unpinConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.unpinConversationAPI(req, res);
  }

  async archiveConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.archiveConversationAPI(req, res);
  }

  async unarchiveConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.unarchiveConversationAPI(req, res);
  }

  async editMessageAPI(req: Request, res: Response) {
    return this.messageController.editMessageAPI(req, res);
  }

  async pinMessageAPI(req: Request, res: Response) {
    return this.messageController.pinMessageAPI(req, res);
  }

  async unpinMessageAPI(req: Request, res: Response) {
    return this.messageController.unpinMessageAPI(req, res);
  }

  async getPinnedMessagesAPI(req: Request, res: Response) {
    return this.messageController.getPinnedMessagesAPI(req, res);
  }

  async searchMessagesAPI(req: Request, res: Response) {
    return this.messageController.searchMessagesAPI(req, res);
  }

  async getConversationMediaAPI(req: Request, res: Response) {
    return this.conversationQueryController.getConversationMediaAPI(req, res);
  }

  async addReactionAPI(req: Request, res: Response) {
    return this.reactionController.addReactionAPI(req, res);
  }

  async removeReactionAPI(req: Request, res: Response) {
    return this.reactionController.removeReactionAPI(req, res);
  }

  async removeAllReactionsAPI(req: Request, res: Response) {
    return this.reactionController.removeAllReactionsAPI(req, res);
  }

  async getReactionsAPI(req: Request, res: Response) {
    return this.reactionController.getReactionsAPI(req, res);
  }

  async quoteMessageAPI(req: Request, res: Response) {
    return this.messageController.quoteMessageAPI(req, res);
  }

  async setAdminAPI(req: Request, res: Response) {
    return this.groupController.setAdminAPI(req, res);
  }

  async transferOwnerAPI(req: Request, res: Response) {
    return this.groupController.transferOwnerAPI(req, res);
  }

  async createPollAPI(req: Request, res: Response) {
    return this.pollController.createPollAPI(req, res);
  }

  async getPollsAPI(req: Request, res: Response) {
    return this.pollController.getPollsAPI(req, res);
  }

  async votePollAPI(req: Request, res: Response) {
    return this.pollController.votePollAPI(req, res);
  }

  async addPollOptionAPI(req: Request, res: Response) {
    return this.pollController.addPollOptionAPI(req, res);
  }

  async getPollResultsAPI(req: Request, res: Response) {
    return this.pollController.getPollResultsAPI(req, res);
  }

  async closePollAPI(req: Request, res: Response) {
    return this.pollController.closePollAPI(req, res);
  }

  async pinPollAPI(req: Request, res: Response) {
    return this.pollController.pinPollAPI(req, res);
  }

  async unpinPollAPI(req: Request, res: Response) {
    return this.pollController.unpinPollAPI(req, res);
  }

  async createGroupReminderAPI(req: Request, res: Response) {
    return this.groupUtilityController.createGroupReminderAPI(req, res);
  }

  async listGroupRemindersAPI(req: Request, res: Response) {
    return this.groupUtilityController.listGroupRemindersAPI(req, res);
  }

  async updateGroupReminderAPI(req: Request, res: Response) {
    return this.groupUtilityController.updateGroupReminderAPI(req, res);
  }

  async deleteGroupReminderAPI(req: Request, res: Response) {
    return this.groupUtilityController.deleteGroupReminderAPI(req, res);
  }

  async pinGroupReminderAPI(req: Request, res: Response) {
    return this.groupUtilityController.pinGroupReminderAPI(req, res);
  }

  async unpinGroupReminderAPI(req: Request, res: Response) {
    return this.groupUtilityController.unpinGroupReminderAPI(req, res);
  }

  async createGroupNoteAPI(req: Request, res: Response) {
    return this.groupUtilityController.createGroupNoteAPI(req, res);
  }

  async listGroupNotesAPI(req: Request, res: Response) {
    return this.groupUtilityController.listGroupNotesAPI(req, res);
  }

  async updateGroupNoteAPI(req: Request, res: Response) {
    return this.groupUtilityController.updateGroupNoteAPI(req, res);
  }

  async deleteGroupNoteAPI(req: Request, res: Response) {
    return this.groupUtilityController.deleteGroupNoteAPI(req, res);
  }

  async getPendingMembersAPI(req: Request, res: Response) {
    return this.groupController.getPendingMembersAPI(req, res);
  }

  async approveMemberAPI(req: Request, res: Response) {
    return this.groupController.approveMemberAPI(req, res);
  }

  async rejectMemberAPI(req: Request, res: Response) {
    return this.groupController.rejectMemberAPI(req, res);
  }

  async updateGroupSettingsAPI(req: Request, res: Response) {
    return this.groupController.updateGroupSettingsAPI(req, res);
  }

  async getGroupInfoAPI(req: Request, res: Response) {
    return this.groupController.getGroupInfoAPI(req, res);
  }

  async dissolveGroupAPI(req: Request, res: Response) {
    return this.groupController.dissolveGroupAPI(req, res);
  }

  async getConversationStatisticsAPI(req: Request, res: Response) {
    return this.conversationQueryController.getConversationStatisticsAPI(req, res);
  }

  async getSharedConversationsAPI(req: Request, res: Response) {
    return this.conversationQueryController.getSharedConversationsAPI(req, res);
  }

  async deleteMessagesBulkAPI(req: Request, res: Response) {
    return this.messageToolsController.deleteMessagesBulkAPI(req, res);
  }

  async getConversationOnlineMembersAPI(req: Request, res: Response) {
    return this.conversationQueryController.getConversationOnlineMembersAPI(req, res);
  }

  async getDraftsAPI(req: Request, res: Response) {
    return this.conversationQueryController.getDraftsAPI(req, res);
  }

  async translateMessageAPI(req: Request, res: Response) {
    return this.messageToolsController.translateMessageAPI(req, res);
  }

  async copyConversationAPI(req: Request, res: Response) {
    return this.conversationActionsController.copyConversationAPI(req, res);
  }

  async getGroupInviteLinkAPI(req: Request, res: Response) {
    return this.groupInviteController.getGroupInviteLinkAPI(req, res);
  }

  async regenerateGroupInviteLinkAPI(req: Request, res: Response) {
    return this.groupInviteController.regenerateGroupInviteLinkAPI(req, res);
  }

  async revokeGroupInviteLinkAPI(req: Request, res: Response) {
    return this.groupInviteController.revokeGroupInviteLinkAPI(req, res);
  }

  async previewInviteAPI(req: Request, res: Response) {
    return this.groupInviteController.previewInviteAPI(req, res);
  }

  async joinGroupByInviteAPI(req: Request, res: Response) {
    return this.groupInviteController.joinGroupByInviteAPI(req, res);
  }

  async getGroupBlocksAPI(req: Request, res: Response) {
    return this.groupBlockController.getGroupBlocksAPI(req, res);
  }

  async blockGroupMemberAPI(req: Request, res: Response) {
    return this.groupBlockController.blockGroupMemberAPI(req, res);
  }

  async unblockGroupMemberAPI(req: Request, res: Response) {
    return this.groupBlockController.unblockGroupMemberAPI(req, res);
  }
}
