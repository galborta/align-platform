'use client'

import { useState } from 'react'
import { getTokenPriceUsd, validateMinimumUsdValue } from '@/lib/helius'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'

// NUB token mint address (update with actual NUB mint)
const NUB_MINT = 'GtDZKAqvMZMnti46ZewMiXCa4oXF4bZxwQPoKzXPFxZn' // Correct NUB mint address

export function HeliusTestComponent() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    priceTest?: {
      price: number | null
      success: boolean
      error?: string
    }
    validationTest?: {
      valid: boolean
      usdValue: number | null
      success: boolean
      error?: string
    }
    invalidMintTest?: {
      price: number | null
      success: boolean
      error?: string
    }
  }>({})

  const runTests = async () => {
    setLoading(true)
    setResults({})

    console.log('🧪 Starting Helius API Tests...')
    console.log('=' .repeat(50))

    try {
      // Test 1: Get NUB token price
      console.log('\n📊 Test 1: Get NUB Token Price')
      console.log(`Mint: ${NUB_MINT}`)
      
      const price = await getTokenPriceUsd(NUB_MINT)
      
      if (price !== null) {
        console.log(`✅ Price fetched: $${price}`)
        setResults(prev => ({
          ...prev,
          priceTest: {
            price,
            success: true
          }
        }))
      } else {
        console.log('⚠️  No price data available')
        setResults(prev => ({
          ...prev,
          priceTest: {
            price: null,
            success: false,
            error: 'No price data available'
          }
        }))
      }

      // Test 2: Validate minimum USD value with 300 tokens
      console.log('\n💰 Test 2: Validate 300 Tokens ($5 minimum)')
      
      const validation = await validateMinimumUsdValue(NUB_MINT, 300, 5)
      
      console.log(`Token Amount: 300`)
      console.log(`USD Value: $${validation.usdValue?.toFixed(2) || 'N/A'}`)
      console.log(`Valid (≥$5): ${validation.valid ? '✅ Yes' : '❌ No'}`)
      
      setResults(prev => ({
        ...prev,
        validationTest: {
          valid: validation.valid,
          usdValue: validation.usdValue,
          success: true
        }
      }))

      // Test 3: Test with invalid/fake mint
      console.log('\n🔍 Test 3: Invalid Mint Address (Error Handling)')
      
      const fakeMint = '1111111111111111111111111111111111111111111' // Invalid mint
      console.log(`Fake Mint: ${fakeMint}`)
      
      const fakePrice = await getTokenPriceUsd(fakeMint)
      
      if (fakePrice === null) {
        console.log('✅ Gracefully returned null for invalid mint')
        setResults(prev => ({
          ...prev,
          invalidMintTest: {
            price: null,
            success: true
          }
        }))
      } else {
        console.log('⚠️  Unexpected: Got price for invalid mint')
        setResults(prev => ({
          ...prev,
          invalidMintTest: {
            price: fakePrice,
            success: false,
            error: 'Should have returned null'
          }
        }))
      }

      console.log('\n' + '='.repeat(50))
      console.log('✅ All tests completed!')

    } catch (error) {
      console.error('❌ Test failed with error:', error)
      setResults(prev => ({
        ...prev,
        priceTest: prev.priceTest || {
          price: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <InfoIcon sx={{ color: '#7C4DFF' }} />
          Helius API Test Suite
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Test Configuration */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Test Configuration:</p>
            <p className="text-xs text-gray-600 font-mono break-all">
              NUB Mint: {NUB_MINT}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Token Amount: 300 tokens
            </p>
            <p className="text-xs text-gray-600">
              Minimum: $5.00 USD
            </p>
          </div>

          {/* Run Tests Button */}
          <Button
            onClick={runTests}
            disabled={loading}
            variant="contained"
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {loading ? 'Running Tests...' : 'Run Helius API Tests'}
          </Button>

          {/* Test Results */}
          {Object.keys(results).length > 0 && (
            <div className="space-y-3 mt-4">
              {/* Price Test Result */}
              {results.priceTest && (
                <div className={`p-4 rounded-lg border ${
                  results.priceTest.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {results.priceTest.success ? (
                      <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                    ) : (
                      <ErrorIcon sx={{ color: '#dc2626', fontSize: 20 }} />
                    )}
                    <span className="font-semibold text-sm">Test 1: Get Token Price</span>
                  </div>
                  {results.priceTest.price !== null ? (
                    <p className="text-sm text-gray-700">
                      Price: <span className="font-bold text-green-700">${results.priceTest.price.toFixed(6)}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {results.priceTest.error || 'No price data available'}
                    </p>
                  )}
                </div>
              )}

              {/* Validation Test Result */}
              {results.validationTest && (
                <div className={`p-4 rounded-lg border ${
                  results.validationTest.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {results.validationTest.success ? (
                      <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                    ) : (
                      <ErrorIcon sx={{ color: '#dc2626', fontSize: 20 }} />
                    )}
                    <span className="font-semibold text-sm">Test 2: Validate Minimum USD</span>
                  </div>
                  {results.validationTest.usdValue !== null ? (
                    <>
                      <p className="text-sm text-gray-700">
                        300 tokens = <span className="font-bold">${results.validationTest.usdValue.toFixed(2)}</span>
                      </p>
                      <p className={`text-sm font-semibold mt-1 ${
                        results.validationTest.valid ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {results.validationTest.valid 
                          ? '✓ Meets $5 minimum' 
                          : '✗ Below $5 minimum'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Could not calculate USD value
                    </p>
                  )}
                </div>
              )}

              {/* Invalid Mint Test Result */}
              {results.invalidMintTest && (
                <div className={`p-4 rounded-lg border ${
                  results.invalidMintTest.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {results.invalidMintTest.success ? (
                      <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
                    ) : (
                      <ErrorIcon sx={{ color: '#dc2626', fontSize: 20 }} />
                    )}
                    <span className="font-semibold text-sm">Test 3: Invalid Mint Handling</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    {results.invalidMintTest.success 
                      ? '✓ Gracefully returned null' 
                      : '✗ Error handling failed'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mt-4">
            <p className="text-sm font-semibold text-blue-900 mb-2">📋 What This Tests:</p>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>DexScreener API integration (same as project pages)</li>
              <li>Real-time token price fetching for NUB and other tokens</li>
              <li>USD value validation for job payments</li>
              <li>Error handling for invalid tokens</li>
              <li>Minimum payment threshold checking ($5)</li>
            </ul>
            <p className="text-xs text-blue-700 mt-3 font-medium">
              💡 Check browser console for detailed logs
            </p>
          </div>

          {/* Info Note */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <CheckCircleIcon sx={{ color: '#16a34a', fontSize: 20 }} />
              <p className="text-sm font-semibold text-green-900">
                No API Key Required
              </p>
            </div>
            <p className="text-xs text-green-800 mt-2">
              Using DexScreener API (free) - same API used successfully in project pages. Works with NUB and most DEX-listed tokens.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

