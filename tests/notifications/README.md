# Notification System E2E Tests

Comprehensive end-to-end tests for the ALIGN notification system using Playwright.

## Test Files

### 1. `notification-flow.spec.ts` - Basic Notification Flow
Tests fundamental notification functionality:
- ✅ Notification bell with unread count badge
- ✅ Opening notification dropdown
- ✅ Auto-marking notifications as read (10-second timer)
- ✅ Real-time notification arrival
- ✅ Clicking notifications to mark as read
- ✅ "Mark all as read" functionality
- ✅ Empty state display
- ✅ Loading states while fetching

**Key Scenarios:**
- Single user receiving notifications
- Multiple users (real-time testing)
- Auto-read behavior
- UI state management

### 2. `notification-batching.spec.ts` - Notification Batching
Tests the batching system for grouping similar notifications:
- ✅ Batching multiple upvotes within 5-minute window
- ✅ Individual notifications for non-batchable types
- ✅ Expandable batch with details
- ✅ New batch after 5-minute window expires
- ✅ Correct batch count in badge/chip
- ✅ Batching job comments

**Batching Rules:**
- Similar notifications within 5 minutes → batched
- Different notification types → separate
- After 5-minute window → new batch created

### 3. `notification-navigation.spec.ts` - Navigation
Tests notification click navigation:
- ✅ Job notifications → `/jobs/[id]`
- ✅ Karma notifications → `/profile`
- ✅ Asset notifications → `/assets`
- ✅ Application notifications → `/jobs/[id]?tab=applications`
- ✅ Dispute notifications → `/jobs/[id]?tab=disputes`
- ✅ Admin notifications → admin routes
- ✅ Opening full notification panel
- ✅ Dropdown closes after click
- ✅ Query parameters preserved

## Running Tests

### Run All Notification Tests
```bash
npx playwright test tests/notifications
```

### Run Specific Test File
```bash
npx playwright test tests/notifications/notification-flow.spec.ts
```

### Run in Debug Mode
```bash
npx playwright test --debug tests/notifications
```

### Run in UI Mode (Interactive)
```bash
npx playwright test --ui
```

### Run with Headed Browser (See What's Happening)
```bash
npx playwright test --headed tests/notifications
```

### Generate HTML Report
```bash
npx playwright show-report
```

## Prerequisites

1. **Development Server Running**
   ```bash
   npm run dev
   # Server must be running on localhost:3003
   ```

2. **Supabase Environment Variables**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Test Database**
   - Tests use the same Supabase instance as development
   - Test users: ALICE, BOB, CAROL, DAVE (defined in test-utils.ts)
   - Tests clean up after themselves

## Test Architecture

### Test Users (test-utils.ts)
```typescript
TEST_WALLETS = {
  ALICE: 'ALICEtest11111111111111111111111111111111111',
  BOB: 'BOBtest222222222222222222222222222222222222',
  CAROL: 'CAROLtest3333333333333333333333333333333333',
  DAVE: 'DAVEtest44444444444444444444444444444444444',
}
```

### Mock Wallet Connection
Tests use `mockWalletConnection()` to simulate connected wallets without needing Phantom/Solflare.

### Database Setup/Teardown
- `beforeAll()`: Seeds test user profiles
- `beforeEach()`: Cleans up notifications for test users
- `afterAll()`: Cleans up all test data

## Common Test Patterns

### Creating a Notification
```typescript
await supabase.from('notifications').insert({
  user_wallet: TEST_WALLETS.ALICE,
  type: 'tip_received',
  actor_wallet: TEST_WALLETS.BOB,
  is_read: false,
  metadata: { amount: 10 },
  created_at: new Date().toISOString()
})
```

### Opening Notification Dropdown
```typescript
const bell = page.locator('button:has([data-testid="BellIcon"], [class*="Bell"])')
await bell.click()
await page.waitForTimeout(500)
```

### Verifying Badge Count
```typescript
const badge = page.locator('[class*="MuiBadge-badge"]')
await expect(badge).toHaveText('1')
```

## Debugging Failed Tests

### View Traces
```bash
npx playwright show-trace test-results/.../trace.zip
```

### View Screenshots
Failed tests automatically save screenshots to `test-results/`

### View Videos
Failed tests record videos (if enabled in config)

### Console Logs
Tests include `console.log()` statements for key checkpoints

## Known Limitations

1. **Real-time Subscriptions**
   - May have delays (up to 3 seconds)
   - Tests account for this with timeouts

2. **Batching**
   - Backend batching logic must be implemented
   - Tests simulate batching manually for now

3. **Browser Notifications**
   - Not tested (requires user permission)
   - Focus on in-app notifications

4. **Mobile Testing**
   - Mobile viewports not yet configured
   - Add to `playwright.config.ts` when ready

## Adding New Tests

1. **Choose appropriate file**:
   - Flow tests → `notification-flow.spec.ts`
   - Batching tests → `notification-batching.spec.ts`
   - Navigation tests → `notification-navigation.spec.ts`

2. **Follow existing patterns**:
   - Use `beforeEach` to clean up
   - Use test wallets from `TEST_WALLETS`
   - Add descriptive console logs
   - Include timeout for real-time operations

3. **Test structure**:
   ```typescript
   test('should do something specific', async ({ page }) => {
     // 1. Setup: Create notifications/data
     // 2. Action: User interactions
     // 3. Assert: Verify outcomes
     // 4. Log: Console messages
   })
   ```

## Coverage Goals

- ✅ Basic notification flow
- ✅ Batching behavior
- ✅ Navigation routing
- ⏳ Mobile responsiveness (TODO)
- ⏳ Error handling (TODO)
- ⏳ Network throttling (TODO)
- ⏳ Admin-only features (TODO)

## CI/CD Integration

Tests can run in CI with:
```yaml
- name: Run Playwright Tests
  run: npx playwright test
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

## Troubleshooting

### Tests Failing Locally
1. Ensure dev server is running on port 3003
2. Check Supabase environment variables
3. Clear test data: Delete test users from database
4. Restart Playwright: `npx playwright install`

### Timeouts
- Increase timeout in test: `{ timeout: 30000 }`
- Check network latency
- Verify Supabase is responding

### Flaky Tests
- Real-time subscriptions can be inconsistent
- Add longer waits for real-time events
- Use `waitForStableElement()` for dynamic content

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [ALIGN Notification System Docs](../../NOTIFICATION_SYSTEM_COMPLETE.md)











