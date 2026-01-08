'use client'

/**
 * Sprint 4: Budget Overflow Modal
 * 
 * Modal shown when impression bonuses push total payment beyond available budget.
 * Allows user to either add more budget or adjust impression amounts.
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Divider
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'

// ==================== TYPES ====================

interface BudgetOverflowModalProps {
  open: boolean
  shortage: number
  totalRequired: number
  available: number
  onClose: () => void
  onAddBudget?: (amount: number) => void
  onAdjust: () => void
}

// ==================== COMPONENT ====================

export default function BudgetOverflowModal({
  open,
  shortage,
  totalRequired,
  available,
  onClose,
  onAddBudget,
  onAdjust
}: BudgetOverflowModalProps) {
  
  const handleAddBudget = () => {
    if (onAddBudget) {
      onAddBudget(shortage)
    } else {
      // Budget top-up not implemented yet
      alert('Budget top-up feature coming soon! For now, please adjust impression amounts to fit within budget.')
      onAdjust()
    }
  }

  const handleAdjust = () => {
    onClose()
    onAdjust()
  }

  return (
    <Dialog
      open={open}
      onClose={() => {}} // Disable backdrop click close
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 'var(--radius-card-lg)',
          boxShadow: 'var(--shadow-elevated)'
        }
      }}
    >
      {/* ===== HEADER ===== */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(255, 200, 87, 0.1)',
          borderBottom: '1px solid var(--border-subtle)',
          pb: 2
        }}
      >
        <WarningAmberIcon 
          sx={{ 
            fontSize: 32, 
            color: 'var(--accent-warning, #FFC857)' 
          }} 
        />
        <Typography
          sx={{
            fontFamily: 'var(--font-heading, Space Grotesk, sans-serif)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary, #1A1A1E)'
          }}
        >
          Budget Exceeded
        </Typography>
      </DialogTitle>

      {/* ===== CONTENT ===== */}
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '14px',
              color: 'var(--text-secondary, #6F7280)',
              mb: 2
            }}
          >
            The impression bonuses you've added exceed the available budget for this campaign.
          </Typography>

          {/* Budget Breakdown */}
          <Box
            sx={{
              p: 2,
              background: 'var(--bg-secondary, #F7F8FB)',
              borderRadius: 'var(--radius-card-md)',
              mb: 2
            }}
          >
            {/* Total Required */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Total payments needed:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                ${totalRequired.toFixed(2)}
              </Typography>
            </Box>

            {/* Available Budget */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                Available budget:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-primary, #1A1A1E)'
                }}
              >
                ${available.toFixed(2)}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5, borderColor: 'var(--border-subtle)' }} />

            {/* Shortage (Highlighted) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#DC2626'
                }}
              >
                Shortage:
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#DC2626'
                }}
              >
                ${shortage.toFixed(2)}
              </Typography>
            </Box>
          </Box>

          {/* Explanation */}
          <Alert 
            severity="warning" 
            sx={{ 
              background: 'rgba(255, 200, 87, 0.1)',
              border: '1px solid var(--accent-warning, #FFC857)',
              '.MuiAlert-icon': {
                color: 'var(--accent-warning, #FFC857)'
              }
            }}
          >
            <Typography
              sx={{
                fontFamily: 'var(--font-body, Satoshi, sans-serif)',
                fontSize: '13px',
                color: 'var(--text-primary, #1A1A1E)'
              }}
            >
              You need to add <strong>${shortage.toFixed(2)}</strong> to complete these payments, 
              or reduce impression counts to fit within the available budget.
            </Typography>
          </Alert>
        </Box>
      </DialogContent>

      {/* ===== ACTIONS ===== */}
      <DialogActions
        sx={{
          p: 3,
          pt: 2,
          gap: 2,
          flexWrap: 'wrap',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary, #F7F8FB)'
        }}
      >
        <Button
          variant="outlined"
          onClick={handleAdjust}
          fullWidth
          sx={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 600,
            textTransform: 'none',
            py: 1.5,
            flex: 1,
            minWidth: '200px',
            '&:hover': {
              borderColor: 'var(--accent-primary)',
              background: 'var(--accent-primary-soft)'
            }
          }}
        >
          Adjust Impression Amounts
        </Button>

        <Button
          variant="contained"
          onClick={handleAddBudget}
          fullWidth
          sx={{
            background: 'var(--accent-success, #36C170)',
            color: '#FFFFFF',
            fontFamily: 'var(--font-body, Satoshi, sans-serif)',
            fontWeight: 600,
            textTransform: 'none',
            py: 1.5,
            flex: 1,
            minWidth: '200px',
            '&:hover': {
              background: '#2da85f'
            }
          }}
        >
          Add ${shortage.toFixed(2)} Budget
        </Button>
      </DialogActions>

      {/* Info about budget top-up */}
      {!onAddBudget && (
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-body, Satoshi, sans-serif)',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              fontStyle: 'italic'
            }}
          >
            Budget top-up feature coming soon. For now, please adjust amounts to fit within budget.
          </Typography>
        </Box>
      )}
    </Dialog>
  )
}

