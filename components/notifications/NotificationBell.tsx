'use client'

import { useState } from 'react'
import { IconButton, Badge } from '@mui/material'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { NotificationDropdown } from './NotificationDropdown'

/**
 * NotificationBell Component
 * 
 * Bell icon with unread notification badge in the header.
 * Click to open dropdown showing recent notifications.
 * 
 * Features:
 * - Shows unread count in red badge (max 99+)
 * - Opens dropdown on click
 * - Uses real-time notifications from useNotifications hook
 * - Purple primary color scheme (#7C4DFF)
 * - Badge only shows when unreadCount > 0
 */
export function NotificationBell() {
  const { unreadCount } = useNotifications()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton 
        onClick={handleClick}
        sx={{
          color: '#7C4DFF',
          '&:hover': { 
            bgcolor: 'rgba(124, 77, 255, 0.08)',
            boxShadow: '0 0 8px rgba(124, 77, 255, 0.3)'
          },
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <Badge 
          badgeContent={unreadCount}
          invisible={unreadCount === 0}
          showZero={false}
          max={99}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          sx={{
            '& .MuiBadge-badge': {
              bgcolor: '#EF4444', // Red color - matches message badge
              color: 'white',
              fontWeight: 700,
              fontSize: '10px',
              height: '16px',
              minWidth: '16px',
              borderRadius: '8px',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              transform: 'scale(1) translate(50%, -50%)',
              transformOrigin: '100% 0%',
              animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': {
                  transform: 'scale(1) translate(50%, -50%)',
                  opacity: 1
                },
                '50%': {
                  transform: 'scale(1.1) translate(50%, -50%)',
                  opacity: 0.9
                }
              }
            }
          }}
        >
          <Bell size={24} />
        </Badge>
      </IconButton>
      
      <NotificationDropdown 
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      />
    </>
  )
}


