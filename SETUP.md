# Environment Setup

## Create .env.local file

Create a `.env.local` file in the root directory with the following contents:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://szunhbkqmfbbcrefycxh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dW5oYmtxbWZiYmNyZWZ5Y3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzI0NjAsImV4cCI6MjA3ODgwODQ2MH0.sokDZz4GN9nLCh9Y5Q-ODbSPfLxZdNC9vGeZ-M48Ceg
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
```

## Quick Setup Command

Run this command to create the file:

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://szunhbkqmfbbcrefycxh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6dW5oYmtxbWZiYmNyZWZ5Y3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzI0NjAsImV4cCI6MjA3ODgwODQ2MH0.sokDZz4GN9nLCh9Y5Q-ODbSPfLxZdNC9vGeZ-M48Ceg
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
EOF
```

## Supabase Configuration

The Supabase client is configured in `/lib/supabase.ts` and TypeScript types are defined in `/types/database.ts`.

### Database Schema

The following tables have been created in Supabase:

- **projects** - Main project table
- **social_assets** - Social media accounts
- **creative_assets** - Creative content (logos, characters, artwork)
- **legal_assets** - Legal documents (domains, trademarks, copyrights)
- **team_wallets** - Team member wallet addresses

### Storage

- **project-assets** bucket for image uploads (50MB limit, public access)



