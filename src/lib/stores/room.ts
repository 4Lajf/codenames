import { writable } from 'svelte/store';
import type { RoomState } from '../types';
import { MOCK_PLAYERS } from '../mocks/data';

const initialState: RoomState = {
  code: 'ABCD',
  hostId: '1',
  status: 'waiting',
  players: MOCK_PLAYERS
};

function createRoomStore() {
  const { subscribe, set, update } = writable<RoomState>(initialState);

  return {
    subscribe,
    set,
    update,
    setRoomCode: (code: string) => update(s => ({ ...s, code })),
    setStatus: (status: 'waiting' | 'playing') => update(s => ({ ...s, status })),
    // Mock functionality to update player list
    updatePlayers: (players: any[]) => update(s => ({ ...s, players }))
  };
}

export const room = createRoomStore();

