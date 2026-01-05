import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPlayer, getPlayerByPublicId, updatePlayerNickname } from '$lib/server/db';
import { generateToken } from '$lib/server/auth';

// Create new session or resume existing
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { nickname, publicId } = await request.json();

    let player;
    
    if (publicId) {
      // Try to resume existing session
      player = await getPlayerByPublicId(publicId);
      
      if (!player) {
        // Player not found, create new one
        if (!nickname) {
          return json({ error: 'Nickname required for new player' }, { status: 400 });
        }
        player = await createPlayer(nickname);
      } else if (nickname && nickname !== player.nickname) {
        // Update nickname if provided and different
        await updatePlayerNickname(player.id, nickname);
        player.nickname = nickname;
      }
    } else {
      // Create new player
      if (!nickname) {
        return json({ error: 'Nickname required' }, { status: 400 });
      }
      
      if (nickname.length < 1 || nickname.length > 32) {
        return json({ error: 'Nickname must be between 1 and 32 characters' }, { status: 400 });
      }

      player = await createPlayer(nickname);
    }

    const token = generateToken(player);

    return json({
      token,
      player: {
        id: player.public_id,
        nickname: player.nickname
      }
    });
  } catch (error: any) {
    console.error('Session API error:', error);
    return json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
};

