export interface Player {
  id: string;
  nickname: string;
  team: 'red' | 'blue' | null;
  role: 'spymaster' | 'operative' | null;
}

export interface Card {
  word: string;
  type: 'red' | 'blue' | 'neutral' | 'assassin';
  revealed: boolean;
}

export interface LogEntry {
  type: 'system' | 'clue' | 'guess' | 'turn';
  team?: 'red' | 'blue';
  message: string;
  timestamp: number;
}

export interface GameState {
  status: 'lobby' | 'playing' | 'finished';
  cards: Card[];
  currentTurn: 'red' | 'blue';
  clue: { word: string; count: number } | null;
  guessesRemaining: number;
  scores: { red: number; blue: number };
  winner: 'red' | 'blue' | null;
  players: Player[];
  log: LogEntry[];
}

export interface RoomState {
  code: string;
  hostId: string;
  status: 'waiting' | 'playing';
  players: Player[];
}

