import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './ThemeContext.jsx'
import { fetchMercadoProductos } from './api.js'
import banner from './Imagenes/mercado-banner.webp'
import planta from './Imagenes/mercado-planta.png'
import ilustracionConsejos from './Imagenes/mercado-consejos.png'
import fotoMaiz from './Imagenes/mercado-maiz.webp'
import fotoArroz from './Imagenes/mercado-arroz.webp'
import hojas from './Imagenes/inicio-hojas.png'

// ── Mercado agrícola (diseño de la maqueta del usuario) ───────────────────────
// Precios reales del boletín diario del Mercado Mayorista de Ambato (EP-EMA) para los 10
// productos de AgroScan, servidos por GET /mercado/productos. No se inventa ningún dato: si no
// hay precios se muestra un aviso. Medidas a la escala en que el usuario ve sus maquetas (~0,68).

const CARD = 'rounded-xl border border-[#e6ebf0] bg-white shadow-[0_6px_18px_-14px_rgba(15,40,30,0.28)] dark:border-[#1e3048] dark:bg-[#162032]'
const TITLE = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const MUTED = 'text-[#55656f] dark:text-slate-400'
const DAY = 86400000

// Presentación de cada producto en la interfaz (las fotos de maíz y arroz vienen de la maqueta)
const UI = {
  choclo:       { corto: 'Maíz',            del: 'del maíz',            foto: fotoMaiz },
  papa:         { corto: 'Papa',            del: 'de la papa',          emoji: '🥔', tono: 'from-[#f8f0e3] to-[#efe1c7]' },
  arveja:       { corto: 'Arveja',          del: 'de la arveja',        emoji: '🫛', tono: 'from-[#ebf7e6] to-[#d4edca]' },
  frejol:       { corto: 'Fréjol',          del: 'del fréjol',          emoji: '🫘', tono: 'from-[#f8e9e5] to-[#efd3cb]' },
  haba:         { corto: 'Haba',            del: 'del haba',            emoji: '🫛', tono: 'from-[#f0f6e0] to-[#dcebbd]' },
  arroz:        { corto: 'Arroz',           del: 'del arroz',           foto: fotoArroz },
  cebolla:      { corto: 'Cebolla',         del: 'de la cebolla',       emoji: '🧅', tono: 'from-[#f7e9ef] to-[#eccfdb]' },
  zanahoria:    { corto: 'Zanahoria',       del: 'de la zanahoria',     emoji: '🥕', tono: 'from-[#fdefe2] to-[#f8dbbd]' },
  tomate_arbol: { corto: 'Tomate de árbol', del: 'del tomate de árbol', emoji: '🍅', tono: 'from-[#fde9e5] to-[#f7cfc6]' },
  aguacate:     { corto: 'Aguacate',        del: 'del aguacate',        emoji: '🥑', tono: 'from-[#eef5e0] to-[#d8e8bd]' },
}

// Para quien vende, una subida es buena noticia (verde) y una bajada, una alerta (naranja)
const TREND = {
  sube:    { label: 'Al alza',   dir: 'up',   text: 'text-[#14803d] dark:text-emerald-400', chip: 'bg-[#e5f5e5] text-[#14803d] dark:bg-emerald-400/10 dark:text-emerald-300', ring: ['#0b6c57', '#bfe8b0'] },
  baja:    { label: 'A la baja', dir: 'down', text: 'text-[#c2410c] dark:text-orange-300',  chip: 'bg-[#fdece4] text-[#b4400c] dark:bg-orange-400/10 dark:text-orange-300', ring: ['#c2410c', '#fed7aa'] },
  estable: { label: 'Estable',   dir: 'flat', text: 'text-[#475569] dark:text-slate-300',   chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300', ring: ['#64748b', '#dbe3ec'] },
}

const PERIODOS = [
  { dias: 7, label: 'Últimos 7 días' },
  { dias: 30, label: 'Últimos 30 días' },
  { dias: 90, label: 'Últimos 90 días' },
]

const TABS = [
  { id: 'precios', label: 'Precios' },
  { id: 'tendencias', label: 'Tendencias' },
  { id: 'recomendaciones', label: 'Recomendaciones' },
]

// ── Formatos ──────────────────────────────────────────────────────────────────
// Las fechas del boletín son días de calendario: se leen como fecha local (sin zona horaria)
const parseDia = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const fechaCorta = (d) => d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }).replace('.', '')
const fechaLarga = (d) => d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
const money = (v) => `$${Number(v).toFixed(2)}`
const fmtPct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Number(v)).toFixed(1)}%`

// «Quintal» → «quintal» · «Saco (25 kg)» → «saco de 25 kg»
function unidadLarga(u) {
  if (!u) return ''
  const m = /^(\S+)\s*\(([\d.,]+)\s*kg\)/.exec(u)
  return m ? `${m[1].toLowerCase()} de ${m[2]} kg` : u.toLowerCase()
}
function unidadCorta(u) {
  const base = String(u ?? '').split(/[\s(]/)[0].toLowerCase()
  return base === 'quintal' ? 'qq' : base
}
const contarVariedades = (txt) => (txt ? txt.split(/\),\s*/).filter(Boolean).length : 0)

// Nombre corto de una variedad, sin repetir el producto: «Papa Súper Chola» → «Súper Chola»
const PREFIJOS = {
  choclo: /^choclo\s+/i,
  papa: /^papa\s+/i,
  frejol: /^fr[eé]jol\s+tierno\s+en\s+vaina\s+/i,
  cebolla: /^cebolla\s+colorada\s+/i,
  aguacate: /^aguacate\s+/i,
}
function nombreVariedad(nombre, clave) {
  const corto = String(nombre).replace(PREFIJOS[clave] ?? /^$/, '').trim()
  return corto ? corto[0].toUpperCase() + corto.slice(1) : nombre
}

// Lo que muestran las tarjetas de arriba: el producto (promedio) o una de sus variedades
function vistaDe(producto, variedad) {
  const v = variedad && producto?.variedades_detalle?.find((x) => x.nombre === variedad)
  if (!v) return producto
  return { ...producto, ...v, precio_min: null, precio_max: null, variedades: null, variedad: v.nombre }
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>{children}</svg>
)
const IcoTrendUp = ({ className }) => <Svg className={className} sw={2.4}><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></Svg>
const IcoSprout = ({ className }) => <Svg className={className}><path d="M12 21v-9"/><path d="M12 12C12 7 8.5 4.5 4 4.5 4 9 7.5 12 12 12Z"/><path d="M12 14c0-4 3-6.5 8-6.5 0 4-3 6.5-8 6.5Z"/></Svg>
const IcoChartLine = ({ className }) => <Svg className={className}><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></Svg>
const IcoBulb = ({ className }) => <Svg className={className}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V17h5v-1.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/></Svg>
const IcoCalendar = ({ className }) => <Svg className={className}><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></Svg>
const IcoChevron = ({ className }) => <Svg className={className} sw={2.4}><path d="m6 9 6 6 6-6"/></Svg>
const IcoLayers = ({ className }) => <Svg className={className}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></Svg>
const IcoArrowRight = ({ className = 'h-3.5 w-3.5' }) => <Svg className={className} sw={2.2}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>
const IcoTag = ({ className }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M3 4.5V11l9.3 9.3a1.6 1.6 0 0 0 2.3 0l5.7-5.7a1.6 1.6 0 0 0 0-2.3L11 3H4.5A1.5 1.5 0 0 0 3 4.5Z" fill="currentColor"/>
    <circle cx="7.5" cy="7.5" r="1.6" fill="#fff"/>
  </svg>
)
const IcoBars = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
    <rect x="3.5" y="11" width="4" height="9.5" rx="1"/><rect x="10" y="6" width="4" height="14.5" rx="1"/><rect x="16.5" y="3.5" width="4" height="17" rx="1"/>
  </svg>
)
const IcoSparkle = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M12 2.5c.5 4.6 2.9 7 7.5 7.5-4.6.5-7 2.9-7.5 7.5-.5-4.6-2.9-7-7.5-7.5 4.6-.5 7-2.9 7.5-7.5Z"/>
    <path d="M19 15.5c.2 1.9 1.2 2.9 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.1 2.8-1.1 3-3Z" opacity=".7"/>
  </svg>
)
function Flecha({ dir, className = 'h-3 w-3' }) {
  if (dir === 'up') return <Svg className={className} sw={2.8}><path d="M12 19V5M6 11l6-6 6 6"/></Svg>
  if (dir === 'down') return <Svg className={className} sw={2.8}><path d="M12 5v14M6 13l6 6 6-6"/></Svg>
  return <Svg className={className} sw={2.8}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>
}
// Barras con una línea de tendencia: suben, bajan o se mantienen
function IconoTendencia({ dir, className }) {
  const barras = dir === 'down' ? [8, 11, 14] : dir === 'flat' ? [12, 12, 12] : [14, 11, 8]
  const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
      {barras.map((y, i) => <rect key={i} x={4 + i * 6.2} y={y} width="3.6" height={20.5 - y} rx="0.9" fill="currentColor"/>)}
      {dir === 'down' && <><path d="m4 3 5 3.5 3.5-1.5L19 9.5" {...trazo}/><path d="M19 5.5v4h-4" {...trazo}/></>}
      {dir === 'flat' && <><path d="M4 7.5h14.5" {...trazo}/><path d="m16 4.5 3 3-3 3" {...trazo}/></>}
      {dir === 'up' && <><path d="m4 10.5 5-4.5 3.5 2.5L19 3" {...trazo}/><path d="M15 3h4v4" {...trazo}/></>}
    </svg>
  )
}

// ── Piezas comunes ────────────────────────────────────────────────────────────
function ProductoImagen({ clave, className = '', emojiClass = 'text-[30px]' }) {
  const ui = UI[clave] ?? {}
  if (ui.foto) return <img src={ui.foto} alt="" aria-hidden="true" draggable="false" className={`select-none object-cover ${className}`}/>
  return (
    <span aria-hidden="true" className={`grid place-items-center bg-linear-to-b ${ui.tono ?? 'from-[#eef3ef] to-[#dfe9e2]'} dark:from-white/10 dark:to-white/[0.04] ${className}`}>
      <span className={`leading-none drop-shadow-sm ${emojiClass}`}>{ui.emoji ?? '🌱'}</span>
    </span>
  )
}

function VariacionChip({ producto, className = 'h-[25px] px-2.5 text-[12px]' }) {
  const v = producto?.variacion_semanal_pct
  if (v === null || v === undefined) {
    return <span className={`inline-flex items-center rounded-full bg-slate-100 font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400 ${className}`}>Sin dato</span>
  }
  const t = TREND[producto.tendencia] ?? TREND.estable
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold tabular-nums ${t.chip} ${className}`}>
      <Flecha dir={t.dir}/>
      {fmtPct(v)}
    </span>
  )
}

function useElementWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setWidth(Math.round(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// Marcas «redondas» del eje Y: 3–4 tramos que cubren el rango con un margen
function escala(lo, hi) {
  const rango = hi - lo || Math.max(1, Math.abs(hi) * 0.1)
  const bruto = (rango * 1.4) / 3
  const pot = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((s) => s >= bruto) ?? 10 * pot
  const min = Math.max(0, Math.floor((lo - rango * 0.2) / paso) * paso)
  const max = Math.ceil((hi + rango * 0.2) / paso) * paso
  const ticks = []
  for (let v = min; v <= max + paso / 2; v += paso) ticks.push(Number(v.toFixed(2)))
  return { min, max: Math.max(max, min + paso), ticks }
}

// Curva suave y monótona por los puntos (Fritsch–Carlson): nunca pasa por encima ni por debajo
// de dos precios consecutivos, así no sugiere precios que no hubo
function curva(pts) {
  const n = pts.length
  if (n < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')
  const dx = [], m = []
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = pts[i + 1][0] - pts[i][0]
    m[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0
  }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i += 1) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3
    d += ` C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

// ── Gráfico «Evolución del precio» ────────────────────────────────────────────
function PriceChart({ serie, desde, hasta, dias, nombre, isDark }) {
  const [ref, width] = useElementWidth()
  const [hover, setHover] = useState(null)
  const H = 152
  const pad = { l: 48, r: 18, t: 36, b: 22 }
  const W = Math.max(width, 240)
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const t0 = desde.getTime()
  const span = Math.max(hasta.getTime() - t0, DAY)
  const xOf = (d) => pad.l + ((d.getTime() - t0) / span) * iw
  const precios = serie.map((p) => Number(p.precio))
  const { min, max, ticks } = escala(Math.min(...precios), Math.max(...precios))
  const yOf = (v) => pad.t + ih - ((v - min) / (max - min)) * ih
  const pts = serie.map((p) => [xOf(parseDia(p.fecha)), yOf(Number(p.precio))])
  const linea = pts.length > 1 ? curva(pts) : null
  const area = linea ? `${linea} L${pts[pts.length - 1][0]},${pad.t + ih} L${pts[0][0]},${pad.t + ih} Z` : null

  // Etiquetas del eje X: cada día en 7 días; unas 5 fechas en periodos largos
  const etiquetas = []
  if (dias <= 7) {
    for (let t = t0; t <= hasta.getTime() + 1; t += DAY) {
      const d = new Date(t)
      etiquetas.push({ x: xOf(d), texto: DIAS_CORTOS[d.getDay()], linea: true })
    }
  } else {
    const n = 5
    for (let i = 0; i < n; i += 1) {
      const d = new Date(t0 + (span * i) / (n - 1))
      etiquetas.push({ x: xOf(d), texto: fechaCorta(d), linea: false })
    }
  }

  const activo = hover ?? pts.length - 1
  const pActivo = serie[activo]
  const grid = isDark ? '#1e3048' : '#e8eef1'
  const eje = isDark ? '#94a3b8' : '#5a6478'
  const verde = isDark ? '#34d399' : '#2d9a68'
  const gradId = 'mk-area'

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    let best = 0
    pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = i })
    setHover(best)
  }

  const resumen = serie.length
    ? `${nombre}: de ${money(serie[0].precio)} el ${fechaCorta(parseDia(serie[0].fecha))} a ${money(serie[serie.length - 1].precio)} el ${fechaCorta(parseDia(serie[serie.length - 1].fecha))}`
    : ''

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución del precio. ${resumen}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block max-w-full touch-none select-none">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={verde} stopOpacity={isDark ? 0.3 : 0.24}/>
              <stop offset="100%" stopColor={verde} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={yOf(t)} y2={yOf(t)} stroke={grid} strokeWidth="1"/>
              <text x={pad.l - 8} y={yOf(t) + 3.5} textAnchor="end" fontSize="10" fill={eje}>{money(t)}</text>
            </g>
          ))}
          {etiquetas.map((e) => (
            <g key={`${e.texto}-${e.x}`}>
              {e.linea && <line x1={e.x} x2={e.x} y1={pad.t - 6} y2={pad.t + ih} stroke={grid} strokeWidth="1"/>}
              <text x={e.x} y={H - 6} textAnchor="middle" fontSize="10" fill={eje}>{e.texto}</text>
            </g>
          ))}
          {area && <path d={area} fill={`url(#${gradId})`}/>}
          {linea && <path d={linea} fill="none" stroke={verde} strokeWidth="2.4" strokeLinecap="round"/>}
          {hover != null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.t - 4} y2={pad.t + ih} stroke={verde} strokeOpacity="0.35"/>}
          {pts.length <= 31 && pts.map(([x, y], i) => (
            <circle key={serie[i].fecha} cx={x} cy={y} r={i === activo ? 5.5 : 4.2} fill={isDark ? '#10b981' : '#1d8762'} stroke={isDark ? '#162032' : '#ffffff'} strokeWidth="2"/>
          ))}
          {pts.length > 31 && <circle cx={pts[activo][0]} cy={pts[activo][1]} r="5" fill={isDark ? '#10b981' : '#1d8762'} stroke={isDark ? '#162032' : '#ffffff'} strokeWidth="2"/>}
        </svg>
      )}
      {width > 0 && pActivo && (
        <div
          className="pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-lg bg-[#1d8762] px-2.5 py-1 text-center text-white shadow-md dark:bg-emerald-600"
          style={{
            // En % del ancho: si la ventana cambia de tamaño, acompaña al gráfico mientras se vuelve a medir
            left: `${(Math.min(Math.max(pts[activo][0], 40), W - 40) / W) * 100}%`,
            top: pts[activo][1] - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span className="block text-[12.5px] font-bold leading-tight">{money(pActivo.precio)}</span>
          {hover != null && <span className="block text-[9.5px] leading-tight text-white/85">{fechaCorta(parseDia(pActivo.fecha))}</span>}
          <span aria-hidden="true" className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-[#1d8762] dark:bg-emerald-600"/>
        </div>
      )}
    </div>
  )
}

// Primer día del periodo: «dias» antes del último boletín, y nunca después del boletín con el que
// se compara la variación semanal (así el gráfico muestra los dos precios que se comparan)
function inicioPeriodo(producto, dias) {
  const base = new Date(parseDia(producto.fecha).getTime() - dias * DAY)
  const ref = producto.fecha_semana_anterior ? parseDia(producto.fecha_semana_anterior) : null
  return ref && ref < base ? ref : base
}

// Mini curva para la lista de tendencias
function MiniCurva({ serie, color }) {
  if (serie.length < 2) return <span className="block h-7 w-full"/>
  const w = 120, h = 28
  const vals = serie.map((p) => Number(p.precio))
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className="h-7 w-full overflow-visible">
      <path d={curva(pts)} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
    </svg>
  )
}

// ── Pestaña «Precios» ─────────────────────────────────────────────────────────
function PrecioActual({ producto }) {
  const ui = UI[producto.producto] ?? {}
  const n = contarVariedades(producto.variedades)
  const esMaiz = producto.producto === 'choclo'
  return (
    <section className={`relative overflow-hidden ${CARD} flex flex-col px-4 pb-3.5 pt-3.5`}>
      {esMaiz ? (
        <img src={planta} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-full w-auto select-none dark:opacity-25"/>
      ) : (
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-3 -right-2 select-none text-[86px] leading-none opacity-[0.16]">{ui.emoji ?? '🌱'}</span>
      )}
      <h3 className={`relative flex items-center gap-2 text-[13.5px] ${TITLE}`}>
        <IcoTag className="h-[17px] w-[17px] text-[#0b8a4b] dark:text-emerald-400"/>
        Precio actual {ui.del ?? `de ${producto.nombre.toLowerCase()}`}
      </h3>
      {producto.variedad && (
        <span className="relative mt-1.5 inline-flex max-w-[75%] self-start truncate rounded-full bg-[#e5f6ee] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0a6332] dark:bg-emerald-400/10 dark:text-emerald-300" title={producto.variedad}>
          Variedad: {nombreVariedad(producto.variedad, producto.producto)}
        </span>
      )}
      <p className={`relative flex items-baseline gap-2 ${producto.variedad ? 'mt-2' : 'mt-3'}`}>
        <span className="font-[Manrope,Inter,sans-serif] text-[36px] font-extrabold leading-none tracking-tight text-[#0b1226] dark:text-white">
          <span className="mr-1">$</span>{Number(producto.precio).toFixed(2)}
        </span>
        <span className={`text-[11.5px] ${MUTED}`}>/ {unidadLarga(producto.unidad)}</span>
      </p>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        <VariacionChip producto={producto}/>
        <span className={`text-[11px] ${MUTED}`}>vs. semana anterior</span>
      </div>
      <p className={`relative mt-auto max-w-[68%] pt-3 text-[10px] leading-snug ${MUTED}`}>
        {producto.variedad ? (
          <span className="block">Mercado Mayorista de Ambato</span>
        ) : (
          <>
            <span className="block">{esMaiz ? 'Choclo · ' : ''}{n > 1 ? `promedio de ${n} variedades` : 'Mercado Mayorista de Ambato'}</span>
            {n > 1 && <span className="block">Rango: {money(producto.precio_min)} – {money(producto.precio_max)}</span>}
          </>
        )}
        <span className="block">Boletín del {fechaCorta(parseDia(producto.fecha))}</span>
      </p>
    </section>
  )
}

function Evolucion({ producto, dias, isDark }) {
  const hasta = parseDia(producto.fecha)
  const desde = inicioPeriodo(producto, dias)
  const serie = producto.serie.filter((p) => parseDia(p.fecha) >= desde)
  const ui = UI[producto.producto] ?? {}
  return (
    <section className={`${CARD} h-full px-4 pb-2 pt-3.5`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <IcoChartLine className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>
        <h3 className={`text-[13.5px] ${TITLE}`}>Evolución del precio</h3>
        <span className={`ml-auto text-[10.5px] ${MUTED}`}>
          {producto.variedad ? nombreVariedad(producto.variedad, producto.producto) : (ui.corto ?? producto.nombre)} · {fechaCorta(desde)} – {fechaCorta(hasta)}
        </span>
      </header>
      {serie.length > 0 ? (
        <div className="mt-1">
          <PriceChart serie={serie} desde={desde} hasta={hasta} dias={dias} nombre={producto.nombre} isDark={isDark}/>
        </div>
      ) : (
        <p className={`grid h-[152px] place-items-center text-center text-[11.5px] ${MUTED}`}>No hay precios publicados en este periodo.</p>
      )}
    </section>
  )
}

function EstadoMercado({ producto }) {
  const t = TREND[producto.tendencia] ?? TREND.estable
  const v = producto.variacion_semanal_pct
  const id = `ring-${producto.producto}`
  return (
    <section className={`relative overflow-hidden ${CARD} px-4 pb-3.5 pt-3.5`}>
      <img src={hojas} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[44px] w-auto select-none opacity-80 dark:opacity-10"/>
      <h3 className={`relative flex items-center gap-2 text-[13.5px] ${TITLE}`}>
        <IcoBars className="h-[17px] w-[17px] text-[#0b6c57] dark:text-emerald-400"/>
        Estado del mercado
      </h3>
      <div className="relative mt-3 flex items-center gap-4">
        <div className="relative h-[108px] w-[108px] shrink-0">
          <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full -rotate-90">
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={t.ring[1]}/>
                <stop offset="100%" stopColor={t.ring[0]}/>
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="51" fill="none" stroke={`url(#${id})`} strokeWidth="16"/>
          </svg>
          <span className={`absolute inset-[20px] grid place-items-center rounded-full bg-white shadow-[inset_0_2px_6px_rgba(15,40,30,0.08)] dark:bg-[#0f1a2b] ${t.text}`}>
            <IconoTendencia dir={t.dir} className="h-9 w-9"/>
          </span>
        </div>
        <div className="min-w-0">
          <p className={`text-[11px] ${MUTED}`}>Tendencia</p>
          <p className={`flex items-center gap-1.5 font-[Manrope,Inter,sans-serif] text-[21px] font-extrabold leading-tight ${t.text}`}>
            {v == null ? 'Sin datos' : t.label}
            {v != null && <Flecha dir={t.dir} className="h-[18px] w-[18px]"/>}
          </p>
          <div className="my-2 h-px bg-[#eef2f0] dark:bg-white/10"/>
          <p className={`text-[11px] ${MUTED}`}>Variación semanal</p>
          <p className={`font-[Manrope,Inter,sans-serif] text-[17px] font-extrabold tabular-nums leading-tight ${v == null ? MUTED : t.text}`}>{v == null ? '—' : fmtPct(v)}</p>
          {producto.fecha_semana_anterior && (
            <p className={`mt-0.5 text-[9.5px] ${MUTED}`}>{fechaCorta(parseDia(producto.fecha))} frente al {fechaCorta(parseDia(producto.fecha_semana_anterior))}</p>
          )}
        </div>
      </div>
    </section>
  )
}

function ProductosCarrusel({ productos, sel, onSelect, onVerTodos }) {
  const scroller = useRef(null)
  const [puedeAvanzar, setPuedeAvanzar] = useState(false)
  const medir = useCallback(() => {
    const el = scroller.current
    if (el) setPuedeAvanzar(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])
  useEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [medir, productos.length])

  return (
    <section className={`${CARD} min-w-0 px-3.5 pb-3.5 pt-3`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-0.5">
        <IcoSparkle className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>
        <h3 className={`text-[13.5px] ${TITLE}`}>Productos agrícolas</h3>
        <button type="button" onClick={onVerTodos} className="ml-auto inline-flex items-center gap-1.5 rounded-md text-[10.5px] font-semibold text-[#0b6b35] transition hover:text-[#02894b] hover:underline dark:text-emerald-400">
          Ver todos los productos
          <IcoArrowRight/>
        </button>
      </header>
      <div className="relative mt-2.5">
        <div ref={scroller} onScroll={medir} className="flex snap-x gap-2.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {productos.map((p) => {
            const activo = p.producto === sel
            const ui = UI[p.producto] ?? {}
            return (
              <button
                key={p.producto}
                type="button"
                onClick={() => onSelect(p.producto)}
                aria-pressed={activo}
                aria-label={`${p.nombre}: ${money(p.precio)} por ${unidadLarga(p.unidad)}`}
                className={`flex h-[106px] w-[150px] shrink-0 snap-start items-center gap-2.5 rounded-xl border p-1.5 text-left transition ${
                  activo
                    ? 'border-[#5dbb7f] bg-[#f3faf5] ring-1 ring-[#5dbb7f]/40 dark:border-emerald-400/50 dark:bg-emerald-400/[0.07]'
                    : 'border-[#e9eef1] bg-white hover:border-[#bfe3c9] hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-400/30'
                }`}
              >
                <ProductoImagen clave={p.producto} className="h-[90px] w-[54px] shrink-0 rounded-[10px]" emojiClass="text-[38px]"/>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] font-semibold text-[#0b1226] dark:text-white">{ui.corto ?? p.nombre}</span>
                  <span className="mt-1 block whitespace-nowrap">
                    <span className="text-[13px] font-bold tabular-nums text-[#0b1226] dark:text-white">{money(p.precio)}</span>
                    <span className={`text-[10px] ${MUTED}`}> / {unidadCorta(p.unidad)}</span>
                  </span>
                  <VariacionChip producto={p} className="mt-2 h-[22px] px-2 text-[10.5px]"/>
                  {p.variedades_detalle?.length > 1 && (
                    <span className={`mt-1 block text-[9.5px] ${MUTED}`}>{p.variedades_detalle.length} variedades</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {puedeAvanzar && (
          <button
            type="button"
            onClick={() => scroller.current?.scrollBy({ left: 320, behavior: 'smooth' })}
            aria-label="Ver más productos"
            className="absolute -right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[#e6ebf0] bg-white text-[#0b6b35] shadow-md transition hover:bg-[#f3faf5] dark:border-white/10 dark:bg-[#1b2940] dark:text-emerald-300"
          >
            <IcoChevron className="h-4 w-4 -rotate-90"/>
          </button>
        )}
      </div>
    </section>
  )
}

// Precio de cada variedad por separado; al tocar una, las tarjetas de arriba pasan a esa variedad
function Variedades({ producto, variedad, onSelect }) {
  const lista = producto.variedades_detalle ?? []
  if (lista.length < 2) return null
  const ui = UI[producto.producto] ?? {}
  const opciones = [
    { clave: null, nombre: 'Promedio', completo: `Promedio de ${lista.length} variedades`, item: producto },
    ...lista.map((v) => ({ clave: v.nombre, nombre: nombreVariedad(v.nombre, producto.producto), completo: v.nombre, item: v })),
  ]
  return (
    <section className={`${CARD} px-3.5 pb-3.5 pt-3`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-0.5">
        <IcoLayers className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>
        <h3 className={`text-[13.5px] ${TITLE}`}>Variedades {ui.del ?? `de ${producto.nombre.toLowerCase()}`}</h3>
        <span className="rounded-full bg-[#e5f6ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#0a6332] dark:bg-emerald-400/10 dark:text-emerald-300">{lista.length}</span>
        <span className={`ml-auto text-[10.5px] ${MUTED}`}>Precio por {unidadLarga(producto.unidad)} · toca una para ver su evolución</span>
      </header>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {opciones.map((o) => {
          const activo = (variedad ?? null) === o.clave
          return (
            <button
              key={o.clave ?? 'promedio'}
              type="button"
              onClick={() => onSelect(o.clave)}
              aria-pressed={activo}
              aria-label={`${o.completo}: ${money(o.item.precio)}`}
              title={o.completo}
              className={`min-w-0 rounded-xl border px-2.5 py-2 text-left transition ${
                activo
                  ? 'border-[#5dbb7f] bg-[#f3faf5] ring-1 ring-[#5dbb7f]/40 dark:border-emerald-400/50 dark:bg-emerald-400/[0.07]'
                  : 'border-[#e9eef1] bg-white hover:border-[#bfe3c9] hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-400/30'
              } ${o.clave === null ? 'bg-linear-to-br from-[#f6fbf8] to-[#eaf6ee] dark:from-white/[0.05] dark:to-white/[0.02]' : ''}`}
            >
              <span className={`block truncate text-[11px] font-semibold ${o.clave === null ? 'text-[#0b6b35] dark:text-emerald-300' : 'text-[#0b1226] dark:text-white'}`}>{o.nombre}</span>
              <span className="mt-1 flex items-center justify-between gap-1.5">
                <span className="text-[12.5px] font-bold tabular-nums text-[#0b1226] dark:text-white">{money(o.item.precio)}</span>
                <VariacionChip producto={o.item} className="h-5 px-1.5 text-[10px]"/>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function consejoDe(p) {
  const del = p.variedad
    ? `de la variedad ${nombreVariedad(p.variedad, p.producto)}`
    : UI[p.producto]?.del ?? `de ${p.nombre.toLowerCase()}`
  const v = p.variacion_semanal_pct
  if (v == null) return `Aún no hay historial suficiente para comparar el precio ${del} con la semana anterior.`
  if (p.tendencia === 'sube') return `El precio ${del} subió ${Math.abs(v).toFixed(1)} % frente a la semana anterior. Compara con lo que te ofrecen en finca antes de vender.`
  if (p.tendencia === 'baja') return `El precio ${del} bajó ${Math.abs(v).toFixed(1)} % frente a la semana anterior. Sigue los próximos boletines antes de vender.`
  return `El precio ${del} se mantiene estable frente a la semana anterior.`
}

function Consejos({ producto, fuenteUrl }) {
  return (
    <section className={`relative overflow-hidden rounded-xl border border-[#dcefe3] bg-linear-to-br from-[#f3faf6] to-[#e6f4ea] px-4 pb-3.5 pt-3 shadow-[0_6px_18px_-14px_rgba(15,40,30,0.28)] dark:border-[#1e3048] dark:from-[#162032] dark:to-[#132a24]`}>
      <img src={ilustracionConsejos} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[118px] w-auto select-none dark:opacity-60"/>
      <h3 className={`relative flex items-center gap-2 text-[13px] ${TITLE}`}>
        <IcoBulb className="h-[17px] w-[17px] text-[#0b8a4b] dark:text-emerald-400"/>
        Consejos
      </h3>
      <p className="relative mt-2.5 max-w-[60%] text-[11.5px] leading-[1.55] text-[#1d2640] dark:text-slate-200">{consejoDe(producto)}</p>
      <a
        href={fuenteUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-3 inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[#2d9a68] bg-white/70 px-3.5 text-[11px] font-semibold text-[#0b6b35] transition hover:bg-white dark:border-emerald-400/50 dark:bg-white/5 dark:text-emerald-300 dark:hover:bg-white/10"
      >
        Más información
        <IcoArrowRight/>
        <span className="sr-only"> (boletines del Mercado Mayorista de Ambato, se abre en otra pestaña)</span>
      </a>
    </section>
  )
}

// ── Pestaña «Tendencias» ──────────────────────────────────────────────────────
const colorTendencia = (tendencia, isDark) => (isDark
  ? (tendencia === 'baja' ? '#fdba74' : tendencia === 'sube' ? '#34d399' : '#94a3b8')
  : (tendencia === 'baja' ? '#c2410c' : tendencia === 'sube' ? '#2d9a68' : '#64748b'))

function Tendencias({ productos, dias, onVer, isDark }) {
  const [abiertos, setAbiertos] = useState(() => new Set())
  const alternar = (clave) => setAbiertos((prev) => {
    const next = new Set(prev)
    if (next.has(clave)) next.delete(clave)
    else next.add(clave)
    return next
  })
  const orden = [...productos].sort((a, b) => (b.variacion_semanal_pct ?? -Infinity) - (a.variacion_semanal_pct ?? -Infinity))
  const cuenta = { sube: 0, baja: 0, estable: 0 }
  productos.forEach((p) => { if (p.variacion_semanal_pct != null) cuenta[p.tendencia] += 1 })
  return (
    <section className={`${CARD} overflow-hidden`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <IcoChartLine className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>
        <h3 className={`text-[14px] ${TITLE}`}>Tendencias de la semana</h3>
        <span className="ml-auto flex flex-wrap gap-1.5 text-[10.5px] font-semibold">
          <span className={`rounded-full px-2 py-0.5 ${TREND.sube.chip}`}>{cuenta.sube} suben</span>
          <span className={`rounded-full px-2 py-0.5 ${TREND.baja.chip}`}>{cuenta.baja} bajan</span>
          <span className={`rounded-full px-2 py-0.5 ${TREND.estable.chip}`}>{cuenta.estable} estables</span>
        </span>
      </header>
      <ul>
        {orden.map((p) => {
          const desde = inicioPeriodo(p, dias)
          const serie = p.serie.filter((x) => parseDia(x.fecha) >= desde)
          const vals = serie.map((x) => Number(x.precio))
          const t = TREND[p.tendencia] ?? TREND.estable
          const variedades = p.variedades_detalle ?? []
          const abierto = abiertos.has(p.producto)
          const idLista = `variedades-${p.producto}`
          return (
            <li key={p.producto} className="border-t border-[#f1f3f8] dark:border-white/5">
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_auto_auto]">
                <ProductoImagen clave={p.producto} className="h-10 w-10 rounded-lg" emojiClass="text-[27px]"/>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[#0b1226] dark:text-white">{p.nombre}</p>
                  <p className={`truncate text-[10.5px] ${MUTED}`}>
                    {variedades.length > 1 ? 'Promedio ' : ''}{money(p.precio)} / {unidadLarga(p.unidad)}{vals.length > 1 ? ` · ${dias} días: ${money(Math.min(...vals))} – ${money(Math.max(...vals))}` : ''}
                  </p>
                  {variedades.length > 1 && (
                    <button
                      type="button"
                      onClick={() => alternar(p.producto)}
                      aria-expanded={abierto}
                      aria-controls={idLista}
                      className="mt-0.5 inline-flex items-center gap-1 rounded-md text-[10.5px] font-semibold text-[#0b6b35] transition hover:text-[#02894b] dark:text-emerald-400"
                    >
                      {abierto ? 'Ocultar' : 'Ver'} {variedades.length} variedades
                      <IcoChevron className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`}/>
                    </button>
                  )}
                </div>
                <div className="hidden min-w-0 sm:block"><MiniCurva serie={serie} color={colorTendencia(p.tendencia, isDark)}/></div>
                <VariacionChip producto={p} className="h-[22px] px-2 text-[10.5px]"/>
                <button type="button" onClick={() => onVer(p.producto)} className={`col-span-3 justify-self-start rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition sm:col-span-1 ${t.chip} hover:brightness-95`} aria-label={`Ver el detalle de ${p.nombre}`}>
                  Ver detalle
                </button>
              </div>
              {variedades.length > 1 && abierto && (
                <ul id={idLista} className="mb-2 ml-4 mr-4 rounded-xl border border-[#eef2f0] bg-[#fafcfb] dark:border-white/10 dark:bg-white/[0.02] sm:ml-[68px]">
                  {variedades.map((v, i) => {
                    const sv = v.serie.filter((x) => parseDia(x.fecha) >= desde)
                    return (
                      <li key={v.nombre} className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-3 py-1.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] ${i ? 'border-t border-[#eef2f0] dark:border-white/5' : ''}`}>
                        <p className="min-w-0 truncate text-[11.5px] text-[#1d2640] dark:text-slate-200" title={v.nombre}>
                          <span className="font-semibold">{nombreVariedad(v.nombre, p.producto)}</span>
                          <span className={`ml-1.5 tabular-nums ${MUTED}`}>{money(v.precio)}</span>
                        </p>
                        <div className="hidden min-w-0 sm:block"><MiniCurva serie={sv} color={colorTendencia(v.tendencia, isDark)}/></div>
                        <VariacionChip producto={v} className="h-5 px-1.5 text-[10px]"/>
                        <button type="button" onClick={() => onVer(p.producto, v.nombre)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#0b6b35] transition hover:bg-[#e5f6ee] dark:text-emerald-300 dark:hover:bg-emerald-400/10" aria-label={`Ver el detalle de ${v.nombre}`}>
                          Ver
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Pestaña «Recomendaciones» ─────────────────────────────────────────────────
function Recomendaciones({ productos, maizDuro }) {
  const maiz = productos.find((p) => p.producto === 'choclo')
  const destacados = productos
    .filter((p) => p.producto !== 'choclo' && p.variacion_semanal_pct != null && Math.abs(p.variacion_semanal_pct) >= 5)
    .sort((a, b) => Math.abs(b.variacion_semanal_pct) - Math.abs(a.variacion_semanal_pct))
    .slice(0, 4)
  const items = []
  if (maiz) items.push({ p: maiz, texto: consejoDe(maiz) })
  destacados.forEach((p) => {
    const de = `${money(p.precio_semana_anterior)} a ${money(p.precio)} por ${unidadLarga(p.unidad)}`
    items.push({
      p,
      texto: p.tendencia === 'sube'
        ? `${p.nombre} subió ${Math.abs(p.variacion_semanal_pct).toFixed(1)} % en la semana (de ${de}). Si tienes cosecha lista, compara precios y considera ofrecerla.`
        : `${p.nombre} bajó ${Math.abs(p.variacion_semanal_pct).toFixed(1)} % en la semana (de ${de}). Antes de vender, revisa cómo evoluciona en los próximos boletines.`,
    })
  })
  return (
    <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
      <section className={`${CARD} px-4 py-3.5`}>
        <h3 className={`flex items-center gap-2 text-[14px] ${TITLE}`}>
          <IcoBulb className="h-[18px] w-[18px] text-[#0b8a4b] dark:text-emerald-400"/>
          Recomendaciones según los precios
        </h3>
        <ol className="mt-3 space-y-2.5">
          {items.map(({ p, texto }, i) => {
            const t = TREND[p.tendencia] ?? TREND.estable
            return (
              <li key={p.producto} className="flex items-start gap-3 rounded-xl border border-[#eef2f0] bg-[#fafcfb] p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <span className="relative shrink-0">
                  <ProductoImagen clave={p.producto} className="h-10 w-10 rounded-lg" emojiClass="text-[27px]"/>
                  <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#0b8a4b] text-[10px] font-black text-white shadow">{i + 1}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[#0b1226] dark:text-white">
                    {p.nombre}
                    <VariacionChip producto={p} className="h-5 px-1.5 text-[10px]"/>
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#334155] dark:text-slate-300">{texto}</p>
                </div>
                <span className={`sr-only`}>{t.label}</span>
              </li>
            )
          })}
          {destacados.length === 0 && (
            <li className={`rounded-xl border border-dashed border-[#dfe7e2] p-3 text-[11.5px] ${MUTED} dark:border-white/10`}>
              Ningún otro producto cambió 5 % o más esta semana: los precios están estables.
            </li>
          )}
        </ol>
      </section>

      <div className="space-y-3">
        {maizDuro && (
          <section className={`${CARD} px-4 py-3.5`}>
            <h3 className={`text-[13.5px] ${TITLE}`}>Maíz duro (grano seco)</h3>
            <p className={`mt-0.5 text-[10.5px] ${MUTED}`}>Banda oficial temporada {maizDuro.temporada} · no cambia a diario</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
              {[['Piso', maizDuro.precio_min], ['Referencial', maizDuro.precio_promedio], ['Techo', maizDuro.precio_max]].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-[#f3faf5] px-2 py-1.5 dark:bg-white/5">
                  <p className={`text-[9.5px] font-semibold uppercase tracking-wide ${MUTED}`}>{l}</p>
                  <p className="text-[14px] font-extrabold tabular-nums text-[#0b1226] dark:text-white">{money(v)}</p>
                </div>
              ))}
            </div>
            <p className={`mt-2 text-[10px] leading-snug ${MUTED}`}>Por {maizDuro.unidad}. Fuente: {maizDuro.fuente}.</p>
          </section>
        )}
        <section className={`${CARD} px-4 py-3.5`}>
          <h3 className={`text-[13.5px] ${TITLE}`}>Cómo leer estos precios</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-[#334155] dark:text-slate-300">
            <li>• Son precios mayoristas del Mercado Mayorista de Ambato, por la presentación indicada (quintal, saco o malla). En finca suelen pagarse menos.</li>
            <li>• Cuando un producto tiene varias variedades se muestra su promedio y el rango del día.</li>
            <li>• El boletín se publica los días hábiles: fines de semana y feriados no hay precio nuevo.</li>
            <li>• Los valores claramente erróneos del boletín (p. ej. un saco a $2) no se incluyen en los gráficos.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
function MercadoHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10">
      <img src={banner} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-[70%_50%] dark:brightness-[0.45]"/>
      <div className="absolute inset-0 bg-linear-to-r from-white/85 via-white/60 to-white/10 lg:hidden dark:hidden"/>
      <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block"/>
      <div className="relative flex items-center gap-4 px-4 py-5 sm:pl-[26px] sm:pr-6 sm:py-[26px]">
        <span className="hidden h-[60px] w-[60px] shrink-0 place-items-center rounded-[16px] bg-linear-to-b from-[#20a565] to-[#047a3f] text-white shadow-[0_10px_20px_-10px_rgba(3,120,60,0.9)] sm:grid">
          <IcoTrendUp className="h-8 w-8"/>
        </span>
        <div className="min-w-0">
          <h2 className="text-[23px] font-extrabold leading-tight text-[#0b1226] dark:text-white">
            Mercado <span className="text-[#0b8a4b] dark:text-emerald-400">agrícola</span>
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-[#1d2640] dark:text-slate-300">
            Consulta los precios actuales y toma mejores decisiones<br className="hidden sm:inline"/> para tu cultivo.
          </p>
        </div>
      </div>
    </section>
  )
}

function Cargando() {
  return (
    <div aria-busy="true" aria-label="Cargando precios" className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-[200px] animate-pulse rounded-xl bg-white/70 dark:bg-white/5"/>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-[2.3fr_1fr]">
        {[0, 1].map((i) => <div key={i} className="h-[170px] animate-pulse rounded-xl bg-white/70 dark:bg-white/5"/>)}
      </div>
    </div>
  )
}

export default function Mercado() {
  const { isDark } = useTheme()
  const [data, setData] = useState(null)
  const [estado, setEstado] = useState('cargando')   // cargando | listo | error
  const [tab, setTab] = useState('precios')
  const [dias, setDias] = useState(7)
  const [sel, setSel] = useState('choclo')
  const [variedad, setVariedad] = useState(null)   // null = promedio del producto
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    setEstado('cargando')
    fetchMercadoProductos(120)
      .then((res) => { if (!cancelado) { setData(res.data); setEstado('listo') } })
      .catch(() => { if (!cancelado) setEstado('error') })
    return () => { cancelado = true }
  }, [intento])

  const productos = useMemo(() => data?.productos ?? [], [data])
  const actual = productos.find((p) => p.producto === sel) ?? productos[0]
  const vista = vistaDe(actual, variedad)
  const elegirProducto = (clave) => { setSel(clave); setVariedad(null) }
  const verDetalle = (clave, nombreVar = null) => {
    setSel(clave)
    setVariedad(nombreVar)
    setTab('precios')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const actualizado = data?.actualizado ? parseDia(data.actualizado) : null
  const desactualizado = actualizado && (Date.now() - actualizado.getTime()) / DAY > 6

  return (
    <div className="space-y-3">
      <MercadoHero/>

      {/* Pestañas y periodo */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="tablist" aria-label="Secciones del mercado" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const activo = tab === t.id
            const Icono = t.id === 'precios' ? IcoSprout : t.id === 'tendencias' ? IcoChartLine : IcoBulb
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setTab(t.id)}
                className={`inline-flex h-[34px] items-center gap-2 rounded-full px-5 text-[12px] font-semibold transition ${
                  activo
                    ? 'bg-linear-to-r from-[#1a8a55] to-[#2a9a64] text-white shadow-[0_8px_16px_-10px_rgba(10,120,70,0.9)]'
                    : 'bg-[#eef2f8] text-[#223048] hover:bg-[#e3eaf3] dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
                }`}
              >
                <Icono className="h-4 w-4"/>
                {t.label}
              </button>
            )
          })}
        </div>
        <label className="relative ml-auto inline-flex h-[36px] items-center rounded-full border border-[#e3e9ee] bg-white pl-3 pr-2 text-[11.5px] font-medium text-[#223048] shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <IcoCalendar className="pointer-events-none h-4 w-4 text-[#384862] dark:text-slate-400"/>
          <span className="sr-only">Periodo</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="cursor-pointer appearance-none bg-transparent py-1 pl-2 pr-6 font-medium outline-none dark:[color-scheme:dark]">
            {PERIODOS.map((p) => <option key={p.dias} value={p.dias}>{p.label}</option>)}
          </select>
          <IcoChevron className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#384862] dark:text-slate-400"/>
        </label>
      </div>

      {estado === 'cargando' && <Cargando/>}

      {estado === 'error' && (
        <section className={`${CARD} px-5 py-6 text-center`}>
          <p className={`text-[13px] ${TITLE}`}>No se pudieron cargar los precios del mercado</p>
          <p className={`mt-1 text-[11.5px] ${MUTED}`}>Revisa tu conexión e inténtalo de nuevo en unos minutos.</p>
          <button type="button" onClick={() => setIntento((n) => n + 1)} className="mt-3 inline-flex h-8 items-center rounded-full bg-[#02894b] px-4 text-[11.5px] font-semibold text-white transition hover:bg-[#027a42]">
            Reintentar
          </button>
        </section>
      )}

      {estado === 'listo' && !actual && (
        <section className={`${CARD} px-5 py-6 text-center`}>
          <p className={`text-[13px] ${TITLE}`}>Aún no hay precios guardados</p>
          <p className={`mt-1 text-[11.5px] ${MUTED}`}>El sistema los descarga del boletín diario del Mercado Mayorista de Ambato. Vuelve a intentarlo en unos minutos.</p>
          <button type="button" onClick={() => setIntento((n) => n + 1)} className="mt-3 inline-flex h-8 items-center rounded-full bg-[#02894b] px-4 text-[11.5px] font-semibold text-white transition hover:bg-[#027a42]">
            Actualizar
          </button>
        </section>
      )}

      {estado === 'listo' && actual && (
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="space-y-3">
          {tab === 'precios' && (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.5fr)_minmax(0,0.98fr)]">
                <PrecioActual producto={vista}/>
                <div className="min-w-0 md:order-last md:col-span-2 xl:order-none xl:col-span-1">
                  <Evolucion producto={vista} dias={dias} isDark={isDark}/>
                </div>
                <EstadoMercado producto={vista}/>
              </div>
              <Variedades producto={actual} variedad={variedad} onSelect={setVariedad}/>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
                <ProductosCarrusel productos={productos} sel={actual.producto} onSelect={elegirProducto} onVerTodos={() => setTab('tendencias')}/>
                <Consejos producto={vista} fuenteUrl={data.fuente_url}/>
              </div>
            </>
          )}
          {tab === 'tendencias' && <Tendencias productos={productos} dias={dias} onVer={verDetalle} isDark={isDark}/>}
          {tab === 'recomendaciones' && <Recomendaciones productos={productos} maizDuro={data.maiz_duro}/>}
        </div>
      )}

      {estado === 'listo' && actualizado && (
        <p className={`px-1 text-[10.5px] ${desactualizado ? 'text-amber-700 dark:text-amber-300' : MUTED}`}>
          Fuente: boletín diario del {data.fuente} · último boletín: {fechaLarga(actualizado)}
          {desactualizado && ' (no hay boletines más recientes)'} ·{' '}
          <a href={data.fuente_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0b6b35] underline-offset-2 hover:underline dark:text-emerald-400">
            ver boletines<span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        </p>
      )}
    </div>
  )
}
