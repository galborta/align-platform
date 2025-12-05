# 🗳️ Job Application Upvoting Library

**Token-weighted voting system for job applications with karma rewards**

---

## 📋 Overview

The `lib/job-upvoting.ts` library provides functions for upvoting job applications with token-weighted voting. Users who hold more project tokens have more voting power, and voters earn immediate karma rewards based on their tier.

---

## 🎯 Functions

### 1. `upvoteApplication(applicationId, voterWallet, projectId)`

Allows a user to upvote a job application and earn karma.

**Process:**
1. Fetches voter's token percentage from `wallet_token_balances`
2. Validates voter holds tokens (percentage > 0)
3. Checks for duplicate votes (one vote per application per user)
4. Calculates tier multiplier based on token percentage
5. Records vote in `job_application_votes` table
6. Awards immediate karma (5 × tier multiplier)

**Parameters:**
```typescript
applicationId: string  // UUID of the job application
voterWallet: string    // Voter's wallet address
projectId: string      // UUID of the project
```

**Returns:**
```typescript
{
  success: boolean
  error?: string      // Error message if failed
  karma?: number      // Karma earned if successful
}
```

**Example:**
```typescript
import { upvoteApplication } from '@/lib/job-upvoting'

const result = await upvoteApplication(
  'app-uuid-123',
  'wallet-address-xyz',
  'project-uuid-456'
)

if (result.success) {
  console.log(`Earned ${result.karma} karma!`)
} else {
  console.error(result.error)
}
```

---

### 2. `getApplicationVotes(applicationId)`

Retrieves all votes for a specific job application with aggregated stats.

**Parameters:**
```typescript
applicationId: string  // UUID of the job application
```

**Returns:**
```typescript
{
  totalWeight: number   // Sum of all vote_weight percentages
  voterCount: number    // Number of unique voters
  voters: Vote[]        // Array of vote records
}
```

**Example:**
```typescript
import { getApplicationVotes } from '@/lib/job-upvoting'

const votes = await getApplicationVotes('app-uuid-123')

console.log(`Total voting power: ${votes.totalWeight}%`)
console.log(`Number of voters: ${votes.voterCount}`)
console.log(`Individual votes:`, votes.voters)
```

---

### 3. `hasUserVoted(applicationId, voterWallet)`

Checks if a specific user has already voted on an application.

**Parameters:**
```typescript
applicationId: string  // UUID of the job application
voterWallet: string    // Voter's wallet address
```

**Returns:**
```typescript
boolean  // true if user has voted, false otherwise
```

**Example:**
```typescript
import { hasUserVoted } from '@/lib/job-upvoting'

const hasVoted = await hasUserVoted('app-uuid-123', 'wallet-address-xyz')

if (hasVoted) {
  console.log('User already voted')
} else {
  console.log('User can vote')
}
```

---

## 💎 Tier Multipliers

Voting karma is calculated based on the voter's token holding percentage:

| Tier | Percentage | Multiplier | Base Karma | Total Karma |
|------|------------|------------|------------|-------------|
| 🐋 Mega | ≥ 3% | 7x | 5 | **35** |
| 🐳 Whale | 1-3% | 5.5x | 5 | **27.5** |
| 📦 Holder | 0.1-1% | 3x | 5 | **15** |
| 🔹 Small Holder | < 0.1% | 1x | 5 | **5** |

**Formula:** `Karma = 5 × Tier Multiplier`

---

## 🗄️ Database Schema

### job_application_votes

```sql
CREATE TABLE job_application_votes (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES job_applications(id),
  voter_wallet TEXT NOT NULL,
  vote_weight NUMERIC NOT NULL,  -- Token percentage (0-100)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate votes
CREATE UNIQUE INDEX idx_unique_vote 
  ON job_application_votes(application_id, voter_wallet);
```

---

## 🔄 Workflow Examples

### Upvoting Flow

```
User clicks "Upvote" on job application
  ↓
Frontend calls upvoteApplication()
  ↓
Check token balance:
  - 0%: Error "Must hold tokens to upvote"
  - >0%: Continue
  ↓
Check existing vote:
  - Already voted: Error "Already voted"
  - Not voted: Continue
  ↓
Calculate tier (e.g., 1.5% = Whale = 5.5x)
  ↓
Record vote with vote_weight = 1.5
  ↓
Award karma: 5 × 5.5 = 27.5
  ↓
Return success + karma earned
  ↓
Frontend shows: "✓ Upvoted! +27.5 karma"
```

### Display Votes Flow

```
Load job application
  ↓
Call getApplicationVotes(applicationId)
  ↓
Returns:
  - totalWeight: 15.3% (sum of all votes)
  - voterCount: 8 voters
  - voters: [{ wallet: "...", weight: 2.3%, ... }, ...]
  ↓
Display:
  "🗳️ 15.3% of supply voted (8 voters)"
  ↓
For current user, call hasUserVoted()
  ↓
If true: Show "✓ Voted" (disable button)
If false: Show "Upvote" (enable button)
```

---

## ✅ Validation & Security

### Token Ownership
- **Must hold tokens:** `token_percentage > 0`
- Fetched from `wallet_token_balances` table
- Zero holders cannot vote

### Duplicate Prevention
- One vote per application per user
- Checked before inserting vote
- Database constraint as backup

### Vote Weight
- Stored as exact percentage (e.g., 1.5)
- Used for calculating vote influence
- Immutable once cast

---

## 🎓 Integration Example

### Job Application Card Component

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { 
  upvoteApplication, 
  getApplicationVotes, 
  hasUserVoted 
} from '@/lib/job-upvoting'
import { toast } from 'react-hot-toast'

export function ApplicationCard({ application, projectId }) {
  const { publicKey } = useWallet()
  const [votes, setVotes] = useState({ totalWeight: 0, voterCount: 0 })
  const [hasVoted, setHasVoted] = useState(false)
  const [upvoting, setUpvoting] = useState(false)

  useEffect(() => {
    loadVotes()
  }, [application.id])

  const loadVotes = async () => {
    const voteData = await getApplicationVotes(application.id)
    setVotes(voteData)

    if (publicKey) {
      const voted = await hasUserVoted(
        application.id, 
        publicKey.toString()
      )
      setHasVoted(voted)
    }
  }

  const handleUpvote = async () => {
    if (!publicKey) {
      toast.error('Connect wallet to upvote')
      return
    }

    setUpvoting(true)

    const result = await upvoteApplication(
      application.id,
      publicKey.toString(),
      projectId
    )

    setUpvoting(false)

    if (result.success) {
      toast.success(`Upvoted! +${result.karma} karma earned`)
      loadVotes() // Refresh vote counts
    } else {
      toast.error(result.error || 'Failed to upvote')
    }
  }

  return (
    <div>
      {/* Application content */}
      
      {/* Vote display */}
      <div>
        🗳️ {votes.totalWeight.toFixed(1)}% of supply 
        ({votes.voterCount} voters)
      </div>

      {/* Upvote button */}
      <button
        onClick={handleUpvote}
        disabled={hasVoted || upvoting}
      >
        {hasVoted ? '✓ Voted' : 'Upvote'}
      </button>
    </div>
  )
}
```

---

## 🐛 Error Handling

All functions include comprehensive error handling:

- **Token balance fetch fails:** Returns error message
- **Zero token holdings:** Returns "Must hold tokens to upvote"
- **Duplicate vote attempt:** Returns "Already voted on this application"
- **Database insert fails:** Returns "Failed to record vote"
- **Karma award fails:** Vote still succeeds (logged but non-blocking)

Errors are logged to console with context for debugging.

---

## 📊 Feature Status

| Component | Status | File |
|-----------|--------|------|
| Upvote Function | ✅ Complete | `lib/job-upvoting.ts` |
| Get Votes Function | ✅ Complete | `lib/job-upvoting.ts` |
| Has Voted Check | ✅ Complete | `lib/job-upvoting.ts` |
| Tier Calculation | ✅ Complete | Internal helper |
| Karma Award | ✅ Complete | Direct DB update |
| Database Schema | ✅ Complete | `job_application_votes` table |
| UI Integration | ⏳ Pending | Sprint 2.3 |

---

**Created:** November 25, 2025  
**Feature:** Job Application Upvoting Library  
**Sprint:** 2.2 (Job Management)

Built with ❤️ for fair, token-weighted job selection! 🗳️








