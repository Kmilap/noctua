import { useEffect } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  // Si es false, el click en el backdrop no cierra el modal.
  // Útil cuando el usuario está en medio de un formulario y no queremos
  // que lo cierre sin querer perdiendo datos.
  closeOnBackdropClick?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  closeOnBackdropClick = true,
}: ModalProps) {
  // Anchos máximos según el size.
  // Usamos max-w-* de Tailwind para que sea responsive.
  const sizeClasses = {
    sm: 'max-w-sm',   // ~384px
    md: 'max-w-md',   // ~448px
    lg: 'max-w-lg',   // ~512px
  }

  // Efecto para:
  // 1) Cerrar el modal con Escape.
  // 2) Bloquear el scroll del body mientras el modal está abierto.
  // Solo se ejecuta cuando `isOpen` cambia.
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    // Guardamos el overflow original para restaurarlo después
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Cleanup: se ejecuta cuando el modal se cierra o el componente se desmonta.
    // Restauramos todo al estado previo.
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen, onClose])

  // Si no está abierto, no renderizamos nada (mejor performance).
  if (!isOpen) return null

  // Handler para cerrar al hacer click en el backdrop (fondo oscuro).
  // Importante: verificamos que el click haya sido EN el backdrop, no en el modal.
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose()
    }
  }

  return (
    // Backdrop — ocupa toda la pantalla, oscurece el fondo.
    // role="dialog" y aria-modal le dicen a lectores de pantalla que es un modal.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-backdrop-enter"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Contenedor del modal — aplicamos glassmorphism + animación de entrada */}
      <div
        className={`
          glass-surface
          w-full ${sizeClasses[size]}
          rounded-2xl
          shadow-2xl
          animate-modal-enter
          relative
        `}
      >
        {/* Botón X de cerrar, arriba a la derecha */}
        <button
          onClick={onClose}
          className="
            absolute top-4 right-4
            p-1.5 rounded-lg
            text-gray-400 hover:text-white
            hover:bg-white/5
            transition-colors duration-200
            z-10
          "
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {/* Header del modal (si hay título) */}
        {(title || subtitle) && (
          <div className="px-6 pt-6 pb-2">
            {title && (
              <h2
                id="modal-title"
                className="text-xl font-bold text-white tracking-tight"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Contenido del modal — lo que venga de afuera */}
        <div className="px-6 pb-6 pt-4">
          {children}
        </div>
      </div>
    </div>
  )
}