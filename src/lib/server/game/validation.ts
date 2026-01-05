import type { RoomPlayerWithDetails } from '../db';

/**
 * Validate a clue word against board words
 * - Cannot be the same as any word on the board
 * - Cannot contain any board word as substring (optional strict mode)
 */
export function validateClueWord(word: string, boardWords: string[]): { valid: boolean; error?: string } {
  const normalizedClue = word.toLowerCase().trim();
  const normalizedBoard = boardWords.map(w => w.toLowerCase());
  
  // Clue must be a single word
  if (normalizedClue.includes(' ')) {
    return { valid: false, error: 'Clue must be a single word' };
  }

  // Clue cannot be empty
  if (normalizedClue.length === 0) {
    return { valid: false, error: 'Clue cannot be empty' };
  }

  // Clue cannot match any board word
  if (normalizedBoard.includes(normalizedClue)) {
    return { valid: false, error: 'Clue cannot be a word on the board' };
  }
  
  // Clue cannot be a substring of board words (loose check)
  for (const boardWord of normalizedBoard) {
    if (boardWord.includes(normalizedClue) || normalizedClue.includes(boardWord)) {
      return { valid: false, error: `Clue cannot contain or be contained in "${boardWord}"` };
    }
  }
  
  return { valid: true };
}

/**
 * Validate clue count
 */
export function validateClueCount(count: number): { valid: boolean; error?: string } {
  if (!Number.isInteger(count)) {
    return { valid: false, error: 'Count must be an integer' };
  }
  
  if (count < 0 || count > 9) {
    return { valid: false, error: 'Count must be between 0 and 9' };
  }
  
  return { valid: true };
}

/**
 * Check if game can start with current team composition
 */
export function canStartGame(players: RoomPlayerWithDetails[]): { valid: boolean; error?: string } {
  const redTeam = players.filter(p => p.team === 'red');
  const blueTeam = players.filter(p => p.team === 'blue');
  
  // Need at least 2 players per team
  if (redTeam.length < 2) {
    return { valid: false, error: 'Red team needs at least 2 players' };
  }
  if (blueTeam.length < 2) {
    return { valid: false, error: 'Blue team needs at least 2 players' };
  }
  
  // Each team needs a spymaster
  if (!redTeam.some(p => p.role === 'spymaster')) {
    return { valid: false, error: 'Red team needs a spymaster' };
  }
  if (!blueTeam.some(p => p.role === 'spymaster')) {
    return { valid: false, error: 'Blue team needs a spymaster' };
  }
  
  return { valid: true };
}

/**
 * Check if a player is the current team's spymaster
 */
export function isCurrentSpymaster(
  playerId: string, 
  currentTurn: 'red' | 'blue',
  players: RoomPlayerWithDetails[]
): boolean {
  const player = players.find(p => p.player_id === playerId);
  return player?.team === currentTurn && player?.role === 'spymaster';
}

/**
 * Check if a player is on the current team as an operative
 */
export function isCurrentOperative(
  playerId: string,
  currentTurn: 'red' | 'blue',
  players: RoomPlayerWithDetails[]
): boolean {
  const player = players.find(p => p.player_id === playerId);
  return player?.team === currentTurn && player?.role === 'operative';
}

/**
 * Check if a player is on the current team (either role)
 */
export function isOnCurrentTeam(
  playerId: string,
  currentTurn: 'red' | 'blue',
  players: RoomPlayerWithDetails[]
): boolean {
  const player = players.find(p => p.player_id === playerId);
  return player?.team === currentTurn;
}

