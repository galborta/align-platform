'use client'

import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { CampaignTypeSelector, SocialCampaignType } from '@/components/jobs/social'

export default function CampaignTypeSelectorTestPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<SocialCampaignType | null>(null)

  const handleSelect = (type: SocialCampaignType) => {
    setSelectedType(type)
    setIsModalOpen(false)
    console.log('Selected campaign type:', type)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--page-background, #E3F06F)',
        p: 3
      }}
    >
      <Box
        sx={{
          bgcolor: 'var(--card-background, #FFFFFF)',
          borderRadius: 'var(--radius-card-lg, 24px)',
          p: 'var(--space-xl, 32px)',
          maxWidth: '500px',
          width: '100%',
          boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)',
            mb: 2,
            textAlign: 'center'
          }}
        >
          Campaign Type Selector Test
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            color: 'var(--text-secondary, #6F7280)',
            mb: 4,
            textAlign: 'center'
          }}
        >
          Click the button below to open the Campaign Type Selection Modal
        </Typography>

        <Button
          variant="contained"
          fullWidth
          onClick={() => setIsModalOpen(true)}
          sx={{
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 600,
            fontSize: '16px',
            py: 1.5,
            borderRadius: 'var(--radius-control, 999px)',
            boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
            '&:hover': {
              bgcolor: '#6A3FE8',
              boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
            }
          }}
        >
          Open Campaign Type Selector
        </Button>

        {selectedType && (
          <Box
            sx={{
              mt: 4,
              p: 3,
              bgcolor: 'var(--accent-success-soft, #E3F8ED)',
              borderRadius: '12px',
              border: '1px solid var(--accent-success, #36C170)'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontWeight: 600,
                color: 'var(--accent-success, #36C170)',
                mb: 1
              }}
            >
              ✓ Campaign Type Selected
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                color: 'var(--text-primary, #1A1A1E)',
                fontWeight: 500
              }}
            >
              Selected: <strong>{selectedType === 'retweet' ? 'Retweet Campaign' : 'Original Tweet Campaign'}</strong>
            </Typography>
          </Box>
        )}
      </Box>

      {/* Campaign Type Selector Modal */}
      <CampaignTypeSelector
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelect}
      />
    </Box>
  )
}

