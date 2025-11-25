# Messaging System E2E Tests

Comprehensive end-to-end tests for the ALIGN messaging system using Playwright.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Coverage](#test-coverage)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Wallets](#test-wallets)
- [Test Data Management](#test-data-management)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

---

## Overview

These tests use **Playwright** to automate browser interactions and verify the messaging system works correctly. Tests run **without real wallet extensions** by mocking wallet connections.

### Key Features

- ✅ Mock wallet connections (no browser extensions needed)
- ✅ Real-time messaging tests with multiple browser contexts
- ✅ Automatic test data seeding and cleanup
- ✅ Visual verification with screenshots on failure
- ✅ Video recording of failed tests
- ✅ Parallel and sequential test execution

---

## Test Coverage

### 1. Basic Messaging (8 tests)
- ✅ Send and receive messages in real-time
- ✅ Typing indicators
- ✅ Character limit enforcement
- ✅ Read receipts
- ✅ Message timestamps
- ✅ Empty message prevention
- ✅ Shift+Enter for new lines
- ✅ Enter to send

### 2. Conversation Management (5 tests)
- ✅ Conversation list sorting
- ✅ Unread message badges
- ✅ Conversation search/filtering
- ✅ Delete conversations
- ✅ Multiple conversations

### 3. Blocking System (3 tests)
- ✅ Block user
- ✅ Unblock user
- ✅ Blocked user cannot message
- ✅ Block confirmation modal
- ✅ Delete conversation history option

### 4. Privacy Settings (3 tests)
- ✅ Public profiles
- ✅ Holders-only restrictions
- ✅ Private profiles
- ✅ Online status visibility
- ✅ Messaging permissions

### 5. User Experience (6 tests)
- ✅ Keyboard shortcuts (Cmd+M)
- ✅ Mobile responsive design
- ✅ Loading states
- ✅ Error messages
- ✅ Toast notifications
- ✅ Accessibility

### 6. Performance (2 tests)
- ✅ Conversation list load time
- ✅ Message thread load time
- ✅ Real-time update latency

### 7. Edge Cases (3 tests)
- ✅ Rate limiting (spam prevention)
- ✅ Long messages
- ✅ Special characters
- ✅ Network errors

---

## Setup

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Supabase project with environment variables configured

### 1. Install Dependencies

```bash
npm install
```

Playwright should already be installed as a dev dependency. If not:

```bash
npm install -D @playwright/test
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

Optional: Install other browsers
```bash
npx playwright install  # Installs all browsers
```

### 3. Configure Environment Variables

Ensure your `.env.local` file contains:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for tests

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=your_rpc_url
```

**Important**: `SUPABASE_SERVICE_ROLE_KEY` is required for test data seeding and cleanup.

### 4. Seed Test Data

Test data is automatically seeded before tests run. You can also manually seed:

```typescript
import { seedTestData } from './tests/test-utils'
await seedTestData()
```

---

## Running Tests

### Run All Tests

```bash
npx playwright test
```

### Run Specific Test File

```bash
npx playwright test messaging.spec.ts
```

### Run Specific Test by Name

```bash
npx playwright test -g "users can send and receive messages"
```

### Run in Headed Mode (see browser)

```bash
npx playwright test --headed
```

### Run in UI Mode (interactive)

```bash
npx playwright test --ui
```

### Run in Debug Mode

```bash
npx playwright test --debug
```

### Run with Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Generate HTML Report

```bash
npx playwright test
npx playwright show-report
```

---

## Test Wallets

The test suite uses predefined wallet addresses that don't require real Solana wallets:

```typescript
export const TEST_WALLETS = {
  ALICE: 'ALICEtest11111111111111111111111111111111111',
  BOB: 'BOBtest222222222222222222222222222222222222',
  CAROL: 'CAROLtest3333333333333333333333333333333333',
  DAVE: 'DAVEtest44444444444444444444444444444444444',
}
```

### User Profiles

| Wallet | Display Name | Privacy Level | Allow Messages From |
|--------|-------------|---------------|---------------------|
| ALICE  | Alice       | Public        | Everyone            |
| BOB    | Bob         | Public        | Everyone            |
| CAROL  | Carol       | Holders Only  | Holders Only        |
| DAVE   | Dave        | Private       | Nobody              |

### How Mock Wallets Work

Test wallets are injected via Playwright's `page.addInitScript()`:

```typescript
await mockWalletConnection(page, TEST_WALLETS.ALICE)
```

This sets session storage values:
- `test-wallet-address`: The wallet address
- `test-wallet-connected`: "true"

The app reads these values via `getTestWallet()` in `lib/wallet-config.tsx`.

---

## Test Data Management

### Automatic Cleanup

Test data is automatically cleaned up after all tests complete:

```typescript
test.afterAll(async () => {
  await cleanupTestData()
})
```

### Manual Cleanup

If tests fail and leave data behind:

```bash
# Run cleanup script (create this if needed)
npm run test:cleanup
```

Or use Supabase dashboard to manually delete test data:
1. Go to Table Editor
2. Filter by test wallet addresses (contain "test")
3. Delete rows

### What Gets Cleaned Up

- Messages from/to test wallets
- Conversations with test wallets
- Typing indicators
- Blocked user records
- Test user profiles (optional)

### Seed Fresh Data

```bash
# In a test or script
import { seedTestData } from './tests/test-utils'
await seedTestData()
```

---

## Writing New Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test'
import { 
  mockWalletConnection, 
  TEST_WALLETS,
  createTestConversation 
} from './test-utils'

test('my new test', async ({ page }) => {
  // 1. Mock wallet connection
  await mockWalletConnection(page, TEST_WALLETS.ALICE)
  
  // 2. Set up test data (optional)
  await createTestConversation(
    TEST_WALLETS.ALICE, 
    TEST_WALLETS.BOB,
    [
      { sender: TEST_WALLETS.BOB, content: 'Test message' }
    ]
  )
  
  // 3. Navigate to app
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  // 4. Interact with UI
  await page.click('button:has-text("Messages")')
  
  // 5. Assert expected behavior
  await expect(page.locator('text=Bob')).toBeVisible()
})
```

### Multi-User Tests

For real-time messaging tests, use multiple browser contexts:

```typescript
test('real-time messaging', async ({ browser }) => {
  const aliceContext = await browser.newContext()
  const bobContext = await browser.newContext()
  
  const alicePage = await aliceContext.newPage()
  const bobPage = await bobContext.newPage()
  
  try {
    await mockWalletConnection(alicePage, TEST_WALLETS.ALICE)
    await mockWalletConnection(bobPage, TEST_WALLETS.BOB)
    
    // Alice sends message
    await alicePage.goto('/')
    await alicePage.fill('textarea', 'Hello Bob!')
    await alicePage.press('textarea', 'Enter')
    
    // Bob receives in real-time
    await bobPage.goto('/')
    await expect(bobPage.locator('text=Hello Bob!')).toBeVisible({ timeout: 5000 })
    
  } finally {
    await aliceContext.close()
    await bobContext.close()
  }
})
```

### Useful Utility Functions

```typescript
// Wait for element with retries
await waitForStableElement(page, '.message-bubble', 5000)

// Type slowly to trigger typing indicator
await typeSlowly(page, 'textarea', 'Hello', 100)

// Check if element exists without throwing
const exists = await elementExists(page, '.typing-indicator')

// Get unread count from database
const unreadCount = await getUnreadCount(TEST_WALLETS.BOB)

// Format wallet address
const formatted = formatWalletAddress(TEST_WALLETS.ALICE) // "ALIC...1111"
```

---

## Troubleshooting

### Common Issues

#### 1. Tests Timeout Waiting for Elements

**Problem**: `Timeout 30000ms exceeded waiting for selector...`

**Solutions**:
- Increase timeout: `await page.waitForSelector(selector, { timeout: 60000 })`
- Check if app is running: `npm run dev` should be active
- Verify selectors are correct
- Check for network errors in test output

#### 2. Mock Wallet Not Working

**Problem**: App doesn't recognize test wallet

**Solutions**:
- Verify `lib/wallet-config.tsx` has `getTestWallet()` function
- Ensure app imports `useWallet` from `lib/use-wallet-adapter.ts` (if created)
- Check browser console: `localStorage.getItem('test-wallet-address')`
- Verify `NODE_ENV !== 'production'`

#### 3. Database Connection Errors

**Problem**: `Error seeding test data`

**Solutions**:
- Check `.env.local` has all Supabase keys
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not just anon key)
- Test Supabase connection manually:
  ```bash
  npx supabase status
  ```
- Check network/firewall settings

#### 4. Real-Time Updates Not Working

**Problem**: Messages don't appear in real-time

**Solutions**:
- Verify Supabase Realtime is enabled in project settings
- Check subscription channel names match
- Increase wait timeout: `await page.waitForTimeout(3000)`
- Look for console errors in browser

#### 5. Tests Leave Dirty Data

**Problem**: Old test data interferes with new tests

**Solutions**:
- Run cleanup manually: `await cleanupTestData()`
- Delete test users from Supabase dashboard
- Add `test.beforeEach()` cleanup hook
- Use unique test data per test

#### 6. Port Already in Use

**Problem**: `Port 3000 is already in use`

**Solutions**:
- Kill existing dev server: `lsof -ti:3000 | xargs kill -9`
- Change port in `playwright.config.ts`:
  ```typescript
  baseURL: 'http://localhost:3001'
  ```
- Set `reuseExistingServer: true` in config

#### 7. Playwright Browsers Not Installed

**Problem**: `Browser not found`

**Solutions**:
```bash
npx playwright install chromium
npx playwright install  # Install all browsers
```

#### 8. Screenshots/Videos Not Generated

**Problem**: Failure artifacts missing

**Solutions**:
- Check `playwright.config.ts` has:
  ```typescript
  screenshot: 'only-on-failure'
  video: 'retain-on-failure'
  ```
- View report: `npx playwright show-report`
- Check `test-results/` directory

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Run tests
        run: npx playwright test
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Best Practices

### ✅ DO

- Use mock wallets for all tests
- Clean up test data in `afterAll()`
- Use meaningful test names
- Add timeouts for real-time features
- Test both happy and error paths
- Use page objects for complex flows
- Take screenshots on failure
- Document test assumptions

### ❌ DON'T

- Use real wallet extensions
- Leave test data in database
- Skip cleanup hooks
- Use production data
- Share browser contexts between unrelated tests
- Hard-code timeouts (use constants)
- Ignore flaky tests

---

## Performance Benchmarks

Target performance metrics:

| Metric | Target | Current |
|--------|--------|---------|
| Conversation list load | < 1s | TBD |
| Message thread load | < 500ms | TBD |
| Send message latency | < 200ms | TBD |
| Real-time update | < 1s | TBD |
| Search results | < 300ms | TBD |

Run performance tests:
```bash
npx playwright test --grep "performance"
```

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review test output and logs
3. Check Playwright trace viewer: `npx playwright show-trace trace.zip`
4. Open an issue on GitHub

---

**Last Updated**: November 24, 2024  
**Test Suite Version**: 1.0.0  
**Playwright Version**: 1.48.0+



