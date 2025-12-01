'use client'

import { AppHeader } from '@/components/AppHeader'
import { HeliusTestComponent } from '@/components/HeliusTestComponent'

export default function HeliusTestPage() {
  return (
    <div className="min-h-screen bg-page-bg">
      <AppHeader />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
            Helius API Test Suite
          </h1>
          <p className="font-body text-text-secondary">
            Test token price validation for the job system
          </p>
        </div>

        <HeliusTestComponent />

        {/* Documentation */}
        <div className="mt-8 p-6 bg-white rounded-lg border border-border-subtle">
          <h2 className="font-display text-xl font-bold text-text-primary mb-4">
            How to Use This Test
          </h2>
          
          <div className="space-y-4 text-sm text-text-secondary">
            <div>
              <h3 className="font-semibold text-text-primary mb-2">1. Prerequisites</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Add your Helius API key to <code className="bg-gray-100 px-2 py-1 rounded">.env.local</code></li>
                <li>Key should be named <code className="bg-gray-100 px-2 py-1 rounded">NEXT_PUBLIC_HELIUS_API_KEY</code></li>
                <li>Restart dev server after adding the key</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">2. Run Tests</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Click "Run Helius API Tests" button above</li>
                <li>Watch console for detailed logs</li>
                <li>View results in the UI cards</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">3. Expected Results</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Test 1:</strong> Should show NUB token price in USD</li>
                <li><strong>Test 2:</strong> Should validate if 300 tokens ≥ $5</li>
                <li><strong>Test 3:</strong> Should gracefully handle invalid mint</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-text-primary mb-2">4. Update Token Mint</h3>
              <p className="ml-2">
                To test with a different token, edit the <code className="bg-gray-100 px-2 py-1 rounded">NUB_MINT</code> constant 
                in <code className="bg-gray-100 px-2 py-1 rounded">components/HeliusTestComponent.tsx</code>
              </p>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-semibold text-text-primary mb-2">📚 Related Files</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code className="bg-gray-100 px-2 py-1 rounded">lib/helius.ts</code> - API integration</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">lib/jobs.ts</code> - Job system functions</li>
                <li><code className="bg-gray-100 px-2 py-1 rounded">JOB_SYSTEM_LIBRARIES.md</code> - Full documentation</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}






