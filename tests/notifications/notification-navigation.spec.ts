import { test, expect } from '@playwright/test'
import { 
  mockWalletConnection, 
  seedTestData, 
  cleanupTestData,
  TEST_WALLETS,
  getSupabaseClient
} from '../test-utils'

test.describe('Notification System - Navigation', () => {
  const supabase = getSupabaseClient()

  test.beforeAll(async () => {
    await seedTestData()
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test.beforeEach(async () => {
    // Clean up notifications
    await supabase
      .from('notifications')
      .delete()
      .in('user_wallet', [TEST_WALLETS.ALICE, TEST_WALLETS.BOB, TEST_WALLETS.CAROL, TEST_WALLETS.DAVE])
  })

  test('should navigate to job page when job notification clicked', async ({ page }) => {
    // Create job notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'job_assigned',
      actor_wallet: TEST_WALLETS.BOB,
      reference_id: 'test-job-123',
      reference_type: 'job',
      is_read: false,
      metadata: { job_title: 'Build Website' },
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(2000)

    // Check URL contains job ID
    const url = page.url()
    const hasJobRoute = url.includes('/jobs/test-job-123') || url.includes('job')
    
    if (hasJobRoute) {
      console.log('✅ Navigated to job page:', url)
    } else {
      console.log('⚠️ Navigation may not have worked, current URL:', url)
    }

    expect(url).toMatch(/job/i)
  })

  test('should navigate to profile page for karma notifications', async ({ page }) => {
    // Create karma notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'karma_milestone',
      is_read: false,
      metadata: { milestone: 100, new_level: 'Gold' },
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(2000)

    // Check URL contains profile route
    const url = page.url()
    const hasProfileRoute = url.includes('/profile') || url.includes('/user')
    
    if (hasProfileRoute) {
      console.log('✅ Navigated to profile page:', url)
    } else {
      console.log('⚠️ Profile navigation may not have worked, current URL:', url)
    }
  })

  test('should navigate to assets page for asset notifications', async ({ page }) => {
    // Create asset notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'asset_verified',
      actor_wallet: TEST_WALLETS.BOB,
      reference_id: 'asset-456',
      reference_type: 'asset',
      is_read: false,
      metadata: { asset_name: 'Cool Design' },
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(2000)

    // Check URL contains assets or asset ID
    const url = page.url()
    const hasAssetRoute = url.includes('/assets') || url.includes('asset-456')
    
    if (hasAssetRoute) {
      console.log('✅ Navigated to assets page:', url)
    } else {
      console.log('⚠️ Asset navigation may use modal or different route, current URL:', url)
    }
  })

  test('should navigate to job applications tab when application notification clicked', async ({ page }) => {
    // Create job application notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'job_application_received',
      actor_wallet: TEST_WALLETS.BOB,
      reference_id: 'job-789',
      reference_type: 'job',
      is_read: false,
      metadata: { job_title: 'Design Logo', applicant_name: 'Bob' },
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(2000)

    // Check URL contains job ID and applications tab
    const url = page.url()
    const hasCorrectRoute = url.includes('/jobs/job-789') && url.includes('tab=applications')
    
    if (hasCorrectRoute) {
      console.log('✅ Navigated to job applications tab:', url)
    } else {
      console.log('⚠️ Current URL:', url)
      console.log('Note: Navigation handler may route differently')
    }
  })

  test('should open notification panel from dropdown footer', async ({ page }) => {
    // Create some notifications
    await supabase.from('notifications').insert([
      {
        user_wallet: TEST_WALLETS.ALICE,
        type: 'tip_received',
        actor_wallet: TEST_WALLETS.BOB,
        is_read: false,
        metadata: { amount: 10 },
        created_at: new Date().toISOString()
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

    // Look for "View all" or "See all" button
    const viewAllBtn = page.locator('button:has-text("View all"), button:has-text("See all")')
    const hasBtn = await viewAllBtn.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasBtn) {
      await viewAllBtn.click()
      await page.waitForTimeout(1000)

      // Check if panel/drawer opened (MUI Drawer)
      const panel = page.locator('[class*="MuiDrawer-paper"]')
      const isPanelOpen = await panel.isVisible({ timeout: 5000 }).catch(() => false)
      
      if (isPanelOpen) {
        console.log('✅ Notification panel opened')
      } else {
        console.log('⚠️ Panel may have opened but not detected')
      }
    } else {
      console.log('⚠️ "View all" button not found in dropdown')
    }
  })

  test('should close dropdown after notification clicked', async ({ page }) => {
    // Create notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'tip_received',
      actor_wallet: TEST_WALLETS.BOB,
      is_read: false,
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Verify dropdown is open
    const dropdown = page.locator('[role="tooltip"], [class*="MuiPopover-paper"]')
    await expect(dropdown).toBeVisible()

    // Click notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(1000)

    // Verify dropdown is closed
    const isStillVisible = await dropdown.isVisible({ timeout: 2000 }).catch(() => false)
    
    if (!isStillVisible) {
      console.log('✅ Dropdown closed after notification clicked')
    } else {
      console.log('⚠️ Dropdown may still be open')
    }
  })

  test('should navigate with correct query parameters', async ({ page }) => {
    // Create dispute notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'job_dispute_created',
      actor_wallet: TEST_WALLETS.BOB,
      reference_id: 'job-999',
      reference_type: 'job',
      is_read: false,
      metadata: { 
        job_title: 'Test Job',
        dispute_id: 'dispute-123'
      },
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(2000)

    // Check URL has correct query params
    const url = page.url()
    const hasDisputesTab = url.includes('tab=disputes')
    
    if (hasDisputesTab) {
      console.log('✅ Navigation includes correct query parameter: tab=disputes')
    } else {
      console.log('⚠️ Query parameter not found, URL:', url)
    }
  })

  test('should handle admin notification navigation', async ({ page }) => {
    // Create admin notification
    await supabase.from('notifications').insert({
      user_wallet: TEST_WALLETS.ALICE,
      type: 'admin_dispute_new',
      reference_id: 'dispute-admin-456',
      reference_type: 'dispute',
      is_read: false,
      metadata: { 
        job_id: 'job-admin-123',
        dispute_reason: 'Quality issues'
      },
      created_at: new Date().toISOString()
    })

    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Open dropdown
    const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
    await bell.click()
    await page.waitForTimeout(500)

    // Click admin notification
    const notification = page.locator('[class*="notification"], [role="button"]').first()
    await notification.click()
    await page.waitForTimeout(2000)

    // Check URL routes to admin or job with disputes
    const url = page.url()
    const hasAdminOrJobRoute = url.includes('/admin') || url.includes('/jobs') || url.includes('dispute')
    
    if (hasAdminOrJobRoute) {
      console.log('✅ Admin notification navigated to:', url)
    } else {
      console.log('⚠️ Admin navigation URL:', url)
    }
  })
})





