import jwt, { SignOptions } from "jsonwebtoken";
import { v7 as uuidv7 } from "uuid";
import { RefreshTokenPayload, TokenPair, UserRole } from "@share/interface";
import { config } from "@share/component/config";
import { RefreshTokenRecord } from "../../interface";

export interface IRefreshTokenStore {
  store(jti: string, userId: string, deviceId: string, tokenVersion: number, expiresInSeconds: number): Promise<void>;
  get(jti: string): Promise<RefreshTokenRecord | null>;
  revoke(jti: string): Promise<void>;
  consume(jti: string, usedTtlSeconds: number): Promise<void>;
  getUsed(jti: string): Promise<RefreshTokenRecord | null>;
}

export class RefreshTokenService {
  constructor(private readonly tokenStore: IRefreshTokenStore) {}

  async generate(userId: string, deviceId: string, tokenVersion: number): Promise<{ token: string; jti: string; expiresAt?: number }> {
    const jti = uuidv7();
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: "refresh",
      jti,
      deviceId,
      tokenVersion,
    };

    const expiresIn = config.refreshToken.expiresIn as SignOptions["expiresIn"];
    const options: SignOptions = { expiresIn };

    const token = jwt.sign(payload, config.refreshToken.secretKey, options);
    const decoded = jwt.decode(token) as (RefreshTokenPayload & { exp?: number }) | null;

    await this.tokenStore.store(jti, userId, deviceId, tokenVersion, this.parseExpiresIn(config.refreshToken.expiresIn));

    return { token, jti, expiresAt: decoded?.exp };
  }

  async verify(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const payload = jwt.verify(token, config.refreshToken.secretKey) as RefreshTokenPayload;

      const stored = await this.tokenStore.get(payload.jti);
      if (!stored) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async revoke(token: string): Promise<void> {
    try {
      const payload = jwt.decode(token) as RefreshTokenPayload;
      if (payload && payload.jti) {
        await this.tokenStore.revoke(payload.jti);
      }
    } catch {}
  }

  async revokeJti(jti: string): Promise<void> {
    await this.tokenStore.revoke(jti);
  }

  async getStored(jti: string): Promise<RefreshTokenRecord | null> {
    return this.tokenStore.get(jti);
  }

  async getUsed(jti: string): Promise<RefreshTokenRecord | null> {
    return this.tokenStore.getUsed(jti);
  }

  async consume(jti: string, expiresAt?: number): Promise<void> {
    const ttl = expiresAt ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : this.parseExpiresIn(config.refreshToken.expiresIn);
    await this.tokenStore.consume(jti, ttl);
  }

  async rotate(
    currentToken: string,
    tokenVersion: number,
    accessTokenService: { generate(userId: string, role: UserRole, tokenVersion: number, deviceId: string): Promise<{ token: string }> },
    role: UserRole
  ): Promise<TokenPair> {
    const currentPayload = await this.verify(currentToken);
    if (!currentPayload) {
      throw new Error("Invalid refresh token");
    }

    await this.consume(currentPayload.jti, currentPayload.exp);

    const newAccessToken = await accessTokenService.generate(
      currentPayload.sub,
      role,
      tokenVersion,
      currentPayload.deviceId,
    );

    const newRefreshToken = await this.generate(currentPayload.sub, currentPayload.deviceId, tokenVersion);

    const expiresIn = this.parseExpiresIn(config.accessToken.expiresIn);

    return {
      accessToken: newAccessToken.token,
      refreshToken: newRefreshToken.token,
      expiresIn,
    };
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
}
