import { supabase } from '../supabaseAdmin';
import type { Player, Room, RoomPlayer, Game, Card } from '../database.types';
import { v4 as uuidv4 } from 'uuid';

// Generate a short public ID for players
function generatePublicId(): string {
  return uuidv4().substring(0, 12).replace(/-/g, '');
}

// ============================================
// Player Operations
// ============================================

export async function createPlayer(nickname: string): Promise<Player> {
  const publicId = generatePublicId();
  
  const { data, error } = await supabase
    .from('players')
    .insert({ 
      public_id: publicId, 
      nickname 
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPlayer(id: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPlayerByPublicId(publicId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('public_id', publicId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updatePlayerNickname(id: string, nickname: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ nickname })
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// Room Operations
// ============================================

export async function createRoom(code: string, hostPlayerId: string): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ 
      code: code.toUpperCase(),
      host_player_id: hostPlayerId,
      status: 'waiting'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getRoomById(id: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select()
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateRoomStatus(roomId: string, status: Room['status']): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', roomId);

  if (error) throw error;
}

export async function updateRoomHost(roomId: string, hostPlayerId: string | null): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ host_player_id: hostPlayerId })
    .eq('id', roomId);

  if (error) throw error;
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId);

  if (error) throw error;
}

// ============================================
// Room Player Operations
// ============================================

export async function joinRoom(roomId: string, playerId: string): Promise<RoomPlayer> {
  // Check if player already in room
  const existing = await getRoomPlayer(roomId, playerId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('room_players')
    .insert({ 
      room_id: roomId, 
      player_id: playerId,
      team: null,
      role: null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', playerId);

  if (error) throw error;
}

export async function getRoomPlayer(roomId: string, playerId: string): Promise<RoomPlayer | null> {
  const { data, error } = await supabase
    .from('room_players')
    .select()
    .eq('room_id', roomId)
    .eq('player_id', playerId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function setTeamAndRole(
  roomId: string, 
  playerId: string, 
  team: RoomPlayer['team'], 
  role: RoomPlayer['role']
): Promise<void> {
  const { error } = await supabase
    .from('room_players')
    .update({ team, role })
    .eq('room_id', roomId)
    .eq('player_id', playerId);

  if (error) throw error;
}

export interface RoomPlayerWithDetails extends RoomPlayer {
  nickname: string;
}

export async function getRoomPlayers(roomId: string): Promise<RoomPlayerWithDetails[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select(`
      *,
      players (nickname)
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  
  return (data || []).map(rp => ({
    ...rp,
    nickname: (rp.players as any)?.nickname || 'Unknown'
  }));
}

export async function getRoomPlayerCount(roomId: string): Promise<number> {
  const { count, error } = await supabase
    .from('room_players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId);

  if (error) throw error;
  return count || 0;
}

export async function isSpymasterTaken(roomId: string, team: 'red' | 'blue'): Promise<boolean> {
  const { data, error } = await supabase
    .from('room_players')
    .select('id')
    .eq('room_id', roomId)
    .eq('team', team)
    .eq('role', 'spymaster')
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

// ============================================
// Game Operations
// ============================================

export async function createGame(roomId: string, firstTeam: 'red' | 'blue'): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .insert({ 
      room_id: roomId,
      current_turn: firstTeam,
      red_cards_remaining: firstTeam === 'red' ? 9 : 8,
      blue_cards_remaining: firstTeam === 'blue' ? 9 : 8
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGameByRoomId(roomId: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select()
    .eq('room_id', roomId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getGameById(gameId: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select()
    .eq('id', gameId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateGameState(gameId: string, updates: Partial<Game>): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGameByRoomId(roomId: string): Promise<void> {
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('room_id', roomId);

  if (error) throw error;
}

// ============================================
// Card Operations
// ============================================

export async function createGameCards(gameId: string, cards: Array<{ word: string; position: number; type: Card['type'] }>): Promise<Card[]> {
  const cardsToInsert = cards.map(card => ({
    game_id: gameId,
    word: card.word,
    position: card.position,
    type: card.type,
    revealed: false
  }));

  const { data, error } = await supabase
    .from('cards')
    .insert(cardsToInsert)
    .select();

  if (error) throw error;
  return data;
}

export async function getGameCards(gameId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select()
    .eq('game_id', gameId)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getCardByPosition(gameId: string, position: number): Promise<Card | null> {
  const { data, error } = await supabase
    .from('cards')
    .select()
    .eq('game_id', gameId)
    .eq('position', position)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function revealCard(cardId: string, playerId: string): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update({ 
      revealed: true, 
      revealed_at: new Date().toISOString(),
      revealed_by: playerId
    })
    .eq('id', cardId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// Word Bank Operations
// ============================================

export async function getRandomWords(count: number = 25): Promise<string[]> {
  // Get total count of words
  const { count: totalCount, error: countError } = await supabase
    .from('word_bank')
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;

  // Generate random offset
  const maxOffset = Math.max(0, (totalCount || 0) - count);
  const randomOffset = Math.floor(Math.random() * maxOffset);

  // Fetch more words and shuffle to get truly random selection
  const { data, error } = await supabase
    .from('word_bank')
    .select('word')
    .range(0, Math.min((totalCount || 0) - 1, 199)); // Get up to 200 words

  if (error) throw error;

  // Shuffle and take required count
  const words = (data || []).map(w => w.word);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  return words.slice(0, count);
}

