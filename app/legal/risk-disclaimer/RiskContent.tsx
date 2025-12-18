'use client'

// app/legal/risk-disclaimer/RiskContent.tsx
// Client component for Risk Disclaimer with interactive elements

import Link from 'next/link'
import PrintIcon from '@mui/icons-material/Print'
import CodeIcon from '@mui/icons-material/Code'
import HubIcon from '@mui/icons-material/Hub'
import LockIcon from '@mui/icons-material/Lock'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import StorageIcon from '@mui/icons-material/Storage'
import GavelIcon from '@mui/icons-material/Gavel'

interface RiskSectionProps {
  icon: React.ReactNode
  title: string
  iconColor?: string
  risks: string[]
}

function RiskSection({ icon, title, iconColor = 'var(--accent-primary)', risks }: RiskSectionProps) {
  return (
    <div 
      className="p-6 mb-6"
      style={{ 
        background: 'var(--subtle-background)',
        borderLeft: '4px solid var(--accent-warning)',
        borderRadius: '0 var(--radius-card-lg) var(--radius-card-lg) 0'
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span style={{ color: iconColor }}>{icon}</span>
        <h2 className="mb-0" style={{ marginTop: 0 }}>{title}</h2>
      </div>
      <ul className="mb-0">
        {risks.map((risk, index) => (
          <li key={index}>{risk}</li>
        ))}
      </ul>
    </div>
  )
}

export default function RiskContent() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="legal-prose">
      {/* Header with Print Button */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div>
          <h1>Risk Disclaimer</h1>
          <p className="last-updated">Last Updated: December 7, 2024</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-full hover:opacity-80 transition-all"
          style={{ 
            color: 'var(--accent-primary)',
            background: 'var(--accent-primary-soft)',
          }}
          aria-label="Print this page"
        >
          <PrintIcon sx={{ fontSize: 20 }} />
          <span className="hidden sm:inline text-label">Print</span>
        </button>
      </div>

      {/* Critical Intro Warning */}
      <div 
        className="p-6 mb-8"
        style={{ 
          background: 'var(--accent-warning)',
          borderRadius: 'var(--radius-card-lg)'
        }}
      >
        <div className="flex gap-4">
          <WarningAmberIcon sx={{ fontSize: 28, flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p className="text-body mb-3" style={{ fontWeight: 600 }}>
              This Risk Disclaimer is NOT legal or financial advice.
            </p>
            <p className="text-body mb-0">
              By using Orggly, you acknowledge that you understand and accept the following risks. 
              If you do not accept these risks, <strong>do not use the platform</strong>. 
              Consult with qualified legal and financial professionals before engaging in any 
              cryptocurrency transactions.
            </p>
          </div>
        </div>
      </div>

      {/* Risk Categories */}
      
      {/* Risk 1: Smart Contract Risks */}
      <RiskSection
        icon={<CodeIcon sx={{ fontSize: 24 }} />}
        title="Smart Contract Risks"
        risks={[
          "Smart contracts may contain bugs, vulnerabilities, or exploits that could result in loss of funds",
          "Code audits do not guarantee complete security - vulnerabilities can be discovered after deployment",
          "Funds locked in escrow could be permanently lost if contracts fail or are exploited",
          "Platform cannot reverse, undo, or recover funds lost due to smart contract issues",
          "You are responsible for understanding how smart contracts work before using them",
        ]}
      />

      {/* Risk 2: Blockchain Risks */}
      <RiskSection
        icon={<HubIcon sx={{ fontSize: 24 }} />}
        title="Blockchain Network Risks"
        risks={[
          "Solana network may experience downtime, congestion, or complete failures affecting your transactions",
          "Transactions are irreversible once confirmed on-chain - there is no 'undo' button",
          "Network fees (gas) may fluctuate dramatically, making small transactions uneconomical",
          "Blockchain forks, upgrades, or protocol changes could affect platform functionality or fund access",
          "All transaction data is permanently public on the blockchain and cannot be deleted",
        ]}
      />

      {/* Risk 3: Wallet Security Risks */}
      <RiskSection
        icon={<LockIcon sx={{ fontSize: 24 }} />}
        title="Wallet Security Risks"
        risks={[
          "You are solely responsible for securing your private keys and seed phrases",
          "Lost or stolen private keys cannot be recovered - funds will be permanently inaccessible",
          "Compromised wallets (phishing, malware, social engineering) can result in total loss of funds",
          "Wallet adapters (Phantom, Solflare, etc.) have their own security risks and vulnerabilities",
          "Platform cannot access, recover, or reset your wallet under any circumstances",
        ]}
      />

      {/* Risk 4: Financial Risks */}
      <RiskSection
        icon={<AttachMoneyIcon sx={{ fontSize: 24 }} />}
        title="Financial Risks"
        risks={[
          "Cryptocurrency values are highly volatile - your deposited funds could lose significant value",
          "You could lose all funds deposited into escrow due to various factors beyond our control",
          "Platform provides no guarantees on job completion, payment receipt, or fund recovery",
          "No insurance, FDIC protection, or investor protection on any funds used on the platform",
          "You are solely responsible for all tax obligations related to your cryptocurrency activities",
        ]}
      />

      {/* Risk 5: Dispute Resolution Risks */}
      <RiskSection
        icon={<GavelIcon sx={{ fontSize: 24 }} />}
        iconColor="var(--accent-warning)"
        title="Dispute Resolution Risks"
        risks={[
          "Sentinel AI may make decisions you strongly disagree with based on available evidence",
          "AI decisions are final and cannot be appealed, contested, or overturned",
          "No human review, oversight, or intervention in Sentinel AI decisions",
          "Evidence evaluation may not consider all context, nuance, or extenuating circumstances",
          "By using the platform, you waive the right to legal action for work-related disputes",
        ]}
      />

      {/* Risk 6: Platform Availability Risks */}
      <RiskSection
        icon={<StorageIcon sx={{ fontSize: 24 }} />}
        title="Platform Availability Risks"
        risks={[
          "Platform may experience downtime, bugs, errors, or complete service interruptions",
          "Features may be added, removed, modified, or deprecated without prior notice",
          "Platform could shut down permanently at any time for any reason",
          "No guarantee of continuous service, uptime, support, or maintenance",
          "This is beta software - expect unexpected behavior, crashes, and data issues",
        ]}
      />

      {/* Additional Regulatory Risks */}
      <RiskSection
        icon={<WarningAmberIcon sx={{ fontSize: 24 }} />}
        iconColor="var(--accent-warning)"
        title="Regulatory & Legal Risks"
        risks={[
          "Cryptocurrency regulations vary by jurisdiction and may change rapidly",
          "Using the platform may violate laws in certain countries - you are responsible for compliance",
          "Platform is not available to US persons - using it from the US may have legal consequences",
          "Regulatory actions could affect platform availability or fund access in your jurisdiction",
          "No legal recourse may be available if you suffer losses due to regulatory changes",
        ]}
      />

      {/* Summary of What Platform Does NOT Guarantee */}
      <div 
        className="p-6 my-8"
        style={{ 
          background: 'var(--subtle-background)',
          borderRadius: 'var(--radius-card-lg)',
          border: '2px solid var(--border-subtle)'
        }}
      >
        <h2 style={{ marginTop: 0 }}>What Orggly Does NOT Guarantee</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-body font-semibold mb-2">We Do NOT Guarantee:</h4>
            <ul className="mb-0">
              <li>Job completion or work quality</li>
              <li>Payment or fund recovery</li>
              <li>Platform uptime or availability</li>
              <li>Smart contract security</li>
              <li>Accurate AI dispute decisions</li>
            </ul>
          </div>
          <div>
            <h4 className="text-body font-semibold mb-2">We Are NOT:</h4>
            <ul className="mb-0">
              <li>A custodian of your funds</li>
              <li>An employer or staffing agency</li>
              <li>A financial services provider</li>
              <li>A legal arbitration service</li>
              <li>An insured or regulated entity</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Final Acceptance Statement */}
      <div 
        className="p-8 my-8 text-center"
        style={{ 
          background: 'var(--accent-warning)',
          borderRadius: 'var(--radius-card-lg)'
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 48, marginBottom: '16px' }} />
        <p className="text-headline mb-4" style={{ fontWeight: 700 }}>
          By using Orggly, you acknowledge that:
        </p>
        <ul className="text-left max-w-2xl mx-auto space-y-3 mb-6">
          <li><strong>You have read and understood</strong> all risks described above</li>
          <li><strong>You accept full responsibility</strong> for any losses you may incur</li>
          <li><strong>You will not hold Orggly liable</strong> for any damages, losses, or claims</li>
          <li><strong>You understand this is experimental technology</strong> with no guarantees</li>
          <li><strong>You agree to the complete</strong> <Link href="/legal/terms-of-service" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Terms of Service</Link></li>
        </ul>
        <p className="text-body mb-0" style={{ fontWeight: 600 }}>
          If you do not accept these risks, please disconnect your wallet and do not use the platform.
        </p>
      </div>

      {/* Links to Related Documents */}
      <div 
        className="p-6 my-8"
        style={{ 
          background: 'var(--accent-primary-soft)',
          borderRadius: 'var(--radius-card-lg)'
        }}
      >
        <h3 className="text-headline mb-4" style={{ marginTop: 0 }}>Related Legal Documents</h3>
        <div className="space-y-2">
          <p className="mb-2">
            <Link href="/legal/terms-of-service#disclaimers" style={{ fontWeight: 500 }}>
              → Section 7 of Terms of Service
            </Link>
            {' '}- Complete legal disclaimers and limitations of liability
          </p>
          <p className="mb-2">
            <Link href="/legal/terms-of-service#disputes" style={{ fontWeight: 500 }}>
              → Section 9 of Terms of Service
            </Link>
            {' '}- Dispute resolution process and Sentinel AI
          </p>
          <p className="mb-0">
            <Link href="/legal/privacy-policy#blockchain-notice" style={{ fontWeight: 500 }}>
              → Privacy Policy: Blockchain Notice
            </Link>
            {' '}- Information about public blockchain data
          </p>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center mt-8">
        <p className="text-caption">
          This Risk Disclaimer was last reviewed on December 7, 2024. 
          We may update this document at any time without notice. 
          Please review it periodically.
        </p>
      </div>
    </div>
  )
}


