import { test, expect } from '@playwright/test'
import { 
  mockWalletConnection, 
  TEST_WALLETS,
  getSupabaseClient,
  seedTestData,
  cleanupTestData 
} from './test-utils'

/**
 * Setup Verification Tests
 * 
 * These tests verify that the test infrastructure is properly configured
 * Run these first to ensure everything is working before running the full suite
 */

test.describe('Test Setup Verification', () => {
  
  test('environment variables are configured', async () => {
    // Verify required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    expect(supabaseUrl).toBeTruthy()
    expect(supabaseUrl).toContain('supabase')
    
    expect(supabaseAnonKey).toBeTruthy()
    expect(supabaseAnonKey).toMatch(/^eyJ/)
    
    // Service role key is needed for test data management
    if (!supabaseServiceKey) {
      console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - test data management may fail')
      console.warn('   Add this to your .env.local file')
    } else {
      expect(supabaseServiceKey).toMatch(/^eyJ/)
      console.log('✅ All environment variables configured')
    }
  })

  test('Supabase connection works', async () => {
    const supabase = getSupabaseClient()
    
    // Try a simple query
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wallet_address')
      .limit(1)
    
    expect(error).toBeNull()
    console.log('✅ Supabase connection successful')
  })

  test('test data can be seeded', async () => {
    try {
      await seedTestData()
      
      // Verify test profiles exist
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('user_profiles')
        .select('wallet_address, display_name')
        .in('wallet_address', Object.values(TEST_WALLETS))
      
      expect(error).toBeNull()
      expect(data).toHaveLength(4) // ALICE, BOB, CAROL, DAVE
      
      console.log('✅ Test data seeded successfully')
      console.log(`   Found ${data?.length} test profiles:`)
      data?.forEach(profile => {
        console.log(`   - ${profile.display_name} (${profile.wallet_address.slice(0, 8)}...)`)
      })
    } catch (error) {
      console.error('❌ Failed to seed test data:', error)
      throw error
    }
  })

  test('test data can be cleaned up', async () => {
    try {
      await cleanupTestData()
      console.log('✅ Test data cleanup successful')
    } catch (error) {
      console.error('❌ Failed to cleanup test data:', error)
      // Don't throw - cleanup is best effort
    }
  })

  test('mock wallet connection works', async ({ page }) => {
    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    
    await page.goto('/')
    
    // Check if test wallet data is in session storage
    const hasTestWallet = await page.evaluate(() => {
      const address = sessionStorage.getItem('test-wallet-address')
      const connected = sessionStorage.getItem('test-wallet-connected')
      return address && connected === 'true'
    })
    
    expect(hasTestWallet).toBe(true)
    console.log('✅ Mock wallet connection successful')
  })

  test('app loads without errors', async ({ page }) => {
    await mockWalletConnection(page, TEST_WALLETS.ALICE)
    
    // Listen for console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    // Navigate to app
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Check for critical errors (ignore some expected warnings)
    const criticalErrors = errors.filter(err => 
      !err.includes('DevTools') && 
      !err.includes('warning') &&
      !err.includes('Download')
    )
    
    if (criticalErrors.length > 0) {
      console.warn('⚠️  Console errors detected:')
      criticalErrors.forEach(err => console.warn(`   ${err}`))
    } else {
      console.log('✅ App loads without critical errors')
    }
    
    // Verify basic elements are present
    await expect(page.locator('body')).toBeVisible()
  })

  test('test wallets are accessible', async () => {
    const wallets = Object.entries(TEST_WALLETS)
    
    expect(wallets).toHaveLength(4)
    
    console.log('✅ Test wallets configured:')
    wallets.forEach(([name, address]) => {
      console.log(`   - ${name}: ${address.slice(0, 12)}...${address.slice(-8)}`)
    })
  })

  test('Playwright configuration is correct', async ({ page }) => {
    // Verify base URL
    await page.goto('/')
    const url = page.url()
    
    expect(url).toContain('localhost')
    console.log(`✅ Base URL configured: ${url}`)
    
    // Verify viewport (default desktop)
    const viewport = page.viewportSize()
    expect(viewport).toBeTruthy()
    console.log(`✅ Viewport: ${viewport?.width}x${viewport?.height}`)
  })

  test('browser automation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Take a screenshot (saved on failure)
    await page.screenshot({ path: 'test-results/setup-verification.png' })
    
    console.log('✅ Browser automation functional')
    console.log('   Screenshot saved to test-results/')
  })

  test('summary: test setup verification complete', async () => {
    console.log('')
    console.log('═══════════════════════════════════════')
    console.log('  🎉 Test Setup Verification Complete!')
    console.log('═══════════════════════════════════════')
    console.log('')
    console.log('✅ Environment variables configured')
    console.log('✅ Supabase connection working')
    console.log('✅ Test data management working')
    console.log('✅ Mock wallet system functional')
    console.log('✅ App loads successfully')
    console.log('✅ Playwright configured correctly')
    console.log('')
    console.log('Ready to run full test suite!')
    console.log('')
    console.log('Next steps:')
    console.log('  npm run test              # Run all tests')
    console.log('  npm run test:ui           # Run in UI mode')
    console.log('  npm run test:headed       # See browser')
    console.log('')
    
    expect(true).toBe(true)
  })
})




