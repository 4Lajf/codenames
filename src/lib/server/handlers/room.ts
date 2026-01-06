import type { Server, Socket } from 'socket.io';
import * as db from '../db';
import type { TokenPayload } from '../auth';
import { broadcastGameState } from './broadcast';
import { startGameLogic } from '../game/logic';

// Room event handlers
export function handleRoomEvents(io: Server, socket: Socket) {
  const player = socket.data.player as TokenPayload;

  // Create a new room
  socket.on('room:create', async ({ code, customWords }: { code: string; customWords?: string[] }, callback) => {
    try {
      // Check if room code already exists
      const existingRoom = await db.getRoomByCode(code);
      if (existingRoom) {
        return callback({ error: 'Room code already in use' });
      }

      // Create room
      const room = await db.createRoom(code, player.id);
      
      // Add player to room
      await db.joinRoom(room.id, player.id);
      
      // Store room info in socket data
      socket.data.roomId = room.id;
      socket.data.roomCode = room.code;
      
      // Join socket to room channel
      socket.join(room.code);

      // Automatically start game for new rooms
      await startGameLogic(io, room.id, room.code, player.nickname, customWords);

      // Get room players
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

      // Add player to room
      await db.joinRoom(room.id, player.id);
      
      // Store room info in socket data
      socket.data.roomId = room.id;
      socket.data.roomCode = room.code;
      
      // Join socket to room channel
      socket.join(room.code);

      // Get updated player list
      const players = await db.getRoomPlayers(room.id);

      // Broadcast to room that player joined
      socket.to(room.code).emit('room:playerJoined', {
        player: formatPlayerForClient(
          players.find(p => p.player_id === player.id)!,
          player.id
        )
      });

      // Get host info
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

      // Broadcast updated room state
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
}

// Handle player disconnection
export async function handlePlayerLeaveRoom(
  io: Server,
  socket: Socket,
  player: TokenPayload,
  roomId: string,
  roomCode: string
) {
  // Remove player from room
  await db.leaveRoom(roomId, player.id);
  
  // Leave socket room
  socket.leave(roomCode);
  
  // Clear socket data
  socket.data.roomId = null;
  socket.data.roomCode = null;

  // Get room info
  const room = await db.getRoomById(roomId);
  if (!room) return;

  // Get remaining players
  const remainingPlayers = await db.getRoomPlayers(roomId);

  // If room is empty, delete it
  if (remainingPlayers.length === 0) {
    await db.deleteRoom(roomId);
    return;
  }

  // If host left, assign new host
  if (room.host_player_id === player.id) {
    const newHost = remainingPlayers[0];
    await db.updateRoomHost(roomId, newHost.player_id);
    
    io.to(roomCode).emit('room:hostChanged', {
      hostId: newHost.public_id
    });
  }

  // Broadcast that player left
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

