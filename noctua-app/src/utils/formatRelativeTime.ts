/**
 * Convierte un ISO timestamp (UTC) en una cadena relativa en español.
 * Ejemplos: "hace 5 seg", "hace 3 min", "hace 2 h", "hace 4 d".
 *
 * Cero dependencias. Suficiente para dashboards.
 * Si en el futuro necesitamos algo más sofisticado (fechas absolutas,
 * localización multi-idioma, timezones), migramos a date-fns.
 */
export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return '—'  // fecha inválida

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  // Futuro (poco común, pero posible por desfases de reloj)
  if (diffSec < 0) return 'ahora'

  if (diffSec < 10)    return 'hace unos seg'
  if (diffSec < 60)    return `hace ${diffSec} seg`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60)    return `hace ${diffMin} min`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)     return `hace ${diffHr} h`

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7)     return `hace ${diffDay} d`
  if (diffDay < 30)    return `hace ${Math.floor(diffDay / 7)} sem`
  if (diffDay < 365)   return `hace ${Math.floor(diffDay / 30)} mes`

  return `hace ${Math.floor(diffDay / 365)} años`
}

/**
 * Formato absoluto para tooltip (cuando el usuario hace hover sobre
 * "hace 5 min" queremos mostrar la fecha completa).
 * Usa la locale del navegador.
 */
export function formatAbsoluteTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'

  const date = new Date(isoDate)
  if (isNaN(date.getTime())) return '—'

  return date.toLocaleString('es', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}