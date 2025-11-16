'use client'

import { useState } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/WalletButton'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { getTokenMetadata, TokenMetadata } from '@/lib/solana'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

export default function CreatePage() {
  const { connected } = useWallet()
  const { connection } = useConnection()
  const [mintAddress, setMintAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<TokenMetadata | null>(null)

  const handleFetchMetadata = async () => {
    if (!mintAddress.trim()) {
      setError('Please enter a token mint address')
      return
    }

    setLoading(true)
    setError(null)
    setTokenData(null)

    try {
      const endpoint = connection.rpcEndpoint
      const metadata = await getTokenMetadata(mintAddress.trim(), endpoint)
      setTokenData(metadata)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token metadata')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    // TODO: Navigate to next step
    console.log('Continue with token data:', tokenData)
  }

  // Step 1: Require wallet connection
  if (!connected) {
    return (
      <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <CardContent className="p-0 text-center">
            <h1 className="font-display text-2xl font-bold text-text-primary mb-4">
              Add Your Project
            </h1>
            <p className="font-body text-text-secondary mb-6">
              Connect your wallet to add your project
            </p>
            <WalletButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 2: Token Input Form
  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <header className="border-b border-border-subtle bg-card-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Add Your Project
            </h1>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-2xl">Token Information</CardTitle>
            <p className="font-body text-text-secondary mt-2">
              Enter your token's mint address to get started
            </p>
          </CardHeader>

          <CardContent className="p-0 space-y-6">
            {/* Token Input */}
            <div className="space-y-4">
              <TextField
                label="Token Contract Address (Solana mint)"
                placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                fullWidth
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                disabled={loading}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-body)',
                    '& fieldset': {
                      borderColor: '#E5E7F0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#7C4DFF',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#7C4DFF',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-body)',
                  },
                }}
              />

              <Button
                onClick={handleFetchMetadata}
                disabled={loading || !mintAddress.trim()}
                variant="primary"
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} className="mr-2" color="inherit" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Token Info'
                )}
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Token Data Preview */}
            {tokenData && (
              <div className="space-y-4">
                <div className="border-t border-border-subtle pt-6">
                  <h3 className="font-display text-lg font-semibold text-text-primary mb-4">
                    Token Preview
                  </h3>
                  
                  <div className="bg-subtle-bg rounded-lg p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="font-body text-sm text-text-muted">Token Name</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.name}</p>
                      </div>
                      
                      <div>
                        <label className="font-body text-sm text-text-muted">Symbol</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.symbol}</p>
                      </div>
                      
                      <div>
                        <label className="font-body text-sm text-text-muted">Total Supply</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.supply}</p>
                      </div>
                      
                      <div>
                        <label className="font-body text-sm text-text-muted">Decimals</label>
                        <p className="font-body text-text-primary font-medium">{tokenData.decimals}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="font-body text-sm text-text-muted">Mint Address</label>
                      <p className="font-body text-xs text-text-secondary break-all">{tokenData.mintAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Continue Button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleContinue}
                    variant="success"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

