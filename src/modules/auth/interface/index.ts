import { Requester, TokenIntrospectResult, TokenPair, DeviceInfo, DeviceType, Platform } from "@share/interface";
import { LoginDTO, RegistrationDTO, SendVerificationDTO, VerifyEmailDTO, ForgotPasswordDTO, VerifyResetOTPDTO, ResetPasswordDTO, ChangePasswordDTO } from "../model/dto";

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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

export interface IAuthUseCase {
  login(data: LoginDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse>;
  register(data: RegistrationDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse | RegisterPendingResponse>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  logout(requester: Requester, deviceId?: string): Promise<void>;
  logoutAll(requester: Requester): Promise<void>;
  introspect(token: string): Promise<TokenIntrospectResult>;
  sendVerificationEmail(data: SendVerificationDTO, userId?: string): Promise<void>;
  verifyEmail(data: VerifyEmailDTO): Promise<boolean>;
  resendVerificationEmail(data: SendVerificationDTO): Promise<void>;
  forgotPassword(data: ForgotPasswordDTO): Promise<void>;
  verifyResetOTP(data: VerifyResetOTPDTO): Promise<ResetOTPVerifyResponse>;
  resetPassword(data: ResetPasswordDTO): Promise<boolean>;
  resendResetOTP(data: ForgotPasswordDTO): Promise<void>;
  changePassword(requester: Requester, data: ChangePasswordDTO): Promise<boolean>;
  getSessions(userId: string, currentDeviceId: string): Promise<any[]>;
  revokeSession(userId: string, deviceId: string): Promise<boolean>;
  revokeAllSessions(userId: string): Promise<boolean>;
  revokeOtherSessions(userId: string, currentDeviceId: string): Promise<number>;
  updateAvatar(userId: string, avatarUrl: string): Promise<boolean>;
}
