import type { Server } from 'socket.io';
import type { Game, Card } from '../database.types';
import type { RoomPlayerWithDetails } from '../db';
import type { TokenPayload } from '../auth';

/**
 * Broadcast game state to all players in a room
 * Cards are masked based on player role
 */
export function broadcastGameState(
  io: Server, 
  roomCode: string, 
  game: Game, 
  cards: Card[], 
  players: RoomPlayerWithDetails[]
) {
  const room = io.sockets.adapter.rooms.get(roomCode);
  if (!room) return;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    const socketPlayer = socket.data.player as TokenPayload;
    const roomPlayer = players.find(p => p.player_id === socketPlayer.id);
    const isSpymaster = roomPlayer?.role === 'spymaster';

    // Mask card types for non-spymasters
    const maskedCards = cards.map(card => ({
      ...card,
      type: (isSpymaster || card.revealed || game.winner) ? card.type : 'hidden'
    }));

    socket.emit('game:state', {
      status: game.winner ? 'finished' : 'playing',
      currentTurn: game.current_turn,
      clue: game.clue_word ? { word: game.clue_word, count: game.clue_count } : null,
      guessesRemaining: game.guesses_remaining || 0,
      scores: calculateScores(game),
      winner: game.winner,
      cards: maskedCards.map(c => ({
        word: c.word,
        type: c.type,
        revealed: c.revealed,
        position: c.position
      })),
      players: players.map(p => ({
        id: p.player_id,
        nickname: p.nickname,
        team: p.team,
        role: p.role
      }))
    });
  }
}

/**
 * Calculate current scores from remaining cards
 */
function calculateScores(game: Game): { red: number; blue: number } {
  // Starting cards: first team has 9, second has 8
  const redStart = game.red_cards_remaining <= 9 ? 9 : 8;
  const blueStart = game.blue_cards_remaining <= 8 ? 8 : 9;
  
  return {
    red: redStart - game.red_cards_remaining,
    blue: blueStart - game.blue_cards_remaining
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
      id: p.player_id,
      nickname: p.nickname,
      team: p.team,
      role: p.role
    }))
  });
}

