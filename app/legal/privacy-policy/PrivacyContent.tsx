'use client'

// app/legal/privacy-policy/PrivacyContent.tsx
// Client component for Privacy Policy with interactive elements

import { useState } from 'react'
import PrintIcon from '@mui/icons-material/Print'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoIcon from '@mui/icons-material/Info'
import DeleteIcon from '@mui/icons-material/Delete'

const sections = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'controller', title: '2. Data Controller' },
  { id: 'data-collected', title: '3. Data We Collect' },
  { id: 'blockchain-notice', title: '4. Blockchain Transparency Notice' },
  { id: 'how-we-use', title: '5. How We Use Your Data' },
  { id: 'legal-basis', title: '6. Legal Basis for Processing' },
  { id: 'data-sharing', title: '7. Data Sharing and Disclosure' },
  { id: 'data-storage', title: '8. Data Storage and Security' },
  { id: 'data-retention', title: '9. Data Retention' },
  { id: 'your-rights', title: '10. Your Rights (GDPR)' },
  { id: 'data-deletion', title: '11. Data Deletion Instructions' },
  { id: 'cookies', title: '12. Cookies and Tracking' },
  { id: 'third-party', title: '13. Third-Party Services' },
  { id: 'international', title: '14. International Data Transfers' },
  { id: 'children', title: '15. Children\'s Privacy' },
  { id: 'automated', title: '16. Automated Decision-Making' },
  { id: 'changes', title: '17. Changes to This Policy' },
  { id: 'complaints', title: '18. Complaints' },
  { id: 'contact', title: '19. Contact Us' },
]

export default function PrivacyContent() {
  const [tocOpen, setTocOpen] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setTocOpen(false)
  }

  return (
    <div className="legal-prose">
      {/* Header with Print Button */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div>
          <h1>Orggly Privacy Policy</h1>
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

      {/* Table of Contents - Collapsible on Mobile */}
      <div className="toc">
        {/* Mobile Toggle */}
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="md:hidden flex items-center justify-between w-full text-left"
          aria-expanded={tocOpen}
        >
          <h3 className="text-headline m-0">Table of Contents</h3>
          {tocOpen ? (
            <ExpandLessIcon sx={{ color: 'var(--accent-primary)' }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'var(--accent-primary)' }} />
          )}
        </button>
        
        {/* Desktop Title */}
        <h3 className="text-headline mb-4 hidden md:block">Table of Contents</h3>
        
        {/* TOC List */}
        <ol 
          className={`space-y-2 ${tocOpen ? 'block' : 'hidden'} md:block mt-4 md:mt-0`}
          style={{ listStyleType: 'none', paddingLeft: 0 }}
        >
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => scrollToSection(section.id)}
                className="text-left hover:underline transition-colors w-full"
                style={{ color: 'var(--accent-primary)' }}
              >
                {section.title}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Section 1: Introduction */}
      <section id="introduction">
        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy explains how Orggly (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;, the &quot;Platform&quot;) 
          collects, uses, stores, and protects your personal data when you use our 
          decentralized work coordination platform.
        </p>
        <p>
          We are committed to protecting your privacy and being transparent about our 
          data practices. By using Orggly, you consent to the data practices described 
          in this policy.
        </p>
      </section>

      {/* Section 2: Data Controller */}
      <section id="controller">
        <h2>2. Data Controller</h2>
        <p>
          Orggly operates as a decentralized platform. For the purposes of applicable 
          data protection laws, the data controller is:
        </p>
        <div 
          className="p-4 my-4"
          style={{ 
            background: 'var(--subtle-background)',
            borderRadius: 'var(--radius-card-lg)'
          }}
        >
          <p className="mb-1"><strong>Orggly</strong></p>
          <p className="mb-1">Email: hello@orggly.com</p>
          <p className="mb-0">Location: Barcelona, Spain</p>
        </div>
      </section>

      {/* Section 3: Data We Collect */}
      <section id="data-collected">
        <h2>3. Data We Collect</h2>
        
        <h3>Data You Provide:</h3>
        <ul>
          <li><strong>Wallet Address:</strong> Your Solana public key (required to use the Platform)</li>
          <li><strong>Profile Information:</strong> Display name, avatar, bio (optional)</li>
          <li><strong>Email Address:</strong> For notifications, if you opt-in</li>
          <li><strong>Messages:</strong> Direct messages sent through the Platform</li>
          <li><strong>Job Data:</strong> Job postings, submissions, and related content</li>
        </ul>

        <h3>Data Collected Automatically:</h3>
        <ul>
          <li><strong>Transaction Data:</strong> On-chain transaction records</li>
          <li><strong>Usage Data:</strong> Pages visited, features used, timestamps</li>
          <li><strong>Device Data:</strong> Browser type, operating system, IP address</li>
          <li><strong>Referral Data:</strong> How you arrived at our Platform</li>
        </ul>

        <h3>Data from Third Parties:</h3>
        <ul>
          <li><strong>Blockchain Data:</strong> Public transaction history from Solana</li>
          <li><strong>Wallet Providers:</strong> Connection status from wallet adapters</li>
        </ul>
      </section>

      {/* Section 4: Blockchain Transparency Notice - PROMINENT WARNING */}
      <section id="blockchain-notice">
        <h2>4. Blockchain Transparency Notice</h2>
        
        <div 
          className="flex gap-4 p-6 my-6"
          style={{ 
            background: 'var(--accent-warning)',
            borderRadius: 'var(--radius-card-lg)'
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 28, flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 className="text-headline mb-3" style={{ marginTop: 0 }}>
              IMPORTANT: Blockchain Data is Public and Permanent
            </h3>
            <p className="mb-3">
              The Solana blockchain is a <strong>PUBLIC ledger</strong>. Anyone in the world can view:
            </p>
            <ul className="mb-3">
              <li>Your wallet address</li>
              <li>All transactions you make or receive</li>
              <li>Token balances and transfers</li>
              <li>Escrow deposits and payment releases</li>
              <li>Timestamps of all activities</li>
            </ul>
            <p className="mb-0" style={{ fontWeight: 600 }}>
              This data is PERMANENT and exists independently of our Platform. 
              Deleting your Orggly account does NOT remove your blockchain transaction history.
              We have no ability to modify or delete blockchain data.
            </p>
          </div>
        </div>

        <p>
          Before using Orggly, understand that your financial activities on the Solana 
          blockchain are visible to the public. If privacy is a concern, consider using 
          a dedicated wallet for Orggly transactions.
        </p>
      </section>

      {/* Section 5: How We Use Your Data */}
      <section id="how-we-use">
        <h2>5. How We Use Your Data</h2>
        <p>We use your data to:</p>
        <ul>
          <li><strong>Provide Services:</strong> Enable job posting, completion, and payment</li>
          <li><strong>Verify Wallets:</strong> Authenticate wallet ownership through signatures</li>
          <li><strong>Process Disputes:</strong> Provide evidence to Sentinel AI for arbitration</li>
          <li><strong>Send Notifications:</strong> Email updates about your jobs and payments</li>
          <li><strong>Improve Platform:</strong> Analyze usage patterns to enhance features</li>
          <li><strong>Prevent Fraud:</strong> Detect and prevent malicious activities</li>
          <li><strong>Legal Compliance:</strong> Meet regulatory obligations</li>
        </ul>
      </section>

      {/* Section 6: Legal Basis for Processing */}
      <section id="legal-basis">
        <h2>6. Legal Basis for Processing</h2>
        <p>Under GDPR, we process your data based on:</p>
        <ul>
          <li><strong>Contract Performance:</strong> Processing necessary to provide our services</li>
          <li><strong>Legitimate Interests:</strong> Platform security, fraud prevention, analytics</li>
          <li><strong>Consent:</strong> Optional email notifications and marketing (withdrawable anytime)</li>
          <li><strong>Legal Obligation:</strong> Compliance with applicable laws</li>
        </ul>
      </section>

      {/* Section 7: Data Sharing and Disclosure */}
      <section id="data-sharing">
        <h2>7. Data Sharing and Disclosure</h2>
        
        <h3>We Share Data With:</h3>
        <ul>
          <li><strong>Other Users:</strong> Your public profile, job postings, and messages to recipients</li>
          <li><strong>Service Providers:</strong> Hosting (Render), database (Supabase), email services</li>
          <li><strong>Blockchain Network:</strong> Transaction data recorded on Solana</li>
          <li><strong>Dispute Resolution:</strong> Evidence shared with Sentinel AI during disputes</li>
        </ul>

        <h3>We Do NOT:</h3>
        <ul>
          <li>Sell your personal data to third parties</li>
          <li>Share your email address without consent</li>
          <li>Provide data to advertisers</li>
          <li>Transfer data for purposes unrelated to the Platform</li>
        </ul>

        <h3>Legal Disclosure:</h3>
        <p>
          We may disclose data if required by law, court order, or to protect our 
          rights and safety, or the rights and safety of others.
        </p>
      </section>

      {/* Section 8: Data Storage and Security */}
      <section id="data-storage">
        <h2>8. Data Storage and Security</h2>
        
        <h3>Where We Store Data:</h3>
        <ul>
          <li><strong>Database:</strong> Supabase (cloud-hosted PostgreSQL)</li>
          <li><strong>Backend:</strong> Render (US-based servers)</li>
          <li><strong>Blockchain:</strong> Solana network (globally distributed)</li>
        </ul>

        <h3>Security Measures:</h3>
        <ul>
          <li>Encryption in transit (HTTPS/TLS)</li>
          <li>Row Level Security (RLS) on database</li>
          <li>Wallet signature verification for authentication</li>
          <li>Regular security audits and updates</li>
          <li>Access controls and logging</li>
        </ul>

        <p>
          <strong>Note:</strong> While we implement industry-standard security, no system 
          is 100% secure. You are responsible for securing your wallet and private keys.
        </p>
      </section>

      {/* Section 9: Data Retention */}
      <section id="data-retention">
        <h2>9. Data Retention</h2>
        <ul>
          <li><strong>Account Data:</strong> Retained while your account is active, plus 30 days after deletion request</li>
          <li><strong>Messages:</strong> Retained for 2 years or until deletion request</li>
          <li><strong>Job Records:</strong> Retained for 5 years for legal/audit purposes</li>
          <li><strong>Transaction Records:</strong> Permanently on blockchain (cannot be deleted)</li>
          <li><strong>Usage Logs:</strong> Retained for 90 days</li>
        </ul>
      </section>

      {/* Section 10: Your Rights (GDPR) - INFO BOX */}
      <section id="your-rights">
        <h2>10. Your Rights (GDPR Compliance)</h2>
        
        <div 
          className="p-6 my-6"
          style={{ 
            background: 'var(--accent-primary-soft)',
            borderRadius: 'var(--radius-card-lg)'
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <InfoIcon sx={{ color: 'var(--accent-primary)', fontSize: 24, flexShrink: 0, marginTop: '2px' }} />
            <h3 className="text-headline m-0">Your Data Rights Under GDPR</h3>
          </div>
          
          <p className="mb-4">If you are in the EU/EEA, you have the following rights:</p>
          
          <div className="space-y-3">
            <div>
              <strong>Right of Access:</strong> Request a copy of all data we hold about you
            </div>
            <div>
              <strong>Right to Rectification:</strong> Correct inaccurate or incomplete data in your profile
            </div>
            <div>
              <strong>Right to Erasure:</strong> Request deletion of your account and data (&quot;right to be forgotten&quot;)
            </div>
            <div>
              <strong>Right to Portability:</strong> Receive your data in a machine-readable format (JSON/CSV)
            </div>
            <div>
              <strong>Right to Object:</strong> Object to processing based on legitimate interests
            </div>
            <div>
              <strong>Right to Restrict:</strong> Limit how we process your data in certain circumstances
            </div>
            <div>
              <strong>Right to Withdraw Consent:</strong> Withdraw consent for optional processing (e.g., emails)
            </div>
          </div>
          
          <p className="mt-4 mb-0">
            To exercise any right, email <strong>hello@orggly.com</strong> with your wallet address.
            We will respond within 30 days.
          </p>
        </div>
      </section>

      {/* Section 11: Data Deletion Instructions - HIGHLIGHTED */}
      <section id="data-deletion">
        <h2>11. Data Deletion Instructions</h2>
        
        <div 
          className="p-6 my-6"
          style={{ 
            background: 'var(--accent-success-soft)',
            borderRadius: 'var(--radius-card-lg)',
            borderLeft: '4px solid var(--accent-success)'
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <DeleteIcon sx={{ color: 'var(--accent-success)', fontSize: 24, flexShrink: 0, marginTop: '2px' }} />
            <h3 className="text-headline m-0">How to Delete Your Data</h3>
          </div>
          
          <p className="mb-3">To request account and data deletion:</p>
          
          <ol className="mb-4">
            <li>Send an email to <strong>hello@orggly.com</strong></li>
            <li>Include your wallet address for verification</li>
            <li>Sign a verification message (we&apos;ll provide instructions)</li>
            <li>We will process your request within 30 days</li>
          </ol>

          <h4 className="text-body font-semibold mb-2">What Gets Deleted:</h4>
          <ul className="mb-4">
            <li>Your profile and display name</li>
            <li>Email address (if provided)</li>
            <li>Direct messages</li>
            <li>Usage and analytics data</li>
          </ul>

          <h4 className="text-body font-semibold mb-2">What CANNOT Be Deleted:</h4>
          <ul className="mb-0">
            <li>Blockchain transaction history (immutable)</li>
            <li>Job records required for legal compliance (anonymized)</li>
            <li>Data already shared with other users</li>
          </ul>
        </div>
      </section>

      {/* Section 12: Cookies and Tracking */}
      <section id="cookies">
        <h2>12. Cookies and Tracking</h2>
        
        <h3>Cookies We Use:</h3>
        <ul>
          <li><strong>Essential Cookies:</strong> Required for wallet connection and session management</li>
          <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
          <li><strong>Analytics Cookies:</strong> Understand how you use the Platform (optional)</li>
        </ul>

        <h3>Third-Party Tracking:</h3>
        <p>
          We may use analytics services to understand usage patterns. You can opt-out 
          of analytics through your browser settings or by using browser extensions.
        </p>

        <p>
          See our <a href="/legal/cookies">Cookie Policy</a> for full details.
        </p>
      </section>

      {/* Section 13: Third-Party Services */}
      <section id="third-party">
        <h2>13. Third-Party Services</h2>
        <p>We integrate with the following third-party services:</p>
        <ul>
          <li><strong>Supabase:</strong> Database and authentication (Privacy: supabase.com/privacy)</li>
          <li><strong>Render:</strong> Backend hosting (Privacy: render.com/privacy)</li>
          <li><strong>Solana:</strong> Blockchain network (Public ledger)</li>
          <li><strong>Phantom/Solflare:</strong> Wallet connection (See their privacy policies)</li>
          <li><strong>Helius:</strong> Blockchain data provider (helius.xyz)</li>
        </ul>
        <p>
          Each third party has their own privacy policy. We encourage you to review them.
        </p>
      </section>

      {/* Section 14: International Data Transfers */}
      <section id="international">
        <h2>14. International Data Transfers</h2>
        <p>
          Your data may be transferred to and processed in countries outside your residence, 
          including the United States where our hosting providers are located.
        </p>
        <p>
          For EU/EEA users, we ensure appropriate safeguards through:
        </p>
        <ul>
          <li>Standard Contractual Clauses (SCCs) with service providers</li>
          <li>Data processing agreements with GDPR requirements</li>
          <li>Selection of providers with adequate data protection</li>
        </ul>
      </section>

      {/* Section 15: Children's Privacy */}
      <section id="children">
        <h2>15. Children&apos;s Privacy</h2>
        <p>
          Orggly is not intended for users under 18 years of age. We do not knowingly 
          collect personal data from children. If you believe a child has provided us 
          with personal data, please contact us immediately at hello@orggly.com.
        </p>
      </section>

      {/* Section 16: Automated Decision-Making */}
      <section id="automated">
        <h2>16. Automated Decision-Making</h2>
        <p>
          Our Platform uses automated decision-making in the following ways:
        </p>
        <ul>
          <li>
            <strong>Sentinel AI (Dispute Resolution):</strong> An AI system evaluates 
            evidence and makes binding decisions on work-related disputes. You can 
            submit additional evidence but cannot appeal AI decisions.
          </li>
          <li>
            <strong>Fraud Detection:</strong> Automated systems may flag suspicious 
            activities for review.
          </li>
          <li>
            <strong>Karma Calculations:</strong> Automated scoring based on platform activities.
          </li>
        </ul>
        <p>
          Under GDPR Article 22, you have the right not to be subject to decisions 
          based solely on automated processing. However, by using the Platform, you 
          consent to Sentinel AI arbitration as outlined in our Terms of Service.
        </p>
      </section>

      {/* Section 17: Changes to This Policy */}
      <section id="changes">
        <h2>17. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be 
          posted on this page with an updated &quot;Last Updated&quot; date.
        </p>
        <p>
          For material changes that affect your rights, we will provide notice 
          through the Platform or via email (if you&apos;ve provided one).
        </p>
        <p>
          Continued use of the Platform after changes constitutes acceptance of 
          the updated policy.
        </p>
      </section>

      {/* Section 18: Complaints */}
      <section id="complaints">
        <h2>18. Complaints</h2>
        <p>
          If you have concerns about how we handle your data, please contact us first 
          at hello@orggly.com. We take all complaints seriously and will work to 
          resolve them.
        </p>
        <p>
          EU/EEA residents also have the right to lodge a complaint with their local 
          Data Protection Authority (DPA). In Spain, this is the Agencia Española de 
          Protección de Datos (AEPD): <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>
        </p>
      </section>

      {/* Section 19: Contact Us */}
      <section id="contact">
        <h2>19. Contact Us</h2>
        <p>For any privacy-related questions, requests, or concerns:</p>
        <div 
          className="p-4 my-4"
          style={{ 
            background: 'var(--subtle-background)',
            borderRadius: 'var(--radius-card-lg)'
          }}
        >
          <p className="mb-1"><strong>Email:</strong> hello@orggly.com</p>
          <p className="mb-1"><strong>Subject Line:</strong> Privacy Request - [Your Wallet Address]</p>
          <p className="mb-0"><strong>Response Time:</strong> Within 30 days</p>
        </div>
        <p>
          We are committed to addressing your concerns and protecting your privacy.
        </p>
      </section>

      {/* Summary Box */}
      <div 
        className="mt-12 p-6"
        style={{ 
          background: 'var(--subtle-background)',
          borderRadius: 'var(--radius-card-lg)'
        }}
      >
        <h3 className="text-headline mb-4">Privacy Summary</h3>
        <ul className="space-y-2 mb-0">
          <li>✅ We collect minimal data needed to provide our services</li>
          <li>✅ Your email is optional and only for notifications you choose</li>
          <li>✅ We never sell your data to third parties</li>
          <li>✅ You can request data deletion at any time</li>
          <li>⚠️ Blockchain data is public and permanent</li>
          <li>⚠️ We use AI for dispute resolution (Sentinel)</li>
        </ul>
      </div>
    </div>
  )
}



