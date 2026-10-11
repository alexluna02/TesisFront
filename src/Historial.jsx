import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { deleteAnalisis } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import { useTheme } from './ThemeContext.jsx'
import { getParcelaSummaries, renameParcela, deleteParcela, deleteParcelVisit } from './AnalizarParcela.jsx'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Shared constants ──────────────────────────────────────────────────────────
const DISEASE_LABELS = {
  Fondo_y_Sana: 'Sano', Fondo: 'Sano',
  Tizon: 'Tizón', Roya: 'Roya',
  Mancha_Blanca: 'Mancha Blanca', Mancha_blanca: 'Mancha Blanca',
}
const DISEASE_COLORS = {
  Fondo_y_Sana: '#22c55e', Fondo: '#22c55e',
  Tizon: '#f97316', Roya: '#f59e0b',
  Mancha_Blanca: '#ef4444', Mancha_blanca: '#ef4444',
}

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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <path d="M19 9l-7 7-7-7"/>
  </svg>
)
const IcoClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-300">
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)

// ── Parcel mini-map marker ────────────────────────────────────────────────────
function makeParcelMarker(sample) {
  const cls   = sample.result?.target_class
  const conf  = Math.round(sample.result?.confidence ?? 0)
  const isSano = cls === 'Fondo_y_Sana' || cls === 'Fondo'
  const color = !cls ? '#94a3b8'
    : isSano ? '#16a34a'
    : conf >= 70 ? '#dc2626'
    : conf >= 40 ? '#d97706'
    : '#65a30d'
  const num = sample.label.replace('P', '')
  return L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;background:${color};
      border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:9px;font-weight:900;">
      ${num}
    </div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  })
}

// ── FitBounds for mini-map ────────────────────────────────────────────────────
import { useMap } from 'react-leaflet'
function FitBounds({ vertices }) {
  const map = useMap()
  useEffect(() => {
    if (!vertices?.length) return
    map.fitBounds(L.latLngBounds(vertices), { padding: [20, 20], maxZoom: 18 })
  }, [map, vertices])
  return null
}

// ── ══════════════════════════════════════════════════════════════════════════ ──
//    TAB 1 — Individual History
// ── ══════════════════════════════════════════════════════════════════════════ ──
function IndividualHistorial({ history, onHistoryChange }) {
  const { isDark } = useTheme()
  const [items, setItems]             = useState(history)
  const [search, setSearch]           = useState('')
  const [filterEstado, setFilterEstado] = useState('todos')
  const [filterRiesgo, setFilterRiesgo] = useState('todos')
  const [expanded, setExpanded]       = useState(null)
  const [copied, setCopied]           = useState(null)
  const [exportingIdx, setExportingIdx] = useState(null)

  useEffect(() => { setItems(history) }, [history])

  const filtered = useMemo(() => items.filter(i => {
    const matchSearch = search.trim() === '' ||
      (i.enfermedadLabel ?? i.enfermedad ?? '').toLowerCase().includes(search.trim().toLowerCase())
    const matchEstado = filterEstado === 'todos' || i.estado === filterEstado
    const matchRiesgo = filterRiesgo === 'todos' || i.riesgo === filterRiesgo
    return matchSearch && matchEstado && matchRiesgo
  }), [items, search, filterEstado, filterRiesgo])

  const remove = async (item) => {
    if (!item?.id) return
    try { await deleteAnalisis(item.id) } catch { /* ignore */ }
    const next = items.filter(i => i.id !== item.id)
    setItems(next)
    if (typeof onHistoryChange === 'function') onHistoryChange(next)
    setExpanded(null)
  }

  const clearAll = async () => {
    if (!window.confirm('¿Eliminar todo el historial de análisis?')) return
    await Promise.all(items.map(i => i.id ? deleteAnalisis(i.id).catch(() => null) : null))
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
    } finally { setExportingIdx(null) }
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
    <div className="space-y-5">
      {/* Stats */}
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

      {/* Controls */}
      <div className={`rounded-2xl border shadow-sm p-4 space-y-3 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por enfermedad…"
            className={`w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Estado:</span>
          {[{ id: 'todos', label: 'Todos' }, { id: 'Sano', label: 'Sanos' }, { id: 'Con enfermedad', label: 'Con enfermedad' }].map(f => (
            <button key={f.id} onClick={() => setFilterEstado(f.id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={filterEstado === f.id
                ? { background: '#15803d', color: 'white' }
                : { background: isDark ? '#0e1929' : '#f8fafc', border: `1px solid ${isDark ? '#1e3048' : '#e2e8f0'}`, color: isDark ? '#94a3b8' : '#64748b' }
              }>{f.label}</button>
          ))}
          <span className="text-xs font-semibold text-slate-400 ml-3 mr-1">Riesgo:</span>
          {[{ id: 'todos', label: 'Todos' }, { id: 'Alto', label: 'Alto' }, { id: 'Medio', label: 'Medio' }, { id: 'Bajo', label: 'Bajo' }].map(f => (
            <button key={f.id} onClick={() => setFilterRiesgo(f.id)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
              style={filterRiesgo === f.id
                ? { background: '#7c3aed', color: 'white' }
                : { background: isDark ? '#0e1929' : '#f8fafc', border: `1px solid ${isDark ? '#1e3048' : '#e2e8f0'}`, color: isDark ? '#94a3b8' : '#64748b' }
              }>{f.label}</button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
            {total > 0 && (
              <button onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                <IcoTrash />Limpiar todo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${isDark ? 'border-slate-700 bg-[#162032]' : 'border-slate-200 bg-white'}`}>
          <div className={`mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
            <IcoClock />
          </div>
          <p className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Sin registros</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {total === 0 ? 'Analiza un cultivo para ver el historial aquí' : 'No hay análisis con el filtro seleccionado'}
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((item, idx) => {
          const r    = RISK[item.riesgo] ?? RISK.Bajo
          const open = expanded === idx
          return (
            <div key={idx} className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
              style={{ background: r.bg, border: `1px solid ${r.border}` }}>
              <button onClick={() => setExpanded(open ? null : idx)}
                className="w-full text-left px-5 py-4 hover:bg-black/[0.018] transition">
                <div className="flex items-center gap-4">
                  {item.imagen && (
                    <img src={item.imagen} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.dot }}/>
                      <p className="font-bold text-slate-900 truncate">{item.enfermedadLabel ?? item.enfermedad}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {new Date(item.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {new Date(item.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="hidden sm:inline-flex rounded-full px-3 py-1 text-xs font-bold"
                      style={{ background: r.badge, color: r.text }}>Riesgo {item.riesgo}</span>
                    <span className="text-sm font-bold text-slate-600 tabular-nums">{(item.confianza * 100).toFixed(0)}%</span>
                    <IcoChevron open={open}/>
                  </div>
                </div>
              </button>

              {open && (
                <div className="border-t px-5 py-5 space-y-4 fade-in"
                  style={{ background: 'rgba(255,255,255,0.58)', borderColor: r.border }}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Cultivo',        value: item.cultivo || 'Maíz' },
                      { label: 'Área afectada',  value: `${(item.confianza * 100).toFixed(1)}%` },
                      { label: 'Riesgo',         value: item.riesgo },
                      { label: 'Estado',         value: item.estado },
                    ].map((d, i) => (
                      <div key={i} className="rounded-xl bg-white border border-slate-200 p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{d.label}</p>
                        <p className="font-bold text-slate-900 mt-1 text-sm">{d.value}</p>
                      </div>
                    ))}
                  </div>
                  {item.recomendaciones && (
                    <div className="rounded-xl bg-white border border-slate-200 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Recomendaciones</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{item.recomendaciones}</p>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => copy(item, idx)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2">
                      {copied === idx ? <IcoCheck /> : <IcoCopy />}
                      {copied === idx ? '¡Copiado!' : 'Copiar'}
                    </button>
                    <button onClick={() => handleExportPDF(item, idx)} disabled={exportingIdx === idx}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-60">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                        <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        <path d="M14 3v5a1 1 0 001 1h5M9 17v-5m0 0h6m-6 0l3-3m0 0l3 3"/>
                      </svg>
                      {exportingIdx === idx ? 'Generando…' : 'PDF'}
                    </button>
                    <button onClick={() => remove(item)}
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
                      style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                      <IcoTrash />Eliminar
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

// ── ══════════════════════════════════════════════════════════════════════════ ──
//    TAB 2 — Parcel History
// ── ══════════════════════════════════════════════════════════════════════════ ──
function ParcelCard({ record, isDark, onDelete }) {
  const [open, setOpen] = useState(false)

  const { ha, fecha, stats, samples, vertices } = record
  const dominant     = stats.dominant
  const domLabel     = DISEASE_LABELS[dominant] ?? (dominant ? dominant : 'Sano')
  const domColor     = dominant ? (DISEASE_COLORS[dominant] ?? '#94a3b8') : '#22c55e'
  const sevLabel     = stats.avgAff >= 70 ? 'Grave' : stats.avgAff >= 40 ? 'Moderada' : stats.avgAff >= 20 ? 'Leve' : 'Sano'
  const sevColor     = { Grave: '#dc2626', Moderada: '#d97706', Leve: '#65a30d', Sano: '#16a34a' }[sevLabel]

  const cardBg     = isDark ? '#162032' : 'white'
  const cardBorder = isDark ? '#1e3048' : '#e2e8f0'

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm transition-shadow hover:shadow-md"
      style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>

      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 hover:bg-black/[0.018] transition">
        <div className="flex items-center gap-4">

          {/* Satellite icon */}
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: isDark ? '#0e1929' : '#f1f5f9', border: `1px solid ${cardBorder}` }}>
            🛰️
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: domColor }} />
              <p className={`font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Parcela — {ha} ha · {domLabel}
              </p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: sevColor }}>
                {sevLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">{stats.total} muestras</p>
              <p className="text-sm font-black" style={{ color: sevColor }}>{stats.avgAff}% prom.</p>
            </div>
            <IcoChevron open={open} />
          </div>
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className={`border-t px-5 py-5 space-y-4 fade-in ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Área',           value: `${ha} ha`,           color: '#7c3aed' },
              { label: 'Muestras',       value: stats.total,           color: '#64748b' },
              { label: 'Zonas sanas',    value: stats.healthy,         color: '#16a34a' },
              { label: 'Afectación',     value: `${stats.avgAff}%`,    color: sevColor  },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-3 text-center ${isDark ? 'bg-[#0e1929] border-[#1e3048]' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                <p className="text-lg font-black mt-0.5" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Mini-map + table side by side */}
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Mini-map */}
            <div className={`w-full lg:w-64 flex-shrink-0 rounded-xl overflow-hidden border ${isDark ? 'border-[#1e3048]' : 'border-slate-200'}`}>
              <div className={`px-3 py-2 border-b text-xs font-bold flex items-center gap-1.5 ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                <span>🗺️</span> Mapa del lote
              </div>
              <div style={{ height: 220 }}>
                <MapContainer
                  center={[vertices[0].lat, vertices[0].lng]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  touchZoom={false}
                >
                  <TileLayer attribution='&copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  <FitBounds vertices={vertices} />
                  <Polygon positions={vertices}
                    pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.12, weight: 2 }} />
                  {samples.filter(s => s.result).map(s => {
                    const [lng, lat] = s.coords
                    return (
                      <Marker key={s.id} position={[lat, lng]} icon={makeParcelMarker(s)}>
                        <Tooltip direction="top" offset={[0, -14]}>
                          <span className="text-[10px] font-bold">
                            {s.label} — {DISEASE_LABELS[s.result?.target_class] ?? '?'} {Math.round(s.result?.confidence ?? 0)}%
                          </span>
                        </Tooltip>
                      </Marker>
                    )
                  })}
                </MapContainer>
              </div>
              {/* Legend */}
              <div className={`px-3 py-1.5 border-t flex flex-wrap gap-x-2 gap-y-0.5 ${isDark ? 'border-[#1e3048] bg-[#0e1929]' : 'border-slate-100 bg-slate-50'}`}>
                {[['#16a34a','Sano'],['#65a30d','Leve'],['#d97706','Mod.'],['#dc2626','Grave']].map(([c, l]) => (
                  <div key={l} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                    <span className="text-[9px] text-slate-500">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Results table */}
            <div className={`flex-1 rounded-xl border overflow-hidden ${isDark ? 'border-[#1e3048]' : 'border-slate-200'}`}>
              <div className={`px-3 py-2 border-b text-xs font-bold ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                Resultados por zona
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={isDark ? 'text-slate-500 bg-[#0e1929]' : 'text-slate-400 bg-white'}>
                      <th className="px-3 py-2 text-left font-semibold">Zona</th>
                      <th className="px-3 py-2 text-left font-semibold">Diagnóstico</th>
                      <th className="px-3 py-2 text-left font-semibold">Afectado</th>
                      <th className="px-3 py-2 text-left font-semibold">Severidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((s, i) => {
                      const cls  = s.result?.target_class
                      const conf = Math.round(s.result?.confidence ?? 0)
                      const isSano = cls === 'Fondo_y_Sana' || cls === 'Fondo'
                      const sev  = !cls ? '—' : isSano ? 'Sano' : conf >= 70 ? 'Grave' : conf >= 40 ? 'Moderada' : 'Leve'
                      const sc   = { Sano: '#16a34a', Leve: '#65a30d', Moderada: '#d97706', Grave: '#dc2626', '—': '#94a3b8' }
                      return (
                        <tr key={s.id} className={`border-t ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-100 text-slate-700'} ${i % 2 ? isDark ? 'bg-slate-800/20' : 'bg-slate-50/50' : ''}`}>
                          <td className="px-3 py-2 font-bold">{s.label}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: DISEASE_COLORS[cls] ?? '#94a3b8' }} />
                              {s.status === 'done' ? (DISEASE_LABELS[cls] ?? cls) : '—'}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-black" style={{ color: DISEASE_COLORS[cls] ?? '#94a3b8' }}>
                            {s.status === 'done' ? `${conf}%` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: sc[sev] }}>{sev}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <button onClick={() => onDelete(record.id)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              <IcoTrash />Eliminar registro
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ParcelaSummaryCard({ summary, isDark, onClick }) {
  const { nombre, ha, visits, lastVisit } = summary
  const stats = lastVisit?.stats ?? { dominant: null, avgAff: 0, total: 0 }
  const domLabel = stats.dominant ? (DISEASE_LABELS[stats.dominant] ?? stats.dominant) : 'Sano'
  const domColor = stats.dominant ? (DISEASE_COLORS[stats.dominant] ?? '#94a3b8') : '#22c55e'
  const sevLabel = stats.avgAff >= 70 ? 'Grave' : stats.avgAff >= 40 ? 'Moderada' : stats.avgAff >= 20 ? 'Leve' : 'Sano'
  const sevColor = { Grave: '#dc2626', Moderada: '#d97706', Leve: '#65a30d', Sano: '#16a34a' }[sevLabel]

  const prev = visits[1]
  const delta = lastVisit && prev ? parseFloat((lastVisit.stats.avgAff - prev.stats.avgAff).toFixed(1)) : null

  return (
    <button onClick={onClick}
      className={`text-left rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all p-4 ${isDark ? 'bg-[#162032] border border-[#1e3048]' : 'bg-white border border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: isDark ? '#0e1929' : '#f1f5f9' }}>🛰️</div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: sevColor }}>{sevLabel}</span>
      </div>
      <p className={`font-bold text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{nombre}</p>
      <p className="text-xs text-slate-400 mt-0.5">{ha} ha · {visits.length} visita{visits.length !== 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: domColor }} />
        <span className={`text-xs font-semibold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{domLabel}</span>
      </div>
      <div className={`flex items-center justify-between mt-3 pt-3 border-t text-[11px] ${isDark ? 'border-[#1e3048] text-slate-500' : 'border-slate-100 text-slate-400'}`}>
        <span>{lastVisit ? new Date(lastVisit.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin visitas'}</span>
        {delta != null && (
          <span className="font-bold" style={{ color: delta < 0 ? '#16a34a' : delta > 0 ? '#dc2626' : '#94a3b8' }}>
            {delta === 0 ? '—' : `${delta < 0 ? '▼' : '▲'} ${Math.abs(delta)}%`}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Trend line chart (SVG) ─────────────────────────────────────────────────────
function TrendLineChart({ visits }) {
  const w = 560, h = 160, pad = 28
  const chrono = [...visits].reverse() // visits vienen más reciente primero → invertir para orden cronológico
  const max = Math.max(...chrono.map(v => v.stats.avgAff), 10)
  const n = chrono.length

  const pointX = (i) => n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2)
  const pointY = (v) => h - pad - (v / max) * (h - pad * 2)

  const pathD = chrono.map((v, i) => `${i === 0 ? 'M' : 'L'} ${pointX(i)} ${pointY(v.stats.avgAff)}`).join(' ')
  const areaD = `${pathD} L ${pointX(n - 1)} ${h - pad} L ${pointX(0)} ${h - pad} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {n > 1 && <path d={areaD} fill="url(#trend-fill)" stroke="none" />}
      <path d={pathD} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {chrono.map((v, i) => {
        const sev = v.stats.avgAff >= 70 ? '#dc2626' : v.stats.avgAff >= 40 ? '#d97706' : v.stats.avgAff >= 20 ? '#65a30d' : '#16a34a'
        return (
          <g key={v.id}>
            <circle cx={pointX(i)} cy={pointY(v.stats.avgAff)} r={4.5} fill={sev} stroke="white" strokeWidth="2" />
            <text x={pointX(i)} y={h - 6} textAnchor="middle" style={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}>
              {new Date(v.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Dashboard de una parcela: tendencia, comparación por zona, visitas ────────
function ParcelaDashboard({ summary, isDark, onBack, onChanged, onAnalizarDeNuevo }) {
  const { visits } = summary
  const [renaming, setRenaming] = useState(false)
  const [nombre, setNombre]     = useState(summary.nombre)

  const chrono = [...visits].reverse()
  const last = visits[0]
  const prev = visits[1]
  const delta = last && prev ? parseFloat((last.stats.avgAff - prev.stats.avgAff).toFixed(1)) : null

  const confirmRename = () => {
    const trimmed = nombre.trim()
    if (trimmed && trimmed !== summary.nombre) renameParcela(summary.id, trimmed)
    setRenaming(false)
    onChanged()
  }

  const deleteThisParcela = () => {
    if (!window.confirm(`¿Eliminar la parcela "${summary.nombre}" y sus ${visits.length} visita${visits.length !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    deleteParcela(summary.id)
    onChanged()
    onBack()
  }

  const deleteVisit = (id) => {
    if (!window.confirm('¿Eliminar esta visita?')) return
    deleteParcelVisit(id)
    onChanged()
  }

  const zoneLabels = last ? last.samples.map(s => s.label) : []
  const zoneRows = zoneLabels.map(label => ({
    label,
    cells: chrono.map(v => v.samples.find(s => s.label === label) ?? null),
  }))

  return (
    <div className="space-y-5 fade-in">
      <button onClick={onBack} className={`text-xs font-semibold transition ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
        ← Todas las parcelas
      </button>

      {/* Header */}
      <div className={`rounded-2xl border shadow-sm p-5 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            {renaming ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmRename()}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-lg font-black outline-none focus:border-violet-400" />
                <button onClick={confirmRename} className="text-xs font-bold text-emerald-600">Guardar</button>
                <button onClick={() => { setRenaming(false); setNombre(summary.nombre) }} className="text-xs font-semibold text-slate-400">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setRenaming(true)} className="group flex items-center gap-2">
                <h2 className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{summary.nombre}</h2>
                <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">✎ renombrar</span>
              </button>
            )}
            <p className="text-xs text-slate-400 mt-1">{summary.ha} ha · {summary.sampleCount} puntos de muestreo · {visits.length} visita{visits.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onAnalizarDeNuevo}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              🛰️ Analizar de nuevo
            </button>
            <button onClick={deleteThisParcela}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              <IcoTrash />
            </button>
          </div>
        </div>
      </div>

      {visits.length === 0 ? (
        <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${isDark ? 'border-slate-700 bg-[#162032]' : 'border-slate-200 bg-white'}`}>
          <p className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Todavía no hay visitas registradas</p>
        </div>
      ) : (
        <>
          {/* Tendencia + delta */}
          <div className={`rounded-2xl border shadow-sm p-5 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Evolución de la afectación promedio</p>
              {delta != null && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: delta < 0 ? '#f0fdf4' : delta > 0 ? '#fef2f2' : '#f8fafc',
                    color:      delta < 0 ? '#15803d' : delta > 0 ? '#b91c1c' : '#64748b',
                  }}>
                  {delta === 0 ? 'Sin cambio vs. visita anterior' : `${delta < 0 ? 'Mejoró' : 'Empeoró'} ${Math.abs(delta)} pts vs. visita anterior`}
                </span>
              )}
            </div>
            <TrendLineChart visits={visits} />
          </div>

          {/* Comparación por zona */}
          {chrono.length > 1 && (
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-[#1e3048]' : 'border-slate-200'}`}>
              <div className={`px-4 py-3 border-b font-bold text-sm ${isDark ? 'bg-slate-800 border-[#1e3048] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                Comparación por zona
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-400'}>
                      <th className="px-4 py-2.5 text-left font-semibold">Zona</th>
                      {chrono.map(v => (
                        <th key={v.id} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">
                          {new Date(v.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zoneRows.map((row, i) => (
                      <tr key={row.label} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} ${i % 2 ? isDark ? 'bg-slate-800/20' : 'bg-slate-50/50' : ''}`}>
                        <td className={`px-4 py-2.5 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.label}</td>
                        {row.cells.map((cell, j) => {
                          const cls  = cell?.result?.target_class
                          const conf = cell?.result ? Math.round(cell.result.confidence) : null
                          return (
                            <td key={j} className="px-4 py-2.5">
                              {cell?.result ? (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: DISEASE_COLORS[cls] ?? '#94a3b8' }} />
                                  <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{DISEASE_LABELS[cls] ?? cls}</span>
                                  <span className="font-black" style={{ color: DISEASE_COLORS[cls] ?? '#94a3b8' }}>{conf}%</span>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timeline de visitas */}
          <div className="space-y-3">
            <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Historial de visitas</p>
            {visits.map(record => (
              <ParcelCard key={record.id} record={record} isDark={isDark} onDelete={deleteVisit} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ParcelHistorial({ onGoAnalizarParcela }) {
  const { isDark } = useTheme()
  const [summaries, setSummaries] = useState(() => getParcelaSummaries())
  const [selectedId, setSelectedId] = useState(null)

  const refresh = () => setSummaries(getParcelaSummaries())

  // Reload when localStorage changes (e.g. user finishes a new parcel analysis)
  useEffect(() => {
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  const selected = selectedId ? summaries.find(s => s.id === selectedId) : null

  if (selected) {
    return (
      <ParcelaDashboard
        summary={selected}
        isDark={isDark}
        onBack={() => setSelectedId(null)}
        onChanged={refresh}
        onAnalizarDeNuevo={() => onGoAnalizarParcela?.(selected.id)}
      />
    )
  }

  const totalHa = summaries.reduce((a, p) => a + p.ha, 0)
  const totalVisitas = summaries.reduce((a, p) => a + p.visits.length, 0)

  return (
    <div className="space-y-5">
      {/* Stats */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Parcelas registradas', value: summaries.length, unit: '',    color: '#7c3aed' },
            { label: 'Hectáreas totales',    value: totalHa.toFixed(1), unit: ' ha', color: '#16a34a' },
            { label: 'Visitas registradas',  value: totalVisitas, unit: '',    color: '#d97706' },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border p-5 shadow-sm text-center ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
              <p className="text-3xl font-black" style={{ color: s.color }}>{s.value}<span className="text-base font-normal">{s.unit}</span></p>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {summaries.length === 0 && (
        <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${isDark ? 'border-slate-700 bg-[#162032]' : 'border-slate-200 bg-white'}`}>
          <div className={`mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
            🛰️
          </div>
          <p className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Sin parcelas registradas</p>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Usa "Analizar Parcela Completa" para crear tu primera parcela
          </p>
        </div>
      )}

      {/* Cards */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summaries.map(s => (
            <ParcelaSummaryCard key={s.id} summary={s} isDark={isDark} onClick={() => setSelectedId(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── ══════════════════════════════════════════════════════════════════════════ ──
//    Main export
// ── ══════════════════════════════════════════════════════════════════════════ ──
export default function Historial({ history = [], onHistoryChange, initialTab = 'individual', onGoAnalizarParcela }) {
  const { isDark } = useTheme()
  const [tab, setTab] = useState(initialTab)

  return (
    <div className="space-y-5 fade-up">

      {/* ── Tab selector ── */}
      <div className={`rounded-2xl border shadow-sm p-1.5 flex gap-1.5 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        {[
          { id: 'individual', icon: '🔬', label: 'Análisis Individual',    desc: 'Diagnósticos imagen a imagen' },
          { id: 'parcelas',   icon: '🛰️', label: 'Parcelas Completas',      desc: 'Análisis de lotes con muestreo' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
              tab === t.id ? 'text-white shadow-md' : isDark ? 'text-slate-400 hover:bg-slate-800/50' : 'text-slate-500 hover:bg-slate-50'
            }`}
            style={tab === t.id ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' } : {}}>
            <span className="text-xl leading-none">{t.icon}</span>
            <div>
              <p className={`text-sm font-bold leading-tight ${tab === t.id ? 'text-white' : ''}`}>{t.label}</p>
              <p className={`text-[11px] mt-0.5 ${tab === t.id ? 'text-violet-200' : 'text-slate-400'}`}>{t.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'individual' && <IndividualHistorial history={history} onHistoryChange={onHistoryChange} />}
      {tab === 'parcelas'   && <ParcelHistorial onGoAnalizarParcela={onGoAnalizarParcela} />}
    </div>
  )
}
