# 🚀 Messaging E2E Tests - Quick Start Guide

## Installation Complete ✅

Your comprehensive E2E testing system is ready to use!

---

## 📦 What You Got

- ✅ **40+ E2E tests** covering messaging, blocking, privacy, and more
- ✅ **Mock wallet system** - no browser extensions needed
- ✅ **Automatic test data management** - seeding & cleanup
- ✅ **Real-time multi-user testing** - simulates concurrent users
- ✅ **Performance benchmarks** - load time monitoring
- ✅ **Visual debugging** - screenshots and videos on failure

---

## ⚡ Quick Commands

```bash
# 1. Verify setup (run this first!)
npx playwright test setup-verification

# 2. Run all tests
npm run test

# 3. Run with UI (recommended for first time)
npm run test:ui

# 4. Run with visible browser
npm run test:headed

# 5. View test report
npm run test:report
```

---

## 🎯 First Time Setup

### Step 1: Check Environment Variables

Ensure your `.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key  # ← REQUIRED for tests!
NEXT_PUBLIC_SOLANA_RPC_URL=your_rpc_url
```

**Important**: `SUPABASE_SERVICE_ROLE_KEY` is needed for test data management.

### Step 2: Install Playwright (if not done)

```bash
npx playwright install chromium
```

### Step 3: Verify Setup

```bash
npx playwright test setup-verification --reporter=list
```

Expected output:
```
✅ environment variables are configured
✅ Supabase connection works
✅ test data can be seeded
✅ test data can be cleaned up
✅ mock wallet connection works
✅ app loads without errors
✅ test wallets are accessible
✅ Playwright configuration is correct
✅ browser automation works
✅ summary: test setup verification complete

9 passed (30s)
```

### Step 4: Run Your First Test

```bash
# Run one test to verify everything works
npx playwright test -g "users can send and receive messages" --headed
```

You should see:
- Browser opens
- Two users (Alice & Bob) interact
- Messages sent in real-time
- Test passes ✅

---

## 📚 Full Documentation

See `/tests/README.md` for:
- Complete test coverage breakdown
- Test wallet reference
- Writing custom tests guide
- Troubleshooting section
- Best practices
- CI/CD integration examples

---

## 🐛 Common Issues

### Issue: "SUPABASE_SERVICE_ROLE_KEY not set"
**Fix**: Add service role key to `.env.local`:
```bash
echo "SUPABASE_SERVICE_ROLE_KEY=your_key" >> .env.local
```

### Issue: "Port 3003 already in use"
**Fix**: Kill existing process:
```bash
lsof -ti:3003 | xargs kill -9
```

### Issue: Tests timeout
**Fix**: Ensure dev server starts:
```bash
npm run dev  # Should run on port 3003
```

### Issue: Mock wallet not recognized
**Fix**: Verify `lib/wallet-config.tsx` has `getTestWallet()` function (already added)

---

## 🎨 Test Categories

| Category | Count | Run Command |
|----------|-------|-------------|
| All Tests | 40+ | `npm run test` |
| Setup Verification | 10 | `npx playwright test setup-verification` |
| Basic Messaging | 8 | `npx playwright test -g "messaging"` |
| Blocking System | 3 | `npx playwright test -g "blocking"` |
| Privacy Settings | 3 | `npx playwright test -g "privacy"` |
| Performance | 2 | `npx playwright test -g "performance"` |
| Edge Cases | 3 | `npx playwright test -g "edge"` |

---

## 🧪 Test Wallets

Pre-configured test users (no real wallets needed):

| User | Privacy | Messages From | Use Case |
|------|---------|--------------|----------|
| **ALICE** | Public | Everyone | Default test user |
| **BOB** | Public | Everyone | Message recipient |
| **CAROL** | Holders Only | Holders Only | Privacy testing |
| **DAVE** | Private | Nobody | Private profile tests |

---

## 📊 What Gets Tested

### ✅ Messaging Features
- Send/receive messages in real-time
- Typing indicators
- Read receipts
- Character limits
- Rate limiting
- Message timestamps

### ✅ Conversation Management
- Conversation list
- Unread badges
- Search/filter
- Sorting by recency
- Delete conversations

### ✅ Blocking System
- Block user
- Unblock user
- Block confirmation modal
- Delete conversation history
- Prevent blocked messaging

### ✅ Privacy System
- Public profiles
- Holders-only restrictions
- Private profiles
- Online status visibility
- Message permissions

### ✅ User Experience
- Keyboard shortcuts (Cmd+M)
- Mobile responsive
- Loading states
- Error messages
- Toast notifications

### ✅ Performance
- Conversation load time < 2s
- Message load time < 1s
- Real-time latency tracking

---

## 🔄 Development Workflow

### Running Tests During Development

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run tests in watch mode
npx playwright test --ui

# Or run specific test while developing
npx playwright test -g "your test name" --headed --debug
```

### After Making Changes

```bash
# Run affected tests
npm run test

# If tests fail, debug with UI
npm run test:ui
```

### Before Committing

```bash
# Run full suite
npm run test

# Generate report
npm run test:report
```

---

## 🎯 Example Test Run

```bash
$ npm run test

Running 40 tests using 1 worker

  ✓ users can send and receive messages in real-time (8s)
  ✓ typing indicator appears and disappears (5s)
  ✓ message character limit is enforced (3s)
  ✓ conversations sorted by most recent message (2s)
  ✓ unread badge shows correct count (6s)
  ✓ blocking user prevents messaging (7s)
  ✓ Cmd+M toggles messages sidebar (2s)
  ✓ messaging works on mobile viewport (4s)
  ✓ empty message cannot be sent (2s)
  ✓ rate limiting prevents spam (8s)
  ✓ conversation list loads quickly (1s)
  ✓ messages load quickly (1s)
  ...

  40 passed (2m 30s)

HTML report available at: playwright-report/index.html
```

---

## 🚨 Important Notes

1. **Service Role Key Required**: Tests need database access for seeding/cleanup
2. **Dev Server Must Start**: Tests will start it automatically, but it must be able to run
3. **Test Data is Isolated**: Uses specific test wallet addresses
4. **Automatic Cleanup**: Test data removed after tests complete
5. **No Real Wallets Needed**: Mock wallet system simulates connections

---

## 📖 Learn More

- **Full Documentation**: `/tests/README.md`
- **Test Utils API**: `/tests/test-utils.ts`
- **Test Examples**: `/tests/messaging.spec.ts`
- **Setup Guide**: `E2E_TESTS_SETUP_COMPLETE.md`
- **Playwright Docs**: https://playwright.dev/docs/intro

---

## 🎉 You're Ready!

Your E2E testing system is fully configured and ready to use.

**Next step**: Run setup verification
```bash
npx playwright test setup-verification --reporter=list
```

If all tests pass, you're good to go! 🚀

---

**Need Help?**
- Check `/tests/README.md` troubleshooting section
- Review test output for specific errors  
- Use `--debug` flag to step through tests
- Check `test-results/` for screenshots/videos

---

**Happy Testing! 🧪✨**

