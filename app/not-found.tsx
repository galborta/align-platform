import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-page-bg">
      <AppHeader />
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 80px)',
          flexDirection: 'column',
          gap: '24px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '72px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          404
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-lg)',
            color: 'var(--text-secondary)',
            margin: 0,
            maxWidth: '400px',
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            textDecoration: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid var(--accent-primary)',
            transition: 'all 0.2s ease',
          }}
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}

