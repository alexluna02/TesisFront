import { useState, useEffect } from 'react'
import Analizar from './Analizar.jsx'
import Historial from './Historial.jsx'
import foto3 from './Imagenes/foto3.png'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// ── Google Font ───────────────────────────────────────────────────────────────
const FontLink = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  * { font-family: 'Plus Jakarta Sans', sans-serif; }
  `}</style>
)

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ color, data }) {
  const w = 120, h = 36
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ slices }) {
  const r = 54, cx = 70, cy = 70, stroke = 28
  let cumulative = 0
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  const circ = 2 * Math.PI * r

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {slices.map((sl, i) => {
        const frac = sl.value / total
        const dashArray = `${frac * circ} ${circ}`
        const offset = circ - cumulative * circ
        cumulative += frac
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={sl.color}
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeDashoffset={offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.6s ease' }}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="white"/>
    </svg>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoLeaf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
    <path d="M7 17s1-5 5-7 8-1 8-1-1 5-5 7-8 1-8 1z"/>
  </svg>
)
const IcoHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>
)
const IcoScan = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
)
const IcoHistory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IcoAbout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
)
const IcoMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
)
const IcoX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M6 18L18 6M6 6l12 12"/>
  </svg>
)
const IcoChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)
const IcoUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
)
const IcoEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'inicio',    label: 'Inicio',           Icon: IcoHome    },
  { id: 'analizar',  label: 'Analizar',          Icon: IcoScan    },
  { id: 'historial', label: 'Historial',         Icon: IcoHistory },
  { id: 'acerca',    label: 'Acerca de nosotros', Icon: IcoAbout  },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, open, onClose }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose}/>
      )}
      <aside
        className={`fixed left-0 top-0 z-40 h-full w-52 flex flex-col bg-gradient-to-b from-violet-200 via-slate-100 to-sky-200 border-r border-transparent shadow-sm transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500 text-white flex-shrink-0">
            <IcoLeaf />
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm tracking-wide">AgroScan</p>
            <p className="text-[11px] text-slate-400">UAV · Maíz · IA</p>
          </div>
          <button onClick={onClose} className="lg:hidden ml-auto text-slate-400"><IcoX /></button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => { setPage(id); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Offline banner */}
        <div className="mx-3 mb-4 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)' }}>
          {/* mini illustration */}
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-500"/>
              <span className="text-xs font-bold text-green-800">Sistema funcionando</span>
            </div>
            <p className="text-[11px] text-green-700 leading-relaxed">Puedes analizar imágenes de tus cultivos de maiz.</p>
          </div>
          {/* decorative landscape */}
          <svg viewBox="0 0 200 60" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="60" fill="transparent"/>
            <ellipse cx="100" cy="70" rx="110" ry="40" fill="#86efac" opacity="0.5"/>
            <ellipse cx="100" cy="72" rx="90" ry="35" fill="#4ade80" opacity="0.4"/>
            <rect x="30" y="30" width="6" height="24" rx="3" fill="#15803d"/>
            <ellipse cx="33" cy="28" rx="12" ry="14" fill="#22c55e"/>
            <rect x="80" y="22" width="6" height="32" rx="3" fill="#15803d"/>
            <ellipse cx="83" cy="20" rx="14" ry="16" fill="#16a34a"/>
            <rect x="140" y="26" width="6" height="28" rx="3" fill="#15803d"/>
            <ellipse cx="143" cy="24" rx="12" ry="14" fill="#22c55e"/>
          </svg>
        </div>
      </aside>
    </>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function Topbar({ page, onMenuClick, apiStatus }) {
  const titles = {
    inicio:    'Panel Principal',
    analizar:  'Análisis de Cultivos',
    historial: 'Historial de Análisis',
    acerca:    'Acerca de Nosotros',
  }
  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-100 shadow-sm">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition">
          <IcoMenu />
        </button>
        <div>
          <h1 className="font-bold text-slate-900 text-sm leading-tight">{titles[page]}</h1>
          <p className="text-[11px] text-slate-400 capitalize">{dateStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* API status badge */}
        <div className={`hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 ${apiStatus === 'online' ? 'bg-emerald-50 border border-emerald-200' : apiStatus === 'checking' ? 'bg-slate-100' : 'bg-rose-50 border border-rose-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'checking' ? 'bg-slate-400' : 'bg-rose-500'}`}/>
          <span className={`text-xs font-semibold ${apiStatus === 'online' ? 'text-emerald-700' : apiStatus === 'checking' ? 'text-slate-500' : 'text-rose-700'}`}>
            {apiStatus === 'online' ? 'API Activa' : apiStatus === 'checking' ? 'Verificando API...' : 'API Inactiva'}
          </span>
          <span className="text-[10px] text-slate-400">
            {apiStatus === 'online'
              ? 'Conexión establecida'
              : apiStatus === 'checking'
                ? 'Espere un momento'
                : 'No se pudo conectar'}
          </span>
        </div>
        {/* Avatar */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 pr-3 pl-0.5 py-0.5 cursor-pointer hover:bg-slate-50 transition">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-black">I</div>
          <span className="text-xs font-semibold text-slate-700">Investigador</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 text-slate-400"><path d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>
    </header>
  )
}

// ── Thumbnail placeholder (heatmap-like) ─────────────────────────────────────
function HeatThumb({ seed = 1 }) {
  const colors = [['#ef4444','#f97316','#eab308'],['#f97316','#eab308','#84cc16'],['#8b5cf6','#a78bfa','#c4b5fd']]
  const c = colors[seed % colors.length]
  return (
    <div className="w-12 h-10 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: '#1e293b' }}>
      <svg viewBox="0 0 48 40" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id={`hg${seed}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={c[0]} stopOpacity="1"/>
            <stop offset="40%" stopColor={c[1]} stopOpacity="0.7"/>
            <stop offset="100%" stopColor={c[2]} stopOpacity="0.2"/>
          </radialGradient>
        </defs>
        <rect width="48" height="40" fill="#0f172a"/>
        <ellipse cx="24" cy="20" rx="16" ry="13" fill={`url(#hg${seed})`}/>
      </svg>
    </div>
  )
}

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ level }) {
  const map = {
    Alta:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    Media: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    Baja:  { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    Nulo:  { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  }
  const s = map[level] || map.Media
  return (
    <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {level}
    </span>
  )
}

function SeverityLevelBadge({ level }) {
  const map = {
    Nulo:     { bg: '#e2e8f0', color: '#475569', border: '#cbd5e1' },
    Leve:     { bg: '#ecfdf5', color: '#15803d', border: '#bbf7d0' },
    Moderado: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
    Severo:   { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  }
  const s = map[level] || map.Nulo
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {level}
    </span>
  )
}

function getSeverityLevel(confidencePercent, estado) {
  if (estado === 'Sano') return 'Nulo'
  if (confidencePercent < 5) return 'Leve'
  if (confidencePercent <= 15) return 'Moderado'
  return 'Severo'
}

// ── Disease dot ───────────────────────────────────────────────────────────────
function DiseaseDot({ name }) {
  const colors = { Sano: '#15803d', Tizón: '#22c55e', Roya: '#f59e0b', 'Mancha Blanca': '#8b5cf6' }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[name] || '#94a3b8' }}/>
      <span className="text-sm text-slate-700 font-medium">{name}</span>
    </div>
  )
}

// ── HomePage ──────────────────────────────────────────────────────────────────
function HomePage({ setPage, apiStatus, history }) {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null)

  const totalAnalyses = history.length
  const diseasedCount = history.filter((item) => item.estado === 'Con enfermedad').length
  const healthyCount = history.filter((item) => item.estado === 'Sano').length
  const averageConfidence = totalAnalyses > 0
    ? Math.round(history.reduce((sum, item) => sum + ((item.confianza ?? 0) * 100), 0) / totalAnalyses)
    : 0

  const stats = [
    { label: 'Imágenes analizadas', value: totalAnalyses, sub: 'Total', color: '#22c55e', bg: '#f0fdf4', icon: '🌿', data: Array(10).fill(totalAnalyses) },
    { label: 'Detecciones realizadas', value: diseasedCount, sub: 'Con enfermedad', color: '#f59e0b', bg: '#fffbeb', icon: '🔍', data: Array(10).fill(diseasedCount) },
    { label: 'Cultivos sanos', value: healthyCount, sub: 'Análisis sanos', color: '#14b8a6', bg: '#ecfeff', icon: '🌱', data: Array(10).fill(healthyCount) },
  ]

  const recentAnalysis = history.slice(0, 3).map((item, index) => {
    const confidence = Math.round((item.confianza ?? 0) * 100)
    const isHealthy = item.estado === 'Sano'
    return {
      id: index + 1,
      date: new Date(item.fecha).toLocaleDateString('es-ES'),
      time: new Date(item.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      disease: isHealthy ? 'Sano' : (item.enfermedadLabel ?? item.enfermedad),
      severity: isHealthy ? 'Nulo' : item.riesgo,
      severityLevel: getSeverityLevel(confidence, item.estado),
      confidence,
      xaiImage: item.xaiImage,
      affectedPercent: item.affectedPercent,
      seed: index,
      raw: item,
    }
  })

  useEffect(() => {
    if (recentAnalysis.length === 0) {
      setSelectedAnalysisId(null)
      return
    }
    if (!recentAnalysis.some((row) => row.id === selectedAnalysisId)) {
      setSelectedAnalysisId(recentAnalysis[0].id)
    }
  }, [recentAnalysis, selectedAnalysisId])

  const selectedAnalysis = recentAnalysis.find((row) => row.id === selectedAnalysisId) || recentAnalysis[0] || null

  const diseases = selectedAnalysis ? [
    { label: selectedAnalysis.disease, value: 100, color: selectedAnalysis.disease === 'Sano' ? '#15803d' : (selectedAnalysis.disease === 'Roya' ? '#f59e0b' : selectedAnalysis.disease === 'Mancha Blanca' ? '#8b5cf6' : '#22c55e') },
  ] : [
    { label: 'Tizón',         value: 45, color: '#22c55e' },
    { label: 'Roya',          value: 30, color: '#f59e0b' },
    { label: 'Mancha Blanca', value: 25, color: '#8b5cf6' },
  ]

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ backgroundImage: `linear-gradient(90deg, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.18) 40%, rgba(96,165,250,0.18) 60%, rgba(96,165,250,0.12) 70%, rgba(96,165,250,0) 100%), url(${foto3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '260px' }}>
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }}/>
        <div className="absolute bottom-0 left-1/2 w-48 h-48 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }}/>

        <div className="relative flex items-center gap-0 h-full">
          {/* Left content */}
          <div className="flex-1 p-8 md:p-10 z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 mb-5">
              <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'checking' ? 'bg-slate-400' : 'bg-rose-500'}`}/>
              {apiStatus === 'online'
                ? 'API Activa · Detección en imágenes'
                : apiStatus === 'checking'
                  ? 'Verificando API · Detección en imágenes'
                  : 'API Inactiva · Detección en imágenes'}
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight mb-3">
              Detección inteligente<br/>
              de <span className="text-violet-600">enfermedades</span>{' '}
              <span className="text-green-500">en maíz</span>
            </h1>
            <div className="mb-6 max-w-sm rounded-2xl bg-white/90 border border-white/80 p-4 shadow-sm">
              <p className="text-sm text-slate-600 leading-relaxed">
                Plataforma de inteligencia artificial para el análisis de cultivos
                a partir de imágenes captadas con drones o cámaras. Detecta Tizón, Roya y Mancha Blanca
                con explicabilidad visual Grad-CAM.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setPage('analizar')}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold text-sm text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 6px 20px rgba(109,40,217,0.35)' }}
              >
                <IcoUpload />
                Cargar imagen
              </button>
              <button
                onClick={() => setPage('historial')}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <IcoEye />
                Ver historial
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: s.bg }}>
                {s.icon}
              </div>
            </div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{s.label}</p>
            <p className="text-[11px] text-slate-400">{s.sub}</p>
            <div className="mt-2">
              <Sparkline color={s.color} data={s.data}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom row: Recent analysis + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Recent analysis table */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-sm">Análisis recientes</h2>
            <button
              onClick={() => setPage('historial')}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition"
            >
              Ver todo
            </button>
          </div>
          {/* Table header */}
          <div className="grid text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6 py-2 bg-slate-50 border-b border-slate-100"
            style={{ gridTemplateColumns: '0.9fr 1.2fr 1.2fr 0.9fr 1fr' }}>
            <span>Id imagen</span>
            <span>Fecha</span>
            <span>Predicción</span>
            <span>Afectación</span>
            <span>Nivel severidad</span>
          </div>
          {recentAnalysis.length === 0 ? (
            <div className="px-6 py-16 text-center text-slate-500">
              No hay análisis recientes aún. Suba una imagen para comenzar.
            </div>
          ) : recentAnalysis.map((row) => (
            <div key={`${row.id}-${row.date}`}
              onClick={() => setSelectedAnalysisId(row.id)}
              className={`grid items-center px-6 py-3.5 border-b border-slate-50 transition cursor-pointer ${row.id === selectedAnalysisId ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
              style={{ gridTemplateColumns: '0.9fr 1.2fr 1.2fr 0.9fr 1fr' }}>
              <span className="text-sm font-semibold text-slate-800">#{row.id}</span>
              <span className="text-[11px] text-slate-500">{row.date}</span>
              <span className="text-sm text-slate-700">{row.disease}</span>
              <span className="text-sm text-slate-700">
                {row.affectedPercent != null
                  ? `${row.affectedPercent}%`
                  : row.confidence != null
                    ? `${row.confidence}%`
                    : '—'}
              </span>
              <SeverityLevelBadge level={row.severityLevel}/>
            </div>
          ))}
        </div>

        {/* Disease distribution / XAI preview */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 text-sm mb-4">
            {selectedAnalysis ? 'Análisis seleccionado' : 'Distribución de enfermedades'}
          </h2>

          {selectedAnalysis ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: selectedAnalysis.disease === 'Sano' ? '#15803d' : selectedAnalysis.disease === 'Roya' ? '#f59e0b' : selectedAnalysis.disease === 'Mancha Blanca' ? '#8b5cf6' : '#22c55e' }}
                />
                <span className="font-semibold text-slate-800">{selectedAnalysis.disease}</span>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                {selectedAnalysis.xaiImage ? (
                  <img src={selectedAnalysis.xaiImage} alt="Mapa XAI" className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center bg-slate-100 text-slate-400">
                    Sin mapa XAI disponible
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Afectación</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedAnalysis.affectedPercent != null
                    ? `${selectedAnalysis.affectedPercent}%`
                    : selectedAnalysis.severity !== 'Nulo'
                      ? `${selectedAnalysis.confidence}%`
                      : '0%'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <DonutChart slices={diseases}/>
              <div className="mt-4 w-full space-y-2.5">
                {diseases.map((d) => (
                  <div key={d.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }}/>
                      <span className="text-xs text-slate-600 font-medium">{d.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-4 text-center">
            {selectedAnalysis ? 'ⓘ Mostrando mapa XAI y afectación del análisis seleccionado' : 'ⓘ Basado en los análisis de esta semana'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,           setPage]           = useState('inicio')
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [apiStatus,      setApiStatus]      = useState('checking')
  const [analysisHistory, setAnalysisHistory] = useState([])

  useEffect(() => {
    let canceled = false
    const checkApi = async () => {
      try {
        await fetch(API_URL, { method: 'GET', cache: 'no-cache' })
        if (!canceled) setApiStatus('online')
      } catch (err) {
        if (!canceled) setApiStatus('offline')
      }
    }

    try {
      const saved = JSON.parse(localStorage.getItem('analysisHistory') ?? '[]')
      if (!canceled) setAnalysisHistory(Array.isArray(saved) ? saved : [])
    } catch {
      if (!canceled) setAnalysisHistory([])
    }

    checkApi()
    return () => { canceled = true }
  }, [])

  const syncHistory = (nextHistory) => {
    setAnalysisHistory(nextHistory)
    localStorage.setItem('analysisHistory', JSON.stringify(nextHistory))
  }

  return (
    <>
      <FontLink/>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar
          page={page}
          setPage={setPage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 lg:ml-52 flex flex-col min-h-screen">
          <Topbar page={page} onMenuClick={() => setSidebarOpen(true)} apiStatus={apiStatus}/>

          <main className="flex-1 p-4 md:p-6 w-full max-w-6xl mx-auto">
            {page === 'inicio'    && <HomePage setPage={setPage} apiStatus={apiStatus} history={analysisHistory}/>}
            {page === 'analizar'  && <Analizar onHistoryChange={syncHistory} history={analysisHistory}/>}            
            {page === 'historial' && <Historial history={analysisHistory} onHistoryChange={syncHistory}/>}
            {page === 'acerca'    && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-10 text-center text-slate-500">
                <p className="text-2xl font-black text-slate-900 mb-2">AgroScan</p>
                <p className="text-sm">Universidad Técnica · Tesis 2025</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
