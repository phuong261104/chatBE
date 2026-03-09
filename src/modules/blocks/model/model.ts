import { z } from 'zod';

export const BlockSchema = z.object({
  id: z.string(),
  blockerId: z.string(),
  blockedUserId: z.string(),
  createdAt: z.date()
});

export type Block = z.infer<typeof BlockSchema>;
