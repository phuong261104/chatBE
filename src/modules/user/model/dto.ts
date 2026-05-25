import { z } from 'zod';
import {
  UserGender,
  UserInfoVisibility,
  UserStatus,
  UserVerifiedSchema,
  UserPrivacySchema,
  UserSettingsSchema,
} from './model';

export const UserCreateSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    username: z.string().optional(),
    password: z.string(),
    salt: z.string(),
    displayName: z.string().optional(),
    avatarUrl: z.string().optional(),
    coverUrl: z.string().optional(),
    birthday: z.date().optional(),
    gender: z.nativeEnum(UserGender).optional(),
    bio: z.string().optional(),
    verified: UserVerifiedSchema.optional(),
    privacy: UserPrivacySchema.optional(),
    settings: UserSettingsSchema.optional()
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone must be provided'
  });

export type UserCreateDTO = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  salt: z.string().optional(),
  tokenVersion: z.number().int().positive().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  birthday: z.date().optional(),
  gender: z.nativeEnum(UserGender).optional(),
  bio: z.string().optional(),
  verified: UserVerifiedSchema.optional(),
  privacy: UserPrivacySchema.optional(),
  settings: UserSettingsSchema.optional(),
  lastLoginAt: z.date().optional(),
  emailVerifiedAt: z.date().optional()
});

export type UserUpdateDTO = z.infer<typeof UserUpdateSchema>;

export const UpdateProfileDTOSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  birthday: z.coerce.date().optional().nullable(),
  gender: z.nativeEnum(UserGender).optional().nullable(),
  bio: z.string().max(500).optional(),
});

export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTOSchema>;

export const UpdatePrivacyV2DTOSchema = z.object({
  birthdayVisibility: z.nativeEnum(UserInfoVisibility).optional(),
  phoneVisibility: z.nativeEnum(UserInfoVisibility).optional(),
  avatarVisibility: z.nativeEnum(UserInfoVisibility).optional(),
  showOnline: z.boolean().optional(),
  showLastSeen: z.boolean().optional(),
  searchableByPhone: z.boolean().optional(),
  searchableByEmail: z.boolean().optional(),
  searchableByUsername: z.boolean().optional(),
  blockMessagesFromStrangers: z.boolean().optional(),
});

export type UpdatePrivacyV2DTO = z.infer<typeof UpdatePrivacyV2DTOSchema>;

export const UserCondDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  'verified.email': z.boolean().optional(),
  'verified.phone': z.boolean().optional()
});

export type UserCondDTO = z.infer<typeof UserCondDTOSchema>;

export const UserPhoneSearchSchema = z.object({
  phone: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  'privacy.searchableByPhone': z.boolean().optional()
});

export type UserPhoneSearchDTO = z.infer<typeof UserPhoneSearchSchema>;

export const UserPublicSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  birthday: z.date().optional(),
  gender: z.nativeEnum(UserGender).optional(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  verified: UserVerifiedSchema,
});

export type UserPublic = z.infer<typeof UserPublicSchema>;
