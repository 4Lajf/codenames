import { writable, get } from 'svelte/store';
import type { RoomState, Player } from '../types';
import { getSocket, emitWithAck } from './socket';

const initialState: RoomState = {
  code: '',
  hostId: '',
  status: 'waiting',
  players: []
};

function createRoomStore() {
  const { subscribe, set, update } = writable<RoomState>(initialState);

  // Setup socket event listeners
  function setupListeners() {
    const socket = getSocket();
    if (!socket) return;

    // Remove any existing listeners before adding new ones to prevent duplicates
    socket.off('room:playerJoined');
    socket.off('room:playerLeft');
    socket.off('room:updated');
    socket.off('room:hostChanged');
    socket.off('room:statusChanged');
    socket.off('room:kicked');
    socket.off('game:reset');

    socket.on('room:playerJoined', ({ player }: { player: Player }) => {
      update(s => ({
        ...s,
        players: [...s.players, player]
      }));
    });

    socket.on('room:playerLeft', ({ playerId, players }: { playerId: string; players: Player[] }) => {
      update(s => ({
        ...s,
        players
      }));
    });

    socket.on('room:updated', ({ players }: { players: Player[] }) => {
      update(s => ({
        ...s,
        players
      }));
    });

    socket.on('room:hostChanged', ({ hostId }: { hostId: string }) => {
      update(s => ({
        ...s,
        hostId
      }));
    });

    socket.on('room:statusChanged', ({ status }: { status: RoomState['status'] }) => {
      update(s => ({
        ...s,
        status
      }));
    });

    socket.on('room:kicked', ({ reason }: { reason: string }) => {
      // Player was kicked, reset room state and show message
      set(initialState);
      alert(reason || 'You have been kicked from the room');
      // Redirect to home
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    });

    // Handle game reset - room goes back to waiting, players are reset
    socket.on('game:reset', () => {
      update(s => ({
        ...s,
        status: 'waiting'
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
     * Create a new room
     */
    async create(code: string, customWords?: string[]): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await emitWithAck<{ success: boolean; room: RoomState; error?: string }>(
          'room:create', 
          { code, customWords }
        );
        
        if (response.room) {
          set(response.room);
        }
        
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Join an existing room
     */
    async join(code: string): Promise<{ success: boolean; error?: string }> {
      try {
        const response = await emitWithAck<{ success: boolean; room: RoomState; error?: string }>(
          'room:join',
          { code }
        );
        
        if (response.room) {
          set(response.room);
        }
        
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Leave current room
     */
    async leave(): Promise<void> {
      try {
        await emitWithAck('room:leave', {});
        set(initialState);
      } catch (error) {
        console.error('Failed to leave room:', error);
        set(initialState);
      }
    },

    /**
     * Change team
     */
    async changeTeam(team: 'red' | 'blue' | null): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('room:changeTeam', { team });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Change role
     */
    async changeRole(role: 'spymaster' | 'operative'): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('room:changeRole', { role });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Randomize teams
     */
    async randomizeTeams(): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('room:randomizeTeams', {});
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Transfer host to another player
     */
    async transferHost(playerId: string): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('room:transferHost', { playerId });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Kick a player from the room (host only)
     */
    async kickPlayer(playerId: string): Promise<{ success: boolean; error?: string }> {
      try {
        await emitWithAck('room:kickPlayer', { playerId });
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    /**
     * Set room code (for display)
     */
    setRoomCode(code: string) {
      update(s => ({ ...s, code }));
    },

    /**
     * Set room status
     */
    setStatus(status: 'waiting' | 'playing') {
      update(s => ({ ...s, status }));
    },

    /**
     * Reset room state
     */
    reset() {
      set(initialState);
    }
  };
}

export const room = createRoomStore();
