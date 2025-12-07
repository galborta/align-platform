import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { Database } from '@/types/database'
import { getFeeWallet } from '@/lib/platform-settings'
import bs58 from 'bs58'

// Use service role for elevated permissions
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Winner {
  wallet: string
  amount_tokens: number
  position: number
  submission_id: string
}

/**
 * POST /api/jobs/[jobId]/contest-payout
 * 
 * Executes payout for a contest job - transfers SPL tokens from escrow to all winners.
 * Uses server-side escrow keypair for signing (ESCROW_WALLET_PRIVATE_KEY).
 * 
 * Security:
 * - CRITICAL: Requires Supabase JWT authentication
 * - Only the authenticated job poster can execute payout
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  
  try {
    const { jobId } = await params

    console.log(`[Contest Payout API] Starting payout for job ${jobId}`)

    // ==================== AUTHENTICATION ====================

    // Authenticate request
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[Contest Payout] Missing authorization')
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('[Contest Payout] Auth failed:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Get authenticated user's wallet
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet_address')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.wallet_address) {
      console.error('[Contest Payout] No wallet for user:', profileError)
      return NextResponse.json(
        { error: 'No wallet address linked to account' },
        { status: 403 }
      )
    }

    const authenticatedWallet = profile.wallet_address
    console.log(`[Contest Payout] Authenticated user: ${user.id}`)
    console.log(`[Contest Payout] User wallet: ${authenticatedWallet}`)

    // ==================== VALIDATION ====================

    // Validate escrow keypair is configured
    const escrowPrivateKey = process.env.ESCROW_WALLET_PRIVATE_KEY
    if (!escrowPrivateKey) {
      console.error('[Contest Payout API] ESCROW_WALLET_PRIVATE_KEY not configured')
      return NextResponse.json(
        { error: 'Escrow wallet not configured on server' },
        { status: 500 }
      )
    }

    let escrowKeypair: Keypair
    try {
      escrowKeypair = Keypair.fromSecretKey(bs58.decode(escrowPrivateKey))
    } catch (error) {
      console.error('[Contest Payout API] Invalid escrow private key:', error)
      return NextResponse.json(
        { error: 'Invalid escrow wallet configuration' },
        { status: 500 }
      )
    }

    const escrowWallet = escrowKeypair.publicKey
    console.log(`[Contest Payout API] Escrow wallet: ${escrowWallet.toString()}`)

    // ==================== FETCH AND VALIDATE JOB ====================

    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('[Contest Payout API] Job not found:', jobError)
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    console.log(`[Contest Payout API] Job: ${job.title}`)
    console.log(`[Contest Payout API] Is contest: ${job.is_contest}`)
    console.log(`[Contest Payout API] Status: ${job.status}`)

    if (!job.is_contest) {
      return NextResponse.json(
        { error: 'This is not a contest job' },
        { status: 400 }
      )
    }

    // Verify poster authorization
    if (authenticatedWallet !== job.poster_wallet) {
      console.error('[Contest Payout] Not authorized - wallet mismatch')
      return NextResponse.json(
        { error: 'Only job poster can execute contest payout' },
        { status: 403 }
      )
    }

    console.log('[Contest Payout] ✅ Authorization verified')

    if (job.status === 'completed') {
      return NextResponse.json(
        { error: 'Contest already paid out' },
        { status: 400 }
      )
    }

    if (!job.contest_winners_selected_at) {
      return NextResponse.json(
        { error: 'Winners have not been selected yet' },
        { status: 400 }
      )
    }

    if (!job.escrow_locked) {
      return NextResponse.json(
        { error: 'Escrow not locked for this job' },
        { status: 400 }
      )
    }

    if (!job.escrow_token_mint) {
      return NextResponse.json(
        { error: 'No token mint configured for this job' },
        { status: 400 }
      )
    }

    // ==================== FETCH WINNERS ====================

    const { data: winnerSubmissions, error: winnersError } = await supabaseAdmin
      .from('job_submissions')
      .select('*')
      .eq('job_id', jobId)
      .eq('is_selected_winner', true)
      .order('winner_position', { ascending: true })

    if (winnersError || !winnerSubmissions || winnerSubmissions.length === 0) {
      console.error('[Contest Payout API] No winners found:', winnersError)
      return NextResponse.json(
        { error: 'No winners found for this contest' },
        { status: 400 }
      )
    }

    const winners: Winner[] = winnerSubmissions.map(s => ({
      wallet: s.worker_wallet,
      amount_tokens: s.prize_amount_tokens || 0,
      position: s.winner_position || 0,
      submission_id: s.id
    }))

    console.log(`[Contest Payout API] Found ${winners.length} winners`)

    // ==================== BUILD TRANSACTION ====================

    // Setup connection
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    const connection = new Connection(rpcUrl, 'confirmed')

    const tokenMint = new PublicKey(job.escrow_token_mint)
    const decimals = 9 // Standard SPL token decimals

    // Get escrow token account
    const escrowTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      escrowWallet
    )
    console.log(`[Contest Payout API] Escrow ATA: ${escrowTokenAccount.toString()}`)

    // Get fee wallet
    const feeWalletAddress = await getFeeWallet()
    if (!feeWalletAddress) {
      return NextResponse.json(
        { error: 'Fee wallet not configured' },
        { status: 500 }
      )
    }
    const feeWallet = new PublicKey(feeWalletAddress)
    const feeTokenAccount = await getAssociatedTokenAddress(tokenMint, feeWallet)

    // Calculate fee
    const feePercentage = job.fee_percentage_at_creation || 5
    const totalPrizes = winners.reduce((sum, w) => sum + w.amount_tokens, 0)
    const escrowTotal = job.escrow_amount_tokens || 0
    const feeAmount = escrowTotal - totalPrizes

    console.log(`[Contest Payout API] Total prizes: ${totalPrizes}`)
    console.log(`[Contest Payout API] Escrow total: ${escrowTotal}`)
    console.log(`[Contest Payout API] Fee amount: ${feeAmount}`)

    // Build transaction
    const transaction = new Transaction()

    // Check existing ATAs
    const ataChecks: PublicKey[] = []
    const winnerATAs: { wallet: PublicKey; ata: PublicKey; amount: number; position: number }[] = []

    for (const winner of winners) {
      const winnerPubkey = new PublicKey(winner.wallet)
      const winnerATA = await getAssociatedTokenAddress(tokenMint, winnerPubkey)
      ataChecks.push(winnerATA)
      winnerATAs.push({
        wallet: winnerPubkey,
        ata: winnerATA,
        amount: winner.amount_tokens,
        position: winner.position
      })
    }
    ataChecks.push(feeTokenAccount)

    const ataInfos = await connection.getMultipleAccountsInfo(ataChecks)

    // Add ATA creation instructions if needed
    for (let i = 0; i < winnerATAs.length; i++) {
      if (!ataInfos[i]) {
        console.log(`[Contest Payout API] Creating ATA for winner ${i + 1}`)
        transaction.add(
          createAssociatedTokenAccountInstruction(
            escrowWallet, // payer
            winnerATAs[i].ata,
            winnerATAs[i].wallet,
            tokenMint
          )
        )
      }
    }

    // Create fee wallet ATA if needed
    if (!ataInfos[ataInfos.length - 1]) {
      console.log(`[Contest Payout API] Creating ATA for fee wallet`)
      transaction.add(
        createAssociatedTokenAccountInstruction(
          escrowWallet,
          feeTokenAccount,
          feeWallet,
          tokenMint
        )
      )
    }

    // Add transfer instructions for each winner
    for (const winner of winnerATAs) {
      const amountRaw = Math.floor(winner.amount * Math.pow(10, decimals))
      console.log(`[Contest Payout API] Transfer ${winner.amount} to position ${winner.position}`)
      
      transaction.add(
        createTransferInstruction(
          escrowTokenAccount,
          winner.ata,
          escrowWallet,
          amountRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      )
    }

    // Add fee transfer
    if (feeAmount > 0) {
      const feeAmountRaw = Math.floor(feeAmount * Math.pow(10, decimals))
      console.log(`[Contest Payout API] Transfer ${feeAmount} fee to platform`)
      
      transaction.add(
        createTransferInstruction(
          escrowTokenAccount,
          feeTokenAccount,
          escrowWallet,
          feeAmountRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      )
    }

    // ==================== SEND TRANSACTION ====================

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = escrowWallet

    // Sign with escrow keypair
    transaction.sign(escrowKeypair)

    console.log(`[Contest Payout API] Sending transaction...`)
    const signature = await connection.sendRawTransaction(transaction.serialize())
    console.log(`[Contest Payout API] Transaction sent: ${signature}`)

    // Confirm transaction
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed')

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
    }

    console.log(`[Contest Payout API] ✅ Transaction confirmed`)

    // ==================== UPDATE DATABASE ====================

    // Update job status
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        escrow_locked: false,
        escrow_tx_signature: signature,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('[Contest Payout API] Failed to update job status:', updateError)
      // Transaction already succeeded, log for manual intervention
    }

    // Record transactions for audit
    const transactionRecords = winners.map(winner => ({
      job_id: jobId,
      transaction_type: 'partial_release' as const,
      from_wallet: escrowWallet.toString(),
      to_wallet: winner.wallet,
      amount_tokens: winner.amount_tokens,
      token_mint: job.escrow_token_mint,
      token_symbol: 'TOKEN',
      tx_signature: signature,
      status: 'confirmed' as const,
      confirmed_at: new Date().toISOString()
    }))

    await supabaseAdmin.from('job_escrow_transactions').insert(transactionRecords)

    const duration = Date.now() - startTime
    console.log(`[Contest Payout API] ✅ Payout complete in ${duration}ms`)

    return NextResponse.json({
      success: true,
      signature,
      totalPaid: totalPrizes,
      feePaid: feeAmount,
      winnersCount: winners.length
    })

  } catch (error: any) {
    console.error('[Contest Payout API] ❌ Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}




