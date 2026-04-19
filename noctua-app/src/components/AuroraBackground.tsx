import { useMousePosition } from '../hooks/useMousePosition'

/**
 * Fondo aurora con 3 blobs difuminados.
 *
 * Arquitectura en capas:
 * - Wrapper exterior de cada blob: aplica el transform del cursor (reactividad).
 * - Wrapper interior: aplica la animacion de flotar (loop infinito).
 * Separar los dos transforms evita que se pisen entre si.
 *
 * pointer-events: none para no bloquear clicks ni hover en el contenido.
 */
export default function AuroraBackground() {
  const { x, y } = useMousePosition()

  // Convierto porcentaje del cursor (0-100) a rango normalizado (-1 a 1)
  const normalizedX = (x - 50) / 50
  const normalizedY = (y - 50) / 50

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* Blob 1 — Indigo, grande, arriba izquierda */}
      <div
        className="absolute"
        style={{
          top: '-15%',
          left: '-10%',
          width: '700px',
          height: '700px',
          transform: `translate(${normalizedX * -80}px, ${normalizedY * -80}px)`,
          transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="w-full h-full rounded-full animate-aurora-float-1"
          style={{
            background: 'radial-gradient(circle, rgba(91, 76, 196, 0.55) 0%, rgba(91, 76, 196, 0) 70%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* Blob 2 — Ambar, mediano, centro derecha */}
      <div
        className="absolute"
        style={{
          top: '20%',
          right: '-10%',
          width: '550px',
          height: '550px',
          transform: `translate(${normalizedX * 100}px, ${normalizedY * 70}px)`,
          transition: 'transform 1.4s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="w-full h-full rounded-full animate-aurora-float-2"
          style={{
            background: 'radial-gradient(circle, rgba(239, 159, 39, 0.35) 0%, rgba(239, 159, 39, 0) 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      {/* Blob 3 — Violeta, grande, abajo derecha */}
      <div
        className="absolute"
        style={{
          bottom: '-15%',
          right: '5%',
          width: '650px',
          height: '650px',
          transform: `translate(${normalizedX * 50}px, ${normalizedY * -90}px)`,
          transition: 'transform 1.3s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="w-full h-full rounded-full animate-aurora-float-3"
          style={{
            background: 'radial-gradient(circle, rgba(167, 139, 250, 0.45) 0%, rgba(167, 139, 250, 0) 70%)',
            filter: 'blur(65px)',
          }}
        />
      </div>
    </div>
  )
}