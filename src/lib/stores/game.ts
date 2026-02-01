import { writable, derived, get, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { GameState, Card, Player, LogEntry, CardMarker } from '../types';
import { getSocket, emitWithAck } from './socket';
import { session } from './session';

type GameStore = Writable<GameState> & {
  init(): void;
  start(autoStart?: boolean): Promise<{ success: boolean; error?: string }>;
  giveClue(word: string, count: number): Promise<{ success: boolean; error?: string }>;
  revealCard(position: number): Promise<{ success: boolean; error?: string }>;
  endTurn(): Promise<{ success: boolean; error?: string }>;
  refresh(): Promise<void>;
  reset(): void;
  markCard(position: number): Promise<{ success: boolean; error?: string }>;
  resetGame(): Promise<{ success: boolean; error?: string }>;
  toggleTimerPause(team: 'red' | 'blue'): Promise<{ success: boolean; error?: string }>;
  updateTimerSettings(settings: Partial<GameState['timerSettings']>): Promise<{ success: boolean; error?: string }>;
  tickTimer(team: 'red' | 'blue'): void;
  initializeTimers(): void;
  startTimer(team: 'red' | 'blue', isSpymasterTurn: boolean): void;
  completeFirstRound(team: 'red' | 'blue'): void;
};

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
    log: [],
    cardMarkers: {},
    timerSettings: {
      spymasterDuration: 120, // 2 minutes
      operativeDuration: 180, // 3 minutes
      firstRoundBonus: 60, // 1 minute extra for first round
      enabled: true
    },
    teamTimers: {
      red: { timeRemaining: 0, isPaused: false, isFirstRound: true },
      blue: { timeRemaining: 0, isPaused: false, isFirstRound: true }
    }
  };
}

function createGameStore(): GameStore {
  const { subscribe, set, update } = writable<GameState>(createInitialState());
  
  // Setup socket event listeners
  function setupListeners() {
    const socket = getSocket();
    if (!socket) return;

    // Remove any existing listeners before adding new ones to prevent duplicates
    socket.off('game:state');
    socket.off('game:started');
    socket.off('game:clueGiven');
    socket.off('game:cardRevealed');
    socket.off('game:turnChanged');
    socket.off('game:ended');
    socket.off('game:markerUpdated');
    socket.off('game:reset');
    socket.off('game:timerUpdate');

    // Full game state update
    socket.on('game:state', (state: any) => {
      update(s => {
        const wasPlaying = s.status === 'playing';
        const isNowPlaying = state.status === 'playing';
        const gameJustStarted = !wasPlaying && isNowPlaying;
        
        const newState = {
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
          players: state.players,
          log: state.log || []
        };
        
        // Use timer state from server if provided
        if (state.timerSettings) {
          newState.timerSettings = state.timerSettings;
        }
        if (state.teamTimers) {
          newState.teamTimers = state.teamTimers;
        }
        
        return newState;
      });
    });

    // Game started
    socket.on('game:started', ({ startedBy }: { startedBy: string }) => {
      update(s => {
        const newState = {
          ...s,
          log: [...s.log, {
            type: 'system' as const,
            message: `Game started by ${startedBy}`,
            timestamp: Date.now()
          }]
        };
        
        // Initialize timers when game starts
        if (newState.status === 'playing' && newState.timerSettings.enabled) {
          const spymasterDuration = newState.timerSettings.spymasterDuration + newState.timerSettings.firstRoundBonus;
          newState.teamTimers = {
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
          };
        }
        
        return newState;
      });
    });

    // Clue given
    socket.on('game:clueGiven', ({ word, count, team, spymasterName }: { word: string; count: number; team: string; spymasterName?: string }) => {
      const name = spymasterName || `${team} Spymaster`;
      update(s => ({
        ...s,
        clue: { word, count },
        guessesRemaining: count + 1,
        log: [...s.log, {
          type: 'clue' as const,
          team: team as 'red' | 'blue',
          message: `${name} gives clue: ${word} ${count}`,
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
        const logMessage = `${revealedBy} revealed ${cards[position]?.word || 'card'} (${type})`;
        return {
          ...s,
          cards,
          log: [...s.log, {
            type: 'guess' as const,
            team: team as 'red' | 'blue',
            message: logMessage,
            timestamp: Date.now()
          }]
        };
      });
    });

    // Turn changed
    socket.on('game:turnChanged', ({ newTurn, endedBy }: { newTurn: 'red' | 'blue', endedBy?: string }) => {
      // Guard against undefined newTurn
      const team = newTurn || 'red';
      let message = `${team} team's turn`;
      if (endedBy) {
         message = `${endedBy} ended the turn. ${team} team's turn`;
      }
      update(s => ({
        ...s,
        currentTurn: team,
        clue: null,
        guessesRemaining: 0,
        log: [...s.log, {
          type: 'turn' as const,
          message,
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

    socket.on('game:markerUpdated', ({ position, markers }: { position: number; markers: CardMarker[] }) => {
      update(s => ({
        ...s,
        cardMarkers: {
          ...s.cardMarkers,
          [position]: markers
        }
      }));
    });

    // Game reset
    socket.on('game:reset', () => {
      set(createInitialState());
    });

    // Timer settings updated by host
    socket.on('game:timerSettingsUpdated', ({ settings }: { settings: Partial<GameState['timerSettings']> }) => {
      update(s => ({
        ...s,
        timerSettings: {
          ...s.timerSettings,
          ...settings
        }
      }));
    });

    // Timer update from server
    socket.on('game:timerUpdate', ({ team, timeRemaining, isPaused }: { team: 'red' | 'blue'; timeRemaining: number; isPaused: boolean }) => {
      update(s => ({
        ...s,
        teamTimers: {
          ...s.teamTimers,
          [team]: {
            ...s.teamTimers[team],
            timeRemaining,
            isPaused
          }
        }
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
     * @param autoStart - If true, skip team validation and use word bank if no custom words
     */
    async start(autoStart: boolean = false): Promise<{ success: boolean; error?: string }> {
      try {
        // Get custom words from localStorage if available
        let customWords: string[] | undefined;
        if (browser) {
          const customWordsText = localStorage.getItem('codenames_custom_words');
          if (customWordsText) {
            customWords = customWordsText
              .split('\n')
              .map(w => w.trim())
              .filter(w => w.length > 0);
          }
        }

        await emitWithAck('game:start', { customWords, autoStart });
        update(s => {
          const newState = {
            ...s,
            status: 'playing' as const
          };
          
          // Initialize timers when game starts
          if (newState.timerSettings.enabled) {
            const spymasterDuration = newState.timerSettings.spymasterDuration + newState.timerSettings.firstRoundBonus;
            newState.teamTimers = {
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
            };
          }
          
          return newState;
        });
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
          update(s => {
            const wasPlaying = s.status === 'playing';
            const isNowPlaying = response.game.status === 'playing';
            const gameJustStarted = !wasPlaying && isNowPlaying;
            
            const newState = {
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
              players: response.game.players,
              log: response.game.log || []
            };
            
            // Use timer state from server if provided
            if (response.game.timerSettings) {
              newState.timerSettings = response.game.timerSettings;
            }
            if (response.game.teamTimers) {
              newState.teamTimers = response.game.teamTimers;
            }
            
            return newState;
          });
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
    },

    /**
     * Mark a card (place your nickname on it)
     */
    async markCard(position: number): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('game:markCard', { position });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Reset the game (host only) - keeps players in room but resets to lobby
     */
    async resetGame(): Promise<{ success: boolean; error?: string }> {
      try {
        // Get custom words from localStorage if available
        let customWords: string[] | undefined;
        if (browser) {
          const customWordsText = localStorage.getItem('codenames_custom_words');
          if (customWordsText) {
            customWords = customWordsText
              .split('\n')
              .map(w => w.trim())
              .filter(w => w.length > 0);
          }
        }

        await emitWithAck('game:reset', { customWords });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Toggle timer pause for current team (synchronized with server)
     */
    async toggleTimerPause(team: 'red' | 'blue'): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('game:toggleTimerPause', { team });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Update timer settings (host only, broadcasts to all players)
     */
    async updateTimerSettings(settings: Partial<GameState['timerSettings']>): Promise<{ success: boolean; error?: string }> {
      try {
        // Update locally first for immediate feedback
        update(s => ({
          ...s,
          timerSettings: {
            ...s.timerSettings,
            ...settings
          }
        }));

        // Broadcast to server and other clients
        await emitWithAck('game:updateTimerSettings', { settings });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Tick timer down for a team
     */
    tickTimer(team: 'red' | 'blue') {
      update(s => {
        const timer = s.teamTimers[team];
        if (timer.isPaused || s.currentTurn !== team || s.status !== 'playing') {
          return s;
        }
        
        return {
          ...s,
          teamTimers: {
            ...s.teamTimers,
            [team]: {
              ...timer,
              timeRemaining: timer.timeRemaining - 1
            }
          }
        };
      });
    },

    /**
     * Initialize timers at game start - set to spymaster duration, paused
     */
    initializeTimers() {
      update(s => {
        if (!s.timerSettings.enabled) return s;
        
        const spymasterDuration = s.timerSettings.spymasterDuration + s.timerSettings.firstRoundBonus;
        
        return {
          ...s,
          teamTimers: {
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
          }
        };
      });
    },

    /**
     * Start timer for a team based on current phase (spymaster or operative)
     */
    startTimer(team: 'red' | 'blue', isSpymasterTurn: boolean) {
      update(s => {
        const timer = s.teamTimers[team];
        const settings = s.timerSettings;
        
        if (!settings.enabled) return s;
        
        const baseDuration = isSpymasterTurn 
          ? settings.spymasterDuration 
          : settings.operativeDuration;
        
        const duration = timer.isFirstRound 
          ? baseDuration + settings.firstRoundBonus
          : baseDuration;
        
        return {
          ...s,
          teamTimers: {
            ...s.teamTimers,
            [team]: {
              ...timer,
              timeRemaining: duration,
              isPaused: false
            }
          }
        };
      });
    },

    /**
     * Mark first round as complete for a team
     */
    completeFirstRound(team: 'red' | 'blue') {
      update(s => ({
        ...s,
        teamTimers: {
          ...s.teamTimers,
          [team]: {
            ...s.teamTimers[team],
            isFirstRound: false
          }
        }
      }));
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
    const canSeeAll = $currentPlayer?.role === 'spymaster';
    const gameOver = $game.status === 'finished';

    return $game.cards.map(card => ({
      ...card,
      showType: canSeeAll || card.revealed || gameOver
    }));
  }
);
