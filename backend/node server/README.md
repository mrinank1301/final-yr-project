# LiveKit Node Server

TypeScript backend for video calling application.

## Setup

```bash
npm install
```

Create `.env` file:
```env
PORT=3001
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://localhost:7880
```

## Run

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

**GET /health** - Health check

**POST /api/token** - Generate LiveKit access token
```json
{
  "roomName": "my-room",
  "participantName": "John Doe"
}
```

**POST /api/room** - Create/get room
```json
{
  "roomName": "my-room"
}
```

## Configuration

- `PORT` - Server port (default: 3001)
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret
- `LIVEKIT_URL` - LiveKit server URL

## Production

For production, use LiveKit Cloud or generate secure credentials:

```bash
openssl rand -hex 16  # API Key
openssl rand -hex 32  # API Secret
```

---

See main [README.md](../../README.md) for complete setup.
