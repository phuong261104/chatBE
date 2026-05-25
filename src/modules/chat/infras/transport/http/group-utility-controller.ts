import { Request, Response } from "express";
import { z } from "zod";
import { IMessagingUseCase } from "../../../interface";
import { SocketEvent } from "../../../constants/socket-events";
import {
  createGroupNoteDTOSchema,
  createGroupReminderDTOSchema,
  updateGroupNoteDTOSchema,
  updateGroupReminderDTOSchema,
} from "../../../model/dto/group-utility-dto";
import { MessagingSocketService } from "../socket-service";

export class GroupUtilityController {
  private socketService?: MessagingSocketService;

  constructor(private readonly useCase: IMessagingUseCase) {}

  setSocketService(socketService: MessagingSocketService) {
    this.socketService = socketService;
  }

  async createGroupReminderAPI(req: Request, res: Response) {
    try {
      const groupId = this.getParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      const data = createGroupReminderDTOSchema.parse({ conversationId: groupId, ...req.body });
      const reminder = await this.useCase.createGroupReminder(
        data.conversationId,
        currentUserId,
        data.title,
        data.description,
        data.remindAt,
      );
      this.socketService?.emitToGroupRoom(groupId, SocketEvent.GROUP_REMINDER_CREATED, {
        conversationId: groupId,
        reminder,
        createdBy: currentUserId,
      });
      res.status(201).json({ data: reminder });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async listGroupRemindersAPI(req: Request, res: Response) {
    try {
      const groupId = this.getParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      const reminders = await this.useCase.listGroupReminders(groupId, currentUserId);
      res.status(200).json({ data: reminders });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async updateGroupReminderAPI(req: Request, res: Response) {
    try {
      const reminderId = this.getParam(req, "reminderId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      const data = updateGroupReminderDTOSchema.parse({ reminderId, userId: currentUserId, ...req.body });
      const reminder = await this.useCase.updateGroupReminder(reminderId, currentUserId, {
        title: data.title,
        description: data.description,
        remindAt: data.remindAt,
        status: data.status,
      });
      this.socketService?.emitToGroupRoom(reminder.conversationId, SocketEvent.GROUP_REMINDER_UPDATED, {
        conversationId: reminder.conversationId,
        reminder,
        updatedBy: currentUserId,
      });
      res.status(200).json({ data: reminder });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async deleteGroupReminderAPI(req: Request, res: Response) {
    try {
      const groupId = this.getParam(req, "groupId");
      const reminderId = this.getParam(req, "reminderId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      await this.useCase.deleteGroupReminder(reminderId, currentUserId);
      this.socketService?.emitToGroupRoom(groupId, SocketEvent.GROUP_REMINDER_DELETED, {
        conversationId: groupId,
        reminderId,
        deletedBy: currentUserId,
      });
      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async createGroupNoteAPI(req: Request, res: Response) {
    try {
      const groupId = this.getParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      const data = createGroupNoteDTOSchema.parse({ conversationId: groupId, ...req.body });
      const note = await this.useCase.createGroupNote(data.conversationId, currentUserId, data.title, data.content);
      this.socketService?.emitToGroupRoom(groupId, SocketEvent.GROUP_NOTE_CREATED, {
        conversationId: groupId,
        note,
        createdBy: currentUserId,
      });
      res.status(201).json({ data: note });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async listGroupNotesAPI(req: Request, res: Response) {
    try {
      const groupId = this.getParam(req, "groupId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      const notes = await this.useCase.listGroupNotes(groupId, currentUserId);
      res.status(200).json({ data: notes });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async updateGroupNoteAPI(req: Request, res: Response) {
    try {
      const noteId = this.getParam(req, "noteId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      const data = updateGroupNoteDTOSchema.parse({ noteId, userId: currentUserId, ...req.body });
      const note = await this.useCase.updateGroupNote(noteId, currentUserId, {
        title: data.title,
        content: data.content,
      });
      this.socketService?.emitToGroupRoom(note.conversationId, SocketEvent.GROUP_NOTE_UPDATED, {
        conversationId: note.conversationId,
        note,
        updatedBy: currentUserId,
      });
      res.status(200).json({ data: note });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  async deleteGroupNoteAPI(req: Request, res: Response) {
    try {
      const groupId = this.getParam(req, "groupId");
      const noteId = this.getParam(req, "noteId");
      const currentUserId = this.getCurrentUserId(res);
      if (!currentUserId) return this.unauthorized(res);

      await this.useCase.deleteGroupNote(noteId, currentUserId);
      this.socketService?.emitToGroupRoom(groupId, SocketEvent.GROUP_NOTE_DELETED, {
        conversationId: groupId,
        noteId,
        deletedBy: currentUserId,
      });
      res.status(200).json({ success: true });
    } catch (error) {
      this.sendError(res, error);
    }
  }

  private getParam(req: Request, name: string): string {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private getCurrentUserId(res: Response): string | undefined {
    return res.locals["requester"]?.sub;
  }

  private unauthorized(res: Response) {
    res.status(401).json({ error: "Unauthorized" });
  }

  private sendError(res: Response, error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(422).json({ error: "Validation error", details: error.errors });
      return;
    }

    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 400).json({ error: err.message });
  }
}
