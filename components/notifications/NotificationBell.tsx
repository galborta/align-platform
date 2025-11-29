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
 * - Shows unread count in lime badge (max 99+)
 * - Opens dropdown on click
 * - Uses real-time notifications from useNotifications hook
 * - Purple primary color scheme (#7C4DFF)
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
          color: '#fff',
          '&:hover': { 
            backgroundColor: 'rgba(124, 77, 255, 0.1)' 
          }
        }}
      >
        <Badge 
          badgeContent={unreadCount} 
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#E3F06F',  // Lime accent
              color: '#000',
              fontWeight: 600,
              fontSize: '0.7rem',
              minWidth: 18,
              height: 18
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

