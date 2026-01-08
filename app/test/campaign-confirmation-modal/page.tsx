'use client'

import { useState } from 'react'
import { Box, Button, Typography, Card } from '@mui/material'
import { CampaignConfirmationModal, CampaignFormData } from '@/components/jobs/social'

export default function CampaignConfirmationModalTestPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  // Sample form data for testing
  const sampleRetweetData: CampaignFormData = {
    title: 'Retweet Our NFT Launch!',
    sourceTweetUrl: 'https://twitter.com/myproject/status/1234567890',
    totalBudget: 300,
    durationDays: 7,
    followerTiers: [
      { min_followers: 0, max_followers: 1000, price_usd: 8 },
      { min_followers: 1001, max_followers: 5000, price_usd: 15 },
      { min_followers: 5001, max_followers: 20000, price_usd: 25 },
      { min_followers: 20001, max_followers: 50000, price_usd: 40 },
      { min_followers: 50001, max_followers: 100000, price_usd: 65 },
      { min_followers: 100001, max_followers: null, price_usd: 90 }
    ],
    enableImpressionBonuses: true,
    campaignGuidelines: 'Include #MyNFT and tag @MyProject in your retweet.'
  }

  const sampleOriginalTweetData: CampaignFormData = {
    title: 'Create Content About Our Token Launch',
    sourceTweetUrl: '',
    totalBudget: 500,
    durationDays: 14,
    followerTiers: [
      { min_followers: 0, max_followers: 1000, price_usd: 10 },
      { min_followers: 1001, max_followers: 5000, price_usd: 20 },
      { min_followers: 5001, max_followers: 20000, price_usd: 35 },
      { min_followers: 20001, max_followers: 50000, price_usd: 55 },
      { min_followers: 50001, max_followers: 100000, price_usd: 80 },
      { min_followers: 100001, max_followers: null, price_usd: 120 }
    ],
    enableImpressionBonuses: false,
    campaignGuidelines: 'Tweet must be authentic and engaging. No spam or promotional content.'
  }

  const [selectedCampaignType, setSelectedCampaignType] = useState<'retweet' | 'original_tweet'>('retweet')
  const [formData, setFormData] = useState<CampaignFormData>(sampleRetweetData)

  const handleTypeChange = (type: 'retweet' | 'original_tweet') => {
    setSelectedCampaignType(type)
    setFormData(type === 'retweet' ? sampleRetweetData : sampleOriginalTweetData)
    setConfirmed(false)
  }

  const handleConfirm = () => {
    console.log('Campaign confirmed!', { campaignType: selectedCampaignType, formData })
    setConfirmed(true)
    setIsModalOpen(false)
  }

  const handleBack = () => {
    setIsModalOpen(false)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--page-background, #E3F06F)',
        p: { xs: 2, sm: 3, md: 4 }
      }}
    >
      <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
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
          Campaign Confirmation Modal Test
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
          Test the confirmation modal with sample campaign data
        </Typography>

        {/* Campaign Type Selector */}
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
            variant={selectedCampaignType === 'retweet' ? 'contained' : 'outlined'}
            onClick={() => handleTypeChange('retweet')}
            sx={{
              textTransform: 'none',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontWeight: 600,
              borderRadius: 'var(--radius-control, 999px)',
              ...(selectedCampaignType === 'retweet'
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
            Retweet Campaign ($300)
          </Button>
          <Button
            variant={selectedCampaignType === 'original_tweet' ? 'contained' : 'outlined'}
            onClick={() => handleTypeChange('original_tweet')}
            sx={{
              textTransform: 'none',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontWeight: 600,
              borderRadius: 'var(--radius-control, 999px)',
              ...(selectedCampaignType === 'original_tweet'
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
            Original Tweet Campaign ($500)
          </Button>
        </Box>

        {/* Open Modal Button */}
        <Card
          sx={{
            bgcolor: 'var(--card-background, #FFFFFF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            p: 4,
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
            textAlign: 'center',
            mb: 3
          }}
        >
          <Button
            variant="contained"
            onClick={() => setIsModalOpen(true)}
            sx={{
              bgcolor: 'var(--accent-primary, #7C4DFF)',
              color: '#FFFFFF',
              textTransform: 'none',
              fontFamily: 'var(--font-body, Satoshi), sans-serif',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              borderRadius: 'var(--radius-control, 999px)',
              boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
              '&:hover': {
                bgcolor: '#6A3FE8',
                boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
              }
            }}
          >
            Open Confirmation Modal
          </Button>
        </Card>

        {/* Confirmation Status */}
        {confirmed && (
          <Card
            sx={{
              bgcolor: 'var(--accent-success-soft, #E3F8ED)',
              border: '2px solid var(--accent-success, #36C170)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              p: 3,
              mb: 3
            }}
          >
            <Typography
              variant="h6"
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--accent-success, #36C170)',
                mb: 1,
                textAlign: 'center'
              }}
            >
              ✓ Campaign Confirmed!
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary, #6F7280)',
                textAlign: 'center'
              }}
            >
              Check the console for confirmation data
            </Typography>
          </Card>
        )}

        {/* Visual Checkpoint Card */}
        <Card
          sx={{
            bgcolor: 'var(--card-background, #FFFFFF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            p: 3,
            border: '1px solid var(--border-subtle, #E5E7F0)'
          }}
        >
          <Typography
            sx={{
              fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary, #1A1A1E)',
              mb: 2
            }}
          >
            Visual Checkpoint ✅🟡🔴
          </Typography>

          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {[
              'Modal opens and displays all campaign details',
              'Campaign title, type, and budget are shown correctly',
              'Duration shows correct number of days and end date',
              'Impression bonuses status displays (Enabled/Disabled)',
              'All 6 payment tiers are listed with correct labels',
              'Tier labels format correctly (0-1K, 1K-5K, etc.)',
              'Platform fee is calculated as 5% of budget',
              'Total charge = budget + fee',
              'Warning message about budget lock is displayed',
              'Back button works (closes modal)',
              'Create & Pay button shows total charge amount',
              'Create & Pay button calls onConfirm',
              'Currency formatting uses $ symbol',
              'Mobile view shows full-screen modal',
              'For retweet campaigns, source tweet URL is shown'
            ].map((item, index) => (
              <Box
                component="li"
                key={index}
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '14px',
                  color: 'var(--text-secondary, #6F7280)',
                  mb: 1
                }}
              >
                {item}
              </Box>
            ))}
          </Box>
        </Card>

        {/* Modal */}
        <CampaignConfirmationModal
          open={isModalOpen}
          formData={formData}
          campaignType={selectedCampaignType}
          onConfirm={handleConfirm}
          onBack={handleBack}
        />
      </Box>
    </Box>
  )
}

