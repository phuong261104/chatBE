import { AccessToken } from 'livekit-server-sdk';
import { config } from '@share/component/config';

class LivekitService {
  async generateToken(roomName: string, participantId: string, participantName: string): Promise<string> {
    const apiKey = config.livekit.apiKey;
    const apiSecret = config.livekit.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return at.toJwt();
  }

  getWsUrl(): string {
    return config.livekit.wsUrl;
  }
}

export const livekitService = new LivekitService();
