import {
  DeviceInfo,
  DeviceType,
  IRepository,
  Platform,
  Requester,
  TokenIntrospectResult,
  TokenPair,
} from "@share/interface";
import { User } from "@modules/user/model/model";
import { UserCondDTO, UserUpdateDTO } from "@modules/user/model/dto";
import {
  ChangePasswordDTO,
  ForgotPasswordDTO,
  GetUnverifiedEmailByPhoneDTO,
  LoginDTO,
  RegistrationDTO,
  ResetPasswordDTO,
  SendVerificationDTO,
  VerifyEmailDTO,
  VerifyResetOTPDTO,
} from "../model/dto";

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshExpiresIn: number;
  deviceId: string;
  deviceType: DeviceType;
  displayLabel?: string;
  platform?: Platform;
  user: {
    id: string;
    email?: string;
    phone?: string;
    displayName?: string;
    avatarUrl?: string;
    verified: {
      email: boolean;
      phone: boolean;
    };
  };
}

export interface RegisterPendingResponse {
  pendingVerification: true;
  userId: string;
  email: string;
  expiresIn: number;
  message: string;
}

export interface ResetOTPVerifyResponse {
  tempToken: string;
  expiresIn: number;
}

export interface AuthSessionView {
  deviceId: string;
  deviceType: DeviceType;
  displayLabel: string;
  platform: Platform;
  ip: string;
  location: string;
  createdAt: Date;
  lastActive: Date;
  isCurrent: boolean;
}

export interface AuthRedisClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  sAdd(key: string, value: string): Promise<unknown>;
  sRem(key: string, value: string): Promise<unknown>;
  sMembers(key: string): Promise<string[]>;
}

export interface RefreshTokenRecord {
  userId: string;
  deviceId: string;
  tokenVersion?: number;
}

export interface IAuthUserRepository extends IRepository<User, UserCondDTO, UserUpdateDTO> {}

export interface IAuthUseCase {
  login(data: LoginDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse>;
  register(data: RegistrationDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse | RegisterPendingResponse>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  logout(requester: Requester, deviceId?: string): Promise<void>;
  logoutAll(requester: Requester): Promise<void>;
  blacklistToken(jti: string, expiresAt: number): Promise<void>;
  introspect(token: string): Promise<TokenIntrospectResult>;
  sendVerificationEmail(data: SendVerificationDTO, userId?: string): Promise<void>;
  getUnverifiedEmailByPhone(data: GetUnverifiedEmailByPhoneDTO): Promise<{ email: string }>;
  verifyEmail(data: VerifyEmailDTO): Promise<boolean>;
  resendVerificationEmail(data: SendVerificationDTO): Promise<void>;
  forgotPassword(data: ForgotPasswordDTO): Promise<void>;
  verifyResetOTP(data: VerifyResetOTPDTO): Promise<ResetOTPVerifyResponse>;
  resetPassword(data: ResetPasswordDTO): Promise<boolean>;
  resendResetOTP(data: ForgotPasswordDTO): Promise<void>;
  changePassword(requester: Requester, data: ChangePasswordDTO): Promise<boolean>;
  getSessions(userId: string, currentDeviceId: string): Promise<AuthSessionView[]>;
  revokeSession(userId: string, deviceId: string): Promise<boolean>;
  revokeAllSessions(userId: string): Promise<boolean>;
  revokeOtherSessions(userId: string, currentDeviceId: string): Promise<number>;
  updateAvatar(userId: string, avatarUrl: string): Promise<boolean>;
}
