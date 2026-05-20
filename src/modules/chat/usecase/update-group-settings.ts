import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationQueryRepository,
  IConversationCommandRepository,
  IConversationMemberQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMemberStatus,
  ConversationType,
} from "../model/model";
import { UpdateGroupSettingsCommand } from "../model/dto";
import { isGroupManager, normalizeGroupSettings } from "./group-permissions";

export class UpdateGroupSettingsHandler implements ICommandHandler<UpdateGroupSettingsCommand, Conversation> {
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationCommandRepo: IConversationCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: UpdateGroupSettingsCommand): Promise<Conversation> {
    const {
      groupId,
      requesterId,
      allowSendLink,
      requireApproval,
      allowMemberInvite,
      whoCanSendMessages,
      whoCanAddMembers,
      utilityPermissions,
    } = command;

    const conversation = await this.conversationQueryRepo.get(groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw AppError.from(new Error("Only group conversations have settings"), 400);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: groupId,
      userId: requesterId,
    });

    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    if (!isGroupManager(member, conversation)) {
      throw AppError.from(new Error("Only owner or admins can update group settings"), 403);
    }

    const currentSettings = normalizeGroupSettings(conversation.settings);

    const updateData: any = {
      settings: {
        ...currentSettings,
        ...(allowSendLink !== undefined && { allowSendLink }),
        ...(requireApproval !== undefined && { requireApproval }),
        ...(allowMemberInvite !== undefined && { allowMemberInvite }),
        ...(whoCanSendMessages !== undefined && { whoCanSendMessages }),
        ...(whoCanAddMembers !== undefined && { whoCanAddMembers }),
        ...(utilityPermissions !== undefined && {
          utilityPermissions: {
            ...currentSettings.utilityPermissions,
            ...utilityPermissions,
          },
        }),
      },
    };

    await this.conversationCommandRepo.update(groupId, updateData);

    const updatedConversation = await this.conversationQueryRepo.get(groupId);
    if (!updatedConversation) {
      throw AppError.from(new Error("Failed to get updated conversation"), 500);
    }

    return updatedConversation;
  }
}
