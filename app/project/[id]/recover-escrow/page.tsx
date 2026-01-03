'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Connection } from '@solana/web3.js'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import Link from 'next/link'

interface TransactionInfo {
  signature: string
  blockTime: number | null
  amount: number | null
  confirmed: boolean
  fromWallet: string
  toWallet: string
}

interface RecoveryJobData {
  title: string
  description: string
  kpis: string
  category: string
  paymentAmountTokens: number
  assignmentMode: 'first_come' | 'review'
  desiredCompletionDays: string
}

export default function RecoverEscrowPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  
  const [txSignature, setTxSignature] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [txInfo, setTxInfo] = useState<TransactionInfo | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [project, setProject] = useState<any>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [existingJobId, setExistingJobId] = useState<string | null>(null)
  
  // Job creation form
  const [jobData, setJobData] = useState<RecoveryJobData>({
    title: '',
    description: '',
    kpis: '',
    category: 'other',
    paymentAmountTokens: 0,
    assignmentMode: 'review',
    desiredCompletionDays: '7'
  })

  // Fetch project info
  useEffect(() => {
    async function fetchProject() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      
      if (!error && data) {
        setProject(data)
      }
    }
    fetchProject()
  }, [projectId])

  // Search for transaction on-chain
  const handleSearchTransaction = async () => {
    if (!txSignature.trim()) {
      toast.error('Please enter a transaction signature')
      return
    }

    setIsSearching(true)
    setTxError(null)
    setTxInfo(null)
    setExistingJobId(null)

    try {
      // First check if job already exists with this signature
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('escrow_tx_signature', txSignature.trim())
        .single()

      if (existingJob) {
        setExistingJobId(existingJob.id)
        toast.success(`Job already exists: ${existingJob.title}`)
        setIsSearching(false)
        return
      }

      // Fetch transaction from Solana
      const tx = await connection.getTransaction(txSignature.trim(), {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      if (!tx) {
        setTxError('Transaction not found on-chain. It may still be processing or the signature is incorrect.')
        setIsSearching(false)
        return
      }

      if (tx.meta?.err) {
        setTxError(`Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`)
        setIsSearching(false)
        return
      }

      // Extract transaction info
      const accountKeys = tx.transaction.message.getAccountKeys()
      const fromWallet = accountKeys.get(0)?.toBase58() || 'Unknown'
      
      // Try to find escrow wallet (usually second account in transfer)
      const toWallet = accountKeys.get(1)?.toBase58() || 'Unknown'

      // Calculate approximate token amount from balance changes
      let amount: number | null = null
      if (tx.meta?.postTokenBalances && tx.meta?.preTokenBalances) {
        // Look for token balance changes
        const preBalance = tx.meta.preTokenBalances.find(b => b.owner === fromWallet)
        const postBalance = tx.meta.postTokenBalances.find(b => b.owner === fromWallet)
        
        if (preBalance && postBalance) {
          const preBal = parseFloat(preBalance.uiTokenAmount.uiAmountString || '0')
          const postBal = parseFloat(postBalance.uiTokenAmount.uiAmountString || '0')
          amount = preBal - postBal
        }
      }

      setTxInfo({
        signature: txSignature.trim(),
        blockTime: tx.blockTime,
        amount,
        confirmed: true,
        fromWallet,
        toWallet
      })

      toast.success('Transaction found and verified!')

    } catch (error: any) {
      console.error('Error searching transaction:', error)
      setTxError(error.message || 'Failed to fetch transaction')
    } finally {
      setIsSearching(false)
    }
  }

  // Recover the job
  const handleRecoverJob = async () => {
    if (!txInfo || !publicKey || !project) {
      toast.error('Missing required information')
      return
    }

    if (!jobData.title.trim() || !jobData.description.trim()) {
      toast.error('Please fill in job title and description')
      return
    }

    setIsRecovering(true)

    try {
      // Calculate escrow amount with fee
      const feePercentage = project.fee_percentage || 5.0
      const paymentAmount = jobData.paymentAmountTokens || (txInfo.amount ? txInfo.amount / (1 + feePercentage / 100) : 0)
      const escrowAmount = txInfo.amount || paymentAmount * (1 + feePercentage / 100)

      // Call the recovery API
      const response = await fetch('/api/jobs/recover-from-escrow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          escrow_tx_signature: txInfo.signature,
          project_id: projectId,
          poster_wallet: publicKey.toBase58(),
          title: jobData.title.trim(),
          description: jobData.description.trim(),
          kpis: jobData.kpis.trim() || 'As described',
          category: jobData.category,
          payment_amount_tokens: paymentAmount,
          assignment_mode: jobData.assignmentMode,
          token_symbol: project.token_symbol
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Recovery failed')
      }

      toast.success('Job recovered successfully!')
      router.push(`/project/${projectId}/jobs/${result.job.id}`)

    } catch (error: any) {
      console.error('Recovery error:', error)
      toast.error(error.message || 'Failed to recover job')
    } finally {
      setIsRecovering(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Link href={`/project/${projectId}`}>
          <Button startIcon={<ArrowBackIcon />} sx={{ color: '#6F7280' }}>
            Back to Project
          </Button>
        </Link>
      </Box>

      <Paper sx={{ p: 4, borderRadius: '16px' }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontFamily: 'var(--font-display), Space Grotesk, sans-serif',
            fontWeight: 700,
            mb: 1
          }}
        >
          🔧 Recover Job from Escrow
        </Typography>
        
        <Typography sx={{ color: '#6F7280', mb: 4 }}>
          If your tokens were locked but the job wasn't created, enter the transaction signature to recover.
        </Typography>

        {/* Step 1: Enter Transaction Signature */}
        <Paper 
          variant="outlined" 
          sx={{ p: 3, mb: 3, bgcolor: '#F8F5FF', border: '1px solid #E5DEFF', borderRadius: '12px' }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon /> Step 1: Find Your Transaction
          </Typography>
          
          <Typography sx={{ color: '#6F7280', mb: 2, fontSize: '14px' }}>
            Check your wallet (Phantom/Solflare) transaction history for a recent transfer to the escrow wallet:
          </Typography>
          
          <Chip 
            label="Eyyue9xYUiGFqQ8yjBowfiiAgG41hD4mAxb79nThN6ev"
            sx={{ mb: 2, fontFamily: 'monospace', fontSize: '12px' }}
          />

          <TextField
            fullWidth
            label="Transaction Signature"
            placeholder="Enter the transaction signature from your wallet"
            value={txSignature}
            onChange={(e) => setTxSignature(e.target.value)}
            sx={{ mb: 2 }}
            helperText="This is the long string that identifies your transaction (e.g., 5KVvJq...)"
          />

          <Button
            variant="contained"
            onClick={handleSearchTransaction}
            disabled={isSearching || !txSignature.trim()}
            startIcon={isSearching ? <CircularProgress size={20} /> : <SearchIcon />}
            sx={{ 
              bgcolor: '#7C4DFF',
              '&:hover': { bgcolor: '#6B3FE8' }
            }}
          >
            {isSearching ? 'Searching...' : 'Search Transaction'}
          </Button>
        </Paper>

        {/* Transaction Error */}
        {txError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {txError}
          </Alert>
        )}

        {/* Existing Job Found */}
        {existingJobId && (
          <Alert 
            severity="success" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={() => router.push(`/project/${projectId}/jobs/${existingJobId}`)}
              >
                View Job
              </Button>
            }
          >
            A job already exists with this transaction. No recovery needed!
          </Alert>
        )}

        {/* Transaction Found */}
        {txInfo && !existingJobId && (
          <>
            {/* Transaction Info */}
            <Alert 
              severity="success" 
              icon={<CheckCircleIcon />}
              sx={{ mb: 3 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Transaction Verified ✓
              </Typography>
              <Typography variant="body2">
                Signature: {txInfo.signature.slice(0, 20)}...{txInfo.signature.slice(-8)}
              </Typography>
              {txInfo.amount && (
                <Typography variant="body2">
                  Amount: ~{txInfo.amount.toFixed(2)} {project?.token_symbol || 'tokens'}
                </Typography>
              )}
              {txInfo.blockTime && (
                <Typography variant="body2">
                  Time: {new Date(txInfo.blockTime * 1000).toLocaleString()}
                </Typography>
              )}
            </Alert>

            {/* Step 2: Enter Job Details */}
            <Paper 
              variant="outlined" 
              sx={{ p: 3, mb: 3, border: '2px solid #7C4DFF', borderRadius: '12px' }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                ✏️ Step 2: Enter Job Details
              </Typography>
              
              <Typography sx={{ color: '#6F7280', mb: 3, fontSize: '14px' }}>
                Enter the details for the job you were trying to create:
              </Typography>

              <TextField
                fullWidth
                label="Job Title"
                value={jobData.title}
                onChange={(e) => setJobData({ ...jobData, title: e.target.value })}
                sx={{ mb: 2 }}
                required
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description"
                value={jobData.description}
                onChange={(e) => setJobData({ ...jobData, description: e.target.value })}
                sx={{ mb: 2 }}
                required
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                label="KPIs / Success Criteria"
                value={jobData.kpis}
                onChange={(e) => setJobData({ ...jobData, kpis: e.target.value })}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  select
                  label="Category"
                  value={jobData.category}
                  onChange={(e) => setJobData({ ...jobData, category: e.target.value })}
                  sx={{ flex: 1 }}
                  SelectProps={{ native: true }}
                >
                  <option value="design">Design</option>
                  <option value="marketing">Marketing</option>
                  <option value="development">Development</option>
                  <option value="content">Content</option>
                  <option value="community">Community</option>
                  <option value="other">Other</option>
                </TextField>

                <TextField
                  select
                  label="Assignment Mode"
                  value={jobData.assignmentMode}
                  onChange={(e) => setJobData({ ...jobData, assignmentMode: e.target.value as any })}
                  sx={{ flex: 1 }}
                  SelectProps={{ native: true }}
                >
                  <option value="review">Review Applications</option>
                  <option value="first_come">First Come First Served</option>
                </TextField>
              </Box>

              {txInfo.amount && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Payment amount will be calculated from your escrowed tokens: 
                    <strong> ~{(txInfo.amount / 1.05).toFixed(2)} {project?.token_symbol}</strong>
                    (minus 5% platform fee already included)
                  </Typography>
                </Alert>
              )}
            </Paper>

            {/* Step 3: Recover */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleRecoverJob}
              disabled={isRecovering || !jobData.title.trim() || !jobData.description.trim()}
              startIcon={isRecovering ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
              sx={{ 
                py: 1.5,
                bgcolor: '#36C170',
                '&:hover': { bgcolor: '#2BA05A' },
                '&:disabled': { bgcolor: '#9CA3AF' }
              }}
            >
              {isRecovering ? 'Recovering Job...' : '🚀 Recover & Create Job'}
            </Button>
          </>
        )}

        {/* Help Section */}
        <Divider sx={{ my: 4 }} />
        
        <Box sx={{ bgcolor: '#FEF3C7', p: 3, borderRadius: '12px' }}>
          <Typography sx={{ fontWeight: 600, color: '#92400E', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningIcon /> Need Help?
          </Typography>
          <Typography sx={{ color: '#92400E', fontSize: '14px' }}>
            If you can't find your transaction or this recovery doesn't work, please contact support with:
          </Typography>
          <ul style={{ margin: '8px 0 0 16px', color: '#92400E', fontSize: '14px' }}>
            <li>Your wallet address</li>
            <li>Approximate time of the transaction</li>
            <li>Amount of tokens you sent</li>
          </ul>
        </Box>
      </Paper>
    </Container>
  )
}

