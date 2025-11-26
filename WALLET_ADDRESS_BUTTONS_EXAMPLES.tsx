/**
 * WalletAddressWithButtons - Usage Examples
 * 
 * This file demonstrates different use cases for the WalletAddressWithButtons component.
 * Copy these examples into your components as needed.
 */

import { WalletAddressWithButtons } from '@/components/WalletAddressWithButtons'

// ============================================================================
// EXAMPLE 1: Feed Item - Job Posted
// ============================================================================
export function ExampleFeedJobPosted() {
  const projectId = 'project-uuid-123'
  const tokenMint = 'token-mint-456'
  const actorWallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  const jobTitle = 'UI Designer Needed'

  return (
    <div>
      <WalletAddressWithButtons 
        address={actorWallet}
        displayName="Alice"
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> posted job: <strong>{jobTitle}</strong>
    </div>
  )
}

// ============================================================================
// EXAMPLE 2: Feed Item - Application Upvoted (Multiple Wallets)
// ============================================================================
export function ExampleFeedApplicationUpvoted() {
  const projectId = 'project-uuid-123'
  const tokenMint = 'token-mint-456'
  const voterWallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  const applicantWallet = '8yMWqxB3gH98s98TXJSDpbD5jBkheTqA83TZRuJosgBvR'
  const jobTitle = 'UI Designer Needed'

  return (
    <div>
      <WalletAddressWithButtons 
        address={voterWallet}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> upvoted <WalletAddressWithButtons 
        address={applicantWallet}
        displayName="Bob"
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      />'s application for <strong>{jobTitle}</strong>
    </div>
  )
}

// ============================================================================
// EXAMPLE 3: Feed Item - Tip Sent
// ============================================================================
export function ExampleFeedTipSent() {
  const projectId = 'project-uuid-123'
  const tokenMint = 'token-mint-456'
  const fromWallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  const toWallet = '8yMWqxB3gH98s98TXJSDpbD5jBkheTqA83TZRuJosgBvR'
  const amount = 100
  const symbol = 'TOKEN'

  return (
    <div>
      <WalletAddressWithButtons 
        address={fromWallet}
        displayName="Alice"
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> tipped <WalletAddressWithButtons 
        address={toWallet}
        displayName="Bob"
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> {amount} {symbol}
    </div>
  )
}

// ============================================================================
// EXAMPLE 4: Batched Activity Modal - Participant List
// ============================================================================
export function ExampleBatchedParticipants() {
  const projectId = 'project-uuid-123'
  const tokenMint = 'token-mint-456'
  
  const participants = [
    { wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', weight: 5.23 },
    { wallet: '8yMWqxB3gH98s98TXJSDpbD5jBkheTqA83TZRuJosgBvR', weight: 3.15 },
    { wallet: '9zNYrC4hI09t09UXKTEqcE6kClfUfR94ViA84UaSyDwS', weight: 2.87 }
  ]

  return (
    <div>
      {participants.map((participant) => (
        <div key={participant.wallet} style={{ marginBottom: 8 }}>
          <WalletAddressWithButtons 
            address={participant.wallet}
            showMessage
            showTip
            compact
            projectId={projectId}
            tokenMint={tokenMint}
          /> - {participant.weight.toFixed(2)}% voting power
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// EXAMPLE 5: Job Detail Page - Applicant List
// ============================================================================
export function ExampleJobApplicants() {
  const projectId = 'project-uuid-123'
  const tokenMint = 'token-mint-456'
  
  const applicants = [
    { 
      wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 
      displayName: 'Alice',
      isHolder: true 
    },
    { 
      wallet: '8yMWqxB3gH98s98TXJSDpbD5jBkheTqA83TZRuJosgBvR', 
      displayName: null,
      isHolder: false 
    }
  ]

  return (
    <div>
      <h3>Applicants</h3>
      {applicants.map((applicant) => (
        <div key={applicant.wallet} style={{ marginBottom: 12 }}>
          <WalletAddressWithButtons 
            address={applicant.wallet}
            displayName={applicant.displayName}
            showMessage
            showTip
            tierBadge={applicant.isHolder}
            projectId={projectId}
            tokenMint={tokenMint}
          />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// EXAMPLE 6: Address Only (No Actions)
// ============================================================================
export function ExampleAddressOnly() {
  const wallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'

  return (
    <div>
      Posted by: <WalletAddressWithButtons 
        address={wallet}
        displayName="Alice"
      />
    </div>
  )
}

// ============================================================================
// EXAMPLE 7: Compact vs Normal Mode Comparison
// ============================================================================
export function ExampleCompactComparison() {
  const projectId = 'project-uuid-123'
  const tokenMint = 'token-mint-456'
  const wallet = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <strong>Normal Mode:</strong><br />
        <WalletAddressWithButtons 
          address={wallet}
          displayName="Alice"
          showMessage
          showTip
          tierBadge
          projectId={projectId}
          tokenMint={tokenMint}
        />
      </div>
      
      <div>
        <strong>Compact Mode:</strong><br />
        <WalletAddressWithButtons 
          address={wallet}
          displayName="Alice"
          showMessage
          showTip
          tierBadge
          compact
          projectId={projectId}
          tokenMint={tokenMint}
        />
      </div>
    </div>
  )
}

// ============================================================================
// EXAMPLE 8: Feed Item Integration (Real Implementation)
// ============================================================================

/**
 * This is how you would integrate into FeedItem.tsx getActivityContent()
 * 
 * Replace this:
 * ```tsx
 * <strong>{truncateAddress(data.actorWallet)}</strong> posted job
 * ```
 * 
 * With this:
 * ```tsx
 * <WalletAddressWithButtons 
 *   address={data.actorWallet}
 *   displayName={data.actorDisplayName}
 *   showMessage
 *   showTip
 *   compact
 *   projectId={projectId}
 *   tokenMint={tokenMint}
 * /> posted job
 * ```
 */
export function ExampleFeedItemIntegration({
  actorWallet,
  actorDisplayName,
  jobTitle,
  projectId,
  tokenMint
}: {
  actorWallet: string
  actorDisplayName?: string | null
  jobTitle: string
  projectId: string
  tokenMint: string
}) {
  return (
    <div>
      <WalletAddressWithButtons 
        address={actorWallet}
        displayName={actorDisplayName}
        showMessage
        showTip
        compact
        projectId={projectId}
        tokenMint={tokenMint}
      /> posted job: <span style={{ fontWeight: 600 }}>{jobTitle}</span>
    </div>
  )
}

