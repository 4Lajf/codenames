import type { RoomPlayerWithDetails } from '../db';

/**
 * Validate a clue word against board words
 * - Cannot be empty
 */
export function validateClueWord(word: string, boardWords: string[]): { valid: boolean; error?: string } {
  const normalizedClue = word.toLowerCase().trim();
  
  // Clue cannot be empty
  if (normalizedClue.length === 0) {
    return { valid: false, error: 'Clue cannot be empty' };
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
  
  if (count < -1 || count > 9) {
    return { valid: false, error: 'Count must be between -1 and 9' };
  }
  
  return { valid: true };
}

/**
 * Check if game can start with current team composition
 * (Validation removed to allow auto-starting with no players)
 */
export function canStartGame(players: RoomPlayerWithDetails[]): { valid: boolean; error?: string } {
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

