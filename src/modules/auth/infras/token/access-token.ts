import jwt, { SignOptions } from "jsonwebtoken";
import { v7 as uuidv7 } from "uuid";
import { AccessTokenPayload, ITokenBlacklist, UserRole } from "@share/interface";
import { config } from "@share/component/config";

export class AccessTokenService {
  constructor(private readonly blacklist: ITokenBlacklist) {}

  async generate(userId: string, role: UserRole, tokenVersion: number): Promise<string> {
    const jti = uuidv7();
    const payload: AccessTokenPayload = {
      sub: userId,
      role,
      type: "access",
      jti,
      tokenVersion,
    };

    const options: SignOptions = {
      expiresIn: config.accessToken.expiresIn as any,
    };

    return jwt.sign(payload, config.accessToken.secretKey, options as any);
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = jwt.verify(token, config.accessToken.secretKey) as AccessTokenPayload;

      const isBlacklisted = await this.blacklist.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async decodeWithoutVerify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const payload = jwt.decode(token) as AccessTokenPayload;
      return payload;
    } catch {
      return null;
    }
  }

  async getTTL(token: string): Promise<number> {
    try {
      const decoded = jwt.decode(token) as { exp: number; iat: number };
      if (!decoded || !decoded.exp) return 0;
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  }

  async addToBlacklist(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as AccessTokenPayload;
      if (decoded && decoded.jti) {
        const ttl = await this.getTTL(token);
        if (ttl > 0) {
          await this.blacklist.add(decoded.jti, ttl);
        }
      }
    } catch {}
  }
}
