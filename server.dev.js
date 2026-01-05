// Development Socket.IO server (runs alongside Vite dev server)
// IMPORTANT: Load dotenv FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Verify required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('[Dev Server] Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('\nPlease create a .env file with these variables.');
  console.error('See src/lib/server/env.example.txt for reference.\n');
  process.exit(1);
}

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup with CORS for Vite dev server
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Dynamically import socket handlers (after env vars are loaded)
async function setupSocket() {
  try {
    // Use tsx to run TypeScript directly
    const { setupSocketHandlers } = await import('./src/lib/server/socket.ts');
    setupSocketHandlers(io);
    console.log('[Dev Server] Socket.IO handlers initialized');
  } catch (error) {
    console.error('[Dev Server] Failed to setup socket handlers:', error);
    process.exit(1);
  }
}

setupSocket();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: 'development' });
});

// API routes need to be proxied from Vite, but session API can run here too
app.use(express.json());

// Session API endpoint for dev mode
app.post('/api/session', async (req, res) => {
  try {
    const { createPlayer, getPlayerByPublicId, updatePlayerNickname } = await import('./src/lib/server/db/index.ts');
    const { generateToken } = await import('./src/lib/server/auth.ts');
    
    const { nickname, publicId } = req.body;
    let player;
    
    if (publicId) {
      player = await getPlayerByPublicId(publicId);
      if (!player) {
        if (!nickname) {
          return res.status(400).json({ error: 'Nickname required for new player' });
        }
        player = await createPlayer(nickname);
      } else if (nickname && nickname !== player.nickname) {
        await updatePlayerNickname(player.id, nickname);
        player.nickname = nickname;
      }
    } else {
      if (!nickname) {
        return res.status(400).json({ error: 'Nickname required' });
      }
      player = await createPlayer(nickname);
    }

    const token = generateToken(player);
    res.json({
      token,
      player: { id: player.public_id, nickname: player.nickname }
    });
  } catch (error) {
    console.error('Session API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Room API endpoint for dev mode
app.get('/api/room/:code', async (req, res) => {
  try {
    const { getRoomByCode, getRoomPlayerCount } = await import('./src/lib/server/db/index.ts');
    const room = await getRoomByCode(req.params.code.toUpperCase());
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const playerCount = await getRoomPlayerCount(room.id);
    res.json({ code: room.code, status: room.status, playerCount });
  } catch (error) {
    console.error('Room API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`[Dev Server] Socket.IO server running on http://localhost:${PORT}`);
  console.log(`[Dev Server] Waiting for connections from Vite (http://localhost:5173)`);
});

