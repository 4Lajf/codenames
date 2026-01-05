import { writable, derived, get } from 'svelte/store';
import type { Player } from '../types';

// Initial mock player (User is player 5 in mock data)
const initialPlayer: Player = { 
  id: '5', 
  nickname: 'You', 
  team: 'red', 
  role: 'operative' 
};

function createPlayerStore() {
  const { subscribe, set, update } = writable<Player>(initialPlayer);

  return {
    subscribe,
    set,
    update,
    updateNickname: (nickname: string) => {
      update(p => ({ ...p, nickname }));
      // Also update the room's player list
      if (typeof window !== 'undefined') {
        import('./room').then(({ room }) => {
          room.update(r => ({
            ...r,
            players: r.players.map(p => 
              p.id === '5' ? { ...p, nickname } : p
            )
          }));
        });
      }
    },
    joinTeam: (team: 'red' | 'blue', role: 'operative' | 'spymaster') => {
      update(p => ({ ...p, team, role }));
      // Also update the room's player list
      if (typeof window !== 'undefined') {
        import('./room').then(({ room }) => {
          room.update(r => ({
            ...r,
            players: r.players.map(p => 
              p.id === '5' ? { ...p, team, role } : p
            )
          }));
        });
      }
    }
  };
}

export const player = createPlayerStore();

export const isSpymaster = derived(player, $player => $player.role === 'spymaster');

