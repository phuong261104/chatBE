import { ConversationMember, Message } from "../model/model";

export function latestVisibilityCutoff(member?: Pick<ConversationMember, "hiddenAt" | "deletedAt"> | null): Date | undefined {
  const dates = [member?.hiddenAt, member?.deletedAt]
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0];
}

export function isMessageAfterCutoff(message: Pick<Message, "createdAt">, cutoff?: Date): boolean {
  return !cutoff || message.createdAt > cutoff;
}
