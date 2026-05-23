import { z } from "zod";

export enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
}

export enum UserInfoVisibility {
  EVERYONE = "everyone",
  FRIENDS = "friends",
  ONLY_ME = "only_me",
}

export enum UserGender {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
}

export const UserVerifiedSchema = z.object({
  email: z.boolean(),
  phone: z.boolean(),
});

export const UserPrivacySchema = z.object({
  searchableByEmail: z.boolean().default(true),
  searchableByPhone: z.boolean().default(true),
  searchableByUsername: z.boolean().default(true),
  birthdayVisibility: z.nativeEnum(UserInfoVisibility).default(UserInfoVisibility.FRIENDS),
  phoneVisibility: z.nativeEnum(UserInfoVisibility).default(UserInfoVisibility.FRIENDS),
  avatarVisibility: z.nativeEnum(UserInfoVisibility).default(UserInfoVisibility.EVERYONE),
  showOnline: z.boolean().default(true),
  showLastSeen: z.boolean().default(true),
  blockMessagesFromStrangers: z.boolean().default(false),
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
  tokenVersion: z.number().int().positive().optional(),
  status: z.nativeEnum(UserStatus),
  verified: UserVerifiedSchema,

  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  birthday: z.date().optional(),
  gender: z.nativeEnum(UserGender).optional(),
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
