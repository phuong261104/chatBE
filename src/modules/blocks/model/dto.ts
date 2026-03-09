import { z } from "zod";

export const BlockCreateSchema = z
  .object({
    blockerId: z.string(),
    blockedUserId: z.string(),
  })
  .refine((data) => data.blockerId !== data.blockedUserId, {
    message: "Cannot block yourself",
  });

export type BlockCreateDTO = z.infer<typeof BlockCreateSchema>;

export const BlockUpdateSchema = z.object({});

export type BlockUpdateDTO = z.infer<typeof BlockUpdateSchema>;

export const BlockCondDTOSchema = z.object({
  blockerId: z.string().optional(),
  blockedUserId: z.string().optional(),
});

export type BlockCondDTO = z.infer<typeof BlockCondDTOSchema>;
