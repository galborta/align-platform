'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  Radio,
  FormControlLabel,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  IconButton
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import RepeatIcon from '@mui/icons-material/Repeat'
import CreateIcon from '@mui/icons-material/Create'
import CampaignIcon from '@mui/icons-material/Campaign'

// ==================== TYPES ====================

export type SocialCampaignType = 'retweet' | 'original_tweet'

interface CampaignTypeOption {
  type: SocialCampaignType
  icon: React.ReactNode
  title: string
  description: string
  bestFor: string
}

interface CampaignTypeSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (type: SocialCampaignType) => void
}

// ==================== COMPONENT ====================

export default function CampaignTypeSelector({
  open,
  onClose,
  onSelect
}: CampaignTypeSelectorProps) {
  // ==================== HOOKS ====================
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // ==================== STATE ====================
  const [selectedType, setSelectedType] = useState<SocialCampaignType | null>(null)

  // ==================== CAMPAIGN OPTIONS ====================
  const campaignOptions: CampaignTypeOption[] = [
    {
      type: 'retweet',
      icon: <RepeatIcon sx={{ fontSize: 40, color: 'var(--accent-primary, #7C4DFF)' }} />,
      title: 'Retweet Campaign',
      description: 'Workers retweet your specific tweet',
      bestFor: 'Amplifying content, launches'
    },
    {
      type: 'original_tweet',
      icon: <CreateIcon sx={{ fontSize: 40, color: 'var(--accent-primary, #7C4DFF)' }} />,
      title: 'Original Tweet Campaign',
      description: 'Workers create original content',
      bestFor: 'Diverse perspectives, engagement'
    }
  ]

  // ==================== HANDLERS ====================

  const handleClose = () => {
    setSelectedType(null)
    onClose()
  }

  const handleContinue = () => {
    if (selectedType) {
      onSelect(selectedType)
      setSelectedType(null) // Reset for next time
    }
  }

  const handleOptionClick = (type: SocialCampaignType) => {
    setSelectedType(type)
  }

  // ==================== RENDER ====================

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 'var(--radius-card-lg, 24px)',
          bgcolor: 'var(--card-background, #FFFFFF)',
          maxHeight: isMobile ? '100%' : '90vh'
        }
      }}
    >
      {/* ==================== HEADER ==================== */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
          fontSize: isMobile ? '20px' : '24px',
          fontWeight: 700,
          color: 'var(--text-primary, #1A1A1E)',
          borderBottom: '1px solid var(--border-subtle, #E5E7F0)',
          pb: 2,
          pt: isMobile ? 2 : 3,
          px: isMobile ? 2 : 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CampaignIcon
            sx={{
              color: 'var(--accent-primary, #7C4DFF)',
              fontSize: isMobile ? 24 : 28
            }}
          />
          <span>Create Social Media Campaign</span>
        </Box>
        <IconButton
          onClick={handleClose}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            width: isMobile ? 40 : 44,
            height: isMobile ? 40 : 44
          }}
          aria-label="Close dialog"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ==================== CONTENT ==================== */}
      <DialogContent
        sx={{
          pt: 'var(--space-lg, 24px)',
          px: isMobile ? 2 : 3,
          pb: 2
        }}
      >
        {/* Subtitle */}
        <Typography
          variant="body1"
          sx={{
            mb: 'var(--space-lg, 24px)',
            color: 'var(--text-secondary, #6F7280)',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontSize: isMobile ? '14px' : '16px',
            lineHeight: 1.6
          }}
        >
          Choose the type of campaign you'd like to create. You can configure details in the next step.
        </Typography>

        {/* Radio Group */}
        <RadioGroup
          value={selectedType || ''}
          onChange={(e) => handleOptionClick(e.target.value as SocialCampaignType)}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {campaignOptions.map((option) => {
              const isSelected = selectedType === option.type
              
              return (
                <Box
                  key={option.type}
                  onClick={() => handleOptionClick(option.type)}
                  sx={{
                    border: isSelected
                      ? '2px solid var(--accent-primary, #7C4DFF)'
                      : '1px solid var(--border-subtle, #E5E7F0)',
                    borderRadius: '16px',
                    p: isMobile ? 2 : 'var(--space-lg, 24px)',
                    bgcolor: isSelected
                      ? 'var(--accent-primary-soft, #EEE7FF)'
                      : 'var(--card-background, #FFFFFF)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'var(--accent-primary, #7C4DFF)',
                      bgcolor: isSelected
                        ? 'var(--accent-primary-soft, #EEE7FF)'
                        : 'rgba(124, 77, 255, 0.04)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(124, 77, 255, 0.15)'
                    }
                  }}
                >
                  <FormControlLabel
                    value={option.type}
                    control={
                      <Radio
                        sx={{
                          color: 'var(--text-secondary, #6F7280)',
                          '&.Mui-checked': {
                            color: 'var(--accent-primary, #7C4DFF)'
                          },
                          mr: 1
                        }}
                      />
                    }
                    label={
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: isMobile ? 1.5 : 2,
                          width: '100%'
                        }}
                      >
                        {/* Icon */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            mt: 0.5
                          }}
                        >
                          {option.icon}
                        </Box>

                        {/* Text Content */}
                        <Box sx={{ flex: 1 }}>
                          {/* Title */}
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-heading, "Space Grotesk"), sans-serif',
                              fontSize: isMobile ? '16px' : '18px',
                              fontWeight: 600,
                              color: 'var(--text-primary, #1A1A1E)',
                              mb: 0.5,
                              lineHeight: 1.4
                            }}
                          >
                            {option.title}
                          </Typography>

                          {/* Description */}
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'var(--font-body, Satoshi), sans-serif',
                              fontSize: isMobile ? '13px' : '14px',
                              color: 'var(--text-secondary, #6F7280)',
                              mb: 1,
                              lineHeight: 1.5
                            }}
                          >
                            {option.description}
                          </Typography>

                          {/* Best For */}
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              bgcolor: isSelected
                                ? 'rgba(124, 77, 255, 0.15)'
                                : 'var(--subtle-background, #F7F8FB)',
                              px: 1.5,
                              py: 0.5,
                              borderRadius: 'var(--radius-control, 999px)',
                              transition: 'background-color 0.2s ease'
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: isSelected
                                  ? 'var(--accent-primary, #7C4DFF)'
                                  : 'var(--text-secondary, #6F7280)',
                                letterSpacing: '0.02em'
                              }}
                            >
                              Best for: {option.bestFor}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    }
                    sx={{
                      m: 0,
                      width: '100%',
                      alignItems: 'flex-start'
                    }}
                  />
                </Box>
              )
            })}
          </Box>
        </RadioGroup>
      </DialogContent>

      {/* ==================== FOOTER ==================== */}
      <DialogActions
        sx={{
          borderTop: '1px solid var(--border-subtle, #E5E7F0)',
          p: isMobile ? 2 : 2.5,
          gap: 1.5,
          flexDirection: isMobile ? 'column-reverse' : 'row'
        }}
      >
        <Button
          onClick={handleClose}
          sx={{
            color: 'var(--text-secondary, #6F7280)',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            px: 3,
            py: 1,
            borderRadius: 'var(--radius-control, 999px)',
            width: isMobile ? '100%' : 'auto',
            '&:hover': {
              bgcolor: 'var(--subtle-background, #F7F8FB)'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleContinue}
          disabled={!selectedType}
          sx={{
            bgcolor: 'var(--accent-primary, #7C4DFF)',
            color: '#FFFFFF',
            textTransform: 'none',
            fontFamily: 'var(--font-body, Satoshi), sans-serif',
            fontWeight: 600,
            fontSize: '14px',
            px: 4,
            py: 1.25,
            borderRadius: 'var(--radius-control, 999px)',
            boxShadow: '0 4px 14px rgba(124, 77, 255, 0.3)',
            width: isMobile ? '100%' : 'auto',
            '&:hover': {
              bgcolor: '#6A3FE8',
              boxShadow: '0 6px 20px rgba(124, 77, 255, 0.4)'
            },
            '&:disabled': {
              bgcolor: 'var(--border-subtle, #E5E7F0)',
              color: 'var(--text-muted, #A3A7B5)',
              boxShadow: 'none'
            }
          }}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  )
}

