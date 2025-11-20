'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button, Chip } from '@mui/material'
import { supabase } from '@/lib/supabase'
import { getWalletTokenData } from '@/lib/token-balance'
import { calculateKarma } from '@/lib/karma'
import { toast } from 'react-hot-toast'

interface AssetVotingCardProps {
  asset: any
  currentWallet?: string
  projectId: string
}

export function AssetVotingCard({ asset, currentWallet, projectId }: AssetVotingCardProps) {
  const wallet = useWallet()
  const [hasVoted, setHasVoted] = useState(false)
  const [voteType, setVoteType] = useState<'upvote' | 'report' | null>(null)
  const [voting, setVoting] = useState(false)
  
  // Check if current wallet already voted
  useEffect(() => {
    if (!currentWallet) return
    
    async function checkVote() {
      const { data } = await supabase
        .from('asset_votes')
        .select('vote_type')
        .eq('pending_asset_id', asset.id)
        .eq('voter_wallet', currentWallet)
        .maybeSingle()
      
      if (data) {
        setHasVoted(true)
        setVoteType(data.vote_type)
      }
    }
    
    checkVote()
  }, [asset.id, currentWallet])

  const handleVote = async (type: 'upvote' | 'report') => {
    if (!currentWallet || hasVoted || voting) return
    
    setVoting(true)
    
    try {
      // 1. Get project data for token mint
      const { data: project } = await supabase
        .from('projects')
        .select('token_mint')
        .eq('id', projectId)
        .single()
      
      if (!project) {
        toast.error('Project not found')
        setVoting(false)
        return
      }
      
      // 2. Get token balance
      const tokenData = await getWalletTokenData(
        currentWallet,
        project.token_mint
      )
      
      if (!tokenData || tokenData.balance === 0) {
        toast.error('You must hold tokens to vote')
        setVoting(false)
        return
      }
      
      // 3. Check not banned
      const { data: karma } = await supabase
        .from('wallet_karma')
        .select('is_banned')
        .eq('wallet_address', currentWallet)
        .eq('project_id', projectId)
        .maybeSingle()
      
      if (karma?.is_banned) {
        toast.error('Your wallet is banned from voting')
        setVoting(false)
        return
      }
      
      // 4. Record vote
      const { error: voteError } = await supabase
        .from('asset_votes')
        .insert({
          pending_asset_id: asset.id,
          voter_wallet: currentWallet,
          vote_type: type,
          token_balance_snapshot: tokenData.balance,
          token_percentage_snapshot: tokenData.percentage
        })
      
      if (voteError) {
        console.error('Vote error:', voteError)
        toast.error('Vote failed. You may have already voted.')
        setVoting(false)
        return
      }
      
      // 5. Update pending asset totals
      if (type === 'upvote') {
        await supabase.rpc('increment_upvote', {
          p_asset_id: asset.id,
          p_weight: tokenData.percentage
        })
      } else {
        await supabase.rpc('increment_report', {
          p_asset_id: asset.id,
          p_weight: tokenData.percentage
        })
      }
      
      // 6. Award immediate karma (25%)
      const immediateKarma = calculateKarma(
        type === 'upvote' ? 'upvote' : 'report',
        tokenData.percentage,
        true
      )
      
      await supabase.rpc('add_karma', {
        p_wallet: currentWallet,
        p_project_id: projectId,
        p_karma_delta: immediateKarma
      })
      
      // Update local state
      setHasVoted(true)
      setVoteType(type)
      
      toast.success(
        `${type === 'upvote' ? 'Upvoted' : 'Reported'}! Earned ${immediateKarma.toFixed(1)} karma`
      )
      
    } catch (error) {
      console.error('Error voting:', error)
      toast.error('An error occurred while voting')
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex flex-col gap-3">
        {/* Status and Stats */}
        <div>
          <StatusBadge status={asset.verification_status} />
          <div className="text-sm text-gray-600 mt-2">
            <strong>{asset.total_upvote_weight.toFixed(2)}%</strong> supply,{' '}
            <strong>{asset.unique_upvoters_count}</strong> votes
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {getNextThreshold(asset)}
          </div>
        </div>
        
        {/* Voting Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
          {!hasVoted && currentWallet && (
            <>
              <Button
                size="medium"
                onClick={() => handleVote('upvote')}
                disabled={voting}
                sx={{ 
                  bgcolor: 'rgb(34, 197, 94)',
                  color: 'white',
                  minWidth: '110px',
                  '&:hover': { bgcolor: 'rgb(22, 163, 74)' },
                  '&:disabled': { bgcolor: 'rgb(209, 213, 219)' }
                }}
              >
                ↑ Upvote
              </Button>
              <Button
                size="medium"
                onClick={() => handleVote('report')}
                disabled={voting}
                sx={{ 
                  bgcolor: 'rgb(239, 68, 68)',
                  color: 'white',
                  minWidth: '110px',
                  '&:hover': { bgcolor: 'rgb(220, 38, 38)' },
                  '&:disabled': { bgcolor: 'rgb(209, 213, 219)' }
                }}
              >
                ↓ Report
              </Button>
            </>
          )}
          
          {hasVoted && (
            <Chip 
              label={`You ${voteType}d ✓`}
              size="medium"
              color={voteType === 'upvote' ? 'success' : 'error'}
            />
          )}
          
          {!currentWallet && (
            <div className="text-sm text-gray-500">
              Connect wallet to vote
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    backed: 'bg-green-100 text-green-800',
    verified: 'bg-purple-100 text-purple-800',
    hidden: 'bg-red-100 text-red-800'
  }
  
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${colors[status as keyof typeof colors] || colors.pending}`}>
      {status.toUpperCase()}
    </span>
  )
}

function getNextThreshold(asset: any): string {
  if (asset.verification_status === 'pending') {
    const needSupply = Math.max(0, 0.5 - asset.total_upvote_weight)
    const needVoters = Math.max(0, 5 - asset.unique_upvoters_count)
    
    if (needSupply <= 0 || needVoters <= 0) {
      return 'Ready for BACKED status'
    }
    
    return `Need ${needSupply.toFixed(2)}% supply OR ${needVoters} more votes for BACKED`
  }
  
  if (asset.verification_status === 'backed') {
    const needSupply = Math.max(0, 5.0 - asset.total_upvote_weight)
    const needVoters = Math.max(0, 10 - asset.unique_upvoters_count)
    
    if (needSupply <= 0 || needVoters <= 0) {
      return 'Ready for VERIFIED status'
    }
    
    return `Need ${needSupply.toFixed(2)}% supply OR ${needVoters} more votes for VERIFIED`
  }
  
  if (asset.verification_status === 'verified') {
    return '✓ Fully verified'
  }
  
  return ''
}

