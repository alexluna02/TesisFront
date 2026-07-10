import { useState, useEffect, useMemo } from 'react'
import { deleteAnalisis } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import { useTheme } from './ThemeContext.jsx'

// ── Risk styles ───────────────────────────────────────────────────────────────

const RISK = {
  Alto:  { bg: '#fef2f2', border: '#fecaca', badge: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  Medio: { bg: '#fffbeb', border: '#fde68a', badge: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  Bajo:  { bg: '#f0fdf4', border: '#bbf7d0', badge: '#dcfce7', text: '#15803d', dot: '#22c55e' },
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
  </svg>
)

const IcoCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
  </svg>
)

const IcoCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
    <path d="M5 13l4 4L19 7"/>
  </svg>
)

const IcoChevron = ({ open }) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
  >
    <path d="M19 9l-7 7-7-7"/>
  </svg>
)

const IcoClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-300">
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────

export default function Historial({ history = [], onHistoryChange }) {
  const { isDark } = useTheme()
  const [items,      setItems]      = useState(history)
  const [search,     setSearch]     = useState('')
  const [filterEstado, setFilterEstado] = useState('todos')
  const [filterRiesgo, setFilterRiesgo] = useState('todos')
  const [expanded,   setExpanded]   = useState(null)
  const [copied,     setCopied]     = useState(null)
  const [exportingIdx, setExportingIdx] = useState(null)

  useEffect(() => { setItems(history) }, [history])

  const filtered = useMemo(() => {
    return items.filter(i => {
      const matchSearch = search.trim() === '' ||
        (i.enfermedadLabel ?? i.enfermedad ?? '').toLowerCase().includes(search.trim().toLowerCase())
      const matchEstado = filterEstado === 'todos' || i.estado === filterEstado
      const matchRiesgo = filterRiesgo === 'todos' || i.riesgo === filterRiesgo
      return matchSearch && matchEstado && matchRiesgo
    })
  }, [items, search, filterEstado, filterRiesgo])

  const remove = async (item) => {
    if (!item?.id) return
    try {
      await deleteAnalisis(item.id)
    } catch {
      // ignore backend deletion errors and still remove from UI
    }
    const next = items.filter((i) => i.id !== item.id)
    setItems(next)
    if (typeof onHistoryChange === 'function') onHistoryChange(next)
    setExpanded(null)
  }

  const clearAll = async () => {
    if (!window.confirm('¿Eliminar todo el historial de análisis?')) return
    const idsToDelete = items.map((item) => item.id).filter(Boolean)
    await Promise.all(idsToDelete.map((id) => deleteAnalisis(id).catch(() => null)))
    setItems([])
    if (typeof onHistoryChange === 'function') onHistoryChange([])
    setExpanded(null)
  }

  const handleExportPDF = async (item, idx) => {
    setExportingIdx(idx)
    try {
      await exportAnalisisPDF({
        diseaseLabel:    item.enfermedadLabel ?? item.enfermedad,
        affectedPercent: (item.confianza * 100).toFixed(1),
        risk:            item.riesgo,
        fecha:           item.fecha,
        originalImg:     item.imagen   ?? null,
        xaiImg:          item.xaiImage ?? null,
        recommendations: item.recomendaciones ? [{ body: item.recomendaciones }] : [],
      })
    } finally {
      setExportingIdx(null)
    }
  }

  const copy = async (item, idx) => {
    const text = [
      `Diagnóstico: ${item.enfermedadLabel ?? item.enfermedad}`,
      `Riesgo: ${item.riesgo}`,
      `Área afectada: ${(item.confianza * 100).toFixed(1)}%`,
      `Fecha: ${new Date(item.fecha).toLocaleString('es-ES')}`,
      `Recomendaciones: ${item.recomendaciones}`,
    ].join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  const total    = items.length
  const sanos    = items.filter(i => i.estado === 'Sano').length
  const enfermos = items.filter(i => i.estado === 'Con enfermedad').length

  return (
    <div className="space-y-5 fade-up">

      {/* ── Stats ───────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total análisis',  value: total,    color: isDark ? '#e2e8f0' : '#0f172a' },
            { label: 'Cultivos sanos',  value: sanos,    color: '#15803d' },
            { label: 'Con enfermedad',  value: enfermos, color: '#b91c1c' },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border p-5 shadow-sm text-center ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
              <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm p-4 space-y-3 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por enfermedad…"
            className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Estado:</span>
          {[
            { id: 'todos',          label: 'Todos'          },
            { id: 'Sano',           label: 'Sanos'          },
            { id: 'Con enfermedad', label: 'Con enfermedad' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterEstado(f.id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={filterEstado === f.id
                ? { background: '#15803d', color: 'white' }
                : { background: isDark ? '#0e1929' : '#f8fafc', border: `1px solid ${isDark ? '#1e3048' : '#e2e8f0'}`, color: isDark ? '#94a3b8' : '#64748b' }
              }
            >{f.label}</button>
          ))}

          <span className="text-xs font-semibold text-slate-400 ml-3 mr-1">Riesgo:</span>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'Alto',  label: 'Alto'  },
            { id: 'Medio', label: 'Medio' },
            { id: 'Bajo',  label: 'Bajo'  },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterRiesgo(f.id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={filterRiesgo === f.id
                ? { background: '#7c3aed', color: 'white' }
                : { background: isDark ? '#0e1929' : '#f8fafc', border: `1px solid ${isDark ? '#1e3048' : '#e2e8f0'}`, color: isDark ? '#94a3b8' : '#64748b' }
              }
            >{f.label}</button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            {total > 0 && (
              <button onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
              >
                <IcoTrash />Limpiar todo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <IcoClock />
          </div>
          <p className="font-semibold text-slate-700">Sin registros</p>
          <p className="text-sm text-slate-400 mt-1">
            {total === 0
              ? 'Analiza un cultivo para ver el historial aquí'
              : 'No hay análisis con el filtro seleccionado'}
          </p>
        </div>
      )}

      {/* ── Card list ───────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map((item, idx) => {
          const r    = RISK[item.riesgo] ?? RISK.Bajo
          const open = expanded === idx

          return (
            <div
              key={idx}
              className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
              style={{ background: r.bg, border: `1px solid ${r.border}` }}
            >
              {/* Card header */}
              <button
                onClick={() => setExpanded(open ? null : idx)}
                className="w-full text-left px-5 py-4 hover:bg-black/[0.018] transition"
              >
                <div className="flex items-center gap-4">
                  {item.imagen && (
                    <img
                      src={item.imagen}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.dot }}/>
                      <p className="font-bold text-slate-900 truncate">
                        {item.enfermedadLabel ?? item.enfermedad}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(item.fecha).toLocaleDateString('es-ES', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {' · '}
                      {new Date(item.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className="hidden sm:inline-flex rounded-full px-3 py-1 text-xs font-bold"
                      style={{ background: r.badge, color: r.text }}
                    >
                      Riesgo {item.riesgo}
                    </span>
                    <span className="text-sm font-bold text-slate-600 tabular-nums">
                      {(item.confianza * 100).toFixed(0)}%
                    </span>
                    <IcoChevron open={open}/>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {open && (
                <div
                  className="border-t px-5 py-5 space-y-4 fade-in"
                  style={{ background: 'rgba(255,255,255,0.58)', borderColor: r.border }}
                >
                  {/* Meta grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Cultivo',   value: item.cultivo || 'Maíz' },
                      { label: 'Área afectada', value: `${(item.confianza * 100).toFixed(1)}%` },
                      { label: 'Riesgo',    value: item.riesgo },
                      { label: 'Estado',    value: item.estado },
                    ].map((d, i) => (
                      <div key={i} className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{d.label}</p>
                        <p className="font-bold text-slate-900 mt-1 text-sm">{d.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  {item.recomendaciones && (
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Recomendaciones
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{item.recomendaciones}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => copy(item, idx)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                      {copied === idx ? <IcoCheck /> : <IcoCopy />}
                      {copied === idx ? '¡Copiado!' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => handleExportPDF(item, idx)}
                      disabled={exportingIdx === idx}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        <path d="M14 3v5a1 1 0 001 1h5M9 17v-5m0 0h6m-6 0l3-3m0 0l3 3"/>
                      </svg>
                      {exportingIdx === idx ? 'Generando…' : 'PDF'}
                    </button>
                    <button
                      onClick={() => remove(item)}
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
                      style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
                    >
                      <IcoTrash />
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
