# Hướng Dẫn Hiện Thực Chức Năng Call (Voice/Video)

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Backend API Endpoints](#2-backend-api-endpoints)
3. [Socket.IO Events](#3-socketio-events)
4. [Cài Đặt Dependencies](#4-cài-đặt-dependencies)
5. [Cấu Hình Môi Trường](#5-cấu-hình-môi-trường)
6. [Service Layer - API Calls](#6-service-layer---api-calls)
7. [Service Layer - Socket Manager](#7-service-layer---socket-manager)
8. [State Management - CallProvider](#8-state-management---callprovider)
9. [UI Components](#9-ui-components)
10. [Tích Hợp Vào Ứng Dụng](#10-tích-hợp-vào-ứng-dụng)
11. [Type Definitions](#11-type-definitions)
12. [Flow Từ Đầu Đến Cuối](#12-flow-từ-đầu-đến-cuối)

---

## 1. Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  CallProvider (React Context)                                    │
│  ├── callService (REST API)                                     │
│  ├── callSocket (Socket.IO Manager)                             │
│  └── LiveKit Room (WebRTC)                                      │
│                                                                  │
│  UI Components                                                  │
│  ├── IncomingCallModal  (Modal khi có cuộc gọi đến)            │
│  ├── OutgoingCallModal (Modal khi đang gọi)                    │
│  └── ActiveCallView    (Màn hình cuộc gọi đang diễn ra)       │
├─────────────────────────────────────────────────────────────────┤
│                    Backend (chatBE)                             │
├─────────────────────────────────────────────────────────────────┤
│  REST API  →  /v1/calls/*  (tạo, nhận, kết thúc cuộc gọi)    │
│  Socket.IO →  /socket/calls  (tín hiệu: incoming, answered...) │
│  LiveKit   →  WebRTC server (truyền audio/video thực sự)      │
└─────────────────────────────────────────────────────────────────┘
```

**2 loại cuộc gọi được hỗ trợ:**

- **v1 (Self-hosted LiveKit):** Tự host LiveKit server riêng
- **v2 (LiveKit Cloud):** Dùng LiveKit Cloud (mặc định khuyến nghị)

---

## 2. Backend API Endpoints

### Base URL: `/v1`

### v2 - LiveKit Cloud (Khuyến nghị)

| Method   | Endpoint                    | Mô Tả             |
| -------- | --------------------------- | ----------------- |
| `POST`   | `/calls/v2`                 | Tạo cuộc gọi mới  |
| `POST`   | `/calls/v2/{callId}/answer` | Trả lời cuộc gọi  |
| `POST`   | `/calls/v2/{callId}/reject` | Từ chối cuộc gọi  |
| `POST`   | `/calls/v2/{callId}/missed` | Đánh dấu là nhỡ   |
| `DELETE` | `/calls/v2/{callId}`        | Kết thúc cuộc gọi |
| `GET`    | `/calls/v2/{callId}/token`  | Lấy LiveKit token |

### v1 - Self-hosted LiveKit

| Method   | Endpoint                 | Mô Tả        |
| -------- | ------------------------ | ------------ |
| `POST`   | `/calls`                 | Tạo cuộc gọi |
| `POST`   | `/calls/{callId}/answer` | Trả lời      |
| `POST`   | `/calls/{callId}/reject` | Từ chối      |
| `POST`   | `/calls/{callId}/missed` | Đánh dấu nhỡ |
| `DELETE` | `/calls/{callId}`        | Kết thúc     |
| `GET`    | `/calls/{callId}/token`  | Lấy token    |

### Request/Response Details

#### Tạo cuộc gọi: `POST /calls/v2`

**Request:**

```json
{
  "conversationId": "0192a3bc-def0-7abc-8901-23456789abcd",
  "type": "video",
  "calleeIds": []
}
```

**Response 201:**

```json
{
  "data": {
    "callId": "0192a3bc-def0-7abc-8901-23456789abcd",
    "conversationId": "0192a3bc-def0-7abc-8901-23456789abce",
    "initiatorId": "0192a3bc-def0-7abc-8901-23456789abcf",
    "calleeIds": [],
    "type": "video",
    "status": "initiated",
    "apiVersion": "v2",
    "livekitProvider": "cloud",
    "livekitRoomName": "call-room-0192a3bc",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Trả lời cuộc gọi: `POST /calls/v2/{callId}/answer`

**Response 200:**

```json
{
  "data": {
    "callId": "0192a3bc-def0-7abc-8901-23456789abcd",
    "conversationId": "...",
    "initiatorId": "...",
    "type": "video",
    "status": "answered",
    "apiVersion": "v2",
    "livekitProvider": "cloud",
    "livekitRoomName": "call-room-0192a3bc",
    "createdAt": "..."
  }
}
```

#### Lấy LiveKit Token: `GET /calls/v2/{callId}/token`

**Response 200:**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "roomName": "call-room-0192a3bc",
    "callId": "0192a3bc-def0-7abc-8901-23456789abcd"
  }
}
```

#### Kết thúc cuộc gọi: `DELETE /calls/v2/{callId}`

**Response 200:**

```json
{
  "data": {
    "callId": "0192a3bc-def0-7abc-8901-23456789abcd",
    "status": "ended",
    "duration": 120
  }
}
```

---

## 3. Socket.IO Events

**Namespace:** `/socket/calls`

### Server → Client (Frontend lắng nghe)

| Event           | Payload                                                                           | Khi nào nhận                                |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| `call:incoming` | `{callId, callerId, type, conversationId, roomName, apiVersion, livekitProvider}` | Có cuộc gọi đến                             |
| `call:ringing`  | `{callId}`                                                                        | Người được gọi đã nghe máy (đang đổ chuông) |
| `call:answered` | `{callId, roomName, token?, wsUrl?, livekitProvider?}`                            | Người được gọi trả lời                      |
| `call:rejected` | `{callId}`                                                                        | Người được gọi từ chối                      |
| `call:ended`    | `{callId}`                                                                        | Cuộc gọi kết thúc                           |
| `call:missed`   | `{callId}`                                                                        | Cuộc gọi bị nhỡ                             |

### Client → Server (Frontend gửi đi)

| Event        | Payload    | Mô tả                   |
| ------------ | ---------- | ----------------------- |
| `call:join`  | `{callId}` | Tham gia phòng cuộc gọi |
| `call:leave` | `{callId}` | Rời phòng cuộc gọi      |

---

## 4. Cài Đặt Dependencies

```bash
npm install livekit-client socket.io-client axios
```

Hoặc với yarn:

```bash
yarn add livekit-client socket.io-client axios
```

**Các package cần thiết:**
| Package | Phiên bản | Mục đích |
|---------|-----------|----------|
| `livekit-client` | ^2.18.10 | WebRTC SDK cho audio/video |
| `socket.io-client` | ^4.8.1 | Real-time communication |
| `axios` | latest | HTTP client cho API calls |

---

## 5. Cấu Hình Môi Trường

Tạo/Update file `.env` ở frontend:

```env
# Socket URL - URL của backend
VITE_SOCKET_URL=http://localhost:3000

# API Version - chọn 'v1' (self-hosted) hoặc 'v2' (cloud)
VITE_CALL_API_VERSION=v2

# Auth Token - token JWT đã đăng nhập
VITE_AUTH_TOKEN=your_jwt_token_here
```

Update file `vite-env.d.ts` để TypeScript nhận diện:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_CALL_API_VERSION?: "v1" | "v2";
  readonly VITE_AUTH_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## 6. Service Layer - API Calls

Tạo file `src/services/callService.ts`:

```typescript
import api from "./api";

export type CallType = "audio" | "video";

export interface CreateCallPayload {
  conversationId: string;
  type: CallType;
  calleeIds?: string[];
}

export interface CreateCallResponse {
  callId?: string;
  wsUrl?: string;
  roomName?: string;
  apiVersion?: "v1" | "v2";
  livekitProvider?: "self-hosted" | "cloud";
  type: CallType;
}

export interface CallTokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  livekitProvider?: "self-hosted" | "cloud";
}

export interface CallResponse {
  callId: string;
  conversationId: string;
  type: CallType;
  status: string;
  [key: string]: unknown;
}

class CallService {
  private baseUrl = "/v1";

  private getApiVersion(): "v1" | "v2" {
    return (import.meta.env.VITE_CALL_API_VERSION as "v1" | "v2") || "v2";
  }

  private getVersionPrefix(): string {
    return this.getApiVersion() === "v1" ? "" : "/v2";
  }

  async createCall(payload: CreateCallPayload): Promise<CreateCallResponse> {
    const { data } = await api.post(
      `${this.baseUrl}/calls${this.getVersionPrefix()}`,
      payload,
    );
    return data.data;
  }

  async answerCall(callId: string): Promise<CreateCallResponse> {
    const { data } = await api.post(
      `${this.baseUrl}/calls${this.getVersionPrefix()}/${callId}/answer`,
    );
    return data.data;
  }

  async rejectCall(callId: string): Promise<void> {
    await api.post(
      `${this.baseUrl}/calls${this.getVersionPrefix()}/${callId}/reject`,
    );
  }

  async endCall(callId: string): Promise<void> {
    await api.delete(
      `${this.baseUrl}/calls${this.getVersionPrefix()}/${callId}`,
    );
  }

  async missedCall(callId: string): Promise<void> {
    await api.post(
      `${this.baseUrl}/calls${this.getVersionPrefix()}/${callId}/missed`,
    );
  }

  async getToken(callId: string): Promise<CallTokenResponse> {
    const { data } = await api.get(
      `${this.baseUrl}/calls${this.getVersionPrefix()}/${callId}/token`,
    );
    return data.data;
  }
}

export const callService = new CallService();
```

**Lưu ý:** File `src/services/api.ts` cần có sẵn với Axios instance đã cấu hình interceptor cho auth token:

```typescript
// src/services/api.ts
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/v1",
});

api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("auth_token") || import.meta.env.VITE_AUTH_TOKEN;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

## 7. Service Layer - Socket Manager

Tạo file `src/services/callSocket.ts`:

```typescript
import { io, Socket } from "socket.io-client";

export interface CallIncomingPayload {
  callId: string;
  callerId: string;
  type: "audio" | "video";
  conversationId: string;
  roomName: string;
  apiVersion?: "v1" | "v2";
  livekitProvider?: "self-hosted" | "cloud";
}

export interface CallEndedPayload {
  callId: string;
}

export interface CallAnsweredPayload extends CallEndedPayload {
  roomName?: string;
  token?: string;
  wsUrl?: string;
  livekitProvider?: "self-hosted" | "cloud";
}

type EventHandler<T> = (payload: T) => void;

export class CallSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;

  connect(): void {
    if (this.socket?.connected) return;

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      "http://localhost:3000";

    this.socket = io(`${socketUrl}/socket/calls`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      auth: {
        token: localStorage.getItem("auth_token"),
      },
      extraHeaders: {
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      },
    });

    this.socket.on("connect", () => {
      console.log("[CallSocket] Connected to call namespace");
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[CallSocket] Disconnected:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.error("[CallSocket] Connection error:", error);
      this.reconnectAttempts++;
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinCall(callId: string): void {
    this.socket?.emit("call:join", { callId });
    console.log("[CallSocket] Joining call:", callId);
  }

  leaveCall(callId: string): void {
    this.socket?.emit("call:leave", { callId });
    console.log("[CallSocket] Leaving call:", callId);
  }

  // === Event Listeners ===

  onIncomingCall(handler: EventHandler<CallIncomingPayload>): void {
    this.socket?.on("call:incoming", handler);
  }

  onRingingCall(handler: EventHandler<CallEndedPayload>): void {
    this.socket?.on("call:ringing", handler);
  }

  onCallAnswered(handler: EventHandler<CallAnsweredPayload>): void {
    this.socket?.on("call:answered", handler);
  }

  onCallRejected(handler: EventHandler<CallEndedPayload>): void {
    this.socket?.on("call:rejected", handler);
  }

  onCallEnded(handler: EventHandler<CallEndedPayload>): void {
    this.socket?.on("call:ended", handler);
  }

  onCallMissed(handler: EventHandler<CallEndedPayload>): void {
    this.socket?.on("call:missed", handler);
  }

  // === Remove Listeners ===

  offIncomingCall(): void {
    this.socket?.off("call:incoming");
  }

  offRingingCall(): void {
    this.socket?.off("call:ringing");
  }

  offCallAnswered(): void {
    this.socket?.off("call:answered");
  }

  offCallRejected(): void {
    this.socket?.off("call:rejected");
  }

  offCallEnded(): void {
    this.socket?.off("call:ended");
  }

  offCallMissed(): void {
    this.socket?.off("call:missed");
  }

  offAll(): void {
    this.offIncomingCall();
    this.offRingingCall();
    this.offCallAnswered();
    this.offCallRejected();
    this.offCallEnded();
    this.offCallMissed();
  }
}

export const callSocket = new CallSocketManager();
```

---

## 8. State Management - CallProvider

Tạo file `src/contexts/CallContext.tsx` (hoặc trong thư mục providers):

```typescript
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Room } from 'livekit-client';
import { callService } from '../services/callService';
import { callSocket, CallIncomingPayload, CallAnsweredPayload, CallEndedPayload } from '../services/callSocket';

// ==================== TYPES ====================

export type CallType = 'audio' | 'video';

export type CallStatus =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'incoming'
  | 'active'
  | 'ended';

export interface CallState {
  status: CallStatus;
  callId: string | null;
  conversationId: string | null;
  type: CallType;
  callerId: string | null;
  roomName: string | null;
  localVideoEnabled: boolean;
  localAudioEnabled: boolean;
  remoteParticipantId: string | null;
  remoteParticipantName: string | null;
  livekitProvider: 'self-hosted' | 'cloud' | null;
  wsUrl: string | null;
}

type CallAction =
  | { type: 'SET_CALL'; payload: Partial<CallState> }
  | { type: 'SET_STATUS'; payload: CallStatus }
  | { type: 'SET_CALL_ID'; payload: string | null }
  | { type: 'SET_ROOM_NAME'; payload: string | null }
  | { type: 'SET_PARTICIPANT'; payload: { id: string | null; name: string | null } }
  | { type: 'TOGGLE_VIDEO' }
  | { type: 'TOGGLE_AUDIO' }
  | { type: 'RESET' };

const initialState: CallState = {
  status: 'idle',
  callId: null,
  conversationId: null,
  type: 'audio',
  callerId: null,
  roomName: null,
  localVideoEnabled: true,
  localAudioEnabled: true,
  remoteParticipantId: null,
  remoteParticipantName: null,
  livekitProvider: null,
  wsUrl: null,
};

function callReducer(state: CallState, action: CallAction): CallState {
  switch (action.type) {
    case 'SET_CALL':
      return { ...state, ...action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_CALL_ID':
      return { ...state, callId: action.payload };
    case 'SET_ROOM_NAME':
      return { ...state, roomName: action.payload };
    case 'SET_PARTICIPANT':
      return {
        ...state,
        remoteParticipantId: action.payload.id,
        remoteParticipantName: action.payload.name,
      };
    case 'TOGGLE_VIDEO':
      return { ...state, localVideoEnabled: !state.localVideoEnabled };
    case 'TOGGLE_AUDIO':
      return { ...state, localAudioEnabled: !state.localAudioEnabled };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ==================== CONTEXT ====================

export interface CallContextValue {
  state: CallState;
  startCall: (conversationId: string, type: CallType, calleeIds?: string[]) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleVideo: () => void;
  toggleAudio: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

// ==================== PROVIDER ====================

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(callReducer, initialState);
  const roomRef = useRef<Room | null>(null);
  const missedTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ==================== CONNECT SOCKET ====================

  useEffect(() => {
    callSocket.connect();

    // Lắng nghe cuộc gọi đến
    callSocket.onIncomingCall((payload: CallIncomingPayload) => {
      console.log('[CallProvider] Incoming call:', payload);

      dispatch({
        type: 'SET_CALL',
        payload: {
          status: 'incoming',
          callId: payload.callId,
          conversationId: payload.conversationId,
          type: payload.type,
          callerId: payload.callerId,
          roomName: payload.roomName,
          livekitProvider: payload.livekitProvider || 'cloud',
          wsUrl: payload.wsUrl,
        },
      });

      // Đặt timeout 30s để đánh dấu nhỡ
      missedTimeoutRef.current = setTimeout(async () => {
        if (state.status === 'incoming' || state.status === 'ringing') {
          await callService.missedCall(payload.callId);
          dispatch({ type: 'RESET' });
        }
      }, 30000);
    });

    // Cuộc gọi được trả lời
    callSocket.onCallAnswered(async (payload: CallAnsweredPayload) => {
      console.log('[CallProvider] Call answered:', payload);

      if (missedTimeoutRef.current) {
        clearTimeout(missedTimeoutRef.current);
        missedTimeoutRef.current = null;
      }

      // Lấy token và kết nối LiveKit
      try {
        const tokenData = await callService.getToken(payload.callId);
        await connectToLiveKit(
          tokenData.token,
          tokenData.roomName || payload.roomName || '',
          tokenData.wsUrl,
          tokenData.livekitProvider
        );

        dispatch({ type: 'SET_STATUS', payload: 'active' });
      } catch (error) {
        console.error('[CallProvider] Failed to get token:', error);
      }
    });

    // Bị từ chối
    callSocket.onCallRejected(() => {
      console.log('[CallProvider] Call rejected');
      if (missedTimeoutRef.current) {
        clearTimeout(missedTimeoutRef.current);
        missedTimeoutRef.current = null;
      }
      dispatch({ type: 'RESET' });
    });

    // Cuộc gọi kết thúc
    callSocket.onCallEnded(() => {
      console.log('[CallProvider] Call ended');
      disconnectFromLiveKit();
      dispatch({ type: 'RESET' });
    });

    // Cuộc gọi nhỡ
    callSocket.onCallMissed(() => {
      console.log('[CallProvider] Call missed');
      disconnectFromLiveKit();
      dispatch({ type: 'RESET' });
    });

    return () => {
      callSocket.offAll();
      callSocket.disconnect();
    };
  }, []);

  // ==================== LIVEKIT CONNECTION ====================

  const connectToLiveKit = async (
    token: string,
    roomName: string,
    wsUrl?: string,
    provider?: 'self-hosted' | 'cloud'
  ): Promise<void> => {
    try {
      // wsUrl mặc định cho cloud
      const livekitUrl = wsUrl || 'wss://vov-pplq47fl.livekit.cloud';

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // Lắng nghe sự kiện
      room.on('participantConnected', (participant) => {
        console.log('[LiveKit] Participant connected:', participant.identity);
        dispatch({
          type: 'SET_PARTICIPANT',
          payload: { id: participant.identity, name: participant.name },
        });
      });

      room.on('participantDisconnected', () => {
        console.log('[LiveKit] Participant disconnected');
        dispatch({
          type: 'SET_PARTICIPANT',
          payload: { id: null, name: null },
        });
      });

      room.on('trackSubscribed', (track, publication, participant) => {
        console.log('[LiveKit] Track subscribed:', track.kind);
        // Attach track vào DOM element trong ActiveCallView
        const elements = room.participantManager.getAllParticipants();
        elements.forEach((p) => {
          p.getTracks().forEach((pub) => {
            if (pub.track) {
              const el = pub.track.attach();
              document.getElementById(`remote-${participant.identity}`)?.appendChild(el);
            }
          });
        });
      });

      room.on('disconnected', () => {
        console.log('[LiveKit] Room disconnected');
        roomRef.current = null;
        dispatch({ type: 'RESET' });
      });

      // Kết nối
      await room.connect(livekitUrl, token);
      console.log('[LiveKit] Connected to room:', roomName);

      // Bật/tắt camera và mic theo state
      await room.localParticipant.setCameraEnabled(state.type === 'video');
      await room.localParticipant.setMicrophoneEnabled(state.localAudioEnabled);

      // Lưu vào window để UI components truy cập
      (window as any).__callRoom = room;

      dispatch({ type: 'SET_STATUS', payload: 'active' });
    } catch (error) {
      console.error('[LiveKit] Connection failed:', error);
      throw error;
    }
  };

  const disconnectFromLiveKit = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    (window as any).__callRoom = null;
  }, []);

  // ==================== CALL ACTIONS ====================

  const startCall = useCallback(
    async (conversationId: string, type: CallType, calleeIds?: string[]) => {
      try {
        dispatch({
          type: 'SET_CALL',
          payload: { status: 'calling', conversationId, type },
        });

        const callData = await callService.createCall({
          conversationId,
          type,
          calleeIds,
        });

        dispatch({
          type: 'SET_CALL',
          payload: {
            callId: callData.callId,
            roomName: callData.roomName || null,
            livekitProvider: callData.livekitProvider || 'cloud',
            wsUrl: callData.wsUrl || null,
          },
        });

        // Tham gia socket room
        if (callData.callId) {
          callSocket.joinCall(callData.callId);
        }

        // Đặt timeout 30s
        missedTimeoutRef.current = setTimeout(async () => {
          if (state.status === 'calling') {
            await callService.endCall(callData.callId!);
            dispatch({ type: 'RESET' });
          }
        }, 30000);
      } catch (error) {
        console.error('[CallProvider] Start call failed:', error);
        dispatch({ type: 'RESET' });
        throw error;
      }
    },
    [state.status]
  );

  const acceptCall = useCallback(async () => {
    if (!state.callId) return;

    try {
      if (missedTimeoutRef.current) {
        clearTimeout(missedTimeoutRef.current);
        missedTimeoutRef.current = null;
      }

      dispatch({ type: 'SET_STATUS', payload: 'ringing' });

      await callService.answerCall(state.callId);
      // Sẽ nhận `call:answered` event từ socket, trigger connectToLiveKit
    } catch (error) {
      console.error('[CallProvider] Accept call failed:', error);
      dispatch({ type: 'RESET' });
    }
  }, [state.callId]);

  const rejectCall = useCallback(async () => {
    if (!state.callId) return;

    try {
      if (missedTimeoutRef.current) {
        clearTimeout(missedTimeoutRef.current);
        missedTimeoutRef.current = null;
      }

      await callService.rejectCall(state.callId);
      dispatch({ type: 'RESET' });
    } catch (error) {
      console.error('[CallProvider] Reject call failed:', error);
      dispatch({ type: 'RESET' });
    }
  }, [state.callId]);

  const endCall = useCallback(async () => {
    if (!state.callId) {
      disconnectFromLiveKit();
      dispatch({ type: 'RESET' });
      return;
    }

    try {
      if (missedTimeoutRef.current) {
        clearTimeout(missedTimeoutRef.current);
        missedTimeoutRef.current = null;
      }

      await callService.endCall(state.callId);
      callSocket.leaveCall(state.callId);
      disconnectFromLiveKit();
      dispatch({ type: 'RESET' });
    } catch (error) {
      console.error('[CallProvider] End call failed:', error);
      disconnectFromLiveKit();
      dispatch({ type: 'RESET' });
    }
  }, [state.callId, disconnectFromLiveKit]);

  const toggleVideo = useCallback(() => {
    dispatch({ type: 'TOGGLE_VIDEO' });
    if (roomRef.current) {
      roomRef.current.localParticipant.setCameraEnabled(
        !roomRef.current.localParticipant.isCameraEnabled
      );
    }
  }, []);

  const toggleAudio = useCallback(() => {
    dispatch({ type: 'TOGGLE_AUDIO' });
    if (roomRef.current) {
      roomRef.current.localParticipant.setMicrophoneEnabled(
        !roomRef.current.localParticipant.isMicrophoneEnabled
      );
    }
  }, []);

  const value: CallContextValue = {
    state,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

// ==================== HOOK ====================

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
```

---

## 9. UI Components

### 9.1. Modal Cuộc Gọi Đến

Tạo file `src/components/call/IncomingCallModal.tsx`:

```tsx
import { Phone, Video, X } from "lucide-react";
import { useCall } from "../../contexts/CallContext";
import { useEffect, useState } from "react";

export function IncomingCallModal() {
  const { state, acceptCall, rejectCall } = useCall();
  const [loading, setLoading] = useState(false);

  if (state.status !== "incoming") return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptCall();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-80 rounded-2xl bg-white p-6 shadow-2xl">
        {/* Avatar & Info */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <span className="text-3xl font-bold text-blue-600">
              {state.callerId?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              Cuộc gọi {state.type === "video" ? "video" : "thoại"} đến
            </p>
            <p className="text-sm text-gray-500">
              @{state.callerId?.slice(0, 8)}
            </p>
          </div>

          {/* Call type icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            {state.type === "video" ? (
              <Video className="h-6 w-6 text-gray-600" />
            ) : (
              <Phone className="h-6 w-6 text-gray-600" />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-center gap-6">
          {/* Reject */}
          <button
            onClick={rejectCall}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Accept */}
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white transition hover:bg-green-600 disabled:opacity-50"
          >
            <Phone className={`h-6 w-6 ${loading ? "animate-pulse" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 9.2. Modal Cuộc Gọi Đi

Tạo file `src/components/call/OutgoingCallModal.tsx`:

```tsx
import { Phone, X } from "lucide-react";
import { useCall } from "../../contexts/CallContext";

export function OutgoingCallModal() {
  const { state, endCall } = useCall();

  if (state.status !== "calling" && state.status !== "ringing") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-80 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          {/* Animated phone icon */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <Phone className="h-8 w-8 rotate-[70deg] text-blue-600" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              <span className="animate-ping text-xs text-white"> </span>
            </span>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {state.status === "ringing" ? "Đang đổ chuông..." : "Đang gọi..."}
            </p>
            <p className="text-sm text-gray-500">
              Cuộc gọi {state.type === "video" ? "video" : "thoại"}
            </p>
          </div>
        </div>

        {/* End call button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={endCall}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 9.3. Màn Hình Cuộc Gọi Đang Diễn Ra

Tạo file `src/components/call/ActiveCallView.tsx`:

```tsx
import { Mic, MicOff, Video, VideoOff, Phone } from "lucide-react";
import { useCall } from "../../contexts/CallContext";
import { useEffect, useRef, useState } from "react";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function ActiveCallView() {
  const { state, endCall, toggleVideo, toggleAudio } = useCall();
  const [duration, setDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<any>(null);

  useEffect(() => {
    if (state.status !== "active") {
      setDuration(0);
      return;
    }

    // Lấy room từ window
    const room = (window as any).__callRoom;
    roomRef.current = room;

    // Đếm thời gian
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Attach local video preview
    if (room?.localParticipant && state.type === "video") {
      const track = room.localParticipant
        .getTracks()
        .find((t: any) => t.source === "camera");

      if (track?.track) {
        const el = track.track.attach();
        if (localVideoRef.current) {
          localVideoRef.current.innerHTML = "";
          localVideoRef.current.appendChild(el);
        }
      }
    }

    return () => clearInterval(interval);
  }, [state.status, state.type]);

  if (state.status !== "active") return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      {/* Remote Video (full screen) or Avatar */}
      <div className="relative flex-1">
        {state.type === "video" ? (
          /* Remote video placeholder - thay bằng LiveKit track attachment */
          <div id="remote-video" className="h-full w-full bg-gray-800">
            {/* LiveKit sẽ tự attach video vào đây */}
          </div>
        ) : (
          /* Avatar cho audio call */
          <div className="flex h-full flex-col items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-blue-100">
              <span className="text-5xl font-bold text-blue-600">
                {state.remoteParticipantName?.charAt(0).toUpperCase() ||
                  state.remoteParticipantId?.charAt(0).toUpperCase() ||
                  "U"}
              </span>
            </div>
            <p className="mt-4 text-xl font-semibold text-white">
              {state.remoteParticipantName || "Đang kết nối..."}
            </p>
          </div>
        )}

        {/* Local video preview */}
        {state.type === "video" && (
          <div className="absolute bottom-4 right-4 h-32 w-48 overflow-hidden rounded-xl bg-gray-700">
            <div ref={localVideoRef} className="h-full w-full" />
            {!state.localVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <VideoOff className="h-8 w-8 text-white" />
              </div>
            )}
          </div>
        )}

        {/* Duration */}
        <div className="absolute left-4 top-4 rounded-lg bg-black/50 px-3 py-1">
          <span className="font-mono text-white">
            {formatDuration(duration)}
          </span>
        </div>

        {/* Call type badge */}
        <div className="absolute right-4 top-4 rounded-lg bg-black/50 px-3 py-1">
          <span className="text-sm text-white">
            {state.type === "video" ? "Video Call" : "Voice Call"}
          </span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex items-center justify-center gap-4 bg-gray-900 p-6">
        {/* Toggle Microphone */}
        <button
          onClick={toggleAudio}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
            state.localAudioEnabled
              ? "bg-gray-700 text-white hover:bg-gray-600"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          {state.localAudioEnabled ? (
            <Mic className="h-6 w-6" />
          ) : (
            <MicOff className="h-6 w-6" />
          )}
        </button>

        {/* Toggle Camera (video only) */}
        {state.type === "video" && (
          <button
            onClick={toggleVideo}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
              state.localVideoEnabled
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {state.localVideoEnabled ? (
              <Video className="h-6 w-6" />
            ) : (
              <VideoOff className="h-6 w-6" />
            )}
          </button>
        )}

        {/* End Call */}
        <button
          onClick={endCall}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
        >
          <Phone className="h-6 w-6 rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}
```

---

## 10. Tích Hợp Vào Ứng Dụng

### 10.1. Thêm Provider Vào App

Trong `src/App.tsx` hoặc `src/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CallProvider } from "./contexts/CallContext";
import { IncomingCallModal } from "./components/call/IncomingCallModal";
import { OutgoingCallModal } from "./components/call/OutgoingCallModal";
import { ActiveCallView } from "./components/call/ActiveCallView";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Wrap với CallProvider */}
      <CallProvider>
        {/* Phần còn lại của app */}
        <YourAppContent />

        {/* Global Call Overlays - đặt ở đây để hiển thị trên mọi trang */}
        <IncomingCallModal />
        <OutgoingCallModal />
        <ActiveCallView />
      </CallProvider>
    </QueryClientProvider>
  );
}

export default App;
```

### 10.2. Thêm Nút Gọi Vào Giao Diện

**Trong ChatHeader.tsx:**

```tsx
import { useCall } from "../contexts/CallContext";
import { Phone, Video } from "lucide-react";

function ChatHeader({ conversationId }: { conversationId: string }) {
  const { startCall } = useCall();

  return (
    <div className="flex items-center gap-2">
      {/* Nút gọi thoại */}
      <button
        onClick={() => startCall(conversationId, "audio")}
        className="rounded-full p-2 hover:bg-gray-100"
        title="Gọi thoại"
      >
        <Phone className="h-5 w-5" />
      </button>

      {/* Nút gọi video */}
      <button
        onClick={() => startCall(conversationId, "video")}
        className="rounded-full p-2 hover:bg-gray-100"
        title="Gọi video"
      >
        <Video className="h-5 w-5" />
      </button>
    </div>
  );
}
```

**Trong ConversationInfo.tsx:**

```tsx
import { useCall } from "../../contexts/CallContext";
import { Phone, Video } from "lucide-react";

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-lg p-3 hover:bg-gray-100"
    >
      <Icon className="h-6 w-6 text-blue-600" />
      <span className="text-xs text-gray-600">{label}</span>
    </button>
  );
}

function ConversationInfoPanel({
  conversationId,
  conversationName,
}: {
  conversationId: string;
  conversationName: string;
}) {
  const { startCall } = useCall();

  return (
    <div className="flex gap-2">
      <QuickAction
        icon={Phone}
        label="Gọi thoại"
        onClick={() => startCall(conversationId, "audio")}
      />
      <QuickAction
        icon={Video}
        label="Gọi video"
        onClick={() => startCall(conversationId, "video")}
      />
    </div>
  );
}
```

---

## 11. Type Definitions

Tạo file `src/types/call.ts` (hoặc thêm vào file types hiện có):

```typescript
// ==================== API Types ====================

export type CallType = "audio" | "video";
export type CallApiVersion = "v1" | "v2";
export type LivekitProvider = "self-hosted" | "cloud";
export type CallStatusValue =
  | "idle"
  | "calling"
  | "ringing"
  | "incoming"
  | "active"
  | "ended";

export interface CreateCallPayload {
  conversationId: string;
  type: CallType;
  calleeIds?: string[];
}

export interface CreateCallResponse {
  callId?: string;
  wsUrl?: string;
  roomName?: string;
  apiVersion?: CallApiVersion;
  livekitProvider?: LivekitProvider;
  type: CallType;
}

export interface CallTokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  livekitProvider?: LivekitProvider;
}

export interface CallResponse {
  callId: string;
  conversationId: string;
  type: CallType;
  status: string;
  [key: string]: unknown;
}

// ==================== Socket Types ====================

export interface CallIncomingPayload {
  callId: string;
  callerId: string;
  type: CallType;
  conversationId: string;
  roomName: string;
  apiVersion?: CallApiVersion;
  livekitProvider?: LivekitProvider;
  wsUrl?: string;
}

export interface CallEndedPayload {
  callId: string;
}

export interface CallAnsweredPayload extends CallEndedPayload {
  roomName?: string;
  token?: string;
  wsUrl?: string;
  livekitProvider?: LivekitProvider;
}

// ==================== State Types ====================

export interface CallState {
  status: CallStatusValue;
  callId: string | null;
  conversationId: string | null;
  type: CallType;
  callerId: string | null;
  roomName: string | null;
  localVideoEnabled: boolean;
  localAudioEnabled: boolean;
  remoteParticipantId: string | null;
  remoteParticipantName: string | null;
  livekitProvider: LivekitProvider | null;
  wsUrl: string | null;
}

export interface CallContextValue {
  state: CallState;
  startCall: (
    conversationId: string,
    type: CallType,
    calleeIds?: string[],
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleVideo: () => void;
  toggleAudio: () => void;
}
```

---

## 12. Flow Từ Đầu Đến Cuối

### 12.1. Flow Gọi Đi

```
1. User bấm nút gọi
   └─> startCall(conversationId, 'video')
       │
2. Gọi API POST /calls/v2
   └─> callService.createCall({...})
       │
3. Nhận response { callId, roomName, livekitProvider }
   └─> dispatch({ status: 'calling', callId })
       │
4. Tham gia socket room
   └─> callSocket.joinCall(callId)
       │
5. Hiển thị OutgoingCallModal (đang gọi...)
   └─> status === 'calling' || status === 'ringing'
       │
6. Người được gọi trả lời
   └─> Server gửi 'call:answered' qua socket
       │
7. Lấy LiveKit token
   └─> callService.getToken(callId)
       │
8. Kết nối LiveKit room
   └─> room.connect(wsUrl, token)
       │
9. Hiển thị ActiveCallView
   └─> status === 'active'
       │
10. Cuộc gọi kết thúc
    └─> User bấm nút kết thúc
        └─> endCall() → DELETE /calls/v2/:callId
            └─> Server gửi 'call:ended'
                └─> dispatch({ type: 'RESET' })
                    └─> ActiveCallView ẩn
```

### 12.2. Flow Nhận Cuộc Gọi Đến

```
1. Server gửi 'call:incoming' qua socket
   │
2. CallProvider nhận event
   └─> dispatch({ status: 'incoming', callId, ... })
       │
3. Hiển thị IncomingCallModal
   └─> User thấy modal có nút nhận/từ chối
       │
4a. User bấm Từ chối
    └─> rejectCall() → POST /calls/v2/:callId/reject
        └─> dispatch({ type: 'RESET' })

4b. User bấm Nhận cuộc gọi
    └─> acceptCall() → POST /calls/v2/:callId/answer
        │
5. Server gửi 'call:answered' qua socket
   └─> CallProvider lấy token và kết nối LiveKit
       │
6. Hiển thị ActiveCallView
   └─> Cuộc gọi bắt đầu
```

### 12.3. Flow Tự Động Nhỡ

```
1. 'call:incoming' → hiển thị modal
   │
2. Đặt setTimeout 30 giây
   └─> Nếu user không trả lời/từ chối trong 30s
       │
3. Gọi API POST /calls/v2/:callId/missed
   │
4. Server gửi 'call:missed' qua socket
   │
5. dispatch({ type: 'RESET' })
   └─> Modal ẩn
```

---

## Các File Cần Tạo

```
src/
├── services/
│   ├── api.ts                 # Axios instance với auth interceptor
│   ├── callService.ts         # REST API calls
│   └── callSocket.ts          # Socket.IO manager
├── contexts/
│   └── CallContext.tsx        # CallProvider + useCall hook
├── components/
│   └── call/
│       ├── IncomingCallModal.tsx
│       ├── OutgoingCallModal.tsx
│       └── ActiveCallView.tsx
├── types/
│   └── call.ts                # Type definitions
└── App.tsx                    # Import CallProvider + modals
```

---

## Troubleshooting Thường Gặp

### 1. Socket không kết nối được

- Kiểm tra `VITE_SOCKET_URL` đúng URL backend
- Kiểm tra token JWT còn hiệu lực
- Kiểm tra backend có hỗ trợ WebSocket không (CORS, proxy)

### 2. LiveKit token lỗi

- Token có thời hạn, cần gọi API lấy token trước khi kết nối
- Kiểm tra `LIVEKIT_API_KEY` và `LIVEKIT_API_SECRET` trong backend `.env`

### 3. Video/audio không hoạt động

- Kiểm tra trình duyệt có yêu cầu quyền truy cập camera/mic
- Kiểm tra `getUserMedia` API có được hỗ trợ
- Kiểm tra HTTPS (trình duyệt yêu cầu HTTPS cho camera/mic)

### 4. Cuộc gọi bị ngắt đột ngột

- Kiểm tra network connection
- Kiểm tra `endCall` có được gọi đúng cách
- Kiểm tra server logs để xem có lỗi gì không

### 5. Không nhận được 'call:incoming'

- Kiểm tra `callSocket.connect()` được gọi trong `useEffect`
- Kiểm tra `callSocket.onIncomingCall` được đăng ký
- Kiểm tra user đã đăng nhập và có valid token

---

## Tài Liệu Tham Khảo

- **LiveKit Client SDK:** https://docs.livekit.io/client-sdk/
- **LiveKit Server SDK:** https://docs.livekit.io/server-sdk/
- **Socket.IO Client:** https://socket.io/docs/v4/client-api/
- **LiveKit Cloud Console:** https://cloud.livekit.io/

---

## Liên Hệ Backend Team

Nếu có vấn đề về:

- API endpoints không hoạt động → Liên hệ backend
- Socket events không nhận được → Kiểm tra backend `CallSocketService`
- LiveKit token lỗi → Kiểm tra backend `LivekitService` và env vars
- Call không được log vào chat → Kiểm tra backend `CallLogService`
