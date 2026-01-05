import { writable, derived, get } from 'svelte/store';
import type { GameState, Card } from '../types';
import { MOCK_WORDS, MOCK_CARD_TYPES, MOCK_LOG_ENTRIES, MOCK_PLAYERS } from '../mocks/data';
import { mockRevealCard, mockGiveClue, mockEndTurn } from '../mocks/mockActions';
import { player } from './player';

// Helper to create initial game state
function createInitialState(): GameState {
  const words = [...MOCK_WORDS]; // In real app, shuffle these
  const types = [...MOCK_CARD_TYPES]; // In real app, shuffle these
  
  // Simple shuffle for testing
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  
  // Shuffle types (keep red as starting team for now implies 9 red cards)
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }

  const cards: Card[] = words.map((word, i) => ({
    word,
    type: types[i] as any,
    revealed: false
  }));

  return {
    status: 'playing', // Default to playing for testing
    cards,
    currentTurn: 'red',
    clue: null,
    guessesRemaining: 0,
    scores: { red: 9, blue: 8 },
    winner: null,
    players: MOCK_PLAYERS,
    log: MOCK_LOG_ENTRIES
  };
}

function createGameStore() {
  const { subscribe, set, update } = writable<GameState>(createInitialState());

  return {
    subscribe,
    set,
    update,
    
    // Actions
    revealCard: (index: number) => update(state => mockRevealCard(index, state)),
    giveClue: (word: string, count: number) => update(state => mockGiveClue(word, count, state)),
    endTurn: () => update(state => mockEndTurn(state)),
    reset: () => set(createInitialState())
  };
}

export const game = createGameStore();

// Derived Stores
export const isMyTurn = derived(
  [game, player],
  ([$game, $player]) => $game.status === 'playing' && $game.currentTurn === $player.team
);

export const canGuess = derived(
  [game, player, isMyTurn],
  ([$game, $player, $isMyTurn]) => 
    $isMyTurn && 
    $player.role === 'operative' && 
    $game.clue !== null &&
    $game.guessesRemaining > 0
);

export const canGiveClue = derived(
  [game, player, isMyTurn],
  ([$game, $player, $isMyTurn]) => 
    $isMyTurn && 
    $player.role === 'spymaster' && 
    $game.clue === null
);

export const visibleCards = derived(
  [game, player],
  ([$game, $player]) => {
    return $game.cards.map(card => {
      // Spymasters see everything
      if ($player.role === 'spymaster') return { ...card, showType: true };
      // Operatives only see revealed types, or if game is over
      if ($game.status === 'finished') return { ...card, showType: true };
      
      return { 
        ...card, 
        showType: card.revealed // Type is hidden unless revealed for operatives
      };
    });
  }
);

