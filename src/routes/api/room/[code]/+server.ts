import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRoomByCode, getRoomPlayerCount } from '$lib/server/db';

// Get room info by code
export const GET: RequestHandler = async ({ params }) => {
  try {
    const { code } = params;
    
    if (!code) {
      return json({ error: 'Room code required' }, { status: 400 });
    }

    const room = await getRoomByCode(code.toUpperCase());
    
    if (!room) {
      return json({ error: 'Room not found' }, { status: 404 });
    }

    const playerCount = await getRoomPlayerCount(room.id);

    return json({
      code: room.code,
      status: room.status,
      playerCount
    });
  } catch (error: any) {
    console.error('Room API error:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
};

