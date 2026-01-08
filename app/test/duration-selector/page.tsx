'use client'

import { useState } from 'react'
import { Box, Typography, Card } from '@mui/material'
import { DurationSelector } from '@/components/jobs/social'

export default function DurationSelectorTestPage() {
  const [selectedDays, setSelectedDays] = useState(7)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--page-background, #E3F06F)',
        p: { xs: 2, sm: 3, md: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Box sx={{ maxWidth: '600px', width: '100%' }}>
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
          Duration Selector Test
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
          Test the duration selector with end date calculation
        </Typography>

        <Card
          sx={{
            bgcolor: 'var(--card-background, #FFFFFF)',
            borderRadius: 'var(--radius-card-lg, 24px)',
            p: { xs: 3, sm: 4 },
            boxShadow: 'var(--shadow-card, 0 20px 40px 0 rgba(15, 23, 42, 0.06))'
          }}
        >
          <DurationSelector
            selectedDays={selectedDays}
            onChange={setSelectedDays}
          />

          {/* Display Selected Value */}
          <Box
            sx={{
              mt: 4,
              p: 2,
              bgcolor: 'var(--subtle-background, #F7F8FB)',
              borderRadius: '12px'
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary, #1A1A1E)',
                mb: 0.5
              }}
            >
              Selected Duration:
            </Typography>
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi), sans-serif',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--accent-primary, #7C4DFF)'
              }}
            >
              {selectedDays} days
            </Typography>
          </Box>
        </Card>

        {/* Testing Instructions */}
        <Card
          sx={{
            mt: 3,
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
              'Radio buttons are selectable (click any option)',
              'Selected option has purple border and background',
              'End date updates when selection changes',
              'End date format: "Ends: Month Day, Year at Hour:Minute AM/PM"',
              'Hover effects work (border changes to purple)',
              'Layout stacks vertically on mobile screens',
              'Typography uses Satoshi font for body text'
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
      </Box>
    </Box>
  )
}

