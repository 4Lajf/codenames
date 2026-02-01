import type { Server, Socket } from 'socket.io';
import * as db from '../db';
import type { TokenPayload } from '../auth';
import { broadcastGameState } from './broadcast';
import { startGameLogic } from '../game/logic';
import { cleanupRoomData } from './game';

// Room event handlers
export function handleRoomEvents(io: Server, socket: Socket) {
  const player = socket.data.player as TokenPayload;

  // Create a new room
  socket.on('room:create', async ({ code, customWords }: { code: string; customWords?: string[] }, callback) => {
    try {
      const existingRoom = await db.getRoomByCode(code);
      if (existingRoom) {
        return callback({ error: 'Room code already in use' });
      }

      const room = await db.createRoom(code, player.id);
      
      // No need to check for duplicate nickname when creating a room (first player)
      await db.joinRoom(room.id, player.id);
      
      socket.data.roomId = room.id;
      socket.data.roomCode = room.code;
      
      socket.join(room.code);

      // Automatically start game for new rooms
      await startGameLogic(io, room.id, room.code, player.nickname, customWords);

      const players = await db.getRoomPlayers(room.id);

      callback({ 
        success: true, 
        room: {
          code: room.code,
          status: 'playing', // Room status is now 'playing' immediately
          hostId: player.publicId,
          players: formatPlayersForClient(players, player.id)
        }
      });
    } catch (error: any) {
      console.error('room:create error:', error);
      callback({ error: error.message || 'Failed to create room' });
    }
  });

  // Join an existing room
  socket.on('room:join', async ({ code }: { code: string }, callback) => {
    try {
      // Find room
      const room = await db.getRoomByCode(code);
      if (!room) {
        return callback({ error: 'Room not found' });
      }
      // Allow joining rooms in any status (waiting / playing / finished)

      await db.joinRoom(room.id, player.id);
      
      socket.data.roomId = room.id;
      socket.data.roomCode = room.code;
      
      socket.join(room.code);

      const players = await db.getRoomPlayers(room.id);

      socket.to(room.code).emit('room:playerJoined', {
        player: formatPlayerForClient(
          players.find(p => p.player_id === player.id)!,
          player.id
        )
      });

      const host = players.find(p => p.player_id === room.host_player_id);

      callback({ 
        success: true, 
        room: {
          code: room.code,
          status: room.status,
          hostId: host?.public_id || '',
          players: formatPlayersForClient(players, player.id)
        }
      });
    } catch (error: any) {
      console.error('room:join error:', error);
      callback({ error: error.message || 'Failed to join room' });
    }
  });

  // Leave current room
  socket.on('room:leave', async (data, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback?.({ error: 'Not in a room' });
      }

      await handlePlayerLeaveRoom(io, socket, player, roomId, roomCode);
      
      callback?.({ success: true });
    } catch (error: any) {
      console.error('room:leave error:', error);
      callback?.({ error: error.message || 'Failed to leave room' });
    }
  });

  // Change team
  socket.on('room:changeTeam', async ({ team }: { team: 'red' | 'blue' | null }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // If changing team, reset role to operative (or null if leaving team)
      const role = team ? 'operative' : null;
      
      await db.setTeamAndRole(roomId, player.id, team, role);

      // Broadcast updated room state
      const players = await db.getRoomPlayers(roomId);
      io.to(roomCode).emit('room:updated', {
        players: formatPlayersForClient(players, player.id)
      });

      // If a game is in progress, rebroadcast game state so spectators/spymasters get correct visibility
      const room = await db.getRoomById(roomId);
      if (room && room.status !== 'waiting') {
        const game = await db.getGameByRoomId(roomId);
        if (game) {
          const cards = await db.getGameCards(game.id);
          await broadcastGameState(io, roomCode, game, cards, players);
        }
      }

      callback({ success: true });
    } catch (error: any) {
      console.error('room:changeTeam error:', error);
      callback({ error: error.message || 'Failed to change team' });
    }
  });

  // Change role (become spymaster)
  socket.on('room:changeRole', async ({ role }: { role: 'spymaster' | 'operative' }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get current player's room data
      const roomPlayer = await db.getRoomPlayer(roomId, player.id);
      if (!roomPlayer) {
        return callback({ error: 'Not in room' });
      }

      if (!roomPlayer.team) {
        return callback({ error: 'Must join a team first' });
      }

      // Multiple spymasters are now allowed

      await db.setTeamAndRole(roomId, player.id, roomPlayer.team, role);

      const players = await db.getRoomPlayers(roomId);
      io.to(roomCode).emit('room:updated', {
        players: formatPlayersForClient(players, player.id)
      });

      // If a game is in progress, rebroadcast game state so role visibility updates immediately
      const room = await db.getRoomById(roomId);
      if (room && room.status !== 'waiting') {
        const game = await db.getGameByRoomId(roomId);
        if (game) {
          const cards = await db.getGameCards(game.id);
          await broadcastGameState(io, roomCode, game, cards, players);
        }
      }

      callback({ success: true });
    } catch (error: any) {
      console.error('room:changeRole error:', error);
      callback({ error: error.message || 'Failed to change role' });
    }
  });

  // Randomize teams
  socket.on('room:randomizeTeams', async (data, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Check if player is host
      const room = await db.getRoomById(roomId);
      if (!room || room.host_player_id !== player.id) {
        return callback({ error: 'Only host can randomize teams' });
      }

      // Get all players
      const players = await db.getRoomPlayers(roomId);
      
      if (players.length < 4) {
        return callback({ error: 'Need at least 4 players to randomize teams' });
      }

      // Shuffle players
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      
      // Split into two teams
      const midpoint = Math.ceil(shuffled.length / 2);
      const redTeam = shuffled.slice(0, midpoint);
      const blueTeam = shuffled.slice(midpoint);

      // Assign teams and roles - everyone becomes an operative
      for (let i = 0; i < redTeam.length; i++) {
        await db.setTeamAndRole(
          roomId, 
          redTeam[i].player_id, 
          'red', 
          'operative'
        );
      }

      for (let i = 0; i < blueTeam.length; i++) {
        await db.setTeamAndRole(
          roomId, 
          blueTeam[i].player_id, 
          'blue', 
          'operative'
        );
      }

      // Broadcast updated room state
      const updatedPlayers = await db.getRoomPlayers(roomId);
      io.to(roomCode).emit('room:updated', {
        players: formatPlayersForClient(updatedPlayers, player.id)
      });

      // If a game is in progress, rebroadcast game state to reflect new teams/roles
      if (room.status !== 'waiting') {
        const game = await db.getGameByRoomId(roomId);
        if (game) {
          const cards = await db.getGameCards(game.id);
          await broadcastGameState(io, roomCode, game, cards, updatedPlayers);
        }
      }

      callback({ success: true });
    } catch (error: any) {
      console.error('room:randomizeTeams error:', error);
      callback({ error: error.message || 'Failed to randomize teams' });
    }
  });

  // Transfer host
  socket.on('room:transferHost', async ({ playerId }: { playerId: string }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Check if player is host
      const room = await db.getRoomById(roomId);
      if (!room || room.host_player_id !== player.id) {
        return callback({ error: 'Only host can transfer host role' });
      }

      // Get all players and find target by public_id
      const players = await db.getRoomPlayers(roomId);
      const targetPlayer = players.find(p => p.public_id === playerId);
      if (!targetPlayer) {
        return callback({ error: 'Target player not in room' });
      }

      // Transfer host using internal player_id
      await db.updateRoomHost(roomId, targetPlayer.player_id);

      // Broadcast host change using public_id
      io.to(roomCode).emit('room:hostChanged', {
        hostId: targetPlayer.public_id
      });

      callback({ success: true });
    } catch (error: any) {
      console.error('room:transferHost error:', error);
      callback({ error: error.message || 'Failed to transfer host' });
    }
  });

  // Kick player
  socket.on('room:kickPlayer', async ({ playerId }: { playerId: string }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Check if player is host
      const room = await db.getRoomById(roomId);
      if (!room || room.host_player_id !== player.id) {
        return callback({ error: 'Only host can kick players' });
      }

      // Get all players and find target by public_id
      const players = await db.getRoomPlayers(roomId);
      const targetPlayer = players.find(p => p.public_id === playerId);
      if (!targetPlayer) {
        return callback({ error: 'Target player not in room' });
      }

      // Cannot kick yourself
      if (targetPlayer.player_id === player.id) {
        return callback({ error: 'Cannot kick yourself' });
      }

      // Find the socket of the player to kick
      const socketsInRoom = await io.in(roomCode).fetchSockets();
      const targetSocket = socketsInRoom.find(s => s.data.player?.id === targetPlayer.player_id);

      if (targetSocket) {
        // Notify the kicked player
        targetSocket.emit('room:kicked', { reason: 'You have been kicked by the host' });
        
        // Remove player from room
        await db.leaveRoom(roomId, targetPlayer.player_id);
        
        // Make them leave the socket room
        targetSocket.leave(roomCode);
        targetSocket.data.roomId = null;
        targetSocket.data.roomCode = null;
      } else {
        // Player is not connected, just remove from database
        await db.leaveRoom(roomId, targetPlayer.player_id);
      }

      // Get updated players list
      const updatedPlayers = await db.getRoomPlayers(roomId);

      // If no players left, delete the room
      if (updatedPlayers.length === 0) {
        // Get game info before deletion for cleanup
        const game = await db.getGameByRoomId(roomId);
        
        // Clean up in-memory timers and cache
        if (game) {
          cleanupRoomData(roomCode, game.id);
        } else {
          cleanupRoomData(roomCode);
        }
        
        // Delete the room - cascade will handle:
        // - room_players (via ON DELETE CASCADE)
        // - games (via ON DELETE CASCADE)
        // - cards (via ON DELETE CASCADE through games)
        // - game_logs (via ON DELETE CASCADE through games)
        try {
          await db.deleteRoom(roomId);
          console.log(`[Room] Room ${roomCode} deleted - all players kicked/disconnected`);
        } catch (error) {
          console.error(`[Room] Failed to delete room ${roomCode}:`, error);
          throw error;
        }
        callback({ success: true });
        return;
      }

      // Broadcast updated players list
      io.to(roomCode).emit('room:updated', {
        players: formatPlayersForClient(updatedPlayers, player.id)
      });

      // Broadcast that player left
      io.to(roomCode).emit('room:playerLeft', {
        playerId: targetPlayer.public_id,
        players: formatPlayersForClient(updatedPlayers, player.id)
      });

      callback({ success: true });
    } catch (error: any) {
      console.error('room:kickPlayer error:', error);
      callback({ error: error.message || 'Failed to kick player' });
    }
  });
}

// Handle player disconnection
export async function handlePlayerLeaveRoom(
  io: Server,
  socket: Socket,
  player: TokenPayload,
  roomId: string,
  roomCode: string
) {
  await db.leaveRoom(roomId, player.id);
  
  socket.leave(roomCode);
  
  socket.data.roomId = null;
  socket.data.roomCode = null;

  const room = await db.getRoomById(roomId);
  if (!room) return;

  const remainingPlayers = await db.getRoomPlayers(roomId);

  if (remainingPlayers.length === 0) {
    // Get game info before deletion for cleanup
    const game = await db.getGameByRoomId(roomId);
    
    // Clean up in-memory timers and cache
    if (game) {
      cleanupRoomData(roomCode, game.id);
    } else {
      cleanupRoomData(roomCode);
    }
    
    // Delete the room - cascade will handle:
    // - room_players (via ON DELETE CASCADE)
    // - games (via ON DELETE CASCADE)
    // - cards (via ON DELETE CASCADE through games)
    // - game_logs (via ON DELETE CASCADE through games)
    try {
      await db.deleteRoom(roomId);
      console.log(`[Room] Room ${roomCode} deleted - all players disconnected`);
    } catch (error) {
      console.error(`[Room] Failed to delete room ${roomCode}:`, error);
      throw error;
    }
    return;
  }

  if (room.host_player_id === player.id) {
    const newHost = remainingPlayers[0];
    await db.updateRoomHost(roomId, newHost.player_id);
    
    io.to(roomCode).emit('room:hostChanged', {
      hostId: newHost.public_id
    });
  }

  io.to(roomCode).emit('room:playerLeft', {
    playerId: player.publicId,
    players: formatPlayersForClient(remainingPlayers, '')
  });
}

// Helper to format player data for client
function formatPlayerForClient(rp: db.RoomPlayerWithDetails, currentPlayerId: string) {
  return {
    id: rp.public_id,
    nickname: rp.nickname,
    team: rp.team,
    role: rp.role
  };
}

function formatPlayersForClient(players: db.RoomPlayerWithDetails[], currentPlayerId: string) {
  return players.map(p => formatPlayerForClient(p, currentPlayerId));
}

