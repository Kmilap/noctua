import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { formatRelativeTime } from '../utils/formatRelativeTime'

type TeamMember = {
  id: number
  name: string
  email: string
  role: 'admin' | 'operator' | 'viewer'
  last_login_at?: string | null
  incidents_count?: number
}

type Team = {
  id: number
  name: string
  slug: string
  members?: TeamMember[]
  services_count?: number
  alert_rules_count?: number
  notification_channels_count?: number
}

const roleConfig = {
  admin:    { label: 'Admin',    bg: 'bg-[color:var(--color-noctua-amber)]/15',    text: 'text-[color:var(--color-noctua-amber)]',    border: 'border-[color:var(--color-noctua-amber)]/30' },
  operator: { label: 'Operator', bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  viewer:   { label: 'Viewer',   bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30' },
}

const rolesInfo = [
  {
    role: 'Admin',
    desc: 'Acceso total: servicios, reglas, canales, equipo e incidentes.',
    perms: ['Gestionar servicios', 'Crear reglas', 'Configurar canales', 'Invitar miembros', 'Resolver incidentes'],
    color: 'border-[color:var(--color-noctua-amber)]/20',
    dot: 'bg-[color:var(--color-noctua-amber)]',
    text: 'text-[color:var(--color-noctua-amber)]',
  },
  {
    role: 'Operator',
    desc: 'Puede reconocer y resolver incidentes, ver dashboard y configurar reglas.',
    perms: ['Ver dashboard', 'Crear reglas', 'Reconocer incidentes', 'Resolver incidentes'],
    color: 'border-violet-500/20',
    dot: 'bg-violet-400',
    text: 'text-violet-400',
  },
  {
    role: 'Viewer',
    desc: 'Acceso de solo lectura al dashboard, servicios e historial.',
    perms: ['Ver dashboard', 'Ver servicios', 'Ver incidentes'],
    color: 'border-blue-500/20',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
  },
]

function MemberAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const colors = {
    admin:    'bg-[color:var(--color-noctua-amber)]/20 text-[color:var(--color-noctua-amber)] border-[color:var(--color-noctua-amber)]/30',
    operator: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    viewer:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }
  return (
    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${colors[role as keyof typeof colors] ?? colors.viewer}`}>
      {initials}
    </div>
  )
}

export default function TeamPage() {
  const { token } = useAuth()
  const { role }  = usePermissions()
  const headers   = { Authorization: `Bearer ${token}` }

  const [team, setTeam]       = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/team', { headers })
        setTeam(res.data)
      } catch {
        setError('No se pudo cargar el equipo.')
      } finally {
        setLoading(false)
      }
    }
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const members: TeamMember[] = team?.members ?? []

  const stats = [
    { label: 'Miembros',      value: members.length || team?.members?.length || '—' },
    { label: 'Servicios',     value: team?.services_count ?? '—' },
    { label: 'Reglas activas', value: team?.alert_rules_count ?? '—' },
    { label: 'Canales',       value: team?.notification_channels_count ?? '—' },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Equipo</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gestioná los miembros de tu equipo y sus permisos en Noctua
          </p>
        </div>
        {role === 'admin' && (
          <button
            className="
              bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-semibold px-5 py-2.5 rounded-lg
              transition-colors duration-200 glow-amber shrink-0
            "
          >
            + Invitar miembro
          </button>
        )}
      </div>

      {/* Stats del equipo */}
      <div
        className="rounded-2xl border border-white/8 px-6 py-5"
        style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-white">{team?.name ?? 'Mi equipo'}</p>
            <p className="text-sm text-gray-500 mt-0.5 font-mono">{team?.slug ?? ''}</p>
          </div>
          <div className="grid grid-cols-4 gap-8 text-right">
            {stats.map(s => (
              <div key={s.label}>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{s.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de miembros */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Miembros del equipo</h2>
        <div
          className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
        >
          {/* Header */}
          <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5">
            {['Miembro', 'Rol', 'Último acceso', 'Incidentes', ''].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {members.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">
              No hay miembros cargados. El endpoint /api/team puede no devolver el listado de members.
            </div>
          ) : (
            members.map((member, i) => {
              const cfg = roleConfig[member.role] ?? roleConfig.viewer
              return (
                <div
                  key={member.id}
                  className={`
                    grid grid-cols-5 px-6 py-4 items-center
                    hover:bg-white/3 transition-colors duration-200
                    ${i < members.length - 1 ? 'border-b border-white/5' : ''}
                  `}
                >
                  {/* Miembro */}
                  <div className="flex items-center gap-3 min-w-0">
                    <MemberAvatar name={member.name} role={member.role} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>

                  {/* Rol */}
                  <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-md text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>

                  {/* Último acceso */}
                  <span className="text-sm text-gray-400">
                    {member.last_login_at ? formatRelativeTime(member.last_login_at) : '—'}
                  </span>

                  {/* Incidentes */}
                  <span className="text-sm font-bold text-white tabular-nums">
                    {member.incidents_count ?? '—'}
                  </span>

                  {/* Acción */}
                  {role === 'admin' && (
                    <button className="
                      w-fit px-3 py-1.5 rounded-lg text-xs font-semibold
                      bg-white/8 hover:bg-white/12 text-gray-300 hover:text-white
                      border border-white/10 transition-colors duration-200
                    ">
                      Editar
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Cards de roles y permisos */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Roles y permisos</h2>
        <div className="grid grid-cols-3 gap-4">
          {rolesInfo.map(r => (
            <div
              key={r.role}
              className={`rounded-2xl border p-5 flex flex-col gap-4 ${r.color}`}
              style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${r.dot}`} />
                  <h3 className="text-lg font-bold text-white">{r.role}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{r.desc}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {r.perms.map(p => (
                  <li key={p} className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${r.dot.replace('bg-', 'bg-').replace('400', '500')}/20`}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={r.text}>
                        <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-300">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}