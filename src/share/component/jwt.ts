import jwt, { SignOptions } from 'jsonwebtoken'; // 1. Import SignOptions
import { ITokenProvider, TokenPayload } from '../interface';
import { config } from './config';

class JwtTokenService implements ITokenProvider {
  private readonly secretKey: string;
  private readonly expiresIn: string | number;

  constructor(secretKey: string, expiresIn: string | number) {
    this.secretKey = secretKey;
    this.expiresIn = expiresIn;
  }

  async generateToken(payload: TokenPayload): Promise<string> {
    return jwt.sign(payload, this.secretKey, {
      expiresIn: this.expiresIn
    } as SignOptions);
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    const decoded = jwt.verify(token, this.secretKey) as TokenPayload;
    return decoded;
  }
}

export const jwtProvider = new JwtTokenService(config.accessToken.secretKey, config.accessToken.expiresIn);
