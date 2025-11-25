import React from 'react'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'

interface SupporterBadgeProps {
  completedJobsCount: number
  size?: 'small' | 'medium'
}

export function SupporterBadge({ 
  completedJobsCount, 
  size = 'small' 
}: SupporterBadgeProps) {
  const getTierInfo = (count: number) => {
    if (count === 0) return null
    if (count >= 50) return { 
      name: 'Legend', 
      color: '#FFD700', 
      bgColor: '#FFF9E6' 
    }
    if (count >= 20) return { 
      name: 'Architect', 
      color: '#7C4DFF', 
      bgColor: '#EEE7FF' 
    }
    if (count >= 5) return { 
      name: 'Builder', 
      color: '#2563EB', 
      bgColor: '#E8F4FF' 
    }
    return { 
      name: 'Contributor', 
      color: '#36C170', 
      bgColor: '#E3F8ED' 
    }
  }

  const tierInfo = getTierInfo(completedJobsCount)
  if (!tierInfo) return null

  return (
    <Tooltip 
      title={`${completedJobsCount} job${completedJobsCount !== 1 ? 's' : ''} completed`}
      arrow
    >
      <Chip
        icon={<WorkspacePremiumIcon sx={{ fontSize: size === 'small' ? 14 : 18 }} />}
        label={tierInfo.name}
        size={size}
        sx={{
          backgroundColor: tierInfo.bgColor,
          color: tierInfo.color,
          fontWeight: 600,
          fontSize: size === 'small' ? '11px' : '13px',
          height: size === 'small' ? '24px' : '28px',
          '& .MuiChip-icon': {
            color: tierInfo.color
          }
        }}
      />
    </Tooltip>
  )
}

