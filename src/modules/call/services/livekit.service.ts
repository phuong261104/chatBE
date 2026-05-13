import { AccessToken } from 'livekit-server-sdk';

class LivekitService {
  async generateToken(roomName: string, participantId: string, participantName: string): Promise<string> {
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return at.toJwt();
  }

  getWsUrl(): string {
    return process.env.LIVEKIT_WS_URL || 'ws://localhost:7880';
  }
}

export const livekitService = new LivekitService();
