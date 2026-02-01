import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { initSocket, disconnectSocket } from './socket';

interface SessionData {
  token: string | null;
  playerId: string | null;
  nickname: string | null;
  isAuthenticated: boolean;
}

const initialSession: SessionData = {
  token: null,
  playerId: null,
  nickname: null,
  isAuthenticated: false
};

function createSessionStore() {
  const { subscribe, set, update } = writable<SessionData>(initialSession);

  return {
    subscribe,

    /**
     * Initialize session from localStorage or create new
     */
    async init(nickname?: string): Promise<boolean> {
      if (!browser) return false;
      
      const savedToken = localStorage.getItem('codenames_token');
      const savedPlayerId = localStorage.getItem('codenames_player_id');
      const savedNickname = localStorage.getItem('codenames_nickname');

      try {
        const response = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname: nickname || savedNickname,
            publicId: savedPlayerId
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create session');
        }

        const data = await response.json();

        localStorage.setItem('codenames_token', data.token);
        localStorage.setItem('codenames_player_id', data.player.id);
        localStorage.setItem('codenames_nickname', data.player.nickname);

        set({
          token: data.token,
          playerId: data.player.id,
          nickname: data.player.nickname,
          isAuthenticated: true
        });

        initSocket(data.token);

        return true;
      } catch (error: any) {
        console.error('[Session] Init error:', error);
        return false;
      }
    },

    /**
     * Update nickname
     */
    async updateNickname(nickname: string): Promise<boolean> {
      if (!browser) return false;
      
      const current = get({ subscribe });
      
      try {
        const response = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname,
            publicId: current.playerId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update nickname');
        }

        const data = await response.json();

        localStorage.setItem('codenames_token', data.token);
        localStorage.setItem('codenames_nickname', data.player.nickname);

        update(s => ({
          ...s,
          token: data.token,
          nickname: data.player.nickname
        }));

        disconnectSocket();
        initSocket(data.token);

        return true;
      } catch (error: any) {
        console.error('[Session] Update nickname error:', error);
        return false;
      }
    },

    /**
     * Clear session
     */
    logout() {
      localStorage.removeItem('codenames_token');
      localStorage.removeItem('codenames_player_id');
      localStorage.removeItem('codenames_nickname');
      disconnectSocket();
      set(initialSession);
    }
  };
}

export const session = createSessionStore();

