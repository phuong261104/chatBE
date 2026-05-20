import { z } from "zod";
import { uuidV7 } from "@share/utils/zod-validators";
import { GroupReminderStatus } from "../model";

export const createGroupReminderDTOSchema = z.object({
  conversationId: uuidV7("Invalid group ID"),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  remindAt: z.string().datetime(),
});

export type CreateGroupReminderDTO = z.infer<typeof createGroupReminderDTOSchema>;

export const updateGroupReminderDTOSchema = z.object({
  reminderId: uuidV7("Invalid reminder ID"),
  userId: uuidV7("Invalid user ID"),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  remindAt: z.string().datetime().optional(),
  status: z.nativeEnum(GroupReminderStatus).optional(),
});

export type UpdateGroupReminderDTO = z.infer<typeof updateGroupReminderDTOSchema>;

export const createGroupNoteDTOSchema = z.object({
  conversationId: uuidV7("Invalid group ID"),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

export type CreateGroupNoteDTO = z.infer<typeof createGroupNoteDTOSchema>;

export const updateGroupNoteDTOSchema = z.object({
  noteId: uuidV7("Invalid note ID"),
  userId: uuidV7("Invalid user ID"),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
});

export type UpdateGroupNoteDTO = z.infer<typeof updateGroupNoteDTOSchema>;

export interface CreateGroupReminderCommand {
  conversationId: string;
  userId: string;
  title: string;
  description?: string;
  remindAt: string;
}

export interface UpdateGroupReminderCommand {
  reminderId: string;
  userId: string;
  title?: string;
  description?: string | null;
  remindAt?: string;
  status?: GroupReminderStatus;
}

export interface GroupReminderActionCommand {
  reminderId: string;
  userId: string;
}

export interface CreateGroupNoteCommand {
  conversationId: string;
  userId: string;
  title: string;
  content: string;
}

export interface UpdateGroupNoteCommand {
  noteId: string;
  userId: string;
  title?: string;
  content?: string;
}

export interface GroupNoteActionCommand {
  noteId: string;
  userId: string;
}
