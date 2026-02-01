import type { Server } from 'socket.io';
import * as db from '../db';
import { prepareGameCards, shuffle } from './cards';
import { broadcastGameState } from '../handlers/broadcast';
import { initializeGameTimers } from '../handlers/game';

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
  // Always shuffle to ensure different words are selected each game
  let words: string[];
  if (customWords && customWords.length >= 25) {
    // Shuffle the entire word list to ensure randomization
    // prepareGameCards will select 25 random words from this shuffled list
    words = shuffle([...customWords]);
  } else {
    throw new Error('Need at least 25 custom words to start a game');
  }

  const game = await db.createGame(roomId, firstTeam);

  const cardData = prepareGameCards(words, firstTeam);
  const cards = await db.createGameCards(game.id, cardData);

  await db.updateRoomStatus(roomId, 'playing');

  const players = await db.getRoomPlayers(roomId);

  await db.createGameLog(
    game.id,
    'system',
    `Game started by ${startedByNickname}`,
    null
  );

  // Initialize timers with default settings
  initializeGameTimers(io, roomCode, roomId, {
    spymasterDuration: 120,
    operativeDuration: 180,
    firstRoundBonus: 60,
    enabled: true
  });

  // Initialize timers with default settings
  initializeGameTimers(io, roomCode, roomId, {
    spymasterDuration: 120,
    operativeDuration: 180,
    firstRoundBonus: 60,
    enabled: true
  });

  await broadcastGameState(io, roomCode, game, cards, players);
  io.to(roomCode).emit('room:statusChanged', { status: 'playing' });
  io.to(roomCode).emit('game:started', { startedBy: startedByNickname });

  return { game, cards, players };
}

