import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { useNavigate } from 'react-router-dom'
import { formatRelativeTime } from '../utils/formatRelativeTime'

type Tag = { id: number; tag: string }

type ResolvedIncident = {
  id: number
  status: string
  triggered_at: string
  resolved_at: string
  resolution_notes: string | null
  root_cause: string | null
  alert_rule?: {
    metric_name?: string
    operator?: string
    threshold?: number
    severity: string
    service?: { id: number; name: string }
  }
  resolved_by?: { id: number; name: string; email: string }
  tags?: Tag[]
}

const severityColor: Record<string, string> = {
  critical: 'bg-red-400/15 text-red-400 border-red-400/20',
  warning:  'bg-amber-400/15 text-amber-400 border-amber-400/20',
  info:     'bg-blue-400/15 text-blue-400 border-blue-400/20',
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function duration(triggered: string, resolved: string) {
  const ms = new Date(resolved).getTime() - new Date(triggered).getTime()
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.round(min / 60)} h`
}

export default function HistorialPage() {
  const { token } = useAuth()
  const { role }  = usePermissions()
  const navigate  = useNavigate()
  const { t }     = useTranslation()
  const headers   = { Authorization: `Bearer ${token}` }

  const [incidents, setIncidents] = useState<ResolvedIncident[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterSev, setFilterSev] = useState<string>('all')

  // Edición inline de resolución
  const [editingId, setEditingId]     = useState<number | null>(null)
  const canEdit = role === 'operator'
  
  const [editNotes, setEditNotes]     = useState('')
  const [editCause, setEditCause]     = useState('')
  const [editTags, setEditTags]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')

  useEffect(() => {
    if (role === 'viewer') { navigate('/dashboard'); return }
    fetchResolved()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const fetchResolved = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/incidents/resolved', { headers })
      setIncidents(res.data?.data ?? [])
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  const handleSave = async (inc: ResolvedIncident) => {
    setSaving(true)
    setSaveMsg('')
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean)
      const res = await axios.patch(
        'http://localhost:8000/api/incidents/' + inc.id + '/resolution',
        { resolution_notes: editNotes, root_cause: editCause, tags },
        { headers }
      )
      setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, ...res.data } : i))
      setSaveMsg(t('historial.form_saved'))
      setTimeout(() => { setEditingId(null); setSaveMsg('') }, 1000)
    } catch {
      setSaveMsg(t('historial.form_error'))
    } finally { setSaving(false) }
  }

  const filtered = incidents.filter(i => {
    const matchSev = filterSev === 'all' || i.alert_rule?.severity === filterSev
    const matchSearch = !search ||
      i.alert_rule?.service?.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.resolution_notes?.toLowerCase().includes(search.toLowerCase()) ||
      i.root_cause?.toLowerCase().includes(search.toLowerCase())
    return matchSev && matchSearch
  })

  const avgDuration = (() => {
    const valid = incidents.filter(i => i.triggered_at && i.resolved_at)
    if (!valid.length) return '—'
    const avg = valid.reduce((sum, i) => {
      return sum + (new Date(i.resolved_at).getTime() - new Date(i.triggered_at).getTime())
    }, 0) / valid.length
    const min = Math.round(avg / 60000)
    return min < 60 ? `${min} min` : `${Math.round(min / 60)} h`
  })()

  const documented = incidents.filter(i => i.resolution_notes).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{t('historial.title')}</h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/20">
              {t('historial.view_label')} {role === 'admin' ? 'Admin' : 'Operator'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{t('historial.subtitle')}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('historial.stat_resolved'),    value: incidents.length },
          { label: t('historial.stat_avg_time'),    value: avgDuration },
          { label: t('historial.stat_operators'),   value: [...new Set(incidents.map(i => i.resolved_by?.id).filter(Boolean))].length },
          { label: t('historial.stat_documented'),  value: documented > 0 ? Math.round(documented / Math.max(incidents.length, 1) * 100) + '%' : '0%' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl px-5 py-5 border border-white/8 flex flex-col gap-2"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-white tabular-nums">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder={t('historial.search_placeholder')} value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-white/5 text-white placeholder-gray-500 text-sm rounded-xl px-4 py-2.5 outline-none border border-white/10 focus:border-white/20 transition-colors w-64" />
        {['all', 'critical', 'warning', 'info'].map(s => (
          <button key={s} onClick={() => setFilterSev(s)}
            className={'px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ' + (filterSev === s
              ? 'bg-[color:var(--color-noctua-amber)]/15 text-[color:var(--color-noctua-amber)] border-[color:var(--color-noctua-amber)]/30'
              : 'text-gray-400 bg-white/5 border-white/10 hover:text-white')}>
            {s === 'all' ? t('historial.filter_all') : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1,2,3].map(i => <div key={i} className="h-36 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl px-6 py-12 text-center">
          <p className="text-gray-500 text-sm">{t('historial.no_incidents')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(inc => {
            const isEditing = editingId === inc.id
            const svcName = inc.alert_rule?.service?.name ?? '—'
            const rule = inc.alert_rule?.metric_name
              ? `${inc.alert_rule.metric_name} ${inc.alert_rule.operator} ${inc.alert_rule.threshold}`
              : '—'
            const sev = inc.alert_rule?.severity ?? 'info'
            const resolver = inc.resolved_by
            const dur = inc.triggered_at && inc.resolved_at ? duration(inc.triggered_at, inc.resolved_at) : '—'

            return (
              <div key={inc.id} className="rounded-2xl border border-white/8 p-5 flex flex-col gap-4"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>

                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">INC-{String(inc.id).padStart(3, '0')}</span>
                      <span className={'px-2 py-0.5 rounded-md text-xs font-semibold border ' + (severityColor[sev] ?? severityColor.info)}>
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold border bg-emerald-400/15 text-emerald-400 border-emerald-400/20">
                        {t('historial.resolved_badge')}
                      </span>
                    </div>
                    <p className="text-base font-bold text-white">{svcName}</p>
                    <p className="text-xs text-gray-500 font-mono">{rule}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {resolver && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-bold text-violet-400">
                          {initials(resolver.name)}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-white">{resolver.name}</p>
                          <p className="text-xs text-gray-500">{formatRelativeTime(inc.resolved_at)} · {t('historial.duration_label')} {dur}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {inc.tags && inc.tags.length > 0 && !isEditing && (
                  <div className="flex gap-2 flex-wrap">
                    {inc.tags.map(tagItem => (
                      <span key={tagItem.id} className="px-2.5 py-0.5 rounded-md text-xs font-mono bg-white/8 text-gray-300 border border-white/10">
                        #{tagItem.tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notas */}
                {!isEditing && (
                  <div className="flex flex-col gap-1">
                    {inc.root_cause && (
                      <p className="text-xs text-gray-500">
                        <span className="text-gray-400 font-semibold">{t('historial.root_cause_label')} </span>{inc.root_cause}
                      </p>
                    )}
                    {inc.resolution_notes ? (
                      <p className="text-sm text-gray-300 leading-relaxed">{inc.resolution_notes}</p>
                    ) : (
                      <p className="text-sm text-gray-600 italic">{t('historial.no_notes')}</p>
                    )}
                  </div>
                )}

                {/* Formulario edición */}
                {isEditing && canEdit && (
                  <div className="flex flex-col gap-3 border-t border-white/8 pt-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('historial.form_root_cause')}</label>
                      <input type="text" value={editCause} onChange={e => setEditCause(e.target.value)}
                        placeholder={t('historial.form_root_cause_placeholder')}
                        className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('historial.form_notes')}</label>
                      <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3}
                        placeholder={t('historial.form_notes_placeholder')}
                        className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors resize-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('historial.form_tags')} <span className="normal-case text-gray-600">{t('historial.form_tags_hint')}</span></label>
                      <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)}
                        placeholder={t('historial.form_tags_placeholder')}
                        className="w-full bg-white/5 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none border border-white/10 focus:border-[color:var(--color-noctua-amber)]/60 transition-colors" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setEditingId(null)} disabled={saving}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-300 hover:text-white bg-white/5 border border-white/10 transition-colors disabled:opacity-50">
                        {t('historial.form_cancel')}
                      </button>
                      <button onClick={() => handleSave(inc)} disabled={saving}
                        className="px-4 py-2.5 rounded-lg text-sm font-bold text-black bg-[color:var(--color-noctua-amber)] hover:bg-[color:var(--color-noctua-amber-hover)] glow-amber transition-colors disabled:opacity-50">
                        {saving ? t('historial.form_saving') : saveMsg || t('historial.form_save')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer */}
                {!isEditing && (
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs text-gray-600">{formatRelativeTime(inc.triggered_at)}</span>
                    {role !== 'admin' && (
                      <button
                        onClick={() => {
                          setEditingId(inc.id)
                          setEditNotes(inc.resolution_notes ?? '')
                          setEditCause(inc.root_cause ?? '')
                          setEditTags(inc.tags?.map(tagItem => tagItem.tag).join(', ') ?? '')
                        }}
                        className="text-xs font-semibold text-[color:var(--color-noctua-amber)] hover:underline transition-colors">
                        {inc.resolution_notes ? t('historial.edit_resolution') : t('historial.document_resolution')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}