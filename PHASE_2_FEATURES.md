# Phase 2 Features - Application Upvoting & Community Engagement

## 🗳️ Application Upvoting System

### Overview
Community members can upvote job applications based on their token holdings. Votes are token-weighted, giving more influence to users who hold larger percentages of the project's tokens.

### How It Works

1. **Viewing Applications**: When viewing open job applications, token holders see an upvote button on each application card.

2. **Casting Votes**:
   - Click the upvote button (👍) on an application
   - Vote weight is automatically calculated based on your token percentage
   - Each user can only vote once per application
   - Immediate karma reward: `5 × tier_multiplier`

3. **Vote Display**:
   - Vote percentage shows the cumulative token supply that upvoted
   - Voter count shows the number of individual voters
   - Example: "2.34% (5 voters)"

4. **Tier Multipliers**:
   - **Mega Holder** (≥3%): 7x multiplier
   - **Whale** (1-3%): 5.5x multiplier  
   - **Holder** (0.1-1%): 3x multiplier
   - **Small Holder** (<0.1%): 1x multiplier

### Bonus Karma System

When a job is completed and payment is released:
- Voters who upvoted the **winning application** receive bonus karma
- Bonus formula: `job_usd_value × 5 × tier_multiplier`
- Only distributed to voters of the assigned/winning worker
- Automatically awarded on payment release

**Example**: $50 job, Whale voter (5.5x):
- Immediate: +27.5 karma (when voting)
- Bonus: +1,375 karma (if their pick wins)
- **Total**: +1,402.5 karma

---

## 📊 Application Sorting

### Sort Options

Applications can be sorted by three criteria:

1. **Community Votes** (default)
   - Sorts by total vote weight (percentage of token supply)
   - Tie-breaker: Applicant karma (highest first)
   - Shows community preference

2. **Karma**
   - Sorts by applicant's total karma points
   - Shows most experienced workers first

3. **Most Recent**
   - Sorts by application submission time (newest first)
   - Shows latest applicants first (FIFO)

### When Sort Controls Appear
- Job status must be 'open'
- Minimum 2 applications required
- Automatically hidden for single application or completed jobs

---

## 💬 Comments System

### Overview
Job postings include a discussion section where community members can ask questions, provide feedback, or discuss the job requirements.

### Features

1. **Posting Comments**:
   - Wallet connection required
   - Maximum 1,000 characters
   - Real-time character counter
   - Empty comments are rejected

2. **Comment Display**:
   - Chronological order (oldest first, chat-style)
   - Wallet address with copy button
   - Supporter tier badge (if applicable)
   - Relative timestamps ("2 hours ago")

3. **Supporter Badges in Comments**:
   - Automatically fetched for each commenter
   - Displays tier based on completed jobs
   - Only shows if user has completed at least 1 job

---

## 🏆 Supporter Tier Badge System

### Tier Criteria

Badges are awarded based on completed jobs as a worker:

| Tier | Jobs Completed | Color | Icon |
|------|----------------|-------|------|
| **Contributor** | 1-4 | Green (#36C170) | 🏅 |
| **Builder** | 5-19 | Blue (#2563EB) | 🏅 |
| **Architect** | 20-49 | Purple (#7C4DFF) | 🏅 |
| **Legend** | 50+ | Gold (#FFD700) | 🏅 |

### Where Badges Appear

1. **Application Cards**: Shows next to applicant's wallet address
2. **Comments**: Shows next to commenter's wallet address
3. **Profile Pages**: Prominently displayed in user stats

### Badge Components

- **SupporterBadge**: Displays badge when job count is already known
- **SupporterBadgeFetcher**: Fetches job count from database and displays badge

---

## 📈 Profile Statistics

### Stats Tracked

1. **Total Karma**: Cumulative karma points earned
2. **Jobs Completed**: Successfully delivered jobs as worker
3. **Jobs Posted**: Jobs created as client/poster
4. **Application Win Rate**: (Jobs Completed / Applications Submitted) × 100
5. **Dispute Votes Cast**: Number of dispute votes
6. **Dispute Accuracy**: (Correct Votes / Total Votes) × 100

### ProfileStatsCard Component

Displays comprehensive statistics in a 2×2 grid:
- **Top-left**: Total Karma (purple)
- **Top-right**: Jobs Completed (green)
- **Bottom-left**: Win Rate (blue)
- **Bottom-right**: Dispute Accuracy (orange)
- **Below grid**: Jobs Posted (if > 0)

---

## 🔄 Integration Points

### Job Lifecycle Integration

1. **Application Phase**:
   - Users can upvote applications
   - Immediate karma awarded to voters
   - Vote data attached to applications

2. **Assignment Phase**:
   - Sort controls help poster choose best candidate
   - Community preference visible via vote percentages

3. **Completion Phase**:
   - Bonus karma distributed to winning voters
   - Voter contributions recognized

### Database Schema

**New Tables**:
- `job_application_votes`: Stores upvotes with vote_weight
- `job_comments`: Stores discussion comments
- `job_failures`: Tracks failed deliveries (existing)

**Updated Tables**:
- `wallet_karma`: Tracks karma points and statistics

---

## 🧪 Testing Checklist

### Upvoting Flow
- ✅ Can upvote applications (vote recorded)
- ✅ Vote percentage shows token holding %
- ✅ Cannot vote twice (error shown)
- ✅ Karma awarded immediately (+5 × tier)
- ✅ Vote counts update in real-time
- ✅ Sort by votes works correctly

### Sorting Flow
- ✅ Default sort by votes works
- ✅ Sort by karma works
- ✅ Sort by recent works
- ✅ Sort controls only show when relevant (2+ apps, open job)
- ✅ UI updates instantly on sort change

### Bonus Karma Flow
- ✅ Voters get bonus when their pick wins
- ✅ Correct formula: job_usd × 5 × tier_multiplier
- ✅ Only voters of winning application get bonus
- ✅ Bonus triggers only on completion, not assignment
- ✅ Console logs bonus distribution

### Comments Flow
- ✅ Can post comments when wallet connected
- ✅ Comments display chronologically (oldest first)
- ✅ Character limit enforced (1,000)
- ✅ Empty comments rejected
- ✅ Wallet address displays with copy button
- ✅ Timestamps show relative time

### Badges Flow
- ✅ Contributor badge (1-4 jobs) shows green
- ✅ Builder badge (5-19 jobs) shows blue
- ✅ Architect badge (20-49 jobs) shows purple
- ✅ Legend badge (50+ jobs) shows gold
- ✅ No badge for 0 jobs
- ✅ Tooltips show job count
- ✅ Badges appear on applications AND comments

---

## 📚 Component Reference

### Key Components

1. **lib/job-upvoting.ts**: Upvoting logic and vote queries
2. **lib/job-karma.ts**: Karma calculations and bonus distribution
3. **lib/job-comments.ts**: Comment fetching and posting
4. **lib/profile-stats.ts**: Profile statistics queries
5. **components/SupporterBadge.tsx**: Badge display component
6. **components/SupporterBadgeFetcher.tsx**: Badge with data fetching
7. **components/ProfileStatsCard.tsx**: Comprehensive stats display

### API Functions

```typescript
// Upvoting
upvoteApplication(applicationId, voterWallet, projectId)
getApplicationVotes(applicationId)
hasUserVoted(applicationId, voterWallet)

// Comments
getJobComments(jobId)
postJobComment(jobId, walletAddress, message)

// Karma
awardApplicationUpvoterBonuses(jobId, jobUsdValue)

// Stats
getProfileStats(walletAddress, projectId)
```

---

## 🚀 Future Enhancements

1. **Vote Delegation**: Allow users to delegate their voting power
2. **Vote Comments**: Add ability to explain voting decisions
3. **Trending Applications**: Highlight applications gaining momentum
4. **Vote Analytics**: Show voting patterns and trends
5. **Comment Reactions**: Add emoji reactions to comments
6. **Comment Threading**: Allow replies to specific comments
7. **Vote History**: Display user's voting history and success rate

---

## 📝 Notes

- Upvoting is only available for open jobs
- Votes are permanent and cannot be changed
- Bonus karma is only awarded on successful job completion
- Failed jobs (disputes lost) don't award bonus karma to voters
- Comments are public and visible to all users
- Supporter badges update automatically based on completed jobs







