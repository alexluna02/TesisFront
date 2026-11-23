import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PageGlow } from './PageHero.jsx'
import { apiErrorMessage, deleteAnalisis } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import {
  getParcelaSummaries, renameParcela, deleteParcela, deleteParcelVisit, PARCELAS_KEY, PARCEL_HISTORY_KEY, PARCEL_TITLE,
} from './AnalizarParcela.jsx'
import { CHEMICAL_TREATMENTS, FittedImage, TreatmentDetails, TURBO, ZoomOverlay, ZoomTrigger } from './Analizar.jsx'
import ParcelMiniMap from './ParcelMiniMap.jsx'
import SeverityScale from './SeverityScale.jsx'
import { SEVERITY_LIMITS, SEVERITY_PALETTE, isHealthyClass, lotSeverity, severityOf } from './severity.js'
import { diseaseKey, diseaseMeta, recommendationsFor } from './diseases.js'
import { RESULT_STYLE, SEVERITY_CHIP, resultColor, resultKeyOf, visitResultKey } from './resultados.js'
import { useTheme } from './ThemeContext.jsx'
import heroHistorial from './Imagenes/historial-hero.webp'
import maizRecs from './Imagenes/historial-maiz.webp'
import inicioHojas from './Imagenes/inicio-hojas.png'
import mazorca from './Imagenes/inicio-mazorca.png'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ══════════════════════════════════════════════════════════════════════════════
//    Estilos y utilidades (medidas a la escala en que el usuario ve las maquetas 19 y 20)
// ══════════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = 5
const DAY_MS = 86400000
const WEEK_MS = 7 * DAY_MS

const CARD = 'rounded-2xl border border-[#e6ecf0] bg-white shadow-[0_8px_24px_-18px_rgba(15,40,30,0.35)] dark:border-[#1e3048] dark:bg-[#162032]'
const MINT = 'rounded-[14px] border border-[#d6ecdf] bg-linear-to-br from-[#f2faf5] to-[#e4f3ea] dark:border-[#1f3a33] dark:from-[#13261f] dark:to-[#11231d]'
const PLAIN = 'rounded-[14px] border border-[#e6ecf0] bg-white dark:border-[#1e3048] dark:bg-[#162032]'
const SOFT = 'rounded-[14px] border border-[#e3e9ef] bg-linear-to-br from-[#f8fafc] to-[#eef3f6] dark:border-[#1e3048] dark:from-[#162032] dark:to-[#141d2e]'
const MUTED = 'text-[#55607a] dark:text-slate-400'
const H3 = `text-[12.5px] ${PARCEL_TITLE}`
const PILL_BTN = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-[#e3e8ee] bg-white text-[11px] font-semibold text-[#0b1226] shadow-[0_2px_6px_-4px_rgba(15,23,42,0.3)] transition hover:border-[#bfe3c9] hover:bg-[#f6fbf8] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:hover:bg-white/10'
const ROUND_BTN = 'grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full border border-[#e3e8ee] bg-white text-[#1f2d48] shadow-[0_2px_6px_-4px_rgba(15,23,42,0.35)] transition hover:border-[#bfe3c9] hover:text-[#0b6b35] disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:text-emerald-300'
const BTN = {
  primary: 'inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60',
  secondary: 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10',
  dangerSolid: 'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700',
}

const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const fmtDateTime = (iso) => `${fmtDate(iso)} • ${fmtTime(iso)}`
const fmtLong = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtShort = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }).replace('.', '')
const fmtPct = (v) => {
  const n = Number(v) || 0
  return `${n > 0 && n < 10 ? n.toFixed(1) : Math.round(n)}%`
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const agoLabel = (iso) => {
  const d = Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / DAY_MS))
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Ayer'
  if (d < 14) return `Hace ${d} días`
  if (d < 60) return `Hace ${Math.round(d / 7)} semanas`
  return `Hace ${Math.round(d / 30)} meses`
}
const affectedOf = (item) => Number(item.affectedPercent ?? (item.confianza ?? 0) * 100) || 0
const itemKey = (item) => resultKeyOf(item.enfermedad, item.estado === 'Sano')

const RESULT_DESC = {
  sano: 'Sin síntomas en la hoja',
  tizon: 'Presencia de tizón en la hoja',
  roya: 'Presencia de roya en la hoja',
  mancha: 'Presencia de mancha blanca',
  otro: 'Resultado sin clasificar',
}
// Color del nombre del resultado en el detalle (texto grande legible sobre la tarjeta)
const RESULT_TITLE = {
  sano: 'text-[#0b7a5c] dark:text-[#5fd3ad]',
  tizon: 'text-[#5c3a21] dark:text-[#d2b193]',
  roya: 'text-[#c4521d] dark:text-[#f59366]',
  mancha: 'text-[#86682b] dark:text-[#e3cf9c]',
  otro: 'text-slate-700 dark:text-slate-200',
}
// Color con el que «Análisis individual» pinta la zona detectada en la imagen de salida
const DETECTION_COLOR = { tizon: '#f97316', roya: '#f59e0b', mancha: '#ef4444' }
const CLASS_OF_KEY = { sano: 'Fondo', tizon: 'Tizon', roya: 'Roya', mancha: 'Mancha_blanca' }
const SEV_ICON = { Sano: 'text-emerald-600', Leve: 'text-lime-600', Moderada: 'text-[#f59e0b]', Grave: 'text-red-500' }

// Valores por semana de las últimas `weeks` semanas (la más reciente al final). En modo «mean»
// las semanas sin datos repiten el último promedio conocido para no dibujar caídas a cero.
function weeklySeries(points, mode = 'count', weeks = 8) {
  const sum = Array(weeks).fill(0)
  const n = Array(weeks).fill(0)
  const now = Date.now()
  points.forEach(({ date, value = 1 }) => {
    const age = Math.floor((now - new Date(date).getTime()) / WEEK_MS)
    if (age < 0 || age >= weeks) return
    sum[weeks - 1 - age] += value
    n[weeks - 1 - age] += 1
  })
  if (mode !== 'mean') return sum
  const means = sum.map((s, i) => (n[i] ? s / n[i] : null))
  let last = means.find((v) => v != null) ?? 0
  return means.map((v) => {
    if (v != null) last = v
    return last
  })
}

const PERIODS = [
  { id: '7', label: 'Últimos 7 días', days: 7 },
  { id: '30', label: 'Últimos 30 días', days: 30 },
  { id: '90', label: 'Últimos 90 días', days: 90 },
  { id: 'todo', label: 'Todo el historial' },
]

function dateFilter(period, from, to) {
  if (period === 'rango') {
    const f = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity
    const t = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity
    return (iso) => {
      const ts = new Date(iso).getTime()
      return ts >= f && ts <= t
    }
  }
  const days = PERIODS.find((p) => p.id === period)?.days
  if (!days) return () => true
  const since = Date.now() - days * DAY_MS
  return (iso) => new Date(iso).getTime() >= since
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

// Menús desplegables: se cierran con clic fuera o Escape (Escape no llega al diálogo de detrás)
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      ref.current?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  return [open, setOpen, ref]
}

// ══════════════════════════════════════════════════════════════════════════════
//    Iconos
// ══════════════════════════════════════════════════════════════════════════════
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Svg>
const IcoFilter = (p) => <Svg {...p}><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></Svg>
const IcoChevronDown = (p) => <Svg {...p}><path d="m6 9 6 6 6-6"/></Svg>
const IcoChevronLeft = (p) => <Svg {...p}><path d="m15 18-6-6 6-6"/></Svg>
const IcoChevronRight = (p) => <Svg {...p}><path d="m9 18 6-6-6-6"/></Svg>
const IcoCalendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></Svg>
const IcoClock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Svg>
const IcoEye = (p) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Svg>
const IcoDownload = (p) => <Svg {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></Svg>
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>
const IcoImage = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 16-5-5-9 9"/></Svg>
const IcoMore = (p) => <Svg {...p}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></Svg>
const IcoTrash = (p) => <Svg {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></Svg>
const IcoCopy = (p) => <Svg {...p}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></Svg>
const IcoPencil = (p) => <Svg {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></Svg>
const IcoScan = (p) => <Svg {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></Svg>
const IcoFlame = (p) => <Svg {...p}><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.3-4.8.3 1.6 1 2.6 2.2 3.1C11 9 11 6 12 3Z"/></Svg>
const IcoBulb = (p) => <Svg {...p}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V17h5v-1.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/></Svg>
const IcoPin = (p) => <Svg {...p}><path d="M12 21s7-5.6 7-11.5A7 7 0 0 0 5 9.5C5 15.4 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></Svg>
const IcoCrosshair = (p) => <Svg {...p}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></Svg>
const IcoMap = (p) => <Svg {...p}><path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></Svg>
const IcoPulse = (p) => <Svg {...p}><path d="M2 12h4l2.5-6 4 13 3-9 1.5 2H22"/></Svg>
const IcoSprout = (p) => <Svg {...p}><path d="M12 21v-9"/><path d="M12 12c0-4.5-3-7-8-7 0 4.5 3 7 8 7Z"/><path d="M12 14c0-4 2.6-6.5 8-6.5 0 4-2.6 6.5-8 6.5Z"/></Svg>
const IcoChart = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Svg>
const IcoTrend = (p) => <Svg {...p}><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></Svg>
const IcoList = (p) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></Svg>
const IcoCorn = (p) => <Svg {...p}><path d="M12 3c2 1.6 3 4 3 7s-1 5.4-3 7c-2-1.6-3-4-3-7s1-5.4 3-7Z"/><path d="M12 17v4"/><path d="M5 11c2.5.4 4.6 2 5.6 4.6M19 11c-2.5.4-4.6 2-5.6 4.6"/><path d="M10 8h4M9.6 11h4.8M10 14h4"/></Svg>
const IcoPlantPot = (p) => <Svg {...p}><path d="M7 14h10l-1.5 7h-7z"/><path d="M12 14V9"/><path d="M12 9c0-3-2-5-5-5 0 3 2 5 5 5Z"/><path d="M12 10c0-2.6 1.7-4.3 5-4.3 0 2.6-1.7 4.3-5 4.3Z"/></Svg>
const IcoLotus = (p) => <Svg {...p}><path d="M12 20c-3.8 0-7-2.6-7.8-6.2 2.4-.2 4.6.6 6.1 2.1"/><path d="M12 20c3.8 0 7-2.6 7.8-6.2-2.4-.2-4.6.6-6.1 2.1"/><path d="M12 20c-2.2-1.8-3.4-4.3-3.4-7S9.8 7.6 12 5.6c2.2 2 3.4 4.6 3.4 7.4S14.2 18.2 12 20Z"/></Svg>
const IcoLeafCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9.2"/><path d="M8 16.2c0-5 3.2-8.2 8.2-8.4-.1 5-3.3 8.2-8.2 8.4Z"/><path d="M8 16.2l4.6-4.6"/></Svg>

const IcoLeafFilled = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M20.5 3.5C11 3.6 4.5 8.4 4.5 15.6c0 1.6.4 3 1.1 4.2 7.6.2 14.4-5 14.9-16.3Z" fill="currentColor"/>
    <path d="M5.6 19.8C8.6 15 12 11.6 16.6 8.4" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IcoShieldCheck = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M12 2.5 19.5 5.6v5.6c0 4.8-3.2 8.9-7.5 10.3-4.3-1.4-7.5-5.5-7.5-10.3V5.6Z" fill="currentColor"/>
    <path d="m8.6 12 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoBarsFilled = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
    <rect x="4" y="12" width="3.6" height="8" rx="1"/><rect x="10.2" y="8" width="3.6" height="12" rx="1"/><rect x="16.4" y="4" width="3.6" height="16" rx="1"/>
  </svg>
)

function LeafMark({ className }) {
  const id = `lm${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0b8a3c"/>
          <stop offset="1" stopColor="#43d062"/>
        </linearGradient>
      </defs>
      <path d="M42 5C22 5.6 8 15.4 8 31c0 3.6.9 6.8 2.4 9.4C27 40.8 41.2 30 42 5Z" fill={`url(#${id})`}/>
      <path d="M10.4 40.4C16.6 30.2 23.8 22.6 33.4 15.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M5.5 43.5c1.3-1.7 2.8-2.6 4.9-2.9" fill="none" stroke="#0b8a3c" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  )
}

// Triángulo de alerta (enfermedad) o círculo con check (sano) en el color del resultado
function ResultGlyph({ resultKey, className = 'h-11 w-11' }) {
  const { isDark } = useTheme()
  const color = resultColor(resultKey, isDark)
  if (resultKey === 'sano') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" className={`shrink-0 ${className}`}>
        <circle cx="24" cy="24" r="20" fill={color}/>
        <path d="m15 24.5 6 6 12-13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  }
  const crema = resultKey === 'mancha'
  const ink = crema ? '#5f4a1c' : '#fff'
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M24 4.5c1.6 0 3 .8 3.8 2.2l17 29.4c1.7 3-.4 6.6-3.8 6.6H7c-3.4 0-5.5-3.6-3.8-6.6l17-29.4C21 5.3 22.4 4.5 24 4.5Z" fill={color} stroke={crema ? '#b8994f' : 'none'} strokeWidth="1.5"/>
      <path d="M24 17v11" stroke={ink} strokeWidth="4.2" strokeLinecap="round"/>
      <circle cx="24" cy="35" r="2.6" fill={ink}/>
    </svg>
  )
}

function CheckCircle() {
  return (
    <span aria-hidden="true" className="mt-px grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-[#16a34a] text-white dark:bg-emerald-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </span>
  )
}

const Spinner = () => <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"/>

// ══════════════════════════════════════════════════════════════════════════════
//    Piezas de la página (maqueta 19)
// ══════════════════════════════════════════════════════════════════════════════
function HistorialHero({ tab }) {
  const parcela = tab === 'parcelas'
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10">
      <img src={heroHistorial} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-[75%_50%] dark:brightness-[0.45]"/>
      <div className="absolute inset-0 bg-linear-to-r from-white/90 via-white/75 to-white/20 md:hidden dark:hidden"/>
      <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block"/>
      <div className="relative flex min-h-[121px] items-center gap-[18px] px-4 py-4 sm:pl-[27px]">
        <span className="hidden h-[68px] w-[68px] shrink-0 place-items-center rounded-[18px] bg-linear-to-b from-[#16b46a] to-[#04844a] text-white shadow-[0_10px_20px_-10px_rgba(4,132,74,0.85)] sm:grid">
          <IcoLeafCircle className="h-9 w-9" sw={1.8}/>
        </span>
        <div className="min-w-0">
          <h2 className="font-[Manrope,Inter,sans-serif] text-[20px] font-extrabold leading-tight text-[#0b1226] sm:text-[22px] dark:text-white">
            Historial de análisis <span className="text-[#03a15e] dark:text-emerald-400">{parcela ? 'por parcela' : 'individual'}</span>
          </h2>
          <p className="mt-1.5 max-w-[250px] text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-300">
            {parcela
              ? 'Revisa cada análisis de tus lotes y sigue su evolución visita a visita.'
              : 'Consulta el historial de tus diagnósticos y mantén un registro de tus cultivos.'}
          </p>
        </div>
      </div>
    </section>
  )
}

// Curva suave (Catmull-Rom) por los puntos
function smoothPath(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

function Sparkline({ series, color, className }) {
  const id = `hs${useId().replace(/:/g, '')}`
  const w = 100
  const h = 40
  const max = Math.max(...series, 0)
  const pts = series.map((v, i) => [(i / Math.max(series.length - 1, 1)) * w, max > 0 ? h - 6 - (v / max) * (h - 14) : h - 8])
  const line = smoothPath(pts)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`}/>
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  )
}

const KPI_TONES = {
  mint: {
    card: 'border-[#d9f1e6] from-[#effaf5] to-[#e8f7f0] dark:border-emerald-400/15 dark:from-emerald-400/[0.07] dark:to-white/[0.02]',
    circle: 'bg-[#c9edde] text-[#04583c] dark:bg-emerald-400/15 dark:text-emerald-300',
    line: '#5fcf9d',
  },
  leaf: {
    card: 'border-[#d9f1e6] from-[#f1fbf6] to-[#e8f7f0] dark:border-emerald-400/15 dark:from-emerald-400/[0.07] dark:to-white/[0.02]',
    circle: 'bg-linear-to-br from-white to-[#cfeedd] text-[#02724e] shadow-[0_4px_10px_-6px_rgba(2,114,78,0.5)] dark:from-emerald-400/20 dark:to-emerald-400/5 dark:text-emerald-300',
    line: '#5fcf9d',
  },
  blue: {
    card: 'border-[#dae6fb] from-[#eef4fe] to-[#e7effd] dark:border-sky-400/15 dark:from-sky-400/[0.07] dark:to-white/[0.02]',
    circle: 'bg-[#d5e4fc] text-[#1d6fe0] dark:bg-sky-400/15 dark:text-sky-300',
    line: '#7ea8fa',
  },
  purple: {
    card: 'border-[#e6dcfa] from-[#f4effd] to-[#eee6fc] dark:border-violet-400/15 dark:from-violet-400/[0.07] dark:to-white/[0.02]',
    circle: 'bg-[#e7dbfc] text-[#6a2bd9] dark:bg-violet-400/15 dark:text-violet-300',
    line: '#a77cf2',
  },
}

function KpiCard({ tone, icon, value, label, series, title }) {
  const t = KPI_TONES[tone]
  return (
    <div title={title} className={`relative flex min-h-[60px] items-center gap-2.5 overflow-hidden rounded-2xl border bg-linear-to-br px-2.5 py-2.5 sm:gap-[15px] sm:px-[13px] ${t.card}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full sm:h-[41px] sm:w-[41px] [&>svg]:h-[19px] [&>svg]:w-[19px] sm:[&>svg]:h-[21px] sm:[&>svg]:w-[21px] ${t.circle}`}>{icon}</span>
      <span className="relative z-[1] min-w-0">
        <span className="block font-[Manrope,Inter,sans-serif] text-[18px] font-extrabold leading-none tracking-tight text-[#0b1226] sm:text-[20px] dark:text-white">{value}</span>
        <span className="mt-1 block text-[10px] leading-tight text-[#283c53] dark:text-slate-400">{label}</span>
      </span>
      {series && <Sparkline series={series} color={t.line} className="pointer-events-none absolute bottom-2.5 right-2.5 hidden h-[30px] w-[64px] sm:block"/>}
    </div>
  )
}

function PeriodSelect({ value, onChange }) {
  return (
    <label className={`${PILL_BTN} relative h-[29px]`}>
      <span className="sr-only">Periodo</span>
      <IcoCalendar className="pointer-events-none absolute left-3 h-3.5 w-3.5"/>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-8 pr-8 text-[11px] font-semibold outline-none [color-scheme:light] focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:[color-scheme:dark]"
      >
        {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        {value === 'rango' && <option value="rango">Rango personalizado</option>}
      </select>
      <IcoChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5"/>
    </label>
  )
}

function FilterMenu({ count, children }) {
  const [open, setOpen, ref] = usePopover()
  const panelId = `fm${useId().replace(/:/g, '')}`
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`${PILL_BTN} h-[29px] px-3 ${open ? 'border-[#9fd8b7] bg-[#f3fbf6] dark:bg-white/10' : ''}`}
      >
        <IcoFilter className="h-3.5 w-3.5"/>
        Filtrar
        {count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#0b8a4b] px-1 text-[9.5px] font-bold text-white">{count}</span>}
        <IcoChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && (
        <div id={panelId} role="group" aria-label="Filtros del listado" className="fade-in absolute left-0 top-full z-30 mt-2 w-[min(330px,calc(100vw-40px))] rounded-2xl border border-[#e3e8ee] bg-white p-3.5 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)] md:left-auto md:right-0 dark:border-white/10 dark:bg-[#111c2e]">
          {children}
        </div>
      )}
    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <fieldset className="mb-3">
      <legend className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#64748b] dark:text-slate-400">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </fieldset>
  )
}

function Pill({ active, onClick, dot, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-[25px] items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-semibold transition ${
        active
          ? 'bg-[#0b8a4b] text-white shadow-sm dark:bg-emerald-600'
          : 'bg-[#f1f4f7] text-[#334155] hover:bg-[#e6ebf0] dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10'
      }`}
    >
      {dot && <span aria-hidden="true" className="h-2 w-2 rounded-full ring-1 ring-white/70" style={{ background: dot }}/>}
      {children}
    </button>
  )
}

function DateField({ label, value, onChange, min, max }) {
  return (
    <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#55607a] dark:text-slate-400">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-[27px] rounded-lg border border-[#e3e8ee] bg-white px-2 text-[11px] text-[#1f2d48] outline-none [color-scheme:light] focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"
      />
    </label>
  )
}

function FilterFooter({ onReset, onClearAll }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#eef1f5] pt-2.5 dark:border-white/10">
      <button type="button" onClick={onReset} className="text-[11px] font-semibold text-[#0b6b35] hover:underline dark:text-emerald-400">Limpiar filtros</button>
      {onClearAll && (
        <button type="button" onClick={onClearAll} className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline dark:text-red-400">
          <IcoTrash className="h-3.5 w-3.5"/> Eliminar todo
        </button>
      )}
    </div>
  )
}

// Cabecera de la tarjeta «Listado»: título, búsqueda, filtros y periodo
function ListHeader({ title, query, onQuery, placeholder, filter, period, onPeriod }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-2.5">
      <h3 className={`flex items-center gap-2 text-[13.5px] ${PARCEL_TITLE}`}>
        <IcoClock className="h-[18px] w-[18px] text-[#0b5c3a] dark:text-emerald-400" sw={2.2}/>
        {title}
      </h3>
      <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto md:flex-nowrap">
        <label className="relative block min-w-0 basis-full md:w-[270px] md:basis-auto">
          <span className="sr-only">Buscar</span>
          <IcoSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#081535] dark:text-slate-400"/>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className="h-[29px] w-full rounded-full border border-[#e3e8ee] bg-white pl-8 pr-3 text-[11px] text-[#0b1226] outline-none transition placeholder:text-[#55627c] focus:border-[#9fd8b7] focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </label>
        {filter}
        <PeriodSelect value={period} onChange={onPeriod}/>
      </div>
    </header>
  )
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr className="text-[10.5px] text-[#44506c] dark:text-slate-400">
        {cols.map((c, i) => (
          <th
            key={c.label}
            scope="col"
            className={`bg-[#edf0f6] py-[7px] pl-3 text-left font-medium dark:bg-white/[0.05] ${i === 0 ? 'rounded-l-lg' : ''} ${i === cols.length - 1 ? 'rounded-r-lg pr-3 text-center' : ''} ${c.className ?? ''}`}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

const TD = 'border-b border-[#eef1f5] py-[3px] pl-3 align-middle dark:border-white/[0.06]'

// Anillo con porcentaje (columna «Afectación» / «Zonas afectadas»)
function Ring({ pct, color, size = 41, stroke = 4.5, title, srLabel, children }) {
  const gid = `rg${useId().replace(/:/g, '')}`
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, Number(pct) || 0))
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} title={title}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        {!color && (
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#21c27a"/>
              <stop offset="100%" stopColor="#067a49"/>
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[#e2ebe6] dark:stroke-white/10"/>
        {p > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? `url(#${gid})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${Math.max(0.01, (p / 100) * c)} ${c}`}/>
        )}
      </svg>
      <span aria-hidden="true" className="relative text-[10.5px] font-bold leading-none text-[#0b1226] dark:text-white">{children}</span>
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </span>
  )
}

// Miniatura: la imagen completa (contain) sobre un fondo desenfocado de sí misma
function Thumb({ src, className = '' }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-[#e3f2e6] ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10 ${className}`}>
      {src && !failed ? (
        <>
          <img src={src} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full scale-125 select-none object-cover opacity-60 blur-md"/>
          <img src={src} alt="" loading="lazy" decoding="async" draggable="false" onError={() => setFailed(true)} className="relative h-full w-full select-none object-contain"/>
        </>
      ) : (
        <IcoLeafFilled className="absolute inset-0 m-auto h-5 w-5 text-[#0b8a4b] dark:text-emerald-400"/>
      )}
    </span>
  )
}

function ChipGreen({ icon, children }) {
  return (
    <span className="inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-full bg-[#edf9f0] px-2.5 text-[10.5px] font-semibold text-[#0b5c35] dark:bg-emerald-400/10 dark:text-emerald-300">
      <span className="text-[#0b8a4b] dark:text-emerald-400">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  )
}

function DateCell({ iso }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-[#1f2d48] lg:text-[11.5px] dark:text-slate-200">
      <IcoCalendar className="h-3.5 w-3.5 text-[#3a4969] dark:text-slate-400"/>
      {fmtDateTime(iso)}
    </span>
  )
}

function DiagnosisCell({ resultKey, name, desc }) {
  const { isDark } = useTheme()
  return (
    <>
      <p className="flex min-w-0 items-center gap-2 text-[11.5px] font-bold text-[#0b1226] dark:text-white">
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: resultColor(resultKey, isDark) }}/>
        <span className="truncate">{name}</span>
      </p>
      <p className={`mt-0.5 truncate pl-4 text-[10px] ${MUTED}`}>{desc}</p>
    </>
  )
}

// «Ver detalle» y un botón redondo secundario (descargar PDF o analizar de nuevo)
function RowActions({ label, onOpen, second }) {
  return (
    <div className="flex items-center justify-end gap-1.5 md:justify-center md:gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalle: ${label}`}
        className="inline-flex h-[25px] items-center gap-1.5 rounded-full bg-[#e3f6ec] px-3 text-[10.5px] font-semibold text-[#075c38] transition hover:bg-[#d3f0e1] dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:bg-emerald-400/25"
      >
        <IcoEye className="h-3.5 w-3.5"/>
        Ver detalle
      </button>
      {second && (
        <button type="button" onClick={second.onClick} disabled={second.busy} aria-label={`${second.label}: ${label}`} title={second.label} className={`${ROUND_BTN} h-[30px] w-[30px]`}>
          {second.busy ? <Spinner/> : second.icon}
        </button>
      )}
    </div>
  )
}

function Pagination({ paged, onPage, noun }) {
  const { page, pageCount, from, to, total } = paged
  if (!total) return null
  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-2.5 sm:flex-row">
      <p className="text-[11px] text-[#3d4b71] dark:text-slate-400">
        Mostrando {from === to ? from : `${from}–${to}`} de {total} {noun}
      </p>
      {pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-1">
          <button type="button" aria-label="Página anterior" disabled={page === 1} onClick={() => onPage(page - 1)} className={`${ROUND_BTN} text-[#64748b] disabled:pointer-events-none disabled:opacity-40`}>
            <IcoChevronLeft className="h-3.5 w-3.5"/>
          </button>
          {pageWindow(page, pageCount).map((p, i) => (p === '…' ? (
            <span key={`gap${i}`} className="px-1 text-[11px] text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPage(p)}
              className={`grid h-[24px] min-w-[24px] place-items-center rounded-lg px-1 text-[11px] font-semibold transition ${
                p === page ? 'bg-[#037d4d] text-white shadow-[0_6px_12px_-6px_rgba(3,125,77,0.8)] dark:bg-emerald-600' : 'text-[#131d32] hover:bg-[#eef3f0] dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          )))}
          <button type="button" aria-label="Página siguiente" disabled={page === pageCount} onClick={() => onPage(page + 1)} className={`${ROUND_BTN} text-[#64748b] disabled:pointer-events-none disabled:opacity-40`}>
            <IcoChevronRight className="h-3.5 w-3.5"/>
          </button>
        </nav>
      )}
    </div>
  )
}

function ListEmpty({ icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#cfe8d9] bg-[#f8fcf9] px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#e3f6ec] text-[#0b8a4b] dark:bg-emerald-400/10 dark:text-emerald-400 [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <p className={`text-[13px] ${PARCEL_TITLE}`}>{title}</p>
      <p className={`mt-1 max-w-sm text-[11.5px] ${MUTED}`}>{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const EmptyAction = ({ onClick, icon, children }) => (
  <button type="button" onClick={onClick} className="inline-flex h-[32px] items-center gap-2 rounded-full bg-[#02894b] px-4 text-[11.5px] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(2,137,75,0.7)] transition hover:bg-[#027a42]">
    {icon}{children}
  </button>
)

// ══════════════════════════════════════════════════════════════════════════════
//    Diálogos
// ══════════════════════════════════════════════════════════════════════════════
// Pila de diálogos abiertos: Escape cierra solo el de más arriba
const modalStack = []

function useModalLayer(onClose) {
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
  return closeRef
}

function Modal({ onClose, labelledBy, size = 'max-w-md', children }) {
  const closeRef = useModalLayer(onClose)
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="fade-in absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => closeRef.current()}/>
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
    <Modal onClose={() => settle(false)} labelledBy="confirmar-titulo">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <IcoTrash className="h-5 w-5"/>
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
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        key={toast.key}
        role="status"
        className={`fade-up pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ${
          toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-emerald-950'
        }`}
      >
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
    <Modal onClose={onCancel} labelledBy="renombrar-titulo">
      <form onSubmit={submit} className="p-6">
        <h3 id="renombrar-titulo" className="text-lg font-bold text-slate-900 dark:text-white">Renombrar parcela</h3>
        <input
          autoFocus
          value={value}
          maxLength={60}
          aria-label="Nombre de la parcela"
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

// ── «Detalle del análisis» (maqueta 20) ───────────────────────────────────────
function DetailShell({ labelledBy, onClose, children }) {
  const closeRef = useModalLayer(onClose)
  const panelRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const raf = requestAnimationFrame(() => {
      const tab = panelRef.current?.querySelector('[role="tab"][aria-selected="true"]')
      ;(tab ?? panelRef.current)?.focus()
    })
    return () => {
      cancelAnimationFrame(raf)
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [])
  // Tab y Mayús+Tab no salen del diálogo
  const trapTab = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.getClientRects().length)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-3">
      <div className="fade-in absolute inset-0 bg-[#0b1220]/45 backdrop-blur-[3px]" onClick={() => closeRef.current()}/>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="fade-up relative flex max-h-[calc(100dvh-10px)] w-full max-w-[860px] flex-col overflow-hidden rounded-t-[22px] sm:h-[min(572px,calc(100dvh-24px))] border border-white/70 bg-white shadow-[0_30px_80px_-30px_rgba(2,12,8,0.6)] outline-none sm:max-h-[calc(100dvh-24px)] sm:rounded-[22px] dark:border-white/10 dark:bg-[#0f1a2b]"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

function MenuButton({ items }) {
  const [open, setOpen, ref] = usePopover()
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Más acciones" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={ROUND_BTN}>
        <IcoMore className="h-4 w-4"/>
      </button>
      {open && (
        <div role="menu" className="fade-in absolute right-0 top-full z-[60] mt-2 w-56 overflow-hidden rounded-2xl border border-[#e3e8ee] bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#111c2e]">
          {items.map(({ label, Icon, onClick, danger }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onClick() }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium transition ${
                danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10' : 'text-[#1f2d48] hover:bg-[#f1f5f3] dark:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4"/>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Tabs({ idBase, tabs, active, onChange }) {
  const refs = useRef([])
  const onKeyDown = (e, i) => {
    const n = tabs.length
    const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key]
    if (next == null) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div role="tablist" aria-label="Secciones del detalle" className="relative -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {tabs.map(({ id, label, Icon }, i) => {
        const sel = id === active
        return (
          <button
            key={id}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${id}`}
            aria-selected={sel}
            aria-controls={`${idBase}-panel`}
            tabIndex={sel ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex h-[31px] shrink-0 items-center gap-2 rounded-full px-[16px] text-[10.5px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f1a2b] ${
              sel
                ? 'bg-linear-to-r from-[#13a35c] to-[#0b8a4b] text-white shadow-[0_8px_16px_-10px_rgba(11,138,75,0.9)]'
                : 'bg-[#eef1f5] text-[#1d2640] hover:bg-[#e3e8ee] dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <Icon className="h-[15px] w-[15px]"/>
            {label}
            {sel && <IcoChevronRight className="-mr-1 h-3 w-3 opacity-80" sw={2.6}/>}
          </button>
        )
      })}
    </div>
  )
}

function DetailHeader({ idBase, title, subtitle, fecha, actions, onClose, children }) {
  return (
    <header className="relative z-10 shrink-0 px-4 pb-2 pt-3.5 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-r from-white via-[#f4fbf7] to-[#e2f2ea] dark:from-[#0f1a2b] dark:via-[#0f1d2a] dark:to-[#11271f]"/>
        <img src={inicioHojas} alt="" draggable="false" className="absolute -top-2 right-[30%] h-[64px] w-auto select-none opacity-50 dark:opacity-[0.08]"/>
      </div>
      <div className="relative flex items-start gap-3">
        <LeafMark className="h-10 w-10 shrink-0 sm:h-[46px] sm:w-[46px]"/>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={`${idBase}-title`} className="font-[Manrope,Inter,sans-serif] text-[17px] font-extrabold leading-tight text-[#0b1226] sm:text-[18px] dark:text-white">{title}</h2>
          <p className="mt-0.5 text-[10px] text-[#3a4261] dark:text-slate-400">{subtitle}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#0b1a33] sm:hidden dark:text-slate-200">
            <IcoCalendar className="h-3 w-3"/>{fmtDateTime(fecha)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden h-[27px] items-center gap-1.5 rounded-full bg-[#dcefe4] px-3 text-[9.5px] font-semibold text-[#0b1a33] sm:inline-flex dark:bg-emerald-400/10 dark:text-emerald-100">
            <IcoCalendar className="h-3 w-3"/>Fecha: {fmtDateTime(fecha)}
          </span>
          {actions}
          <button type="button" onClick={onClose} aria-label="Cerrar detalle" className={ROUND_BTN}>
            <IcoX className="h-3.5 w-3.5" sw={2.4}/>
          </button>
        </div>
      </div>
      {children}
    </header>
  )
}

function TabPanel({ idBase, active, children }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${active}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1 sm:px-6">
      {children}
    </div>
  )
}

function DiagnosisCard({ resultKey, name, metricLabel, metricValue, metricPct, side }) {
  return (
    <section className={`${MINT} px-4 pb-3.5 pt-3`}>
      <h3 className={`flex items-center gap-2 ${H3}`}>
        <IcoPulse className="h-[18px] w-[18px] text-[#129445] dark:text-emerald-400" sw={2.2}/>
        Diagnóstico
      </h3>
      <div className="mt-2.5 grid gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <ResultGlyph resultKey={resultKey}/>
            <p className={`min-w-0 font-[Manrope,Inter,sans-serif] text-[23px] font-extrabold leading-tight ${RESULT_TITLE[resultKey] ?? RESULT_TITLE.otro}`}>{name}</p>
          </div>
          <p className="mt-3 text-[10.5px] font-medium text-[#0b1e31] dark:text-slate-300">{metricLabel}</p>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-[Manrope,Inter,sans-serif] text-[23px] font-extrabold leading-none text-[#002c28] dark:text-white">{metricValue}</span>
            <span className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#d5ede1] dark:bg-white/10">
              <span className="block h-full rounded-full bg-linear-to-r from-[#0e9f55] to-[#33d27c]" style={{ width: `${Math.max(0, Math.min(100, Number(metricPct) || 0))}%` }}/>
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-2.5 border-t border-[#cfe8d9] pt-2.5 sm:border-l sm:border-t-0 sm:pl-3.5 sm:pt-0 dark:border-white/10">
          {side}
        </div>
      </div>
    </section>
  )
}

function SideStat({ icon, label, children }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#d2edde] dark:bg-emerald-400/10">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium text-[#0b1e31] dark:text-slate-300">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}

const SeverityChip = ({ level }) => (
  <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-bold ${SEVERITY_CHIP[level] ?? 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'}`}>
    {level ?? 'Sin datos'}
  </span>
)

function Donut({ segments, size = 92, stroke = 17 }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  let offset = 0
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-[#e2ebe6] dark:stroke-white/10"/>
        {segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c
          const el = <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}/>
          offset += len
          return el
        })}
      </svg>
      <span className="relative grid h-[50%] w-[50%] place-items-center rounded-full bg-white shadow-[0_4px_10px_-6px_rgba(15,40,30,0.45)] dark:bg-[#162032]">
        <IcoLeafFilled className="h-5 w-5 text-[#129445] dark:text-emerald-400"/>
      </span>
    </span>
  )
}

function ResumenCard({ segments, legend, caption }) {
  return (
    <section title={caption} className={`relative overflow-hidden ${SOFT} px-4 pb-3 pt-3`}>
      <img src={inicioHojas} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[54px] w-auto select-none opacity-80 dark:opacity-10"/>
      <h3 className={`relative flex items-center gap-2 ${H3}`}>
        <IcoChart className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400" sw={2.4}/>
        Resumen del análisis
      </h3>
      <div className="relative mt-2.5 flex items-center gap-5">
        <Donut segments={segments}/>
        <ul className="min-w-0 space-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-[11px] text-[#00072a] dark:text-slate-200">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }}/>
              <span className="min-w-0 truncate">{l.label}</span>
              <span className="font-bold">{l.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function RecsMiniCard({ recs, onMore }) {
  return (
    <section className={`relative overflow-hidden ${PLAIN} px-4 pb-3 pt-3`}>
      <img src={maizRecs} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto select-none [mask-image:linear-gradient(to_right,transparent,#000_45%)] dark:opacity-25"/>
      <div className="relative flex items-center gap-2">
        <h3 className={`flex items-center gap-2 ${H3}`}>
          <IcoSprout className="h-[18px] w-[18px] text-[#078d34] dark:text-emerald-400" sw={2.2}/>
          Recomendaciones
        </h3>
        {recs.length > 0 && onMore && (
          <button type="button" onClick={onMore} className="ml-auto mr-[64px] inline-flex shrink-0 items-center gap-0.5 rounded text-[10px] font-semibold text-[#0b6b35] hover:underline dark:text-emerald-400">
            Ver todas
            <IcoChevronRight className="h-3 w-3" sw={2.6}/>
          </button>
        )}
      </div>
      {recs.length ? (
        <ul className="relative mt-2 space-y-1.5 pr-[72px]">
          {recs.slice(0, 3).map((r) => (
            <li key={r.title} className="flex items-start gap-2 text-[10.5px] leading-snug text-[#061e3b] dark:text-slate-200"><CheckCircle/><span>{r.body}</span></li>
          ))}
        </ul>
      ) : (
        <p className={`relative mt-2 pr-[72px] text-[10.5px] ${MUTED}`}>No hay recomendaciones para este resultado.</p>
      )}
    </section>
  )
}

function InfoCard({ cells, action }) {
  return (
    <section className={`${MINT} px-4 pb-3 pt-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`flex items-center gap-2 ${H3}`}>
          <IcoPlantPot className="h-[18px] w-[18px] text-[#04703a] dark:text-emerald-400"/>
          Información adicional
        </h3>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_0.85fr_1.3fr] sm:gap-0">
        {cells.map((c, i) => (
          <div key={c.label} className={`flex min-w-0 items-center gap-1.5 border-[#cfe8d9] sm:pr-1.5 dark:border-white/10 ${i ? 'sm:border-l sm:pl-2.5' : ''}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center text-[#092435] dark:text-slate-300">{c.icon}</span>
            <div className="min-w-0">
              <dt className="text-[9.5px] text-[#4e677c] dark:text-slate-400">{c.label}</dt>
              <dd className="truncate text-[11px] font-semibold text-[#021526] dark:text-slate-100" title={c.value}>{c.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}

const EmptyChip = ({ children }) => (
  <span className="pointer-events-none absolute left-1/2 top-1/2 z-[2] max-w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-1 text-center text-[11px] font-semibold text-[#0b6b35] shadow-md backdrop-blur-sm dark:bg-[#0f1a2b]/90 dark:text-emerald-300">
    {children}
  </span>
)

// Imagen de una pestaña: completa, ampliable con un clic
function ImageFigure({ icon, label, src, alt, onZoom, overlay }) {
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#e9eef1] bg-[#f7f9fa] dark:border-white/10 dark:bg-white/[0.03]">
      <figcaption className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-[#1d2640] dark:text-slate-200">
        <span className="text-[#0b6b35] dark:text-emerald-300">{icon}</span>
        <span className="truncate">{label}</span>
      </figcaption>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0f1a14]">
        {src && (
          <ZoomTrigger label={label.toLowerCase()} onOpen={onZoom}>
            <FittedImage src={src} alt={alt}/>
          </ZoomTrigger>
        )}
        {overlay}
      </div>
    </figure>
  )
}

function TurboLegend({ light = false }) {
  return (
    <div className="flex gap-2.5 self-stretch py-1">
      <span aria-hidden="true" className={`rounded-full ${light ? 'w-3' : 'w-2.5'}`} style={{ background: TURBO }}/>
      <span className={`flex flex-col justify-between leading-tight ${light ? 'text-[11.5px] text-white/85' : `text-[10px] ${MUTED}`}`}>
        <span>Mayor<br/>atención</span>
        <span>Menor<br/>atención</span>
      </span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//    Historial individual
// ══════════════════════════════════════════════════════════════════════════════
const PLANT_COLS = [
  { label: 'Imagen', className: 'w-[124px]' },
  { label: 'Diagnóstico' },
  { label: 'Cultivo', className: 'hidden w-[13%] xl:table-cell' },
  { label: 'Afectación', className: 'w-[92px] xl:w-[11%]' },
  { label: 'Fecha', className: 'w-[172px] xl:w-[21%]' },
  { label: 'Acciones', className: 'w-[150px] xl:w-[17%]' },
]
const PLANT_SORTS = [
  { id: 'recientes', label: 'Más recientes' },
  { id: 'antiguos', label: 'Más antiguos' },
  { id: 'mayor', label: 'Mayor afectación' },
  { id: 'menor', label: 'Menor afectación' },
]
const RESULT_FILTERS = [['todos', 'Todos'], ['roya', 'Roya'], ['tizon', 'Tizón'], ['mancha', 'Mancha blanca'], ['sano', 'Sano']]
const SEVERITY_FILTERS = [['todas', 'Todas'], ['Leve', 'Leve'], ['Moderada', 'Moderada'], ['Grave', 'Grave']]

function AffectedRing({ pct, healthy }) {
  return (
    <Ring pct={pct} title="Porcentaje de la imagen con la enfermedad" srLabel={healthy ? 'Sin área afectada' : `Área afectada: ${fmtPct(pct)}`}>
      {healthy ? '0%' : fmtPct(pct)}
    </Ring>
  )
}

function AnalysisRow({ item, onOpen, onExport, exporting }) {
  const key = itemKey(item)
  const name = RESULT_STYLE[key]?.short ?? 'Sin clasificar'
  const label = `${name}, ${fmtDateTime(item.fecha)}`
  return (
    <tr className="transition-colors hover:bg-[#f7fbf8] dark:hover:bg-white/[0.03]">
      <td className={TD}>
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={onOpen} className="block cursor-pointer rounded-lg">
          <Thumb src={item.resultadoImage || item.imagen} className="h-[40px] w-[100px]"/>
        </button>
      </td>
      <td className={`${TD} pr-3`}><DiagnosisCell resultKey={key} name={name} desc={RESULT_DESC[key]}/></td>
      <td className={`${TD} hidden xl:table-cell`}><ChipGreen icon={<IcoCorn className="h-3.5 w-3.5"/>}>Maíz</ChipGreen></td>
      <td className={TD}><AffectedRing pct={affectedOf(item)} healthy={key === 'sano'}/></td>
      <td className={TD}><DateCell iso={item.fecha}/></td>
      <td className={`${TD} pr-2`}>
        <RowActions label={label} onOpen={onOpen} second={{ label: 'Descargar PDF', icon: <IcoDownload className="h-3.5 w-3.5"/>, onClick: onExport, busy: exporting }}/>
      </td>
    </tr>
  )
}

function AnalysisCardMobile({ item, onOpen, onExport, exporting }) {
  const key = itemKey(item)
  const name = RESULT_STYLE[key]?.short ?? 'Sin clasificar'
  const label = `${name}, ${fmtDateTime(item.fecha)}`
  return (
    <li className="rounded-xl border border-[#eef1f5] bg-white p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={onOpen} className="block rounded-lg">
          <Thumb src={item.resultadoImage || item.imagen} className="h-[52px] w-[78px]"/>
        </button>
        <div className="min-w-0 flex-1">
          <DiagnosisCell resultKey={key} name={name} desc={RESULT_DESC[key]}/>
          <div className="mt-1"><DateCell iso={item.fecha}/></div>
        </div>
        <AffectedRing pct={affectedOf(item)} healthy={key === 'sano'}/>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <ChipGreen icon={<IcoCorn className="h-3.5 w-3.5"/>}>Maíz</ChipGreen>
        <RowActions label={label} onOpen={onOpen} second={{ label: 'Descargar PDF', icon: <IcoDownload className="h-3.5 w-3.5"/>, onClick: onExport, busy: exporting }}/>
      </div>
    </li>
  )
}

const PLANT_TABS = [
  { id: 'resumen', label: 'Imagen y resultados', Icon: IcoImage },
  { id: 'gradcam', label: 'Mapa de calor (Grad-CAM)', Icon: IcoFlame },
  { id: 'deteccion', label: 'Detección del modelo', Icon: IcoScan },
  { id: 'recs', label: 'Recomendaciones', Icon: IcoBulb },
]

function AnalysisDetail({ item, exporting, onClose, onExport, onCopy, onDelete }) {
  const { isDark } = useTheme()
  const [tab, setTab] = useState('resumen')
  const [zoom, setZoom] = useState(null)
  const idBase = `ad${useId().replace(/:/g, '')}`
  const key = itemKey(item)
  const healthy = key === 'sano'
  const name = healthy ? 'Cultivo sano' : (RESULT_STYLE[key]?.short ?? diseaseMeta(item.enfermedad).label)
  const affected = healthy ? 0 : affectedOf(item)
  const severity = item.severidad ?? (healthy ? 'Sano' : null)
  const recs = recommendationsFor(item.enfermedad)
  const chem = CHEMICAL_TREATMENTS[item.enfermedad] ?? null
  const deteccion = healthy ? null : item.resultadoImage
  const principal = deteccion || item.imagen
  const zooms = {
    principal: { label: deteccion ? 'Detección del modelo' : 'Imagen analizada', src: principal },
    original: { label: 'Imagen original', src: item.imagen },
    deteccion: { label: 'Detección del modelo', src: deteccion },
    gradcam: { label: 'Mapa de calor (Grad-CAM)', src: item.xaiImage, legend: true },
  }
  const z = zoom ? zooms[zoom] : null

  return (
    <DetailShell labelledBy={`${idBase}-title`} onClose={onClose}>
      <DetailHeader
        idBase={idBase}
        title="Detalle del análisis"
        subtitle="Información completa del diagnóstico realizado por IA"
        fecha={item.fecha}
        onClose={onClose}
        actions={(
          <>
            <button type="button" onClick={onExport} disabled={exporting} aria-label="Descargar reporte PDF" title="Descargar reporte PDF" className={ROUND_BTN}>
              {exporting ? <Spinner/> : <IcoDownload className="h-3.5 w-3.5"/>}
            </button>
            <MenuButton
              items={[
                { label: 'Copiar resumen', Icon: IcoCopy, onClick: onCopy },
                { label: 'Eliminar análisis', Icon: IcoTrash, onClick: onDelete, danger: true },
              ]}
            />
          </>
        )}
      >
        <Tabs idBase={idBase} tabs={PLANT_TABS} active={tab} onChange={setTab}/>
      </DetailHeader>

      <TabPanel idBase={idBase} active={tab}>
        {tab === 'resumen' && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
              <figure className="relative order-1 aspect-[1.53] lg:order-none overflow-hidden rounded-[14px] bg-[#0f1a14] ring-1 ring-black/5 dark:ring-white/10">
                {principal ? (
                  <ZoomTrigger label={zooms.principal.label.toLowerCase()} onOpen={() => setZoom('principal')}>
                    <FittedImage src={principal} alt={deteccion ? `Detección del modelo: ${name}` : 'Imagen analizada'}/>
                  </ZoomTrigger>
                ) : (
                  <p className="absolute inset-0 grid place-items-center text-[11px] text-white/70">Imagen no disponible</p>
                )}
                <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#1b211c]/80 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm">
                  <IcoLeafFilled className="h-3.5 w-3.5 text-[#3ddc84]"/>
                  {healthy ? 'Sano' : name}
                </span>
              </figure>
              <div className="order-3 min-w-0 lg:order-none">
              <ResumenCard
                segments={[
                  { key: 'sano', value: 100 - affected, color: resultColor('sano', isDark) },
                  { key, value: affected, color: resultColor(key, isDark) },
                ]}
                legend={[
                  { label: 'Sano y fondo', value: fmtPct(100 - affected), color: resultColor('sano', isDark) },
                  ...(healthy ? [] : [{ label: name, value: fmtPct(affected), color: resultColor(key, isDark) }]),
                ]}
                caption="Parte de la imagen que el modelo clasificó en cada grupo."
              />
              </div>
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
              <div className="order-2 min-w-0 lg:order-none">
              <DiagnosisCard
                resultKey={key}
                name={name}
                metricLabel="Área afectada"
                metricValue={fmtPct(affected)}
                metricPct={affected}
                side={(
                  <>
                    <SideStat icon={<IcoBarsFilled className={`h-[18px] w-[18px] ${SEV_ICON[severity] ?? 'text-slate-400'}`}/>} label="Severidad">
                      <SeverityChip level={severity}/>
                    </SideStat>
                    <div className="h-px bg-[#cfe8d9] dark:bg-white/10"/>
                    {healthy ? (
                      <SideStat icon={<IcoLeafFilled className="h-[18px] w-[18px] text-[#129f04] dark:text-emerald-400"/>} label="Escala de severidad">
                        <span className="text-[11px] font-semibold text-[#0b6b35] dark:text-emerald-300">Sin zonas afectadas</span>
                      </SideStat>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-medium text-[#0b1e31] dark:text-slate-300">Escala de severidad</p>
                        <SeverityScale pct={affected} className="mt-2"/>
                      </div>
                    )}
                  </>
                )}
              />
              </div>
              <div className="order-4 min-w-0 lg:order-none">
                <RecsMiniCard recs={recs} onMore={() => setTab('recs')}/>
              </div>
              <div className="order-5 min-w-0 lg:order-none">
              <InfoCard
                cells={[
                  { label: 'Cultivo', value: 'Maíz', icon: <img src={mazorca} alt="" className="h-[22px] w-auto"/> },
                  { label: 'Análisis', value: 'Individual', icon: <IcoImage className="h-5 w-5"/> },
                  { label: 'Registrado', value: agoLabel(item.fecha), icon: <IcoClock className="h-5 w-5"/> },
                ]}
              />
              </div>
            </div>
          </div>
        )}

        {tab === 'gradcam' && (
          <div>
            <div className="grid gap-3 md:grid-cols-2">
              <ImageFigure icon={<IcoImage className="h-3.5 w-3.5"/>} label="Imagen original" src={item.imagen} alt="Imagen original analizada" onZoom={() => setZoom('original')}/>
              <ImageFigure
                icon={<IcoFlame className="h-3.5 w-3.5"/>}
                label="Mapa de calor (Grad-CAM)"
                src={item.xaiImage}
                alt="Mapa de calor: zonas de la hoja en las que se fijó el modelo para el diagnóstico"
                onZoom={() => setZoom('gradcam')}
                overlay={!item.xaiImage && <EmptyChip>Este análisis no tiene mapa de calor</EmptyChip>}
              />
            </div>
            {item.xaiImage && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] font-medium text-[#1d2640] dark:text-slate-300">
                <span>Menor atención</span>
                <span aria-hidden="true" className="h-2.5 w-40 rounded-full" style={{ background: TURBO.replace('to bottom', 'to left') }}/>
                <span>Mayor atención</span>
              </div>
            )}
            <p className={`mt-2 text-[11px] leading-snug ${MUTED}`}>
              {healthy
                ? 'Zonas en las que el modelo se apoyó para decidir que la hoja está sana.'
                : 'Los colores cálidos marcan las zonas de la hoja que más influyeron en el diagnóstico; los fríos, las que casi no influyeron.'}
              {' '}Haz clic en una imagen para ampliarla.
            </p>
          </div>
        )}

        {tab === 'deteccion' && (
          <div>
            <div className="grid gap-3 md:grid-cols-2">
              <ImageFigure icon={<IcoImage className="h-3.5 w-3.5"/>} label="Imagen original" src={item.imagen} alt="Imagen original analizada" onZoom={() => setZoom('original')}/>
              <ImageFigure
                icon={<IcoScan className="h-3.5 w-3.5"/>}
                label="Detección del modelo"
                src={deteccion || item.imagen}
                alt={deteccion ? `Detección del modelo: zona con ${name.toLowerCase()}` : 'Imagen analizada'}
                onZoom={() => setZoom(deteccion ? 'deteccion' : 'original')}
                overlay={!deteccion && <EmptyChip>{healthy ? 'Sin zonas afectadas' : 'Detección no guardada en este análisis'}</EmptyChip>}
              />
            </div>
            <p className={`mt-3 flex items-start gap-2 text-[11px] leading-snug ${MUTED}`}>
              {healthy ? (
                'El modelo no encontró zonas con tizón, roya ni mancha blanca en esta hoja.'
              ) : deteccion ? (
                <>
                  <span aria-hidden="true" className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DETECTION_COLOR[key] ?? '#ef4444' }}/>
                  <span>En color, la zona que el modelo detectó como {name.toLowerCase()}: {fmtPct(affected)} de la imagen. Haz clic en una imagen para ampliarla.</span>
                </>
              ) : (
                'Este análisis se guardó antes de que la app guardara la imagen de detección: solo está disponible la imagen original.'
              )}
            </p>
          </div>
        )}

        {tab === 'recs' && (recs.length ? (
          <TreatmentDetails recs={recs} chemData={chem}/>
        ) : (
          <p className={`py-6 text-center text-[12px] ${MUTED}`}>No hay recomendaciones para este resultado.</p>
        ))}
      </TabPanel>

      {z?.src && (
        <ZoomOverlay label={z.label} onClose={() => setZoom(null)}>
          {z.legend ? (
            <div className="flex h-full w-full items-center justify-center gap-5">
              <img src={z.src} alt={z.label} className="h-full max-w-[calc(100%-96px)] object-contain"/>
              <div className="flex h-[55%]"><TurboLegend light/></div>
            </div>
          ) : (
            <img src={z.src} alt={z.label} className="h-full w-full object-contain"/>
          )}
        </ZoomOverlay>
      )}
    </DetailShell>
  )
}

function PlantHistory({ history, onHistoryChange, onGoAnalizar, confirm, toast }) {
  const { isDark } = useTheme()
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('todo')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [result, setResult] = useState('todos')
  const [severity, setSeverity] = useState('todas')
  const [sort, setSort] = useState('recientes')
  const [detailId, setDetailId] = useState(null)
  const [exportingId, setExportingId] = useState(null)
  const listRef = useRef(null)

  const kpis = useMemo(() => {
    const sick = history.filter((i) => itemKey(i) !== 'sano')
    const healthy = history.filter((i) => itemKey(i) === 'sano')
    return {
      total: history.length,
      avgAff: sick.length ? sick.reduce((a, i) => a + affectedOf(i), 0) / sick.length : null,
      healthy: healthy.length,
      diseases: new Set(sick.map(itemKey).filter((k) => k !== 'otro')).size,
      sTotal: weeklySeries(history.map((i) => ({ date: i.fecha }))),
      sAff: weeklySeries(sick.map((i) => ({ date: i.fecha, value: affectedOf(i) })), 'mean'),
      sHealthy: weeklySeries(healthy.map((i) => ({ date: i.fecha }))),
      sSick: weeklySeries(sick.map((i) => ({ date: i.fecha }))),
    }
  }, [history])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const inDate = dateFilter(period, dateFrom, dateTo)
    const list = history.filter((item) => {
      const key = itemKey(item)
      if (result !== 'todos' && key !== result) return false
      if (severity !== 'todas' && item.severidad !== severity) return false
      if (!inDate(item.fecha)) return false
      if (!q) return true
      return normalize([
        RESULT_STYLE[key]?.short, diseaseMeta(item.enfermedad).label, RESULT_DESC[key], 'maíz', item.severidad,
        fmtDateTime(item.fecha), fmtLong(item.fecha),
      ].join(' ')).includes(q)
    })
    const byDate = (a, b) => new Date(b.fecha) - new Date(a.fecha)
    const sorters = {
      recientes: byDate,
      antiguos: (a, b) => byDate(b, a),
      mayor: (a, b) => affectedOf(b) - affectedOf(a) || byDate(a, b),
      menor: (a, b) => affectedOf(a) - affectedOf(b) || byDate(a, b),
    }
    return [...list].sort(sorters[sort] ?? byDate)
  }, [history, query, period, dateFrom, dateTo, result, severity, sort])

  const paged = usePaged(filtered, [query, period, dateFrom, dateTo, result, severity, sort].join('|'))
  const activeFilters = (result !== 'todos') + (severity !== 'todas') + (period === 'rango')

  const changePeriod = (p) => {
    setPeriod(p)
    if (p !== 'rango') {
      setDateFrom('')
      setDateTo('')
    }
  }
  const setRange = (from, to) => {
    setDateFrom(from)
    setDateTo(to)
    setPeriod(from || to ? 'rango' : 'todo')
  }
  const resetFilters = () => {
    setQuery('')
    setResult('todos')
    setSeverity('todas')
    setSort('recientes')
    changePeriod('todo')
  }
  const goToPage = (p) => {
    paged.setPage(p)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const removeItem = async (item) => {
    const name = RESULT_STYLE[itemKey(item)]?.short ?? 'este resultado'
    const ok = await confirm({
      title: '¿Eliminar este análisis?',
      message: `Se borrará el diagnóstico de ${name} del ${fmtDate(item.fecha)}. Esta acción no se puede deshacer.`,
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
      message: `Se borrarán los ${plural(history.length, 'análisis', 'análisis')} individuales. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar todo',
    })
    if (!ok) return
    const results = await Promise.allSettled(history.map((i) => deleteAnalisis(i.id)))
    const failed = new Set(history
      .filter((_, idx) => results[idx].status === 'rejected' && results[idx].reason?.response?.status !== 404)
      .map((i) => i.id))
    onHistoryChange?.(history.filter((i) => failed.has(i.id)))
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
    const recs = recommendationsFor(item.enfermedad)
    const text = [
      `Diagnóstico: ${diseaseMeta(item.enfermedad).label}`,
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

  const detailItem = detailId ? history.find((i) => i.id === detailId) : null

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        <KpiCard tone="mint" icon={<IcoImage sw={2.2}/>} value={kpis.total} label="Análisis realizados" series={kpis.sTotal} title="Análisis por semana (últimas 8 semanas)"/>
        <KpiCard
          tone="leaf"
          icon={<IcoLeafFilled/>}
          value={kpis.avgAff == null ? '—' : fmtPct(kpis.avgAff)}
          label="Promedio de afectación"
          series={kpis.sAff}
          title="Área afectada promedio en los análisis con enfermedad"
        />
        <KpiCard tone="blue" icon={<IcoShieldCheck/>} value={kpis.healthy} label="Cultivos sanos" series={kpis.sHealthy} title="Análisis en los que no se detectó enfermedad"/>
        <KpiCard tone="purple" icon={<IcoLotus sw={2.1}/>} value={kpis.diseases} label="Enfermedades detectadas" series={kpis.sSick} title="Tizón, roya y mancha blanca: cuántas aparecieron en tus análisis"/>
      </div>

      <section ref={listRef} className={`${CARD} scroll-mt-20 px-3 pb-3 pt-2.5 sm:px-3.5`}>
        <ListHeader
          title="Listado de análisis"
          query={query}
          onQuery={setQuery}
          placeholder="Buscar por fecha, cultivo o enfermedad…"
          period={period}
          onPeriod={changePeriod}
          filter={(
            <FilterMenu count={activeFilters}>
              <FilterGroup label="Resultado">
                {RESULT_FILTERS.map(([id, label]) => (
                  <Pill key={id} active={result === id} onClick={() => setResult(id)} dot={id === 'todos' ? null : resultColor(id, isDark)}>{label}</Pill>
                ))}
              </FilterGroup>
              <FilterGroup label="Severidad">
                {SEVERITY_FILTERS.map(([id, label]) => <Pill key={id} active={severity === id} onClick={() => setSeverity(id)}>{label}</Pill>)}
              </FilterGroup>
              <FilterGroup label="Ordenar por">
                {PLANT_SORTS.map((o) => <Pill key={o.id} active={sort === o.id} onClick={() => setSort(o.id)}>{o.label}</Pill>)}
              </FilterGroup>
              <FilterGroup label="Rango de fechas">
                <DateField label="Desde" value={dateFrom} onChange={(v) => setRange(v, dateTo)} max={dateTo || undefined}/>
                <DateField label="Hasta" value={dateTo} onChange={(v) => setRange(dateFrom, v)} min={dateFrom || undefined}/>
              </FilterGroup>
              <FilterFooter onReset={resetFilters} onClearAll={history.length ? clearAll : null}/>
            </FilterMenu>
          )}
        />

        {history.length === 0 ? (
          <ListEmpty
            icon={<IcoLeafFilled/>}
            title="Aún no hay análisis individuales"
            text="Sube una foto de una hoja de maíz y el diagnóstico aparecerá aquí con su severidad y recomendaciones."
            action={onGoAnalizar && <EmptyAction onClick={() => onGoAnalizar('individual')} icon={<IcoScan className="h-4 w-4"/>}>Analizar una imagen</EmptyAction>}
          />
        ) : filtered.length === 0 ? (
          <ListEmpty
            icon={<IcoSearch/>}
            title="Sin resultados"
            text="No hay análisis que coincidan con la búsqueda, los filtros o el periodo elegido."
            action={<button type="button" onClick={resetFilters} className={`${PILL_BTN} h-[30px] px-4`}>Limpiar filtros</button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <TableHead cols={PLANT_COLS}/>
                <tbody>
                  {paged.items.map((item) => (
                    <AnalysisRow key={item.id} item={item} onOpen={() => setDetailId(item.id)} onExport={() => exportPdf(item)} exporting={exportingId === item.id}/>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {paged.items.map((item) => (
                <AnalysisCardMobile key={item.id} item={item} onOpen={() => setDetailId(item.id)} onExport={() => exportPdf(item)} exporting={exportingId === item.id}/>
              ))}
            </ul>
          </>
        )}

        <Pagination paged={paged} onPage={goToPage} noun="análisis"/>
      </section>

      {detailItem && (
        <AnalysisDetail
          key={detailItem.id}
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
//    Historial por parcela (cada fila es un análisis de parcela, es decir, una visita)
// ══════════════════════════════════════════════════════════════════════════════
function visitInfo(visit) {
  const done = (visit.samples ?? []).filter((s) => s.status === 'done' && s.result)
  const total = done.length || visit.stats?.total || 0
  const sick = done.length ? done.filter((s) => !isHealthyClass(s.result.target_class)).length : (visit.stats?.sick ?? 0)
  const avg = Number(visit.stats?.avgAff ?? 0)
  return { done, total, sick, avg, key: visitResultKey(visit) ?? 'otro', severity: lotSeverity(avg) }
}

const visitVertices = (visit, parcela) => (visit.vertices?.length >= 3 ? visit.vertices : (parcela.vertices ?? []))

function makeSampleIcon(sample, color, crema) {
  const num = String(sample.label ?? '').replace('P', '')
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:${crema ? '#3d3010' : 'white'};font-size:9px;font-weight:900;">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function FitBounds({ vertices }) {
  const map = useMap()
  useEffect(() => {
    if (!vertices?.length) return
    map.fitBounds(L.latLngBounds(vertices), { padding: [24, 24], maxZoom: 18 })
  }, [map, vertices])
  return null
}

function VisitMap({ visit, vertices }) {
  const { isDark } = useTheme()
  const samples = (visit.samples ?? []).filter((s) => s.result && Array.isArray(s.coords))
  return (
    <MapContainer center={[vertices[0].lat, vertices[0].lng]} zoom={16} className="h-full w-full" zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false}>
      <TileLayer attribution="&copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19}/>
      <FitBounds vertices={vertices}/>
      <Polygon positions={vertices} pathOptions={{ color: '#34d399', fillColor: '#10b981', fillOpacity: 0.15, weight: 2 }}/>
      {samples.map((s) => {
        const key = diseaseKey(s.result.target_class) ?? 'otro'
        return (
          <Marker key={s.id} position={[s.coords[1], s.coords[0]]} icon={makeSampleIcon(s, resultColor(key, isDark), key === 'mancha')}>
            <Tooltip direction="top" offset={[0, -12]}>
              <span className="text-[10px] font-bold">
                {s.label} — {RESULT_STYLE[key]?.short ?? 'Sin clasificar'}{key !== 'sano' ? ` ${fmtPct(s.result.confidence)}` : ''}
              </span>
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

function SampleResult({ sample }) {
  const { isDark } = useTheme()
  if (!sample?.result) return <span className="text-slate-300 dark:text-slate-600">—</span>
  const key = diseaseKey(sample.result.target_class) ?? 'otro'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: resultColor(key, isDark) }}/>
      <span className="text-[#334155] dark:text-slate-300">{RESULT_STYLE[key]?.short ?? 'Sin clasificar'}</span>
      {key !== 'sano' && <span className="font-extrabold text-[#0b1226] dark:text-white">{fmtPct(sample.result.confidence)}</span>}
    </span>
  )
}

function TrendLineChart({ visits, currentId }) {
  const gradId = `trend${useId().replace(/:/g, '')}`
  const w = 560
  const h = 170
  const left = 34
  const right = 14
  const top = 14
  const bottom = 26
  const chrono = [...visits].reverse()
  const n = chrono.length
  const avg = (v) => Number(v.stats?.avgAff ?? 0)
  const max = Math.max(...chrono.map(avg), SEVERITY_LIMITS.grave + 5)
  const x = (i) => (n <= 1 ? (left + w - right) / 2 : left + (i / (n - 1)) * (w - left - right))
  const y = (v) => top + (1 - v / max) * (h - top - bottom)
  const line = chrono.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(avg(v)).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)} ${h - bottom} L${x(0).toFixed(1)} ${h - bottom} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Evolución de la afectación promedio por visita">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[SEVERITY_LIMITS.moderada, SEVERITY_LIMITS.grave].map((t) => (
        <g key={t}>
          <line x1={left} x2={w - right} y1={y(t)} y2={y(t)} strokeDasharray="4 4" className="stroke-slate-300 dark:stroke-white/15"/>
          <text x={left - 6} y={y(t) + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: 9, fontWeight: 600 }}>{t}%</text>
        </g>
      ))}
      <line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} className="stroke-slate-200 dark:stroke-white/10"/>
      {n > 1 && <path d={area} fill={`url(#${gradId})`}/>}
      <path d={line} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {chrono.map((v, i) => {
        const cur = v.id === currentId
        return (
          <g key={v.id}>
            {cur && <circle cx={x(i)} cy={y(avg(v))} r="9.5" fill="none" stroke="#0b8a4b" strokeOpacity="0.45" strokeWidth="2"/>}
            <circle cx={x(i)} cy={y(avg(v))} r={cur ? 6 : 4.5} fill={SEVERITY_PALETTE[lotSeverity(avg(v))]} strokeWidth="2" className="stroke-white dark:stroke-[#0f1a2b]"/>
            <text x={x(i)} y={h - 8} textAnchor="middle" className={cur ? 'fill-[#0b6b35] dark:fill-emerald-300' : 'fill-slate-400'} style={{ fontSize: 9, fontWeight: cur ? 800 : 600 }}>
              {fmtShort(v.fecha)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const VISIT_COLS = [
  { label: 'Mapa', className: 'w-[124px]' },
  { label: 'Diagnóstico' },
  { label: 'Parcela', className: 'hidden w-[15%] xl:table-cell' },
  { label: 'Zonas afectadas', className: 'w-[104px] xl:w-[12%]' },
  { label: 'Fecha', className: 'w-[172px] xl:w-[20%]' },
  { label: 'Acciones', className: 'w-[150px] xl:w-[17%]' },
]
const VISIT_SORTS = [
  { id: 'recientes', label: 'Más recientes' },
  { id: 'antiguos', label: 'Más antiguos' },
  { id: 'mayor', label: 'Mayor afectación' },
  { id: 'zonas', label: 'Más zonas afectadas' },
]

const visitName = (info) => (info.key === 'sano' ? 'Sano' : (RESULT_STYLE[info.key]?.short ?? 'Sin clasificar'))
const visitDesc = (info) => (info.sick > 0
  ? `${info.sick} de ${plural(info.total, 'zona', 'zonas')} con síntomas`
  : `${plural(info.total, 'zona', 'zonas')} sin síntomas`)

function ZonesRing({ info }) {
  const { isDark } = useTheme()
  return (
    <Ring
      pct={info.total ? (info.sick / info.total) * 100 : 0}
      color={info.sick ? resultColor(info.key, isDark) : undefined}
      title="Zonas de muestreo con síntomas"
      srLabel={`${info.sick} de ${info.total} zonas con síntomas`}
    >
      {info.sick}/{info.total}
    </Ring>
  )
}

function VisitRow({ entry, onOpen, onAnalizar }) {
  const { visit, parcela, info } = entry
  const label = `${parcela.nombre}, ${fmtDateTime(visit.fecha)}`
  return (
    <tr className="transition-colors hover:bg-[#f7fbf8] dark:hover:bg-white/[0.03]">
      <td className={TD}>
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={onOpen} className="block cursor-pointer overflow-hidden rounded-lg ring-1 ring-black/5 dark:ring-white/10">
          <ParcelMiniMap vertices={visitVertices(visit, parcela)} samples={visit.samples} width={100} height={40} dot={2.6}/>
        </button>
      </td>
      <td className={`${TD} pr-3`}><DiagnosisCell resultKey={info.key} name={visitName(info)} desc={visitDesc(info)}/></td>
      <td className={`${TD} hidden pr-2 xl:table-cell`}><ChipGreen icon={<IcoPin className="h-3.5 w-3.5"/>}>{parcela.nombre}</ChipGreen></td>
      <td className={TD}><ZonesRing info={info}/></td>
      <td className={TD}><DateCell iso={visit.fecha}/></td>
      <td className={`${TD} pr-2`}>
        <RowActions label={label} onOpen={onOpen} second={onAnalizar && { label: 'Analizar de nuevo', icon: <IcoScan className="h-3.5 w-3.5"/>, onClick: onAnalizar }}/>
      </td>
    </tr>
  )
}

function VisitCardMobile({ entry, onOpen, onAnalizar }) {
  const { visit, parcela, info } = entry
  const label = `${parcela.nombre}, ${fmtDateTime(visit.fecha)}`
  return (
    <li className="rounded-xl border border-[#eef1f5] bg-white p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={onOpen} className="block overflow-hidden rounded-lg ring-1 ring-black/5 dark:ring-white/10">
          <ParcelMiniMap vertices={visitVertices(visit, parcela)} samples={visit.samples} width={78} height={52} dot={2.4}/>
        </button>
        <div className="min-w-0 flex-1">
          <DiagnosisCell resultKey={info.key} name={visitName(info)} desc={visitDesc(info)}/>
          <div className="mt-1"><DateCell iso={visit.fecha}/></div>
        </div>
        <ZonesRing info={info}/>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0"><ChipGreen icon={<IcoPin className="h-3.5 w-3.5"/>}>{parcela.nombre}</ChipGreen></span>
        <RowActions label={label} onOpen={onOpen} second={onAnalizar && { label: 'Analizar de nuevo', icon: <IcoScan className="h-3.5 w-3.5"/>, onClick: onAnalizar }}/>
      </div>
    </li>
  )
}

const VISIT_TABS = [
  { id: 'resumen', label: 'Mapa y resultados', Icon: IcoMap },
  { id: 'zonas', label: 'Zonas muestreadas', Icon: IcoList },
  { id: 'evolucion', label: 'Evolución de la parcela', Icon: IcoTrend },
  { id: 'recs', label: 'Recomendaciones', Icon: IcoBulb },
]

function VisitDetail({ entry, onSelectVisit, onClose, onAnalizar, onRename, onDeleteVisit, onDeleteParcela }) {
  const { isDark } = useTheme()
  const [tab, setTab] = useState('resumen')
  const idBase = `vd${useId().replace(/:/g, '')}`
  const { visit, parcela, info } = entry
  const vertices = visitVertices(visit, parcela)
  const healthy = info.key === 'sano'
  const name = healthy ? 'Lote sano' : (RESULT_STYLE[info.key]?.short ?? 'Sin clasificar')
  const cls = CLASS_OF_KEY[info.key]
  const recs = cls ? recommendationsFor(cls) : []
  const chem = cls ? (CHEMICAL_TREATMENTS[cls] ?? null) : null
  const counts = {}
  info.done.forEach((s) => {
    const k = diseaseKey(s.result.target_class) ?? 'otro'
    counts[k] = (counts[k] ?? 0) + 1
  })
  const order = ['sano', 'roya', 'tizon', 'mancha', 'otro'].filter((k) => counts[k])
  const center = vertices.length
    ? [vertices.reduce((a, v) => a + v.lat, 0) / vertices.length, vertices.reduce((a, v) => a + v.lng, 0) / vertices.length]
    : null
  const visits = parcela.visits
  const idx = visits.findIndex((v) => v.id === visit.id)
  const prev = idx >= 0 ? visits[idx + 1] : null
  const delta = prev ? Number((info.avg - Number(prev.stats?.avgAff ?? 0)).toFixed(1)) : null
  const chrono = [...visits].reverse()
  const zoneRows = (visits[0]?.samples ?? []).map((s) => ({
    label: s.label,
    cells: chrono.map((v) => v.samples?.find((x) => x.label === s.label) ?? null),
  }))
  const menu = [
    onAnalizar && { label: 'Analizar de nuevo', Icon: IcoScan, onClick: onAnalizar },
    { label: 'Renombrar parcela', Icon: IcoPencil, onClick: onRename },
    { label: 'Eliminar este análisis', Icon: IcoTrash, onClick: onDeleteVisit, danger: true },
    { label: 'Eliminar la parcela', Icon: IcoTrash, onClick: onDeleteParcela, danger: true },
  ].filter(Boolean)

  return (
    <DetailShell labelledBy={`${idBase}-title`} onClose={onClose}>
      <DetailHeader
        idBase={idBase}
        title="Detalle del análisis"
        subtitle={`Análisis por parcela · ${parcela.nombre}`}
        fecha={visit.fecha}
        onClose={onClose}
        actions={<MenuButton items={menu}/>}
      >
        <Tabs idBase={idBase} tabs={VISIT_TABS} active={tab} onChange={setTab}/>
      </DetailHeader>

      <TabPanel idBase={idBase} active={tab}>
        {tab === 'resumen' && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
              <figure className="relative isolate order-1 aspect-[1.53] lg:order-none overflow-hidden rounded-[14px] bg-[#0f1a14] ring-1 ring-black/5 dark:ring-white/10">
                {vertices.length >= 3 ? (
                  <VisitMap visit={visit} vertices={vertices}/>
                ) : (
                  <p className="absolute inset-0 grid place-items-center text-[11px] text-white/70">Mapa no disponible</p>
                )}
                <span className="pointer-events-none absolute left-3 top-3 z-[1001] inline-flex items-center gap-1.5 rounded-full bg-[#1b211c]/80 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm">
                  <IcoLeafFilled className="h-3.5 w-3.5 text-[#3ddc84]"/>
                  {healthy ? 'Sano' : name}
                </span>
              </figure>
              <div className="order-3 min-w-0 lg:order-none">
              <ResumenCard
                segments={order.map((k) => ({ key: k, value: counts[k], color: resultColor(k, isDark) }))}
                legend={order.map((k) => ({
                  label: RESULT_STYLE[k]?.short ?? 'Sin clasificar',
                  value: plural(counts[k], 'zona', 'zonas'),
                  color: resultColor(k, isDark),
                }))}
                caption="Resultado de cada zona de muestreo de esta visita."
              />
              </div>
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
              <div className="order-2 min-w-0 lg:order-none">
              <DiagnosisCard
                resultKey={info.key}
                name={name}
                metricLabel="Afectación promedio del lote"
                metricValue={fmtPct(info.avg)}
                metricPct={info.avg}
                side={(
                  <>
                    <SideStat icon={<IcoBarsFilled className={`h-[18px] w-[18px] ${SEV_ICON[info.severity] ?? 'text-slate-400'}`}/>} label="Severidad">
                      <SeverityChip level={info.severity}/>
                    </SideStat>
                    <div className="h-px bg-[#cfe8d9] dark:bg-white/10"/>
                    <SideStat icon={<IcoMap className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>} label="Zonas afectadas">
                      <span className="font-[Manrope,Inter,sans-serif] text-[18px] font-extrabold leading-none text-[#002c28] dark:text-white">
                        {info.sick}<span className="text-[12px] font-bold text-[#55607a] dark:text-slate-400"> de {info.total}</span>
                      </span>
                    </SideStat>
                  </>
                )}
              />
              </div>
              <div className="order-4 min-w-0 lg:order-none">
                <RecsMiniCard recs={recs} onMore={() => setTab('recs')}/>
              </div>
              <div className="order-5 min-w-0 lg:order-none">
              <InfoCard
                action={(
                  <button type="button" onClick={onRename} aria-label="Renombrar parcela" title="Renombrar parcela" className="grid h-6 w-6 place-items-center rounded-full text-[#4e677c] transition hover:bg-white hover:text-[#0b6b35] dark:text-slate-400 dark:hover:bg-white/10">
                    <IcoPencil className="h-3.5 w-3.5"/>
                  </button>
                )}
                cells={[
                  { label: 'Parcela', value: parcela.nombre, icon: <IcoPin className="h-5 w-5"/> },
                  { label: 'Área', value: `${Number(parcela.ha ?? visit.ha ?? 0).toFixed(2)} ha`, icon: <IcoMap className="h-5 w-5"/> },
                  { label: 'Coordenadas', value: center ? `${center[0].toFixed(4)}, ${center[1].toFixed(4)}` : '—', icon: <IcoCrosshair className="h-5 w-5"/> },
                ]}
              />
              </div>
            </div>
          </div>
        )}

        {tab === 'zonas' && (
          <div className="overflow-x-auto rounded-[14px] border border-[#e6ecf0] dark:border-white/10">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr className="bg-[#edf0f6] text-[10.5px] text-[#44506c] dark:bg-white/[0.05] dark:text-slate-400">
                  <th scope="col" className="px-4 py-2 font-medium">Zona</th>
                  <th scope="col" className="px-4 py-2 font-medium">Resultado</th>
                  <th scope="col" className="px-4 py-2 font-medium">Área afectada</th>
                  <th scope="col" className="px-4 py-2 font-medium">Severidad</th>
                  <th scope="col" className="px-4 py-2 font-medium">Coordenadas</th>
                </tr>
              </thead>
              <tbody>
                {(visit.samples ?? []).map((s) => {
                  const k = s.result ? (diseaseKey(s.result.target_class) ?? 'otro') : null
                  const sev = s.result ? severityOf(s.result.target_class, s.result.confidence) : null
                  return (
                    <tr key={s.id} className="border-t border-[#eef1f5] dark:border-white/5">
                      <td className="px-4 py-2 font-bold text-[#0b1226] dark:text-white">{s.label}</td>
                      <td className="px-4 py-2">
                        {k ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: resultColor(k, isDark) }}/>
                            <span className="text-[#334155] dark:text-slate-200">{RESULT_STYLE[k]?.short ?? 'Sin clasificar'}</span>
                          </span>
                        ) : <span className="text-slate-400">Sin analizar</span>}
                      </td>
                      <td className="px-4 py-2 font-semibold text-[#1f2d48] dark:text-slate-200">{s.result ? fmtPct(k === 'sano' ? 0 : s.result.confidence) : '—'}</td>
                      <td className="px-4 py-2">{sev ? <SeverityChip level={sev}/> : '—'}</td>
                      <td className={`px-4 py-2 tabular-nums ${MUTED}`}>{Array.isArray(s.coords) ? `${s.coords[1].toFixed(5)}, ${s.coords[0].toFixed(5)}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'evolucion' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className={`${SOFT} px-3.5 py-2.5`}>
                <p className={`text-[10px] ${MUTED}`}>Análisis de esta parcela</p>
                <p className="font-[Manrope,Inter,sans-serif] text-[18px] font-extrabold text-[#0b1226] dark:text-white">{visits.length}</p>
              </div>
              <div className={`${SOFT} px-3.5 py-2.5`}>
                <p className={`text-[10px] ${MUTED}`}>Afectación en este análisis</p>
                <p className="font-[Manrope,Inter,sans-serif] text-[18px] font-extrabold text-[#0b1226] dark:text-white">{fmtPct(info.avg)}</p>
              </div>
              <div className={`${SOFT} px-3.5 py-2.5`}>
                <p className={`text-[10px] ${MUTED}`}>Cambio vs. el análisis anterior</p>
                <p className={`font-[Manrope,Inter,sans-serif] text-[18px] font-extrabold ${delta > 0 ? 'text-red-600 dark:text-red-400' : delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#0b1226] dark:text-white'}`}>
                  {delta == null ? '—' : delta === 0 ? 'Sin cambio' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} pts`}
                </p>
              </div>
            </div>
            <section className={`${PLAIN} px-4 pb-2 pt-3`}>
              <h3 className={H3}>Evolución de la afectación promedio</h3>
              <p className={`text-[10.5px] ${MUTED}`}>Las líneas punteadas marcan los umbrales de severidad moderada y grave. El punto marcado es este análisis.</p>
              <TrendLineChart visits={visits} currentId={visit.id}/>
            </section>
            {chrono.length > 1 && (
              <section className={`${PLAIN} overflow-hidden`}>
                <div className="px-4 pb-2 pt-3">
                  <h3 className={H3}>Comparación por zona</h3>
                  <p className={`text-[10.5px] ${MUTED}`}>Cómo cambió cada punto de muestreo entre análisis</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-[#edf0f6] text-[10.5px] text-[#44506c] dark:bg-white/[0.05] dark:text-slate-400">
                        <th scope="col" className="px-4 py-2 font-medium">Zona</th>
                        {chrono.map((v) => (
                          <th key={v.id} scope="col" className={`whitespace-nowrap px-4 py-2 font-medium ${v.id === visit.id ? 'text-[#0b6b35] dark:text-emerald-300' : ''}`}>{fmtDate(v.fecha)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {zoneRows.map((row) => (
                        <tr key={row.label} className="border-t border-[#eef1f5] dark:border-white/5">
                          <td className="px-4 py-2 font-bold text-[#0b1226] dark:text-white">{row.label}</td>
                          {row.cells.map((cell, j) => <td key={j} className="px-4 py-2"><SampleResult sample={cell}/></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {visits.length > 1 && (
              <section>
                <h3 className={`mb-2 ${H3}`}>Análisis de {parcela.nombre}</h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {visits.map((v) => {
                    const vi = visitInfo(v)
                    const current = v.id === visit.id
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => onSelectVisit(v.id)}
                          aria-current={current ? 'true' : undefined}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${
                            current ? 'border-[#9fd8b7] bg-[#f0faf4] dark:border-emerald-400/40 dark:bg-emerald-400/10' : 'border-[#e6ecf0] bg-white hover:border-[#bfe3c9] dark:border-white/10 dark:bg-white/[0.03]'
                          }`}
                        >
                          <span className="overflow-hidden rounded-md"><ParcelMiniMap vertices={visitVertices(v, parcela)} samples={v.samples} width={56} height={34} dot={2}/></span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold text-[#0b1226] dark:text-white">{fmtDateTime(v.fecha)}</span>
                            <span className={`block truncate text-[10px] ${MUTED}`}>{visitName(vi)} · {fmtPct(vi.avg)} de afectación · {vi.sick}/{vi.total} zonas</span>
                          </span>
                          {current && <span className="shrink-0 rounded-full bg-[#0b8a4b] px-2 py-0.5 text-[9.5px] font-bold text-white">Viendo</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === 'recs' && (recs.length ? (
          <TreatmentDetails recs={recs} chemData={chem}/>
        ) : (
          <p className={`py-6 text-center text-[12px] ${MUTED}`}>No hay recomendaciones para este resultado.</p>
        ))}
      </TabPanel>
    </DetailShell>
  )
}

function ParcelHistory({ summaries, onChanged, onGoAnalizarParcela, onGoAnalizar, confirm, toast }) {
  const { isDark } = useTheme()
  const [query, setQuery] = useState('')
  const [period, setPeriod] = useState('todo')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [result, setResult] = useState('todos')
  const [severity, setSeverity] = useState('todas')
  const [parcelaId, setParcelaId] = useState('todas')
  const [sort, setSort] = useState('recientes')
  const [detailId, setDetailId] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const listRef = useRef(null)

  const entries = useMemo(() => summaries
    .flatMap((p) => p.visits.map((v) => ({ id: v.id, visit: v, parcela: p, info: visitInfo(v) })))
    .sort((a, b) => new Date(b.visit.fecha) - new Date(a.visit.fecha)), [summaries])
  const conAnalisis = useMemo(() => summaries.filter((p) => p.visits.length), [summaries])

  const kpis = useMemo(() => {
    const sick = entries.filter((e) => e.info.sick > 0)
    const diseases = new Set()
    entries.forEach((e) => {
      if (e.info.done.length) {
        e.info.done.forEach((s) => {
          const k = diseaseKey(s.result.target_class)
          if (k && k !== 'sano') diseases.add(k)
        })
      } else if (e.info.key !== 'sano' && e.info.key !== 'otro') {
        diseases.add(e.info.key)
      }
    })
    return {
      total: entries.length,
      avgAff: sick.length ? sick.reduce((a, e) => a + e.info.avg, 0) / sick.length : null,
      ha: conAnalisis.reduce((a, p) => a + (Number(p.ha) || 0), 0),
      parcelas: conAnalisis.length,
      diseases: diseases.size,
      sTotal: weeklySeries(entries.map((e) => ({ date: e.visit.fecha }))),
      sAff: weeklySeries(sick.map((e) => ({ date: e.visit.fecha, value: e.info.avg })), 'mean'),
      sHa: weeklySeries(entries.map((e) => ({ date: e.visit.fecha, value: Number(e.parcela.ha) || 0 }))),
      sSick: weeklySeries(sick.map((e) => ({ date: e.visit.fecha }))),
    }
  }, [entries, conAnalisis])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const inDate = dateFilter(period, dateFrom, dateTo)
    const list = entries.filter((e) => {
      if (parcelaId !== 'todas' && e.parcela.id !== parcelaId) return false
      if (result !== 'todos' && e.info.key !== result) return false
      if (severity !== 'todas' && e.info.severity !== severity) return false
      if (!inDate(e.visit.fecha)) return false
      if (!q) return true
      return normalize([
        e.parcela.nombre, RESULT_STYLE[e.info.key]?.short, e.info.severity, 'maíz parcela lote',
        fmtDateTime(e.visit.fecha), fmtLong(e.visit.fecha),
      ].join(' ')).includes(q)
    })
    const byDate = (a, b) => new Date(b.visit.fecha) - new Date(a.visit.fecha)
    const ratio = (e) => (e.info.total ? e.info.sick / e.info.total : 0)
    const sorters = {
      recientes: byDate,
      antiguos: (a, b) => byDate(b, a),
      mayor: (a, b) => b.info.avg - a.info.avg || byDate(a, b),
      zonas: (a, b) => ratio(b) - ratio(a) || byDate(a, b),
    }
    return [...list].sort(sorters[sort] ?? byDate)
  }, [entries, query, period, dateFrom, dateTo, result, severity, parcelaId, sort])

  const paged = usePaged(filtered, [query, period, dateFrom, dateTo, result, severity, parcelaId, sort].join('|'))
  const activeFilters = (result !== 'todos') + (severity !== 'todas') + (parcelaId !== 'todas') + (period === 'rango')

  const changePeriod = (p) => {
    setPeriod(p)
    if (p !== 'rango') {
      setDateFrom('')
      setDateTo('')
    }
  }
  const setRange = (from, to) => {
    setDateFrom(from)
    setDateTo(to)
    setPeriod(from || to ? 'rango' : 'todo')
  }
  const resetFilters = () => {
    setQuery('')
    setResult('todos')
    setSeverity('todas')
    setParcelaId('todas')
    setSort('recientes')
    changePeriod('todo')
  }
  const goToPage = (p) => {
    paged.setPage(p)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const removeVisit = async (entry) => {
    const ok = await confirm({
      title: '¿Eliminar este análisis?',
      message: `Se borrará el análisis de "${entry.parcela.nombre}" del ${fmtDate(entry.visit.fecha)}. Esta acción no se puede deshacer.`,
    })
    if (!ok) return
    deleteParcelVisit(entry.visit.id)
    setDetailId(null)
    onChanged()
    toast('Análisis eliminado')
  }

  const removeParcela = async (parcela) => {
    const ok = await confirm({
      title: `¿Eliminar "${parcela.nombre}"?`,
      message: `Se borrarán la parcela y sus ${plural(parcela.visits.length, 'análisis', 'análisis')}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar parcela',
    })
    if (!ok) return
    deleteParcela(parcela.id)
    setDetailId(null)
    onChanged()
    toast('Parcela eliminada')
  }

  const saveName = (nombre) => {
    renameParcela(renameTarget.id, nombre)
    setRenameTarget(null)
    onChanged()
    toast('Parcela renombrada')
  }

  const analizar = onGoAnalizarParcela ? (parcela) => onGoAnalizarParcela(parcela.id) : null
  const detail = detailId != null ? entries.find((e) => e.id === detailId) : null

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        <KpiCard tone="mint" icon={<IcoMap sw={2.2}/>} value={kpis.total} label="Análisis realizados" series={kpis.sTotal} title="Análisis de parcela por semana (últimas 8 semanas)"/>
        <KpiCard
          tone="leaf"
          icon={<IcoLeafFilled/>}
          value={kpis.avgAff == null ? '—' : fmtPct(kpis.avgAff)}
          label="Promedio de afectación"
          series={kpis.sAff}
          title="Afectación promedio de los lotes en los análisis con síntomas"
        />
        <KpiCard
          tone="blue"
          icon={<IcoShieldCheck/>}
          value={`${kpis.ha.toFixed(1)} ha`}
          label="Hectáreas monitoreadas"
          series={kpis.sHa}
          title={`${plural(kpis.parcelas, 'parcela analizada', 'parcelas analizadas')}`}
        />
        <KpiCard tone="purple" icon={<IcoLotus sw={2.1}/>} value={kpis.diseases} label="Enfermedades detectadas" series={kpis.sSick} title="Tizón, roya y mancha blanca: cuántas aparecieron en tus parcelas"/>
      </div>

      <section ref={listRef} className={`${CARD} scroll-mt-20 px-3 pb-3 pt-2.5 sm:px-3.5`}>
        <ListHeader
          title="Listado de análisis por parcela"
          query={query}
          onQuery={setQuery}
          placeholder="Buscar por parcela, fecha o enfermedad…"
          period={period}
          onPeriod={changePeriod}
          filter={(
            <FilterMenu count={activeFilters}>
              {conAnalisis.length > 1 && (
                <FilterGroup label="Parcela">
                  <select
                    value={parcelaId}
                    onChange={(e) => setParcelaId(e.target.value)}
                    aria-label="Parcela"
                    className="h-[27px] max-w-full rounded-lg border border-[#e3e8ee] bg-white px-2 text-[11px] text-[#1f2d48] outline-none [color-scheme:light] focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-[#111c2e] dark:text-slate-200 dark:[color-scheme:dark]"
                  >
                    <option value="todas">Todas las parcelas</option>
                    {conAnalisis.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </FilterGroup>
              )}
              <FilterGroup label="Resultado">
                {RESULT_FILTERS.map(([id, label]) => (
                  <Pill key={id} active={result === id} onClick={() => setResult(id)} dot={id === 'todos' ? null : resultColor(id, isDark)}>{label}</Pill>
                ))}
              </FilterGroup>
              <FilterGroup label="Severidad del lote">
                {SEVERITY_FILTERS.map(([id, label]) => <Pill key={id} active={severity === id} onClick={() => setSeverity(id)}>{label}</Pill>)}
              </FilterGroup>
              <FilterGroup label="Ordenar por">
                {VISIT_SORTS.map((o) => <Pill key={o.id} active={sort === o.id} onClick={() => setSort(o.id)}>{o.label}</Pill>)}
              </FilterGroup>
              <FilterGroup label="Rango de fechas">
                <DateField label="Desde" value={dateFrom} onChange={(v) => setRange(v, dateTo)} max={dateTo || undefined}/>
                <DateField label="Hasta" value={dateTo} onChange={(v) => setRange(dateFrom, v)} min={dateFrom || undefined}/>
              </FilterGroup>
              <FilterFooter onReset={resetFilters}/>
            </FilterMenu>
          )}
        />

        {entries.length === 0 ? (
          <ListEmpty
            icon={<IcoMap/>}
            title="Aún no hay análisis de parcela"
            text="Dibuja tu lote en el mapa y analiza sus puntos de muestreo: cada análisis aparecerá aquí para que sigas su evolución."
            action={onGoAnalizar && <EmptyAction onClick={() => onGoAnalizar('parcela')} icon={<IcoMap className="h-4 w-4"/>}>Analizar una parcela</EmptyAction>}
          />
        ) : filtered.length === 0 ? (
          <ListEmpty
            icon={<IcoSearch/>}
            title="Sin resultados"
            text="No hay análisis que coincidan con la búsqueda, los filtros o el periodo elegido."
            action={<button type="button" onClick={resetFilters} className={`${PILL_BTN} h-[30px] px-4`}>Limpiar filtros</button>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <TableHead cols={VISIT_COLS}/>
                <tbody>
                  {paged.items.map((e) => (
                    <VisitRow key={e.id} entry={e} onOpen={() => setDetailId(e.id)} onAnalizar={analizar && (() => analizar(e.parcela))}/>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {paged.items.map((e) => (
                <VisitCardMobile key={e.id} entry={e} onOpen={() => setDetailId(e.id)} onAnalizar={analizar && (() => analizar(e.parcela))}/>
              ))}
            </ul>
          </>
        )}

        <Pagination paged={paged} onPage={goToPage} noun="análisis"/>
      </section>

      {detail && (
        <VisitDetail
          entry={detail}
          onSelectVisit={setDetailId}
          onClose={() => setDetailId(null)}
          onAnalizar={analizar && (() => analizar(detail.parcela))}
          onRename={() => setRenameTarget(detail.parcela)}
          onDeleteVisit={() => removeVisit(detail)}
          onDeleteParcela={() => removeParcela(detail.parcela)}
        />
      )}
      {renameTarget && <RenameDialog initial={renameTarget.nombre} onCancel={() => setRenameTarget(null)} onSave={saveName}/>}
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
    <div className="fade-up relative isolate space-y-3.5">
      <PageGlow/>
      <HistorialHero tab={tab}/>

      {tab !== 'parcelas' ? (
        <PlantHistory history={history} onHistoryChange={onHistoryChange} onGoAnalizar={onGoAnalizar} confirm={confirm} toast={toast}/>
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
