-- Migration: Community Curation System
-- Created: 2024-11-20
-- Description: Adds token-gated community curation system for IP assets

-- 1. Pending assets (separate from verified assets)
CREATE TABLE pending_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL, -- 'social', 'creative', 'legal'
  asset_data JSONB NOT NULL, -- Stores platform, handle, etc
  submitter_wallet TEXT NOT NULL,
  submission_token_balance NUMERIC NOT NULL,
  submission_token_percentage NUMERIC(10,6) NOT NULL,
  
  -- Voting metrics
  total_upvote_weight NUMERIC(10,6) DEFAULT 0, -- Sum of upvoter supply %
  unique_upvoters_count INT DEFAULT 0,
  total_report_weight NUMERIC(10,6) DEFAULT 0,
  unique_reporters_count INT DEFAULT 0,
  
  -- Status tracking
  verification_status TEXT DEFAULT 'pending', -- pending, backed, verified, hidden
  verified_at TIMESTAMP,
  hidden_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Asset votes (tracks every upvote/report)
CREATE TABLE asset_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pending_asset_id UUID REFERENCES pending_assets(id) ON DELETE CASCADE,
  voter_wallet TEXT NOT NULL,
  vote_type TEXT NOT NULL, -- 'upvote', 'report'
  token_balance_snapshot NUMERIC NOT NULL,
  token_percentage_snapshot NUMERIC(10,6) NOT NULL,
  karma_earned NUMERIC DEFAULT 0, -- Awarded when asset reaches final state
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(pending_asset_id, voter_wallet) -- One vote per wallet per asset
);

-- 3. Wallet karma (per project)
CREATE TABLE wallet_karma (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Karma tracking
  total_karma_points NUMERIC DEFAULT 0,
  assets_added_count INT DEFAULT 0,
  upvotes_given_count INT DEFAULT 0,
  reports_given_count INT DEFAULT 0,
  
  -- Ban system
  warning_count INT DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMP,
  ban_expires_at TIMESTAMP,
  
  -- Warning history (JSONB array of warnings with timestamps)
  warnings JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(wallet_address, project_id)
);

-- 4. Chat system messages for curation actions
CREATE TABLE curation_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL, -- 'asset_added', 'asset_backed', 'asset_verified', 'asset_hidden', 'wallet_banned'
  
  wallet_address TEXT,
  token_percentage NUMERIC(10,6),
  
  -- Asset reference
  pending_asset_id UUID REFERENCES pending_assets(id),
  asset_type TEXT,
  asset_summary TEXT, -- e.g. "instagram @sillynubcat"
  
  -- Voting stats (for status updates)
  vote_count INT,
  supply_percentage NUMERIC(10,6),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pending_assets_project ON pending_assets(project_id, verification_status);
CREATE INDEX idx_pending_assets_submitter ON pending_assets(submitter_wallet);
CREATE INDEX idx_asset_votes_pending ON asset_votes(pending_asset_id);
CREATE INDEX idx_asset_votes_wallet ON asset_votes(voter_wallet);
CREATE INDEX idx_wallet_karma_project ON wallet_karma(project_id, total_karma_points DESC);
CREATE INDEX idx_wallet_karma_wallet ON wallet_karma(wallet_address);
CREATE INDEX idx_curation_chat_project ON curation_chat_messages(project_id, created_at DESC);

-- RLS Policies
ALTER TABLE pending_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_karma ENABLE ROW LEVEL SECURITY;
ALTER TABLE curation_chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read for live projects
CREATE POLICY "Public read for live projects" ON pending_assets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = pending_assets.project_id AND projects.status = 'live')
  );

CREATE POLICY "Public read karma" ON wallet_karma FOR SELECT USING (true);
CREATE POLICY "Public read chat" ON curation_chat_messages FOR SELECT USING (true);

-- Anyone can insert (validation happens in app layer)
CREATE POLICY "Anyone can vote" ON asset_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can submit" ON pending_assets FOR INSERT WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE pending_assets;
ALTER PUBLICATION supabase_realtime ADD TABLE asset_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE wallet_karma;
ALTER PUBLICATION supabase_realtime ADD TABLE curation_chat_messages;

