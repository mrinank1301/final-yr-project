import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'LiveKit server is running' });
});

// Generate LiveKit token endpoint
app.post('/api/token', async (req: Request, res: Response) => {
  try {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ 
        error: 'roomName and participantName are required' 
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ 
        error: 'Server configuration error: Missing LiveKit credentials' 
      });
    }

    // Create access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: '10h', // Token valid for 10 hours
    });

    // Grant permissions
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    res.json({
      token,
      url: process.env.LIVEKIT_URL,
      roomName,
      participantName,
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create or get room endpoint
app.post('/api/room', async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'roomName is required' });
    }

    // In a production app, you might want to create the room using RoomServiceClient
    // For now, we'll just return the room name
    res.json({
      roomName,
      url: process.env.LIVEKIT_URL,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ 
      error: 'Failed to create room',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 LiveKit server running on http://localhost:${PORT}`);
  console.log(`📡 LiveKit URL: ${process.env.LIVEKIT_URL}`);
});

