// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

// Verify required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('[Server] Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('\nPlease create a .env file with these variables.');
  console.error('See src/lib/server/env.example.txt for reference.\n');
  process.exit(1);
}

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handler } from './build/handler.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.PUBLIC_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectionStateRecovery: {
    // Enable connection state recovery
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Dynamically import socket handlers (ESM)
async function setupSocket() {
  try {
    const { setupSocketHandlers } = await import('./src/lib/server/socket.js');
    setupSocketHandlers(io);
    console.log('[Server] Socket.IO handlers initialized');
  } catch (error) {
    console.error('[Server] Failed to setup socket handlers:', error);
  }
}

// Setup socket handlers
setupSocket();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SvelteKit handler for all other routes
app.use(handler);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Socket.IO ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

