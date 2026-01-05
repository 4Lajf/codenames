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

// Game event handlers
export function handleGameEvents(io: Server, socket: Socket) {
  const player = socket.data.player as TokenPayload;

  // Start the game (host only)
  socket.on('game:start', async (data, callback) => {
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

      // Get players and validate team composition
      const players = await db.getRoomPlayers(roomId);
      const validation = canStartGame(players);
      if (!validation.valid) {
        return callback({ error: validation.error });
      }

      // Randomly determine first team (red goes first by default with 9 cards)
      const firstTeam: 'red' | 'blue' = Math.random() < 0.5 ? 'red' : 'blue';

      // Get random words from word bank
      const words = await db.getRandomWords(25);
      if (words.length < 25) {
        return callback({ error: 'Not enough words in word bank' });
      }

      // Create game
      const game = await db.createGame(roomId, firstTeam);

      // Prepare and create cards
      const cardData = prepareGameCards(words, firstTeam);
      const cards = await db.createGameCards(game.id, cardData);

      // Update room status
      await db.updateRoomStatus(roomId, 'playing');

      // Broadcast game started to all players
      broadcastGameState(io, roomCode, game, cards, players);

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
      const updatedGame = await db.updateGameState(game.id, {
        clue_word: word.toUpperCase(),
        clue_count: count,
        guesses_remaining: count + 1 // +1 bonus guess
      });

      // Broadcast clue to all players
      io.to(roomCode).emit('game:clueGiven', {
        word: word.toUpperCase(),
        count,
        team: game.current_turn
      });

      // Broadcast updated game state
      broadcastGameState(io, roomCode, updatedGame, cards, players);

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

      // Check guesses remaining
      if ((game.guesses_remaining || 0) <= 0) {
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

      // Broadcast card revealed
      io.to(roomCode).emit('game:cardRevealed', {
        position: cardPosition,
        type: revealedCard.type,
        team: game.current_turn,
        revealedBy: player.nickname
      });

      // If turn changed, broadcast
      if (result.turnEnded) {
        io.to(roomCode).emit('game:turnChanged', {
          newTurn: result.gameUpdates.current_turn
        });
      }

      // If game ended, broadcast winner
      if (result.gameUpdates.winner) {
        io.to(roomCode).emit('game:ended', {
          winner: result.gameUpdates.winner,
          reason: result.endReason
        });

        // Update room status
        await db.updateRoomStatus(roomId, 'finished');
      }

      // Get all cards and broadcast full state
      const allCards = await db.getGameCards(game.id);
      broadcastGameState(io, roomCode, updatedGame, allCards, players);

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

      // Broadcast turn change
      io.to(roomCode).emit('game:turnChanged', {
        newTurn
      });

      // Get cards and broadcast updated state
      const cards = await db.getGameCards(game.id);
      broadcastGameState(io, roomCode, updatedGame, cards, players);

      callback({ success: true });
    } catch (error: any) {
      console.error('game:endTurn error:', error);
      callback({ error: error.message || 'Failed to end turn' });
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
      const isSpymaster = roomPlayer?.role === 'spymaster';

      if (room.status === 'waiting') {
        return callback({
          success: true,
          status: 'waiting',
          room: {
            code: room.code,
            status: room.status,
            hostId: room.host_player_id,
            players: formatPlayersForClient(players)
          }
        });
      }

      const game = await db.getGameByRoomId(roomId);
      if (!game) {
        return callback({ error: 'Game not found' });
      }

      const cards = await db.getGameCards(game.id);

      callback({
        success: true,
        status: 'playing',
        game: formatGameState(game, cards, players, isSpymaster),
        room: {
          code: room.code,
          status: room.status,
          hostId: room.host_player_id,
          players: formatPlayersForClient(players)
        }
      });
    } catch (error: any) {
      console.error('game:getState error:', error);
      callback({ error: error.message || 'Failed to get game state' });
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
    const newGuessesRemaining = (game.guesses_remaining || 1) - 1;
    
    // Can continue guessing if guesses remain
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

// Broadcast game state to all players (with role-based masking)
function broadcastGameState(
  io: Server, 
  roomCode: string, 
  game: Game, 
  cards: Card[], 
  players: db.RoomPlayerWithDetails[]
) {
  const room = io.sockets.adapter.rooms.get(roomCode);
  if (!room) return;

  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;

    const socketPlayer = socket.data.player as TokenPayload;
    const roomPlayer = players.find(p => p.player_id === socketPlayer.id);
    const isSpymaster = roomPlayer?.role === 'spymaster';

    socket.emit('game:state', formatGameState(game, cards, players, isSpymaster));
  }
}

// Format game state for client
function formatGameState(
  game: Game, 
  cards: Card[], 
  players: db.RoomPlayerWithDetails[],
  isSpymaster: boolean
) {
  return {
    status: game.winner ? 'finished' : 'playing',
    currentTurn: game.current_turn,
    clue: game.clue_word ? { word: game.clue_word, count: game.clue_count } : null,
    guessesRemaining: game.guesses_remaining || 0,
    scores: {
      red: (game.red_cards_remaining <= 9 ? 9 : 8) - game.red_cards_remaining,
      blue: (game.blue_cards_remaining <= 8 ? 8 : 9) - game.blue_cards_remaining
    },
    winner: game.winner,
    cards: cards.map(card => ({
      word: card.word,
      type: (isSpymaster || card.revealed || game.winner) ? card.type : 'hidden',
      revealed: card.revealed,
      position: card.position
    })),
    players: formatPlayersForClient(players)
  };
}

// Format players for client
function formatPlayersForClient(players: db.RoomPlayerWithDetails[]) {
  return players.map(p => ({
    id: p.player_id,
    nickname: p.nickname,
    team: p.team,
    role: p.role
  }));
}

