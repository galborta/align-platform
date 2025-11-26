'use client'

import { useState, useEffect } from 'react'
import { IconButton, Tooltip, CircularProgress, Dialog, Box } from '@mui/material'
import { 
  Message as MessageIcon,
  Block as BlockIcon,
  ContentCopy as ContentCopyIcon,
  LocalAtm as LocalAtmIcon
} from '@mui/icons-material'
import { useMessaging } from '@/lib/MessagingContext'
import { canMessageUser } from '@/lib/messaging'
import { toast } from 'react-hot-toast'
import { useWallet } from '@solana/wallet-adapter-react'
import { UserProfileView } from '@/components/UserProfileView'
import TipModal from '@/components/TipModal'

interface WalletAddressWithMessageProps {
  walletAddress: string
  label?: string
  showFullAddress?: boolean
  projectId?: string
  tokenMint?: string
  className?: string
}

export function WalletAddressWithMessage({
  walletAddress,
  label,
  showFullAddress = false,
  projectId,
  tokenMint,
  className = ''
}: WalletAddressWithMessageProps) {
  const { publicKey } = useWallet()
  const { openMessages } = useMessaging()
  const [canMessage, setCanMessage] = useState(false)
  const [messageReason, setMessageReason] = useState<string>()
  const [checking, setChecking] = useState(false)
  const [opening, setOpening] = useState(false)
  const [showProfileView, setShowProfileView] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  
  const currentWallet = publicKey?.toString()
  const isOwnWallet = currentWallet === walletAddress

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  // Check if current user can message this wallet
  useEffect(() => {
    if (!currentWallet || isOwnWallet) return

    const checkCanMessage = async () => {
      setChecking(true)
      const result = await canMessageUser(
        currentWallet,
        walletAddress,
        projectId
      )
      setCanMessage(result.canMessage)
      setMessageReason(result.reason)
      setChecking(false)
    }

    checkCanMessage()
  }, [currentWallet, walletAddress, projectId, isOwnWallet])

  const handleOpenMessage = async () => {
    if (!currentWallet || !canMessage) return
    
    setOpening(true)
    try {
      await openMessages(walletAddress)
    } catch (error) {
      console.error('Error opening messages:', error)
      toast.error('Failed to open messages')
    } finally {
      setOpening(false)
    }
  }

  const handleMessage = () => {
    setShowProfileView(false)
    // Profile modal will be closed, nothing else needed
  }

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {label && (
          <span className="font-medium text-sm">{label}</span>
        )}
        
        {/* Clickable wallet address - opens profile */}
        <span 
          className="font-mono text-xs text-gray-600 hover:text-purple-600 cursor-pointer transition-colors underline decoration-dotted"
          onClick={() => setShowProfileView(true)}
          title="View profile"
        >
          {showFullAddress ? walletAddress : shortenAddress(walletAddress)}
        </span>
        
        {/* Copy button */}
        <Tooltip title="Copy address" arrow>
          <IconButton
            size="small"
            onClick={() => copyToClipboard(walletAddress)}
            sx={{ 
              color: '#666',
              '&:hover': { color: '#333' }
            }}
          >
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>

        {/* Message button (only if not own wallet and wallet connected) */}
        {!isOwnWallet && currentWallet && (
          <>
            {checking ? (
              <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
            ) : !canMessage ? (
              <Tooltip title={messageReason || "Can't message"} arrow>
                <IconButton
                  size="small"
                  disabled
                  sx={{ color: '#9E9E9E', cursor: 'not-allowed' }}
                >
                  <BlockIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Send message" arrow>
                <IconButton
                  size="small"
                  onClick={handleOpenMessage}
                  disabled={opening}
                  sx={{
                    color: '#7C4DFF',
                    '&:hover': { 
                      bgcolor: 'rgba(124, 77, 255, 0.1)',
                      boxShadow: '0 0 8px rgba(124, 77, 255, 0.4)'
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {opening ? (
                    <CircularProgress size={16} sx={{ color: '#7C4DFF' }} />
                  ) : (
                    <MessageIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {/* Tip button (only if not own wallet and wallet connected and tokenMint provided) */}
        {!isOwnWallet && currentWallet && tokenMint && (
          <Tooltip title="Send tip" arrow>
            <IconButton
              size="small"
              onClick={() => setShowTipModal(true)}
              sx={{
                color: '#36C170',
                '&:hover': { 
                  bgcolor: 'rgba(54, 193, 112, 0.1)',
                  boxShadow: '0 0 8px rgba(54, 193, 112, 0.4)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <LocalAtmIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </div>

      {/* Profile View Modal */}
      <Dialog
        open={showProfileView}
        onClose={(event, reason) => {
          // Stop propagation when clicking backdrop to prevent click-through
          if (reason === 'backdropClick' && event) {
            event.stopPropagation()
          }
          setShowProfileView(false)
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }}
        BackdropProps={{
          onClick: (e) => e.stopPropagation(), // Additional safety layer
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }
        }}
      >
        <Box 
          onClick={(e) => e.stopPropagation()}
          sx={{ 
            bgcolor: 'background.paper',
            overflow: 'auto'
          }}
        >
          <UserProfileView
            walletAddress={walletAddress}
            currentUserWallet={currentWallet}
            projectId={projectId}
            tokenMint={tokenMint}
            onClose={() => setShowProfileView(false)}
            onMessage={handleMessage}
          />
        </Box>
      </Dialog>

      {/* Tip Modal */}
      {tokenMint && projectId && (
        <TipModal
          open={showTipModal}
          onClose={() => setShowTipModal(false)}
          recipientWallet={walletAddress}
          projectId={projectId}
          tokenMint={tokenMint}
        />
      )}
    </>
  )
}

