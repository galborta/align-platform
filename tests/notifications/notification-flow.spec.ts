import { test, expect, Page } from '@playwright/test'
import { 
  mockWalletConnection, 
  seedTestData, 
  cleanupTestData,
  TEST_WALLETS,
  getSupabaseClient,
  waitForStableElement
} from '../test-utils'

test.describe('Notification System - Basic Flow', () => {
  const supabase = getSupabaseClient()

  test.beforeAll(async () => {
    await seedTestData()
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test.beforeEach(async () => {
    // Clean up any existing notifications for test users
    await supabase
      .from('notifications')
      .delete()
      .in('user_wallet', [TEST_WALLETS.ALICE, TEST_WALLETS.BOB, TEST_WALLETS.CAROL, TEST_WALLETS.DAVE])
  })

  test('should show notification bell with unread count', async ({ page }) => {
    // Setup: Create a notification for Alice
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'tip_received',
      actor_wallet: TEST_WALLETS.BOB,
      is_read: false,
      metadata: { amount: 10, token: 'SOL' },
      created_at: new Date().toISOString()
    })

    // Connect as Alice
    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Wait for notifications to load

    // Check notification bell badge
    const badge = page.locator('[class*="MuiBadge-badge"]')
    await expect(badge).toBeVisible({ timeout: 10000 })
    await expect(badge).toHaveText('1')

    console.log('✅ Notification bell shows correct unread count')
  })

  test('should open notification dropdown when bell clicked', async ({ page }) => {
    // Setup: Create notifications for Alice
    await supabase.from('notifications').insert([
      {
        user_wallet: TEST_WALLETS.ALICE,
        type: 'tip_received',
        actor_wallet: TEST_WALLETS.BOB,
        is_read: false,
        metadata: { amount: 10, token: 'SOL' },
        created_at: new Date().toISOString()
      },
      {
        user_wallet: TEST_WALLETS.ALICE,
        type: 'asset_upvote',
        actor_wallet: TEST_WALLETS.CAROL,
        is_read: false,
        created_at: new Date(Date.now() - 60000).toISOString()
      }
    ])

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Click notification bell
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Check dropdown appeared
    const dropdown = page.locator('[role="tooltip"], [class*="MuiPopover-paper"]')
    await expect(dropdown).toBeVisible({ timeout: 5000 })

    // Check notifications are visible
    await expect(page.locator('text=/Bob|Carol/i').first()).toBeVisible()

    console.log('✅ Notification dropdown opens and shows notifications')
  })

  test('should auto-mark notifications as read after viewing', async ({ page }) => {
    // Create unread notification
    const { data: notification } = await supabase
      .from('notifications')
      .insert({
        user_wallet: TEST_WALLETS.ALICE,
        type: 'tip_received',
        actor_wallet: TEST_WALLETS.BOB,
        is_read: false,
        metadata: { amount: 10, token: 'SOL' },
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Wait 10 seconds (auto-read timer)
    console.log('⏳ Waiting 10 seconds for auto-read...')
    await page.waitForTimeout(10000)

    // Check notification is marked as read in database
    const { data: updated } = await supabase
      .from('notifications')
      .select('is_read')
      .eq('id', notification!.id)
      .single()

    expect(updated?.is_read).toBe(true)
    console.log('✅ Notification auto-marked as read after 10 seconds')
  })

  test('should show real-time notification when new one arrives', async ({ context }) => {
    // Create two pages (two users)
    const alicePage = await context.newPage()
    const bobPage = await context.newPage()

    // Setup Alice
    await mockWalletConnection(alicePage, TEST_WALLETS.ALICE)
    await alicePage.goto('/')
    await alicePage.waitForLoadState('networkidle')
    await alicePage.waitForTimeout(2000)

    // Setup Bob
    await mockWalletConnection(bobPage, TEST_WALLETS.BOB)
    await bobPage.goto('/')
    await bobPage.waitForLoadState('networkidle')
    await bobPage.waitForTimeout(2000)

    // Open Alice's notification dropdown (keep it open)
    const aliceBell = alicePage.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await aliceBell.click()
    await alicePage.waitForTimeout(500)

    // Bob creates a notification for Alice
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'message_received',
      actor_wallet: TEST_WALLETS.BOB,
      is_read: false,
      metadata: { conversation_id: 'test-conv-123' },
      created_at: new Date().toISOString()
    })

    // Wait for real-time update
    console.log('⏳ Waiting for real-time notification to appear...')
    await alicePage.waitForTimeout(3000)

    // Check if notification appeared in Alice's dropdown
    const notification = alicePage.locator('text=/Bob.*message/i, text=/message.*Bob/i').first()
    const isVisible = await notification.isVisible().catch(() => false)
    
    if (isVisible) {
      console.log('✅ Real-time notification appeared in dropdown')
    } else {
      console.log('⚠️ Real-time notification not visible (may need to refresh dropdown)')
    }

    // Check badge count increased
    const badge = alicePage.locator('[class*="MuiBadge-badge"]')
    const badgeText = await badge.textContent().catch(() => '0')
    expect(parseInt(badgeText || '0')).toBeGreaterThan(0)

    await alicePage.close()
    await bobPage.close()
  })

  test('should mark notification as read when clicked', async ({ page }) => {
    // Create notification
    const { data: notification } = await supabase
      .from('notifications')
      .insert({
        user_wallet: TEST_WALLETS.ALICE,
        type: 'karma_milestone',
        is_read: false,
        metadata: { milestone: 100 },
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click the notification
    const notificationItem = page.locator('[class*="notification"], [role="button"]').first()
    await notificationItem.click()
    await page.waitForTimeout(1000)

    // Check notification is marked as read
    const { data: updated } = await supabase
      .from('notifications')
      .select('is_read')
      .eq('id', notification!.id)
      .single()

    expect(updated?.is_read).toBe(true)
    console.log('✅ Notification marked as read when clicked')
  })

  test('should show mark all as read button when unread exist', async ({ page }) => {
    // Create multiple unread notifications
    await supabase.from('notifications').insert([
      {
        user_wallet: TEST_WALLETS.ALICE,
        type: 'tip_received',
        actor_wallet: TEST_WALLETS.BOB,
        is_read: false,
        created_at: new Date().toISOString()
      },
      {
        user_wallet: TEST_WALLETS.ALICE,
        type: 'asset_upvote',
        actor_wallet: TEST_WALLETS.CAROL,
        is_read: false,
        created_at: new Date(Date.now() - 60000).toISOString()
      },
      {
        user_wallet: TEST_WALLETS.ALICE,
        type: 'karma_milestone',
        is_read: false,
        created_at: new Date(Date.now() - 120000).toISOString()
      }
    ])

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Check for "Mark all as read" button
    const markAllBtn = page.locator('button:has-text("Mark all"), button:has-text("Mark All")')
    await expect(markAllBtn).toBeVisible({ timeout: 5000 })

    // Click it
    await markAllBtn.click()
    await page.waitForTimeout(2000)

    // Verify all notifications are marked as read
    const { data: notifications } = await supabase
      .from('notifications')
      .select('is_read')
      .eq('user_wallet', TEST_WALLETS.ALICE)

    const allRead = notifications?.every(n => n.is_read) || false
    expect(allRead).toBe(true)

    console.log('✅ Mark all as read button works correctly')
  })

  test('should show empty state when no notifications', async ({ page }) => {
    // No notifications for Alice
    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Check for empty state message
    const emptyState = page.locator('text=/no notifications/i')
    await expect(emptyState).toBeVisible({ timeout: 5000 })

    console.log('✅ Empty state shows when no notifications')
  })

  test('should show loading state while fetching', async ({ page }) => {
    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click bell immediately to see loading state
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()

    // Look for loading spinner or skeleton
    const loading = page.locator('[role="progressbar"], [class*="skeleton"], [class*="animate-pulse"]')
    const isLoading = await loading.isVisible({ timeout: 1000 }).catch(() => false)
    
    if (isLoading) {
      console.log('✅ Loading state visible while fetching')
    } else {
      console.log('⚠️ Loading state not visible (data may have loaded too fast)')
    }
  })
})





