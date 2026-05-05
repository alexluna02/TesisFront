import { useState, useEffect } from 'react'

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
  const [items,    setItems]    = useState(history)
  const [filter,   setFilter]   = useState('todos')
  const [expanded, setExpanded] = useState(null)
  const [copied,   setCopied]   = useState(null)

  useEffect(() => {
    setItems(history)
  }, [history])

  const filtered = filter === 'todos'
    ? items
    : items.filter(i => i.estado === filter)

  const remove = (idx) => {
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    localStorage.setItem('analysisHistory', JSON.stringify(next))
    if (typeof onHistoryChange === 'function') onHistoryChange(next)
    if (expanded === idx) setExpanded(null)
  }

  const clearAll = () => {
    if (!window.confirm('¿Eliminar todo el historial de análisis?')) return
    setItems([])
    localStorage.setItem('analysisHistory', '[]')
    if (typeof onHistoryChange === 'function') onHistoryChange([])
    setExpanded(null)
  }

  const copy = async (item, idx) => {
    const text = [
      `Diagnóstico: ${item.enfermedadLabel ?? item.enfermedad}`,
      `Riesgo: ${item.riesgo}`,
      `Confianza: ${(item.confianza * 100).toFixed(1)}%`,
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
            { label: 'Total análisis',  value: total,    color: '#0f172a' },
            { label: 'Cultivos sanos',  value: sanos,    color: '#15803d' },
            { label: 'Con enfermedad',  value: enfermos, color: '#b91c1c' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
              <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'todos',          label: 'Todos'          },
            { id: 'Sano',           label: 'Sanos'          },
            { id: 'Con enfermedad', label: 'Con enfermedad' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
              style={filter === f.id
                ? { background: '#15803d', color: 'white', boxShadow: '0 2px 8px rgba(21,128,61,0.25)' }
                : { background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {total > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all"
            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
          >
            <IcoTrash />
            Limpiar todo
          </button>
        )}
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
                      { label: 'Confianza', value: `${(item.confianza * 100).toFixed(1)}%` },
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => copy(item, idx)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                      {copied === idx ? <IcoCheck /> : <IcoCopy />}
                      {copied === idx ? '¡Copiado!' : 'Copiar'}
                    </button>
                    <button
                      onClick={() => remove(idx)}
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
