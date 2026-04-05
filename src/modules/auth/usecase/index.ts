import { AppError } from "@share/app-error";
import { jwtProvider } from "@share/component/jwt";
import { IRepository, TokenPayload, UserRole } from "@share/interface";
import { ErrDataNotFound } from "@share/model/base-error";
import bcrypt from "bcrypt";
import { v7 } from "uuid";
import { IAuthUseCase } from "../interface";
import {
  LoginDTO,
  LoginDTOSchema,
  RegistrationDTO,
  RegistrationDTOSchema,
  UserStatus,
} from "../model";
import {
  ErrEmailExisted,
  ErrInvalidCredentials,
  ErrInvalidToken,
  ErrPhoneExisted,
  ErrUserInactivated,
} from "../model/errors";

export class AuthUseCase implements IAuthUseCase {
  constructor(
    private readonly userRepository: IRepository<any, any, any>,
  ) {}

  private normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, "");
  }

  async login(data: LoginDTO): Promise<string> {
    const dto = LoginDTOSchema.parse(data);
    const cond = dto.phone
      ? ({ phone: this.normalizePhone(dto.phone) } as any)
      : ({ email: dto.email } as any);

    const user = await this.userRepository.findByCond(cond);
    if (!user) {
      throw AppError.from(ErrInvalidCredentials, 400).withLog("User not found");
    }

    const isMatch = await bcrypt.compare(
      `${dto.password}.${user.salt}`,
      user.password,
    );
    if (!isMatch) {
      throw AppError.from(ErrInvalidCredentials, 400).withLog("Password is incorrect");
    }

    if (user.status === UserStatus.DISABLED) {
      throw AppError.from(ErrUserInactivated, 400);
    }

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    return jwtProvider.generateToken({
      sub: user.id,
      role: UserRole.USER,
    });
  }

  async register(data: RegistrationDTO): Promise<string> {
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

    const salt = bcrypt.genSaltSync(10);
    const hashPassword = await bcrypt.hash(`${dto.password}.${salt}`, 10);

    const displayName = dto.displayName || dto.email || phone;

    const newId = v7();
    const newUser = {
      id: newId,
      email: dto.email,
      phone,
      password: hashPassword,
      salt: salt,
      status: UserStatus.ACTIVE,
      displayName,
      verified: {
        email: !!dto.email,
        phone: false,
      },
      privacy: {
        searchableByEmail: true,
        searchableByPhone: true,
        searchableByUsername: true,
      },
      settings: {
        notifications: {
          push: true,
          inApp: true,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userRepository.insert(newUser);

    return newId;
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const payload = await jwtProvider.verifyToken(token);

    if (!payload) {
      throw ErrInvalidToken;
    }

    const user = await this.userRepository.get(payload.sub);
    if (!user) {
      throw ErrDataNotFound;
    }

    if (user.status === UserStatus.DISABLED) {
      throw ErrUserInactivated;
    }

    return { sub: user.id, role: payload.role };
  }

  async introspect(token: string): Promise<TokenPayload | null> {
    try {
      return await this.verifyToken(token);
    } catch {
      return null;
    }
  }
}
