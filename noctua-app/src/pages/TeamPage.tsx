import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import { motion } from 'framer-motion'

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
  const { t }     = useTranslation()
  const headers   = { Authorization: `Bearer ${token}` }

  const rolesInfo = [
    {
      role: 'Admin',
      desc: t('team.admin_desc'),
      perms: [t('team.perm_manage_services'), t('team.perm_create_rules'), t('team.perm_configure_channels'), t('team.perm_invite_members'), t('team.perm_resolve_incidents')],
      color: 'border-[color:var(--color-noctua-amber)]/20',
      dot: 'bg-[color:var(--color-noctua-amber)]',
      text: 'text-[color:var(--color-noctua-amber)]',
    },
    {
      role: 'Operator',
      desc: t('team.operator_desc'),
      perms: [t('team.perm_view_dashboard'), t('team.perm_create_rules'), t('team.perm_acknowledge_incidents'), t('team.perm_resolve_incidents')],
      color: 'border-violet-500/20',
      dot: 'bg-violet-400',
      text: 'text-violet-400',
    },
    {
      role: 'Viewer',
      desc: t('team.viewer_desc'),
      perms: [t('team.perm_view_dashboard'), t('team.perm_view_services'), t('team.perm_view_incidents')],
      color: 'border-blue-500/20',
      dot: 'bg-blue-400',
      text: 'text-blue-400',
    },
  ]

  const [team, setTeam]       = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [editModal, setEditModal]       = useState(false)
  const [editMember, setEditMember]     = useState<TeamMember | null>(null)
  const [editRole, setEditRole]         = useState<'operator' | 'viewer'>('operator')
  const [editing, setEditing]           = useState(false)
  const [editError, setEditError]       = useState('')
  const [editSuccess, setEditSuccess]   = useState('')

  const handleEditMember = async () => {
    if (!editMember) return
    setEditing(true)
    setEditError('')
    setEditSuccess('')
    try {
      await axios.patch(
        'http://localhost:8000/api/team/members/' + editMember.id,
        { role: editRole },
        { headers }
      )
      setEditSuccess(t('team.edit_success'))
      setTeam(prev => prev ? {
        ...prev,
        members: prev.members?.map(m =>
          m.id === editMember.id ? { ...m, role: editRole } : m
        )
      } : prev)
      setTimeout(() => { setEditModal(false); setEditSuccess('') }, 1500)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setEditError(err.response.data.message)
      } else {
        setEditError(t('team.edit_error'))
      }
    } finally { setEditing(false) }
  }

  const [inviteModal, setInviteModal]   = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteRole, setInviteRole]     = useState<'operator' | 'viewer'>('operator')
  const [inviting, setInviting]         = useState(false)
  const [inviteError, setInviteError]   = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { setInviteError(t('team.invite_error_email')); return }
    setInviting(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      await axios.post('http://localhost:8000/api/invitations',
        { email: inviteEmail.trim(), role: inviteRole },
        { headers }
      )
      setInviteSuccess(t('team.invite_success'))
      setInviteEmail('')
      setTimeout(() => { setInviteModal(false); setInviteSuccess('') }, 1800)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setInviteError(err.response.data.message)
      } else {
        setInviteError(t('team.invite_error'))
      }
    } finally { setInviting(false) }
  }

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/team', { headers })
        setTeam(res.data)
      } catch {
        setError(t('team.error_load'))
      } finally {
        setLoading(false)
      }
    }
    fetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const members: TeamMember[] = team?.members ?? []

  const stats = [
    { label: t('team.stat_members'),      value: members.length || team?.members?.length || '—' },
    { label: t('team.stat_services'),     value: team?.services_count ?? '—' },
    { label: t('team.stat_active_rules'), value: team?.alert_rules_count ?? '—' },
    { label: t('team.stat_channels'),     value: team?.notification_channels_count ?? '—' },
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
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('team.title')}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('team.subtitle')}
          </p>
        </div>
        {role === 'admin' && (
          <button
            className="
              bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)]
              text-black font-semibold px-5 py-2.5 rounded-lg
              transition-colors duration-200 glow-amber shrink-0
            "
            onClick={() => { setInviteModal(true); setInviteError(''); setInviteSuccess(''); setInviteEmail(''); }}
          >
            {t('team.invite_member')}
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
            <p className="text-lg font-bold text-white">{team?.name ?? t('team.my_team')}</p>
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
        <h2 className="text-base font-semibold text-gray-300 mb-3">{t('team.members_table')}</h2>
        <div
          className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
        >
          {/* Header */}
          <div className="grid grid-cols-5 px-6 py-3 border-b border-white/5">
            {[t('team.th_member'), t('team.th_role'), t('team.th_last_access'), t('team.th_incidents'), ''].map(h => (
              <span key={h} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          {members.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">
              {t('team.no_members')}
            </div>
          ) : (
            members.map((member, i) => {
              const cfg = roleConfig[member.role] ?? roleConfig.viewer
              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.06 }}
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
                    <button
                      onClick={() => {
                        setEditMember(member)
                        setEditRole(member.role === 'admin' ? 'operator' : member.role as 'operator' | 'viewer')
                        setEditError('')
                        setEditSuccess('')
                        setEditModal(true)
                      }}
                      className="w-fit px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/8 hover:bg-white/12 text-gray-300 hover:text-white border border-white/10 transition-colors duration-200"
                    >
                      {t('team.edit')}
                    </button>
                  )}
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Cards de roles y permisos */}
      <div>
        <h2 className="text-base font-semibold text-gray-300 mb-3">{t('team.roles_perms')}</h2>
        <div className="grid grid-cols-3 gap-4">
          {rolesInfo.map(r => (
            <motion.div
              key={r.role}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: rolesInfo.indexOf(r) * 0.1 }}
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
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal de Edición */}
      {editModal && editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 p-6 flex flex-col gap-5" style={{ background: 'rgba(15,14,23,0.98)' }}>
            <div className="flex items-center gap-3">
              <MemberAvatar name={editMember.name} role={editMember.role} />
              <div>
                <h2 className="text-base font-bold text-white">{editMember.name}</h2>
                <p className="text-xs text-gray-500">{editMember.email}</p>
              </div>
            </div>

            {editError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-2.5">{editError}</div>}
            {editSuccess && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-2.5">{editSuccess}</div>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('team.edit_change_role')}</label>
              {editMember.role === 'admin' ? (
                <p className="text-sm text-gray-500 bg-white/3 border border-white/8 rounded-xl px-4 py-3">{t('team.edit_cannot_admin')}</p>
              ) : (
                <div className="flex gap-2">
                  {(['operator','viewer'] as const).map(r => (
                    <button key={r} onClick={() => setEditRole(r)}
                      className={'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ' + (editRole === r ? 'border-[color:var(--color-noctua-amber)]/40 bg-[color:var(--color-noctua-amber)]/10 text-[color:var(--color-noctua-amber)]' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white')}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-1">
              <button onClick={() => setEditModal(false)} disabled={editing}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors duration-200 disabled:opacity-50">
                {t('team.edit_cancel')}
              </button>
              {editMember.role !== 'admin' && (
                <button onClick={handleEditMember} disabled={editing}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200 disabled:opacity-50">
                  {editing ? t('team.edit_saving') : t('team.edit_save')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Invitación */}
      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 flex flex-col gap-5" style={{ background: 'rgba(15,14,23,0.98)' }}>
            <div>
              <h2 className="text-lg font-bold text-white">{t('team.invite_title')}</h2>
              <p className="text-sm text-gray-400 mt-1">{t('team.invite_subtitle')}</p>
            </div>

            {inviteError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-2.5">{inviteError}</div>}
            {inviteSuccess && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-2.5">{inviteSuccess}</div>}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('team.invite_email_label')}</label>
              <input type="email" placeholder={t('team.invite_email_placeholder')} value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors duration-200" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('team.invite_role_label')}</label>
              <div className="flex gap-2">
                {(['operator','viewer'] as const).map(r => (
                  <button key={r} onClick={() => setInviteRole(r)}
                    className={'flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ' + (inviteRole === r ? 'border-[color:var(--color-noctua-amber)]/40 bg-[color:var(--color-noctua-amber)]/10 text-[color:var(--color-noctua-amber)]' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white')}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-1">
              <button onClick={() => setInviteModal(false)} disabled={inviting}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors duration-200 disabled:opacity-50">
                {t('team.invite_cancel')}
              </button>
              <button onClick={handleInvite} disabled={inviting}
                className="flex-1 px-4 py-3 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors duration-200 disabled:opacity-50">
                {inviting ? t('team.invite_sending') : t('team.invite_send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}