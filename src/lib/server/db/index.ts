import { supabase } from '../supabaseAdmin';
import type { Player, Room, RoomPlayer, Game, Card, Database } from '../database.types';
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
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as Player;
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
    // @ts-ignore - Supabase type inference issue
    .update({ nickname } as any)
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
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as Room;
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
    // @ts-ignore - Supabase type inference issue
    .update({ status } as any)
    .eq('id', roomId);

  if (error) throw error;
}

export async function updateRoomHost(roomId: string, hostPlayerId: string | null): Promise<void> {
  // @ts-ignore - Supabase type inference issue
  const { error } = await (supabase as any)
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
    // @ts-ignore - Supabase type inference issue
    .insert({ 
      room_id: roomId, 
      player_id: playerId,
      team: null,
      role: null
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as RoomPlayer;
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
    // @ts-ignore - Supabase type inference issue
    .update({ team: team ?? null, role: role ?? null } as any)
    .eq('room_id', roomId)
    .eq('player_id', playerId);

  if (error) throw error;
}

export interface RoomPlayerWithDetails extends RoomPlayer {
  nickname: string;
  public_id: string;
}

export async function getRoomPlayers(roomId: string): Promise<RoomPlayerWithDetails[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select(`
      *,
      players (nickname, public_id)
    `)
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  
  return ((data || []) as any[]).map((rp: any) => ({
    ...rp,
    nickname: rp.players?.nickname || 'Unknown',
    public_id: rp.players?.public_id || ''
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
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as Game;
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
  const { data, error } = await ((supabase as any)
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single()) as { data: Game; error: any };

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
    .insert(cardsToInsert as any)
    .select();

  if (error) throw error;
  return (data || []) as Card[];
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
    // @ts-ignore - Supabase type inference issue
    .update({ 
      revealed: true, 
      revealed_at: new Date().toISOString(),
      revealed_by: playerId
    } as any)
    .eq('id', cardId)
    .select()
    .single();

  if (error) throw error;
  return data as Card;
}

// ============================================
// Word Bank Operations
// ============================================

export async function getRandomWords(count: number = 25): Promise<string[]> {
  // Get all words and randomly select
  const { data, error } = await supabase
    .from('word_bank')
    .select('word');

  if (error) throw error;
  if (!data || data.length < count) {
    throw new Error(`Not enough words in word bank. Need ${count}, have ${data?.length || 0}`);
  }

  // Shuffle and take first 'count' words
  const shuffled = [...(data as Array<{ word: string }>)].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(w => w.word);
}

// ============================================
// Game Log Operations
// ============================================

export async function createGameLog(
  gameId: string,
  type: 'system' | 'clue' | 'guess' | 'turn',
  message: string,
  team?: 'red' | 'blue' | null
): Promise<void> {
  const { error } = await supabase
    .from('game_logs')
    .insert({
      game_id: gameId,
      type,
      message,
      team: team || null
    } as any);

  if (error) throw error;
}

export async function getGameLogs(gameId: string): Promise<Array<{
  type: 'system' | 'clue' | 'guess' | 'turn';
  team?: 'red' | 'blue' | null;
  message: string;
  timestamp: number;
}>> {
  const { data, error } = await supabase
    .from('game_logs')
    .select('type, team, message, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data || []) as any[]).map((log: any) => ({
    type: log.type as 'system' | 'clue' | 'guess' | 'turn',
    team: log.team as 'red' | 'blue' | null | undefined,
    message: log.message,
    timestamp: new Date(log.created_at).getTime()
  }));
}

export async function deleteGameLogs(gameId: string): Promise<void> {
  const { error } = await supabase
    .from('game_logs')
    .delete()
    .eq('game_id', gameId);

  if (error) throw error;
}


