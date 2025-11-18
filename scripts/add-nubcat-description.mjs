#!/usr/bin/env node
/**
 * Script to add description to Nubcat project
 * Run with: node scripts/add-nubcat-description.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
let supabaseUrl, supabaseKey

try {
  const envPath = join(__dirname, '..', '.env.local')
  const envFile = readFileSync(envPath, 'utf8')
  const lines = envFile.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim()
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseKey = line.split('=')[1].trim()
    }
  }
} catch (error) {
  console.error('❌ Error reading .env.local file')
  console.error('Make sure .env.local exists with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🚀 Adding description to Nubcat project...\n')

  // Find Nubcat project
  console.log('🔍 Finding Nubcat project...')
  const { data: projects, error: findError } = await supabase
    .from('projects')
    .select('id, token_name, token_symbol, description')
    .or('token_symbol.ilike.%NUB%,token_name.ilike.%nubcat%')

  if (findError) {
    console.error('❌ Error finding project:', findError.message)
    
    if (findError.message.includes('description')) {
      console.log('\n⚠️  The description column does not exist yet!')
      console.log('📝 Please run this SQL first in Supabase Dashboard > SQL Editor:\n')
      console.log('ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;\n')
    }
    process.exit(1)
  }

  if (!projects || projects.length === 0) {
    console.log('⚠️  No Nubcat project found')
    process.exit(1)
  }

  console.log(`✅ Found project: ${projects[0].token_name} (${projects[0].token_symbol})`)

  // Update with description
  const description = "Nubcat is a meme-inspired cryptocurrency on Solana that combines the playful essence of internet cat culture with DeFi and NFT functionality. With a capped supply of 1 billion tokens, 0% tax transactions, and a vibrant community-first approach, Nubcat emphasizes fun, humor, and creator alignment. The project features a liquidity pool burn mechanism and has demonstrated strong community support, including major holders donating to the original artist to strengthen long-term alignment."

  console.log('\n📝 Updating description...')
  const { error: updateError } = await supabase
    .from('projects')
    .update({ description })
    .eq('id', projects[0].id)

  if (updateError) {
    console.error('❌ Error updating project:', updateError.message)
    process.exit(1)
  }

  console.log('✅ Successfully updated Nubcat description!')
  console.log('\n🎉 Done! Refresh the project page to see the description.')
}

main().catch(console.error)

