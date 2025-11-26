import { NextRequest, NextResponse } from 'next/server'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { supabase } from '@/lib/supabase'
import { TipToken } from '@/types/database'

/**
 * GET /api/tokens/user-holdings
 * 
 * Fetches a user's SPL token holdings with metadata and USD values
 * 
 * Query params:
 * - wallet (required): User's wallet address
 * - projectId (optional): Project ID to prioritize project token
 * 
 * Returns:
 * - success: boolean
 * - tokens: TipToken[] (filtered to >= $0.10, sorted by value, top 20)
 * - projectToken: string | null (project's token mint if projectId provided)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const wallet = searchParams.get('wallet')
    const projectId = searchParams.get('projectId')

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      )
    }

    // 1. Get project's token mint if projectId provided
    let projectTokenMint: string | null = null
    if (projectId) {
      const { data: project } = await supabase
        .from('projects')
        .select('token_mint')
        .eq('id', projectId)
        .single()

      projectTokenMint = project?.token_mint || null
    }

    // 2. Fetch all SPL token accounts
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
      'confirmed'
    )

    const walletPubkey = new PublicKey(wallet)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: TOKEN_PROGRAM_ID }
    )

    // 3. Extract token data
    const tokenDataPromises = tokenAccounts.value
      .map(account => {
        const parsedInfo = account.account.data.parsed.info
        return {
          mint: parsedInfo.mint,
          balance: parsedInfo.tokenAmount.uiAmount || 0,
          decimals: parsedInfo.tokenAmount.decimals
        }
      })
      .filter(token => token.balance > 0)
      .map(async (token) => {
        try {
          // Fetch price from DexScreener
          const priceRes = await fetch(
            `https://api.dexscreener.com/latest/dex/tokens/${token.mint}`,
            { next: { revalidate: 60 } } // Cache for 1 minute
          )
          const priceData = await priceRes.json()

          let price: number | null = null
          let symbol = 'UNKNOWN'
          let logoUrl: string | null = null

          if (priceData.pairs && priceData.pairs.length > 0) {
            const mainPair = priceData.pairs[0]
            price = parseFloat(mainPair.priceUsd) || null
            symbol = mainPair.baseToken?.symbol || 'UNKNOWN'
            logoUrl = mainPair.info?.imageUrl || null
          }

          const usdValue = price ? token.balance * price : 0

          return {
            mint: token.mint,
            symbol,
            logoUrl,
            balance: token.balance,
            decimals: token.decimals,
            usdValue,
            usdPrice: price
          } as TipToken
        } catch (error) {
          console.error(`Error fetching data for ${token.mint}:`, error)
          return {
            mint: token.mint,
            symbol: 'UNKNOWN',
            logoUrl: null,
            balance: token.balance,
            decimals: token.decimals,
            usdValue: 0,
            usdPrice: null
          } as TipToken
        }
      })

    const tokensWithMetadata = await Promise.all(tokenDataPromises)

    // 4. Filter tokens >= $0.10
    const eligibleTokens = tokensWithMetadata.filter(
      token => token.usdValue >= 0.10
    )

    // 5. Sort: project token first, then by USD value
    const sortedTokens = eligibleTokens.sort((a, b) => {
      if (a.mint === projectTokenMint) return -1
      if (b.mint === projectTokenMint) return 1
      return b.usdValue - a.usdValue
    })

    // 6. Take top 20
    const topTokens = sortedTokens.slice(0, 20)

    return NextResponse.json({
      success: true,
      tokens: topTokens,
      projectToken: projectTokenMint
    })

  } catch (error: any) {
    console.error('Error fetching user tokens:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to fetch tokens',
        tokens: [],
        projectToken: null
      },
      { status: 500 }
    )
  }
}

