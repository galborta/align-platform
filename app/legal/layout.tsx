// app/legal/layout.tsx
// Layout for legal pages (Terms of Service, Privacy Policy)
// Uses Orggly design system from DESIGN_SYSTEM_IMPLEMENTATION.md

import Link from 'next/link'
import { ReactNode } from 'react'

export const metadata = {
  title: {
    template: '%s | Orggly Legal',
    default: 'Legal | Orggly',
  },
  description: 'Legal documents and policies for Orggly platform',
}

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div 
      className="min-h-screen legal-layout"
      style={{ background: 'var(--page-background)' }}
    >
      {/* Back to Home Link */}
      <div 
        className="mx-auto px-4 pt-8 legal-back-link"
        style={{ maxWidth: 'var(--container-max-width)' }}
      >
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-headline hover:underline transition-opacity"
          style={{ color: 'var(--accent-primary)' }}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 20 20" 
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5L7 10L12 15" />
          </svg>
          Back to Orggly
        </Link>
      </div>

      {/* Legal Content Card */}
      <div 
        className="mx-auto px-4 py-8"
        style={{ maxWidth: 'var(--container-max-width)' }}
      >
        <div 
          className="legal-prose legal-card"
          style={{
            background: 'var(--card-background)',
            borderRadius: 'var(--radius-card-lg)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-xl) var(--space-lg)',
          }}
        >
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Footer with Legal Navigation */}
      <div 
        className="mx-auto px-4 pb-8"
        style={{ maxWidth: 'var(--container-max-width)' }}
      >
        <div 
          className="flex flex-wrap gap-4 justify-center text-body-small"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Link 
            href="/legal/terms-of-service"
            className="hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            Terms of Service
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <Link 
            href="/legal/privacy-policy"
            className="hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            Privacy Policy
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <Link 
            href="/legal/risk-disclaimer"
            className="hover:underline"
            style={{ color: 'var(--accent-warning)' }}
          >
            Risk Disclaimer
          </Link>
        </div>
      </div>
    </div>
  )
}


