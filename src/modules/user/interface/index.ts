import { IUseCase, Requester } from "@share/interface";
import { User } from "../model/model";
import { UserCondDTO, UserUpdateDTO, UpdateProfileDTO, UserPublic } from "../model/dto";

export interface IUserUseCase extends IUseCase<
  any,
  UserUpdateDTO,
  User,
  UserCondDTO
> {
  searchUsers(query: string, currentUserId: string, limit?: number): Promise<{ id: string; displayName?: string; avatarUrl?: string; username?: string }[]>;
  searchByPhone(phone: string): Promise<User | null>;
  updateProfile(requester: Requester, data: UpdateProfileDTO): Promise<boolean>;
  profile(userId: string): Promise<User>;
  getPublicProfile(userId: string): Promise<UserPublic>;
}

export interface IPresenceRepository {
  setOnline(userId: string, ttlSeconds: number): Promise<void>;
  setOffline(userId: string): Promise<void>;
  registerSocket(userId: string, socketId: string, ttlSeconds: number): Promise<number>;
  touchSocket(userId: string, socketId: string, ttlSeconds: number): Promise<number>;
  unregisterSocket(userId: string, socketId: string): Promise<number>;
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
  registerSocket(userId: string, socketId: string): Promise<{ becameOnline: boolean; connectionCount: number }>;
  touchSocket(userId: string, socketId: string): Promise<{ isOnline: boolean; connectionCount: number }>;
  unregisterSocket(userId: string, socketId: string): Promise<{ becameOffline: boolean; connectionCount: number }>;
  getUserPresence(userId: string): Promise<UserPresenceState>;
}

export interface IUserLastSeenSyncPort {
  syncLastSeenToDB(userId: string, timestamp: number): Promise<boolean>;
}
