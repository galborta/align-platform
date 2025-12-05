'use client'

import {
  Box,
  FormControlLabel,
  Switch,
  Typography,
  Tooltip,
  IconButton
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

interface PublicPrivateToggleProps {
  isPublic: boolean
  onChange: (isPublic: boolean) => void
  disabled?: boolean
}

export default function PublicPrivateToggle({
  isPublic,
  onChange,
  disabled = false
}: PublicPrivateToggleProps) {
  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        bgcolor: '#F8F5FF',
        borderRadius: '8px',
        border: '1px solid #E5DEFF'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <FormControlLabel
          control={
            <Switch
              checked={isPublic}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#7C4DFF'
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#7C4DFF'
                }
              }}
            />
          }
          label={
            <Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: '#1A1A1E'
                }}
              >
                {isPublic ? 'Public Tip' : 'Private Tip'}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: '#6F7280',
                  fontSize: '11px',
                  mt: 0.25
                }}
              >
                {isPublic
                  ? 'Appears in activity feed and sent as message'
                  : 'Only sent as private message'}
              </Typography>
            </Box>
          }
        />

        <Tooltip
          title={
            <Box sx={{ p: 0.5 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                Public Tips
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '10px', mb: 1 }}>
                • Visible in community activity feed<br />
                • Shows amount, token, and message<br />
                • Sent as direct message too
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                Private Tips
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '10px' }}>
                • Only sent as direct message<br />
                • Not visible in activity feed<br />
                • Complete privacy
              </Typography>
            </Box>
          }
          placement="left"
          arrow
        >
          <IconButton size="small" sx={{ color: '#7C4DFF' }}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}







