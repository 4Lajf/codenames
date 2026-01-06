import type { Server } from 'socket.io';
import type { Game, Card } from '../database.types';
import type { RoomPlayerWithDetails } from '../db';
import type { TokenPayload } from '../auth';
import * as db from '../db';

/**
 * Broadcast game state to all players in a room
 * Cards are masked based on player role
 */
export async function broadcastGameState(
  io: Server, 
  roomCode: string, 
  game: Game, 
  cards: Card[], 
  players: RoomPlayerWithDetails[]
) {
  const room = io.sockets.adapter.rooms.get(roomCode);
  if (!room) return;

  // Get logs for this game
  const logs = await db.getGameLogs(game.id);

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    const socketPlayer = socket.data.player as TokenPayload;
    const roomPlayer = players.find(p => p.player_id === socketPlayer.id);
    // Only spymasters can see all cards - unassigned players see hidden cards
    const canSeeAll = roomPlayer?.role === 'spymaster';

    // Mask card types for non-spymasters
    const maskedCards = cards.map(card => ({
      ...card,
      type: (canSeeAll || card.revealed || game.winner) ? card.type : 'hidden'
    }));

    socket.emit('game:state', {
      status: game.winner ? 'finished' : 'playing',
      currentTurn: game.current_turn,
      clue: game.clue_word ? { word: game.clue_word, count: game.clue_count } : null,
      guessesRemaining: game.guesses_remaining || 0,
      // Remaining cards needed to win (counts down)
      scores: calculateRemaining(game),
      winner: game.winner,
      cards: maskedCards.map(c => ({
        word: c.word,
        type: c.type,
        revealed: c.revealed,
        position: c.position
      })),
      players: players.map(p => ({
        id: p.public_id,
        nickname: p.nickname,
        team: p.team,
        role: p.role
      })),
      log: logs
    });
  }
}

/**
 * Remaining cards needed to win (counts down)
 */
function calculateRemaining(game: Game): { red: number; blue: number } {
  return {
    red: game.red_cards_remaining,
    blue: game.blue_cards_remaining
  };
}

/**
 * Broadcast room update to all players in room
 */
export function broadcastRoomUpdate(
  io: Server,
  roomCode: string,
  players: RoomPlayerWithDetails[]
) {
  io.to(roomCode).emit('room:updated', {
    players: players.map(p => ({
      id: p.public_id,
      nickname: p.nickname,
      team: p.team,
      role: p.role
    }))
  });
}

