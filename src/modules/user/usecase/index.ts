import { AppError } from "@share/app-error";
import {
  IRepository,
  Requester,
  UserRole,
} from "@share/interface";
import { ErrDataNotFound } from "@share/model/base-error";
import { PagingDTO } from "@share/model/paging";
import bcrypt from "bcrypt";
import { v7 } from "uuid";
import { IUserUseCase } from "../interface";
import {
  User,
  UserPhoneSchema,
  UserStatus,
} from "../model/model";
import {
  UserCondDTO,
  UserCondDTOSchema,
  UserPhoneSearchSchema,
  UserUpdateDTO,
  UserUpdateSchema,
  UpdateProfileDTO,
  UpdateProfileDTOSchema,
  UserPublic,
  UserPublicSchema,
} from "../model/dto";

export class UserUseCase implements IUserUseCase {
  constructor(
    private readonly repository: IRepository<User, UserCondDTO, UserUpdateDTO>,
  ) {}

  async profile(userId: string): Promise<User> {
    const user = await this.repository.get(userId);
    if (!user) {
      throw ErrDataNotFound;
    }

    return user;
  }

  async getPublicProfile(userId: string): Promise<UserPublic> {
    const user = await this.repository.get(userId);
    if (!user) {
      throw ErrDataNotFound;
    }

    const publicData: UserPublic = {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      verified: user.verified,
    };

    return UserPublicSchema.parse(publicData);
  }

  async searchByPhone(phone: string): Promise<User | null> {
    const validatedPhone = UserPhoneSchema.parse(phone);
    const normalizedPhone = validatedPhone.replace(/\s+/g, "");

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

  async updateProfile(requester: Requester, data: UpdateProfileDTO): Promise<boolean> {
    const dto = UpdateProfileDTOSchema.parse(data);

    const user = await this.repository.get(requester.sub);
    if (!user) {
      throw ErrDataNotFound;
    }

    const updateData: any = {};
    if (dto.displayName !== undefined) {
      updateData.displayName = dto.displayName;
    }
    if (dto.bio !== undefined) {
      updateData.bio = dto.bio;
    }
    if (dto.avatarUrl !== undefined) {
      updateData.avatarUrl = dto.avatarUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return true;
    }

    return this.repository.update(requester.sub, updateData);
  }

  updateProfile_old(requester: Requester, data: UserUpdateDTO): Promise<boolean> {
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

  async create(data: any): Promise<string> {
    const newId = v7();
    const newUser = {
      id: newId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.repository.insert(newUser);
    return newId;
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
