'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <h1 className="hero-headline">
            Where token communities work together
          </h1>
          <p className="hero-subheadline">
            Professional infrastructure for Solana token projects
          </p>
          <div className="hero-cta">
            <Link href="/projects">
              <Button variant="primary" size="lg">
                Browse Projects
              </Button>
            </Link>
            <Link href="/submit-project">
              <Button variant="outline" size="lg" className="bg-card-bg">
                Add Your Project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          padding: var(--space-xxl) var(--content-padding);
          position: relative;
        }

        .hero-container {
          max-width: var(--container-max-width);
          margin: 0 auto;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .hero-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .hero-headline {
          font-family: var(--font-heading);
          font-size: var(--text-display);
          font-weight: var(--weight-bold);
          color: var(--text-primary);
          line-height: 1.2;
          letter-spacing: -0.02em;
          max-width: 800px;
          margin: 0;
          opacity: 0;
          animation: fadeInUp 0.8s ease forwards;
          animation-delay: 0.1s;
        }

        .hero-subheadline {
          font-family: var(--font-body);
          font-size: var(--text-headline);
          font-weight: var(--weight-regular);
          color: var(--text-secondary);
          max-width: 600px;
          margin-top: var(--space-md);
          opacity: 0;
          animation: fadeInUp 0.8s ease forwards;
          animation-delay: 0.2s;
        }

        .hero-cta {
          display: flex;
          gap: var(--space-md);
          margin-top: var(--space-lg);
          opacity: 0;
          animation: fadeInUp 0.8s ease forwards;
          animation-delay: 0.3s;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .hero-headline {
            font-size: 40px;
          }
        }

        @media (max-width: 768px) {
          .hero {
            padding: var(--space-lg) var(--content-padding);
            min-height: 50vh;
          }

          .hero-headline {
            font-size: 36px;
          }

          .hero-subheadline {
            font-size: 16px;
          }

          .hero-cta {
            flex-direction: column;
            width: 100%;
            max-width: 300px;
          }

          .hero-cta a {
            width: 100%;
          }

          .hero-cta a button {
            width: 100%;
          }
        }

        /* Respect user's motion preferences */
        @media (prefers-reduced-motion: reduce) {
          .hero-headline,
          .hero-subheadline,
          .hero-cta {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </section>
  )
}
