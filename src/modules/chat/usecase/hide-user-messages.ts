import { ICommandHandler, IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { IConversationMemberQueryRepository, IConversationMemberCommandRepository } from "../interface";
import { ConversationMember } from "../model/model";

export class HideUserMessagesHandler implements ICommandHandler<{ conversationId: string; userId: string; hiddenUserId: string }, void> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: { conversationId: string; userId: string; hiddenUserId: string }): Promise<void> {
    const { conversationId, userId, hiddenUserId } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    if (hiddenUserId === userId) {
      throw AppError.from(new Error("Cannot hide your own messages"), 400);
    }

    const hiddenUsers = member.hiddenUserIds || [];
    if (!hiddenUsers.includes(hiddenUserId)) {
      hiddenUsers.push(hiddenUserId);
    }

    await this.conversationMemberCommandRepo.update(member.id, {
      hiddenUserIds: hiddenUsers,
    } as any);
  }
}

export class UnhideUserMessagesHandler implements ICommandHandler<{ conversationId: string; userId: string; hiddenUserId: string }, void> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: { conversationId: string; userId: string; hiddenUserId: string }): Promise<void> {
    const { conversationId, userId, hiddenUserId } = command;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const hiddenUsers = (member.hiddenUserIds || []).filter(id => id !== hiddenUserId);

    await this.conversationMemberCommandRepo.update(member.id, {
      hiddenUserIds: hiddenUsers,
    } as any);
  }
}

export class GetHiddenUsersHandler implements IQueryHandler<{ conversationId: string; userId: string }, { userId: string; displayName?: string }[]> {
  constructor(
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
    private readonly conversationMemberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async query(query: { conversationId: string; userId: string }): Promise<{ userId: string; displayName?: string }[]> {
    const { conversationId, userId } = query;

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId,
      userId,
    });

    if (!member) {
      throw AppError.from(new Error("You are not a member of this conversation"), 403);
    }

    const hiddenUsers = member.hiddenUserIds || [];
    return hiddenUsers.map(id => ({ userId: id }));
  }
}