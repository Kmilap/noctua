import { useEffect, useState } from 'react'

/**
 * Hook que trackea la posicion del cursor relativa al viewport.
 * Devuelve porcentajes (0-100) para usar en efectos visuales.
 *
 * Respeta prefers-reduced-motion: si el usuario desactivo animaciones
 * en su sistema operativo, el hook devuelve siempre el centro (50, 50).
 *
 * Throttleado con requestAnimationFrame para no matar performance.
 */
export function useMousePosition() {
  // Arranca en el centro para que los blobs no "salten" al mover el mouse la primera vez
  const [position, setPosition] = useState({ x: 50, y: 50 })

  useEffect(() => {
    // Respeto por la accesibilidad: usuarios con motion reducido no ven el efecto reactivo
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let rafId: number | null = null

    const handleMouseMove = (e: MouseEvent) => {
      // Cancelar el frame anterior si aun no se ejecuto (throttling natural)
      if (rafId !== null) return

      rafId = requestAnimationFrame(() => {
        const xPercent = (e.clientX / window.innerWidth) * 100
        const yPercent = (e.clientY / window.innerHeight) * 100
        setPosition({ x: xPercent, y: yPercent })
        rafId = null
      })
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  return position
}