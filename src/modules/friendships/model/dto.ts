import { z } from "zod";

export const FriendshipCreateSchema = z
  .object({
    userA: z.string(),
    userB: z.string(),
  })
  .refine((data) => data.userA !== data.userB, {
    message: "userA and userB must be different",
  });

export type FriendshipCreateDTO = z.infer<typeof FriendshipCreateSchema>;

export const FriendshipUpdateSchema = z.object({});

export type FriendshipUpdateDTO = z.infer<typeof FriendshipUpdateSchema>;

export const FriendshipCondDTOSchema = z.object({
  userA: z.string().optional(),
  userB: z.string().optional(),
  userId: z.string().optional(),
});

export type FriendshipCondDTO = z.infer<typeof FriendshipCondDTOSchema>;
