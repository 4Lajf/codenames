// Sample word bank for testing
export const MOCK_WORDS = [
  'APPLE', 'BERLIN', 'CAT', 'DIAMOND', 'EAGLE',
  'FISH', 'GOLD', 'HOSPITAL', 'ICE', 'JUPITER',
  'KNIGHT', 'LAMP', 'MOON', 'NEEDLE', 'OPERA',
  'PIANO', 'QUEEN', 'ROBOT', 'SNOW', 'TIGER',
  'UMBRELLA', 'VOLCANO', 'WHALE', 'XRAY', 'ZEBRA'
];

// Card types distribution: 9 red, 8 blue, 7 neutral, 1 assassin (red starts)
export const MOCK_CARD_TYPES = [
  'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red',
  'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue',
  'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral',
  'assassin'
];

import type { Player } from '../types';

export const MOCK_PLAYERS: Player[] = [
  { id: '1', nickname: 'Alice', team: 'red', role: 'spymaster' },
  { id: '2', nickname: 'Bob', team: 'red', role: 'operative' },
  { id: '3', nickname: 'Charlie', team: 'blue', role: 'spymaster' },
  { id: '4', nickname: 'Diana', team: 'blue', role: 'operative' },
  { id: '5', nickname: 'You', team: 'red', role: 'operative' }
];

export const MOCK_LOG_ENTRIES = [
  { type: 'system', message: 'Game started', timestamp: Date.now() - 60000 },
  { type: 'clue', team: 'red', message: 'Alice gave clue: ANIMAL 3', timestamp: Date.now() - 50000 },
  { type: 'guess', team: 'red', message: 'Bob guessed TIGER ✓', timestamp: Date.now() - 40000 },
  { type: 'guess', team: 'red', message: 'Bob guessed CAT ✓', timestamp: Date.now() - 30000 },
  { type: 'turn', message: 'Blue team\'s turn', timestamp: Date.now() - 20000 }
];

