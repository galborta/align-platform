'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Hero } from '@/components/Hero'
import ProjectCard from '@/components/ProjectCard'
import LeaderboardWidget from '@/components/LeaderboardWidget'
import { supabase } from '@/lib/supabase'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

interface Project {
  id: string
  token_name: string
  profile_image_url: string | null
  token_symbol: string
  token_mint: string
  created_at: string
  active_jobs_count: number
  total_jobs_completed: number
  activity_score: number
  marketCap: number | null
  isVerified: boolean
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProjects() {
      try {
        // Start with basic query (just projects with live status and social_assets)
        const { data: baseData, error: baseError } = await supabase
          .from('projects')
          .select(`
            id, 
            token_name, 
            profile_image_url, 
            token_symbol, 
            token_mint, 
            created_at,
            social_assets!inner(verified)
          `)
          .eq('status', 'live')
          .order('created_at', { ascending: false })

        if (baseError) throw baseError

        if (!baseData || baseData.length === 0) {
          setProjects([])
          return
        }

        // For each project, count jobs dynamically and fetch token stats
        const projectsWithCounts = await Promise.all(
          baseData.map(async (project) => {
            // Count active jobs
            const { count: activeCount } = await supabase
              .from('jobs')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', project.id)
              .eq('status', 'open')

            // Count completed jobs
            const { count: completedCount } = await supabase
              .from('jobs')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', project.id)
              .eq('status', 'completed')

            const active = activeCount || 0
            const completed = completedCount || 0
            const score = active * 3 + completed

            // Check if project has any verified social assets
            const isVerified = (project as any).social_assets?.some((asset: any) => asset.verified) || false

            // Fetch market cap from DexScreener
            let marketCap = null
            
            if (project.token_mint) {
              try {
                const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${project.token_mint}`)
                const dexData = await dexRes.json()
                
                if (dexData.pairs && dexData.pairs.length > 0) {
                  const mainPair = dexData.pairs[0]
                  marketCap = parseFloat(mainPair.fdv) || parseFloat(mainPair.marketCap) || null
                }
              } catch (e) {
                console.error(`Error fetching stats for ${project.token_name}:`, e)
              }
            }

            return {
              id: project.id,
              token_name: project.token_name,
              profile_image_url: project.profile_image_url,
              token_symbol: project.token_symbol,
              token_mint: project.token_mint,
              created_at: project.created_at,
              active_jobs_count: active,
              total_jobs_completed: completed,
              activity_score: score,
              marketCap,
              isVerified
            }
          })
        )

        // Sort by activity_score (descending)
        projectsWithCounts.sort((a, b) => {
          if (b.activity_score !== a.activity_score) {
            return b.activity_score - a.activity_score
          }
          // Tie-breaker: created_at (newer first)
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })

        setProjects(projectsWithCounts)
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])
  
  return (
    <div className="page-wrapper">
      <AppHeader />

      {/* Hero Section */}
      <Hero />

      {/* Main Content Grid - Projects + Karma Sidebar */}
      <main className="home-content">
        <div className="content-grid">
          {/* Projects Section - Left Column */}
          <section className="projects-section">
            <h2 className="section-heading">Active Projects</h2>
            
            {/* Loading State */}
            {loading && (
              <div className="projects-grid">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="skeleton-card" />
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="error-state">
                <ErrorOutlineIcon sx={{ fontSize: 48, color: 'var(--text-secondary)', mb: 2 }} />
                <p>Unable to load projects. Please try again.</p>
                <button onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            )}

            {/* Projects Grid */}
            {!loading && !error && (
              <div className="projects-grid">
                {/* Real Projects */}
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.token_name}
                    logo={project.profile_image_url}
                    tokenSymbol={project.token_symbol}
                    activeJobsCount={project.active_jobs_count || 0}
                    totalJobsCompleted={project.total_jobs_completed || 0}
                    marketCap={project.marketCap}
                    isVerified={project.isVerified}
                  />
                ))}
                
                {/* Coming Soon Placeholder Cards - show when < 3 projects */}
                {projects.length < 3 && [...Array(3 - projects.length)].map((_, i) => (
                  <div key={`coming-soon-${i}`} className="coming-soon-card">
                    <div className="coming-soon-badge">Coming Soon</div>
                    <div className="coming-soon-avatar">
                      <span>?</span>
                    </div>
                    <div className="coming-soon-content">
                      <div className="coming-soon-name">Your Project Here</div>
                      <div className="coming-soon-symbol">$TOKEN</div>
                      <div className="coming-soon-stats">
                        <span>0 Active Jobs</span>
                        <span>•</span>
                        <span>0 Completed</span>
                      </div>
                    </div>
                    <a href="/create" className="coming-soon-cta">
                      Add Your Project →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Karma Leaderboard - Right Column */}
          <aside className="karma-sidebar">
            <LeaderboardWidget />
          </aside>
        </div>
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

      <style jsx global>{`
        /* Fix Badge Positions on Homepage Only */
        /* The page-wrapper can interfere with header badge positioning */
        
        /* Notification Bell Badge (2nd IconButton) */
        .page-wrapper header .flex.items-center.gap-2 > .MuiIconButton-root:nth-of-type(2) .MuiBadge-badge:not(.MuiBadge-invisible) {
          position: absolute !important;
          top: -8px !important;
          right: -8px !important;
          transform: scale(1) !important;
        }
        
        /* Messaging Badge (3rd IconButton, inside Tooltip) */
        .page-wrapper header .flex.items-center.gap-2 > .MuiTooltip-root .MuiBadge-badge:not(.MuiBadge-invisible),
        .page-wrapper header .flex.items-center.gap-2 .MuiIconButton-root:nth-of-type(3) .MuiBadge-badge:not(.MuiBadge-invisible) {
          position: absolute !important;
          top: -4px !important;
          right: -4px !important;
          transform: scale(1) !important;
        }
      `}</style>
      
      <style jsx>{`
        /* Page Wrapper with Pattern */
        .page-wrapper {
          min-height: 100vh;
          background: var(--page-background);
          position: relative;
        }

        /* Subtle pattern overlay for entire page */
        .page-wrapper::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(var(--accent-primary) 1px, transparent 1px),
            linear-gradient(90deg, var(--accent-primary) 1px, transparent 1px);
          background-size: 50px 50px;
          opacity: 0.02;
          pointer-events: none;
          z-index: 0;
        }

        .page-wrapper > *:not(header) {
          position: relative;
          z-index: 1;
        }
        
        .page-wrapper > header {
          position: sticky;
          z-index: 50;
        }

        /* Main Content Grid Layout */
        .home-content {
          padding: var(--space-xxl) 0;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: var(--space-lg);
          max-width: var(--container-max-width);
          margin: 0 auto;
          padding: 0 var(--content-padding);
          align-items: start;
        }

        /* Projects Section - Left Column */
        .projects-section {
          min-height: 400px;
        }

        .section-heading {
          font-family: var(--font-heading);
          font-size: var(--text-title);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          margin-bottom: var(--space-lg);
        }

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-lg);
          width: 100%;
        }

        /* Skeleton Loading Cards */
        .skeleton-card {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-lg);
          box-shadow: var(--shadow-card);
          min-height: 180px;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }

        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        /* Empty State */
        .empty-state {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-xxl);
          box-shadow: var(--shadow-card);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          grid-column: 1 / -1;
        }

        .empty-state h3 {
          font-family: var(--font-heading);
          font-size: var(--text-title);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          margin: 0 0 var(--space-sm) 0;
        }

        .empty-state p {
          font-family: var(--font-body);
          font-size: var(--text-body);
          color: var(--text-secondary);
          margin: 0 0 var(--space-lg) 0;
        }

        .cta-button {
          background: var(--accent-primary);
          color: white;
          padding: var(--space-sm) var(--space-lg);
          border-radius: var(--radius-control);
          font-family: var(--font-body);
          font-size: var(--text-label);
          font-weight: var(--weight-semibold);
          text-decoration: none;
          display: inline-block;
          box-shadow: var(--shadow-chip);
          transition: all 0.3s ease;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-floating);
        }

        /* Error State */
        .error-state {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-xxl);
          box-shadow: var(--shadow-card);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          grid-column: 1 / -1;
        }

        .error-state p {
          font-family: var(--font-body);
          font-size: var(--text-body);
          color: var(--text-secondary);
          margin: 0 0 var(--space-md) 0;
        }

        .error-state button {
          background: white;
          border: 2px solid var(--accent-primary);
          color: var(--accent-primary);
          padding: var(--space-sm) var(--space-lg);
          border-radius: var(--radius-control);
          font-family: var(--font-body);
          font-size: var(--text-label);
          font-weight: var(--weight-semibold);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .error-state button:hover {
          background: var(--accent-primary-soft);
        }

        /* Karma Sidebar - Right Column */
        .karma-sidebar {
          align-self: start; /* Important for sticky child to work */
        }

        /* Coming Soon Cards */
        .coming-soon-card {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-lg);
          box-shadow: var(--shadow-card);
          border: 2px dashed var(--border-subtle);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: var(--space-md);
          opacity: 0.7;
          transition: all 0.3s ease;
        }

        .coming-soon-card:hover {
          opacity: 1;
          border-color: var(--accent-primary);
          transform: translateY(-2px);
        }

        .coming-soon-badge {
          position: absolute;
          top: var(--space-sm);
          right: var(--space-sm);
          background: var(--accent-primary-soft);
          color: var(--accent-primary);
          padding: 4px 12px;
          border-radius: 20px;
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .coming-soon-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-primary-soft), var(--subtle-background));
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed var(--border-subtle);
        }

        .coming-soon-avatar span {
          font-size: 28px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .coming-soon-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .coming-soon-name {
          font-family: var(--font-heading);
          font-size: var(--text-body);
          font-weight: 600;
          color: var(--text-secondary);
        }

        .coming-soon-symbol {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          color: var(--text-muted);
        }

        .coming-soon-stats {
          display: flex;
          gap: var(--space-xs);
          font-family: var(--font-body);
          font-size: var(--text-caption);
          color: var(--text-muted);
        }

        .coming-soon-cta {
          background: transparent;
          border: 1px solid var(--accent-primary);
          color: var(--accent-primary);
          padding: var(--space-xs) var(--space-md);
          border-radius: var(--radius-control);
          font-family: var(--font-body);
          font-size: var(--text-caption);
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          margin-top: var(--space-sm);
        }

        .coming-soon-cta:hover {
          background: var(--accent-primary);
          color: white;
        }

        /* Tablet Breakpoint (768px - 1024px) */
        @media (max-width: 1024px) {
          .content-grid {
            grid-template-columns: 1fr 320px;
            gap: var(--space-md);
          }

          .projects-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Mobile Breakpoint (< 768px) */
        @media (max-width: 768px) {
          .home-content {
            padding: var(--space-lg) 0;
          }

          .content-grid {
            grid-template-columns: 1fr;
            gap: var(--space-xl);
            padding: 0 var(--space-md);
          }

          .karma-sidebar {
            position: static;
          }

          .projects-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
