'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Tabs,
  Tab,
  Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import UnpaidSubmissionsManager from './UnpaidSubmissionsManager'
import PaidSubmissionsManager from './PaidSubmissionsManager'

interface CampaignManagementModalProps {
  open: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  onSubmissionUpdated?: () => void
}

export default function CampaignManagementModal({
  open,
  onClose,
  jobId,
  jobTitle,
  onSubmissionUpdated
}: CampaignManagementModalProps) {
  const [currentTab, setCurrentTab] = useState(0)

  const handleSubmissionUpdated = () => {
    onSubmissionUpdated?.()
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card, 16px)',
          bgcolor: '#FFFFFF'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 1,
        borderBottom: '1px solid var(--border-subtle, #E5E7F0)'
      }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1E' }}>
            Manage Campaign
          </Typography>
          <Typography variant="caption" sx={{ color: '#6F7280' }}>
            {jobTitle}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={currentTab}
        onChange={(_, newValue) => setCurrentTab(newValue)}
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          px: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '14px'
          }
        }}
      >
        <Tab label="Unpaid Submissions" />
        <Tab label="Paid Submissions" />
      </Tabs>

      <DialogContent sx={{ p: 3 }}>
        {currentTab === 0 && (
          <UnpaidSubmissionsManager 
            jobId={jobId}
            onSubmissionUpdated={handleSubmissionUpdated}
          />
        )}
        {currentTab === 1 && (
          <PaidSubmissionsManager 
            jobId={jobId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
