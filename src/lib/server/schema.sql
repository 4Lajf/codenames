-- Codenames Database Schema
-- Run this in your Supabase SQL Editor

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id VARCHAR(12) UNIQUE NOT NULL,
  nickname VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  host_player_id UUID REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room-Player relationships
CREATE TABLE room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  team VARCHAR(10) CHECK (team IN ('red', 'blue', NULL)),
  role VARCHAR(20) CHECK (role IN ('spymaster', 'operative', NULL)),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, player_id)
);

-- Games table (one per room when game starts)
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
  current_turn VARCHAR(10) NOT NULL CHECK (current_turn IN ('red', 'blue')),
  clue_word VARCHAR(50),
  clue_count INTEGER,
  guesses_remaining INTEGER,
  red_cards_remaining INTEGER DEFAULT 9,
  blue_cards_remaining INTEGER DEFAULT 8,
  winner VARCHAR(10) CHECK (winner IN ('red', 'blue', NULL)),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Cards table (25 per game)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  word VARCHAR(50) NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0 AND position < 25),
  type VARCHAR(20) NOT NULL CHECK (type IN ('red', 'blue', 'neutral', 'assassin')),
  revealed BOOLEAN DEFAULT FALSE,
  revealed_at TIMESTAMPTZ,
  revealed_by UUID REFERENCES players(id),
  UNIQUE(game_id, position)
);

-- Word bank
CREATE TABLE word_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game logs table (stores game events)
CREATE TABLE game_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('system', 'clue', 'guess', 'turn')),
  team VARCHAR(10) CHECK (team IN ('red', 'blue', NULL)),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_room_players_room ON room_players(room_id);
CREATE INDEX idx_room_players_player ON room_players(player_id);
CREATE INDEX idx_cards_game ON cards(game_id);
CREATE INDEX idx_games_room ON games(room_id);
CREATE INDEX idx_players_public_id ON players(public_id);
CREATE INDEX idx_game_logs_game ON game_logs(game_id);
CREATE INDEX idx_game_logs_created ON game_logs(created_at);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using service role for server-side operations)
-- Allow service role to bypass RLS (server-side)
-- Note: Service role key should bypass RLS, but explicit policies ensure compatibility
CREATE POLICY "Service role access" ON players FOR ALL USING (auth.role() = 'service_role' OR true);
CREATE POLICY "Service role access" ON rooms FOR ALL USING (auth.role() = 'service_role' OR true);
CREATE POLICY "Service role access" ON room_players FOR ALL USING (auth.role() = 'service_role' OR true);
CREATE POLICY "Service role access" ON games FOR ALL USING (auth.role() = 'service_role' OR true);
CREATE POLICY "Service role access" ON cards FOR ALL USING (auth.role() = 'service_role' OR true);
CREATE POLICY "Service role access" ON word_bank FOR ALL USING (auth.role() = 'service_role' OR true);
CREATE POLICY "Service role access" ON game_logs FOR ALL USING (auth.role() = 'service_role' OR true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to rooms table
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

