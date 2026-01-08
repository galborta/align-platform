'use client'

import { useState } from 'react'
import { Box, Button, Typography, Card } from '@mui/material'
import { CampaignConfigForm, CampaignFormData } from '@/components/jobs/social'
import { SocialJobType } from '@/types/social-jobs'

export default function CampaignConfigFormTestPage() {
  const [campaignType, setCampaignType] = useState<SocialJobType>('retweet')
  const [submittedData, setSubmittedData] = useState<CampaignFormData | null>(null)

  const handleSubmit = (data: CampaignFormData) => {
    console.log('Form submitted:', data)
    setSubmittedData(data)
  }

  const handleCancel = () => {
    console.log('Form cancelled')
    setSubmittedData(null)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--page-background, #E3F06F)',
        p: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Box
        sx={{
          maxWidth: '800px',
          mx: 'auto'
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
          Campaign Config Form Test
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            color: 'var(--text-secondary, #6F7280)',
            mb: 3,
            textAlign: 'center'
          }}
        >
          Test the campaign configuration form with all sections
        </Typography>

        {/* Campaign Type Toggle */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 3,
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}
        >
          <Button
            variant={campaignType === 'retweet' ? 'contained' : 'outlined'}
            onClick={() => setCampaignType('retweet')}
            sx={{
              textTransform: 'none',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontWeight: 600,
              borderRadius: 'var(--radius-control, 999px)',
              ...(campaignType === 'retweet'
                ? {
                    bgcolor: 'var(--accent-primary, #7C4DFF)',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: '#6A3FE8'
                    }
                  }
                : {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&:hover': {
                      bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
                    }
                  })
            }}
          >
            Retweet Campaign
          </Button>
          <Button
            variant={campaignType === 'original_tweet' ? 'contained' : 'outlined'}
            onClick={() => setCampaignType('original_tweet')}
            sx={{
              textTransform: 'none',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontWeight: 600,
              borderRadius: 'var(--radius-control, 999px)',
              ...(campaignType === 'original_tweet'
                ? {
                    bgcolor: 'var(--accent-primary, #7C4DFF)',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: '#6A3FE8'
                    }
                  }
                : {
                    borderColor: 'var(--accent-primary, #7C4DFF)',
                    color: 'var(--accent-primary, #7C4DFF)',
                    '&:hover': {
                      bgcolor: 'var(--accent-primary-soft, #EEE7FF)'
                    }
                  })
            }}
          >
            Original Tweet Campaign
          </Button>
        </Box>

        {/* Form Card */}
        <Card
          sx={{
            bgcolor: 'var(--card-background, #FFFFFF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            p: { xs: 2, sm: 3, md: 4 },
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
            mb: 3
          }}
        >
          <CampaignConfigForm
            campaignType={campaignType}
            projectId="test-project-123"
            tokenSymbol="TEST"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </Card>

        {/* Submitted Data Display */}
        {submittedData && (
          <Card
            sx={{
              bgcolor: 'var(--accent-success-soft, #E3F8ED)',
              border: '2px solid var(--accent-success, #36C170)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              p: 3
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--accent-success, #36C170)',
                mb: 2
              }}
            >
              ✓ Form Submitted Successfully
            </Typography>

            <Box
              component="pre"
              sx={{
                fontFamily: 'var(--font-mono, "JetBrains Mono"), monospace',
                fontSize: '12px',
                color: 'var(--text-primary, #1A1A1E)',
                bgcolor: 'var(--card-background, #FFFFFF)',
                p: 2,
                borderRadius: '8px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {JSON.stringify(submittedData, null, 2)}
            </Box>

            <Button
              onClick={() => setSubmittedData(null)}
              sx={{
                mt: 2,
                textTransform: 'none',
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                color: 'var(--accent-success, #36C170)',
                '&:hover': {
                  bgcolor: 'rgba(54, 193, 112, 0.1)'
                }
              }}
            >
              Reset
            </Button>
          </Card>
        )}
      </Box>
    </Box>
  )
}

