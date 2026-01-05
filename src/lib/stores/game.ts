import { writable, derived, get } from 'svelte/store';
import type { GameState, Card, Player, LogEntry } from '../types';
import { getSocket, emitWithAck } from './socket';
import { session } from './session';

// Initial game state
function createInitialState(): GameState {
  return {
    status: 'lobby',
    cards: [],
    currentTurn: 'red',
    clue: null,
    guessesRemaining: 0,
    scores: { red: 0, blue: 0 },
    winner: null,
    players: [],
    log: []
  };
}

function createGameStore() {
  const { subscribe, set, update } = writable<GameState>(createInitialState());
  
  // Setup socket event listeners
  function setupListeners() {
    const socket = getSocket();
    if (!socket) return;

    // Full game state update
    socket.on('game:state', (state: any) => {
      update(s => ({
        ...s,
        status: state.status,
        cards: state.cards.map((c: any) => ({
          word: c.word,
          type: c.type,
          revealed: c.revealed
        })),
        currentTurn: state.currentTurn,
        clue: state.clue,
        guessesRemaining: state.guessesRemaining,
        scores: state.scores,
        winner: state.winner,
        players: state.players
      }));
    });

    // Clue given
    socket.on('game:clueGiven', ({ word, count, team }: { word: string; count: number; team: string }) => {
      update(s => ({
        ...s,
        clue: { word, count },
        guessesRemaining: count + 1,
        log: [...s.log, {
          type: 'clue' as const,
          team: team as 'red' | 'blue',
          message: `${team} Spymaster gives clue: ${word} ${count}`,
          timestamp: Date.now()
        }]
      }));
    });

    // Card revealed
    socket.on('game:cardRevealed', ({ position, type, team, revealedBy }: { 
      position: number; 
      type: string; 
      team: string; 
      revealedBy: string 
    }) => {
      update(s => {
        const cards = [...s.cards];
        if (cards[position]) {
          cards[position] = { ...cards[position], revealed: true, type: type as any };
        }
        return {
          ...s,
          cards,
          log: [...s.log, {
            type: 'guess' as const,
            team: team as 'red' | 'blue',
            message: `${revealedBy} revealed ${cards[position]?.word || 'card'} (${type})`,
            timestamp: Date.now()
          }]
        };
      });
    });

    // Turn changed
    socket.on('game:turnChanged', ({ newTurn }: { newTurn: 'red' | 'blue' }) => {
      update(s => ({
        ...s,
        currentTurn: newTurn,
        clue: null,
        guessesRemaining: 0,
        log: [...s.log, {
          type: 'turn' as const,
          message: `${newTurn} team's turn`,
          timestamp: Date.now()
        }]
      }));
    });

    // Game ended
    socket.on('game:ended', ({ winner, reason }: { winner: 'red' | 'blue'; reason: string }) => {
      update(s => ({
        ...s,
        status: 'finished',
        winner,
        log: [...s.log, {
          type: 'system' as const,
          message: reason === 'assassin' 
            ? `Assassin hit! ${winner} team wins!` 
            : `${winner} team found all their agents!`,
          timestamp: Date.now()
        }]
      }));
    });
  }

  return {
    subscribe,
    set,
    update,
    
    /**
     * Initialize socket listeners
     */
    init() {
      setupListeners();
    },

    /**
     * Start the game (host only)
     */
    async start(): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('game:start', {});
        update(s => ({
          ...s,
          status: 'playing',
          log: [...s.log, {
            type: 'system' as const,
            message: 'Game started!',
            timestamp: Date.now()
          }]
        }));
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Give a clue (spymaster only)
     */
    async giveClue(word: string, count: number): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('game:giveClue', { word, count });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Reveal a card (operative)
     */
    async revealCard(position: number): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('game:guessCard', { cardPosition: position });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * End turn early
     */
    async endTurn(): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('game:endTurn', {});
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Get current game state from server
     */
    async refresh(): Promise<void> {
      try {
        const response = await emitWithAck<any>('game:getState', {});
        if (response.game) {
          update(s => ({
            ...s,
            status: response.game.status,
            cards: response.game.cards.map((c: any) => ({
              word: c.word,
              type: c.type,
              revealed: c.revealed
            })),
            currentTurn: response.game.currentTurn,
            clue: response.game.clue,
            guessesRemaining: response.game.guessesRemaining,
            scores: response.game.scores,
            winner: response.game.winner,
            players: response.game.players
          }));
        }
      } catch (error) {
        console.error('Failed to refresh game state:', error);
      }
    },

    /**
     * Reset game state
     */
    reset() {
      set(createInitialState());
    }
  };
}

export const game = createGameStore();

// Derived stores for player-specific state
export const currentPlayer = derived(
  [game, session],
  ([$game, $session]) => {
    return $game.players.find(p => p.id === $session.playerId) || null;
  }
);

export const isMyTurn = derived(
  [game, currentPlayer],
  ([$game, $currentPlayer]) => {
    return $game.status === 'playing' && 
           $currentPlayer?.team === $game.currentTurn;
  }
);

export const canGuess = derived(
  [game, currentPlayer, isMyTurn],
  ([$game, $currentPlayer, $isMyTurn]) => {
    return $isMyTurn && 
           $currentPlayer?.role === 'operative' && 
           $game.clue !== null &&
           $game.guessesRemaining > 0;
  }
);

export const canGiveClue = derived(
  [game, currentPlayer, isMyTurn],
  ([$game, $currentPlayer, $isMyTurn]) => {
    return $isMyTurn && 
           $currentPlayer?.role === 'spymaster' && 
           $game.clue === null;
  }
);

export const visibleCards = derived(
  [game, currentPlayer],
  ([$game, $currentPlayer]) => {
    const isSpymaster = $currentPlayer?.role === 'spymaster';
    const gameOver = $game.status === 'finished';

    return $game.cards.map(card => ({
      ...card,
      showType: isSpymaster || card.revealed || gameOver
    }));
  }
);
