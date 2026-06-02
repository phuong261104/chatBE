import { z } from "zod";
import { UserPhoneSchema } from "@modules/user/model/model";
import { UserStatus } from "@modules/user/model/model";

export { UserStatus };

export const DeviceInfoSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  userAgent: z.string().optional(),
  displayLabel: z.string().optional(),
  platform: z.enum(["app", "web"]).optional(),
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

export const LoginDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: UserPhoneSchema.optional(),
  password: z.string().min(6),
  deviceInfo: DeviceInfoSchema.optional(),
}).refine((data) => data.email || data.phone, {
  message: "Either email or phone must be provided",
});

export const RegistrationDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: UserPhoneSchema,
  password: z.string().min(6).max(128),
  displayName: z.string().optional(),
  deviceInfo: DeviceInfoSchema.optional(),
  sendVerificationEmail: z.boolean().optional(),
});

export const RefreshTokenDTOSchema = z.object({
  refreshToken: z.string(),
});

export const SendVerificationDTOSchema = z.object({
  email: z.string().email(),
});

export const GetUnverifiedEmailByPhoneDTOSchema = z.object({
  phone: UserPhoneSchema,
});

export const VerifyEmailDTOSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export const ForgotPasswordDTOSchema = z.object({
  email: z.string().email(),
});

export const VerifyResetOTPDTOMSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const ResetPasswordDTOSchema = z.object({
  tempToken: z.string().optional(),
  token: z.string().optional(),
  newPassword: z.string().min(6).max(128),
}).refine((data) => data.tempToken || data.token, {
  message: "Either tempToken (from OTP verify) or token (legacy link) must be provided",
});

export const ChangePasswordDTOSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6).max(128),
});

export const UpdateProfileDTOSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
});

export const UpdateAvatarDTOSchema = z.object({
  avatarUrl: z.string().url("avatarUrl must be a valid URL").optional().nullable(),
});

export type LoginDTO = z.infer<typeof LoginDTOSchema>;
export type RegistrationDTO = z.infer<typeof RegistrationDTOSchema>;
export type RefreshTokenDTO = z.infer<typeof RefreshTokenDTOSchema>;
export type SendVerificationDTO = z.infer<typeof SendVerificationDTOSchema>;
export type GetUnverifiedEmailByPhoneDTO = z.infer<typeof GetUnverifiedEmailByPhoneDTOSchema>;
export type VerifyEmailDTO = z.infer<typeof VerifyEmailDTOSchema>;
export type ForgotPasswordDTO = z.infer<typeof ForgotPasswordDTOSchema>;
export type VerifyResetOTPDTO = z.infer<typeof VerifyResetOTPDTOMSchema>;
export type ResetPasswordDTO = z.infer<typeof ResetPasswordDTOSchema>;
export type ChangePasswordDTO = z.infer<typeof ChangePasswordDTOSchema>;
export type UpdateAvatarDTO = z.infer<typeof UpdateAvatarDTOSchema>;
export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTOSchema>;
