import { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/database'

// Test wallet addresses (use these consistently across all tests)
export const TEST_WALLETS = {
  ALICE: 'ALICEtest11111111111111111111111111111111111',
  BOB: 'BOBtest222222222222222222222222222222222222',
  CAROL: 'CAROLtest3333333333333333333333333333333333',
  DAVE: 'DAVEtest44444444444444444444444444444444444',
}

// Initialize Supabase client for test setup/teardown
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseKey)
}

/**
 * Mock wallet connection for testing (no real wallet extension needed)
 * This injects test wallet data into the page's session storage
 */
export async function mockWalletConnection(
  page: Page,
  walletAddress: string
) {
  await page.addInitScript((address) => {
    // Mock Solana wallet adapter
    window.mockWallet = {
      publicKey: {
        toString: () => address,
        toBase58: () => address,
      },
      connected: true,
      signMessage: async () => new Uint8Array(64),
    }
    
    // Store in sessionStorage for app to read
    sessionStorage.setItem('test-wallet-address', address)
    sessionStorage.setItem('test-wallet-connected', 'true')
  }, walletAddress)
}

/**
 * Seed test profiles in database
 * Call this in beforeAll() to set up test data
 */
export async function seedTestData() {
  const supabase = getSupabaseClient()
  
  try {
    // Insert test user profiles
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert([
        {
          wallet_address: TEST_WALLETS.ALICE,
          display_name: 'Alice',
          bio: 'Test user Alice - for E2E testing',
          privacy_level: 'public',
          allow_messages_from: 'everyone',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          wallet_address: TEST_WALLETS.BOB,
          display_name: 'Bob',
          bio: 'Test user Bob - for E2E testing',
          privacy_level: 'public',
          allow_messages_from: 'everyone',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          wallet_address: TEST_WALLETS.CAROL,
          display_name: 'Carol',
          bio: 'Test user Carol - holders only',
          privacy_level: 'holders_only',
          allow_messages_from: 'holders_only',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          wallet_address: TEST_WALLETS.DAVE,
          display_name: 'Dave',
          bio: 'Test user Dave - private profile',
          privacy_level: 'private',
          allow_messages_from: 'nobody',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ], {
        onConflict: 'wallet_address'
      })

    if (profileError) {
      console.error('Error seeding profiles:', profileError)
      throw profileError
    }

    console.log('✅ Test profiles seeded successfully')
  } catch (error) {
    console.error('Failed to seed test data:', error)
    throw error
  }
}

/**
 * Cleanup test data
 * Call this in afterAll() to clean up after tests
 */
export async function cleanupTestData() {
  const supabase = getSupabaseClient()
  const testWallets = Object.values(TEST_WALLETS)
  
  try {
    // Delete test messages
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .or(testWallets.map(w => `sender_wallet.eq.${w}`).join(','))

    if (messagesError) {
      console.warn('Error cleaning up messages:', messagesError)
    }

    // Delete test conversations
    const { error: conversationsError } = await supabase
      .from('conversations')
      .delete()
      .or([
        ...testWallets.map(w => `participant_1.eq.${w}`),
        ...testWallets.map(w => `participant_2.eq.${w}`)
      ].join(','))

    if (conversationsError) {
      console.warn('Error cleaning up conversations:', conversationsError)
    }

    // Delete test typing indicators
    const { error: typingError } = await supabase
      .from('typing_indicators')
      .delete()
      .in('wallet_address', testWallets)

    if (typingError) {
      console.warn('Error cleaning up typing indicators:', typingError)
    }

    // Delete test blocked users
    const { error: blockedError } = await supabase
      .from('blocked_users')
      .delete()
      .or([
        ...testWallets.map(w => `blocker_wallet.eq.${w}`),
        ...testWallets.map(w => `blocked_wallet.eq.${w}`)
      ].join(','))

    if (blockedError) {
      console.warn('Error cleaning up blocked users:', blockedError)
    }

    console.log('✅ Test data cleaned up successfully')
  } catch (error) {
    console.error('Failed to cleanup test data:', error)
    // Don't throw - cleanup is best effort
  }
}

/**
 * Create a test conversation between two users
 * Useful for setting up state before tests
 */
export async function createTestConversation(
  participant1: string,
  participant2: string,
  messages: { sender: string; content: string }[] = []
) {
  const supabase = getSupabaseClient()
  
  // Order participants alphabetically
  const [p1, p2] = [participant1, participant2].sort()
  
  // Create conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert({
      participant_1: p1,
      participant_2: p2,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'participant_1,participant_2'
    })
    .select()
    .single()

  if (convError || !conversation) {
    throw new Error(`Failed to create test conversation: ${convError?.message}`)
  }

  // Add messages if provided
  if (messages.length > 0) {
    const { error: messagesError } = await supabase
      .from('messages')
      .insert(
        messages.map((msg, index) => ({
          conversation_id: conversation.id,
          sender_wallet: msg.sender,
          content: msg.content,
          is_read: false,
          created_at: new Date(Date.now() + index * 1000).toISOString(),
          updated_at: new Date(Date.now() + index * 1000).toISOString(),
        }))
      )

    if (messagesError) {
      throw new Error(`Failed to create test messages: ${messagesError.message}`)
    }
  }

  return conversation
}

/**
 * Wait for an element to appear and become stable
 * Useful for waiting for real-time updates
 */
export async function waitForStableElement(
  page: Page,
  selector: string,
  timeout: number = 5000
) {
  await page.waitForSelector(selector, { timeout, state: 'visible' })
  // Wait a bit for animations to settle
  await page.waitForTimeout(300)
}

/**
 * Type text slowly (simulates real typing)
 * Useful for triggering typing indicators
 */
export async function typeSlowly(
  page: Page,
  selector: string,
  text: string,
  delayMs: number = 100
) {
  const element = page.locator(selector)
  await element.click()
  
  for (const char of text) {
    await element.pressSequentially(char)
    await page.waitForTimeout(delayMs)
  }
}

/**
 * Get the count of unread messages for a user
 */
export async function getUnreadCount(walletAddress: string): Promise<number> {
  const supabase = getSupabaseClient()
  
  // Get conversations where user is a participant
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)
  
  if (!conversations || conversations.length === 0) {
    return 0
  }
  
  const conversationIds = conversations.map(c => c.id)
  
  // Count unread messages
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .neq('sender_wallet', walletAddress)
    .eq('is_read', false)
  
  return count || 0
}

/**
 * Format wallet address for display (same as app logic)
 */
export function formatWalletAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Wait for text to appear in an element
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string,
  timeout: number = 5000
) {
  await page.waitForFunction(
    ({ sel, txt }) => {
      const element = document.querySelector(sel)
      return element && element.textContent?.includes(txt)
    },
    { sel: selector, txt: text },
    { timeout }
  )
}

/**
 * Check if an element exists without throwing
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000, state: 'visible' })
    return true
  } catch {
    return false
  }
}

/**
 * Open the messages sidebar by clicking the Mail icon in the header
 */
export async function openMessagesSidebar(page: Page): Promise<void> {
  try {
    // Wait for page to be ready
    await page.waitForLoadState('networkidle')
    
    // Use keyboard shortcut (most reliable method)
    // Cmd+M on Mac, Ctrl+M on others
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+KeyM' : 'Control+KeyM')
    
    // Wait for sidebar to appear (drawer animation)
    await page.waitForTimeout(800)
    
    console.log('✅ Messages sidebar opened via keyboard shortcut')
  } catch (error) {
    console.error('❌ Failed to open messages sidebar:', error)
    throw error
  }
}

/**
 * Open a conversation with a specific user (waits for it to appear in list)
 */
export async function openConversation(page: Page, userName: string): Promise<void> {
  try {
    // Wait for conversation list to load (look for any conversation or the user)
    await page.waitForTimeout(1000)
    
    // Try to find the conversation
    const conversation = page.locator(`text=${userName}`).first()
    
    // Wait up to 5 seconds for conversation to appear
    const isVisible = await conversation.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (isVisible) {
      await conversation.click()
      await page.waitForTimeout(500)
      console.log(`✅ Opened conversation with ${userName}`)
    } else {
      // Conversation not found - might need to create it
      console.log(`⚠️ Conversation with ${userName} not found, may need to start new conversation`)
      
      // Try clicking "New Message" button
      const newBtn = page.getByRole('button', { name: /new|start/i }).first()
      if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newBtn.click()
        await page.waitForTimeout(500)
        console.log('✅ Clicked new message button')
      }
    }
  } catch (error) {
    console.error(`❌ Failed to open conversation with ${userName}:`, error)
    throw error
  }
}

/**
 * Get current conversation count for a user
 */
export async function getConversationCount(walletAddress: string): Promise<number> {
  const supabase = getSupabaseClient()
  
  const { count } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .or(`participant_1.eq.${walletAddress},participant_2.eq.${walletAddress}`)
  
  return count || 0
}

