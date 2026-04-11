import { z } from "zod";

export enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
}

export const UserVerifiedSchema = z.object({
  email: z.boolean(),
  phone: z.boolean(),
});

export const UserPrivacySchema = z.object({
  searchableByEmail: z.boolean(),
  searchableByPhone: z.boolean(),
  searchableByUsername: z.boolean(),
});

export const UserSettingsSchema = z.object({
  notifications: z.object({
    push: z.boolean(),
    inApp: z.boolean(),
  }),
});

export const UserPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{4,15}$/, "Phone number is invalid");

export const UserSchema = z.object({
  id: z.string(),

  email: z.string().email().optional(),
  phone: UserPhoneSchema.optional(),
  username: z.string().optional(),

  password: z.string(),
  salt: z.string(),
  status: z.nativeEnum(UserStatus),
  verified: UserVerifiedSchema,

  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),

  privacy: UserPrivacySchema,

  settings: UserSettingsSchema,

  lastLoginAt: z.date().optional(),
  lastSeen: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
export type UserVerified = z.infer<typeof UserVerifiedSchema>;
export type UserPrivacy = z.infer<typeof UserPrivacySchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
