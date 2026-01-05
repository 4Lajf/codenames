import { get } from 'svelte/store';
import { game } from '../stores/game';
import { room } from '../stores/room';
import { player } from '../stores/player';
import type { GameState, RoomState } from '../types';
import { MOCK_PLAYERS, MOCK_WORDS, MOCK_CARD_TYPES } from './data';

function createBaseGame(): GameState {
    const cards = MOCK_WORDS.map((word, i) => ({
        word,
        type: MOCK_CARD_TYPES[i] as any,
        revealed: false
    }));
    
    return {
        status: 'playing',
        cards,
        currentTurn: 'red',
        clue: null,
        guessesRemaining: 0,
        scores: { red: 9, blue: 8 },
        winner: null,
        players: MOCK_PLAYERS,
        log: []
    };
}

export const SCENARIOS = {
  lobbyReady: () => {
    room.update(s => ({ ...s, status: 'waiting', players: MOCK_PLAYERS }));
    game.update(s => ({ ...s, status: 'lobby' }));
  },

  gameStart: () => {
    room.update(s => ({ ...s, status: 'playing' }));
    game.set(createBaseGame());
  },

  redSpymasterTurn: () => {
    const state = createBaseGame();
    state.currentTurn = 'red';
    game.set(state);
    player.update(p => ({ ...p, team: 'red', role: 'spymaster' }));
  },

  redOperativesTurn: () => {
    const state = createBaseGame();
    state.currentTurn = 'red';
    state.clue = { word: 'ANIMAL', count: 2 };
    state.guessesRemaining = 3;
    state.log.push({ type: 'clue', team: 'red', message: 'Spymaster gives clue: ANIMAL 2', timestamp: Date.now() });
    game.set(state);
    player.update(p => ({ ...p, team: 'red', role: 'operative' }));
  },

  blueSpymasterTurn: () => {
    const state = createBaseGame();
    state.currentTurn = 'blue';
    game.set(state);
    player.update(p => ({ ...p, team: 'blue', role: 'spymaster' }));
  },

  gameOverRedWins: () => {
    const state = createBaseGame();
    state.status = 'finished';
    state.winner = 'red';
    state.log.push({ type: 'system', message: 'Red team wins!', timestamp: Date.now() });
    game.set(state);
  },
  
  gameOverAssassin: () => {
     const state = createBaseGame();
     state.status = 'finished';
     state.winner = 'blue'; // Red hit assassin
     state.cards.find(c => c.type === 'assassin')!.revealed = true;
     state.log.push({ type: 'system', message: 'Assassin hit! Game over.', timestamp: Date.now() });
     game.set(state);
  }
};

export function loadScenario(name: keyof typeof SCENARIOS) {
  const scenario = SCENARIOS[name];
  if (scenario) {
    scenario();
    console.log(`Loaded scenario: ${name}`);
  }
}

