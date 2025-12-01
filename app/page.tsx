'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Hero } from '@/components/Hero'
import ProjectCard from '@/components/ProjectCard'
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
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProjects() {
      try {
        // Start with basic query (just projects with live status)
        const { data: baseData, error: baseError } = await supabase
          .from('projects')
          .select('id, token_name, profile_image_url, token_symbol, token_mint, created_at')
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
              ...project,
              active_jobs_count: active,
              total_jobs_completed: completed,
              activity_score: score,
              marketCap
            }
          })
        )

        // Sort by activity_score (descending)
        projectsWithCounts.sort((a, b) => {
          if (b.activity_score !== a.activity_score) {
            return b.activity_score - a.activity_score
          }
          // Tie-breaker: created_at (newer first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
            {!loading && !error && projects.length > 0 && (
              <div className="projects-grid">
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
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && projects.length === 0 && (
              <div className="empty-state">
                <AccountBalanceWalletIcon 
                  sx={{ fontSize: 64, color: 'var(--accent-primary)', mb: 2 }} 
                />
                <h3>No projects yet</h3>
                <p>Be the first to add your project to Align!</p>
                <a href="/create" className="cta-button">
                  Add Your Project
                </a>
              </div>
            )}
          </section>

          {/* Karma Leaderboard - Right Column */}
          <aside className="karma-sidebar">
            <div className="karma-card">
              <h3 className="sidebar-heading">Karma Leaderboard</h3>
              <div className="leaderboard-placeholder">
                <p>Top 10 karma leaders will appear here in Sprint 4...</p>
              </div>
            </div>
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

        .page-wrapper > * {
          position: relative;
          z-index: 1;
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
          position: sticky;
          top: 100px;
          align-self: start;
        }

        .karma-card {
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-lg);
          box-shadow: var(--shadow-card);
          min-height: 400px;
        }

        .sidebar-heading {
          font-family: var(--font-heading);
          font-size: var(--text-headline);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          margin-bottom: var(--space-md);
        }

        .leaderboard-placeholder {
          padding: var(--space-xl) 0;
          text-align: center;
        }

        .leaderboard-placeholder p {
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          font-style: italic;
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
