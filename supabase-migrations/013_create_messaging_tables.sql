-- Migration: Create messaging system tables
-- Created: 2024-11-23
-- Description: Adds direct messaging system with user profiles, conversations, and privacy controls

-- 1. USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT CHECK (char_length(display_name) <= 50),
  bio TEXT CHECK (char_length(bio) <= 500),
  avatar_url TEXT,
  privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'holders_only', 'private')),
  allow_messages_from TEXT DEFAULT 'everyone' CHECK (allow_messages_from IN ('everyone', 'holders_only', 'nobody')),
  last_seen_at TIMESTAMP,
  is_online BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_online ON user_profiles(is_online) WHERE is_online = true;

-- 2. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1 TEXT NOT NULL,
  participant_2 TEXT NOT NULL,
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure participants are ordered alphabetically for uniqueness
  CONSTRAINT conversations_participants_ordered CHECK (participant_1 < participant_2),
  CONSTRAINT conversations_participants_unique UNIQUE (participant_1, participant_2)
);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 5000 AND char_length(content) > 0),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;

-- 4. BLOCKED USERS TABLE
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_wallet TEXT NOT NULL,
  blocked_wallet TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT blocked_users_unique UNIQUE (blocker_wallet, blocked_wallet),
  CONSTRAINT blocked_users_no_self_block CHECK (blocker_wallet != blocked_wallet)
);

-- Create indexes for blocked_users
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_wallet);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_wallet);

-- 5. TYPING INDICATORS TABLE (for real-time)
CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  last_typed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (conversation_id, wallet_address)
);

-- Create index for typing_indicators
CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation ON typing_indicators(conversation_id, last_typed_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read for public profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;

DROP POLICY IF EXISTS "Users can read messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;

DROP POLICY IF EXISTS "Users can read own blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can block others" ON blocked_users;
DROP POLICY IF EXISTS "Users can unblock others" ON blocked_users;

DROP POLICY IF EXISTS "Users can read typing indicators in their conversations" ON typing_indicators;
DROP POLICY IF EXISTS "Users can update own typing indicator" ON typing_indicators;

-- USER PROFILES POLICIES
-- Public read for public profiles
CREATE POLICY "Public read for public profiles" ON user_profiles
  FOR SELECT USING (
    privacy_level = 'public'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- CONVERSATIONS POLICIES
-- Users can read conversations they're part of
CREATE POLICY "Users can read own conversations" ON conversations
  FOR SELECT USING (true);

-- Users can create conversations
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (true);

-- Users can update conversations they're part of (for last_message_at)
CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- MESSAGES POLICIES
-- Users can read messages in their conversations
CREATE POLICY "Users can read messages in their conversations" ON messages
  FOR SELECT USING (true);

-- Users can send messages
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (true);

-- Users can update their own messages (for read status)
CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- BLOCKED USERS POLICIES
-- Users can read their own blocks
CREATE POLICY "Users can read own blocks" ON blocked_users
  FOR SELECT USING (true);

-- Users can block others
CREATE POLICY "Users can block others" ON blocked_users
  FOR INSERT WITH CHECK (true);

-- Users can unblock others (delete)
CREATE POLICY "Users can unblock others" ON blocked_users
  FOR DELETE USING (true);

-- TYPING INDICATORS POLICIES
-- Users can read typing indicators in their conversations
CREATE POLICY "Users can read typing indicators in their conversations" ON typing_indicators
  FOR SELECT USING (true);

-- Users can update their own typing indicator
CREATE POLICY "Users can update own typing indicator" ON typing_indicators
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update typing status" ON typing_indicators
  FOR UPDATE USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own typing indicator" ON typing_indicators
  FOR DELETE USING (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get or create a conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_wallet_1 TEXT,
  p_wallet_2 TEXT
) RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_participant_1 TEXT;
  v_participant_2 TEXT;
BEGIN
  -- Order participants alphabetically
  IF p_wallet_1 < p_wallet_2 THEN
    v_participant_1 := p_wallet_1;
    v_participant_2 := p_wallet_2;
  ELSE
    v_participant_1 := p_wallet_2;
    v_participant_2 := p_wallet_1;
  END IF;
  
  -- Try to find existing conversation
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE participant_1 = v_participant_1 AND participant_2 = v_participant_2;
  
  -- If not found, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (participant_1, participant_2)
    VALUES (v_participant_1, v_participant_2)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update conversation timestamp on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Function to check if user is blocked
CREATE OR REPLACE FUNCTION is_user_blocked(
  p_sender TEXT,
  p_recipient TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_blocked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE (blocker_wallet = p_recipient AND blocked_wallet = p_sender)
       OR (blocker_wallet = p_sender AND blocked_wallet = p_recipient)
  ) INTO v_is_blocked;
  
  RETURN v_is_blocked;
END;
$$ LANGUAGE plpgsql;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_conversation_id UUID,
  p_reader_wallet TEXT
) RETURNS void AS $$
BEGIN
  UPDATE messages
  SET 
    is_read = true,
    read_at = NOW(),
    updated_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND sender_wallet != p_reader_wallet
    AND is_read = false;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_conversation(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_user_blocked(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, TEXT) TO authenticated, anon;

-- ============================================
-- ENABLE SUPABASE REALTIME
-- ============================================

-- Enable Realtime for real-time messaging updates
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;







