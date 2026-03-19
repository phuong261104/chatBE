import { AppError } from "@share/app-error";
import { jwtProvider } from "@share/component/jwt";
import {
  IRepository,
  Requester,
  TokenPayload,
  UserRole,
} from "@share/interface";
import { ErrDataNotFound } from "@share/model/base-error";
import { PagingDTO } from "@share/model/paging";
import bcrypt from "bcrypt";
import { v7 } from "uuid";
import { IUserUseCase } from "../interface";
import {
  User,
  UserLoginDTO,
  UserLoginDTOSchema,
  UserPhoneSchema,
  UserRegistrationDTO,
  UserRegistrationDTOSchema,
  UserStatus,
} from "../model/model";
import {
  UserCondDTO,
  UserCondDTOSchema,
  UserUpdateDTO,
  UserUpdateSchema,
} from "../model/dto";
import {
  ErrEmailExisted,
  ErrInvalidEmailAndPassword,
  ErrInvalidToken,
  ErrPhoneExisted,
  ErrUserInactivated,
} from "../model/errors";

export class UserUseCase implements IUserUseCase {
  constructor(
    private readonly repository: IRepository<User, UserCondDTO, UserUpdateDTO>,
  ) {}

  private normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, "");
  }

  async profile(userId: string): Promise<User> {
    const user = await this.repository.get(userId);
    if (!user) {
      throw ErrDataNotFound;
    }

    return user;
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    const payload = await jwtProvider.verifyToken(token);

    if (!payload) {
      throw ErrInvalidToken;
    }

    const user = await this.repository.get(payload.sub);
    if (!user) {
      throw ErrDataNotFound;
    }

    if (user.status === UserStatus.DISABLED) {
      throw ErrUserInactivated;
    }

    return { sub: user.id, role: payload.role };
  }

  async login(data: UserLoginDTO): Promise<string> {
    const dto = UserLoginDTOSchema.parse(data);
    const cond = dto.phone
      ? ({ phone: this.normalizePhone(dto.phone) } as UserCondDTO)
      : ({ email: dto.email } as UserCondDTO);

    const user = await this.repository.findByCond(cond);
    if (!user) {
      throw AppError.from(ErrInvalidEmailAndPassword, 400).withLog(
        "User not found",
      );
    }

    const isMatch = await bcrypt.compare(
      `${dto.password}.${user.salt}`,
      user.password,
    );
    if (!isMatch) {
      throw AppError.from(ErrInvalidEmailAndPassword, 400).withLog(
        "Password is incorrect",
      );
    }

    if (user.status === UserStatus.DISABLED) {
      throw AppError.from(ErrUserInactivated, 400);
    }

    await this.repository.update(user.id, { lastLoginAt: new Date() });

    const token = jwtProvider.generateToken({
      sub: user.id,
      role: UserRole.USER,
    });
    return token;
  }

  async register(data: UserRegistrationDTO): Promise<string> {
    const dto = UserRegistrationDTOSchema.parse(data);
    const phone = this.normalizePhone(dto.phone);

    const existedByPhone = await this.repository.findByCond({
      phone,
    } as UserCondDTO);
    if (existedByPhone) {
      throw AppError.from(ErrPhoneExisted, 400);
    }

    if (dto.email) {
      const existedByEmail = await this.repository.findByCond({
        email: dto.email,
      } as UserCondDTO);
      if (existedByEmail) {
        throw AppError.from(ErrEmailExisted, 400);
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hashPassword = await bcrypt.hash(`${dto.password}.${salt}`, 10);

    const displayName = dto.displayName || dto.email || phone;

    const newId = v7();
    const newUser: User = {
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

    await this.repository.insert(newUser);

    return newId;
  }

  async searchByPhone(phone: string): Promise<User | null> {
    const validatedPhone = UserPhoneSchema.parse(phone);
    const normalizedPhone = this.normalizePhone(validatedPhone);

    const user = await this.repository.findByCond({
      phone: normalizedPhone,
      status: UserStatus.ACTIVE,
      "privacy.searchableByPhone": true,
    } as UserCondDTO);

    if (!user) {
      return null;
    }

    const { password, salt, ...otherProps } = user;
    return otherProps as User;
  }

  updateProfile(requester: Requester, data: UserUpdateDTO): Promise<boolean> {
    const dto = UserUpdateSchema.parse(data);

    const user = this.repository.get(requester.sub);
    if (!user) {
      throw ErrDataNotFound;
    }

    if (dto.password) {
      const salt = bcrypt.genSaltSync(10);
      const hashPassword = bcrypt.hashSync(`${dto.password}.${salt}`, 10);
      dto.password = hashPassword;
      dto.salt = salt;
    }

    return this.repository.update(requester.sub, dto);
  }

  async create(data: UserRegistrationDTO): Promise<string> {
    return await this.register(data);
  }

  async getDetail(id: string): Promise<User | null> {
    const data = await this.repository.get(id);

    if (!data) {
      throw ErrDataNotFound;
    }

    const { password, salt, ...otherProps } = data;

    return otherProps as User;
  }

  async update(id: string, data: UserUpdateDTO): Promise<boolean> {
    const dto = UserUpdateSchema.parse(data);

    const user = await this.repository.get(id);
    if (!user) {
      throw ErrDataNotFound;
    }

    await this.repository.update(id, dto);

    return true;
  }

  async list(cond: UserCondDTO, paging: PagingDTO): Promise<User[]> {
    const parsedCond = UserCondDTOSchema.parse(cond);

    const users = await this.repository.list(parsedCond, paging);
    return users.map((user) => {
      const { password, salt, ...otherProps } = user;
      return otherProps as User;
    });
  }

  async delete(id: string): Promise<boolean> {
    const user = await this.repository.get(id);

    if (!user) {
      throw ErrDataNotFound;
    }

    this.repository.delete(id, false);
    return true;
  }
}
