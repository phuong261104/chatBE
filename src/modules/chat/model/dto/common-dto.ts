import { z } from "zod";

export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
}

export interface OnlineStatusPayload {
  userId: string;
  status: ConnectionState;
  timestamp: number;
  deviceId?: string;
}

export interface ConnectionInfo {
  socketId: string;
  userId: string;
  deviceId?: string;
  platform?: string;
  connectedAt: number;
  lastActivityAt: number;
}

export const UserCondDTOSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  username: z.string().optional(),
  status: z.string().optional(),
});

export type UserCondDTO = z.infer<typeof UserCondDTOSchema>;

export interface GetTotalUnreadCountQuery {
  userId: string;
}
