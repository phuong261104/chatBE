import { z } from "zod";
import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import { ErrNotMember, ErrTargetNotMember } from "../model/errors";
import { ConversationMemberStatus } from "../model/model";

export const setNicknameDTOSchema = z.object({
  conversationId: z.string(),
  currentUserId: z.string(),
  targetUserId: z.string(),
  nickname: z
    .string()
    .min(1, "Nickname cannot be empty")
    .max(50, "Nickname cannot exceed 50 characters")
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, "Nickname cannot be only whitespace"),
});

export type SetNicknameDTO = z.infer<typeof setNicknameDTOSchema>;

export interface SetNicknameCommand {
  conversationId: string;
  currentUserId: string;
  targetUserId: string;
  nickname: string;
}

export const setWallpaperDTOSchema = z.object({
  conversationId: z.string(),
  currentUserId: z.string(),
  wallpaperUrl: z.string().url("Invalid wallpaper URL").nullable(),
});

export type SetWallpaperDTO = z.infer<typeof setWallpaperDTOSchema>;

export interface SetWallpaperCommand {
  conversationId: string;
  currentUserId: string;
  wallpaperUrl: string | null;
}

export interface RemoveNicknameCommand {
  conversationId: string;
  currentUserId: string;
  targetUserId: string;
}

export interface RemoveWallpaperCommand {
  conversationId: string;
  currentUserId: string;
}

export class SetNicknameHandler implements ICommandHandler<SetNicknameCommand, void> {
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: SetNicknameCommand): Promise<void> {
    const { success, data, error } = setNicknameDTOSchema.safeParse(command);
    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail("validationErrors", error.errors);
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.currentUserId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    const targetMember = await this.memberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.targetUserId,
    });
    if (!targetMember || targetMember.leftAt || targetMember.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrTargetNotMember, 404);
    }

    await this.memberCommandRepo.update(targetMember.id, {
      nickname: data.nickname,
      nicknameUpdatedAt: new Date(),
    });
  }
}

export class RemoveNicknameHandler implements ICommandHandler<RemoveNicknameCommand, void> {
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: RemoveNicknameCommand): Promise<void> {
    const member = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.currentUserId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    const targetMember = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.targetUserId,
    });
    if (!targetMember || targetMember.leftAt || targetMember.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrTargetNotMember, 404);
    }

    await this.memberCommandRepo.update(targetMember.id, {
      nickname: null,
      nicknameUpdatedAt: new Date(),
    });
  }
}

export class SetWallpaperHandler implements ICommandHandler<SetWallpaperCommand, void> {
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: SetWallpaperCommand): Promise<void> {
    const { success, data, error } = setWallpaperDTOSchema.safeParse(command);
    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail("validationErrors", error.errors);
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.currentUserId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    await this.memberCommandRepo.update(member.id, {
      wallpaper: data.wallpaperUrl,
      wallpaperUpdatedAt: new Date(),
    });
  }
}

export class RemoveWallpaperHandler implements ICommandHandler<RemoveWallpaperCommand, void> {
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: RemoveWallpaperCommand): Promise<void> {
    const member = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.currentUserId,
    });
    if (!member || member.leftAt || member.status !== ConversationMemberStatus.ACTIVE) {
      throw AppError.from(ErrNotMember, 403);
    }

    await this.memberCommandRepo.update(member.id, {
      wallpaper: null,
      wallpaperUpdatedAt: new Date(),
    });
  }
}
