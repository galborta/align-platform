'use client'

import { useState } from 'react'
import { Box, Typography, Card } from '@mui/material'
import { 
  CampaignTypeSelector, 
  CampaignConfigForm,
  CampaignConfirmationModal,
  SocialCampaignType,
  CampaignFormData 
} from '@/components/jobs/social'

export default function FullCampaignFlowTestPage() {
  const [showTypeSelector, setShowTypeSelector] = useState(true)
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [selectedType, setSelectedType] = useState<SocialCampaignType | null>(null)
  const [formData, setFormData] = useState<CampaignFormData | null>(null)
  const [submittedData, setSubmittedData] = useState<CampaignFormData | null>(null)

  const handleTypeSelect = (type: SocialCampaignType) => {
    setSelectedType(type)
    setShowTypeSelector(false)
    setShowConfigForm(true)
  }

  const handleFormSubmit = (data: CampaignFormData) => {
    console.log('Form submitted, showing confirmation:', { type: selectedType, data })
    setFormData(data)
    setShowConfigForm(false)
    setShowConfirmation(true)
  }

  const handleConfirm = () => {
    console.log('Campaign confirmed!', { type: selectedType, data: formData })
    setSubmittedData(formData)
    setShowConfirmation(false)
  }

  const handleConfirmationBack = () => {
    setShowConfirmation(false)
    setShowConfigForm(true)
  }

  const handleFormCancel = () => {
    setShowConfigForm(false)
    setShowTypeSelector(true)
    setSelectedType(null)
  }

  const resetFlow = () => {
    setShowTypeSelector(true)
    setShowConfigForm(false)
    setShowConfirmation(false)
    setSelectedType(null)
    setFormData(null)
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
      <Box sx={{ maxWidth: '900px', mx: 'auto' }}>
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
          Full Campaign Flow Test
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
          Step 1: Select Type → Step 2: Configure Campaign → Step 3: Confirm → Step 4: Complete
        </Typography>

        {/* Step Indicator */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            mb: 4,
            flexWrap: 'wrap'
          }}
        >
          {[
            { step: 1, label: 'Type Selection', active: showTypeSelector },
            { step: 2, label: 'Configuration', active: showConfigForm },
            { step: 3, label: 'Confirmation', active: showConfirmation },
            { step: 4, label: 'Complete', active: !!submittedData }
          ].map(({ step, label, active }) => (
            <Box
              key={step}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                bgcolor: active
                  ? 'var(--accent-primary, #7C4DFF)'
                  : 'var(--card-background, #FFFFFF)',
                color: active ? '#FFFFFF' : 'var(--text-secondary, #6F7280)',
                borderRadius: 'var(--radius-control, 999px)',
                border: active ? 'none' : '1px solid var(--border-subtle, #E5E7F0)',
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: active ? 600 : 500
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: active ? '#FFFFFF' : 'var(--subtle-background, #F7F8FB)',
                  color: active
                    ? 'var(--accent-primary, #7C4DFF)'
                    : 'var(--text-secondary, #6F7280)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                {step}
              </Box>
              {label}
            </Box>
          ))}
        </Box>

        {/* Step 1: Type Selection Modal */}
        <CampaignTypeSelector
          open={showTypeSelector}
          onClose={() => setShowTypeSelector(false)}
          onSelect={handleTypeSelect}
        />

        {/* Step 2: Configuration Form */}
        {showConfigForm && selectedType && (
          <Card
            sx={{
              bgcolor: 'var(--card-background, #FFFFFF)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              p: { xs: 2, sm: 3, md: 4 },
              boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))',
              mb: 3
            }}
          >
            <Typography
              variant="h5"
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 1
              }}
            >
              {selectedType === 'retweet' ? 'Retweet Campaign' : 'Original Tweet Campaign'}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                color: 'var(--text-secondary, #6F7280)',
                mb: 3
              }}
            >
              Configure your campaign details below
            </Typography>

            <CampaignConfigForm
              campaignType={selectedType}
              projectId="test-project-123"
              tokenSymbol="TEST"
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          </Card>
        )}

        {/* Step 3: Confirmation Modal */}
        {formData && selectedType && (
          <CampaignConfirmationModal
            open={showConfirmation}
            formData={formData}
            campaignType={selectedType}
            onConfirm={handleConfirm}
            onBack={handleConfirmationBack}
          />
        )}

        {/* Step 4: Success / Submitted Data */}
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
              variant="h5"
              sx={{
                fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                fontWeight: 600,
                color: 'var(--accent-success, #36C170)',
                mb: 2
              }}
            >
              ✓ Campaign Created Successfully!
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1
                }}
              >
                Campaign Type:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '14px',
                  color: 'var(--text-secondary, #6F7280)'
                }}
              >
                {selectedType === 'retweet' ? 'Retweet Campaign' : 'Original Tweet Campaign'}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)',
                  mb: 1
                }}
              >
                Form Data:
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono"), monospace',
                  fontSize: '11px',
                  color: 'var(--text-primary, #1A1A1E)',
                  bgcolor: 'var(--card-background, #FFFFFF)',
                  p: 2,
                  borderRadius: '8px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '400px'
                }}
              >
                {JSON.stringify(submittedData, null, 2)}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <button
                onClick={resetFlow}
                style={{
                  fontFamily: 'var(--font-body, Satoshi), sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  backgroundColor: 'var(--accent-success, #36C170)',
                  border: 'none',
                  borderRadius: 'var(--radius-control, 999px)',
                  padding: '10px 24px',
                  cursor: 'pointer'
                }}
              >
                Create Another Campaign
              </button>
            </Box>
          </Card>
        )}

        {/* Help Text */}
        {!showConfigForm && !submittedData && (
          <Card
            sx={{
              bgcolor: 'var(--card-background, #FFFFFF)',
              borderRadius: 'var(--radius-card-lg, 24px)',
              p: 3,
              textAlign: 'center'
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                color: 'var(--text-secondary, #6F7280)'
              }}
            >
              Click the button above to start the campaign creation flow
            </Typography>
          </Card>
        )}
      </Box>
    </Box>
  )
}

