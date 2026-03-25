import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import {
  archiveConversationDTOSchema,
  ArchiveConversationCommand,
  UnarchiveConversationCommand,
} from "../model/dto";
import {
  ErrNotMember,
  ErrConversationAlreadyArchived,
  ErrConversationNotArchived,
} from "../model/errors";

export class ArchiveConversationHandler
  implements ICommandHandler<ArchiveConversationCommand, void>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: ArchiveConversationCommand): Promise<void> {
    const { success, data, error } =
      archiveConversationDTOSchema.safeParse(command);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (member.archived) {
      throw AppError.from(ErrConversationAlreadyArchived, 400);
    }

    await this.memberCommandRepo.update(member.id, { archived: true });
  }
}

export class UnarchiveConversationHandler
  implements ICommandHandler<UnarchiveConversationCommand, void>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: UnarchiveConversationCommand): Promise<void> {
    const { success, data, error } =
      archiveConversationDTOSchema.safeParse(command);

    if (!success) {
      throw AppError.from(new Error("Invalid data"), 400).withDetail(
        "validationErrors",
        error.errors,
      );
    }

    const member = await this.memberQueryRepo.findByCond({
      conversationId: data.conversationId,
      userId: data.userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
    }

    if (!member.archived) {
      throw AppError.from(ErrConversationNotArchived, 400);
    }

    await this.memberCommandRepo.update(member.id, { archived: false });
  }
}
