import { AppError } from "@share/app-error";
import {
  Requester,
  TokenPair,
  UserRole,
  AccessTokenPayload,
  RefreshTokenPayload,
  DeviceInfo,
  DeviceType,
  DeviceDetails,
  Platform,
  Session,
  ISessionStore,
  ITokenBlacklist,
  PasswordResetPayload,
  TokenIntrospectResult,
} from "@share/interface";
import { ErrDataNotFound } from "@share/model/base-error";
import bcrypt from "bcrypt";
import { v7 as uuidv7 } from "uuid";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "@share/component/config";
import { AccessTokenService } from "../infras/token/access-token";
import { RefreshTokenService } from "../infras/token/refresh-token";
import { RedisRefreshTokenStore } from "../infras/redis/refresh-store";
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
  ErrEmailRequired,
  ErrInvalidCredentials,
  ErrInvalidToken,
  ErrPhoneExisted,
  ErrUserInactivated,
  ErrEmailNotFound,
  ErrEmailNotVerified,
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
import { revokeUserDeviceSockets } from "@share/component/socket-io";
import { User, UserInfoVisibility } from "@modules/user/model/model";
import { UserCondDTO } from "@modules/user/model/dto";
import type {
  AuthRedisClient,
  AuthSessionView,
  IAuthUseCase,
  IAuthUserRepository,
  LoginResponse,
  RegisterPendingResponse,
  ResetOTPVerifyResponse,
} from "../interface";

export type {
  AuthSessionView,
  IAuthUseCase,
  LoginResponse,
  RegisterPendingResponse,
  ResetOTPVerifyResponse,
} from "../interface";

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

export class AuthUseCase implements IAuthUseCase {
  private redisClient!: AuthRedisClient;
  private emailService: EmailTemplateService;

  constructor(
    private readonly userRepository: IAuthUserRepository,
    private readonly sessionStore: ISessionStore,
    private readonly blacklist: ITokenBlacklist,
    private readonly accessTokenService: AccessTokenService = new AccessTokenService(blacklist),
    private refreshTokenService?: RefreshTokenService,
  ) {
    this.emailService = new EmailTemplateService(getEmailProvider());
  }

  setRedisClient(redisClient: AuthRedisClient) {
    this.redisClient = redisClient;
    if (!this.refreshTokenService) {
      this.refreshTokenService = new RefreshTokenService(new RedisRefreshTokenStore(redisClient));
    }
  }

  private getRefreshTokenService(): RefreshTokenService {
    if (!this.refreshTokenService) {
      if (!this.redisClient) {
        throw new Error("Refresh token service has not been initialized");
      }
      this.refreshTokenService = new RefreshTokenService(new RedisRefreshTokenStore(this.redisClient));
    }
    return this.refreshTokenService;
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

  private generateAccessToken(userId: string, role: UserRole, tokenVersion: number, deviceId: string): Promise<{ token: string; jti: string; expiresAt?: number }> {
    return this.accessTokenService.generate(userId, role, tokenVersion, deviceId);
  }

  private async generateRefreshTokenPair(userId: string, deviceId: string, tokenVersion: number): Promise<{ token: string; jti: string; expiresAt?: number }> {
    return this.getRefreshTokenService().generate(userId, deviceId, tokenVersion);
  }

  private async revokeRefreshToken(jti: string): Promise<void> {
    await this.getRefreshTokenService().revokeJti(jti);
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

  private resolvePlatform(deviceType: DeviceType, details?: DeviceDetails): Platform {
    if (details?.platform) return details.platform;
    return deviceType.endsWith("-app") ? "app" : "web";
  }

  private buildDeviceInfo(deviceInfo: DeviceInfo | undefined, deviceId: string, deviceType: DeviceType): DeviceInfo {
    const details = this.resolveDeviceDetails(deviceInfo);
    const platform = this.resolvePlatform(deviceType, details);
    return {
      deviceId,
      deviceType,
      userAgent: deviceInfo?.userAgent || "Unknown",
      ip: deviceInfo?.ip || "unknown",
      location: deviceInfo?.location,
      details: details || { displayLabel: "Unknown", platform },
    };
  }

  private getSessionPlatform(session: Session): Platform {
    return this.resolvePlatform(session.deviceType, session.deviceInfo.details);
  }

  private async revokeSessionObject(session: Session, reason = "session_revoked"): Promise<void> {
    await this.revokeRefreshToken(session.refreshTokenJti);
    if (session.accessTokenJti && session.accessTokenExpiresAt) {
      const ttl = Math.max(0, session.accessTokenExpiresAt - Math.floor(Date.now() / 1000));
      if (ttl > 0) {
        await this.blacklist.add(session.accessTokenJti, ttl);
      }
    }
    await this.sessionStore.delete(session.deviceId);
    revokeUserDeviceSockets(session.userId, session.deviceId, reason);
  }

  private async revokeSessionByDevice(userId: string, deviceId: string, reason = "session_revoked"): Promise<boolean> {
    const session = await this.sessionStore.get(deviceId);
    if (!session || session.userId !== userId) return false;
    await this.revokeSessionObject(session, reason);
    return true;
  }

  private async revokeSessionsByPlatform(userId: string, platform: Platform, excludeDeviceId: string): Promise<number> {
    const sessions = await this.sessionStore.listByUser(userId);
    let revoked = 0;
    for (const session of sessions) {
      if (session.deviceId === excludeDeviceId) continue;
      if (this.getSessionPlatform(session) !== platform) continue;
      await this.revokeSessionObject(session, "platform_session_replaced");
      revoked += 1;
    }
    return revoked;
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

  private buildDefaultPrivacy(): User["privacy"] {
    return {
      searchableByEmail: true,
      searchableByPhone: true,
      searchableByUsername: true,
      birthdayVisibility: UserInfoVisibility.FRIENDS,
      phoneVisibility: UserInfoVisibility.FRIENDS,
      avatarVisibility: UserInfoVisibility.EVERYONE,
      showOnline: true,
      showLastSeen: true,
      blockMessagesFromStrangers: false,
    };
  }

  private buildDefaultSettings(): User["settings"] {
    return { notifications: { push: true, inApp: true } };
  }

  private extractUserPublic(user: User): LoginResponse["user"] {
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
    const cond: UserCondDTO = dto.phone
      ? { phone: this.normalizePhone(dto.phone) }
      : { email: dto.email };

    const user = await this.userRepository.findByCond(cond);
    if (!user) {
      throw AppError.from(ErrInvalidCredentials, 401).withLog("User not found");
    }

    const isMatch = await bcrypt.compare(`${dto.password}.${user.salt}`, user.password);
    if (!isMatch) {
      throw AppError.from(ErrInvalidCredentials, 401).withLog("Password is incorrect");
    }

    if (user.status === UserStatus.DISABLED) {
      throw AppError.from(ErrUserInactivated, 400);
    }
    if (config.auth.requireEmailVerification && user.email && !user.verified?.email) {
      throw AppError.from(ErrEmailNotVerified, 403);
    }

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    const effectiveDeviceId = deviceInfo?.deviceId || uuidv7();
    const effectiveDeviceType = deviceInfo?.deviceType || this.detectDeviceTypeFallback(deviceInfo?.userAgent || "");
    const normalizedDeviceInfo = this.buildDeviceInfo(deviceInfo, effectiveDeviceId, effectiveDeviceType);
    const platform = this.resolvePlatform(effectiveDeviceType, normalizedDeviceInfo.details);
    await this.revokeSessionByDevice(user.id, effectiveDeviceId, "session_replaced");
    if (platform === "web") {
      await this.revokeSessionsByPlatform(user.id, platform, effectiveDeviceId);
    }

    const tokenVersion = user.tokenVersion || 1;
    const accessToken = await this.generateAccessToken(user.id, UserRole.USER, tokenVersion, effectiveDeviceId);
    const { token: refreshToken, jti: refreshTokenJti, expiresAt: refreshTokenExpiresAt } = await this.generateRefreshTokenPair(user.id, effectiveDeviceId, tokenVersion);

    await this.sessionStore.create(
      user.id,
      normalizedDeviceInfo,
      refreshTokenJti,
      accessToken.jti,
      accessToken.expiresAt,
      refreshTokenExpiresAt,
      tokenVersion,
    );

    return {
      accessToken: accessToken.token,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.parseExpiresIn(config.accessToken.expiresIn),
      refreshExpiresIn: this.parseExpiresIn(config.refreshToken.expiresIn),
      deviceId: effectiveDeviceId,
      deviceType: effectiveDeviceType,
      displayLabel: normalizedDeviceInfo.details?.displayLabel,
      platform,
      user: this.extractUserPublic(user),
    };
  }

  async register(data: RegistrationDTO, deviceInfo?: DeviceInfo): Promise<LoginResponse | RegisterPendingResponse> {
    const dto = RegistrationDTOSchema.parse(data);
    const phone = this.normalizePhone(dto.phone);

    const existedByPhone = await this.userRepository.findByCond({ phone });
    if (existedByPhone) {
      throw AppError.from(ErrPhoneExisted, 400);
    }

    if (dto.email) {
      const existedByEmail = await this.userRepository.findByCond({ email: dto.email });
      if (existedByEmail) {
        throw AppError.from(ErrEmailExisted, 400);
      }
    }

    const displayName = dto.displayName || dto.email || phone;
    const newId = uuidv7();

    const requireVerification = dto.sendVerificationEmail || config.auth.requireEmailVerification;
    if (requireVerification && !dto.email) {
      throw AppError.from(ErrEmailRequired, 422);
    }

    if (requireVerification && dto.email) {
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = bcrypt.hashSync(`${dto.password}.${salt}`, 10);

      const newUser: User = {
        id: newId,
        email: dto.email,
        phone,
        password: hashPassword,
        salt,
        status: UserStatus.ACTIVE,
        tokenVersion: 1,
        displayName,
        verified: { email: false, phone: false },
        privacy: this.buildDefaultPrivacy(),
        settings: this.buildDefaultSettings(),
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

    const newUser: User = {
      id: newId,
      email: dto.email,
      phone,
      password: hashPassword,
      salt,
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      displayName,
      verified: { email: false, phone: false },
      privacy: this.buildDefaultPrivacy(),
      settings: this.buildDefaultSettings(),
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

    const effectiveDeviceId = deviceInfo?.deviceId || uuidv7();
    const effectiveDeviceType = deviceInfo?.deviceType || this.detectDeviceTypeFallback(deviceInfo?.userAgent || "");
    const normalizedDeviceInfo = this.buildDeviceInfo(deviceInfo, effectiveDeviceId, effectiveDeviceType);
    const platform = this.resolvePlatform(effectiveDeviceType, normalizedDeviceInfo.details);
    const accessToken = await this.generateAccessToken(newId, UserRole.USER, 1, effectiveDeviceId);
    const { token: refreshToken, jti: refreshTokenJti, expiresAt: refreshTokenExpiresAt } = await this.generateRefreshTokenPair(newId, effectiveDeviceId, 1);

    await this.sessionStore.create(
      newId,
      normalizedDeviceInfo,
      refreshTokenJti,
      accessToken.jti,
      accessToken.expiresAt,
      refreshTokenExpiresAt,
      1,
    );

    return {
      accessToken: accessToken.token,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.parseExpiresIn(config.accessToken.expiresIn),
      refreshExpiresIn: this.parseExpiresIn(config.refreshToken.expiresIn),
      deviceId: effectiveDeviceId,
      deviceType: effectiveDeviceType,
      displayLabel: normalizedDeviceInfo.details?.displayLabel,
      platform,
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
      const payload = jwt.verify(refreshToken, config.refreshToken.secretKey) as RefreshTokenPayload;
      if (payload.type !== "refresh" || !payload.jti || !payload.deviceId) {
        throw AppError.from(ErrInvalidToken, 401);
      }

      const refreshTokenService = this.getRefreshTokenService();
      const stored = await refreshTokenService.getStored(payload.jti);
      if (!stored) {
        const used = await refreshTokenService.getUsed(payload.jti);
        if (used?.userId && used?.deviceId) {
          await this.revokeSessionByDevice(used.userId, used.deviceId, "refresh_token_reused");
        }
        throw AppError.from(ErrInvalidToken, 401);
      }
      if (
        stored.userId !== payload.sub ||
        stored.deviceId !== payload.deviceId ||
        (stored.tokenVersion || 1) !== (payload.tokenVersion || 1)
      ) {
        throw AppError.from(ErrInvalidToken, 401);
      }

      const user = await this.userRepository.get(payload.sub);
      if (!user) throw ErrDataNotFound;
      if (user.status === UserStatus.DISABLED) {
        throw AppError.from(ErrUserInactivated, 400);
      }
      const tokenVersion = user.tokenVersion || 1;
      if ((payload.tokenVersion || 1) !== tokenVersion) {
        throw AppError.from(ErrInvalidToken, 401);
      }

      const existingSession = await this.sessionStore.get(payload.deviceId);
      if (
        !existingSession ||
        existingSession.userId !== user.id ||
        existingSession.refreshTokenJti !== payload.jti
      ) {
        throw AppError.from(ErrInvalidToken, 401);
      }

      await refreshTokenService.consume(payload.jti, payload.exp);

      const newAccessToken = await this.generateAccessToken(user.id, UserRole.USER, tokenVersion, payload.deviceId);
      const { token: newRefreshToken, jti: newRefreshTokenJti, expiresAt: refreshTokenExpiresAt } = await this.generateRefreshTokenPair(user.id, payload.deviceId, tokenVersion);

      await this.sessionStore.update(payload.deviceId, {
        refreshTokenJti: newRefreshTokenJti,
        refreshTokenExpiresAt,
        accessTokenJti: newAccessToken.jti,
        accessTokenExpiresAt: newAccessToken.expiresAt,
        tokenVersion,
        lastActive: new Date(),
      });

      return {
        accessToken: newAccessToken.token,
        refreshToken: newRefreshToken,
        tokenType: "Bearer",
        expiresIn: this.parseExpiresIn(config.accessToken.expiresIn),
        refreshExpiresIn: this.parseExpiresIn(config.refreshToken.expiresIn),
        deviceId: payload.deviceId,
        deviceType: existingSession.deviceType,
        displayLabel: existingSession.deviceInfo.details?.displayLabel,
        platform: this.getSessionPlatform(existingSession),
        user: this.extractUserPublic(user),
      };
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw AppError.from(ErrInvalidToken, 401);
    }
  }

  async logout(requester: Requester, deviceId?: string): Promise<void> {
    const effectiveDeviceId = deviceId || requester.deviceId;
    if (effectiveDeviceId) {
      await this.revokeSessionByDevice(requester.sub, effectiveDeviceId, "logout");
    }
    if (requester.jti && requester.exp) {
      await this.blacklistToken(requester.jti, requester.exp);
    }
  }

  async logoutAll(requester: Requester): Promise<void> {
    await this.revokeAllSessions(requester.sub);
  }

  async blacklistToken(jti: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await this.blacklist.add(jti, ttl);
    }
  }

  async introspect(token: string): Promise<TokenIntrospectResult> {
    try {
      const payload = jwt.verify(token, config.accessToken.secretKey) as AccessTokenPayload;
      if (payload.type !== "access" || !payload.jti || !payload.deviceId) {
        return { payload: null, isOk: false };
      }
      const isBlacklisted = await this.blacklist.isBlacklisted(payload.jti);
      if (isBlacklisted) return { payload: null, isOk: false };

      const user = await this.userRepository.get(payload.sub);
      if (!user) return { payload: null, isOk: false };
      if (user.status === UserStatus.DISABLED) return { payload: null, isOk: false };
      if (user.tokenVersion !== payload.tokenVersion) return { payload: null, isOk: false };

      const session = await this.sessionStore.get(payload.deviceId);
      if (!session || session.userId !== payload.sub || session.accessTokenJti !== payload.jti) {
        return { payload: null, isOk: false };
      }

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
      const user = await this.userRepository.findByCond({ email });
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
    const user = await this.userRepository.findByCond({ email });
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
    await this.userRepository.update(user.id, { verified: { ...user.verified, email: true }, emailVerifiedAt: new Date() });

    return true;
  }

  async resendVerificationEmail(data: SendVerificationDTO): Promise<void> {
    await this.sendVerificationEmail(data);
  }

  async forgotPassword(data: ForgotPasswordDTO): Promise<void> {
    const { email } = data;
    const user = await this.userRepository.findByCond({ email });
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
    const user = await this.userRepository.findByCond({ email });
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

    await this.userRepository.update(userId, { password: hashPassword, salt, tokenVersion: newTokenVersion });
    await this.redisClient.del(`${RESET_PREFIX}${jti}`);
    await this.revokeAllSessions(userId);

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

    await this.userRepository.update(user.id, { password: hashPassword, salt, tokenVersion: newTokenVersion });
    await this.revokeAllSessions(user.id);
    return true;
  }

  async getSessions(userId: string, currentDeviceId: string): Promise<AuthSessionView[]> {
    const sessions = await this.sessionStore.listByUser(userId);
    return sessions.map((s) => ({
      deviceId: s.deviceId,
      deviceType: s.deviceType,
      displayLabel: s.deviceInfo.details?.displayLabel || "Unknown",
      platform: this.getSessionPlatform(s),
      ip: s.deviceInfo.ip || "unknown",
      location: s.deviceInfo.location || "unknown",
      createdAt: s.createdAt,
      lastActive: s.lastActive,
      isCurrent: s.deviceId === currentDeviceId,
    }));
  }

  async revokeSession(userId: string, deviceId: string): Promise<boolean> {
    return this.revokeSessionByDevice(userId, deviceId, "remote_logout");
  }

  async revokeAllSessions(userId: string): Promise<boolean> {
    const sessions = await this.sessionStore.listByUser(userId);
    for (const session of sessions) {
      await this.revokeSessionObject(session, "logout_all");
    }
    return true;
  }

  async revokeOtherSessions(userId: string, currentDeviceId: string): Promise<number> {
    const currentSession = await this.sessionStore.get(currentDeviceId);
    if (!currentSession || currentSession.userId !== userId) {
      throw AppError.from(ErrInvalidToken, 401).withLog("Current session not found");
    }

    const sessions = await this.sessionStore.listByUser(userId);
    let revoked = 0;
    for (const session of sessions) {
      if (session.deviceId === currentDeviceId) continue;
      await this.revokeSessionObject(session, "logout_other_devices");
      revoked += 1;
    }
    return revoked;
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<boolean> {
    const user = await this.userRepository.get(userId);
    if (!user) throw AppError.from(ErrUserNotFound, 404);

    await this.userRepository.update(userId, { avatarUrl });
    return true;
  }

  async seedTestUsers(): Promise<void> {
    const testUsers = [
      { phone: "0912345678", email: "test1@chatbe.io", displayName: "Test User 1" },
      { phone: "0987654321", email: "test2@chatbe.io", displayName: "Test User 2" },
    ];
    const password = "Test123456!";

    for (const userData of testUsers) {
      const existing = await this.userRepository.findByCond({ phone: userData.phone });
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = bcrypt.hashSync(`${password}.${salt}`, 10);

      if (!existing) {
        const newUser: User = {
          id: uuidv7(),
          email: userData.email,
          phone: userData.phone,
          password: hashPassword,
          salt,
          status: UserStatus.ACTIVE,
          tokenVersion: 1,
          displayName: userData.displayName,
          verified: { email: true, phone: true },
          privacy: this.buildDefaultPrivacy(),
          settings: this.buildDefaultSettings(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await this.userRepository.insert(newUser);
        console.log(`[TEST] Created test user: ${userData.phone} / ${userData.email}`);
      } else {
        await this.userRepository.update(existing.id, { password: hashPassword, salt });
        console.log(`[TEST] Updated test user: ${userData.phone} / ${userData.email}`);
      }
    }
    console.log(`[TEST] Test users ready - login with phone + "Test123456!"`);
  }
}
