# LiveKit self-host setup

## Local

1. Copy `livekit/.env.example` to `livekit/.env`.
2. Make sure backend `.env` uses the same `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_WS_URL=ws://localhost:7880`.
3. Run from `livekit/`:

```bash
docker compose up -d
```

`livekit/.env.example` selects `config.local.yml`, `127.0.0.1`, and UDP ports `30100-30400`.
If `LIVEKIT_CONFIG_FILE` is not set, `docker-compose.yml` falls back to the existing `config.yml`.

## Production

1. Copy `config.prod.example.yml` to `config.prod.yml`.
2. Replace the LiveKit key/secret in `config.prod.yml`.
3. Set `livekit/.env`:

```env
LIVEKIT_CONFIG_FILE=config.prod.yml
LIVEKIT_NODE_IP=<public-server-ip>
LIVEKIT_WS_URL=wss://call.example.com
```

4. Set backend `.env` with the same key/secret and `LIVEKIT_WS_URL=wss://call.example.com`.
5. Open/firewall these ports on the server: `7880/tcp`, `7882/udp`, `30100-30400/udp`.
6. Terminate TLS at a reverse proxy for the public `wss://` domain and proxy to LiveKit `7880`.
