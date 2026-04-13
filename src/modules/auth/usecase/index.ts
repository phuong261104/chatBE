import { AppError } from "@share/app-error";
import {
  IRepository,
  Requester,
  TokenPair,
  UserRole,
  AccessTokenPayload,
  DeviceInfo,
  DeviceType,
  DeviceDetails,
  ISessionStore,
  ITokenBlacklist,
  PasswordResetPayload,
} from "@share/interface";
import { ErrDataNotFound } from "@share/model/base-error";
import bcrypt from "bcrypt";
import { v7 as uuidv7 } from "uuid";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "@share/component/config";
import {
  LoginDTO,
  LoginDTOSchema,
  RegistrationDTO,
  RegistrationDTOSchema,
  UserStatus,
  SendVerificationDTO,
  VerifyEmailDTO,
  ForgotPasswordDTO,
  VerifyResetOTPDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
} from "../model/dto";
import {
  ErrEmailExisted,
  ErrInvalidCredentials,
  ErrInvalidToken,
  ErrPhoneExisted,
  ErrUserInactivated,
  ErrEmailNotFound,
  ErrInvalidVerificationCode,
  ErrVerificationExpired,
  ErrTooManyAttempts,
  ErrEmailAlreadyVerified,
  ErrRateLimitExceeded,
  ErrUserNotFound,
  ErrInvalidResetToken,
  ErrInvalidCurrentPassword,
} from "../model/errors";
import { EmailTemplateService } from "../infras/email/templates";
import { getEmailProvider } from "../infras/email/nodemailer";
import { parseUserAgent } from "../infras/device/device-parser";

const VERIFY_PREFIX = "verify:email:";
const VERIFY_RATE_PREFIX = "verify:rate:";
const VERIFY_TTL = 300;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_TTL = 3600;
const RATE_LIMIT_MAX = 5;
const RESET_PREFIX = "reset:password:";
const RESET_OTP_PREFIX = "reset:otp:";
const RESET_TTL = 3600;
const RESET_OTP_TTL = 300;
const RESET_OTP_MAX_ATTEMPTS = 3;

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceType: DeviceType;
  displayLabel?: string;
  platform?: "app" | "web";
  user: {
    id: string;
    email?: string;
    phone?: string;
    displayName?: string;
    avatarUrl?: string;
    verified: { email: boolean; phone: boolean };
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
  blacklistToken(jti: string, expiresAt: number): Promise<void>;
  introspect(token: string): Promise<{ payload: any; isOk: boolean }>;
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
  updateAvatar(userId: string, avatarUrl: string): Promise<boolean>;
}

export class AuthUseCase implements IAuthUseCase {
  private redisClient: any;
  private emailService: EmailTemplateService;

  constructor(
    private readonly userRepository: IRepository<any, any, any>,
    private readonly sessionStore: ISessionStore,
    private readonly blacklist: ITokenBlacklist,
  ) {
    this.emailService = new EmailTemplateService(getEmailProvider());
  }

  setRedisClient(redisClient: any) {
    this.redisClient = redisClient;
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case "s": return value;
      case "m": return value * 60;
      case "h": return value * 60 * 60;
      case "d": return value * 60 * 60 * 24;
      default: return 900;
    }
  }

  private generateAccessToken(userId: string, role: UserRole, tokenVersion: number): string {
    const jti = uuidv7();
    const payload: AccessTokenPayload = {
      sub: userId,
      role,
      type: "access",
      jti,
      tokenVersion,
    };
    return jwt.sign(payload, config.accessToken.secretKey, {
      expiresIn: config.accessToken.expiresIn as any,
    } as SignOptions);
  }

  private generateRefreshTokenPair(userId: string, deviceId: string): { token: string; jti: string } {
    const jti = uuidv7();
    const payload = { sub: userId, type: "refresh", jti, deviceId };
    const token = jwt.sign(payload, config.refreshToken.secretKey, {
      expiresIn: config.refreshToken.expiresIn as any,
    } as SignOptions);
    this.storeRefreshToken(jti, userId, deviceId);
    return { token, jti };
  }

  private async storeRefreshToken(jti: string, userId: string, deviceId: string): Promise<void> {
    const key = `refresh:${jti}`;
    const value = JSON.stringify({ userId, deviceId });
    await this.redisClient.setEx(key, 7 * 24 * 60 * 60, value);
  }

  private async getRefreshToken(jti: string): Promise<{ userId: string; deviceId: string } | null> {
    const key = `refresh:${jti}`;
    const result = await this.redisClient.get(key);
    if (!result) return null;
    return JSON.parse(result);
  }

  private async revokeRefreshToken(jti: string): Promise<void> {
    const key = `refresh:${jti}`;
    await this.redisClient.del(key);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, "");
  }

  private resolveDeviceDetails(deviceInfo?: DeviceInfo): DeviceDetails | undefined {
    if (deviceInfo?.details) {
      return deviceInfo.details;
    }
    if (deviceInfo?.userAgent) {
      return parseUserAgent(deviceInfo.userAgent);
    }
    return undefined;
  }

  private detectDeviceTypeFallback(userAgent: string): DeviceType {
    const lowerUA = userAgent.toLowerCase();
    const mobilePattern = /android|iphone|ipod|blackberry|windows phone|mobile/i;
    const tabletPattern = /tablet|ipad|playbook|silk|kindle|nexus 7/i;
    const osPattern = /mac os|windows nt|linux|x11|ubuntu/i;
    const laptopPattern = /macbook|portable|laptop|notebook/i;
    const appPatterns = [
      /app\/[\d.]+\s*/i, /com\.\w+\.\w+/i, /\bwv\b/i, /webview/i,
      /;\s*wb\s*/i, /\[FBAN|FBIOS|FB4A\]/i, /MobileConfig/i,
    ];

    let base: string;
    if (mobilePattern.test(lowerUA)) {
      base = "mobile";
    } else if (tabletPattern.test(lowerUA)) {
      base = "tablet";
    } else if (osPattern.test(lowerUA)) {
      base = laptopPattern.test(lowerUA) ? "laptop" : "desktop";
    } else {
      base = laptopPattern.test(lowerUA) ? "laptop" : "mobile";
    }

    const platform: "app" | "web" = appPatterns.some((p) => p.test(lowerUA)) ? "app" : "web";
    return `${base}-${platform}` as DeviceType;
  }

  private extractUserPublic(user: any): LoginResponse["user"] {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      verified: user.verified,
    };
  }

  private async sendEmailAsync(
    fn: () => Promise<void>,
    label: string,
  ): Promise<void> {
    setImmediate(async () => {
      try {
        await fn();
        console.log(`[Email] Successfully sent ${label}`);
      } catch (err) {
        console.error(`[Email] Failed to send ${label}:`, err);
      }
    });
  }

  async login(data: LoginDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse> {
    const dto = LoginDTOSchema.parse(data);
    const cond = dto.phone
      ? ({ phone: this.normalizePhone(dto.phone) } as any)
      : ({ email: dto.email } as any);

    const user = await this.userRepository.findByCond(cond);
    if (!user) {
      throw AppError.from(ErrInvalidCredentials, 400).withLog("User not found");
    }

    const isMatch = await bcrypt.compare(`${dto.password}.${user.salt}`, user.password);
    if (!isMatch) {
      throw AppError.from(ErrInvalidCredentials, 400).withLog("Password is incorrect");
    }

    if (user.status === UserStatus.DISABLED) {
      throw AppError.from(ErrUserInactivated, 400);
    }

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const tokenVersion = user.tokenVersion || 1;
    const accessToken = this.generateAccessToken(user.id, UserRole.USER, tokenVersion);

    const effectiveDeviceId = deviceInfo?.deviceId || uuidv7();
    const effectiveDeviceType = deviceInfo?.deviceType || this.detectDeviceTypeFallback(deviceInfo?.userAgent || "");
    const deviceDetails = this.resolveDeviceDetails(deviceInfo);
    const { token: refreshToken, jti: refreshTokenJti } = this.generateRefreshTokenPair(user.id, effectiveDeviceId);

    await this.sessionStore.create(user.id, {
      deviceId: effectiveDeviceId,
      deviceType: effectiveDeviceType,
      userAgent: deviceInfo?.userAgent || "Unknown",
      ip: deviceInfo?.ip || "unknown",
      details: deviceDetails,
    }, refreshTokenJti);

    // await this.sessionStore.deleteByDeviceType(user.id, effectiveDeviceType, effectiveDeviceId);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(config.accessToken.expiresIn),
      deviceType: effectiveDeviceType,
      displayLabel: deviceDetails?.displayLabel,
      platform: deviceDetails?.platform,
      user: this.extractUserPublic(user),
    };
  }

  async register(data: RegistrationDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse | RegisterPendingResponse> {
    const dto = RegistrationDTOSchema.parse(data);
    const phone = this.normalizePhone(dto.phone);

    const existedByPhone = await this.userRepository.findByCond({ phone } as any);
    if (existedByPhone) {
      throw AppError.from(ErrPhoneExisted, 400);
    }

    if (dto.email) {
      const existedByEmail = await this.userRepository.findByCond({ email: dto.email } as any);
      if (existedByEmail) {
        throw AppError.from(ErrEmailExisted, 400);
      }
    }

    const displayName = dto.displayName || dto.email || phone;
    const newId = uuidv7();

    const requireVerification = dto.sendVerificationEmail || config.auth.requireEmailVerification;

    if (requireVerification && dto.email) {
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = bcrypt.hashSync(`${dto.password}.${salt}`, 10);

      const newUser = {
        id: newId,
        email: dto.email,
        phone,
        password: hashPassword,
        salt,
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        displayName,
        verified: { email: false, phone: false },
        privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true },
        settings: { notifications: { push: true, inApp: true } },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userRepository.insert(newUser);

      await this.saveVerificationCode(dto.email, newId);

      if (dto.email) {
        this.sendEmailAsync(
          () => this.emailService.sendWelcomeEmail(dto.email!, displayName),
          "welcome email",
        );
      }

      return {
        pendingVerification: true as const,
        userId: newId,
        email: dto.email!,
        expiresIn: VERIFY_TTL,
        message: "Verification code has been sent to your email. Please verify before logging in.",
      };
    }

    const salt = bcrypt.genSaltSync(10);
    const hashPassword = bcrypt.hashSync(`${dto.password}.${salt}`, 10);

    const newUser = {
      id: newId,
      email: dto.email,
      phone,
      password: hashPassword,
      salt,
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      displayName,
      verified: { email: false, phone: false },
      privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true },
      settings: { notifications: { push: true, inApp: true } },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userRepository.insert(newUser);

    if (dto.email) {
      await this.saveVerificationCode(dto.email, newId);

      this.sendEmailAsync(
        () => this.emailService.sendWelcomeEmail(dto.email!, displayName),
        "welcome email",
      );
    }

    const accessToken = this.generateAccessToken(newId, UserRole.USER, 1);

    const effectiveDeviceId = deviceInfo?.deviceId || uuidv7();
    const effectiveDeviceType = deviceInfo?.deviceType || this.detectDeviceTypeFallback(deviceInfo?.userAgent || "");
    const deviceDetails = this.resolveDeviceDetails(deviceInfo);
    const { token: refreshToken, jti: refreshTokenJti } = this.generateRefreshTokenPair(newId, effectiveDeviceId);

    await this.sessionStore.create(newId, {
      deviceId: effectiveDeviceId,
      deviceType: effectiveDeviceType,
      userAgent: deviceInfo?.userAgent || "Unknown",
      ip: deviceInfo?.ip || "unknown",
      details: deviceDetails,
    }, refreshTokenJti);

    // await this.sessionStore.deleteByDeviceType(newId, effectiveDeviceType, effectiveDeviceId);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresIn(config.accessToken.expiresIn),
      deviceType: effectiveDeviceType,
      displayLabel: deviceDetails?.displayLabel,
      platform: deviceDetails?.platform,
      user: this.extractUserPublic(newUser),
    };
  }

  private async saveVerificationCode(email: string, userId: string): Promise<string> {
    const rateKey = `${VERIFY_RATE_PREFIX}${email.toLowerCase()}`;
    const rateCount = await this.redisClient.get(rateKey);
    if (!rateCount || parseInt(rateCount) < RATE_LIMIT_MAX) {
      await this.redisClient.incr(rateKey);
      await this.redisClient.expire(rateKey, RATE_LIMIT_TTL);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${VERIFY_PREFIX}${email.toLowerCase()}`;
    await this.redisClient.setEx(key, VERIFY_TTL, JSON.stringify({ code, userId, attempts: 0, createdAt: Date.now() }));

    this.sendEmailAsync(
      () => this.emailService.sendVerificationEmail(email, code, ""),
      "verification email",
    );

    return code;
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = jwt.verify(refreshToken, config.refreshToken.secretKey) as any;
      const stored = await this.getRefreshToken(payload.jti);
      if (!stored) {
        throw AppError.from(ErrInvalidToken, 401);
      }

      const user = await this.userRepository.get(payload.sub);
      if (!user) throw ErrDataNotFound;
      if (user.status === UserStatus.DISABLED) {
        throw AppError.from(ErrUserInactivated, 400);
      }

      await this.revokeRefreshToken(payload.jti);

      const tokenVersion = user.tokenVersion || 1;
      const newAccessToken = this.generateAccessToken(user.id, UserRole.USER, tokenVersion);
      const { token: newRefreshToken, jti: newRefreshTokenJti } = this.generateRefreshTokenPair(user.id, payload.deviceId);

      const existingSession = await this.sessionStore.get(payload.deviceId);
      if (existingSession) {
        await this.sessionStore.update(payload.deviceId, { refreshTokenJti: newRefreshTokenJti, lastActive: new Date() });
      }

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.parseExpiresIn(config.accessToken.expiresIn),
      };
    } catch (e) {
      throw AppError.from(ErrInvalidToken, 401);
    }
  }

  async logout(requester: Requester, deviceId?: string): Promise<void> {
    if (deviceId) {
      const session = await this.sessionStore.get(deviceId);
      if (session && session.userId === requester.sub) {
        await this.sessionStore.delete(deviceId);
      }
    }
  }

  async logoutAll(requester: Requester): Promise<void> {
    await this.sessionStore.deleteAllForUser(requester.sub);
  }

  async blacklistToken(jti: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await this.blacklist.add(jti, ttl);
    }
  }

  async introspect(token: string): Promise<{ payload: any; isOk: boolean }> {
    try {
      const payload = jwt.verify(token, config.accessToken.secretKey) as AccessTokenPayload;
      const isBlacklisted = await this.blacklist.isBlacklisted(payload.jti);
      if (isBlacklisted) return { payload: null, isOk: false };

      const user = await this.userRepository.get(payload.sub);
      if (!user) return { payload: null, isOk: false };
      if (user.tokenVersion !== payload.tokenVersion) return { payload: null, isOk: false };

      return { payload, isOk: true };
    } catch {
      return { payload: null, isOk: false };
    }
  }

  async sendVerificationEmail(data: SendVerificationDTO, userId?: string): Promise<void> {
    const { email } = data;
    const rateKey = `${VERIFY_RATE_PREFIX}${email.toLowerCase()}`;
    const rateCount = await this.redisClient.get(rateKey);
    if (rateCount && parseInt(rateCount) >= RATE_LIMIT_MAX) {
      throw AppError.from(ErrRateLimitExceeded, 429);
    }
    await this.redisClient.incr(rateKey);
    await this.redisClient.expire(rateKey, RATE_LIMIT_TTL);

    if (!userId) {
      const user = await this.userRepository.findByCond({ email } as any);
      if (!user) throw AppError.from(ErrEmailNotFound, 404);
      userId = user.id;
    }

    const user = await this.userRepository.get(userId!);
    if (!user) throw AppError.from(ErrEmailNotFound, 404);
    if (user.verified?.email) throw AppError.from(ErrEmailAlreadyVerified, 400);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${VERIFY_PREFIX}${email.toLowerCase()}`;
    await this.redisClient.setEx(key, VERIFY_TTL, JSON.stringify({ code, userId, attempts: 0, createdAt: Date.now() }));

    this.sendEmailAsync(
      () => this.emailService.sendVerificationEmail(email, code, user.displayName),
      "verification email",
    );
  }

  async verifyEmail(data: VerifyEmailDTO): Promise<boolean> {
    const { email, code } = data;
    const user = await this.userRepository.findByCond({ email } as any);
    if (!user) throw AppError.from(ErrEmailNotFound, 404);

    const key = `${VERIFY_PREFIX}${email.toLowerCase()}`;
    const stored = await this.redisClient.get(key);
    if (!stored) throw AppError.from(ErrVerificationExpired, 400);

    const storedData = JSON.parse(stored);
    if (Date.now() - storedData.createdAt > VERIFY_TTL * 1000) {
      await this.redisClient.del(key);
      throw AppError.from(ErrVerificationExpired, 400);
    }

    storedData.attempts = (storedData.attempts || 0) + 1;
    await this.redisClient.setEx(key, VERIFY_TTL, JSON.stringify(storedData));

    if (storedData.attempts > MAX_ATTEMPTS) {
      await this.redisClient.del(key);
      throw AppError.from(ErrTooManyAttempts, 429);
    }

    if (storedData.code !== code) {
      throw AppError.from(ErrInvalidVerificationCode, 400);
    }

    await this.redisClient.del(key);
    await this.userRepository.update(user.id, { verified: { ...user.verified, email: true }, emailVerifiedAt: new Date() } as any);

    return true;
  }

  async resendVerificationEmail(data: SendVerificationDTO): Promise<void> {
    await this.sendVerificationEmail(data);
  }

  async forgotPassword(data: ForgotPasswordDTO): Promise<void> {
    const { email } = data;
    const user = await this.userRepository.findByCond({ email } as any);
    if (!user) throw AppError.from(ErrUserNotFound, 404);

    const rateKey = `${VERIFY_RATE_PREFIX}reset:${email.toLowerCase()}`;
    const rateCount = await this.redisClient.get(rateKey);
    if (rateCount && parseInt(rateCount) >= RATE_LIMIT_MAX) {
      throw AppError.from(ErrRateLimitExceeded, 429);
    }
    await this.redisClient.incr(rateKey);
    await this.redisClient.expire(rateKey, RATE_LIMIT_TTL);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${RESET_OTP_PREFIX}${email.toLowerCase()}`;
    await this.redisClient.setEx(key, RESET_OTP_TTL, JSON.stringify({
      otp,
      userId: user.id,
      attempts: 0,
      createdAt: Date.now(),
    }));

    this.sendEmailAsync(
      () => this.emailService.sendPasswordResetOTPEmail(email, otp, user.displayName),
      "password reset OTP email",
    );
  }

  async verifyResetOTP(data: VerifyResetOTPDTO): Promise<ResetOTPVerifyResponse> {
    const { email, otp } = data;
    const user = await this.userRepository.findByCond({ email } as any);
    if (!user) throw AppError.from(ErrUserNotFound, 404);

    const key = `${RESET_OTP_PREFIX}${email.toLowerCase()}`;
    const stored = await this.redisClient.get(key);
    if (!stored) throw AppError.from(ErrVerificationExpired, 400);

    const storedData = JSON.parse(stored);
    if (Date.now() - storedData.createdAt > RESET_OTP_TTL * 1000) {
      await this.redisClient.del(key);
      throw AppError.from(ErrVerificationExpired, 400);
    }

    storedData.attempts = (storedData.attempts || 0) + 1;
    await this.redisClient.setEx(key, RESET_OTP_TTL, JSON.stringify(storedData));

    if (storedData.attempts > RESET_OTP_MAX_ATTEMPTS) {
      await this.redisClient.del(key);
      throw AppError.from(ErrTooManyAttempts, 429);
    }

    if (storedData.otp !== otp) {
      throw AppError.from(ErrInvalidVerificationCode, 400);
    }

    await this.redisClient.del(key);

    const jti = uuidv7();
    const payload: PasswordResetPayload = {
      sub: user.id,
      type: "password-reset",
      jti,
      purpose: "reset-password",
    };
    const tempToken = jwt.sign(payload, config.passwordReset.secretKey, {
      expiresIn: `${RESET_OTP_TTL / 60}m`,
    } as SignOptions);
    await this.redisClient.setEx(`${RESET_PREFIX}${jti}`, RESET_OTP_TTL, user.id);

    return {
      tempToken,
      expiresIn: RESET_OTP_TTL,
    };
  }

  async resendResetOTP(data: ForgotPasswordDTO): Promise<void> {
    await this.forgotPassword(data);
  }

  async resetPassword(data: ResetPasswordDTO): Promise<boolean> {
    const { newPassword } = data;

    let userId: string;
    let jti: string;

    if (data.tempToken) {
      const payload = jwt.verify(data.tempToken, config.passwordReset.secretKey) as PasswordResetPayload;
      if (payload.type !== "password-reset") {
        throw AppError.from(ErrInvalidResetToken, 400);
      }
      userId = payload.sub;
      jti = payload.jti;

      const storedUserId = await this.redisClient.get(`${RESET_PREFIX}${jti}`);
      if (!storedUserId || storedUserId !== userId) {
        throw AppError.from(ErrInvalidResetToken, 400);
      }
    } else if (data.token) {
      const payload = jwt.verify(data.token, config.passwordReset.secretKey) as PasswordResetPayload;
      userId = payload.sub;
      jti = payload.jti;

      const storedUserId = await this.redisClient.get(`${RESET_PREFIX}${jti}`);
      if (!storedUserId || storedUserId !== userId) {
        throw AppError.from(ErrInvalidResetToken, 400);
      }
    } else {
      throw AppError.from(ErrInvalidResetToken, 400);
    }

    const user = await this.userRepository.get(userId);
    if (!user) throw AppError.from(ErrUserNotFound, 404);

    const salt = bcrypt.genSaltSync(10);
    const hashPassword = bcrypt.hashSync(`${newPassword}.${salt}`, 10);
    const newTokenVersion = (user.tokenVersion || 1) + 1;

    await this.userRepository.update(userId, { password: hashPassword, salt, tokenVersion: newTokenVersion } as any);
    await this.redisClient.del(`${RESET_PREFIX}${jti}`);
    await this.sessionStore.deleteAllForUser(userId);

    return true;
  }

  async changePassword(requester: Requester, data: ChangePasswordDTO): Promise<boolean> {
    const { currentPassword, newPassword } = data;
    const user = await this.userRepository.get(requester.sub);
    if (!user) throw AppError.from(ErrUserNotFound, 404);

    const isMatch = await bcrypt.compare(`${currentPassword}.${user.salt}`, user.password);
    if (!isMatch) throw AppError.from(ErrInvalidCurrentPassword, 400);

    const salt = bcrypt.genSaltSync(10);
    const hashPassword = bcrypt.hashSync(`${newPassword}.${salt}`, 10);
    const newTokenVersion = (user.tokenVersion || 1) + 1;

    await this.userRepository.update(user.id, { password: hashPassword, salt, tokenVersion: newTokenVersion } as any);
    await this.sessionStore.deleteAllForUser(user.id);
    return true;
  }

  async getSessions(userId: string, currentDeviceId: string): Promise<any[]> {
    const sessions = await this.sessionStore.listByUser(userId);
    return sessions.map((s) => ({
      deviceId: s.deviceId,
      deviceType: s.deviceType,
      displayLabel: s.deviceInfo.details?.displayLabel || "Unknown",
      platform: s.deviceInfo.details?.platform || "web",
      ip: s.deviceInfo.ip || "unknown",
      createdAt: s.createdAt,
      lastActive: s.lastActive,
      isCurrent: s.deviceId === currentDeviceId,
    }));
  }

  async revokeSession(userId: string, deviceId: string): Promise<boolean> {
    const session = await this.sessionStore.get(deviceId);
    if (!session || session.userId !== userId) return false;
    await this.sessionStore.delete(deviceId);
    return true;
  }

  async revokeAllSessions(userId: string): Promise<boolean> {
    await this.sessionStore.deleteAllForUser(userId);
    return true;
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<boolean> {
    const user = await this.userRepository.get(userId);
    if (!user) throw AppError.from(ErrUserNotFound, 404);

    await this.userRepository.update(userId, { avatarUrl } as any);
    return true;
  }

  async seedTestUsers(): Promise<void> {
    const testUsers = [
      { phone: "0912345678", email: "test1@chatbe.io", displayName: "Test User 1" },
      { phone: "0987654321", email: "test2@chatbe.io", displayName: "Test User 2" },
    ];
    const password = "Test123456!";

    for (const userData of testUsers) {
      const existing = await this.userRepository.findByCond({ phone: userData.phone } as any);
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = bcrypt.hashSync(`${password}.${salt}`, 10);

      if (!existing) {
        const newUser = {
          id: uuidv7(),
          email: userData.email,
          phone: userData.phone,
          password: hashPassword,
          salt,
          status: UserStatus.ACTIVE,
          tokenVersion: 1,
          displayName: userData.displayName,
          verified: { email: true, phone: true },
          privacy: { searchableByEmail: true, searchableByPhone: true, searchableByUsername: true },
          settings: { notifications: { push: true, inApp: true } },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.userRepository.insert(newUser);
        console.log(`[TEST] Created test user: ${userData.phone} / ${userData.email}`);
      } else {
        await this.userRepository.update(existing.id, { password: hashPassword, salt } as any);
        console.log(`[TEST] Updated test user: ${userData.phone} / ${userData.email}`);
      }
    }
    console.log(`[TEST] Test users ready - login with phone + "Test123456!"`);
  }
}
