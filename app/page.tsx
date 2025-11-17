'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { WalletButton } from '@/components/WalletButton'
import VerifiedIcon from '@mui/icons-material/Verified'
import GroupIcon from '@mui/icons-material/Group'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

export default function Home() {
  return (
    <div className="min-h-screen bg-page-bg">
      {/* Sticky Header */}
      <header className="sticky top-0 bg-page-bg/95 backdrop-blur-sm border-b border-border-subtle z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Align
            </h1>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="py-16 sm:py-24 text-center">
          <h1 className="font-display text-[32px] sm:text-5xl md:text-6xl font-bold text-text-primary mb-6">
            Transparency for Token Projects
          </h1>
          <p className="font-body text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-8">
            Build credibility with verifiable IP. Manage your treasury professionally.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="/create">
              <Button variant="primary" size="lg">
                Add Your Project
              </Button>
            </a>
            <a href="/projects">
              <Button variant="outline" size="lg" className="bg-card-bg">
                Explore Projects
              </Button>
            </a>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {/* Card 1: IP Verification */}
            <Card className="p-6" hover>
              <CardContent className="p-0 text-center">
                <div className="flex justify-center mb-4">
                  <VerifiedIcon 
                    className="text-accent-primary" 
                    sx={{ fontSize: 48 }}
                  />
                </div>
                <h3 className="font-display text-xl font-semibold text-text-primary mb-3">
                  IP Verification
                </h3>
                <p className="font-body text-text-secondary">
                  Prove ownership of your social accounts and brand
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Team Transparency */}
            <Card className="p-6" hover>
              <CardContent className="p-0 text-center">
                <div className="flex justify-center mb-4">
                  <GroupIcon 
                    className="text-accent-primary" 
                    sx={{ fontSize: 48 }}
                  />
                </div>
                <h3 className="font-display text-xl font-semibold text-text-primary mb-3">
                  Team Transparency
                </h3>
                <p className="font-body text-text-secondary">
                  Show holders who controls the token
                </p>
              </CardContent>
            </Card>

            {/* Card 3: Optional Treasury */}
            <Card className="p-6" hover>
              <CardContent className="p-0 text-center">
                <div className="flex justify-center mb-4">
                  <AccountBalanceWalletIcon 
                    className="text-accent-primary" 
                    sx={{ fontSize: 48 }}
                  />
                </div>
                <h3 className="font-display text-xl font-semibold text-text-primary mb-3">
                  Optional Treasury
                </h3>
                <p className="font-body text-text-secondary">
                  Professional tools for buybacks and distributions
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-body text-text-secondary">
              Built on Solana
            </p>
            <div className="flex gap-6">
              <button 
                disabled 
                className="font-body text-text-muted cursor-not-allowed"
              >
                Docs
              </button>
              <button 
                disabled 
                className="font-body text-text-muted cursor-not-allowed"
              >
                Twitter
              </button>
              <button 
                disabled 
                className="font-body text-text-muted cursor-not-allowed"
              >
                Discord
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
