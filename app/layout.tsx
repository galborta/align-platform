import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import { WalletConfigProvider } from '@/lib/wallet-config'
import { LayoutClient } from '@/components/LayoutClient'
import { Toaster } from 'react-hot-toast'
import { QueryProvider } from '@/components/providers/QueryProvider'

// Space Grotesk for headings/display text
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
// Satoshi is loaded via @font-face in globals.css for body text

export const metadata: Metadata = {
  title: 'Align - Modular infrastructure for token projects on Solana',
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
        <QueryProvider>
          <ThemeProvider>
            <WalletConfigProvider>
              <LayoutClient>
                {children}
              </LayoutClient>
            </WalletConfigProvider>
          </ThemeProvider>
        </QueryProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#7C4DFF',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
