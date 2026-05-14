import { z } from 'zod';
import { CallType } from '../../interface';

export const CreateCallDtoSchema = z.object({
  conversationId: z.string().min(1),
  type: z.nativeEnum(CallType),
  calleeIds: z.array(z.string()).optional(),
});

export type CreateCallDto = z.infer<typeof CreateCallDtoSchema>;
