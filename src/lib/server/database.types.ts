// Database types for Supabase
// These types mirror the schema defined in schema.sql

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          public_id: string;
          nickname: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          public_id: string;
          nickname: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          public_id?: string;
          nickname?: string;
          created_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          status: 'waiting' | 'playing' | 'finished';
          host_player_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          status?: 'waiting' | 'playing' | 'finished';
          host_player_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          status?: 'waiting' | 'playing' | 'finished';
          host_player_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      room_players: {
        Row: {
          id: string;
          room_id: string;
          player_id: string;
          team: 'red' | 'blue' | null;
          role: 'spymaster' | 'operative' | null;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          player_id: string;
          team?: 'red' | 'blue' | null;
          role?: 'spymaster' | 'operative' | null;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          player_id?: string;
          team?: 'red' | 'blue' | null;
          role?: 'spymaster' | 'operative' | null;
          joined_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          room_id: string;
          current_turn: 'red' | 'blue';
          clue_word: string | null;
          clue_count: number | null;
          guesses_remaining: number | null;
          red_cards_remaining: number;
          blue_cards_remaining: number;
          winner: 'red' | 'blue' | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          current_turn: 'red' | 'blue';
          clue_word?: string | null;
          clue_count?: number | null;
          guesses_remaining?: number | null;
          red_cards_remaining?: number;
          blue_cards_remaining?: number;
          winner?: 'red' | 'blue' | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          room_id?: string;
          current_turn?: 'red' | 'blue';
          clue_word?: string | null;
          clue_count?: number | null;
          guesses_remaining?: number | null;
          red_cards_remaining?: number;
          blue_cards_remaining?: number;
          winner?: 'red' | 'blue' | null;
          started_at?: string;
          finished_at?: string | null;
        };
      };
      cards: {
        Row: {
          id: string;
          game_id: string;
          word: string;
          position: number;
          type: 'red' | 'blue' | 'neutral' | 'assassin';
          revealed: boolean;
          revealed_at: string | null;
          revealed_by: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          word: string;
          position: number;
          type: 'red' | 'blue' | 'neutral' | 'assassin';
          revealed?: boolean;
          revealed_at?: string | null;
          revealed_by?: string | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          word?: string;
          position?: number;
          type?: 'red' | 'blue' | 'neutral' | 'assassin';
          revealed?: boolean;
          revealed_at?: string | null;
          revealed_by?: string | null;
        };
      };
      word_bank: {
        Row: {
          id: string;
          word: string;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          word: string;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          word?: string;
          category?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

// Convenient type aliases
export type Player = Database['public']['Tables']['players']['Row'];
export type Room = Database['public']['Tables']['rooms']['Row'];
export type RoomPlayer = Database['public']['Tables']['room_players']['Row'];
export type Game = Database['public']['Tables']['games']['Row'];
export type Card = Database['public']['Tables']['cards']['Row'];
export type WordBankEntry = Database['public']['Tables']['word_bank']['Row'];

