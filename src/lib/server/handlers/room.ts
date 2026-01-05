import type { Server, Socket } from 'socket.io';
import * as db from '../db';
import type { TokenPayload } from '../auth';

// Room event handlers
export function handleRoomEvents(io: Server, socket: Socket) {
  const player = socket.data.player as TokenPayload;

  // Create a new room
  socket.on('room:create', async ({ code }: { code: string }, callback) => {
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

      // Get room players
      const players = await db.getRoomPlayers(room.id);

      callback({ 
        success: true, 
        room: {
          code: room.code,
          status: room.status,
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

      if (room.status !== 'waiting') {
        return callback({ error: 'Game already in progress' });
      }

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
          hostId: host?.player_id === player.id ? player.publicId : (host?.player_id || ''),
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

      // Check if spymaster role is available
      if (role === 'spymaster') {
        const spymasterTaken = await db.isSpymasterTaken(roomId, roomPlayer.team);
        if (spymasterTaken) {
          return callback({ error: 'Spymaster role is already taken' });
        }
      }

      await db.setTeamAndRole(roomId, player.id, roomPlayer.team, role);

      // Broadcast updated room state
      const players = await db.getRoomPlayers(roomId);
      io.to(roomCode).emit('room:updated', {
        players: formatPlayersForClient(players, player.id)
      });

      callback({ success: true });
    } catch (error: any) {
      console.error('room:changeRole error:', error);
      callback({ error: error.message || 'Failed to change role' });
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
      hostId: newHost.player_id
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
    id: rp.player_id === currentPlayerId ? rp.player_id : rp.player_id,
    nickname: rp.nickname,
    team: rp.team,
    role: rp.role
  };
}

function formatPlayersForClient(players: db.RoomPlayerWithDetails[], currentPlayerId: string) {
  return players.map(p => formatPlayerForClient(p, currentPlayerId));
}

