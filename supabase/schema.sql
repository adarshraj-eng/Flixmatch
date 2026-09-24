-- FlickMatch Database Schema
-- Run this in your Supabase project: SQL Editor → New Query → paste & run

-- ── Sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Flow: waiting → both_joined → generating → swiping_round_1 → (swiping_round_2 →) matched / finished
  status TEXT DEFAULT 'waiting' CHECK (status IN (
    'waiting', 'both_joined', 'generating',
    'swiping_round_1', 'generating_round_2', 'swiping_round_2',
    'matched', 'finished'
  )),
  current_round INT DEFAULT 1,
  titles JSONB DEFAULT '[]'::jsonb,          -- array of title objects
  titles_order_a JSONB DEFAULT '[]'::jsonb,  -- title IDs in Partner A's shuffle order
  titles_order_b JSONB DEFAULT '[]'::jsonb,  -- title IDs in Partner B's shuffle order
  match_title JSONB,                          -- the matched title (full object)
  top_picks JSONB DEFAULT '[]'::jsonb         -- top 5 when no match found
);

-- ── Preferences ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  partner TEXT NOT NULL CHECK (partner IN ('A', 'B')),
  moods TEXT[] DEFAULT '{}',
  mood_text TEXT DEFAULT '',
  languages TEXT[] DEFAULT '{}',
  content_type TEXT DEFAULT 'movies' CHECK (content_type IN ('movies', 'both')),
  min_rating NUMERIC DEFAULT 6,
  eras TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, partner)
);

-- ── Swipes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  partner TEXT NOT NULL CHECK (partner IN ('A', 'B')),
  title_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('right', 'left')),
  round_num INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, partner, title_id, round_num)
);

-- ── Watch Ratings (post-watch feedback) ──────────────────────────────
CREATE TABLE IF NOT EXISTS watch_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL,
  title_name TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Enable Realtime ───────────────────────────────────────────────────
-- Run these if realtime is not already enabled for these tables:
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE swipes;
ALTER PUBLICATION supabase_realtime ADD TABLE preferences;

-- ── Row Level Security ────────────────────────────────────────────────
-- For a personal/demo project, allow public access.
-- For production, tighten these with proper auth policies.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for preferences" ON preferences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for swipes" ON swipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for watch_ratings" ON watch_ratings FOR ALL USING (true) WITH CHECK (true);
