import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import PageHero, { PageGlow } from './PageHero.jsx'
import { apiErrorMessage, deleteAnalisis } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import {
  getParcelaSummaries, renameParcela, deleteParcela, deleteParcelVisit, PARCELAS_KEY, PARCEL_HISTORY_KEY,
} from './AnalizarParcela.jsx'
import { SEVERITY_LIMITS, SEVERITY_PALETTE, lotSeverity, severityOf } from './severity.js'
import { DISEASES, diseaseKey, diseaseMeta, recommendationsFor } from './diseases.js'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ══════════════════════════════════════════════════════════════════════════════
//    Estilos compartidos y utilidades
// ══════════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = 8
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const GLASS = 'rounded-3xl border border-white/70 bg-white/80 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]'
const ROW = 'rounded-2xl border border-slate-200/70 bg-white/90 p-3 shadow-sm transition-[border-color,box-shadow] hover:border-emerald-200 hover:shadow-[0_14px_34px_-18px_rgba(5,150,105,0.45)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/30'
const BTN = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10',
  danger: 'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
  dangerSolid: 'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700',
}

const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const fmtDateTime = (iso) => `${fmtDate(iso)} • ${fmtTime(iso)}`
const fmtPct = (v) => {
  const n = Number(v) || 0
  return `${n > 0 && n < 10 ? n.toFixed(1) : Math.round(n)}%`
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const affectedOf = (item) => Number(item.affectedPercent ?? (item.confianza ?? 0) * 100) || 0

// Cantidad de registros por semana (las últimas `weeks` semanas, la más reciente al final)
function weeklySeries(dates, weeks = 8) {
  const now = Date.now()
  const series = Array(weeks).fill(0)
  dates.forEach((d) => {
    const age = Math.floor((now - new Date(d).getTime()) / WEEK_MS)
    if (age >= 0 && age < weeks) series[weeks - 1 - age] += 1
  })
  return series
}

function pageWindow(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const nums = [...new Set([1, count, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

function usePaged(list, resetKey) {
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [resetKey])
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * PAGE_SIZE
  return {
    page: current,
    setPage,
    pageCount,
    total: list.length,
    from: list.length ? start + 1 : 0,
    to: Math.min(start + PAGE_SIZE, list.length),
    items: list.slice(start, start + PAGE_SIZE),
  }
}

// Enfermedad que más se repite entre las zonas con síntomas de una visita
function visitDisease(visit) {
  if (!visit) return null
  const counts = {}
  ;(visit.samples ?? []).forEach((s) => {
    const k = diseaseKey(s.result?.target_class)
    if (k && k !== 'sano') counts[k] = (counts[k] ?? 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? DISEASES[top[0]] : DISEASES.sano
}

const sickZones = (stats) => stats.sick ?? (stats.total - stats.healthy)

const DISEASE_CHIPS = [
  { id: 'mancha', label: 'Mancha Blanca' },
  { id: 'tizon', label: 'Tizón del Maíz' },
  { id: 'roya', label: 'Roya' },
  { id: 'sano', label: 'Sanos' },
]

// ══════════════════════════════════════════════════════════════════════════════
//    Iconos
// ══════════════════════════════════════════════════════════════════════════════
const Svg = ({ children, className = 'h-4 w-4', ...rest }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
    {children}
  </svg>
)
const IcoSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
const IcoFilter = (p) => <Svg {...p}><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" /></Svg>
const IcoChevronDown = (p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
const IcoChevronLeft = (p) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
const IcoChevronRight = (p) => <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
const IcoSort = (p) => <Svg {...p}><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></Svg>
const IcoCalendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Svg>
const IcoTriangle = (p) => <Svg {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></Svg>
const IcoAlert = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></Svg>
const IcoCheck = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></Svg>
const IcoShield = (p) => <Svg {...p}><path d="M12 3 5 6v5c0 4.5 3 8.3 7 9.5 4-1.2 7-5 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></Svg>
const IcoArrowRight = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
const IcoMore = (p) => <Svg {...p}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></Svg>
const IcoLeaf = (p) => <Svg {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></Svg>
const IcoChart = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
const IcoGrid = (p) => <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
const IcoMap = (p) => <Svg {...p}><path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></Svg>
const IcoLayers = (p) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Svg>
const IcoTrash = (p) => <Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></Svg>
const IcoCopy = (p) => <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>
const IcoPdf = (p) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Svg>
const IcoEye = (p) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
const IcoPencil = (p) => <Svg {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>
const IcoScan = (p) => <Svg {...p}><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10" /></Svg>

// ══════════════════════════════════════════════════════════════════════════════
//    Componentes de interfaz
// ══════════════════════════════════════════════════════════════════════════════
const HERO_COPY = {
  individual: { highlight: 'individual', subtitle: 'Diagnósticos imagen por imagen de tus cultivos' },
  parcelas: { highlight: 'por parcela', subtitle: 'Seguimiento de tus lotes, visita a visita' },
}

function Sparkline({ series, color, className }) {
  const id = `spark${useId().replace(/:/g, '')}`
  const w = 100
  const h = 40
  const max = Math.max(...series, 1)
  const pts = series.map((v, i) => [(i / Math.max(series.length - 1, 1)) * w, h - 4 - (v / max) * (h - 10)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const KPI_TONES = {
  emerald: {
    icon: 'from-emerald-400 to-green-600 shadow-emerald-600/30',
    line: '#10b981',
    card: 'border-white/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]',
    ring: 'ring-emerald-500/70',
  },
  teal: {
    icon: 'from-teal-400 to-emerald-600 shadow-teal-600/30',
    line: '#14b8a6',
    card: 'border-white/70 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]',
    ring: 'ring-teal-500/70',
  },
  red: {
    icon: 'from-rose-400 to-red-600 shadow-red-600/30',
    line: '#ef4444',
    card: 'border-rose-100 bg-linear-to-br from-rose-50 to-white/80 dark:border-rose-400/20 dark:from-rose-500/10 dark:to-white/[0.03]',
    ring: 'ring-red-500/70',
  },
}

function KpiCard({ icon: Icon, value, label, series, tone = 'emerald', active = false, onClick, title }) {
  const t = KPI_TONES[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      title={title}
      className={`relative flex w-full flex-col gap-2 overflow-hidden rounded-3xl border p-3 text-left shadow-[0_12px_40px_-22px_rgba(15,23,42,0.3)] backdrop-blur-xl transition sm:flex-row sm:items-center sm:gap-4 sm:p-5 ${t.card} ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : ''
      } ${active ? `ring-2 ${t.ring}` : ''}`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-white shadow-lg sm:h-14 sm:w-14 ${t.icon}`}>
        <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-3xl dark:text-white">{value}</span>
        <span className="mt-1 block text-[11px] font-medium leading-tight text-slate-500 sm:text-sm dark:text-slate-400">{label}</span>
      </span>
      {series && <Sparkline series={series} color={t.line} className="ml-auto hidden h-11 w-24 shrink-0 sm:block" />}
    </Tag>
  )
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <label className="relative block flex-1">
      <span className="sr-only">Buscar</span>
      <IcoSearch className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-white/70 bg-white/80 pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none backdrop-blur-xl transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </label>
  )
}

function FiltersButton({ open, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold shadow-sm backdrop-blur-xl transition ${
        open
          ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200'
          : 'border-emerald-200 bg-white/80 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/25 dark:bg-white/[0.04] dark:text-emerald-300 dark:hover:bg-emerald-400/10'
      }`}
    >
      <IcoFilter className="h-[18px] w-[18px]" />
      Filtros
      {count > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">{count}</span>
      )}
      <IcoChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-emerald-700 bg-emerald-700 text-white shadow-md shadow-emerald-700/25 dark:border-emerald-500 dark:bg-emerald-600'
          : 'border-white/80 bg-white/80 text-slate-700 shadow-sm hover:border-emerald-200 hover:text-emerald-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:text-emerald-200'
      }`}
    >
      {children}
    </button>
  )
}

function DiseaseChips({ value, onChange, allLabel }) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <Chip active={value === 'todos'} onClick={() => onChange('todos')}>
        <IcoGrid className="h-4 w-4" />
        {allLabel}
      </Chip>
      {DISEASE_CHIPS.map(({ id, label }) => (
        <Chip key={id} active={value === id} onClick={() => onChange(value === id ? 'todos' : id)}>
          <IcoLeaf className="h-4 w-4" style={{ color: DISEASES[id].color }} />
          {label}
        </Chip>
      ))}
    </div>
  )
}

function SortSelect({ value, onChange, options }) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <IcoSort className="h-4 w-4" />
      <span className="whitespace-nowrap">Ordenar por:</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 cursor-pointer appearance-none rounded-xl border border-white/80 bg-white/80 pl-3 pr-9 text-sm font-semibold text-slate-800 shadow-sm outline-none backdrop-blur-xl focus:ring-4 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-[#111c2e] dark:text-slate-100"
        >
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <IcoChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </span>
    </label>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function DateField({ label, value, onChange, min, max }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none [color-scheme:light] focus:ring-4 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
      />
    </label>
  )
}

const SEVERITY_UI = {
  Sano: { Icon: IcoShield, cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300' },
  Leve: { Icon: IcoCheck, cls: 'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-400/25 dark:bg-lime-400/10 dark:text-lime-300' },
  Moderada: { Icon: IcoAlert, cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300' },
  Grave: { Icon: IcoTriangle, cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300' },
}

function SeverityBadge({ level, className = '' }) {
  const ui = SEVERITY_UI[level]
  if (!ui) {
    return (
      <span className={`inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-400 dark:border-white/10 ${className}`}>
        Sin datos
      </span>
    )
  }
  return (
    <span
      title={level === 'Sano' ? 'Sin enfermedad detectada' : `Severidad ${level.toLowerCase()} según el área afectada`}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold ${ui.cls} ${className}`}
    >
      <ui.Icon className="h-4 w-4" />
      {level === 'Sano' ? 'Sano' : (
        <>
          <span className="sm:hidden">{level}</span>
          <span className="hidden sm:inline">Severidad {level.toLowerCase()}</span>
        </>
      )}
    </span>
  )
}

function AffectedValue({ value, caption = 'afectado', delta = null }) {
  const empty = value == null
  return (
    <div className="w-[4.5rem] shrink-0 text-right">
      <p className="text-xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{empty ? '—' : fmtPct(value)}</p>
      {empty ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">sin datos</p>
      ) : delta != null && delta !== 0 ? (
        <p className={`mt-1 text-[11px] font-bold ${delta > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} pts
        </p>
      ) : (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{caption}</p>
      )}
    </div>
  )
}

function DetailButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-400/30 dark:bg-transparent dark:text-emerald-300 dark:hover:bg-emerald-400/10 ${className}`}
    >
      Ver detalle <IcoArrowRight className="h-4 w-4" />
    </button>
  )
}

function RowMenu({ items, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const toggle = (next) => {
    setOpen(next)
    onOpenChange?.(next)
  }
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) toggle(false) }
    const onKey = (e) => { if (e.key === 'Escape') toggle(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => toggle(!open)}
        className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
      >
        <IcoMore className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="fade-in absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#0f1a2b]">
          {items.map(({ label, Icon, onClick, danger, disabled }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => { toggle(false); onClick() }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition disabled:opacity-50 ${
                danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Pagination({ paged, onPage }) {
  const { page, pageCount, from, to, total } = paged
  if (!total) return null
  const btn = 'grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Mostrando <span className="font-semibold text-slate-700 dark:text-slate-200">{from} – {to}</span> de{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> resultado{total === 1 ? '' : 's'}
      </p>
      {pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-1.5">
          <button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => onPage(page - 1)} className={`${btn} text-slate-500 hover:bg-white dark:hover:bg-white/10`}>
            <IcoChevronLeft className="h-4 w-4" />
          </button>
          {pageWindow(page, pageCount).map((p, i) => (p === '…' ? (
            <span key={`gap${i}`} className="px-1 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
              className={`${btn} ${
                p === page
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'border border-white/80 bg-white/80 text-slate-600 hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
              }`}
            >
              {p}
            </button>
          )))}
          <button type="button" aria-label="Página siguiente" disabled={page === pageCount} onClick={() => onPage(page + 1)} className={`${btn} text-slate-500 hover:bg-white dark:hover:bg-white/10`}>
            <IcoChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-200 bg-white/60 px-6 py-14 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-br from-emerald-400/20 to-green-600/20 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
        <Icon className="h-8 w-8" />
      </div>
      <p className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function Metric({ label, value, valueClass = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-extrabold ${valueClass}`}>{value}</p>
    </div>
  )
}

// Barra de la escala de severidad (0–30 %) con la posición del análisis
function AffectedScale({ value }) {
  const scale = SEVERITY_LIMITS.grave * 2
  const at = (v) => (Math.min(Math.max(v, 0), scale) / scale) * 100
  const p1 = at(SEVERITY_LIMITS.moderada)
  const p2 = at(SEVERITY_LIMITS.grave)
  return (
    <div>
      <div className="relative">
        <div
          className="h-2.5 rounded-full"
          style={{ background: `linear-gradient(90deg, #84cc16 0 ${p1}%, #f59e0b ${p1}% ${p2}%, #ef4444 ${p2}% 100%)` }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-900 shadow-md dark:border-[#0d1726] dark:bg-white"
          style={{ left: `${at(value)}%` }}
        />
      </div>
      <div className="relative mt-2 h-4 text-[10px] font-semibold text-slate-400">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${p1}%` }}>{SEVERITY_LIMITS.moderada}%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${p2}%` }}>{SEVERITY_LIMITS.grave}%</span>
        <span className="absolute right-0">{scale}%+</span>
      </div>
    </div>
  )
}

function Figure({ src, label, empty }) {
  return (
    <figure className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-100 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03]">
      {src
        ? <img src={src} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        : <div className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-slate-400">{empty}</div>}
      <figcaption className="absolute left-3 top-3 rounded-lg bg-slate-950/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{label}</figcaption>
    </figure>
  )
}

// ── Modales (en un portal para quedar sobre la barra superior y el menú lateral)
const modalStack = []

function Modal({ onClose, labelledBy, size = 'max-w-3xl', children }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const token = {}
    modalStack.push(token)
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      modalStack.splice(modalStack.indexOf(token), 1)
      document.body.style.overflow = prevOverflow
    }
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="fade-in absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => closeRef.current()} />
      <div className={`fade-up relative flex max-h-[92vh] w-full ${size} flex-col overflow-hidden rounded-t-3xl border border-white/60 bg-white shadow-2xl sm:rounded-3xl dark:border-white/10 dark:bg-[#0d1726]`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function useConfirm() {
  const [request, setRequest] = useState(null)
  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), [])
  const settle = (value) => {
    request?.resolve(value)
    setRequest(null)
  }
  const dialog = request ? (
    <Modal onClose={() => settle(false)} labelledBy="confirmar-titulo" size="max-w-md">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <IcoTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 id="confirmar-titulo" className="text-lg font-bold text-slate-900 dark:text-white">{request.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{request.message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => settle(false)} className={BTN.secondary}>Cancelar</button>
          <button type="button" onClick={() => settle(true)} className={BTN.dangerSolid}>{request.confirmLabel ?? 'Eliminar'}</button>
        </div>
      </div>
    </Modal>
  ) : null
  return [confirm, dialog]
}

function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const show = useCallback((message, tone = 'success') => {
    clearTimeout(timer.current)
    setToast({ message, tone, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 3200)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const node = toast ? createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        key={toast.key}
        role="status"
        className={`fade-up pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${
          toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-emerald-950'
        }`}
      >
        {toast.tone === 'error' ? <IcoAlert className="h-5 w-5 shrink-0" /> : <IcoCheck className="h-5 w-5 shrink-0" />}
        {toast.message}
      </div>
    </div>,
    document.body,
  ) : null
  return [show, node]
}

function RenameDialog({ initial, onCancel, onSave }) {
  const [value, setValue] = useState(initial)
  const submit = (e) => {
    e.preventDefault()
    const v = value.trim()
    if (v) onSave(v)
  }
  return (
    <Modal onClose={onCancel} labelledBy="renombrar-titulo" size="max-w-md">
      <form onSubmit={submit} className="p-6">
        <h3 id="renombrar-titulo" className="text-lg font-bold text-slate-900 dark:text-white">Renombrar parcela</h3>
        <input
          autoFocus
          value={value}
          maxLength={60}
          onChange={(e) => setValue(e.target.value)}
          className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
        />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className={BTN.secondary}>Cancelar</button>
          <button type="submit" disabled={!value.trim()} className={BTN.primary}>Guardar</button>
        </div>
      </form>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//    Análisis por planta (diagnóstico individual)
// ══════════════════════════════════════════════════════════════════════════════
function Thumb({ src, color }) {
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 sm:h-16 sm:w-16 dark:ring-white/10" style={{ background: `${color}1f` }}>
      {src
        ? <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        : <IcoLeaf className="absolute inset-0 m-auto h-6 w-6" style={{ color }} />}
    </div>
  )
}

function AnalysisRow({ item, onOpen, menuItems }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const meta = diseaseMeta(item.enfermedad)
  const affected = affectedOf(item)
  return (
    <li className={`relative ${menuOpen ? 'z-20' : ''} ${ROW}`}>
      <div className="flex items-center gap-3 lg:gap-4">
        <Thumb src={item.imagen} color={meta.color} />
        <div className="min-w-0 flex-1 xl:w-56 xl:flex-none">
          <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
            <span className="truncate">{meta.label}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <IcoCalendar className="h-3.5 w-3.5 shrink-0" />
            {fmtDateTime(item.fecha)}
          </p>
        </div>
        <div className="hidden h-10 w-px shrink-0 bg-slate-200 xl:block dark:bg-white/10" />
        <p className="hidden min-w-0 flex-1 text-sm leading-snug text-slate-600 xl:block dark:text-slate-300">{meta.description}</p>
        <div className="hidden lg:block">
          <SeverityBadge level={item.severidad} className="min-w-[10.5rem]" />
        </div>
        <AffectedValue value={affected} />
        <div className="hidden lg:block">
          <DetailButton onClick={onOpen} />
        </div>
        <RowMenu items={menuItems} onOpenChange={setMenuOpen} />
      </div>
      <div className="mt-3 space-y-3 lg:hidden">
        <p className="text-sm text-slate-600 dark:text-slate-300">{meta.description}</p>
        <div className="flex items-center justify-between gap-3">
          <SeverityBadge level={item.severidad} />
          <DetailButton onClick={onOpen} />
        </div>
      </div>
    </li>
  )
}

function AnalysisDetail({ item, exporting, onClose, onExport, onCopy, onDelete }) {
  const meta = diseaseMeta(item.enfermedad)
  const affected = affectedOf(item)
  const recs = recommendationsFor(item.enfermedad)
  return (
    <Modal onClose={onClose} labelledBy="detalle-titulo">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6 dark:border-white/10">
        <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: meta.color, boxShadow: `0 0 0 4px ${meta.color}33` }} />
        <div className="min-w-0 flex-1">
          <h2 id="detalle-titulo" className="truncate text-lg font-extrabold text-slate-900 dark:text-white">{meta.label}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <IcoCalendar className="h-3.5 w-3.5" />
            {fmtDateTime(item.fecha)}
          </p>
        </div>
        <div className="hidden sm:block">
          <SeverityBadge level={item.severidad} />
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200">
          <IcoX className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Figure src={item.imagen} label="Imagen analizada" empty="Imagen no disponible" />
          <Figure src={item.xaiImage} label="Mapa de atención (Grad-CAM)" empty="Este análisis no tiene mapa Grad-CAM" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Área afectada" value={fmtPct(affected)} />
          <Metric label="Severidad" value={item.severidad ?? '—'} />
          <Metric label="Estado" value={item.estado ?? '—'} />
          <Metric label="Cultivo" value={item.cultivo || 'Maíz'} />
        </div>

        <div className="rounded-2xl border border-slate-100 p-4 dark:border-white/10">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Escala de severidad</p>
          <AffectedScale value={affected} />
          {meta.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{meta.description}</p>}
        </div>

        {recs.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Recomendaciones agronómicas</h3>
            <ol className="grid gap-2.5 sm:grid-cols-2">
              {recs.map((r, i) => (
                <li key={r.title} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white" style={{ background: meta.color }}>{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{r.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{r.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4 sm:px-6 dark:border-white/10">
        <button type="button" onClick={onDelete} className={BTN.danger}>
          <IcoTrash className="h-4 w-4" /> Eliminar
        </button>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCopy} className={BTN.secondary}>
            <IcoCopy className="h-4 w-4" /> Copiar
          </button>
          <button type="button" onClick={onExport} disabled={exporting} className={BTN.primary}>
            <IcoPdf className="h-4 w-4" /> {exporting ? 'Generando…' : 'Exportar PDF'}
          </button>
        </div>
      </footer>
    </Modal>
  )
}

const PLANT_SORTS = [
  { id: 'recientes', label: 'Más recientes' },
  { id: 'antiguos', label: 'Más antiguos' },
  { id: 'mayor', label: 'Mayor afectación' },
  { id: 'menor', label: 'Menor afectación' },
]

function PlantHistory({ history, onHistoryChange, onGoAnalizar, confirm, toast }) {
  const [query, setQuery] = useState('')
  const [disease, setDisease] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [severity, setSeverity] = useState('todas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState('recientes')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [exportingId, setExportingId] = useState(null)
  const listRef = useRef(null)

  const stats = useMemo(() => {
    const healthy = history.filter((i) => i.estado === 'Sano')
    const sick = history.filter((i) => i.estado !== 'Sano')
    return {
      total: history.length,
      healthy: healthy.length,
      sick: sick.length,
      seriesTotal: weeklySeries(history.map((i) => i.fecha)),
      seriesHealthy: weeklySeries(healthy.map((i) => i.fecha)),
      seriesSick: weeklySeries(sick.map((i) => i.fecha)),
    }
  }, [history])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null
    const list = history.filter((item) => {
      if (disease !== 'todos' && diseaseKey(item.enfermedad) !== disease) return false
      if (estado === 'Sano' && item.estado !== 'Sano') return false
      if (estado === 'Con enfermedad' && item.estado === 'Sano') return false
      if (severity !== 'todas' && item.severidad !== severity) return false
      const ts = new Date(item.fecha).getTime()
      if (fromTs && ts < fromTs) return false
      if (toTs && ts > toTs) return false
      if (!q) return true
      const meta = diseaseMeta(item.enfermedad)
      const haystack = normalize([
        meta.label, meta.short, item.severidad, item.estado,
        fmtDate(item.fecha), new Date(item.fecha).toLocaleDateString('es-ES'),
      ].join(' '))
      return haystack.includes(q)
    })
    const byDate = (a, b) => new Date(b.fecha) - new Date(a.fecha)
    const sorters = {
      recientes: byDate,
      antiguos: (a, b) => byDate(b, a),
      mayor: (a, b) => affectedOf(b) - affectedOf(a) || byDate(a, b),
      menor: (a, b) => affectedOf(a) - affectedOf(b) || byDate(a, b),
    }
    return [...list].sort(sorters[sort] ?? byDate)
  }, [history, query, disease, estado, severity, dateFrom, dateTo, sort])

  const paged = usePaged(filtered, [query, disease, estado, severity, dateFrom, dateTo, sort].join('|'))
  const activeFilters = (estado !== 'todos') + (severity !== 'todas') + Boolean(dateFrom) + Boolean(dateTo)

  const resetFilters = () => {
    setQuery('')
    setDisease('todos')
    setEstado('todos')
    setSeverity('todas')
    setDateFrom('')
    setDateTo('')
  }

  const goToPage = (p) => {
    paged.setPage(p)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const removeItem = async (item) => {
    const meta = diseaseMeta(item.enfermedad)
    const ok = await confirm({
      title: '¿Eliminar este análisis?',
      message: `Se borrará el diagnóstico de ${meta.label} del ${fmtDate(item.fecha)}. Esta acción no se puede deshacer.`,
    })
    if (!ok) return
    try {
      await deleteAnalisis(item.id)
    } catch (err) {
      // Si ya no existe en el servidor, también se quita de la lista
      if (err?.response?.status !== 404) {
        toast(apiErrorMessage(err, 'No se pudo eliminar el análisis.'), 'error')
        return
      }
    }
    onHistoryChange?.(history.filter((i) => i.id !== item.id))
    if (detailId === item.id) setDetailId(null)
    toast('Análisis eliminado')
  }

  const clearAll = async () => {
    const ok = await confirm({
      title: '¿Eliminar todo el historial?',
      message: `Se borrarán los ${history.length} análisis por planta. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar todo',
    })
    if (!ok) return
    const results = await Promise.allSettled(history.map((i) => deleteAnalisis(i.id)))
    const failed = new Set(history
      .filter((_, idx) => results[idx].status === 'rejected' && results[idx].reason?.response?.status !== 404)
      .map((i) => i.id))
    onHistoryChange?.(history.filter((i) => failed.has(i.id)))
    setFiltersOpen(false)
    if (failed.size) toast(`No se pudieron eliminar ${plural(failed.size, 'análisis', 'análisis')}.`, 'error')
    else toast('Historial eliminado')
  }

  const exportPdf = async (item) => {
    setExportingId(item.id)
    try {
      await exportAnalisisPDF({
        diseaseLabel: diseaseMeta(item.enfermedad).label,
        affectedPercent: affectedOf(item),
        severity: item.severidad,
        fecha: item.fecha,
        originalImg: item.imagen ?? null,
        xaiImg: item.xaiImage ?? null,
        recommendations: recommendationsFor(item.enfermedad),
      })
    } catch {
      toast('No se pudo generar el PDF.', 'error')
    } finally {
      setExportingId(null)
    }
  }

  const copySummary = async (item) => {
    const meta = diseaseMeta(item.enfermedad)
    const recs = recommendationsFor(item.enfermedad)
    const text = [
      `Diagnóstico: ${meta.label}`,
      `Severidad: ${item.severidad}`,
      `Área afectada: ${fmtPct(affectedOf(item))}`,
      `Fecha: ${fmtDateTime(item.fecha)}`,
      recs.length ? `Recomendaciones: ${recs.map((r) => r.title).join('; ')}` : null,
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('Resumen copiado al portapapeles')
    } catch {
      toast('No se pudo copiar el resumen.', 'error')
    }
  }

  const menuFor = (item) => [
    { label: 'Ver detalle', Icon: IcoEye, onClick: () => setDetailId(item.id) },
    { label: 'Exportar PDF', Icon: IcoPdf, onClick: () => exportPdf(item), disabled: exportingId === item.id },
    { label: 'Copiar resumen', Icon: IcoCopy, onClick: () => copySummary(item) },
    { label: 'Eliminar', Icon: IcoTrash, onClick: () => removeItem(item), danger: true },
  ]

  const detailItem = detailId ? history.find((i) => i.id === detailId) : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <KpiCard
          icon={IcoChart}
          value={stats.total}
          label="Total de análisis"
          series={stats.seriesTotal}
          onClick={() => setEstado('todos')}
          title="Análisis por semana (últimas 8 semanas)"
        />
        <KpiCard
          icon={IcoLeaf}
          value={stats.healthy}
          label="Cultivos sanos"
          series={stats.seriesHealthy}
          tone="teal"
          active={estado === 'Sano'}
          onClick={() => setEstado(estado === 'Sano' ? 'todos' : 'Sano')}
          title="Mostrar solo cultivos sanos"
        />
        <KpiCard
          icon={IcoTriangle}
          value={stats.sick}
          label="Con enfermedad"
          series={stats.seriesSick}
          tone="red"
          active={estado === 'Con enfermedad'}
          onClick={() => setEstado(estado === 'Con enfermedad' ? 'todos' : 'Con enfermedad')}
          title="Mostrar solo análisis con enfermedad"
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar por enfermedad, fecha o severidad…" />
          <FiltersButton open={filtersOpen} count={activeFilters} onClick={() => setFiltersOpen((o) => !o)} />
        </div>

        {filtersOpen && (
          <div className={`${GLASS} fade-in grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto]`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilterGroup label="Estado">
                {[['todos', 'Todos'], ['Sano', 'Sanos'], ['Con enfermedad', 'Con enfermedad']].map(([id, label]) => (
                  <Pill key={id} active={estado === id} onClick={() => setEstado(id)}>{label}</Pill>
                ))}
              </FilterGroup>
              <FilterGroup label="Severidad">
                {[['todas', 'Todas'], ['Leve', 'Leve'], ['Moderada', 'Moderada'], ['Grave', 'Grave']].map(([id, label]) => (
                  <Pill key={id} active={severity === id} onClick={() => setSeverity(id)}>{label}</Pill>
                ))}
              </FilterGroup>
              <div className="sm:col-span-2">
                <FilterGroup label="Fecha del análisis">
                  <DateField label="Desde" value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
                  <DateField label="Hasta" value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
                </FilterGroup>
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 lg:flex-col lg:items-end">
              <button type="button" onClick={resetFilters} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
                Limpiar filtros
              </button>
              {history.length > 0 && (
                <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 dark:text-red-400">
                  <IcoTrash className="h-4 w-4" /> Eliminar todo el historial
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <DiseaseChips value={disease} onChange={setDisease} allLabel="Todos" />
          <SortSelect value={sort} onChange={setSort} options={PLANT_SORTS} />
        </div>
      </div>

      <div ref={listRef} className="scroll-mt-24">
        {history.length === 0 ? (
          <EmptyState
            icon={IcoLeaf}
            title="Aún no hay análisis por planta"
            text="Sube una foto de tu cultivo y el diagnóstico aparecerá aquí con su severidad y recomendaciones."
            action={onGoAnalizar && (
              <button type="button" onClick={() => onGoAnalizar('individual')} className={BTN.primary}>
                <IcoScan className="h-4 w-4" /> Analizar una imagen
              </button>
            )}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={IcoSearch}
            title="Sin resultados"
            text="No hay análisis que coincidan con la búsqueda o los filtros seleccionados."
            action={<button type="button" onClick={resetFilters} className={BTN.secondary}>Limpiar filtros</button>}
          />
        ) : (
          <ul className="space-y-3">
            {paged.items.map((item) => (
              <AnalysisRow key={item.id} item={item} onOpen={() => setDetailId(item.id)} menuItems={menuFor(item)} />
            ))}
          </ul>
        )}
      </div>

      <Pagination paged={paged} onPage={goToPage} />

      {detailItem && (
        <AnalysisDetail
          item={detailItem}
          exporting={exportingId === detailItem.id}
          onClose={() => setDetailId(null)}
          onExport={() => exportPdf(detailItem)}
          onCopy={() => copySummary(detailItem)}
          onDelete={() => removeItem(detailItem)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//    Análisis por parcela completa
// ══════════════════════════════════════════════════════════════════════════════
const sampleColor = (s) => (s.result ? SEVERITY_PALETTE[severityOf(s.result.target_class, s.result.confidence)] : '#94a3b8')

// Silueta de la parcela (sin teselas de mapa) con sus puntos de muestreo
function ParcelShape({ vertices, samples, className = 'h-14 w-14 sm:h-16 sm:w-16' }) {
  const gridId = `grid${useId().replace(/:/g, '')}`
  const shape = useMemo(() => {
    if (!vertices?.length) return null
    const lats = vertices.map((v) => v.lat)
    const lngs = vertices.map((v) => v.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180) // la longitud se encoge con la latitud
    const spanX = (Math.max(...lngs) - minLng) * kx
    const spanY = maxLat - minLat
    const span = Math.max(spanX, spanY) || 1e-9
    const pad = 14
    const size = 100 - pad * 2
    const offX = (size - (spanX / span) * size) / 2
    const offY = (size - (spanY / span) * size) / 2
    const project = (lat, lng) => [pad + offX + (((lng - minLng) * kx) / span) * size, pad + offY + ((maxLat - lat) / span) * size]
    const path = `${vertices.map((v, i) => {
      const [x, y] = project(v.lat, v.lng)
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')} Z`
    const dots = (samples ?? []).filter((s) => s.result && s.coords).map((s) => {
      const [x, y] = project(s.coords[1], s.coords[0])
      return { x, y, color: sampleColor(s) }
    })
    return { path, dots }
  }, [vertices, samples])

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-[#062a1f] ring-1 ring-emerald-500/25 ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <defs>
          <pattern id={gridId} width="12.5" height="12.5" patternUnits="userSpaceOnUse">
            <path d="M12.5 0H0V12.5" fill="none" stroke="rgba(52,211,153,0.16)" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#${gridId})`} />
        {shape && <path d={shape.path} fill="rgba(16,185,129,0.22)" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" />}
        {shape?.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="4.2" fill={d.color} stroke="#062a1f" strokeWidth="1.5" />)}
      </svg>
    </div>
  )
}

function ParcelRow({ summary, onOpen, menuItems }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const last = summary.lastVisit
  const stats = last?.stats ?? null
  const sev = stats ? lotSeverity(stats.avgAff) : null
  const dis = visitDisease(last)
  const prev = summary.visits[1]
  const delta = last && prev ? Number((last.stats.avgAff - prev.stats.avgAff).toFixed(1)) : null
  const sick = stats ? sickZones(stats) : 0
  const description = stats
    ? `${plural(stats.total, 'zona muestreada', 'zonas muestreadas')} · ${sick > 0 ? `${sick} con síntomas, predomina ${dis.short}` : 'sin síntomas en ninguna zona'}`
    : 'Parcela delimitada, aún sin visitas analizadas.'

  return (
    <li className={`relative ${menuOpen ? 'z-20' : ''} ${ROW}`}>
      <div className="flex items-center gap-3 lg:gap-4">
        <ParcelShape vertices={summary.vertices} samples={last?.samples} />
        <div className="min-w-0 flex-1 xl:w-56 xl:flex-none">
          <p className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dis?.color ?? '#94a3b8' }} />
            <span className="truncate">{summary.nombre}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <IcoCalendar className="h-3.5 w-3.5 shrink-0" />
            {last ? fmtDateTime(last.fecha) : `Creada el ${fmtDate(summary.createdAt)}`}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">{summary.ha} ha · {plural(summary.visits.length, 'visita', 'visitas')}</p>
        </div>
        <div className="hidden h-10 w-px shrink-0 bg-slate-200 xl:block dark:bg-white/10" />
        <p className="hidden min-w-0 flex-1 text-sm leading-snug text-slate-600 xl:block dark:text-slate-300">{description}</p>
        <div className="hidden lg:block">
          <SeverityBadge level={sev} className="min-w-[10.5rem]" />
        </div>
        <AffectedValue value={stats?.avgAff ?? null} caption="promedio" delta={delta} />
        <div className="hidden lg:block">
          <DetailButton onClick={onOpen} />
        </div>
        <RowMenu items={menuItems} onOpenChange={setMenuOpen} />
      </div>
      <div className="mt-3 space-y-3 lg:hidden">
        <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
        <div className="flex items-center justify-between gap-3">
          <SeverityBadge level={sev} />
          <DetailButton onClick={onOpen} />
        </div>
      </div>
    </li>
  )
}

// ── Mini mapa de una visita ───────────────────────────────────────────────────
function makeParcelMarker(sample) {
  const num = sample.label.replace('P', '')
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${sampleColor(sample)};border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:900;">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function FitBounds({ vertices }) {
  const map = useMap()
  useEffect(() => {
    if (!vertices?.length) return
    map.fitBounds(L.latLngBounds(vertices), { padding: [20, 20], maxZoom: 18 })
  }, [map, vertices])
  return null
}

function SampleResult({ sample }) {
  if (!sample?.result) return <span className="text-slate-300 dark:text-slate-600">—</span>
  const meta = diseaseMeta(sample.result.target_class)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sampleColor(sample) }} />
      <span className="text-slate-600 dark:text-slate-300">{meta.short}</span>
      <span className="font-extrabold text-slate-900 dark:text-white">{fmtPct(sample.result.confidence)}</span>
    </span>
  )
}

function VisitCard({ record, onDelete }) {
  const [open, setOpen] = useState(false)
  const { fecha, stats, samples, vertices } = record
  const sev = lotSeverity(stats.avgAff)
  const dis = visitDisease(record)
  const sick = sickZones(stats)
  return (
    <div className={ROW}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
          <IcoCalendar className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white">{fmtDateTime(fecha)}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {plural(stats.total, 'muestra', 'muestras')} · {sick > 0 ? `${sick} con síntomas, predomina ${dis.short}` : 'sin síntomas'}
          </p>
        </div>
        <div className="hidden sm:block">
          <SeverityBadge level={sev} />
        </div>
        <span className="w-14 text-right text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{fmtPct(stats.avgAff)}</span>
        <IcoChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="fade-in mt-3 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[16rem_1fr] dark:border-white/10">
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10" style={{ height: 220 }}>
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
              <TileLayer attribution="&copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <FitBounds vertices={vertices} />
              <Polygon positions={vertices} pathOptions={{ color: '#34d399', fillColor: '#10b981', fillOpacity: 0.15, weight: 2 }} />
              {samples.filter((s) => s.result).map((s) => (
                <Marker key={s.id} position={[s.coords[1], s.coords[0]]} icon={makeParcelMarker(s)}>
                  <Tooltip direction="top" offset={[0, -14]}>
                    <span className="text-[10px] font-bold">{s.label} — {diseaseMeta(s.result.target_class).short} {fmtPct(s.result.confidence)}</span>
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-4 py-2.5 font-semibold">Zona</th>
                  <th className="px-4 py-2.5 font-semibold">Diagnóstico</th>
                  <th className="px-4 py-2.5 font-semibold">Severidad</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-200">{s.label}</td>
                    <td className="px-4 py-2"><SampleResult sample={s} /></td>
                    <td className="px-4 py-2">
                      {s.result
                        ? <span className="font-semibold" style={{ color: sampleColor(s) }}>{severityOf(s.result.target_class, s.result.confidence)}</span>
                        : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end lg:col-span-2">
            <button type="button" onClick={onDelete} className={BTN.danger}>
              <IcoTrash className="h-4 w-4" /> Eliminar visita
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TrendLineChart({ visits }) {
  const gradId = `trend${useId().replace(/:/g, '')}`
  const w = 560
  const h = 180
  const left = 34
  const right = 14
  const top = 14
  const bottom = 28
  const chrono = [...visits].reverse()
  const n = chrono.length
  const max = Math.max(...chrono.map((v) => v.stats.avgAff), SEVERITY_LIMITS.grave + 5)
  const x = (i) => (n <= 1 ? (left + w - right) / 2 : left + (i / (n - 1)) * (w - left - right))
  const y = (v) => top + (1 - v / max) * (h - top - bottom)
  const line = chrono.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v.stats.avgAff).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${h - bottom} L${x(0).toFixed(1)} ${h - bottom} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Evolución de la afectación promedio por visita">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[SEVERITY_LIMITS.moderada, SEVERITY_LIMITS.grave].map((t) => (
        <g key={t}>
          <line x1={left} x2={w - right} y1={y(t)} y2={y(t)} strokeDasharray="4 4" className="stroke-slate-300 dark:stroke-white/15" />
          <text x={left - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 9, fontWeight: 600 }}>{t}%</text>
        </g>
      ))}
      <line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} className="stroke-slate-200 dark:stroke-white/10" />
      {n > 1 && <path d={area} fill={`url(#${gradId})`} />}
      <path d={line} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {chrono.map((v, i) => (
        <g key={v.id}>
          <circle cx={x(i)} cy={y(v.stats.avgAff)} r="5" fill={SEVERITY_PALETTE[lotSeverity(v.stats.avgAff)]} strokeWidth="2" className="stroke-white dark:stroke-[#0d1726]" />
          <text x={x(i)} y={h - 9} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 9, fontWeight: 600 }}>
            {new Date(v.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          </text>
        </g>
      ))}
    </svg>
  )
}

function ParcelaDashboard({ summary, onBack, onChanged, onAnalizarDeNuevo, confirm, toast }) {
  const { visits } = summary
  const [renaming, setRenaming] = useState(false)
  const chrono = [...visits].reverse()
  const last = visits[0]
  const prev = visits[1]
  const delta = last && prev ? Number((last.stats.avgAff - prev.stats.avgAff).toFixed(1)) : null
  const sev = last ? lotSeverity(last.stats.avgAff) : null
  const zoneRows = (last?.samples ?? []).map((s) => ({
    label: s.label,
    cells: chrono.map((v) => v.samples.find((x) => x.label === s.label) ?? null),
  }))

  const saveName = (nombre) => {
    renameParcela(summary.id, nombre)
    setRenaming(false)
    onChanged()
    toast('Parcela renombrada')
  }

  const removeParcela = async () => {
    const ok = await confirm({
      title: `¿Eliminar "${summary.nombre}"?`,
      message: `Se borrarán la parcela y sus ${plural(visits.length, 'visita', 'visitas')}. Esta acción no se puede deshacer.`,
    })
    if (!ok) return
    deleteParcela(summary.id)
    onChanged()
    onBack()
    toast('Parcela eliminada')
  }

  const removeVisit = async (visit) => {
    const ok = await confirm({
      title: '¿Eliminar esta visita?',
      message: `Se borrará la visita del ${fmtDate(visit.fecha)}. Esta acción no se puede deshacer.`,
    })
    if (!ok) return
    deleteParcelVisit(visit.id)
    onChanged()
    toast('Visita eliminada')
  }

  const deltaText = delta == null ? '—' : delta === 0 ? 'Sin cambio' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} pts`
  const deltaClass = delta > 0 ? 'text-red-600 dark:text-red-400' : delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'

  return (
    <div className="fade-in space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300">
        <IcoChevronLeft className="h-4 w-4" /> Todas las parcelas
      </button>

      <section className={`${GLASS} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center gap-4">
          <ParcelShape vertices={summary.vertices} samples={last?.samples} className="h-20 w-20" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">{summary.nombre}</h2>
              <button type="button" aria-label="Renombrar parcela" onClick={() => setRenaming(true)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200">
                <IcoPencil className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {summary.ha} ha · {plural(summary.sampleCount, 'punto de muestreo', 'puntos de muestreo')} · {plural(visits.length, 'visita', 'visitas')}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onAnalizarDeNuevo} className={BTN.primary}>
              <IcoScan className="h-4 w-4" /> Analizar de nuevo
            </button>
            <button type="button" aria-label="Eliminar parcela" onClick={removeParcela} className={`${BTN.danger} px-3`}>
              <IcoTrash className="h-4 w-4" />
            </button>
          </div>
        </div>

        {last && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Afectación actual" value={fmtPct(last.stats.avgAff)} />
            <Metric label="Severidad" value={sev} />
            <Metric label="Cambio vs. anterior" value={deltaText} valueClass={deltaClass} />
            <Metric label="Zonas con síntomas" value={`${sickZones(last.stats)} / ${last.stats.total}`} />
          </div>
        )}
      </section>

      {visits.length === 0 ? (
        <EmptyState
          icon={IcoMap}
          title="Todavía no hay visitas registradas"
          text="Analiza las zonas de muestreo de esta parcela para ver aquí su evolución."
          action={<button type="button" onClick={onAnalizarDeNuevo} className={BTN.primary}><IcoScan className="h-4 w-4" /> Analizar parcela</button>}
        />
      ) : (
        <>
          <section className={`${GLASS} p-5 sm:p-6`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evolución de la afectación promedio</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Las líneas punteadas marcan los umbrales de severidad moderada y grave</p>
              </div>
              {delta != null && (
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  delta < 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                    : delta > 0 ? 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                }`}
                >
                  {delta === 0 ? 'Sin cambio vs. visita anterior' : `${delta < 0 ? 'Mejoró' : 'Empeoró'} ${Math.abs(delta)} pts vs. visita anterior`}
                </span>
              )}
            </div>
            <TrendLineChart visits={visits} />
          </section>

          {chrono.length > 1 && (
            <section className={`${GLASS} overflow-hidden`}>
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Comparación por zona</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cómo cambió cada punto de muestreo entre visitas</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="px-5 py-3 font-semibold">Zona</th>
                      {chrono.map((v) => <th key={v.id} className="whitespace-nowrap px-4 py-3 font-semibold">{fmtDate(v.fecha)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {zoneRows.map((row) => (
                      <tr key={row.label} className="border-t border-slate-100 dark:border-white/5">
                        <td className="px-5 py-2.5 font-bold text-slate-700 dark:text-slate-200">{row.label}</td>
                        {row.cells.map((cell, j) => <td key={j} className="px-4 py-2.5"><SampleResult sample={cell} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Historial de visitas</h3>
            {visits.map((v) => <VisitCard key={v.id} record={v} onDelete={() => removeVisit(v)} />)}
          </section>
        </>
      )}

      {renaming && <RenameDialog initial={summary.nombre} onCancel={() => setRenaming(false)} onSave={saveName} />}
    </div>
  )
}

const PARCEL_SORTS = [
  { id: 'recientes', label: 'Actividad reciente' },
  { id: 'mayor', label: 'Mayor afectación' },
  { id: 'nombre', label: 'Nombre (A–Z)' },
  { id: 'hectareas', label: 'Más hectáreas' },
]

function ParcelHistory({ summaries, onChanged, onGoAnalizarParcela, onGoAnalizar, confirm, toast }) {
  const [selectedId, setSelectedId] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [disease, setDisease] = useState('todos')
  const [estado, setEstado] = useState('todas')
  const [severity, setSeverity] = useState('todas')
  const [sort, setSort] = useState('recientes')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const listRef = useRef(null)

  const stats = useMemo(() => {
    const affected = summaries.filter((p) => p.lastVisit && lotSeverity(p.lastVisit.stats.avgAff) !== 'Sano')
    return {
      total: summaries.length,
      ha: summaries.reduce((a, p) => a + (Number(p.ha) || 0), 0),
      visits: summaries.reduce((a, p) => a + p.visits.length, 0),
      affected: affected.length,
      seriesVisits: weeklySeries(summaries.flatMap((p) => p.visits.map((v) => v.fecha))),
      seriesAffected: weeklySeries(affected.map((p) => p.lastVisit.fecha)),
    }
  }, [summaries])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const list = summaries.filter((p) => {
      const sev = p.lastVisit ? lotSeverity(p.lastVisit.stats.avgAff) : null
      if (disease !== 'todos' && visitDisease(p.lastVisit)?.key !== disease) return false
      if (estado === 'afectadas' && (!sev || sev === 'Sano')) return false
      if (estado === 'sanas' && sev !== 'Sano') return false
      if (severity !== 'todas' && sev !== severity) return false
      return !q || normalize(p.nombre).includes(q)
    })
    const activity = (p) => new Date(p.lastVisit?.fecha ?? p.createdAt).getTime()
    const avg = (p) => p.lastVisit?.stats.avgAff ?? -1
    const sorters = {
      recientes: (a, b) => activity(b) - activity(a),
      mayor: (a, b) => avg(b) - avg(a) || activity(b) - activity(a),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      hectareas: (a, b) => (Number(b.ha) || 0) - (Number(a.ha) || 0),
    }
    return [...list].sort(sorters[sort] ?? sorters.recientes)
  }, [summaries, query, disease, estado, severity, sort])

  const paged = usePaged(filtered, [query, disease, estado, severity, sort].join('|'))
  const activeFilters = (estado !== 'todas') + (severity !== 'todas')

  const resetFilters = () => {
    setQuery('')
    setDisease('todos')
    setEstado('todas')
    setSeverity('todas')
  }

  const goToPage = (p) => {
    paged.setPage(p)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const removeParcela = async (p) => {
    const ok = await confirm({
      title: `¿Eliminar "${p.nombre}"?`,
      message: `Se borrarán la parcela y sus ${plural(p.visits.length, 'visita', 'visitas')}. Esta acción no se puede deshacer.`,
    })
    if (!ok) return
    deleteParcela(p.id)
    onChanged()
    toast('Parcela eliminada')
  }

  const saveName = (nombre) => {
    renameParcela(renameTarget.id, nombre)
    setRenameTarget(null)
    onChanged()
    toast('Parcela renombrada')
  }

  const selected = selectedId ? summaries.find((s) => s.id === selectedId) : null
  if (selected) {
    return (
      <ParcelaDashboard
        summary={selected}
        onBack={() => setSelectedId(null)}
        onChanged={onChanged}
        onAnalizarDeNuevo={() => onGoAnalizarParcela?.(selected.id)}
        confirm={confirm}
        toast={toast}
      />
    )
  }

  const menuFor = (p) => [
    { label: 'Ver detalle', Icon: IcoEye, onClick: () => setSelectedId(p.id) },
    { label: 'Analizar de nuevo', Icon: IcoScan, onClick: () => onGoAnalizarParcela?.(p.id) },
    { label: 'Renombrar', Icon: IcoPencil, onClick: () => setRenameTarget(p) },
    { label: 'Eliminar', Icon: IcoTrash, onClick: () => removeParcela(p), danger: true },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <KpiCard
          icon={IcoMap}
          value={stats.total}
          label="Total de parcelas"
          series={stats.seriesVisits}
          onClick={() => setEstado('todas')}
          title={`${plural(stats.visits, 'visita registrada', 'visitas registradas')} · tendencia semanal (últimas 8 semanas)`}
        />
        <KpiCard icon={IcoLayers} value={stats.ha.toFixed(1)} label="Hectáreas monitoreadas" tone="teal" />
        <KpiCard
          icon={IcoTriangle}
          value={stats.affected}
          label="Con afectación"
          series={stats.seriesAffected}
          tone="red"
          active={estado === 'afectadas'}
          onClick={() => setEstado(estado === 'afectadas' ? 'todas' : 'afectadas')}
          title="Mostrar solo parcelas con afectación en su última visita"
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar parcela por nombre…" />
          <FiltersButton open={filtersOpen} count={activeFilters} onClick={() => setFiltersOpen((o) => !o)} />
        </div>

        {filtersOpen && (
          <div className={`${GLASS} fade-in flex flex-col gap-5 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FilterGroup label="Estado de la última visita">
                {[['todas', 'Todas'], ['sanas', 'Sanas'], ['afectadas', 'Con afectación']].map(([id, label]) => (
                  <Pill key={id} active={estado === id} onClick={() => setEstado(id)}>{label}</Pill>
                ))}
              </FilterGroup>
              <FilterGroup label="Severidad del lote">
                {[['todas', 'Todas'], ['Leve', 'Leve'], ['Moderada', 'Moderada'], ['Grave', 'Grave']].map(([id, label]) => (
                  <Pill key={id} active={severity === id} onClick={() => setSeverity(id)}>{label}</Pill>
                ))}
              </FilterGroup>
            </div>
            <button type="button" onClick={resetFilters} className="self-start text-sm font-semibold text-emerald-700 hover:text-emerald-800 sm:self-end dark:text-emerald-400">
              Limpiar filtros
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <DiseaseChips value={disease} onChange={setDisease} allLabel="Todas" />
          <SortSelect value={sort} onChange={setSort} options={PARCEL_SORTS} />
        </div>
      </div>

      <div ref={listRef} className="scroll-mt-24">
        {summaries.length === 0 ? (
          <EmptyState
            icon={IcoMap}
            title="Aún no tienes parcelas"
            text="Dibuja tu lote en el mapa y analiza sus puntos de muestreo para seguir su evolución visita a visita."
            action={onGoAnalizar && (
              <button type="button" onClick={() => onGoAnalizar('parcela')} className={BTN.primary}>
                <IcoMap className="h-4 w-4" /> Analizar una parcela
              </button>
            )}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={IcoSearch}
            title="Sin resultados"
            text="Ninguna parcela coincide con la búsqueda o los filtros seleccionados."
            action={<button type="button" onClick={resetFilters} className={BTN.secondary}>Limpiar filtros</button>}
          />
        ) : (
          <ul className="space-y-3">
            {paged.items.map((p) => (
              <ParcelRow key={p.id} summary={p} onOpen={() => setSelectedId(p.id)} menuItems={menuFor(p)} />
            ))}
          </ul>
        )}
      </div>

      <Pagination paged={paged} onPage={goToPage} />

      {renameTarget && <RenameDialog initial={renameTarget.nombre} onCancel={() => setRenameTarget(null)} onSave={saveName} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//    Página
// ══════════════════════════════════════════════════════════════════════════════
// La pestaña la elige el submenú "Historial" de la barra lateral (App.jsx)
export default function Historial({ history = [], onHistoryChange, tab = 'individual', onGoAnalizarParcela, onGoAnalizar }) {
  const [summaries, setSummaries] = useState(() => getParcelaSummaries())
  const [confirm, confirmDialog] = useConfirm()
  const [toast, toastNode] = useToast()

  const refreshParcelas = useCallback(() => setSummaries(getParcelaSummaries()), [])

  // Otra pestaña puede terminar un análisis de parcela mientras esta está abierta
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || e.key === PARCELAS_KEY || e.key === PARCEL_HISTORY_KEY) refreshParcelas()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refreshParcelas])

  return (
    <div className="fade-up relative isolate space-y-5">
      <PageGlow />
      <PageHero title="Historial" {...(HERO_COPY[tab] ?? HERO_COPY.individual)} />

      {tab !== 'parcelas' ? (
        <PlantHistory history={history} onHistoryChange={onHistoryChange} onGoAnalizar={onGoAnalizar} confirm={confirm} toast={toast} />
      ) : (
        <ParcelHistory
          summaries={summaries}
          onChanged={refreshParcelas}
          onGoAnalizarParcela={onGoAnalizarParcela}
          onGoAnalizar={onGoAnalizar}
          confirm={confirm}
          toast={toast}
        />
      )}

      {confirmDialog}
      {toastNode}
    </div>
  )
}
