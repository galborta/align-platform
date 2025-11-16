import type { Metadata } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import { WalletConfigProvider } from '@/lib/wallet-config'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Align - Modular infrastructure for token projects on Solana',
  description: 'Modular infrastructure for token projects on Solana',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-body`}>
        <ThemeProvider>
          <WalletConfigProvider>
            {children}
          </WalletConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
