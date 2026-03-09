import { z } from 'zod';

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled'
}

export const UserVerifiedSchema = z.object({
  email: z.boolean(),
  phone: z.boolean()
});

export const UserPrivacySchema = z.object({
  searchableByEmail: z.boolean(),
  searchableByPhone: z.boolean(),
  searchableByUsername: z.boolean()
});

export const UserSettingsSchema = z.object({
  notifications: z.object({
    push: z.boolean(),
    inApp: z.boolean()
  })
});

export const UserSchema = z.object({
  id: z.string(),

  // Identity
  email: z.string().email().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),

  // Authentication
  password: z.string(),
  salt: z.string(),
  status: z.nativeEnum(UserStatus),
  verified: UserVerifiedSchema,

  // Profile
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),

  // Privacy
  privacy: UserPrivacySchema,

  // Preferences
  settings: UserSettingsSchema,

  lastLoginAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const UserRegistrationDTOSchema = UserSchema.pick({
  email: true,
  password: true
});

export const UserLoginDTOSchema = UserSchema.pick({
  email: true,
  password: true
});

export type UserRegistrationDTO = z.infer<typeof UserRegistrationDTOSchema>;
export type UserLoginDTO = z.infer<typeof UserLoginDTOSchema>;

export type User = z.infer<typeof UserSchema>;
export type UserVerified = z.infer<typeof UserVerifiedSchema>;
export type UserPrivacy = z.infer<typeof UserPrivacySchema>;
export type UserSettings = z.infer<typeof UserSettingsSchema>;
