'use client'

import { useEffect, useState } from 'react'

export function AnimatedLogo() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="relative inline-block">
      <h1 
        className="cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          fontFamily: "'Gluten', cursive",
          fontSize: '28px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          position: 'relative',
        }}
      >
        ORggly
        
        {/* Animated dot on O */}
        {mounted && (
          <span 
            style={{
              position: 'absolute',
              left: '8px',
              top: '11px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: '#7C4DFF',
              animation: 'pulse-dot 2s ease-in-out infinite',
              opacity: 0.8,
            }}
          />
        )}
        
        {/* Animated dot on first g */}
        {mounted && (
          <span 
            style={{
              position: 'absolute',
              left: '47px',
              top: '11px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: '#7C4DFF',
              animation: 'pulse-dot 2s ease-in-out infinite 0.3s',
              opacity: 0.8,
            }}
          />
        )}
        
        {/* Animated dot on second g */}
        {mounted && (
          <span 
            style={{
              position: 'absolute',
              left: '63px',
              top: '11px',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: '#7C4DFF',
              animation: 'pulse-dot 2s ease-in-out infinite 0.6s',
              opacity: 0.8,
            }}
          />
        )}
      </h1>
      
      <style jsx>{`
        @keyframes pulse-dot {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  )
}

