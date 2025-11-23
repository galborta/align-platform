'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '@/components/WalletButton'
import { Menu, MenuItem, IconButton, Badge, Tooltip } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import SettingsIcon from '@mui/icons-material/Settings'
import MailIcon from '@mui/icons-material/Mail'
import { useMessaging } from '@/lib/MessagingContext'

export function AppHeader() {
  const wallet = useWallet()
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const { openMessages, unreadCount } = useMessaging()

  return (
    <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href="/">
            <h1 className="font-display text-2xl font-bold text-text-primary cursor-pointer hover:text-accent-primary transition-colors">
              Align
            </h1>
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Profile Menu (only show if wallet connected) */}
            {wallet?.publicKey && (
              <>
                <IconButton
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  sx={{ 
                    color: '#7C4DFF',
                    '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.08)' }
                  }}
                >
                  <PersonIcon />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  PaperProps={{
                    sx: {
                      mt: 1,
                      minWidth: 200,
                      '& .MuiMenuItem-root': {
                        px: 2,
                        py: 1.5,
                        gap: 2,
                        '&:hover': {
                          bgcolor: 'rgba(124, 77, 255, 0.08)'
                        }
                      }
                    }
                  }}
                >
                  <MenuItem 
                    onClick={() => {
                      router.push('/profile')
                      setAnchorEl(null)
                    }}
                  >
                    <PersonIcon sx={{ fontSize: 20, color: '#7C4DFF' }} />
                    View Profile
                  </MenuItem>
                  <MenuItem 
                    onClick={() => {
                      router.push('/profile/settings')
                      setAnchorEl(null)
                    }}
                  >
                    <SettingsIcon sx={{ fontSize: 20, color: '#7C4DFF' }} />
                    Settings
                  </MenuItem>
                </Menu>
              </>
            )}
            
            {/* Messages Button (only show if wallet connected) */}
            {wallet?.publicKey && (
              <Tooltip title="Messages (Cmd+M)">
                <IconButton
                  onClick={() => openMessages()}
                  sx={{ 
                    color: '#7C4DFF',
                    '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.08)' }
                  }}
                >
                  <Badge
                    badgeContent={unreadCount}
                    sx={{
                      '& .MuiBadge-badge': {
                        bgcolor: '#7C4DFF',
                        color: 'white',
                        fontWeight: 700
                      }
                    }}
                  >
                    <MailIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  )
}

