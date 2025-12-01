'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface ProjectCardProps {
  id: string
  name: string
  logo?: string | null
  tokenSymbol: string
  activeJobsCount: number
  totalJobsCompleted?: number
  marketCap?: number | null
}

export default function ProjectCard({
  id,
  name,
  logo,
  tokenSymbol,
  activeJobsCount,
  totalJobsCompleted = 0,
  marketCap,
}: ProjectCardProps) {
  const [imageError, setImageError] = useState(false)
  
  // Fallback: first letter of project name
  const firstLetter = name.charAt(0).toUpperCase()
  
  // Format active jobs text
  const activeJobsText = activeJobsCount > 0 
    ? `${activeJobsCount} Active Job${activeJobsCount !== 1 ? 's' : ''}`
    : 'No active jobs'
  
  // Format completed jobs text
  const completedJobsText = totalJobsCompleted > 0
    ? `${totalJobsCompleted} Job${totalJobsCompleted !== 1 ? 's' : ''} Completed`
    : null
  
  // Format market cap
  const formatMarketCap = (mc: number) => {
    if (mc >= 1000000) {
      return `$${(mc / 1000000).toFixed(2)}M`
    } else if (mc >= 1000) {
      return `$${(mc / 1000).toFixed(2)}K`
    } else {
      return `$${mc.toFixed(2)}`
    }
  }

  return (
    <Link href={`/project/${id}`} className="project-card-link">
      <article 
        className="project-card"
        aria-label={`${name} - ${activeJobsCount} active jobs`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            window.location.href = `/project/${id}`
          }
        }}
      >
        {/* Pulse Badge - Only show if active jobs */}
        {activeJobsCount > 0 && (
          <div className="pulse-badge" aria-hidden="true" />
        )}
        
        {/* Header Row */}
        <div className="card-header">
          {/* Logo */}
          <div className="logo-container">
            {logo && !imageError ? (
              <Image
                src={logo}
                alt={`${name} logo`}
                width={48}
                height={48}
                className="logo-image"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="logo-fallback">
                {firstLetter}
              </div>
            )}
          </div>
          
          {/* Name */}
          <h3 className="project-name">{name}</h3>
        </div>
        
        {/* Token Symbol */}
        <div className="token-symbol">${tokenSymbol}</div>
        
        {/* Market Cap */}
        {marketCap && (
          <div className="token-stats">
            <div className="stat-badge mc-badge">
              Market Cap: {formatMarketCap(marketCap)}
            </div>
          </div>
        )}
        
        {/* Metrics Section */}
        <div className="metrics">
          <div className={`active-jobs ${activeJobsCount > 0 ? 'has-jobs' : 'no-jobs'}`}>
            {activeJobsText}
          </div>
          
          {completedJobsText && (
            <div className="completed-jobs">
              {completedJobsText}
            </div>
          )}
        </div>
      </article>

      <style jsx>{`
        .project-card-link {
          text-decoration: none;
          display: block;
        }

        .project-card {
          position: relative;
          background: var(--card-background);
          border-radius: var(--radius-card-lg);
          padding: var(--space-lg);
          box-shadow: var(--shadow-card);
          min-height: 180px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-floating);
        }

        .project-card:focus {
          outline: 2px solid var(--accent-primary);
          outline-offset: 2px;
        }

        /* Pulse Badge */
        .pulse-badge {
          position: absolute;
          top: var(--space-lg);
          right: var(--space-lg);
          width: 8px;
          height: 8px;
          background: var(--accent-success);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
          will-change: transform;
          z-index: 10;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(54, 193, 112, 0.7);
          }
          
          50% {
            transform: scale(1.1);
            box-shadow: 0 0 0 4px rgba(54, 193, 112, 0);
          }
        }

        /* Header */
        .card-header {
          display: flex;
          align-items: center;
          margin-bottom: var(--space-sm);
          gap: var(--space-sm);
        }

        /* Logo */
        .logo-container {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
        }

        .logo-container :global(.logo-image) {
          border-radius: var(--radius-control);
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .logo-fallback {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-control);
          background: var(--accent-primary-soft);
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-heading);
          font-weight: var(--weight-bold);
          font-size: 20px;
        }

        /* Project Name */
        .project-name {
          font-family: var(--font-heading);
          font-size: var(--text-headline);
          font-weight: var(--weight-semibold);
          color: var(--text-primary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: calc(100% - 60px);
          margin: 0;
        }

        /* Token Symbol */
        .token-symbol {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          font-weight: var(--weight-medium);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-sm);
        }

        /* Token Stats */
        .token-stats {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-xs);
          margin-bottom: var(--space-md);
        }

        .stat-badge {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          font-weight: var(--weight-medium);
          padding: 4px 10px;
          border-radius: 12px;
          white-space: nowrap;
        }

        .mc-badge {
          background: rgba(59, 130, 246, 0.1);
          color: #2563eb;
        }

        /* Metrics */
        .metrics {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
          margin-top: auto;
        }

        .active-jobs {
          font-family: var(--font-body);
          font-size: var(--text-body);
          font-weight: var(--weight-medium);
        }

        .active-jobs.has-jobs {
          color: var(--text-primary);
        }

        .active-jobs.no-jobs {
          color: var(--text-muted);
        }

        .completed-jobs {
          font-family: var(--font-body);
          font-size: var(--text-body-small);
          font-weight: var(--weight-regular);
          color: var(--text-secondary);
        }

        /* Accessibility - Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .project-card {
            transition: none;
          }

          .pulse-badge {
            animation: none;
          }

          .project-card:hover {
            transform: none;
          }
        }
      `}</style>
    </Link>
  )
}

export { ProjectCard }
export type { ProjectCardProps }
