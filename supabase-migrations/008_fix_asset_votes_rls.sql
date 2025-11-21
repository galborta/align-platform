-- Fix RLS policies for asset_votes table
-- Add SELECT policy so users can check if they've already voted

CREATE POLICY "Anyone can read asset votes" ON asset_votes
  FOR SELECT USING (true);

