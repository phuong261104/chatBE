import { PagingDTO } from "@share/model/paging";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export interface IRepository<Entity, Cond, UpdateDTO>
  extends
    IQueryRepository<Entity, Cond>,
    ICommandRepository<Entity, UpdateDTO> {}

export interface IQueryRepository<Entity, Cond> {
  get(id: string): Promise<Entity | null>;
  findByCond(cond: Cond): Promise<Entity | null>;
  list(cond: Cond, paging: PagingDTO): Promise<Array<Entity>>;
  listByIds(ids: string[]): Promise<Array<Entity>>;
}

export interface ICommandRepository<Entity, UpdateDTO> {
  insert(data: Entity): Promise<boolean>;
  update(id: string, data: UpdateDTO): Promise<boolean>;
  delete(id: string, isHard: boolean): Promise<boolean>;
}

export interface ICommandHandler<Cmd, Result> {
  execute(command: Cmd): Promise<Result>;
}

export interface IQueryHandler<Query, Result> {
  query(query: Query): Promise<Result>;
}

export interface IUseCase<CreateDTO, UpdateDTO, Entity, Cond> {
  create(data: CreateDTO): Promise<string>;
  getDetail(id: string): Promise<Entity | null>;
  list(cond: Cond, paging: PagingDTO): Promise<Array<Entity>>;
  update(id: string, data: UpdateDTO): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

export interface Requester extends TokenPayload {}

export interface ITokenProvider {
  generateToken(payload: TokenPayload): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
}

export type UserToken = {
  accessToken: string;
  refreshToken: string;
};

export type TokenIntrospectResult = {
  payload: TokenPayload | null;
  error?: Error;
  isOk: boolean;
};

export interface ITokenIntrospect {
  introspect(token: string): Promise<TokenIntrospectResult>;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: "access";
  jti: string;
  tokenVersion: number;
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  jti: string;
  deviceId: string;
}

export interface PasswordResetPayload {
  sub: string;
  type: "password-reset";
  jti: string;
  purpose: "reset-password";
}

export interface ITokenBlacklist {
  add(tokenJti: string, expiresInSeconds: number): Promise<void>;
  isBlacklisted(tokenJti: string): Promise<boolean>;
}

export type Platform = "app" | "web";

export type DeviceType =
  | "mobile-app" | "mobile-web"
  | "tablet-app" | "tablet-web"
  | "laptop-app" | "laptop-web"
  | "desktop-app" | "desktop-web"
  | "other";

export interface DeviceDetails {
  displayLabel: string;
  platform: Platform;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: DeviceType;
  userAgent: string;
  ip: string;
  location?: string;
  details?: DeviceDetails;
}

export interface Session {
  userId: string;
  deviceId: string;
  deviceType: DeviceType;
  deviceInfo: DeviceInfo;
  refreshTokenJti: string;
  accessTokenJti?: string;
  accessTokenExpiresAt?: number;
  createdAt: Date;
  lastActive: Date;
}

export interface ISessionStore {
  create(
    userId: string,
    deviceInfo: DeviceInfo,
    refreshTokenJti: string,
    accessTokenJti?: string,
    accessTokenExpiresAt?: number,
  ): Promise<Session>;
  get(deviceId: string): Promise<Session | null>;
  update(deviceId: string, data: Partial<Session>): Promise<void>;
  delete(deviceId: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
  deleteByDeviceType(userId: string, deviceType: DeviceType, excludeDeviceId: string): Promise<void>;
  listByUser(userId: string): Promise<Session[]>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
