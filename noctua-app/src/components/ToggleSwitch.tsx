type ToggleSwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
}

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  size = 'md',
}: ToggleSwitchProps) {
  // Tamaños diferentes según el contexto:
  // sm: para usar inline al lado de texto (ej. en forms compactos)
  // md: para usar como acción visible (ej. en cards de reglas) ← default
  const sizeClasses = {
    sm: {
      track: 'w-9 h-5',
      thumb: 'w-4 h-4',
      thumbTranslate: 'translate-x-4',
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      thumbTranslate: 'translate-x-5',
    },
  }

  const s = sizeClasses[size]

  return (
    <label
      className={`
        inline-flex items-center gap-3
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      `}
    >
      {/* Input real, oculto pero accesible */}
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
      />

      {/* Track del switch (la pista por donde se desliza el círculo) */}
      <span
        className={`
          relative inline-flex shrink-0
          ${s.track}
          rounded-full
          transition-colors duration-300
          ${checked
            ? 'bg-[color:var(--color-status-resolved)]'
            : 'bg-[color:var(--color-noctua-border)]'
          }
          ${!disabled && 'hover:brightness-110'}
        `}
        style={{ transitionTimingFunction: 'var(--ease-out-quint)' }}
      >
        {/* Glow sutil cuando está activo, desaparece cuando no */}
        <span
          className={`
            absolute inset-0 rounded-full
            transition-opacity duration-300
            ${checked ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            boxShadow: '0 0 12px rgba(52, 211, 153, 0.4)',
          }}
          aria-hidden="true"
        />

        {/* Thumb (círculo blanco que se desliza) */}
        <span
          className={`
            absolute top-0.5 left-0.5
            ${s.thumb}
            bg-white rounded-full
            shadow-md
            transition-transform duration-300
            ${checked ? s.thumbTranslate : 'translate-x-0'}
          `}
          style={{ transitionTimingFunction: 'var(--ease-out-back)' }}
        />
      </span>

      {/* Label opcional (texto al lado del switch) */}
      {label && (
        <span className="text-sm text-gray-300 select-none">{label}</span>
      )}
    </label>
  )
}