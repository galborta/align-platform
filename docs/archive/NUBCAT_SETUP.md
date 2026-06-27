# Add Description to Nubcat Project

## Step 1: Add Description Column

Go to your Supabase Dashboard → SQL Editor and run this:

```sql
-- Add description field to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN projects.description IS 'Project description displayed on the project page';
```

## Step 2: Add Nubcat Description

After running the migration, run this to add the Nubcat description:

```sql
-- Update Nubcat project with description
UPDATE projects 
SET description = 'Nubcat is a meme-inspired cryptocurrency on Solana that combines the playful essence of internet cat culture with DeFi and NFT functionality. With a capped supply of 1 billion tokens, 0% tax transactions, and a vibrant community-first approach, Nubcat emphasizes fun, humor, and creator alignment. The project features a liquidity pool burn mechanism and has demonstrated strong community support, including major holders donating to the original artist to strengthen long-term alignment.'
WHERE token_symbol ILIKE '%NUB%' OR token_name ILIKE '%nubcat%';
```

## Step 3: Verify

Check that the description was added:

```sql
SELECT id, token_name, token_symbol, description 
FROM projects 
WHERE token_symbol ILIKE '%NUB%' OR token_name ILIKE '%nubcat%';
```

## Done!

Now refresh the Nubcat project page and you should see the description appear below the token name and badges.

