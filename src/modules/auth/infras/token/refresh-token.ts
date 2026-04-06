import jwt, { SignOptions } from "jsonwebtoken";
import { v7 as uuidv7 } from "uuid";
import { RefreshTokenPayload, DeviceInfo, TokenPair, UserRole } from "@share/interface";
import { config } from "@share/component/config";

export interface IRefreshTokenStore {
  store(jti: string, userId: string, deviceId: string): Promise<void>;
  get(jti: string): Promise<{ userId: string; deviceId: string } | null>;
  revoke(jti: string): Promise<void>;
}

export class RefreshTokenService {
  constructor(private readonly tokenStore: IRefreshTokenStore) {}

  async generate(userId: string, deviceId: string): Promise<string> {
    const jti = uuidv7();
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: "refresh",
      jti,
      deviceId,
    };

    const options: SignOptions = {
      expiresIn: config.refreshToken.expiresIn as any,
    };

    const token = jwt.sign(payload, config.refreshToken.secretKey, options as any);

    await this.tokenStore.store(jti, userId, deviceId);

    return token;
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

  async rotate(
    currentToken: string,
    deviceInfo: DeviceInfo,
    tokenVersion: number,
    accessTokenService: { generate(userId: string, role: UserRole, tokenVersion: number): Promise<string> },
    role: UserRole
  ): Promise<TokenPair> {
    const currentPayload = await this.verify(currentToken);
    if (!currentPayload) {
      throw new Error("Invalid refresh token");
    }

    await this.tokenStore.revoke(currentPayload.jti);

    const newAccessToken = await accessTokenService.generate(
      currentPayload.sub,
      role,
      tokenVersion
    );

    const newRefreshToken = await this.generate(currentPayload.sub, currentPayload.deviceId);

    const expiresIn = this.parseExpiresIn(config.accessToken.expiresIn);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
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
