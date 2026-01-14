'use client'

// app/legal/terms-of-service/TermsContent.tsx
// Client component for Terms of Service with interactive elements

import { useState } from 'react'
import PrintIcon from '@mui/icons-material/Print'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'eligibility', title: '2. Eligibility' },
  { id: 'description', title: '3. Platform Description' },
  { id: 'escrow', title: '4. How Escrow Works' },
  { id: 'responsibilities', title: '5. User Responsibilities' },
  { id: 'prohibited', title: '6. Prohibited Activities' },
  { id: 'disclaimers', title: '7. Disclaimers and Limitations of Liability' },
  { id: 'indemnification', title: '8. Indemnification' },
  { id: 'disputes', title: '9. Dispute Resolution' },
  { id: 'data', title: '10. Data and Privacy' },
  { id: 'modifications', title: '11. Modifications' },
  { id: 'termination', title: '12. Termination' },
  { id: 'entire', title: '13. Entire Agreement' },
  { id: 'severability', title: '14. Severability' },
  { id: 'waiver', title: '15. No Waiver' },
  { id: 'contact', title: '16. Contact' },
]

export default function TermsContent() {
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
          <h1>Orggly Terms of Service</h1>
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

      {/* Section 1: Acceptance of Terms */}
      <section id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By connecting your wallet to Orggly (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;), you 
          agree to these Terms of Service. If you do not agree, do not use 
          the Platform.
        </p>
      </section>

      {/* Section 2: Eligibility */}
      <section id="eligibility">
        <h2>2. Eligibility</h2>
        <ul>
          <li>You must be at least 18 years old</li>
          <li>You must NOT be a US person (citizen, resident, or entity)</li>
          <li>You confirm compliance with all laws in your jurisdiction</li>
          <li>You have the legal capacity to enter into binding agreements</li>
        </ul>
      </section>

      {/* Section 3: Platform Description */}
      <section id="description">
        <h2>3. Platform Description</h2>
        <p>
          Orggly is a decentralized work coordination platform that facilitates 
          job posting, completion verification, and token-based payments on the 
          Solana blockchain. We provide infrastructure for peer-to-peer agreements; 
          we are NOT:
        </p>
        <ul>
          <li>An employer or employment service</li>
          <li>A financial services provider</li>
          <li>A payment processor</li>
          <li>A custodian of your funds</li>
          <li>A guarantor of job completion or payment</li>
        </ul>
      </section>

      {/* Section 4: How Escrow Works */}
      <section id="escrow">
        <h2>4. How Escrow Works</h2>
        
        <h3>Non-Custodial Design:</h3>
        <ul>
          <li>Job creators lock tokens in a designated escrow wallet (publicly viewable on-chain)</li>
          <li>Platform does not control or have custody of escrowed funds</li>
          <li>Funds are released based on job completion verification</li>
          <li>All transactions are blockchain-based and irreversible</li>
        </ul>

        <h3>Release Mechanism:</h3>
        <ul>
          <li>Disputes are resolved by &quot;Sentinel&quot;, an AI-based arbitration system</li>
          <li>Sentinel evaluates evidence submitted by both parties</li>
          <li>Decisions are final and binding</li>
          <li>Platform facilitates release transactions but does not make discretionary decisions</li>
        </ul>

        <h3>Platform Fee:</h3>
        <ul>
          <li>5% fee charged on job payments</li>
          <li>Fee funds platform development and maintenance</li>
          <li>Collected in the same escrow wallet</li>
          <li>Disclosed before each transaction</li>
        </ul>
      </section>

      {/* Section 5: User Responsibilities */}
      <section id="responsibilities">
        <h2>5. User Responsibilities</h2>
        <p>You are solely responsible for:</p>
        <ul>
          <li>Securing your wallet and private keys</li>
          <li>Verifying all transaction details before signing</li>
          <li>Understanding blockchain transaction finality</li>
          <li>Job agreements and work quality negotiations</li>
          <li>Tax obligations in your jurisdiction</li>
          <li>Compliance with local laws regarding cryptocurrency</li>
        </ul>
      </section>

      {/* Section 6: Prohibited Activities */}
      <section id="prohibited">
        <h2>6. Prohibited Activities</h2>
        <p>You may NOT:</p>
        <ul>
          <li>Use the Platform if you are a US person</li>
          <li>Engage in fraudulent job postings or work claims</li>
          <li>Submit false evidence in dispute resolution</li>
          <li>Attempt to manipulate the Sentinel AI system</li>
          <li>Use the Platform for illegal activities</li>
          <li>Impersonate other users or create fake accounts</li>
          <li>Exploit bugs or vulnerabilities (report them via our <a href="/contact" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>contact form</a>)</li>
        </ul>
      </section>

      {/* Section 7: Disclaimers */}
      <section id="disclaimers">
        <h2>7. Disclaimers and Limitations of Liability</h2>
        
        <div className="warning">
          <h3>AS-IS SERVICE:</h3>
          <p>
            The Platform is provided &quot;AS-IS&quot; with NO WARRANTIES of any kind, 
            express or implied, including but not limited to:
          </p>
          <ul>
            <li>Merchantability or fitness for particular purpose</li>
            <li>Uninterrupted or error-free operation</li>
            <li>Accuracy of Sentinel AI decisions</li>
            <li>Security of smart contracts or escrow wallet</li>
            <li>Availability of blockchain network</li>
          </ul>
        </div>

        <h3>BETA SOFTWARE:</h3>
        <p>
          This Platform is in active development. Bugs, errors, and unexpected 
          behavior may occur.
        </p>

        <h3>NO LIABILITY:</h3>
        <p>
          To the maximum extent permitted by law, Orggly and its operators shall 
          NOT be liable for:
        </p>
        <ul>
          <li>Lost funds due to user error, wallet compromise, or blockchain issues</li>
          <li>Disputes between users regarding work quality</li>
          <li>Sentinel AI decisions you disagree with</li>
          <li>Smart contract vulnerabilities or exploits</li>
          <li>Blockchain network failures or congestion</li>
          <li>Any direct, indirect, incidental, or consequential damages</li>
        </ul>

        <h3>MAXIMUM LIABILITY:</h3>
        <p>
          If liability is found despite these terms, it is limited to the 
          platform fees you personally paid in the 30 days before the claim 
          (likely €0-€50).
        </p>
      </section>

      {/* Section 8: Indemnification */}
      <section id="indemnification">
        <h2>8. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Orggly and its operators 
          from any claims, damages, or expenses arising from:
        </p>
        <ul>
          <li>Your use of the Platform</li>
          <li>Your violation of these Terms</li>
          <li>Your violation of any laws</li>
          <li>Disputes with other users</li>
          <li>Your job postings or work submissions</li>
        </ul>
      </section>

      {/* Section 9: Dispute Resolution */}
      <section id="disputes">
        <h2>9. Dispute Resolution</h2>
        
        <h3>Between Users:</h3>
        <ul>
          <li>All work-related disputes resolved by Sentinel AI</li>
          <li>You waive the right to external arbitration or litigation for work disputes</li>
          <li>Sentinel decisions are final</li>
        </ul>

        <h3>Against Platform:</h3>
        <ul>
          <li>Governed by Spanish law</li>
          <li>Disputes resolved through binding arbitration in Barcelona, Spain</li>
          <li>You waive right to class action lawsuits</li>
          <li>Arbitration conducted in English or Spanish</li>
        </ul>
      </section>

      {/* Section 10: Data and Privacy */}
      <section id="data">
        <h2>10. Data and Privacy</h2>
        
        <h3>Data Collection:</h3>
        <p>
          We collect: wallet addresses, email addresses (if provided), job 
          postings, messages, and transaction data.
        </p>

        <h3>Data Storage:</h3>
        <ul>
          <li>Backend hosted on Render (US servers)</li>
          <li>Database hosted on Supabase</li>
          <li>Blockchain data is public and permanent</li>
        </ul>

        <h3>Data Rights:</h3>
        <ul>
          <li>Request data deletion via our <a href="/contact" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>contact form</a></li>
          <li>Data deleted within 30 days of verified request</li>
          <li>Blockchain data cannot be deleted (immutable ledger)</li>
          <li>See <a href="/legal/privacy-policy">Privacy Policy</a> for full details</li>
        </ul>
      </section>

      {/* Section 11: Modifications */}
      <section id="modifications">
        <h2>11. Modifications</h2>
        <p>
          We may update these Terms at any time. Continued use after changes 
          constitutes acceptance. Material changes will be announced on the Platform.
        </p>
      </section>

      {/* Section 12: Termination */}
      <section id="termination">
        <h2>12. Termination</h2>
        <p>
          We reserve the right to terminate or suspend access to any user at 
          any time for any reason, including Terms violations.
        </p>
        <p>
          You may stop using the Platform at any time. Outstanding escrow 
          obligations remain binding.
        </p>
      </section>

      {/* Section 13: Entire Agreement */}
      <section id="entire">
        <h2>13. Entire Agreement</h2>
        <p>
          These Terms constitute the entire agreement between you and Orggly 
          regarding Platform use.
        </p>
      </section>

      {/* Section 14: Severability */}
      <section id="severability">
        <h2>14. Severability</h2>
        <p>
          If any provision is found unenforceable, remaining provisions remain 
          in full effect.
        </p>
      </section>

      {/* Section 15: No Waiver */}
      <section id="waiver">
        <h2>15. No Waiver</h2>
        <p>
          Failure to enforce any right or provision does not constitute a waiver 
          of such right or provision.
        </p>
      </section>

      {/* Section 16: Contact */}
      <section id="contact">
        <h2>16. Contact</h2>
        <p>
          For questions, disputes, or data requests, please visit our{' '}
          <a 
            href="/contact" 
            style={{ color: 'var(--accent-primary)', textDecoration: 'underline', fontWeight: 600 }}
          >
            contact page
          </a>
          .
        </p>
      </section>

      {/* Acceptance Checkboxes */}
      <div 
        className="mt-12 p-6"
        style={{ 
          background: 'var(--subtle-background)',
          borderRadius: 'var(--radius-card-lg)'
        }}
      >
        <h3 className="text-headline mb-4">By connecting your wallet, you confirm:</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 rounded"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="text-body-small">
              You have read and understood these Terms
            </span>
          </label>
          
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 rounded"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="text-body-small">
              You agree to be bound by these Terms
            </span>
          </label>
          
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 rounded"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="text-body-small">
              You are 18+ years old
            </span>
          </label>
          
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 rounded"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="text-body-small">
              You are NOT a US person (citizen, resident, or entity)
            </span>
          </label>
          
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 rounded"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="text-body-small">
              You accept all risks associated with blockchain transactions
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}




