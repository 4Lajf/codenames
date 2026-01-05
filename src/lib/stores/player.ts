import { writable, derived, get } from 'svelte/store';
import type { Player } from '../types';
import { session } from './session';
import { room } from './room';

// Player store is now derived from session
export const player = derived(
  session,
  ($session) => ({
    id: $session.playerId || '',
    nickname: $session.nickname || '',
    team: null as 'red' | 'blue' | null,
    role: null as 'spymaster' | 'operative' | null
  })
);

// Extended player store with actions
function createPlayerActions() {
  return {
    /**
     * Update nickname
     */
    async updateNickname(nickname: string): Promise<boolean> {
      return session.updateNickname(nickname);
    },

    /**
     * Join a team with a role
     */
    async joinTeam(team: 'red' | 'blue', role: 'spymaster' | 'operative'): Promise<boolean> {
      const teamResult = await room.changeTeam(team);
      if (!teamResult.success) {
        console.error('Failed to change team:', teamResult.error);
        return false;
      }

      if (role === 'spymaster') {
        const roleResult = await room.changeRole('spymaster');
        if (!roleResult.success) {
          console.error('Failed to become spymaster:', roleResult.error);
          return false;
        }
      }

      return true;
    },

    /**
     * Leave current team
     */
    async leaveTeam(): Promise<boolean> {
      const result = await room.changeTeam(null);
      return result.success;
    },

    /**
     * Become spymaster (if on team)
     */
    async becomeSpymaster(): Promise<boolean> {
      const result = await room.changeRole('spymaster');
      return result.success;
    },

    /**
     * Become operative
     */
    async becomeOperative(): Promise<boolean> {
      const result = await room.changeRole('operative');
      return result.success;
    }
  };
}

export const playerActions = createPlayerActions();

// Derived store for checking if current player is spymaster
export const isSpymaster = derived(
  [room, session],
  ([$room, $session]) => {
    const playerInRoom = $room.players.find(p => p.id === $session.playerId);
    return playerInRoom?.role === 'spymaster';
  }
);
