/**
 * Test script for Karma Leaderboard API
 * 
 * Usage:
 *   npx tsx scripts/test-leaderboard-api.ts
 * 
 * Or with custom URL:
 *   API_URL=http://localhost:3000 npx tsx scripts/test-leaderboard-api.ts
 */

const API_URL = process.env.API_URL || 'http://localhost:3000'

interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  response?: any
}

const results: TestResult[] = []

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now()
  
  try {
    await testFn()
    const duration = Date.now() - startTime
    results.push({ name, passed: true, duration })
    console.log(`✅ ${name} (${duration}ms)`)
  } catch (error: any) {
    const duration = Date.now() - startTime
    results.push({ 
      name, 
      passed: false, 
      duration, 
      error: error.message 
    })
    console.error(`❌ ${name} (${duration}ms)`)
    console.error(`   Error: ${error.message}`)
  }
}

async function testLeaderboardDefault() {
  const response = await fetch(`${API_URL}/api/leaderboard`)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  const data = await response.json()
  
  if (!Array.isArray(data)) {
    throw new Error('Response is not an array')
  }
  
  console.log(`   Returned ${data.length} users`)
  
  if (data.length > 0) {
    const first = data[0]
    if (!first.wallet_address || typeof first.total_karma !== 'number') {
      throw new Error('Invalid entry structure')
    }
    
    // Verify sorting (karma should be descending)
    for (let i = 1; i < data.length; i++) {
      if (data[i].total_karma > data[i - 1].total_karma) {
        throw new Error('Results not properly sorted by karma')
      }
    }
    
    console.log(`   Top user: ${first.username || first.wallet_address.slice(0, 8)} with ${first.total_karma} karma`)
  }
}

async function testLeaderboardWithLimit() {
  const response = await fetch(`${API_URL}/api/leaderboard?limit=5`)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const data = await response.json()
  
  if (data.length > 5) {
    throw new Error(`Expected max 5 results, got ${data.length}`)
  }
  
  console.log(`   Returned ${data.length} users (max 5)`)
}

async function testLeaderboardWithPeriod() {
  const response = await fetch(`${API_URL}/api/leaderboard?period=week`)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const data = await response.json()
  console.log(`   Week filter: ${data.length} active users`)
}

async function testLeaderboardInvalidLimit() {
  const response = await fetch(`${API_URL}/api/leaderboard?limit=invalid`)
  
  if (response.status !== 400) {
    throw new Error(`Expected 400 status, got ${response.status}`)
  }
  
  const data = await response.json()
  
  if (!data.error) {
    throw new Error('Expected error message in response')
  }
  
  console.log(`   Error message: ${data.error}`)
}

async function testLeaderboardInvalidPeriod() {
  const response = await fetch(`${API_URL}/api/leaderboard?period=invalid`)
  
  if (response.status !== 400) {
    throw new Error(`Expected 400 status, got ${response.status}`)
  }
  
  const data = await response.json()
  
  if (!data.error) {
    throw new Error('Expected error message in response')
  }
  
  console.log(`   Error message: ${data.error}`)
}

async function testLeaderboardCacheHeaders() {
  const response = await fetch(`${API_URL}/api/leaderboard`)
  
  const cacheControl = response.headers.get('cache-control')
  
  if (!cacheControl) {
    throw new Error('Missing Cache-Control header')
  }
  
  if (!cacheControl.includes('s-maxage')) {
    throw new Error('Cache-Control missing s-maxage directive')
  }
  
  console.log(`   Cache-Control: ${cacheControl}`)
}

async function testUserRankWithTestUser() {
  // Use the first test user we created (alice.sol)
  const testWallet = 'AliceTop1111111111111111111111111111111111111'
  const response = await fetch(
    `${API_URL}/api/leaderboard/user-rank?wallet=${testWallet}`
  )
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  
  const data = await response.json()
  
  if (typeof data.rank !== 'number' || data.rank < 1) {
    throw new Error('Invalid rank value')
  }
  
  if (typeof data.total_karma !== 'number') {
    throw new Error('Invalid total_karma value')
  }
  
  if (typeof data.percentile !== 'number') {
    throw new Error('Invalid percentile value')
  }
  
  console.log(`   User rank: #${data.rank} with ${data.total_karma} karma (${data.percentile}th percentile)`)
  console.log(`   Total users: ${data.total_users}`)
}

async function testUserRankMissingWallet() {
  const response = await fetch(`${API_URL}/api/leaderboard/user-rank`)
  
  if (response.status !== 400) {
    throw new Error(`Expected 400 status, got ${response.status}`)
  }
  
  const data = await response.json()
  
  if (!data.error) {
    throw new Error('Expected error message')
  }
  
  console.log(`   Error message: ${data.error}`)
}

async function testUserRankNotFound() {
  const nonExistentWallet = 'NonExistent1111111111111111111111111111111'
  const response = await fetch(
    `${API_URL}/api/leaderboard/user-rank?wallet=${nonExistentWallet}`
  )
  
  if (response.status !== 404) {
    throw new Error(`Expected 404 status, got ${response.status}`)
  }
  
  const data = await response.json()
  
  if (!data.error || data.rank !== null) {
    throw new Error('Expected error with null rank')
  }
  
  console.log(`   Error message: ${data.error}`)
}

async function main() {
  console.log('🧪 Testing Karma Leaderboard API')
  console.log(`📍 API URL: ${API_URL}`)
  console.log('')
  
  console.log('Testing /api/leaderboard endpoint:')
  await runTest('Get default leaderboard (top 10)', testLeaderboardDefault)
  await runTest('Get leaderboard with limit', testLeaderboardWithLimit)
  await runTest('Get leaderboard with period filter', testLeaderboardWithPeriod)
  await runTest('Invalid limit parameter', testLeaderboardInvalidLimit)
  await runTest('Invalid period parameter', testLeaderboardInvalidPeriod)
  await runTest('Cache headers present', testLeaderboardCacheHeaders)
  
  console.log('')
  console.log('Testing /api/leaderboard/user-rank endpoint:')
  await runTest('Get user rank (test user)', testUserRankWithTestUser)
  await runTest('Missing wallet parameter', testUserRankMissingWallet)
  await runTest('User not found', testUserRankNotFound)
  
  console.log('')
  console.log('═══════════════════════════════════════')
  console.log('Test Results Summary')
  console.log('═══════════════════════════════════════')
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0)
  
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⏱️  Total time: ${totalTime}ms`)
  console.log(`📊 Success rate: ${((passed / results.length) * 100).toFixed(1)}%`)
  
  if (failed > 0) {
    console.log('')
    console.log('Failed tests:')
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}`)
        console.log(`     ${r.error}`)
      })
    
    process.exit(1)
  }
  
  console.log('')
  console.log('🎉 All tests passed!')
}

main().catch(error => {
  console.error('❌ Test suite failed:', error)
  process.exit(1)
})


