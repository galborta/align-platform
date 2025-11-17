-- Migration: Create chat_messages table
-- Description: Add table for real-time project chat with token holder verification
-- Date: 2025-11-17

-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  message_text TEXT NOT NULL CHECK (char_length(message_text) <= 500),
  token_balance BIGINT NOT NULL,
  token_percentage DECIMAL(10, 6) NOT NULL,
  holding_tier TEXT NOT NULL CHECK (holding_tier IN ('mega', 'whale', 'holder', 'small')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_project_messages ON chat_messages(project_id, created_at DESC);
CREATE INDEX idx_wallet_messages ON chat_messages(wallet_address, created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read messages for live projects
CREATE POLICY "Anyone can read messages for live projects"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = chat_messages.project_id 
      AND projects.status = 'live'
    )
  );

-- Policy: Anyone can insert messages (we validate holdings in API)
CREATE POLICY "Anyone can insert messages"
  ON chat_messages FOR INSERT
  WITH CHECK (true);

-- Enable Realtime for instant message updates
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

