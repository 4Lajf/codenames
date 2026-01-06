import type { Server } from 'socket.io';
import * as db from '../db';
import { prepareGameCards } from './cards';
import { broadcastGameState } from '../handlers/broadcast';

export async function startGameLogic(
  io: Server, 
  roomId: string, 
  roomCode: string, 
  startedByNickname: string,
  customWords?: string[]
) {
  // Randomly determine first team (red goes first by default with 9 cards)
  const firstTeam: 'red' | 'blue' = Math.random() < 0.5 ? 'red' : 'blue';

  // Get words - use only custom words (no fallback)
  let words: string[];
  if (customWords && customWords.length >= 25) {
    words = customWords.slice(0, 25);
  } else {
    throw new Error('Need at least 25 custom words to start a game');
  }

  // Create game
  const game = await db.createGame(roomId, firstTeam);

  // Prepare and create cards
  const cardData = prepareGameCards(words, firstTeam);
  const cards = await db.createGameCards(game.id, cardData);

  // Update room status
  await db.updateRoomStatus(roomId, 'playing');

  // Get all players for broadcast
  const players = await db.getRoomPlayers(roomId);

  // Save log entry
  await db.createGameLog(
    game.id,
    'system',
    `Game started by ${startedByNickname}`,
    null
  );

  // Broadcast game started to all players
  await broadcastGameState(io, roomCode, game, cards, players);
  io.to(roomCode).emit('room:statusChanged', { status: 'playing' });
  io.to(roomCode).emit('game:started', { startedBy: startedByNickname });

  return { game, cards, players };
}

