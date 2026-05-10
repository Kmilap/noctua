import { useEffect, useRef } from 'react'

export default function NoctuaLoader({ visible }: { visible: boolean }) {
  const pupilRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (!visible) return
    let angle = 0
    let frame: number
    const animate = () => {
      angle += 0.03
      const x = 56 + Math.cos(angle) * 8
      const y = 56 + Math.sin(angle) * 8
      if (pupilRef.current) {
        pupilRef.current.setAttribute('cx', String(x))
        pupilRef.current.setAttribute('cy', String(y))
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [visible])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
      style={{
        background: 'rgba(15,14,23,0.92)',
        backdropFilter: 'blur(12px)',
        animation: 'noctua-fade-in 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes noctua-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes noctua-pulse-ring {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(1.08); }
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        <div className="absolute w-36 h-36 rounded-full border-2 border-[color:var(--color-noctua-amber)]/30"
          style={{ animation: 'noctua-pulse-ring 2s ease-in-out infinite' }} />
        <div className="absolute w-28 h-28 rounded-full border border-[color:var(--color-noctua-amber)]/15"
          style={{ animation: 'noctua-pulse-ring 2s ease-in-out infinite 0.3s' }} />

        <svg width="112" height="112" viewBox="0 0 112 112" fill="none">
          <circle cx="56" cy="56" r="48" fill="rgba(239,159,39,0.08)" stroke="rgba(239,159,39,0.4)" strokeWidth="1.5" />
          <circle cx="56" cy="56" r="28" fill="rgba(239,159,39,0.12)" stroke="rgba(239,159,39,0.6)" strokeWidth="1.5">
            <animate attributeName="r" values="26;28;26" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="56" cy="56" r="22" fill="rgba(239,159,39,0.06)" stroke="rgba(239,159,39,0.3)" strokeWidth="1" strokeDasharray="3 4" />
          <circle ref={pupilRef} cx="56" cy="56" r="10" fill="#ef9f27" opacity="0.95" />
          <circle cx="62" cy="50" r="3.5" fill="white" opacity="0.4" />
          <circle cx="60" cy="48" r="1.5" fill="white" opacity="0.6" />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight text-white">
          n<span className="text-[color:var(--color-noctua-amber)]">o</span>ctua
        </p>
        <p className="text-xs text-gray-500 mt-1 tracking-widest uppercase">Sin conexión — esperando red...</p>
      </div>
    </div>
  )
}
