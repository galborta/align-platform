-- Fix RLS policies for curation_chat_messages
-- Allow anyone to insert chat messages (validation happens in app layer)

CREATE POLICY "Anyone can post to curation chat" ON curation_chat_messages
  FOR INSERT WITH CHECK (true);

-- Also add INSERT policy for pending_assets if not already there
-- This ensures asset submissions work
CREATE POLICY "Anyone can insert pending assets" ON pending_assets
  FOR INSERT WITH CHECK (true);

