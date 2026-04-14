import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import {
  pinConversationDTOSchema,
  PinConversationCommand,
  UnpinConversationCommand,
} from "../model/dto";
import {
  ErrNotMember,
  ErrConversationAlreadyPinned,
  ErrConversationNotPinned,
} from "../model/errors";

export class PinConversationHandler
  implements ICommandHandler<PinConversationCommand, void>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: PinConversationCommand): Promise<void> {
    const { success, data, error } =
      pinConversationDTOSchema.safeParse(command);

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

    if (member.pinned) {
      throw AppError.from(ErrConversationAlreadyPinned, 400);
    }

    await this.memberCommandRepo.update(member.id, { pinned: true, pinnedAt: new Date() });
  }
}

export class UnpinConversationHandler
  implements ICommandHandler<UnpinConversationCommand, void>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: UnpinConversationCommand): Promise<void> {
    const { success, data, error } =
      pinConversationDTOSchema.safeParse(command);

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

    if (!member.pinned) {
      throw AppError.from(ErrConversationNotPinned, 400);
    }

    await this.memberCommandRepo.update(member.id, { pinned: false });
  }
}
