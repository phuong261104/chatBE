import { z } from "zod";
import { UserPhoneSchema } from "@modules/user/model/model";
import { UserStatus } from "@modules/user/model/model";

export { UserStatus };

export const LoginDTOSchema = z
  .object({
    email: z.string().email().optional(),
    phone: UserPhoneSchema.optional(),
    password: z.string().min(6),
  })
  .refine((data) => data.email || data.phone, {
    message: "Either email or phone must be provided",
  });

export const RegistrationDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: UserPhoneSchema,
  password: z.string().min(6),
  displayName: z.string().optional(),
});

export type LoginDTO = z.infer<typeof LoginDTOSchema>;
export type RegistrationDTO = z.infer<typeof RegistrationDTOSchema>;
