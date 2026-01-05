import type { Server, Socket } from 'socket.io';
import { verifyToken, type TokenPayload } from './auth';
import { handleRoomEvents, handlePlayerLeaveRoom } from './handlers/room';
import { handleGameEvents } from './handlers/game';

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    try {
      const player = verifyToken(token);
      socket.data.player = player;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const player = socket.data.player as TokenPayload;
    console.log(`[Socket] Player connected: ${player.nickname} (${socket.id})`);
    
    // Setup event handlers
    handleRoomEvents(io, socket);
    handleGameEvents(io, socket);
    
    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] Player disconnected: ${player.nickname} (${reason})`);
      
      // If player was in a room, handle leaving
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (roomId && roomCode) {
        try {
          await handlePlayerLeaveRoom(io, socket, player, roomId, roomCode);
        } catch (error) {
          console.error('[Socket] Error handling disconnect:', error);
        }
      }
    });

    // Ping/pong for connection testing
    socket.on('ping', (callback) => {
      callback({ pong: true, time: Date.now() });
    });
  });
}

