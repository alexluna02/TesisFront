import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from './ThemeContext.jsx'
import { ProductionBenchmark, useModelLoadTime } from './Rendimiento.jsx'
import { ZoomOverlay } from './Analizar.jsx'
import {
  CLASSES, MODEL_INFO, DATASET, DATASET_SPLIT, TRAINING, FINAL_METRICS, TEST_PER_CLASS,
  VAL_PER_CLASS, ENCODER_COMPARISON, CONFUSION, INFERENCE, HISTORY,
} from './data/modelCard.js'
import { resultColor } from './resultados.js'
import { PageGlow } from './PageHero.jsx'
import gradcamImg from './Imagenes/modelo/gradcam_test.jpg'
import trainingImg from './Imagenes/modelo/entrenamiento_b0.jpg'
import dronImg from './Imagenes/modelo-dron.webp'

// «Ficha técnica del modelo» según la maqueta del usuario (images/23.png). Todos los valores salen de
// data/modelCard.js (log del entrenamiento y artículo de tesis): nada se estima aquí.

// Paleta categórica de las dos curvas de pérdida (validada con dataviz validate_palette en claro y oscuro)
const LOSS_COLORS = { light: ['#2a78d6', '#eb6834'], dark: ['#3987e5', '#d95926'] }
const MIOU_COLOR = { light: '#0b8a4b', dark: '#34d399' }
// Color de cada clase: los de resultados de la app (Fondo = sano/fondo)
const CLASS_KEYS = ['sano', 'tizon', 'roya', 'mancha']

const TITLE = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const MUTED = 'text-[#55607a] dark:text-slate-400'
const CARD = 'rounded-2xl border border-[#e6ecf0] bg-white shadow-[0_8px_24px_-18px_rgba(15,40,30,0.35)] dark:border-[#1e3048] dark:bg-[#162032]'
const TH = 'py-1.5 text-[10px] font-semibold text-[#44506c] dark:text-slate-400'
const TD = 'border-t border-[#eef1f5] py-[5px] text-[10.5px] tabular-nums text-[#1f2d48] dark:border-white/[0.06] dark:text-slate-200'

const fmt = (v, d = 4) => (v == null ? 'N/D' : v.toFixed(d))
// Separador de miles con punto también para 4 cifras (3.015), como en la maqueta
const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoLayers = (p) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/></Svg>
const IcoGear = (p) => <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></Svg>
const IcoDb = (p) => <Svg {...p}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></Svg>
const IcoImage = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 16-5-5-9 9"/></Svg>
const IcoFile = (p) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></Svg>
const IcoTarget = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/></Svg>
const IcoBars = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
    <rect x="4" y="12" width="3.6" height="8" rx="1"/><rect x="10.2" y="6" width="3.6" height="14" rx="1"/><rect x="16.4" y="9" width="3.6" height="11" rx="1"/>
  </svg>
)
const IcoAward = (p) => <Svg {...p}><circle cx="12" cy="9" r="6"/><path d="m8.5 13.8-1.5 7.2 5-2.6 5 2.6-1.5-7.2"/><path d="m12 6 .9 1.9 2.1.3-1.5 1.5.3 2.1-1.8-1-1.8 1 .3-2.1L9 8.2l2.1-.3z" fill="currentColor"/></Svg>
const IcoChart = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></Svg>
const IcoGrid = (p) => <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></Svg>
const IcoChip = (p) => <Svg {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="0.8"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/></Svg>
const IcoTrophy = (p) => <Svg {...p}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4"/></Svg>
const IcoCog = (p) => <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></Svg>
const IcoBolt = (p) => <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></Svg>
const IcoMonitor = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></Svg>
const IcoTrend = (p) => <Svg {...p}><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></Svg>
const IcoCheck = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></Svg>
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>
const IcoZoom = (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5"/></Svg>

// ── Piezas comunes ────────────────────────────────────────────────────────────
function CardHead({ icon, title, subtitle, aside }) {
  return (
    <header className="flex items-start gap-2.5">
      <span className="mt-px text-[#0b8a4b] dark:text-emerald-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className={`text-[12.5px] leading-tight ${TITLE}`}>{title}</h3>
        {subtitle && <p className={`mt-0.5 text-[9.5px] leading-snug ${MUTED}`}>{subtitle}</p>}
      </div>
      {aside}
    </header>
  )
}

function SplitToggle({ value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-full bg-[#eef1f5] p-0.5 dark:bg-white/[0.06]">
      {[['test', 'Test'], ['val', 'Validación']].map(([k, text]) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={`h-[20px] rounded-full px-2 text-[9.5px] font-semibold transition ${value === k ? 'bg-white text-[#0b6b35] shadow-sm dark:bg-emerald-500/20 dark:text-emerald-200' : 'text-[#55607a] hover:text-[#0b1226] dark:text-slate-400 dark:hover:text-slate-100'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

// Diálogo sencillo (benchmark y datos por época)
function Dialog({ title, onClose, children }) {
  const id = `md${useId().replace(/:/g, '')}`
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const previous = document.activeElement
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fade-in absolute inset-0 bg-[#0b1220]/45 backdrop-blur-[3px]" onClick={() => closeRef.current()}/>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className="fade-up relative flex max-h-[calc(100dvh-10px)] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[22px] border border-white/70 bg-white shadow-[0_30px_80px_-30px_rgba(2,12,8,0.6)] outline-none sm:max-h-[calc(100dvh-32px)] sm:rounded-[22px] dark:border-white/10 dark:bg-[#0f1a2b]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#eef1f5] px-5 py-3 dark:border-white/10">
          <h2 id={id} className={`min-w-0 flex-1 text-[15px] ${TITLE}`}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-[28px] w-[28px] place-items-center rounded-full border border-[#e3e8ee] bg-white text-[#1f2d48] transition hover:text-[#0b6b35] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
            <IcoX className="h-3.5 w-3.5" sw={2.4}/>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ── Gráfico de líneas pequeño con cruz y tooltip (un solo eje Y) ──────────────
function MiniLineChart({ label, series, yDomain, ticks, format, markers = [], height = 128 }) {
  const { isDark } = useTheme()
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const epochs = HISTORY.map((h) => h.epoch)
  const pad = { top: 8, right: 10, bottom: 18, left: 34 }
  const w = Math.max(width - pad.left - pad.right, 10)
  const h = height - pad.top - pad.bottom
  const [y0, y1] = yDomain
  const x = (e) => pad.left + ((e - epochs[0]) / (epochs[epochs.length - 1] - epochs[0])) * w
  const y = (v) => pad.top + (1 - (v - y0) / (y1 - y0)) * h
  const grid = isDark ? '#1e3048' : '#e8edf2'
  const ink2 = isDark ? '#94a3b8' : '#64748b'
  const surface = isDark ? '#162032' : '#ffffff'
  const onMove = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect()
    const e = Math.round(epochs[0] + ((ev.clientX - rect.left - pad.left) / w) * (epochs[epochs.length - 1] - epochs[0]))
    setHover(e >= epochs[0] && e <= epochs[epochs.length - 1] ? e : null)
  }
  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={label} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1"/>
              <text x={pad.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill={ink2}>{format(t)}</text>
            </g>
          ))}
          {[1, 10, 20, 30, 40, 49].map((e) => (
            <text key={e} x={x(e)} y={height - 5} textAnchor="middle" fontSize="9" fill={ink2}>{e}</text>
          ))}
          {markers.map((m) => (
            <g key={m.epoch}>
              <line x1={x(m.epoch)} x2={x(m.epoch)} y1={pad.top} y2={pad.top + h} stroke={ink2} strokeWidth="1" strokeDasharray="3 3"/>
              <text x={x(m.epoch) + 3} y={pad.top + 8} fontSize="8.5" fill={ink2}>{m.label}</text>
            </g>
          ))}
          {series.map((s) => (
            <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x(epochs[i])},${y(v)}`).join(' ')}/>
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke={ink2} strokeWidth="1"/>
              {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover - 1])} r="4" fill={s.color} stroke={surface} strokeWidth="2"/>)}
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-[#e3e8ee] bg-white px-2.5 py-1.5 text-[10px] shadow-lg dark:border-white/10 dark:bg-[#0e1929]"
          style={x(hover) > width / 2 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }}
        >
          <p className="font-bold text-[#0b1226] dark:text-white">Época {hover}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1.5 whitespace-nowrap text-[#55607a] dark:text-slate-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.color }}/>
              {s.name}
              <span className="ml-auto pl-2 font-semibold tabular-nums text-[#0b1226] dark:text-white">{s.values[hover - 1].toFixed(4)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Encabezado y métricas principales ─────────────────────────────────────────
function Header() {
  const chips = [
    [<IcoGear key="g" className="h-3.5 w-3.5"/>, `${fmtInt(MODEL_INFO.params)} parámetros`],
    [<IcoDb key="d" className="h-3.5 w-3.5"/>, `${MODEL_INFO.sizeMB} MB`],
    [<IcoImage key="i" className="h-3.5 w-3.5"/>, `Entrada ${MODEL_INFO.inputSize}`],
    [<IcoLayers key="l" className="h-3.5 w-3.5"/>, `${MODEL_INFO.numClasses} clases: ${CLASSES.join(', ')}`],
    [<IcoFile key="f" className="h-3.5 w-3.5"/>, `Pesos: ${MODEL_INFO.weightsFile}`],
  ]
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#e3ece6] bg-white shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10 dark:bg-[#162032]">
      <img src={dronImg} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-auto select-none [mask-image:linear-gradient(to_right,transparent,#000_30%)] md:block dark:brightness-[0.5]"/>
      <div className="relative px-4 pb-3.5 pt-3.5 sm:pl-[18px]">
        <div className="flex items-center gap-3.5 md:pr-[250px]">
          <span className="hidden h-[48px] w-[48px] shrink-0 place-items-center rounded-[14px] bg-linear-to-b from-[#16b46a] to-[#04844a] text-white shadow-[0_8px_18px_-8px_rgba(3,130,63,0.8)] sm:grid">
            <IcoLayers className="h-6 w-6" sw={2.2}/>
          </span>
          <div className="min-w-0">
            <h2 className={`text-[20px] leading-tight ${TITLE}`}>Ficha técnica <span className="text-[#0b8a4b] dark:text-emerald-400">del modelo</span></h2>
            <p className="mt-0.5 text-[11.5px] text-[#1d2640] dark:text-slate-300">
              <strong>{MODEL_INFO.decoder}</strong> con encoder <strong>MiT-B0</strong> · Segmentación semántica de enfermedades foliares del maíz
            </p>
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5 md:pr-[60px]">
          {chips.map(([icon, text]) => (
            <li key={text} className="inline-flex h-[27px] items-center gap-1.5 rounded-full border border-[#e6ecf0] bg-white/90 px-2.5 text-[10.5px] font-semibold text-[#1d2640] shadow-[0_2px_8px_-6px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              <span className="text-[#334155] dark:text-slate-400">{icon}</span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const KPI_TONES = {
  mint:   { card: 'border-[#d9f1e6] from-[#f2fbf6] to-[#e8f7ef] dark:border-emerald-400/15 dark:from-emerald-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#d3efe0] text-[#0f8a4a] dark:bg-emerald-400/15 dark:text-emerald-300', chip: 'bg-[#d8f1e3] text-[#0b5c35] dark:bg-emerald-400/15 dark:text-emerald-200' },
  blue:   { card: 'border-[#d6e6fb] from-[#f1f7fe] to-[#e6f0fd] dark:border-sky-400/15 dark:from-sky-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#d3e5fc] text-[#1d6fe0] dark:bg-sky-400/15 dark:text-sky-300', chip: 'bg-[#d9f1e3] text-[#0b5c35] dark:bg-emerald-400/15 dark:text-emerald-200' },
  purple: { card: 'border-[#e6dcfa] from-[#f7f3fe] to-[#eee6fc] dark:border-violet-400/15 dark:from-violet-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#e6dbfc] text-[#7c3aed] dark:bg-violet-400/15 dark:text-violet-300', chip: 'bg-[#d9f1e3] text-[#0b5c35] dark:bg-emerald-400/15 dark:text-emerald-200' },
  orange: { card: 'border-[#fbe0c4] from-[#fff8ef] to-[#fdeedb] dark:border-orange-400/15 dark:from-orange-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#fde3c6] text-[#f07c0a] dark:bg-orange-400/15 dark:text-orange-300', chip: 'bg-[#d9f1e3] text-[#0b5c35] dark:bg-emerald-400/15 dark:text-emerald-200' },
}

function MetricCard({ tone, icon, metric, test, val, note }) {
  const t = KPI_TONES[tone]
  return (
    <div className={`flex min-h-[64px] items-center gap-3 rounded-2xl border bg-linear-to-br px-3 py-2.5 ${t.card}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11 [&>svg]:h-[22px] [&>svg]:w-[22px] ${t.circle}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-[#283c53] dark:text-slate-300">{metric} · TEST</p>
        <p className={`text-[21px] leading-none tabular-nums ${TITLE}`}>{fmt(test)}</p>
        {note && <p className={`mt-0.5 text-[9.5px] ${MUTED}`}>{note}</p>}
      </div>
      <div className="shrink-0 border-l border-black/[0.07] pl-3 text-center dark:border-white/10">
        <p className={`text-[10px] ${MUTED}`}>Validación</p>
        <p className={`mt-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${t.chip}`}>{fmt(val)}</p>
      </div>
    </div>
  )
}

// ── Métricas globales, por clase y matriz de confusión ────────────────────────
function GlobalMetricsCard() {
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead icon={<IcoChart className="h-[18px] w-[18px]" sw={2.4}/>} title="Comparación de métricas globales" subtitle={`${TRAINING.evaluation}. Validación se usó para seleccionar el modelo; Test es independiente.`}/>
      <table className="mt-2 w-full text-left">
        <thead><tr className="bg-[#f3f5f9] dark:bg-white/[0.04]">
          <th scope="col" className={`${TH} rounded-l-md pl-2.5`}>Métrica</th>
          <th scope="col" className={`${TH} text-right`}>Validación</th>
          <th scope="col" className={`${TH} text-right`}>Test</th>
          <th scope="col" className={`${TH} rounded-r-md pr-2.5 text-right`}>Δ</th>
        </tr></thead>
        <tbody>
          {FINAL_METRICS.map((m) => (
            <tr key={m.metric}>
              <th scope="row" className={`${TD} pl-2.5 font-bold text-[#0b1226] dark:text-white`}>{m.metric}</th>
              <td className={`${TD} text-right`}>{fmt(m.val)}</td>
              <td className={`${TD} text-right font-bold text-[#0b1226] dark:text-white`}>{fmt(m.test)}</td>
              <td className={`${TD} pr-2.5 text-right text-[#55607a] dark:text-slate-400`}>{(m.test - m.val).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function PerClassCard() {
  const { isDark } = useTheme()
  const [split, setSplit] = useState('test')
  const rows = split === 'test' ? TEST_PER_CLASS : VAL_PER_CLASS
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead
        icon={<IcoLayers className="h-[18px] w-[18px]" sw={2.2}/>}
        title={`Métricas por clase (${split === 'test' ? 'Test' : 'Validación'})`}
        subtitle="IoU, precisión, recall y F1 por clase."
        aside={<SplitToggle value={split} onChange={setSplit} label="Conjunto de las métricas por clase"/>}
      />
      <table className="mt-2 w-full text-left">
        <thead><tr className="bg-[#f3f5f9] dark:bg-white/[0.04]">
          {['Clase', 'IoU', 'Precisión', 'Recall', 'F1'].map((hd, i) => (
            <th key={hd} scope="col" className={`${TH} ${i ? 'text-right' : 'rounded-l-md pl-2.5'} ${i === 4 ? 'rounded-r-md pr-2.5' : ''}`}>{hd}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.cls}>
              <th scope="row" className={`${TD} whitespace-nowrap pl-2.5 font-bold text-[#0b1226] dark:text-white`}>
                <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] align-[-1px]" style={{ background: resultColor(CLASS_KEYS[i], isDark) }}/>
                {c.cls}
              </th>
              {[c.iou, c.precision, c.recall, c.f1].map((v, k) => (
                <td key={k} className={`${TD} text-right ${k === 3 ? 'pr-2.5' : ''}`}>{fmt(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function ConfusionCard() {
  const { isDark } = useTheme()
  const [split, setSplit] = useState('test')
  const m = CONFUSION[split]
  const sums = m.map((r) => r.reduce((a, b) => a + b, 0))
  // Escala secuencial de un solo tono (verde), de claro a oscuro según la proporción de la fila
  const cell = (p) => (isDark
    ? { background: `rgba(52,211,153,${0.08 + p * 0.82})`, color: p > 0.55 ? '#052e1c' : '#e2e8f0' }
    : { background: `rgba(15,138,75,${0.06 + p * 0.94})`, color: p > 0.5 ? '#ffffff' : '#0b1226' })
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead
        icon={<IcoGrid className="h-[18px] w-[18px]" sw={2.2}/>}
        title="Matriz de confusión"
        subtitle={`Nivel de píxel · ${split === 'test' ? 'Test' : 'Validación'} · normalizada por fila (filas = real, columnas = predicha).`}
        aside={<SplitToggle value={split} onChange={setSplit} label="Conjunto de la matriz de confusión"/>}
      />
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-separate text-center" style={{ borderSpacing: 3 }}>
          <thead><tr>
            <th scope="col"><span className="sr-only">Clase real</span></th>
            {CLASSES.map((c) => <th key={c} scope="col" className="px-1 text-[9.5px] font-semibold text-[#44506c] dark:text-slate-400">{c}</th>)}
          </tr></thead>
          <tbody>
            {m.map((row, i) => (
              <tr key={CLASSES[i]}>
                <th scope="row" className="whitespace-nowrap pr-1.5 text-left text-[10px] font-bold text-[#0b1226] dark:text-white">{CLASSES[i]}</th>
                {row.map((v, j) => {
                  const p = v / sums[i]
                  return (
                    <td
                      key={j}
                      title={`Real ${CLASSES[i]} → predicho ${CLASSES[j]}: ${fmtInt(v)} píxeles (${(p * 100).toFixed(1)} % de la fila)`}
                      className="h-[25px] min-w-[46px] rounded-[5px] text-[10.5px] font-bold tabular-nums"
                      style={cell(p)}
                    >
                      {p.toFixed(3)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Encoders, elección y configuración ────────────────────────────────────────
function EncodersCard() {
  const bestTest = Math.max(...ENCODER_COMPARISON.map((e) => e.test.miou))
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead icon={<IcoChip className="h-[18px] w-[18px]"/>} title="Comparación de encoders" subtitle="DeepLabV3+ con distintos encoders, mismo protocolo (384 × 384 px)."/>
      <table className="mt-2 w-full text-left">
        <thead><tr className="bg-[#f3f5f9] dark:bg-white/[0.04]">
          <th scope="col" className={`${TH} rounded-l-md pl-2.5`}>Encoder</th>
          <th scope="col" className={`${TH} pl-2 text-right`}>Parámetros</th>
          <th scope="col" className={`${TH} pl-2 text-right`}>Tamaño (MB)</th>
          <th scope="col" className={`${TH} rounded-r-md pl-2 pr-2.5 text-right`}>mIoU Test</th>
        </tr></thead>
        <tbody>
          {ENCODER_COMPARISON.map((e) => (
            <tr key={e.encoder} className={e.selected ? 'bg-[#e3f6ea] dark:bg-emerald-400/10' : ''}>
              <th scope="row" className={`${TD} whitespace-nowrap pl-2.5 font-bold text-[#0b1226] dark:text-white ${e.selected ? 'rounded-l-md' : ''}`}>
                {e.encoder}
                {e.selected && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#0b8a4b] px-1.5 py-px text-[8.5px] font-bold text-white align-[1px] dark:bg-emerald-600">
                    <IcoCheck className="h-2.5 w-2.5" sw={3.2}/>Seleccionado
                  </span>
                )}
              </th>
              <td className={`${TD} pl-2 text-right`}>{fmtInt(e.params)}</td>
              <td className={`${TD} pl-2 text-right`}>{e.sizeMB.toFixed(2)}</td>
              <td className={`${TD} pl-2 pr-2.5 text-right ${e.test.miou === bestTest ? 'font-extrabold text-[#0b1226] dark:text-white' : ''} ${e.selected ? 'rounded-r-md font-bold' : ''}`}>{e.test.miou.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-1.5 text-[9.5px] ${MUTED}`}>En negrita, el mejor mIoU de test. Métricas de test con EMA + TTA.</p>
    </section>
  )
}

function WhyCard() {
  const b0 = ENCODER_COMPARISON.find((e) => e.selected)
  const b1 = ENCODER_COMPARISON.find((e) => e.encoder === 'MiT-B1')
  const ratio = (b1.params / b0.params).toFixed(1)
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#cfe9d9] bg-linear-to-br from-[#f1faf4] to-[#e1f3e8] px-3.5 pb-3 pt-3 shadow-[0_8px_24px_-18px_rgba(15,40,30,0.35)] dark:border-emerald-400/15 dark:from-emerald-400/[0.08] dark:to-white/[0.02]">
      <h3 className={`flex items-center gap-2 text-[12.5px] ${TITLE}`}>
        <IcoTrophy className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>
        ¿Por qué MiT-B0?
      </h3>
      <p className="mt-2 text-[10.5px] leading-[1.55] text-[#1d2640] dark:text-slate-200">
        Obtiene un mIoU de test similar al de MiT-B1 ({b0.test.miou.toFixed(4)} vs {b1.test.miou.toFixed(4)}), pero con{' '}
        <strong>≈ {ratio}× menos parámetros</strong> ({(b0.params / 1e6).toFixed(2)} M vs {(b1.params / 1e6).toFixed(2)} M) y un modelo mucho más ligero
        ({b0.sizeMB.toFixed(2)} MB vs {b1.sizeMB.toFixed(2)} MB), lo que lo hace más eficiente y adecuado para su despliegue.
      </p>
    </section>
  )
}

function TrainingCard() {
  const rows = [
    ['Optimizador', TRAINING.optimizer],
    ['Épocas', `${TRAINING.epochsRun} de ${TRAINING.maxEpochs} (early stopping, paciencia ${TRAINING.earlyStoppingPatience})`],
    ['Mejor época', TRAINING.bestEpoch],
    ['LR encoder / decoder', `${TRAINING.lrEncoder.toExponential(0)} / ${TRAINING.lrDecoder.toExponential(0)}`],
    ['Planificador', TRAINING.scheduler],
    ['Iteraciones/época', TRAINING.itersPerEpoch],
    ...TRAINING.lossSchedule.map((l) => [`Pérdida (ép. ${l.epochs})`, l.loss]),
    ['Pesos utilizados', TRAINING.evaluation],
    ['Tiempo total', `${TRAINING.totalMinutes.toFixed(1)} min (${TRAINING.secondsPerEpoch.toFixed(0)} s/época)`],
    ['Framework', TRAINING.framework],
    ['Hardware', TRAINING.hardware],
  ]
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead icon={<IcoCog className="h-[18px] w-[18px]"/>} title="Configuración del entrenamiento"/>
      <dl className="mt-2 divide-y divide-[#f0f3f6] dark:divide-white/[0.05]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] gap-2 py-[3px]">
            <dt className={`text-[10px] ${MUTED}`}>{k}</dt>
            <dd className="text-[10px] font-semibold text-[#0b1226] dark:text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ── Grad-CAM y curvas ─────────────────────────────────────────────────────────
// gradcam_test.jpg: cuadrícula de 5 ejemplos de test × 4 paneles de 291 px
const GRID = { w: 1400, h: 1575, size: 291, cols: [6, 372, 737, 1103], rows: [20, 334, 649, 964, 1278] }
const PANELS = ['Imagen original', 'Etiqueta real', 'Predicción', 'Grad-CAM']
const EXAMPLES = [
  { id: 109, label: 'Roya', row: 4 },
  { id: 37, label: 'Tizón', row: 0 },
  { id: 47, label: 'Tizón', row: 1 },
  { id: 106, label: 'Tizón', row: 2 },
  { id: 24, label: 'Tizón', row: 3 },
]

function GridPanel({ row, col, alt }) {
  const { w, size, cols, rows } = GRID
  return (
    <span className="relative block aspect-square w-full overflow-hidden bg-[#0f1a14]">
      <img
        src={gradcamImg}
        alt={alt}
        draggable="false"
        className="absolute select-none"
        style={{ width: `${(w / size) * 100}%`, maxWidth: 'none', left: `${(-cols[col] / size) * 100}%`, top: `${(-rows[row] / size) * 100}%` }}
      />
    </span>
  )
}

function GradCamCard() {
  const [ex, setEx] = useState(0)
  const [zoom, setZoom] = useState(null)
  const sample = EXAMPLES[ex]
  return (
    <section className={`${CARD} flex flex-col px-3.5 pb-3 pt-3`}>
      <CardHead
        icon={<IcoImage className="h-[18px] w-[18px]"/>}
        title="Explicabilidad (Grad-CAM)"
        subtitle="Ejemplos del conjunto de test: segmentación y mapa de activación (XAI)."
      />
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {PANELS.map((p, col) => (
          <figure key={p} className="min-w-0 overflow-hidden rounded-lg border border-[#e9eef1] dark:border-white/10">
            <figcaption className="truncate bg-[#f3f5f9] px-1 py-1 text-center text-[9.5px] font-semibold text-[#1d2640] dark:bg-white/[0.05] dark:text-slate-200">{p}</figcaption>
            <button type="button" onClick={() => setZoom(col)} aria-label={`Ampliar ${p.toLowerCase()} del ejemplo ${sample.id}`} className="group relative block w-full cursor-zoom-in">
              <GridPanel row={sample.row} col={col} alt={`${p} · ejemplo de test ${sample.id} (${sample.label})`}/>
              <span aria-hidden="true" className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <IcoZoom className="h-3 w-3"/>
              </span>
            </button>
          </figure>
        ))}
      </div>
      <div role="group" aria-label="Ejemplo de test" className="mt-2 flex flex-wrap gap-1">
        {EXAMPLES.map((e, i) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={i === ex}
            onClick={() => setEx(i)}
            className={`h-[20px] rounded-full px-2 text-[9.5px] font-semibold transition ${i === ex ? 'bg-[#0b8a4b] text-white dark:bg-emerald-600' : 'bg-[#eef1f5] text-[#334155] hover:bg-[#e3e8ee] dark:bg-white/[0.06] dark:text-slate-300'}`}
          >
            ID {e.id} · {e.label}
          </button>
        ))}
      </div>
      <p className={`mt-auto pt-2.5 text-[9.5px] leading-snug ${MUTED}`}>
        Etiqueta real: anotación manual de la imagen. Predicción: máscara que generó el modelo. Grad-CAM: zonas que más
        influyeron en la clase predicha (los colores cálidos indican mayor influencia). Haz clic en un panel para ampliarlo.
      </p>
      {zoom != null && (
        <ZoomOverlay label={`${PANELS[zoom]} · ejemplo ${sample.id} (${sample.label})`} onClose={() => setZoom(null)}>
          <div className="flex h-full w-full items-center justify-center">
            <div className="aspect-square h-full max-h-full max-w-full overflow-hidden rounded-xl">
              <GridPanel row={sample.row} col={zoom} alt={`${PANELS[zoom]} · ejemplo de test ${sample.id}`}/>
            </div>
          </div>
        </ZoomOverlay>
      )}
    </section>
  )
}

function CurvesCard() {
  const { isDark } = useTheme()
  const [table, setTable] = useState(false)
  const [figure, setFigure] = useState(false)
  const [cTrain, cVal] = LOSS_COLORS[isDark ? 'dark' : 'light']
  const cMiou = MIOU_COLOR[isDark ? 'dark' : 'light']
  const link = 'rounded text-[9.5px] font-semibold text-[#0b6b35] hover:underline dark:text-emerald-400'
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead
        icon={<IcoTrend className="h-[18px] w-[18px]" sw={2.2}/>}
        title="Curvas de entrenamiento"
        subtitle="Pérdida de entrenamiento y validación, y mIoU de validación por época."
      />
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <figure className="min-w-0">
          <figcaption className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-semibold text-[#1d2640] dark:text-slate-200">
            Pérdida
            <span className="inline-flex items-center gap-1 font-medium text-[#55607a] dark:text-slate-400"><span aria-hidden="true" className="h-[2px] w-3 rounded-full" style={{ background: cTrain }}/>Entrenamiento</span>
            <span className="inline-flex items-center gap-1 font-medium text-[#55607a] dark:text-slate-400"><span aria-hidden="true" className="h-[2px] w-3 rounded-full" style={{ background: cVal }}/>Validación</span>
          </figcaption>
          <MiniLineChart
            label="Pérdida de entrenamiento y de validación por época"
            yDomain={[0.2, 0.65]}
            ticks={[0.2, 0.35, 0.5, 0.65]}
            format={(v) => v.toFixed(2)}
            markers={[{ epoch: 26, label: 'Lovász' }]}
            series={[
              { name: 'Entrenamiento', color: cTrain, values: HISTORY.map((h) => h.trainLoss) },
              { name: 'Validación', color: cVal, values: HISTORY.map((h) => h.valLoss) },
            ]}
          />
        </figure>
        <figure className="min-w-0">
          <figcaption className="text-[10px] font-semibold text-[#1d2640] dark:text-slate-200">mIoU de validación</figcaption>
          <MiniLineChart
            label="mIoU de validación por época"
            yDomain={[0.68, 0.84]}
            ticks={[0.68, 0.72, 0.76, 0.8, 0.84]}
            format={(v) => v.toFixed(2)}
            markers={[{ epoch: TRAINING.bestEpoch, label: 'Mejor' }]}
            series={[{ name: 'mIoU', color: cMiou, values: HISTORY.map((h) => h.miou) }]}
          />
        </figure>
      </div>
      <p className={`mt-1 text-[9.5px] leading-snug ${MUTED}`}>
        En la época 26 la pérdida cambia de Dice + CE a Lovász + CE + Dice: el salto refleja el cambio de función. Mejor mIoU de validación: {TRAINING.bestValMiou.toFixed(4)} (época {TRAINING.bestEpoch}, sin TTA).
      </p>
      <div className="mt-1 flex gap-3">
        <button type="button" onClick={() => setTable(true)} className={link}>Ver datos por época</button>
        <button type="button" onClick={() => setFigure(true)} className={link}>Ver figura del notebook</button>
      </div>
      {table && (
        <Dialog title="Datos de entrenamiento por época" onClose={() => setTable(false)}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0"><tr className="bg-[#f3f5f9] dark:bg-[#162032]">
                {['Época', 'LR', 'Pérdida train', 'Pérdida val', 'mIoU', ...CLASSES].map((hd) => (
                  <th key={hd} scope="col" className={`${TH} whitespace-nowrap px-2.5 text-right`}>{hd}</th>
                ))}
              </tr></thead>
              <tbody>
                {HISTORY.map((r) => (
                  <tr key={r.epoch} className={r.epoch === TRAINING.bestEpoch ? 'bg-[#e3f6ea] dark:bg-emerald-400/10' : ''}>
                    <th scope="row" className={`${TD} px-2.5 text-right font-bold`}>{r.epoch}</th>
                    <td className={`${TD} px-2.5 text-right`}>{r.lr.toExponential(2)}</td>
                    {[r.trainLoss, r.valLoss, r.miou, ...r.iou].map((v, k) => <td key={k} className={`${TD} px-2.5 text-right`}>{v.toFixed(4)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`mt-2 text-[10.5px] ${MUTED}`}>Resaltada la época {TRAINING.bestEpoch}, la de los pesos usados. IoU por clase sobre validación.</p>
        </Dialog>
      )}
      {figure && (
        <ZoomOverlay label="Figura del entrenamiento (notebook)" onClose={() => setFigure(false)}>
          <img src={trainingImg} alt="Evolución del entrenamiento: pérdida, LR, mIoU, F1, mAP e IoU/F1 por clase" className="h-full w-full object-contain"/>
        </ZoomOverlay>
      )}
    </section>
  )
}

// ── Dataset e inferencia ──────────────────────────────────────────────────────
function DatasetCard() {
  const total = DATASET_SPLIT.reduce((a, d) => a + d.images, 0)
  const tones = ['text-[#0b8a4b] dark:text-emerald-400', 'text-[#1d6fe0] dark:text-sky-300', 'text-[#7c3aed] dark:text-violet-300']
  const names = ['Entrenamiento (×3)', 'Validación', 'Test']
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead icon={<IcoDb className="h-[18px] w-[18px]"/>} title="Dataset" subtitle={`${fmtInt(DATASET.annotated)} imágenes anotadas (partición ${DATASET.splitRatio.replace(/ /g, '')}). Aumento ×3 solo en entrenamiento.`}/>
      <ul className="mt-2 space-y-1.5">
        {DATASET_SPLIT.map((d, i) => (
          <li key={d.split} className="flex items-center gap-2 text-[10.5px]">
            <IcoDb className={`h-3.5 w-3.5 ${tones[i]}`}/>
            <span className="min-w-0 flex-1 font-semibold text-[#1d2640] dark:text-slate-200">{names[i]}</span>
            <span className="tabular-nums text-[#1f2d48] dark:text-slate-200">{fmtInt(d.images)} ({((d.images / total) * 100).toFixed(1)}%)</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-center justify-between rounded-lg bg-[#e3f6ea] px-2.5 py-1.5 text-[10.5px] font-bold text-[#0b1226] dark:bg-emerald-400/10 dark:text-white">
        Total de imágenes
        <span className="tabular-nums">{fmtInt(total)}</span>
      </p>
    </section>
  )
}

function InferenceCard() {
  const loadMs = useModelLoadTime()
  const [bench, setBench] = useState(false)
  return (
    <section className={`${CARD} px-3.5 pb-3 pt-3`}>
      <CardHead icon={<IcoBolt className="h-[18px] w-[18px]"/>} title="Inferencia" subtitle={`${INFERENCE.device} · 384 × 384 px`}/>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          ['Sin TTA', INFERENCE.noTta, 'border-[#cfe9d9] from-[#f1faf4] to-[#e3f4ea] text-[#0b5c35] dark:border-emerald-400/15 dark:from-emerald-400/[0.08] dark:to-white/[0.02] dark:text-emerald-200'],
          ['Con TTA', INFERENCE.tta, 'border-[#e2d8fa] from-[#f6f1fe] to-[#ece4fc] text-[#5b21b6] dark:border-violet-400/15 dark:from-violet-400/[0.08] dark:to-white/[0.02] dark:text-violet-200'],
        ].map(([label, v, cls]) => (
          <div key={label} className={`rounded-xl border bg-linear-to-br px-2 py-2 text-center ${cls}`}>
            <p className="text-[10px] font-semibold">{label}</p>
            <p className={`mt-0.5 text-[16px] leading-tight tabular-nums ${TITLE}`}>{v.ms} ms</p>
            <p className="text-[10px] font-semibold tabular-nums">({v.fps} FPS)</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-2 border-t border-[#eef1f5] pt-2.5 dark:border-white/10">
        <IcoMonitor className="mt-px h-4 w-4 text-[#334155] dark:text-slate-400"/>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#0b1226] dark:text-white">Producción (CPU)</p>
          <p className="text-[10.5px] text-[#1f2d48] dark:text-slate-200">Tiempo de carga: <strong>{loadMs != null ? `${Math.round(loadMs)} ms` : '—'}</strong></p>
          <p className={`text-[9.5px] ${MUTED}`}>Medido por el servidor desplegado.</p>
        </div>
      </div>
      <button type="button" onClick={() => setBench(true)} className="mt-2.5 flex h-[32px] w-full items-center justify-center gap-2 rounded-xl border border-[#cfe9d9] bg-linear-to-r from-[#eaf8ef] to-[#dff3e7] text-[11px] font-bold text-[#0b5c35] shadow-[0_6px_14px_-10px_rgba(11,138,75,0.7)] transition hover:brightness-[0.98] dark:border-emerald-400/20 dark:from-emerald-400/10 dark:to-emerald-400/5 dark:text-emerald-200">
        <IcoBars className="h-4 w-4"/>
        Benchmark dinámico de API
      </button>
      {bench && (
        <Dialog title="Rendimiento en producción (CPU)" onClose={() => setBench(false)}>
          <p className={`mb-3 text-[11.5px] ${MUTED}`}>Tiempo de carga del modelo, tiempo de análisis y tiempo de respuesta de la API medidos en el servidor desplegado.</p>
          <ProductionBenchmark/>
        </Dialog>
      )}
    </section>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ModeloIA() {
  const [miou, pixAcc, f1, map] = FINAL_METRICS
  return (
    <div className="fade-up relative isolate space-y-3">
      <PageGlow/>
      <Header/>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard tone="mint" icon={<IcoTarget sw={2}/>} metric={miou.metric} test={miou.test} val={miou.val} note={`(${fmtInt(DATASET_SPLIT[2].images)} imágenes no vistas)`}/>
        <MetricCard tone="blue" icon={<IcoLayers sw={2.2}/>} metric={pixAcc.metric} test={pixAcc.test} val={pixAcc.val}/>
        <MetricCard tone="purple" icon={<IcoBars/>} metric={f1.metric} test={f1.test} val={f1.val}/>
        <MetricCard tone="orange" icon={<IcoAward sw={2}/>} metric={map.metric} test={map.test} val={map.val}/>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <GlobalMetricsCard/>
        <PerClassCard/>
        <div className="md:col-span-2 xl:col-span-1"><ConfusionCard/></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,1.65fr)]">
            <EncodersCard/>
            <WhyCard/>
            <div className="md:col-span-2 xl:col-span-1"><TrainingCard/></div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <GradCamCard/>
            <CurvesCard/>
          </div>
        </div>
        <div className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-1">
          <DatasetCard/>
          <InferenceCard/>
        </div>
      </div>
    </div>
  )
}
