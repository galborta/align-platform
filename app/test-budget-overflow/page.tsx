'use client'

import BudgetOverflowModal from '@/components/jobs/social/BudgetOverflowModal'
import { useState } from 'react'
import { Container, Typography, Box, Button, Alert } from '@mui/material'

/**
 * Test page for BudgetOverflowModal
 * 
 * Navigate to /test-budget-overflow to view
 */
export default function TestBudgetOverflowPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [scenario, setScenario] = useState<'small' | 'medium' | 'large'>('medium')

  // Different test scenarios
  const scenarios = {
    small: {
      totalRequired: 320,
      available: 300,
      shortage: 20
    },
    medium: {
      totalRequired: 675,
      available: 600,
      shortage: 75
    },
    large: {
      totalRequired: 1250,
      available: 1000,
      shortage: 250
    }
  }

  const currentScenario = scenarios[scenario]

  const handleAdjust = () => {
    alert('User chose to adjust impression amounts')
    setModalOpen(false)
  }

  const handleAddBudget = (amount: number) => {
    alert(`User wants to add $${amount} to budget`)
    setModalOpen(false)
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h1" sx={{ mb: 2, fontFamily: 'var(--font-heading)', fontSize: '32px' }}>
        Budget Overflow Modal - Test Page
      </Typography>

      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Testing Scenarios:
        </Typography>
        <Box component="ul" sx={{ pl: 2, m: 0 }}>
          <li>Small shortage ($20) - Common case with a few impressions</li>
          <li>Medium shortage ($75) - Multiple submissions with bonuses</li>
          <li>Large shortage ($250) - Many high-impression submissions</li>
        </Box>
      </Alert>

      <Box sx={{ background: 'var(--bg-secondary)', p: 3, borderRadius: 'var(--radius-card-md)', mb: 4 }}>
        <Typography variant="h2" sx={{ fontFamily: 'var(--font-heading)', fontSize: '20px', mb: 2 }}>
          Current Scenario: {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Total Required:</strong> ${currentScenario.totalRequired.toFixed(2)}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Available Budget:</strong> ${currentScenario.available.toFixed(2)}
          </Typography>
          <Typography variant="body2" sx={{ color: '#DC2626', fontWeight: 600 }}>
            <strong>Shortage:</strong> ${currentScenario.shortage.toFixed(2)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
          <Button
            variant={scenario === 'small' ? 'contained' : 'outlined'}
            onClick={() => setScenario('small')}
            sx={{ textTransform: 'none' }}
          >
            Small ($20)
          </Button>
          <Button
            variant={scenario === 'medium' ? 'contained' : 'outlined'}
            onClick={() => setScenario('medium')}
            sx={{ textTransform: 'none' }}
          >
            Medium ($75)
          </Button>
          <Button
            variant={scenario === 'large' ? 'contained' : 'outlined'}
            onClick={() => setScenario('large')}
            sx={{ textTransform: 'none' }}
          >
            Large ($250)
          </Button>
        </Box>
      </Box>

      <Button
        variant="contained"
        size="large"
        onClick={() => setModalOpen(true)}
        fullWidth
        sx={{
          py: 2,
          fontSize: '16px',
          fontWeight: 600,
          textTransform: 'none',
          background: 'var(--accent-error, #DC2626)',
          '&:hover': {
            background: '#B91C1C'
          }
        }}
      >
        🚨 Trigger Budget Overflow Modal
      </Button>

      <Box sx={{ mt: 4, p: 3, background: 'rgba(255, 200, 87, 0.1)', borderRadius: 'var(--radius-card-md)', border: '1px solid var(--accent-warning)' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Expected Behavior:
        </Typography>
        <Box component="ol" sx={{ pl: 3, m: 0 }}>
          <li>Modal cannot be closed by clicking backdrop (requires action)</li>
          <li>"Adjust Amounts" button closes modal with info toast</li>
          <li>"Add Budget" button shows "coming soon" alert (feature not implemented)</li>
          <li>Shortage amount is prominently displayed in red</li>
          <li>Budget breakdown is clear and easy to understand</li>
          <li>Warning color theme (amber/orange) throughout</li>
        </Box>
      </Box>

      {/* Modal */}
      <BudgetOverflowModal
        open={modalOpen}
        shortage={currentScenario.shortage}
        totalRequired={currentScenario.totalRequired}
        available={currentScenario.available}
        onClose={() => setModalOpen(false)}
        onAdjust={handleAdjust}
        onAddBudget={handleAddBudget}
      />
    </Container>
  )
}

