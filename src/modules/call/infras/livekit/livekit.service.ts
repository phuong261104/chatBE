import { AccessToken } from 'livekit-server-sdk';
import { config } from '@share/component/config';
import { LivekitProvider } from '../../interface';

class LivekitService {
  async generateToken(
    roomName: string,
    participantId: string,
    participantName: string,
    provider: LivekitProvider = LivekitProvider.SELF_HOSTED,
  ): Promise<string> {
    const livekitConfig = this.getConfig(provider);
    const apiKey = livekitConfig.apiKey;
    const apiSecret = livekitConfig.apiSecret;
    if (!apiKey || !apiSecret) {
      throw new Error(this.getMissingCredentialsMessage(provider));
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantId,
      name: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return at.toJwt();
  }

  getWsUrl(provider: LivekitProvider = LivekitProvider.SELF_HOSTED): string {
    const wsUrl = this.getConfig(provider).wsUrl;
    if (!wsUrl) {
      throw new Error(
        provider === LivekitProvider.CLOUD
          ? 'LIVEKIT_CLOUD_WS_URL is required'
          : 'LIVEKIT_WS_URL is required',
      );
    }
    return wsUrl;
  }

  private getConfig(provider: LivekitProvider) {
    if (provider === LivekitProvider.CLOUD) {
      return config.livekit.cloud;
    }
    return config.livekit;
  }

  private getMissingCredentialsMessage(provider: LivekitProvider) {
    return provider === LivekitProvider.CLOUD
      ? 'LIVEKIT_CLOUD_API_KEY and LIVEKIT_CLOUD_API_SECRET are required'
      : 'LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required';
  }
}

export const livekitService = new LivekitService();
