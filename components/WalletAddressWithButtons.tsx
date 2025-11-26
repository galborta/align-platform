'use client'

import { useState, useEffect } from 'react'
import { Box, Typography, Chip, IconButton, Tooltip, CircularProgress } from '@mui/material'
import { Message as MessageIcon, LocalAtm as LocalAtmIcon } from '@mui/icons-material'
import Link from 'next/link'
import { useWallet } from '@solana/wallet-adapter-react'
import { useMessaging } from '@/lib/MessagingContext'
import { canMessageUser } from '@/lib/messaging'
import TipModal from '@/components/TipModal'
import toast from 'react-hot-toast'

interface WalletAddressWithButtonsProps {
  address: string
  displayName?: string | null
  showMessage?: boolean
  showTip?: boolean
  tierBadge?: boolean
  compact?: boolean
  className?: string
  projectId?: string
  tokenMint?: string
}

/**
 * WalletAddressWithButtons - Reusable component for displaying wallet addresses with inline actions
 * 
 * Features:
 * - Display name or truncated address with profile link
 * - Optional supporter tier badge
 * - Inline Message and Tip icon buttons
 * - Privacy-aware messaging (checks permissions)
 * - Hides buttons when viewing own address
 * - Compact mode for tight spaces
 * - Stops event propagation to prevent unwanted navigation
 * 
 * @example
 * ```tsx
 * <WalletAddressWithButtons 
 *   address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
 *   displayName="Alice"
 *   showMessage
 *   showTip
 *   tierBadge
 *   projectId="project-123"
 *   tokenMint="token-456"
 * />
 * ```
 */
export function WalletAddressWithButtons({
  address,
  displayName,
  showMessage = false,
  showTip = false,
  tierBadge = false,
  compact = false,
  className = '',
  projectId,
  tokenMint
}: WalletAddressWithButtonsProps) {
  const { publicKey } = useWallet()
  const { openMessages } = useMessaging()
  const [showTipModal, setShowTipModal] = useState(false)
  const [canMessage, setCanMessage] = useState(false)
  const [checkingMessage, setCheckingMessage] = useState(false)
  const [openingMessage, setOpeningMessage] = useState(false)
  
  const currentWallet = publicKey?.toBase58()
  
  // Don't show buttons if viewing own address
  const isSelf = currentWallet === address
  
  const truncateAddress = (addr: string): string => {
    if (!addr) return '...'
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
  }

  // Check if current user can message this wallet
  useEffect(() => {
    if (!showMessage || !currentWallet || isSelf) {
      setCanMessage(false)
      return
    }

    const checkCanMessage = async () => {
      setCheckingMessage(true)
      const result = await canMessageUser(
        currentWallet,
        address,
        projectId
      )
      setCanMessage(result.canMessage)
      setCheckingMessage(false)
    }

    checkCanMessage()
  }, [currentWallet, address, projectId, isSelf, showMessage])
  
  const handleMessageClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    if (!currentWallet || !canMessage || openingMessage) return
    
    setOpeningMessage(true)
    try {
      await openMessages(address)
    } catch (error) {
      console.error('Error opening messages:', error)
      toast.error('Failed to open messages')
    } finally {
      setOpeningMessage(false)
    }
  }
  
  const handleTipClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    // Validate required props for tipping
    if (!projectId || !tokenMint) {
      console.error('Cannot open tip modal: missing projectId or tokenMint', {
        projectId,
        tokenMint,
        address
      })
      toast.error('Tipping not available for this item')
      return
    }
    
    // Validate wallet connection
    if (!currentWallet) {
      toast.error('Please connect your wallet to send tips')
      return
    }
    
    setShowTipModal(true)
  }
  
  const handleCloseTipModal = () => {
    setShowTipModal(false)
  }
  
  return (
    <>
      <Box 
        className={`wallet-address-buttons ${className}`}
        sx={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: 0.5,
          flexWrap: 'nowrap'
        }}
      >
        {/* Wallet Address/Name */}
        <Link 
          href={`/profile/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            textDecoration: 'none',
            color: 'inherit'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Typography
            variant={compact ? 'caption' : 'body2'}
            component="span"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              fontFamily: displayName ? 'inherit' : 'monospace',
              fontSize: compact ? '0.75rem' : '0.875rem',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline'
              }
            }}
          >
            {displayName || truncateAddress(address)}
          </Typography>
        </Link>
        
        {/* Supporter Tier Badge */}
        {tierBadge && (
          <Chip 
            label="Holder"
            size="small"
            sx={{
              height: compact ? 16 : 18,
              fontSize: compact ? 9 : 10,
              fontWeight: 600,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              '& .MuiChip-label': { px: 0.5 }
            }}
          />
        )}
        
        {/* Action Buttons */}
        {!isSelf && (showMessage || showTip) && (
          <Box sx={{ display: 'inline-flex', gap: 0.25, ml: 0.25 }}>
            {/* Message Button */}
            {showMessage && (
              <>
                {checkingMessage ? (
                  <CircularProgress size={compact ? 14 : 16} sx={{ color: '#7C4DFF' }} />
                ) : canMessage ? (
                  <Tooltip title="Send message" arrow>
                    <IconButton
                      size="small"
                      onClick={handleMessageClick}
                      disabled={openingMessage}
                      sx={{
                        color: '#7C4DFF',
                        padding: compact ? '2px' : '4px',
                        '&:hover': { 
                          bgcolor: 'rgba(124, 77, 255, 0.1)',
                          boxShadow: '0 0 8px rgba(124, 77, 255, 0.4)'
                        },
                        transition: 'all 0.2s ease-in-out'
                      }}
                    >
                      {openingMessage ? (
                        <CircularProgress size={compact ? 14 : 16} sx={{ color: '#7C4DFF' }} />
                      ) : (
                        <MessageIcon sx={{ fontSize: compact ? 14 : 16 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                ) : null}
              </>
            )}
            
            {/* Tip Button */}
            {showTip && tokenMint && projectId && (
              <Tooltip title="Send tip" arrow>
                <IconButton
                  size="small"
                  onClick={handleTipClick}
                  sx={{
                    color: '#36C170',
                    padding: compact ? '2px' : '4px',
                    '&:hover': { 
                      bgcolor: 'rgba(54, 193, 112, 0.1)',
                      boxShadow: '0 0 8px rgba(54, 193, 112, 0.4)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <LocalAtmIcon sx={{ fontSize: compact ? 14 : 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      {/* Tip Modal */}
      {showTipModal && (
        <TipModal
          open={showTipModal}
          onClose={handleCloseTipModal}
          recipientWallet={address}
          projectId={projectId!}
          tokenMint={tokenMint!}
        />
      )}
    </>
  )
}

