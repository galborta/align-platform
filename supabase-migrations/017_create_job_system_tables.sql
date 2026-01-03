-- Migration: Create job system tables
-- Created: 2024-11-24
-- Description: Adds bounty/job system with applications, voting, submissions, and disputes

-- 1. JOBS TABLE
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  poster_wallet TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT NOT NULL CHECK (char_length(description) <= 5000),
  kpis TEXT NOT NULL CHECK (char_length(kpis) <= 2000),
  category TEXT NOT NULL CHECK (category IN ('design', 'marketing', 'development', 'content', 'community', 'other')),
  payment_amount_tokens NUMERIC NOT NULL CHECK (payment_amount_tokens > 0),
  payment_amount_usd NUMERIC NOT NULL CHECK (payment_amount_usd >= 5),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'submitted', 'completed', 'disputed', 'cancelled')),
  assignment_mode TEXT DEFAULT 'review' CHECK (assignment_mode IN ('first_come', 'review')),
  assigned_to TEXT,
  assigned_at TIMESTAMP,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. JOB APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  applicant_wallet TEXT NOT NULL,
  pitch TEXT NOT NULL CHECK (char_length(pitch) <= 2000),
  image_urls TEXT[] DEFAULT '{}',
  estimated_completion TEXT NOT NULL,
  is_invalidated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT job_applications_unique UNIQUE (job_id, applicant_wallet)
);

-- 3. JOB APPLICATION VOTES TABLE
CREATE TABLE IF NOT EXISTS job_application_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  voter_wallet TEXT NOT NULL,
  vote_weight NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT job_application_votes_unique UNIQUE (application_id, voter_wallet)
);

-- 4. JOB SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS job_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  worker_wallet TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 2000),
  image_urls TEXT[] DEFAULT '{}',
  external_links TEXT[] DEFAULT '{}',
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- 5. JOB DISPUTES TABLE
CREATE TABLE IF NOT EXISTS job_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  opened_by TEXT NOT NULL CHECK (opened_by IN ('poster', 'worker')),
  reason TEXT NOT NULL CHECK (char_length(reason) <= 1000),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  outcome TEXT CHECK (outcome IN ('release_to_worker', 'refund_to_poster')),
  created_at TIMESTAMP DEFAULT NOW(),
  ends_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- 6. JOB DISPUTE VOTES TABLE
CREATE TABLE IF NOT EXISTS job_dispute_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID REFERENCES job_disputes(id) ON DELETE CASCADE,
  voter_wallet TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('release', 'refund')),
  vote_weight NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT job_dispute_votes_unique UNIQUE (dispute_id, voter_wallet)
);

-- Create indexes for performance
CREATE INDEX idx_jobs_project ON jobs(project_id, created_at DESC);
CREATE INDEX idx_jobs_poster ON jobs(poster_wallet, created_at DESC);
CREATE INDEX idx_jobs_status ON jobs(status, created_at DESC);
CREATE INDEX idx_job_applications_job ON job_applications(job_id, created_at DESC);
CREATE INDEX idx_job_applications_applicant ON job_applications(applicant_wallet);
CREATE INDEX idx_job_application_votes_application ON job_application_votes(application_id);
CREATE INDEX idx_job_disputes_job ON job_disputes(job_id);
CREATE INDEX idx_job_disputes_status ON job_disputes(status, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_application_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_dispute_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for MVP, token holder checks in application logic)
CREATE POLICY "Anyone can view jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Poster can create jobs" ON jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Poster can update own jobs" ON jobs FOR UPDATE USING (true);

CREATE POLICY "Anyone can view applications" ON job_applications FOR SELECT USING (true);
CREATE POLICY "Holders can apply to jobs" ON job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Applicants can update own applications" ON job_applications FOR UPDATE USING (true);

CREATE POLICY "Anyone can view application votes" ON job_application_votes FOR SELECT USING (true);
CREATE POLICY "Holders can vote on applications" ON job_application_votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view submissions" ON job_submissions FOR SELECT USING (true);
CREATE POLICY "Worker can submit work" ON job_submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view disputes" ON job_disputes FOR SELECT USING (true);
CREATE POLICY "Parties can create disputes" ON job_disputes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view dispute votes" ON job_dispute_votes FOR SELECT USING (true);
CREATE POLICY "Holders can vote on disputes" ON job_dispute_votes FOR INSERT WITH CHECK (true);

-- Enable realtime for job updates
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE job_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE job_application_votes;
















