import { ICommandHandler, IQueryHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import { v7 } from "uuid";
import {
  IConversationQueryRepository,
  IGroupInviteLinkQueryRepository,
  IGroupInviteLinkCommandRepository,
  IConversationMemberQueryRepository,
  IUserQueryRepository,
} from "../interface";
import {
  GroupInviteLink,
  GroupInviteLinkStatus,
} from "../model/model";
import {
  GetGroupInviteLinkQuery,
  RegenerateGroupInviteLinkCommand,
  RevokeGroupInviteLinkCommand,
  PreviewInviteQuery,
} from "../model/dto";
import { normalizeGroupSettings, canAddMembers } from "./group-permissions";

export class GetGroupInviteLinkHandler
  implements IQueryHandler<GetGroupInviteLinkQuery, GroupInviteLink>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly groupInviteLinkQueryRepo: IGroupInviteLinkQueryRepository,
    private readonly groupInviteLinkCommandRepo: IGroupInviteLinkCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async query(query: GetGroupInviteLinkQuery): Promise<GroupInviteLink> {
    const conversation = await this.conversationQueryRepo.get(query.groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: query.groupId,
      userId: query.requesterId,
    });
    if (!member || member.leftAt || member.status !== "active") {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const settings = normalizeGroupSettings(conversation.settings);
    if (!canAddMembers(settings, member, conversation)) {
      throw AppError.from(new Error("You do not have permission to get invite link"), 403);
    }

    let link = await this.groupInviteLinkQueryRepo.findActiveByConversationId(query.groupId);
    if (!link) {
      const token = v7();
      link = {
        token,
        conversationId: query.groupId,
        status: GroupInviteLinkStatus.ACTIVE,
        createdBy: query.requesterId,
        createdAt: new Date(),
      };
      await this.groupInviteLinkCommandRepo.insert(link);
    }

    return link;
  }
}

export class RegenerateGroupInviteLinkHandler
  implements ICommandHandler<RegenerateGroupInviteLinkCommand, GroupInviteLink>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly groupInviteLinkQueryRepo: IGroupInviteLinkQueryRepository,
    private readonly groupInviteLinkCommandRepo: IGroupInviteLinkCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: RegenerateGroupInviteLinkCommand): Promise<GroupInviteLink> {
    const conversation = await this.conversationQueryRepo.get(command.groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: command.groupId,
      userId: command.requesterId,
    });
    if (!member || member.leftAt || member.status !== "active") {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const settings = normalizeGroupSettings(conversation.settings);
    if (!canAddMembers(settings, member, conversation)) {
      throw AppError.from(new Error("You do not have permission to manage invite link"), 403);
    }

    const existingLink = await this.groupInviteLinkQueryRepo.findActiveByConversationId(command.groupId);
    if (existingLink) {
      await this.groupInviteLinkCommandRepo.revoke(existingLink.token, command.requesterId);
    }

    const newToken = v7();
    const newLink: GroupInviteLink = {
      token: newToken,
      conversationId: command.groupId,
      status: GroupInviteLinkStatus.ACTIVE,
      createdBy: command.requesterId,
      createdAt: new Date(),
    };
    await this.groupInviteLinkCommandRepo.insert(newLink);

    return newLink;
  }
}

export class RevokeGroupInviteLinkHandler
  implements ICommandHandler<RevokeGroupInviteLinkCommand, void>
{
  constructor(
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly groupInviteLinkQueryRepo: IGroupInviteLinkQueryRepository,
    private readonly groupInviteLinkCommandRepo: IGroupInviteLinkCommandRepository,
    private readonly conversationMemberQueryRepo: IConversationMemberQueryRepository,
  ) {}

  async execute(command: RevokeGroupInviteLinkCommand): Promise<void> {
    const conversation = await this.conversationQueryRepo.get(command.groupId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const member = await this.conversationMemberQueryRepo.findByCond({
      conversationId: command.groupId,
      userId: command.requesterId,
    });
    if (!member || member.leftAt || member.status !== "active") {
      throw AppError.from(new Error("You are not a member of this group"), 403);
    }

    const settings = normalizeGroupSettings(conversation.settings);
    if (!canAddMembers(settings, member, conversation)) {
      throw AppError.from(new Error("You do not have permission to manage invite link"), 403);
    }

    const link = await this.groupInviteLinkQueryRepo.findActiveByConversationId(command.groupId);
    if (!link) {
      throw AppError.from(new Error("No active invite link found"), 404);
    }

    await this.groupInviteLinkCommandRepo.revoke(link.token, command.requesterId);
  }
}

export interface InvitePreviewResult {
  conversationId: string;
  name: string;
  avatarUrl?: string;
  membersCount: number;
  createdBy: string;
}

export class PreviewInviteHandler
  implements IQueryHandler<PreviewInviteQuery, InvitePreviewResult>
{
  constructor(
    private readonly groupInviteLinkQueryRepo: IGroupInviteLinkQueryRepository,
    private readonly conversationQueryRepo: IConversationQueryRepository,
    private readonly userQueryRepo: IUserQueryRepository,
  ) {}

  async query(query: PreviewInviteQuery): Promise<InvitePreviewResult> {
    const link = await this.groupInviteLinkQueryRepo.get(query.token);
    if (!link) {
      throw AppError.from(new Error("Invite link not found or expired"), 404);
    }

    if (link.status === GroupInviteLinkStatus.REVOKED) {
      throw AppError.from(new Error("This invite link has been revoked"), 410);
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw AppError.from(new Error("This invite link has expired"), 410);
    }

    const conversation = await this.conversationQueryRepo.get(link.conversationId);
    if (!conversation) {
      throw AppError.from(new Error("Group not found"), 404);
    }

    const creator = await this.userQueryRepo.get(conversation.createdBy ?? "");

    return {
      conversationId: link.conversationId,
      name: conversation.name || "",
      avatarUrl: conversation.avatarUrl,
      membersCount: conversation.membersCount || 0,
      createdBy: creator?.displayName || "Unknown",
    };
  }
}
