import { IUseCase, Requester, TokenPayload } from "@share/interface";
import { User, UserLoginDTO, UserRegistrationDTO } from "../model/model";
import { UserCondDTO, UserUpdateDTO } from "../model/dto";

export interface IUserUseCase extends IUseCase<
  UserRegistrationDTO,
  UserUpdateDTO,
  User,
  UserCondDTO
> {
  login(data: UserLoginDTO): Promise<string>;
  register(data: UserRegistrationDTO): Promise<string>;
  searchByPhone(phone: string): Promise<User | null>;
  updateProfile(requester: Requester, data: UserUpdateDTO): Promise<boolean>;

  profile(userId: string): Promise<User>;
  verifyToken(token: string): Promise<TokenPayload>;
}

export interface IPresenceRepository {
  setOnline(userId: string, ttlSeconds: number): Promise<void>;
  setOffline(userId: string): Promise<void>;
  updateLastSeen(userId: string, timestamp: number): Promise<void>;
  isOnline(userId: string): Promise<boolean>;
  getLastSeen(userId: string): Promise<number | null>;
}

export interface UserPresenceState {
  isOnline: boolean;
  lastSeen: number | null;
}

export interface IPresenceUseCase {
  markUserOnline(userId: string): Promise<void>;
  markUserOffline(userId: string): Promise<void>;
  getUserPresence(userId: string): Promise<UserPresenceState>;
}

export interface IUserLastSeenSyncPort {
  syncLastSeenToDB(userId: string, timestamp: number): Promise<boolean>;
}
