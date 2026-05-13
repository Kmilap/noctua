import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CSSProperties } from 'react'

export function usePageTransition() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mounted,  setMounted]  = useState(false)
  const [exitDir, setExitDir]   = useState<'left' | 'right' | null>(null)

  const enterFrom: 'left' | 'right' = (location.state as any)?.enterFrom ?? 'right'

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // dir 'forward' → current exits left, next enters from right (going deeper)
  // dir 'back'    → current exits right, next enters from left (going up)
  const navTo = (path: string, dir: 'forward' | 'back' = 'forward') => {
    const xDir  = dir === 'forward' ? 'left'  : 'right'
    const enter = dir === 'forward' ? 'right' : 'left'
    setExitDir(xDir)
    setTimeout(() => navigate(path, { state: { enterFrom: enter } }), 560)
  }

  const ease = 'cubic-bezier(0.22,1,0.36,1)'

  let transform = 'none'
  if (!mounted)                transform = enterFrom === 'right' ? 'translateX(48px)' : 'translateX(-48px)'
  else if (exitDir === 'left')  transform = 'translateX(-48px)'
  else if (exitDir === 'right') transform = 'translateX(48px)'

  const pageStyle: CSSProperties = {
    opacity:       mounted && !exitDir ? 1 : 0,
    transform,
    transition:    `opacity 0.58s ${ease}, transform 0.58s ${ease}`,
    pointerEvents: exitDir ? 'none' : undefined,
  }

  return { mounted, exitDir, navTo, pageStyle, ease }
}
