'use client'

export function BackgroundShapes() {
  return (
    <div className="background-shapes" aria-hidden="true">
      {/* Hero area shapes */}
      <div className="shape shape-1"></div>
      <div className="shape shape-2"></div>
      <div className="shape shape-3"></div>
      <div className="shape shape-4"></div>
      <div className="shape shape-5"></div>
      <div className="shape shape-6"></div>
      
      {/* Content area shapes */}
      <div className="shape shape-7"></div>
      <div className="shape shape-8"></div>
      
      {/* Footer area shapes */}
      <div className="shape shape-9"></div>
      <div className="shape shape-10"></div>

      <style jsx>{`
        .background-shapes {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          min-height: 2000px;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }

        /* Base Shape Styles */
        .shape {
          position: absolute;
          border-radius: 50%;
          opacity: 0.12;
        }

        /* Hero area shapes - Purple tones */
        .shape-1 {
          width: 300px;
          height: 300px;
          background: var(--accent-primary);
          top: 60px;
          right: 5%;
          animation: float-1 20s ease-in-out infinite, pulse-lg 10s ease-in-out infinite;
        }

        .shape-2 {
          width: 120px;
          height: 120px;
          border: 3px solid var(--accent-primary);
          background: transparent;
          opacity: 0.25;
          top: 280px;
          left: 3%;
          animation: float-2 15s ease-in-out infinite;
        }

        .shape-3 {
          width: 80px;
          height: 80px;
          background: var(--accent-primary);
          top: 380px;
          right: 12%;
          animation: float-3 18s ease-in-out infinite;
        }

        .shape-4 {
          width: 200px;
          height: 200px;
          border: 2px solid var(--accent-primary);
          background: transparent;
          opacity: 0.15;
          top: 480px;
          left: 8%;
          animation: float-4 22s ease-in-out infinite;
        }

        .shape-5 {
          width: 50px;
          height: 50px;
          background: var(--accent-primary);
          top: 180px;
          right: 22%;
          animation: float-5 12s ease-in-out infinite;
        }

        .shape-6 {
          width: 140px;
          height: 140px;
          background: var(--accent-primary);
          top: 520px;
          right: 3%;
          opacity: 0.10;
          animation: float-6 25s ease-in-out infinite, pulse 8s ease-in-out infinite;
        }

        /* Content area shapes */
        .shape-7 {
          width: 100px;
          height: 100px;
          background: var(--accent-primary);
          top: 850px;
          left: 5%;
          opacity: 0.08;
          animation: float-3 20s ease-in-out infinite;
        }

        .shape-8 {
          width: 70px;
          height: 70px;
          border: 2px solid var(--accent-primary);
          background: transparent;
          top: 950px;
          right: 8%;
          opacity: 0.15;
          animation: float-5 18s ease-in-out infinite;
        }

        /* Footer area shapes */
        .shape-9 {
          width: 120px;
          height: 120px;
          background: var(--accent-primary);
          top: 1150px;
          right: 4%;
          opacity: 0.08;
          animation: float-1 22s ease-in-out infinite, pulse 10s ease-in-out infinite;
        }

        .shape-10 {
          width: 90px;
          height: 90px;
          border: 2px solid var(--accent-primary);
          background: transparent;
          top: 1250px;
          left: 6%;
          opacity: 0.12;
          animation: float-2 20s ease-in-out infinite;
        }

        /* Float Animations - gentle movement */
        @keyframes float-1 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(20px, 15px) scale(1.03);
          }
          66% {
            transform: translate(-15px, 8px) scale(0.97);
          }
        }

        @keyframes float-2 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(15px, -20px) rotate(180deg);
          }
        }

        @keyframes float-3 {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(-10px, 12px);
          }
          75% {
            transform: translate(12px, -8px);
          }
        }

        @keyframes float-4 {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(-18px, -15px) rotate(-90deg);
          }
        }

        @keyframes float-5 {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(8px, 15px) scale(1.15);
          }
        }

        @keyframes float-6 {
          0%, 100% {
            transform: translate(0, 0);
          }
          40% {
            transform: translate(15px, -12px);
          }
          80% {
            transform: translate(-8px, 8px);
          }
        }

        /* Subtle pulse for extra depth */
        @keyframes pulse {
          0%, 100% {
            opacity: 0.10;
          }
          50% {
            opacity: 0.14;
          }
        }

        @keyframes pulse-lg {
          0%, 100% {
            opacity: 0.12;
          }
          50% {
            opacity: 0.16;
          }
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .shape-1 {
            width: 200px;
            height: 200px;
          }

          .shape-4 {
            width: 150px;
            height: 150px;
          }

          .shape-6 {
            width: 100px;
            height: 100px;
          }

          .shape-7 {
            width: 80px;
            height: 80px;
          }

          .shape-9 {
            width: 90px;
            height: 90px;
          }

          .shape-10 {
            width: 70px;
            height: 70px;
          }
        }

        @media (max-width: 768px) {
          /* Hide all shapes on mobile for cleaner look */
          .background-shapes {
            display: none;
          }
        }

        /* Respect user's motion preferences */
        @media (prefers-reduced-motion: reduce) {
          .shape {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
