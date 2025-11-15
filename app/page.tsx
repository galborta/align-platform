import { Box, Container, Typography, Button } from '@mui/material'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'

export default function Home() {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          gap: 4,
        }}
      >
        <RocketLaunchIcon sx={{ fontSize: 80, color: 'primary.main' }} />
        <Typography variant="h1" component="h1" gutterBottom>
          Align
        </Typography>
        <Typography variant="h5" component="h2" color="text.secondary" gutterBottom>
          Modular infrastructure for token projects on Solana
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
          <Button variant="contained" size="large">
            Get Started
          </Button>
          <Button variant="outlined" size="large">
            Learn More
          </Button>
        </Box>
      </Box>
    </Container>
  )
}
