import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationQueryRepository,
  IUserQueryRepository,
} from "../interface";
import {
  Conversation,
  ConversationMember,
  ConversationMemberStatus,
  ConversationType,
  Message,
  MessageStatus,
} from "../model/model";

type BlockLookupRepository = {
  findByCond(cond: { blockerId?: string; blockedUserId?: string }): Promise<unknown | null>;
};

export class ChatAccessPolicy {
  constructor(
    private readonly userQueryRepo: IUserQueryRepository,
    private readonly blockQueryRepo: BlockLookupRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  private error(message: string, statusCode: number, code?: string): AppError {
    const err = AppError.from(new Error(message), statusCode);
    return code ? err.withDetail("code", code) : err;
  }

  async assertActiveUser(userId: string, code = "disabled"): Promise<void> {
    const user = await this.userQueryRepo.get(userId);
    if (!user) {
      throw this.error("User not found", 404, "not-found");
    }
    if (user.status !== "active") {
      throw this.error("User is disabled", 400, code);
    }
  }

  async assertNotBlockedBetween(userA: string, userB: string): Promise<void> {
    if (userA === userB) return;

    const [blockedByA, blockedByB] = await Promise.all([
      this.blockQueryRepo.findByCond({ blockerId: userA, blockedUserId: userB }),
      this.blockQueryRepo.findByCond({ blockerId: userB, blockedUserId: userA }),
    ]);

    if (blockedByA || blockedByB) {
      throw this.error("Users are blocked", 403, "blocked");
    }
  }

  async assertCanStartPrivateConversation(currentUserId: string, targetUserId: string): Promise<void> {
    await this.assertActiveUser(currentUserId);
    await this.assertActiveUser(targetUserId);
    await this.assertNotBlockedBetween(currentUserId, targetUserId);
  }

  async validateCreateGroupMembers(creatorId: string, memberIds: string[]): Promise<string[]> {
    if (memberIds.length < 2) {
      throw this.error("Group must have at least 3 members including creator", 400, "too-few-members");
    }
    if (memberIds.length > 49) {
      throw this.error("Group cannot have more than 50 members including creator", 400, "too-many-members");
    }

    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length !== memberIds.length) {
      throw this.error("Duplicate members are not allowed", 400, "duplicate");
    }
    if (uniqueMemberIds.includes(creatorId)) {
      throw this.error("Creator cannot be included in memberIds", 400, "self");
    }

    const users = await this.userQueryRepo.findByIds([creatorId, ...uniqueMemberIds]);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const creator = userMap.get(creatorId);
    if (!creator) {
      throw this.error("Creator not found", 404, "not-found");
    }
    if (creator.status !== "active") {
      throw this.error("Creator is disabled", 400, "disabled");
    }

    for (const memberId of uniqueMemberIds) {
      const user = userMap.get(memberId);
      if (!user) {
        throw this.error(`User ${memberId} not found`, 404, "not-found");
      }
      if (user.status !== "active") {
        throw this.error(`User ${memberId} is disabled`, 400, "disabled");
      }
    }

    for (const memberId of uniqueMemberIds) {
      await this.assertNotBlockedBetween(creatorId, memberId);
    }

    return uniqueMemberIds;
  }

  async validateAddGroupMembers(requesterId: string, memberIds: string[], currentMemberCount: number): Promise<string[]> {
    if (memberIds.length < 1) {
      throw this.error("At least one member is required", 400, "too-few-members");
    }
    if (memberIds.length > 49 || currentMemberCount + memberIds.length > 50) {
      throw this.error("Group cannot have more than 50 members including creator", 400, "too-many-members");
    }

    const uniqueMemberIds = [...new Set(memberIds)];
    if (uniqueMemberIds.length !== memberIds.length) {
      throw this.error("Duplicate members are not allowed", 400, "duplicate");
    }
    if (uniqueMemberIds.includes(requesterId)) {
      throw this.error("Requester cannot add themselves", 400, "self");
    }

    const users = await this.userQueryRepo.findByIds(uniqueMemberIds);
    const userMap = new Map(users.map((user) => [user.id, user]));
    for (const memberId of uniqueMemberIds) {
      const user = userMap.get(memberId);
      if (!user) {
        throw this.error(`User ${memberId} not found`, 404, "not-found");
      }
      if (user.status !== "active") {
        throw this.error(`User ${memberId} is disabled`, 400, "disabled");
      }
      await this.assertNotBlockedBetween(requesterId, memberId);
    }

    return uniqueMemberIds;
  }

  async assertActiveMember(conversationId: string, userId: string): Promise<ConversationMember> {
    const member = await this.conversationMemberQueryRepo.findByCond({ conversationId, userId });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw this.error("Unauthorized: You are not an active member of this conversation", 403, "not-member");
    }
    return member;
  }

  async assertActiveGroupMember(conversationId: string, userId: string): Promise<ConversationMember> {
    const conversation = await this.assertGroupConversation(conversationId);
    void conversation;
    return this.assertActiveMember(conversationId, userId);
  }

  async assertGroupConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationQueryRepo.get(conversationId);
    if (!conversation) {
      throw this.error("Conversation not found", 404, "conversation-not-found");
    }
    if (conversation.type !== ConversationType.GROUP) {
      throw this.error("Only group conversations are supported", 400, "not-group");
    }
    return conversation;
  }

  async getActiveMemberUserIds(conversationId: string, excludeUserId?: string): Promise<string[]> {
    const members = await this.conversationMemberQueryRepo.listByConversationId(conversationId);
    return members
      .filter((member) => member.status === ConversationMemberStatus.ACTIVE && !member.leftAt)
      .filter((member) => !excludeUserId || member.userId !== excludeUserId)
      .map((member) => member.userId);
  }

  assertMessageVisibleToUser(message: Message, userId: string): void {
    if (this.isMessageHiddenForUser(message, userId)) {
      throw this.error("Message not found", 404, "message-hidden");
    }
  }

  assertMessageInteractable(message: Message): void {
    if (message.messageStatus === MessageStatus.REVOKED || message.deletedAt) {
      throw this.error("Message cannot be interacted with", 400, "message-revoked");
    }
  }

  isMessageHiddenForUser(message: Message, userId: string): boolean {
    return !!message.deletedForUserIds?.includes(userId);
  }
}
