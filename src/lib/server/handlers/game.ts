import type { Server, Socket } from 'socket.io';
import * as db from '../db';
import type { TokenPayload } from '../auth';
import type { Card, Game } from '../database.types';
import { prepareGameCards, calculateRemainingCards } from '../game/cards';
import { 
  canStartGame, 
  validateClueWord, 
  validateClueCount,
  isCurrentSpymaster,
  isCurrentOperative,
  isOnCurrentTeam
} from '../game/validation';
import { broadcastGameState } from './broadcast';
import { startGameLogic } from '../game/logic';

// In-memory cache for card markers (in production, store in database)
const cardMarkersCache: Record<string, Record<number, Array<{ playerId: string; nickname: string; team: 'red' | 'blue' | null }>>> = {};

// In-memory storage for game timers (roomCode -> timer state)
interface TeamTimer {
  timeRemaining: number; // seconds, can be negative
  isPaused: boolean;
  isFirstRound: boolean;
}

interface TimerSettings {
  spymasterDuration: number;
  operativeDuration: number;
  firstRoundBonus: number;
  enabled: boolean;
}

const gameTimers: Record<string, {
  settings: TimerSettings;
  timers: {
    red: TeamTimer;
    blue: TeamTimer;
  };
  roomId: string; // Store roomId for quick access
}> = {};

// Room to game cache for timer ticks
const roomGameCache: Record<string, { game: Game | null; expires: number }> = {};
const CACHE_TTL = 2000; // 2 seconds

async function getGameForRoom(roomCode: string): Promise<Game | null> {
  const cached = roomGameCache[roomCode];
  if (cached && cached.expires > Date.now()) {
    return cached.game;
  }
  
  try {
    const room = await db.getRoomByCode(roomCode);
    if (!room) {
      roomGameCache[roomCode] = { game: null, expires: Date.now() + CACHE_TTL };
      return null;
    }
    
    const game = await db.getGameByRoomId(room.id);
    roomGameCache[roomCode] = {
      game: game || null,
      expires: Date.now() + CACHE_TTL
    };
    return game || null;
  } catch {
    roomGameCache[roomCode] = { game: null, expires: Date.now() + CACHE_TTL };
    return null;
  }
}

// Timer tick interval (runs every second)
let timerInterval: NodeJS.Timeout | null = null;

function startTimerTick(io: Server) {
  if (timerInterval) return; // Already running
  
  timerInterval = setInterval(async () => {
    for (const [roomCode, timerData] of Object.entries(gameTimers)) {
      if (!timerData.settings.enabled) continue;
      
      const room = io.sockets.adapter.rooms.get(roomCode);
      if (!room || room.size === 0) continue;
      
      const game = await getGameForRoom(roomCode);
      if (!game || game.winner) continue;
      
      const currentTeam = game.current_turn;
      const timer = timerData.timers[currentTeam];
      
      if (!timer.isPaused && timer.timeRemaining > -999999) {
        timer.timeRemaining -= 1;
        
        // Broadcast timer update to all clients
        io.to(roomCode).emit('game:timerUpdate', {
          team: currentTeam,
          timeRemaining: timer.timeRemaining,
          isPaused: timer.isPaused
        });
      }
    }
  }, 1000);
}

// Initialize timers for a game
function initializeGameTimers(io: Server, roomCode: string, roomId: string, settings: TimerSettings) {
  const spymasterDuration = settings.spymasterDuration + settings.firstRoundBonus;
  
  gameTimers[roomCode] = {
    settings,
    timers: {
      red: {
        timeRemaining: spymasterDuration,
        isPaused: true,
        isFirstRound: true
      },
      blue: {
        timeRemaining: spymasterDuration,
        isPaused: true,
        isFirstRound: true
      }
    },
    roomId
  };
  
  // Start timer tick if not already running
  startTimerTick(io);
}

// Get timer state for a room
function getTimerState(roomCode: string): { settings: TimerSettings; timers: { red: TeamTimer; blue: TeamTimer } } | null {
  return gameTimers[roomCode] || null;
}

// Export timer functions and cleanup functions for use in other modules
export { initializeGameTimers, getTimerState };

// Export cleanup function for room deletion
export function cleanupRoomData(roomCode: string, gameId?: string) {
  // Clean up timers
  if (gameTimers[roomCode]) {
    delete gameTimers[roomCode];
  }
  // Clean up room game cache
  if (roomGameCache[roomCode]) {
    delete roomGameCache[roomCode];
  }
  // Clean up card markers cache if gameId provided
  if (gameId && cardMarkersCache[gameId]) {
    delete cardMarkersCache[gameId];
  }
}

// Game event handlers
export function handleGameEvents(io: Server, socket: Socket) {
  const player = socket.data.player as TokenPayload;

  // Start the game (host only)
  socket.on('game:start', async (data: { customWords?: string[]; autoStart?: boolean }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get room and verify host
      const room = await db.getRoomById(roomId);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      if (room.host_player_id !== player.id) {
        return callback({ error: 'Only the host can start the game' });
      }

      if (room.status !== 'waiting') {
        return callback({ error: 'Game already started' });
      }

      // Get players
      const players = await db.getRoomPlayers(roomId);
      
      // Only validate team composition if not auto-starting
      if (!data?.autoStart) {
        const validation = canStartGame(players);
        if (!validation.valid) {
          return callback({ error: validation.error });
        }
      }

      await startGameLogic(io, roomId, roomCode, player.nickname, data?.customWords);

      callback({ success: true });
    } catch (error: any) {
      console.error('game:start error:', error);
      callback({ error: error.message || 'Failed to start game' });
    }
  });

  // Give a clue (spymaster only)
  socket.on('game:giveClue', async ({ word, count }: { word: string; count: number }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get game
      const game = await db.getGameByRoomId(roomId);
      if (!game) {
        return callback({ error: 'Game not found' });
      }

      if (game.winner) {
        return callback({ error: 'Game is already over' });
      }

      // Get players
      const players = await db.getRoomPlayers(roomId);

      // Verify player is current team's spymaster
      if (!isCurrentSpymaster(player.id, game.current_turn, players)) {
        return callback({ error: 'Only the current team\'s spymaster can give clues' });
      }

      // Check if there's already an active clue
      if (game.clue_word) {
        return callback({ error: 'A clue has already been given this turn' });
      }

      // Get cards and validate clue word
      const cards = await db.getGameCards(game.id);
      const boardWords = cards.map(c => c.word);
      
      const wordValidation = validateClueWord(word, boardWords);
      if (!wordValidation.valid) {
        return callback({ error: wordValidation.error });
      }

      const countValidation = validateClueCount(count);
      if (!countValidation.valid) {
        return callback({ error: countValidation.error });
      }

      // Update game with clue
      // If count is 0, set guesses_remaining to 999 (unlimited) instead of 1
      const guessesRemaining = count === 0 ? 999 : count + 1; // +1 bonus guess (or unlimited if 0)
      
      const updatedGame = await db.updateGameState(game.id, {
        clue_word: word.toUpperCase(),
        clue_count: count,
        guesses_remaining: guessesRemaining
      });

      // Start operative timer when clue is given
      if (gameTimers[roomCode] && gameTimers[roomCode].settings.enabled) {
        const timer = gameTimers[roomCode].timers[game.current_turn];
        const settings = gameTimers[roomCode].settings;
        const duration = timer.isFirstRound 
          ? settings.operativeDuration + settings.firstRoundBonus
          : settings.operativeDuration;
        
        timer.timeRemaining = duration;
        timer.isPaused = false;
        
        io.to(roomCode).emit('game:timerUpdate', {
          team: game.current_turn,
          timeRemaining: timer.timeRemaining,
          isPaused: timer.isPaused
        });
      }

      // Save log entry
      await db.createGameLog(
        game.id,
        'clue',
        `${player.nickname} gives clue: ${word.toUpperCase()} ${count}`,
        game.current_turn
      );

      // Broadcast clue to all players
      io.to(roomCode).emit('game:clueGiven', {
        word: word.toUpperCase(),
        count,
        team: game.current_turn,
        spymasterName: player.nickname
      });

      // Broadcast updated game state
      await broadcastGameState(io, roomCode, updatedGame, cards, players);

      callback({ success: true });
    } catch (error: any) {
      console.error('game:giveClue error:', error);
      callback({ error: error.message || 'Failed to give clue' });
    }
  });

  // Guess a card (operative only)
  socket.on('game:guessCard', async ({ cardPosition }: { cardPosition: number }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get game
      const game = await db.getGameByRoomId(roomId);
      if (!game) {
        return callback({ error: 'Game not found' });
      }

      if (game.winner) {
        return callback({ error: 'Game is already over' });
      }

      // Get players
      const players = await db.getRoomPlayers(roomId);

      // Verify player is on current team (operatives can guess)
      if (!isOnCurrentTeam(player.id, game.current_turn, players)) {
        return callback({ error: 'Not your team\'s turn' });
      }

      // Check if clue has been given
      if (!game.clue_word) {
        return callback({ error: 'Wait for the spymaster to give a clue' });
      }

      // Check guesses remaining (but allow unlimited guesses if 999)
      const guessesRemaining = game.guesses_remaining || 0;
      if (guessesRemaining <= 0) {
        return callback({ error: 'No guesses remaining' });
      }

      // Get card at position
      const card = await db.getCardByPosition(game.id, cardPosition);
      if (!card) {
        return callback({ error: 'Card not found' });
      }

      if (card.revealed) {
        return callback({ error: 'Card already revealed' });
      }

      // Reveal card
      const revealedCard = await db.revealCard(card.id, player.id);

      // Process result
      const result = processGuessResult(game, revealedCard);

      // Update game state
      const updatedGame = await db.updateGameState(game.id, result.gameUpdates);

      // Save log entry
      await db.createGameLog(
        game.id,
        'guess',
        `${player.nickname} revealed ${revealedCard.word} (${revealedCard.type})`,
        game.current_turn
      );

      // Broadcast card revealed
      io.to(roomCode).emit('game:cardRevealed', {
        position: cardPosition,
        type: revealedCard.type,
        team: game.current_turn,
        revealedBy: player.nickname
      });

      // If game ended, broadcast winner and save log
      if (result.gameUpdates.winner) {
        const winner = result.gameUpdates.winner;
        const reason = result.endReason === 'assassin' 
          ? `Assassin hit! ${winner} team wins!` 
          : `${winner} team found all their agents!`;
        
        await db.createGameLog(
          game.id,
          'system',
          reason,
          null
        );

        io.to(roomCode).emit('game:ended', {
          winner,
          reason: result.endReason
        });

        // Update room status
        await db.updateRoomStatus(roomId, 'finished');
        io.to(roomCode).emit('room:statusChanged', { status: 'finished' });
      } else if (result.turnEnded) {
        // Only emit turn changed if game didn't end
        const newTurn = result.gameUpdates.current_turn;
        if (newTurn) {
          await db.createGameLog(
            game.id,
            'turn',
            `${newTurn} team's turn`,
            null
          );
          
          // Start spymaster timer for new turn
          if (gameTimers[roomCode] && gameTimers[roomCode].settings.enabled) {
            const timer = gameTimers[roomCode].timers[newTurn];
            const settings = gameTimers[roomCode].settings;
            const duration = timer.isFirstRound 
              ? settings.spymasterDuration + settings.firstRoundBonus
              : settings.spymasterDuration;
            
            timer.timeRemaining = duration;
            timer.isPaused = false;
            
            // Mark previous team's first round as complete
            if (game.current_turn) {
              gameTimers[roomCode].timers[game.current_turn].isFirstRound = false;
            }
            
            io.to(roomCode).emit('game:timerUpdate', {
              team: newTurn,
              timeRemaining: timer.timeRemaining,
              isPaused: timer.isPaused
            });
          }
          
          io.to(roomCode).emit('game:turnChanged', {
            newTurn
          });
        }
      }

      // Get all cards and broadcast full state
      const allCards = await db.getGameCards(game.id);
      await broadcastGameState(io, roomCode, updatedGame, allCards, players);

      callback({ 
        success: true, 
        cardType: revealedCard.type,
        turnEnded: result.turnEnded,
        winner: result.gameUpdates.winner || null
      });
    } catch (error: any) {
      console.error('game:guessCard error:', error);
      callback({ error: error.message || 'Failed to guess card' });
    }
  });

  // End turn early
  socket.on('game:endTurn', async (data, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get game
      const game = await db.getGameByRoomId(roomId);
      if (!game) {
        return callback({ error: 'Game not found' });
      }

      if (game.winner) {
        return callback({ error: 'Game is already over' });
      }

      // Get players
      const players = await db.getRoomPlayers(roomId);

      // Verify player is on current team
      if (!isOnCurrentTeam(player.id, game.current_turn, players)) {
        return callback({ error: 'Not your team\'s turn' });
      }

      // Switch turn
      const newTurn: 'red' | 'blue' = game.current_turn === 'red' ? 'blue' : 'red';

      const updatedGame = await db.updateGameState(game.id, {
        current_turn: newTurn,
        clue_word: null,
        clue_count: null,
        guesses_remaining: null
      });

      // Save log entry
      await db.createGameLog(
        game.id,
        'turn',
        `${player.nickname} ended the turn. ${newTurn} team's turn`,
        null
      );

      // Start spymaster timer for new turn
      if (gameTimers[roomCode] && gameTimers[roomCode].settings.enabled) {
        const timer = gameTimers[roomCode].timers[newTurn];
        const settings = gameTimers[roomCode].settings;
        const duration = timer.isFirstRound 
          ? settings.spymasterDuration + settings.firstRoundBonus
          : settings.spymasterDuration;
        
        timer.timeRemaining = duration;
        timer.isPaused = false;
        
        // Mark previous team's first round as complete
        if (game.current_turn) {
          gameTimers[roomCode].timers[game.current_turn].isFirstRound = false;
        }
        
        io.to(roomCode).emit('game:timerUpdate', {
          team: newTurn,
          timeRemaining: timer.timeRemaining,
          isPaused: timer.isPaused
        });
      }

      // Broadcast turn change
      io.to(roomCode).emit('game:turnChanged', {
        newTurn,
        endedBy: player.nickname
      });

      // Get cards and broadcast updated state
      const cards = await db.getGameCards(game.id);
      await broadcastGameState(io, roomCode, updatedGame, cards, players);

      callback({ success: true });
    } catch (error: any) {
      console.error('game:endTurn error:', error);
      callback({ error: error.message || 'Failed to end turn' });
    }
  });

  // Mark a card (place nickname on it)
  socket.on('game:markCard', async ({ position }: { position: number }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get game
      const game = await db.getGameByRoomId(roomId);
      if (!game) {
        return callback({ error: 'Game not found' });
      }

      // Get card at position
      const card = await db.getCardByPosition(game.id, position);
      if (!card) {
        return callback({ error: 'Card not found' });
      }

      if (card.revealed) {
        return callback({ error: 'Card already revealed' });
      }

      // Get player info
      const players = await db.getRoomPlayers(roomId);
      const roomPlayer = players.find(p => p.player_id === player.id);
      
      if (!roomPlayer) {
        return callback({ error: 'Player not in room' });
      }

      // Get or create markers for this card (stored in-memory for now)
      // In a real app, you'd store this in the database
      if (!cardMarkersCache[game.id]) {
        cardMarkersCache[game.id] = {};
      }
      if (!cardMarkersCache[game.id][position]) {
        cardMarkersCache[game.id][position] = [];
      }

      const markers = cardMarkersCache[game.id][position];
      const existingIndex = markers.findIndex(m => m.playerId === player.publicId);

      if (existingIndex >= 0) {
        // Remove existing marker (toggle off)
        markers.splice(existingIndex, 1);
      } else {
        // Add new marker
        markers.push({
          playerId: player.publicId,
          nickname: roomPlayer.nickname,
          team: roomPlayer.team
        });
      }

      // Broadcast marker update to all players
      io.to(roomCode).emit('game:markerUpdated', {
        position,
        markers: markers.map(m => ({
          playerId: m.playerId,
          nickname: m.nickname,
          team: m.team
        }))
      });

      callback({ success: true });
    } catch (error: any) {
      console.error('game:markCard error:', error);
      callback({ error: error.message || 'Failed to mark card' });
    }
  });

  // Reset game (host only)
  socket.on('game:reset', async (data: { customWords?: string[] }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      // Get room and verify host
      const room = await db.getRoomById(roomId);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      if (room.host_player_id !== player.id) {
        return callback({ error: 'Only the host can reset the game' });
      }

      // Get game before deleting to clean up logs
      const game = await db.getGameByRoomId(roomId);
      
      if (game) {
        // Delete game logs
        await db.deleteGameLogs(game.id);
        // Clear card markers cache
        if (cardMarkersCache[game.id]) {
          delete cardMarkersCache[game.id];
        }
      }

      // Delete existing game
      await db.deleteGameByRoomId(roomId);

      // Reset all players to unassigned
      const players = await db.getRoomPlayers(roomId);
      for (const p of players) {
        await db.setTeamAndRole(roomId, p.player_id, null, null);
      }

      // Update room status to waiting
      await db.updateRoomStatus(roomId, 'waiting');

      // Get updated players
      const updatedPlayers = await db.getRoomPlayers(roomId);

      // Broadcast reset event
      io.to(roomCode).emit('game:reset', {});
      io.to(roomCode).emit('room:statusChanged', { status: 'waiting' });
      io.to(roomCode).emit('room:updated', {
        players: formatPlayersForClient(updatedPlayers)
      });

      // Clear timer state for this room
      if (gameTimers[roomCode]) {
        delete gameTimers[roomCode];
      }
      delete roomGameCache[roomCode];

      // Automatically start a new game with new random words
      // Use customWords from client if provided, otherwise fall back to previous game's words
      let wordsToUse: string[] | undefined = data?.customWords;
      
      if (!wordsToUse && game) {
        // Fallback: get words from previous game if no custom words provided
        const previousCards = await db.getGameCards(game.id);
        wordsToUse = previousCards.map(card => card.word);
      }
      
      await startGameLogic(io, roomId, roomCode, player.nickname, wordsToUse);

      callback({ success: true });
    } catch (error: any) {
      console.error('game:reset error:', error);
      callback({ error: error.message || 'Failed to reset game' });
    }
  });

  // Request current game state (for reconnection)
  socket.on('game:getState', async (data, callback) => {
    try {
      const roomId = socket.data.roomId;
      
      if (!roomId) {
        return callback({ error: 'Not in a room' });
      }

      const room = await db.getRoomById(roomId);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const players = await db.getRoomPlayers(roomId);
      const roomPlayer = players.find(p => p.player_id === player.id);
      // Only spymasters can see all cards
      const canSeeAll = roomPlayer?.role === 'spymaster';

      // Find the host's public_id
      const host = players.find(p => p.player_id === room.host_player_id);
      const hostPublicId = host?.public_id || '';

      if (room.status === 'waiting') {
        return callback({
          success: true,
          status: 'waiting',
          room: {
            code: room.code,
            status: room.status,
            hostId: hostPublicId,
            players: formatPlayersForClient(players)
          }
        });
      }

      const game = await db.getGameByRoomId(roomId);
      if (!game) {
        return callback({ error: 'Game not found' });
      }

      const cards = await db.getGameCards(game.id);
      const logs = await db.getGameLogs(game.id);

      callback({
        success: true,
        status: 'playing',
        game: {
          ...formatGameState(game, cards, players, canSeeAll, room.code),
          log: logs
        },
        room: {
          code: room.code,
          status: room.status,
          hostId: hostPublicId,
          players: formatPlayersForClient(players)
        }
      });
    } catch (error: any) {
      console.error('game:getState error:', error);
      callback({ error: error.message || 'Failed to get game state' });
    }
  });

  // Update timer settings (host only)
  socket.on('game:updateTimerSettings', async (data: { settings: any }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId || !roomCode) {
        return callback({ error: 'Not in a room' });
      }

      const room = await db.getRoomById(roomId);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      if (room.host_player_id !== player.id) {
        return callback({ error: 'Only the host can update timer settings' });
      }

      // Update timer settings in memory
      if (gameTimers[roomCode]) {
        gameTimers[roomCode].settings = {
          ...gameTimers[roomCode].settings,
          ...data.settings
        };
      }

      // Broadcast timer settings to all players in the room
      io.to(roomCode).emit('game:timerSettingsUpdated', { settings: data.settings });

      callback({ success: true });
    } catch (error: any) {
      console.error('game:updateTimerSettings error:', error);
      callback({ error: error.message || 'Failed to update timer settings' });
    }
  });

  // Toggle timer pause (team members only)
  socket.on('game:toggleTimerPause', async (data: { team: 'red' | 'blue' }, callback) => {
    try {
      const roomId = socket.data.roomId;
      const roomCode = socket.data.roomCode;
      
      if (!roomId || !roomCode) {
        return callback({ error: 'Not in a room' });
      }

      const room = await db.getRoomById(roomId);
      if (!room) {
        return callback({ error: 'Room not found' });
      }

      const players = await db.getRoomPlayers(roomId);
      const playerData = players.find(p => p.player_id === player.id);
      
      // Only allow team members to pause their own timer
      if (playerData?.team !== data.team) {
        return callback({ error: 'You can only pause your own team\'s timer' });
      }

      if (!gameTimers[roomCode]) {
        return callback({ error: 'Timers not initialized' });
      }

      // Toggle pause state
      const timer = gameTimers[roomCode].timers[data.team];
      timer.isPaused = !timer.isPaused;

      // Broadcast timer update
      io.to(roomCode).emit('game:timerUpdate', {
        team: data.team,
        timeRemaining: timer.timeRemaining,
        isPaused: timer.isPaused
      });

      callback({ success: true });
    } catch (error: any) {
      console.error('game:toggleTimerPause error:', error);
      callback({ error: error.message || 'Failed to toggle timer pause' });
    }
  });
}

// Process the result of a card guess
function processGuessResult(game: Game, card: Card): {
  gameUpdates: Partial<Game>;
  turnEnded: boolean;
  endReason?: string;
} {
  const currentTeam = game.current_turn;
  const otherTeam: 'red' | 'blue' = currentTeam === 'red' ? 'blue' : 'red';

  // Assassin = instant loss
  if (card.type === 'assassin') {
    return {
      gameUpdates: {
        winner: otherTeam,
        finished_at: new Date().toISOString(),
        clue_word: null,
        clue_count: null,
        guesses_remaining: null
      },
      turnEnded: true,
      endReason: 'assassin'
    };
  }

  // Calculate remaining cards
  const newRedRemaining = card.type === 'red' ? 
    (game.red_cards_remaining - 1) : game.red_cards_remaining;
  const newBlueRemaining = card.type === 'blue' ? 
    (game.blue_cards_remaining - 1) : game.blue_cards_remaining;

  // Check win conditions
  if (newRedRemaining === 0) {
    return {
      gameUpdates: {
        red_cards_remaining: 0,
        winner: 'red',
        finished_at: new Date().toISOString(),
        clue_word: null,
        clue_count: null,
        guesses_remaining: null
      },
      turnEnded: true,
      endReason: 'all_found'
    };
  }

  if (newBlueRemaining === 0) {
    return {
      gameUpdates: {
        blue_cards_remaining: 0,
        winner: 'blue',
        finished_at: new Date().toISOString(),
        clue_word: null,
        clue_count: null,
        guesses_remaining: null
      },
      turnEnded: true,
      endReason: 'all_found'
    };
  }

  // Correct guess for current team
  if (card.type === currentTeam) {
    const currentGuesses = game.guesses_remaining || 1;
    const isUnlimited = currentGuesses === 999;
    const newGuessesRemaining = isUnlimited ? 999 : currentGuesses - 1;
    
    // Can continue guessing if guesses remain (or unlimited)
    if (newGuessesRemaining > 0) {
      return {
        gameUpdates: {
          guesses_remaining: newGuessesRemaining,
          red_cards_remaining: newRedRemaining,
          blue_cards_remaining: newBlueRemaining
        },
        turnEnded: false
      };
    }
    
    // Out of guesses, turn ends
    return {
      gameUpdates: {
        current_turn: otherTeam,
        clue_word: null,
        clue_count: null,
        guesses_remaining: null,
        red_cards_remaining: newRedRemaining,
        blue_cards_remaining: newBlueRemaining
      },
      turnEnded: true
    };
  }

  // Wrong team card or neutral - turn ends
  return {
    gameUpdates: {
      current_turn: otherTeam,
      clue_word: null,
      clue_count: null,
      guesses_remaining: null,
      red_cards_remaining: newRedRemaining,
      blue_cards_remaining: newBlueRemaining
    },
    turnEnded: true
  };
}

// Format game state for client
function formatGameState(
  game: Game, 
  cards: Card[], 
  players: db.RoomPlayerWithDetails[],
  canSeeAll: boolean,
  roomCode?: string
) {
  // Get timer state if roomCode provided
  const timerState = roomCode ? getTimerState(roomCode) : null;
  
  return {
    status: game.winner ? 'finished' : 'playing',
    currentTurn: game.current_turn,
    clue: game.clue_word ? { word: game.clue_word, count: game.clue_count } : null,
    guessesRemaining: game.guesses_remaining || 0,
    scores: {
      // Remaining cards needed to win (counts down)
      red: game.red_cards_remaining,
      blue: game.blue_cards_remaining
    },
    winner: game.winner,
    cards: cards.map(card => ({
      word: card.word,
      type: (canSeeAll || card.revealed || game.winner) ? card.type : 'hidden',
      revealed: card.revealed,
      position: card.position
    })),
    players: formatPlayersForClient(players),
    timerSettings: timerState?.settings || {
      spymasterDuration: 120,
      operativeDuration: 180,
      firstRoundBonus: 60,
      enabled: true
    },
    teamTimers: timerState?.timers || {
      red: { timeRemaining: 0, isPaused: false, isFirstRound: true },
      blue: { timeRemaining: 0, isPaused: false, isFirstRound: true }
    }
  };
}

// Format players for client
function formatPlayersForClient(players: db.RoomPlayerWithDetails[]) {
  return players.map(p => ({
    id: p.public_id,
    nickname: p.nickname,
    team: p.team,
    role: p.role
  }));
}

