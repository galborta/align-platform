// components/Footer.tsx
// Reusable footer component with legal links using Orggly design system

import Link from 'next/link'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import EmailIcon from '@mui/icons-material/Email'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer 
      className="mt-auto border-t"
      style={{ 
        background: 'var(--card-background)',
        borderColor: 'var(--border-subtle)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Left: Copyright, Built on Solana & Contact */}
          <div 
            className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="font-body">Orggly © {currentYear}</span>
            <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>|</span>
            <span className="font-body hidden sm:inline">Built on Solana</span>
            <span className="hidden md:inline" style={{ color: 'var(--text-muted)' }}>|</span>
            <a 
              href="mailto:hello@orggly.com"
              className="flex items-center gap-1 hover:underline transition-colors font-body"
              style={{ color: 'var(--text-secondary)' }}
            >
              <EmailIcon sx={{ fontSize: 14 }} />
              <span className="hidden sm:inline">hello@orggly.com</span>
              <span className="sm:hidden">Contact</span>
            </a>
          </div>

          {/* Right: Legal Links */}
          <div className="flex flex-wrap justify-center md:justify-end items-center gap-4 md:gap-6 text-sm">
            <Link
              href="/legal/terms-of-service"
              className="hover:underline transition-colors font-body"
              style={{ color: 'var(--text-secondary)' }}
            >
              Terms of Service
            </Link>
            
            <Link
              href="/legal/privacy-policy"
              className="hover:underline transition-colors font-body"
              style={{ color: 'var(--text-secondary)' }}
            >
              Privacy Policy
            </Link>
            
            <Link
              href="/legal/risk-disclaimer"
              className="flex items-center gap-1 hover:underline transition-colors font-body font-medium"
              style={{ color: 'var(--accent-warning)' }}
            >
              <WarningAmberIcon sx={{ fontSize: 14 }} />
              Risk Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer


