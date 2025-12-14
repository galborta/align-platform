import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import { WalletConfigProvider } from '@/lib/wallet-config'
import { VerificationProvider } from '@/contexts/VerificationContext'
import { LayoutClient } from '@/components/LayoutClient'
import { Toaster } from 'react-hot-toast'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { GlobalErrorHandler } from '@/components/ErrorBoundary'

// Space Grotesk for headings/display text
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
// Satoshi is loaded via @font-face in globals.css for body text

export const metadata: Metadata = {
  title: 'Orggly - Modular infrastructure for token projects on Solana',
  description: 'Modular infrastructure for token projects on Solana',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} font-body`} suppressHydrationWarning>
        <GlobalErrorHandler />
        <QueryProvider>
          <ThemeProvider>
            <WalletConfigProvider>
              <VerificationProvider>
                <LayoutClient>
                  {children}
                </LayoutClient>
              </VerificationProvider>
            </WalletConfigProvider>
          </ThemeProvider>
        </QueryProvider>
        {/* Toast Notifications - Clean, unified design */}
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          containerStyle={{
            top: 24,
            zIndex: 9999,
          }}
          toastOptions={{
            duration: 3500,
            style: {
              maxWidth: '360px',
              minWidth: '200px',
              background: '#1A1A1E',
              color: '#FFFFFF',
              fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: '14px',
              fontWeight: '500',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
              gap: '10px',
            },
            success: {
              style: {
                background: '#1A1A1E',
                color: '#FFFFFF',
              },
              iconTheme: {
                primary: '#36C170',
                secondary: '#1A1A1E',
              },
            },
            error: {
              style: {
                background: '#1A1A1E',
                color: '#FFFFFF',
              },
              iconTheme: {
                primary: '#EF4444',
                secondary: '#1A1A1E',
              },
            },
            loading: {
              style: {
                background: '#1A1A1E',
                color: '#FFFFFF',
              },
              iconTheme: {
                primary: '#7C4DFF',
                secondary: '#1A1A1E',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
