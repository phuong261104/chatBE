import { ICommandHandler } from "@share/interface";
import { AppError } from "@share/app-error";
import {
  IConversationMemberQueryRepository,
  IConversationMemberCommandRepository,
} from "../interface";
import {
  muteConversationDTOSchema,
  MuteConversationCommand,
  UnmuteConversationCommand,
} from "../model/dto";
import { ErrNotMember } from "../model/errors";

export class MuteConversationHandler
  implements ICommandHandler<MuteConversationCommand, void>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: MuteConversationCommand): Promise<void> {
    const { success, data, error } =
      muteConversationDTOSchema.safeParse(command);

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

    let muteUntilDate: Date;
    if (data.muteUntil) {
      muteUntilDate = new Date(data.muteUntil);
    } else if (data.duration) {
      muteUntilDate = new Date(Date.now() + data.duration);
    } else {
      muteUntilDate = new Date("9999-12-31");
    }

    await this.memberCommandRepo.update(member.id, { muteUntil: muteUntilDate });
  }
}

export class UnmuteConversationHandler
  implements ICommandHandler<UnmuteConversationCommand, void>
{
  constructor(
    private readonly memberQueryRepo: IConversationMemberQueryRepository,
    private readonly memberCommandRepo: IConversationMemberCommandRepository,
  ) {}

  async execute(command: UnmuteConversationCommand): Promise<void> {
    const member = await this.memberQueryRepo.findByCond({
      conversationId: command.conversationId,
      userId: command.userId,
    });

    if (!member || member.leftAt) {
      throw AppError.from(ErrNotMember, 403);
    }

    await this.memberCommandRepo.update(member.id, {
      muteUntil: undefined,
    });
  }
}
