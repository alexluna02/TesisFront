import { useState, useRef, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as turf from '@turf/turf'
import { predictXai, createAnalisis } from './api.js'
import { SEVERITY_LEGEND, SEVERITY_LIMITS, SEVERITY_PALETTE, affectedPercent, isHealthyClass, lotSeverity, normalizeParcelRecord, severityOf } from './severity.js'
import { useTheme } from './ThemeContext.jsx'
import ParcelMiniMap from './ParcelMiniMap.jsx'
import { RESULT_STYLE, SEVERITY_CHIP, resultColor, resultKeyOf, visitResultKey, whenLabel } from './resultados.js'
import SeverityScale from './SeverityScale.jsx'
import heroDron from './Imagenes/hero-dron.webp'
import inicioHojas from './Imagenes/inicio-hojas.png'
import ilustracionSubir from './Imagenes/parcela-subir.png'
import fotoTizon from './Imagenes/parcela-tizon.webp'
import fotoRoya from './Imagenes/parcela-roya.webp'
import fotoMancha from './Imagenes/parcela-mancha.webp'

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Colored SVG markers ───────────────────────────────────────────────────────
const makeIcon = (color, label) => L.divIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;border-radius:50% 50% 50% 0;
    background:${color};border:2.5px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    transform:rotate(-45deg);
    display:flex;align-items:center;justify-content:center;
  ">
    <span style="transform:rotate(45deg);color:#fff;font-size:10px;font-weight:800;line-height:1">${label}</span>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
})

const DISEASE_LABELS = {
  Fondo_y_Sana:  'Sano',
  Fondo:         'Sano',
  Tizon:         'Tizón',
  Roya:          'Roya',
  Mancha_Blanca: 'M.Blanca',
  Mancha_blanca: 'M.Blanca',
}

// Sampling points count by hectares
function getSampleCount(ha) {
  if (ha < 0.5)  return 5
  if (ha < 1)    return 7
  if (ha < 2)    return 9
  if (ha < 5)    return 12
  return 16
}

// Generate sampling points inside a polygon using a grid
function generateSamplingPoints(latLngs, targetCount) {
  const coords = latLngs.map(p => [p.lng, p.lat])
  coords.push(coords[0]) // close ring
  const poly = turf.polygon([coords])
  const bbox = turf.bbox(poly)

  // Try increasing grid density until we get enough interior points
  let points = []
  let step = 0.002
  for (let tries = 0; tries < 10 && points.length < targetCount; tries++) {
    const grid = turf.pointGrid(bbox, step, { units: 'degrees' })
    points = grid.features.filter(f => turf.booleanPointInPolygon(f, poly))
    step *= 0.8
  }

  // If still not enough, fall back to centroids of a triangulated grid
  if (points.length === 0) {
    points = [turf.centroid(poly)]
  }

  // Spread selected points evenly across the available ones
  if (points.length <= targetCount) return points
  const step2 = Math.floor(points.length / targetCount)
  return Array.from({ length: targetCount }, (_, i) => points[Math.min(i * step2, points.length - 1)])
}

// ── Map click handler ─────────────────────────────────────────────────────────
function PolygonDrawer({ onAddPoint }) {
  useMapEvents({ click: (e) => onAddPoint(e.latlng) })
  return null
}

// ── Diseño de la maqueta del usuario (Analizar parcela) ───────────────────────
// Medidas a la escala en que el usuario ve sus maquetas (~0,68) y los mismos colores que Inicio.
export const PARCEL_CARD = 'rounded-xl border border-[#e6ebf0] bg-white shadow-[0_6px_18px_-14px_rgba(15,40,30,0.28)] dark:border-[#1e3048] dark:bg-[#162032]'
export const PARCEL_TITLE = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
export const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#02894b] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(2,137,75,0.7)] transition hover:bg-[#027a42] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

export const IcoArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
)
const IcoField = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.5 5h9l3.5 14H4L7.5 5Z"/><path d="M10.5 5 9.5 19M13.5 5l1 14M5.7 12h12.6"/><path d="M8 3.5v-1M12 3.5v-1M16 3.5v-1"/>
  </svg>
)
const IcoMapPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
    <path d="M9 4 3 6.5V20l6-2.5 6 2.5 2-.8M9 4v13.5M15 6.5V12M9 4l6 2.5 6-2.5v8"/><path d="M19 15v6M16 18h6"/>
  </svg>
)
export const IcoCloudUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
    <path d="M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 8a4 4 0 0 1 0 8h-1"/><path d="M12 12v8M9 15l3-3 3 3"/>
  </svg>
)
const IcoInfoDot = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 shrink-0"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 11v6M12 7.5v.01" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/></svg>
)
const IcoSproutGreen = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path d="M11.4 20.6C11 15.4 8.4 12 3.2 11.2c.3 4.8 3.4 8.2 8.2 9.4Z" fill="#14a35d"/>
    <path d="M12.6 20.6c.2-6.6 2.8-11.6 8.3-14.8.9 6.8-2.1 12.5-8.3 14.8Z" fill="#05803f"/>
    <path d="M12 21v-3.5" stroke="#05803f" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)
const IcoBarsGreen = () => (
  <svg viewBox="0 0 24 24" fill="#0b8a4b" aria-hidden="true" className="h-[17px] w-[17px] shrink-0">
    <rect x="4.5" y="12" width="3.6" height="7.5" rx="1"/><rect x="10.2" y="8" width="3.6" height="11.5" rx="1"/><rect x="15.9" y="4.5" width="3.6" height="15" rx="1"/>
  </svg>
)
const IcoHistoryGreen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#0b8a4b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 7.5V12l3 2"/>
  </svg>
)
const IcoCalendarSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3 shrink-0">
    <rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>
  </svg>
)
export function CheckDot() {
  return (
    <span aria-hidden="true" className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#0b8a4b] text-white dark:bg-emerald-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" className="h-2 w-2"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </span>
  )
}

// Banner como el de Inicio: foto del dron con cristal esmerilado e icono de parcela
function ParcelHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10">
      <img src={heroDron} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-left dark:brightness-[0.45]"/>
      <div className="absolute inset-0 bg-linear-to-r from-white/80 via-white/55 to-white/10 lg:hidden dark:hidden"/>
      <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block"/>
      <div className="relative flex items-start gap-4 px-4 pb-4 pt-5 sm:pl-[18px] sm:pr-6">
        <span className="hidden h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-linear-to-b from-[#13a35c] to-[#03823f] text-white shadow-[0_8px_18px_-8px_rgba(3,130,63,0.8)] sm:grid [&>svg]:h-7 [&>svg]:w-7">
          <IcoField/>
        </span>
        <div className="min-w-0">
          <h2 className="text-[23px] font-extrabold leading-tight text-[#0b1226] dark:text-white">
            Analiza <span className="text-[#0b8a4b] dark:text-emerald-400">tu parcela</span>
          </h2>
          <p className="mt-1 text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-300">
            Detecta enfermedades en tus cultivos de maíz<br className="hidden sm:inline"/> con inteligencia artificial.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {['Resultados precisos', 'Rápido y fácil', 'Impulsa tu producción'].map((t) => (
              <li key={t} className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#1d2640] dark:text-slate-200"><CheckDot/>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ── Indicador de pasos (como el de la maqueta) ────────────────────────────────
const STEPS = ['Elegir parcela', 'Subir imágenes', 'Ver resultados']

export function StepBar({ current, steps = STEPS }) {
  // La línea verde llega un poco más allá del paso actual, como en la maqueta
  const progress = Math.min(100, ((current + 0.5) / steps.length) * 100 + 12)
  return (
    <ol aria-label="Pasos del análisis" className="relative mx-auto grid w-full max-w-4xl grid-cols-3">
      <span aria-hidden="true" className="absolute left-[4%] right-[4%] top-[13px] h-0.5 rounded-full bg-[#dfe7e2] dark:bg-white/10"/>
      <span aria-hidden="true" className="absolute left-[4%] top-[13px] h-0.5 rounded-full bg-[#0b8a4b] transition-[width] duration-500 dark:bg-emerald-500" style={{ width: `${Math.min(92, progress - 4)}%` }}/>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s} aria-current={active ? 'step' : undefined} className="relative flex flex-col items-center gap-1.5">
            <span className={`grid h-[27px] w-[27px] place-items-center rounded-full text-[11.5px] font-bold ${
              done || active
                ? 'bg-[#0b8a4b] text-white shadow-[0_0_0_4px_rgba(11,138,75,0.14)] dark:bg-emerald-500'
                : 'border-2 border-[#cfdcd5] bg-white text-[#6b7a88] dark:border-white/15 dark:bg-[#0f1a2b] dark:text-slate-400'
            }`}>
              {done ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
              ) : i + 1}
            </span>
            <span className={`text-[11px] font-semibold ${active ? 'text-[#0b6b35] dark:text-emerald-400' : done ? 'text-[#0b6b35]/80 dark:text-emerald-400/80' : 'text-[#5a6478] dark:text-slate-400'}`}>
              {s}
              {done && <span className="sr-only"> (completado)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Botones e iconos de los pasos de mapa ─────────────────────────────────────
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-[#dfe7e2] bg-white px-4 font-semibold text-[#334155] transition hover:border-[#bfe3c9] hover:bg-[#f6fbf7] disabled:pointer-events-none disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'
const BTN_DANGER = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 font-semibold text-red-600 transition hover:bg-red-50 disabled:pointer-events-none disabled:opacity-40 dark:border-red-400/25 dark:bg-white/5 dark:text-red-300 dark:hover:bg-red-500/10'
const STEP_ICON = 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e5f6ee] text-[#0b8a4b] dark:bg-emerald-400/10 dark:text-emerald-300 [&>svg]:h-4 [&>svg]:w-4'

const IcoUndo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
    <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
  </svg>
)
const IcoPinSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>
  </svg>
)

// Mapa satelital con nombres de lugares, común a dibujo, vista previa, muestras y reporte
const SatelliteLayers = ({ labelsOpacity = 0.6 }) => (
  <>
    <TileLayer attribution="&copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"/>
    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" opacity={labelsOpacity}/>
  </>
)

// ── Paso 1b: dibujar el contorno del lote ─────────────────────────────────────
function StepDraw({ onDone, parcelName }) {
  const [vertices, setVertices] = useState([])
  const [closed, setClosed]     = useState(false)

  const addPoint = useCallback((latlng) => {
    if (closed) return
    setVertices(v => [...v, latlng])
  }, [closed])

  const undo = () => setVertices(v => v.slice(0, -1))
  const reset = () => { setVertices([]); setClosed(false) }

  const closeAndConfirm = () => {
    if (vertices.length < 3) return
    const coords = vertices.map(p => [p.lng, p.lat])
    coords.push(coords[0])
    const poly = turf.polygon([coords])
    const areaM2 = turf.area(poly)
    const ha = areaM2 / 10000
    const sampleCount = getSampleCount(ha)
    const samplingPoints = generateSamplingPoints(vertices, sampleCount)
    onDone({ vertices, ha, sampleCount, samplingPoints })
  }

  const ready = vertices.length >= 3
  return (
    <section className={`${PARCEL_CARD} overflow-hidden`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className={STEP_ICON}><IcoMapPlus/></span>
        <div className="min-w-[200px] flex-1">
          <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Dibuja el contorno {parcelName ? `de «${parcelName}»` : 'de tu lote'}</h3>
          <p className="text-[11px] text-[#4b556c] dark:text-slate-400">Haz clic en el mapa para marcar cada esquina del lote (mínimo 3). Acerca con la rueda y arrastra para moverte.</p>
        </div>
        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[10.5px] font-semibold ${ready ? 'bg-[#d8f1e8] text-[#0a6b53] dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
          {vertices.length} vértice{vertices.length !== 1 ? 's' : ''} · {ready ? 'listo para cerrar' : 'mínimo 3'}
        </span>
      </header>
      <div className="h-[420px] border-y border-[#eef2f0] dark:border-white/10">
        <MapContainer center={[0.3516, -78.1223]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <SatelliteLayers/>
          <PolygonDrawer onAddPoint={addPoint} />
          {vertices.length >= 3 && (
            <Polygon
              positions={vertices}
              pathOptions={{ color: '#ffffff', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2.5, dashArray: '6 4' }}
            />
          )}
          {vertices.length >= 1 && vertices.length < 3 && vertices.map((v, i) => (
            <Marker key={i} position={v} icon={makeIcon('#0b8a4b', i + 1)} />
          ))}
        </MapContainer>
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
        <button type="button" onClick={undo} disabled={vertices.length === 0} className={`${BTN_SECONDARY} h-8 text-[11.5px]`}>
          <IcoUndo/>
          Deshacer
        </button>
        <button type="button" onClick={reset} disabled={vertices.length === 0} className={`${BTN_DANGER} h-8 text-[11.5px]`}>
          Borrar todo
        </button>
        <button type="button" onClick={closeAndConfirm} disabled={!ready} className={`${BTN_PRIMARY} h-8 px-5 text-[11.5px]`}>
          Cerrar polígono
          <IcoArrow/>
        </button>
      </footer>
    </section>
  )
}

// ── Paso 1c: revisar el lote y sus puntos de muestreo ─────────────────────────
function StepPreview({ data, onConfirm, onBack }) {
  const { vertices, ha, samplingPoints } = data
  const points = samplingPoints.length
  const metrics = [
    { label: 'Área del lote', value: ha.toFixed(2), unit: 'ha', tone: 'border-sky-100 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200' },
    { label: 'Puntos de muestreo', value: points, unit: '', tone: 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200' },
    { label: 'Cobertura', value: points ? (ha / points * 10000).toFixed(0) : '—', unit: 'm² por punto', tone: 'border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200' },
  ]
  return (
    <section className={`${PARCEL_CARD} overflow-hidden`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <span className={STEP_ICON}><IcoPinSm/></span>
        <div className="min-w-[200px] flex-1">
          <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Revisa los puntos de muestreo</h3>
          <p className="text-[11px] text-[#4b556c] dark:text-slate-400">Repartimos {points} punto{points !== 1 ? 's' : ''} por el lote; en cada uno tomarás una foto de las hojas.</p>
        </div>
      </header>
      <div className="grid grid-cols-3 gap-2.5 px-4 pb-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-xl border px-3 py-2 text-center ${m.tone}`}>
            <p className="text-[9.5px] font-bold uppercase tracking-wide opacity-80">{m.label}</p>
            <p className="font-[Manrope,Inter,sans-serif] text-[19px] font-extrabold leading-tight">
              {m.value} {m.unit && <span className="text-[10.5px] font-semibold">{m.unit}</span>}
            </p>
          </div>
        ))}
      </div>
      <div className="h-[380px] border-y border-[#eef2f0] dark:border-white/10">
        <MapContainer center={[vertices[0].lat, vertices[0].lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
          <SatelliteLayers/>
          <FitBounds vertices={vertices} />
          <Polygon positions={vertices} pathOptions={{ color: '#ffffff', fillColor: '#22c55e', fillOpacity: 0.15, weight: 2.5 }} />
          {samplingPoints.map((pt, i) => {
            const [lng, lat] = pt.geometry.coordinates
            return (
              <Marker key={i} position={[lat, lng]} icon={makeIcon('#0b8a4b', i + 1)}>
                <Tooltip direction="top" offset={[0, -34]}>
                  <span className="text-[10px] font-bold">Punto {i + 1}</span>
                </Tooltip>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
        <button type="button" onClick={onBack} className={`${BTN_SECONDARY} h-8 text-[11.5px]`}>
          <IcoUndo/>
          Redibujar
        </button>
        <button type="button" onClick={onConfirm} className={`${BTN_PRIMARY} h-8 px-5 text-[11.5px]`}>
          Comenzar análisis
          <IcoArrow/>
        </button>
      </footer>
    </section>
  )
}

// ── Auto-fit map to polygon bounds ────────────────────────────────────────────
function FitBounds({ vertices }) {
  const map = useMap()
  useEffect(() => {
    if (!vertices || vertices.length < 2) return
    const bounds = L.latLngBounds(vertices)
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 })
  }, [map, vertices])
  return null
}

// ── Marcador numerado de cada punto en el mapa de muestras ────────────────────
// Sin foto: gris pizarra · con foto: azul · analizado: color de su resultado (paleta de Inicio)
const SAMPLE_MARKER = { empty: '#475569', ready: '#0284c7', loading: '#64748b', error: '#dc2626' }

function sampleColor(sample, isDark) {
  if (sample.status === 'loading') return SAMPLE_MARKER.loading
  if (sample.status === 'error') return SAMPLE_MARKER.error
  if (sample.status === 'done' && sample.result) {
    const cls = sample.result.target_class
    return resultColor(resultKeyOf(cls, isHealthyClass(cls)), isDark)
  }
  return sample.file ? SAMPLE_MARKER.ready : SAMPLE_MARKER.empty
}

function makeSampleIcon(sample, isHovered, color) {
  const size   = isHovered ? 38 : 30
  const anchor = isHovered ? 19 : 15
  const border = isHovered ? '3px solid #fff' : '2px solid rgba(255,255,255,0.9)'
  const shadow = isHovered ? '0 0 0 3px rgba(11,138,75,0.5), 0 3px 10px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.35)'
  const numStr = sample.label.replace('P', '')
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:${border};
      box-shadow:${shadow};
      display:flex;align-items:center;justify-content:center;
      transition:all 0.15s;
    ">
      <span style="color:#fff;font-size:${isHovered ? 13 : 11}px;font-weight:900;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,0.35)">${numStr}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  })
}

const IcoAlertSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4.5M12 17.5v.01"/>
  </svg>
)
const IcoLeafSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/>
  </svg>
)
const IcoGaugeSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-5"/>
  </svg>
)
const IcoCloseSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12"/></svg>
)
const Spinner = ({ className = 'h-5 w-5 border-[#0b8a4b]' }) => (
  <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-t-transparent ${className}`}/>
)

// ── Paso 2: subir y analizar la foto de cada punto ────────────────────────────
function StepSamples({ data, parcelName, onDone, onRedraw }) {
  const { isDark } = useTheme()
  const { samplingPoints, vertices } = data
  const [samples, setSamples] = useState(() =>
    samplingPoints.map((pt, i) => ({
      id: i,
      coords: pt.geometry.coordinates, // [lng, lat]
      label: `P${i + 1}`,
      file: null,
      preview: null,
      status: 'pending', // pending | loading | done | error
      result: null,
      error: null,
    }))
  )
  const [analyzing, setAnalyzing]   = useState(false)
  const [hoveredId, setHoveredId]   = useState(null)
  const [bulkNote, setBulkNote]     = useState('')

  const handleFile = (idx, file) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setSamples(s => s.map((item, i) =>
      i === idx ? { ...item, file, preview, status: 'pending', result: null, error: null } : item
    ))
  }

  // Varias fotos a la vez: en orden de nombre de archivo, a los puntos que aún no tienen foto
  const assignFiles = (files) => {
    const images = files
      .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    if (images.length === 0) { setBulkNote('Ninguno de los archivos es una imagen JPG, PNG o WEBP.'); return }
    const next = [...samples]
    let k = 0
    for (let i = 0; i < next.length && k < images.length; i += 1) {
      if (!next[i].file && next[i].status !== 'done') {
        const file = images[k++]
        next[i] = { ...next[i], file, preview: URL.createObjectURL(file), status: 'pending', result: null, error: null }
      }
    }
    setSamples(next)
    const extra = images.length - k
    setBulkNote(k === 0
      ? 'Todos los puntos ya tienen foto: cámbiala desde la tarjeta de cada punto.'
      : `Se asignaron ${k} foto${k !== 1 ? 's' : ''}${extra > 0 ? `; ${extra} no tenía${extra !== 1 ? 'n' : ''} punto libre` : ''}.`)
  }
  const freeCount = samples.filter((s) => !s.file && s.status !== 'done').length

  const analyzeAll = async () => {
    setAnalyzing(true)
    const pending = samples.filter(s => s.file && s.status !== 'done')
    for (const sample of pending) {
      setSamples(s => s.map(item => item.id === sample.id ? { ...item, status: 'loading' } : item))
      try {
        const formData = new FormData()
        formData.append('file', sample.file)
        const response = await predictXai(formData)
        const raw = response.data
        const confidence = affectedPercent(raw.target_class, raw.confidence ?? raw.afectacion_pct)
        setSamples(s => s.map(item =>
          item.id === sample.id
            ? { ...item, status: 'done', result: { ...raw, confidence } }
            : item
        ))
      } catch (e) {
        setSamples(s => s.map(item =>
          item.id === sample.id
            ? { ...item, status: 'error', error: e?.response?.data?.detail || 'Error al analizar' }
            : item
        ))
      }
    }
    setAnalyzing(false)
  }

  const total     = samples.length
  const done      = samples.filter(s => s.status === 'done').length
  const withPhoto = samples.filter(s => s.file).length
  const errors    = samples.filter(s => s.status === 'error').length
  const toAnalyze = samples.filter(s => s.file && s.status !== 'done').length
  const hasFile   = toAnalyze > 0
  const allDone   = samples.every(s => s.status === 'done')
  const legend = [
    { color: SAMPLE_MARKER.empty, label: 'Sin foto' },
    { color: SAMPLE_MARKER.ready, label: 'Con foto' },
    ...['sano', 'tizon', 'roya', 'mancha'].map((k) => ({ color: resultColor(k, isDark), label: RESULT_STYLE[k].short })),
    { color: SAMPLE_MARKER.error, label: 'Error' },
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen y acción principal */}
      <section className={`${PARCEL_CARD} px-4 py-3`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <span className={STEP_ICON}><IcoCloudUp/></span>
          <div className="min-w-[200px] flex-1">
            <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Sube una foto por cada punto de muestreo</h3>
            <p className="text-[11px] text-[#4b556c] dark:text-slate-400">
              {parcelName ? `${parcelName} · ` : ''}{total} punto{total !== 1 ? 's' : ''} · {done} analizado{done !== 1 ? 's' : ''}{errors > 0 ? ` · ${errors} con error` : ''}
            </p>
          </div>
          {onRedraw && (
            <button type="button" onClick={onRedraw} className={`${BTN_SECONDARY} h-8 text-[11px]`}>
              <IcoUndo/>
              Redibujar lote
            </button>
          )}
          {allDone ? (
            <button type="button" onClick={() => onDone(samples)} className={`${BTN_PRIMARY} h-8 px-5 text-[11.5px]`}>
              Ver resultados
              <IcoArrow/>
            </button>
          ) : (
            <button type="button" onClick={analyzeAll} disabled={analyzing || !hasFile} className={`${BTN_PRIMARY} h-8 px-5 text-[11.5px]`}>
              {analyzing ? <><Spinner className="h-3.5 w-3.5 border-white"/> Analizando…</> : <>Analizar {toAnalyze > 0 ? toAnalyze : ''} foto{toAnalyze !== 1 ? 's' : ''}<IcoArrow/></>}
            </button>
          )}
        </div>
        {/* Progreso: verde = analizadas, verde claro = con foto pendiente de analizar */}
        <div className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-[#e7efe9] dark:bg-white/10" role="progressbar" aria-label="Puntos analizados" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <span className="h-full bg-[#0b8a4b] transition-all duration-500 dark:bg-emerald-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }}/>
            <span className="h-full bg-[#9fd9b3] transition-all duration-500 dark:bg-emerald-400/40" style={{ width: `${total ? ((withPhoto - done) / total) * 100 : 0}%` }}/>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#64748b] dark:text-slate-400">
            <span>{withPhoto} de {total} con foto</span>
            <span>{done} de {total} analizados</span>
          </div>
        </div>
      </section>

      {!allDone && <BulkDrop freeCount={freeCount} note={bulkNote} onFiles={assignFiles} />}

      <div className="grid items-start gap-3 lg:grid-cols-[290px_1fr] xl:grid-cols-[320px_1fr]">
        {/* Mapa del lote con los puntos */}
        <section className={`${PARCEL_CARD} overflow-hidden lg:sticky lg:top-[64px]`}>
          <header className="flex items-center gap-2 px-3.5 py-2.5">
            <span className="text-[#0b8a4b] dark:text-emerald-400 [&>svg]:h-4 [&>svg]:w-4"><IcoPinSm/></span>
            <h3 className={`text-[12.5px] ${PARCEL_TITLE}`}>Puntos en el lote</h3>
            <span className="ml-auto text-[10px] text-[#64748b] dark:text-slate-400">Pasa el cursor por una foto</span>
          </header>
          <div className="h-[300px] border-y border-[#eef2f0] dark:border-white/10">
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
              <SatelliteLayers labelsOpacity={0.5}/>
              <FitBounds vertices={vertices} />
              <Polygon positions={vertices} pathOptions={{ color: '#ffffff', fillColor: '#22c55e', fillOpacity: 0.12, weight: 2.5 }} />
              {samples.map(sample => {
                const [lng, lat] = sample.coords
                const isHov = hoveredId === sample.id
                return (
                  <Marker key={sample.id} position={[lat, lng]} icon={makeSampleIcon(sample, isHov, sampleColor(sample, isDark))} zIndexOffset={isHov ? 1000 : 0}>
                    <Tooltip direction="top" offset={[0, isHov ? -22 : -18]} permanent={isHov}>
                      <span className="text-[10px] font-bold">Punto {sample.label.replace('P', '')}</span>
                      {sample.status === 'done' && sample.result && (
                        <span className="ml-1 text-[10px]">— {DISEASE_LABELS[sample.result.target_class] ?? '?'} {Math.round(sample.result.confidence)}%</span>
                      )}
                    </Tooltip>
                  </Marker>
                )
              })}
            </MapContainer>
          </div>
          <footer className="flex flex-wrap gap-x-3 gap-y-1.5 px-3.5 py-2.5">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-[#4b556c] dark:text-slate-400">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: l.color }}/>
                {l.label}
              </span>
            ))}
          </footer>
        </section>

        {/* Una tarjeta por punto: foto (o zona para soltarla) y su resultado */}
        <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          {samples.map((sample, idx) => (
            <SampleTile
              key={sample.id}
              sample={sample}
              hovered={hoveredId === sample.id}
              disabled={analyzing}
              onFile={(f) => handleFile(idx, f)}
              onHover={setHoveredId}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Zona para soltar varias fotos a la vez (la de la maqueta): se asignan en orden, por nombre de
// archivo, a los puntos que aún no tienen foto; cada punto se puede cambiar luego en su tarjeta
function BulkDrop({ freeCount, note, onFiles }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  const take = (list) => onFiles([...(list ?? [])])
  return (
    <section className={`${PARCEL_CARD} p-2.5`}>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false) }}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
        className={`flex flex-col items-center rounded-[12px] border-2 border-dashed px-6 py-4 text-center transition ${
          over
            ? 'border-[#0b8a4b] bg-[#e9f6ee] dark:border-emerald-400 dark:bg-emerald-400/10'
            : 'border-[#c6e8d2] bg-linear-to-b from-[#fbfdfc] to-[#f0f8f2] dark:border-emerald-400/20 dark:from-white/[0.02] dark:to-emerald-400/[0.05]'
        }`}
      >
        <img src={ilustracionSubir} alt="" aria-hidden="true" draggable="false" className="h-[62px] w-auto select-none"/>
        <h3 className={`mt-1 text-[15px] ${PARCEL_TITLE}`}>Arrastra aquí las fotos de los puntos</h3>
        <p className="mt-0.5 text-[11px] text-[#4b556c] dark:text-slate-400">o selecciónalas desde tu dispositivo · se asignan en orden a los puntos sin foto</p>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={freeCount === 0} className={`${BTN_PRIMARY} mt-3 h-[32px] px-5 text-[11.5px]`}>
          <IcoCloudUp/>
          Seleccionar imágenes
          <IcoArrow/>
        </button>
        <p className="mt-2 text-[9.5px] text-[#64748b] dark:text-slate-500">
          Formatos admitidos: JPG, PNG, WEBP · {freeCount === 0 ? 'todos los puntos tienen foto' : `${freeCount} punto${freeCount !== 1 ? 's' : ''} sin foto`}
        </p>
        {note && <p role="status" className="mt-1.5 text-[10.5px] font-semibold text-[#0b6b35] dark:text-emerald-400">{note}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { take(e.target.files); e.target.value = '' }}
        />
      </div>
    </section>
  )
}

const SAMPLE_STATUS = {
  empty:   { label: 'Sin foto',     chip: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
  ready:   { label: 'Lista',        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200' },
  loading: { label: 'Analizando…',  chip: 'bg-emerald-100 text-emerald-800 animate-pulse dark:bg-emerald-400/15 dark:text-emerald-200' },
  error:   { label: 'Error',        chip: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
}

// Tarjeta de un punto: la foto ocupa la parte superior (clic o arrastrar para subirla/cambiarla)
function SampleTile({ sample, hovered, disabled, onFile, onHover }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const n = sample.label.replace('P', '')
  const [lng, lat] = sample.coords
  const cls = sample.result?.target_class
  const key = sample.status === 'done' && sample.result ? resultKeyOf(cls, isHealthyClass(cls)) : null
  const status = sample.status === 'loading' ? 'loading' : sample.status === 'error' ? 'error' : sample.file ? 'ready' : 'empty'
  const locked = disabled || sample.status === 'loading'

  return (
    <div
      onMouseEnter={() => onHover(sample.id)}
      onMouseLeave={() => onHover(null)}
      className={`${PARCEL_CARD} overflow-hidden transition ${hovered ? 'ring-2 ring-[#0b8a4b]/45 dark:ring-emerald-400/50' : ''}`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onFocus={() => onHover(sample.id)}
        onBlur={() => onHover(null)}
        disabled={locked}
        onDragOver={(e) => { e.preventDefault(); if (!locked) setOver(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false) }}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!locked) onFile(e.dataTransfer.files?.[0]) }}
        aria-label={sample.file ? `Cambiar la foto del punto ${n}` : `Subir la foto del punto ${n}`}
        className="group relative block aspect-[16/10] w-full overflow-hidden bg-[#eef3ef] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:cursor-progress dark:bg-white/5"
      >
        {sample.preview ? (
          <img src={sample.preview} alt="" className="h-full w-full object-cover"/>
        ) : (
          <span className={`absolute inset-2 grid place-items-center rounded-lg border-2 border-dashed text-center transition ${over ? 'border-[#0b8a4b] bg-[#e1f3e7] dark:border-emerald-400 dark:bg-emerald-400/10' : 'border-[#c6e8d2] group-hover:border-[#8fd0a6] dark:border-emerald-400/20'}`}>
            <span className="text-[#0b6b35] dark:text-emerald-300">
              <span className="mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm dark:bg-white/10"><IcoCloudUp/></span>
              <span className="block text-[11px] font-semibold">Subir foto</span>
              <span className="block text-[9.5px] text-[#64748b] dark:text-slate-400">o arrástrala aquí</span>
            </span>
          </span>
        )}
        {sample.status === 'loading' && (
          <span className="absolute inset-0 grid place-items-center bg-white/65 dark:bg-black/45"><Spinner/></span>
        )}
        <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[#0b8a4b] text-[11px] font-black text-white shadow">{n}</span>
        {sample.preview && !locked && (
          <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-semibold text-[#0b6b35] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100 dark:bg-[#0f1a2b]/90 dark:text-emerald-300">
            Cambiar foto
          </span>
        )}
      </button>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[#0b1226] dark:text-white">Punto {n}</p>
          <p className="truncate font-mono text-[9.5px] text-[#64748b] dark:text-slate-400">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
        </div>
        {key ? (
          <span className={`inline-flex h-[21px] shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${RESULT_STYLE[key].chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${RESULT_STYLE[key].icon}`}/>
            {RESULT_STYLE[key].short}{key !== 'sano' ? ` · ${Math.round(sample.result.confidence)} %` : ''}
          </span>
        ) : (
          <span className={`inline-flex h-[21px] shrink-0 items-center rounded-full px-2 text-[10px] font-semibold ${SAMPLE_STATUS[status].chip}`}>{SAMPLE_STATUS[status].label}</span>
        )}
      </div>
      {sample.status === 'error' && <p className="px-3 pb-2 text-[10px] text-red-600 dark:text-red-300">{sample.error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}

// ── Reporte: pin con enfermedad y % ───────────────────────────────────────────
function makeReportPin(sample, isSelected) {
  const cls   = sample.result?.target_class
  const conf  = Math.round(sample.result?.confidence ?? 0)
  const color = SEVERITY_PALETTE[severityOf(cls, sample.result?.confidence)]
  const label = DISEASE_LABELS[cls] ?? '?'
  const num   = sample.label.replace('P', '')
  const ring  = isSelected ? `0 0 0 3px white, 0 0 0 5px ${color}` : '0 2px 8px rgba(0,0,0,0.35)'

  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="
        background:white;border:2px solid ${color};border-radius:8px;
        padding:2px 7px;font-size:10px;font-weight:800;color:${color};
        white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.18);
        margin-bottom:3px;line-height:1.5;
      ">${label} · ${conf}%</div>
      <div style="
        width:${isSelected ? 30 : 24}px;height:${isSelected ? 30 : 24}px;
        border-radius:50%;background:${color};
        border:2.5px solid white;box-shadow:${ring};
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:10px;font-weight:900;
      ">${num}</div>
      <div style="width:2px;height:6px;background:${color};opacity:.7;"></div>
    </div>`,
    iconSize: [90, 58],
    iconAnchor: [45, 58],
  })
}

// Anillo de la distribución de resultados del lote, con el total de zonas al centro
function ResultRing({ slices, total }) {
  const size = 120, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const sumV = slices.reduce((a, s) => a + s.value, 0)
  let acc = 0
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-white/5"/>
        {sumV > 0 && slices.map((s) => {
          const len = (s.value / sumV) * c
          const gap = slices.length > 1 ? 1.5 : 0
          const arc = <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${Math.max(len - gap, 0)} ${c}`} strokeDashoffset={-acc}/>
          acc += len
          return arc
        })}
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill="none" strokeWidth="1" className="stroke-black/[0.08] dark:stroke-white/[0.08]"/>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-[Manrope,Inter,sans-serif] text-[22px] font-extrabold leading-none text-[#0b1226] dark:text-white">{total}</p>
          <p className="mt-0.5 text-[9.5px] font-semibold text-[#64748b] dark:text-slate-400">zonas</p>
        </div>
      </div>
    </div>
  )
}

// Barras de % afectado por zona (de mayor a menor), coloreadas por severidad
function ZoneBars({ rows, selectedId, onSelect }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            aria-pressed={selectedId === r.id}
            aria-label={`Punto ${r.label.replace('P', '')}: ${r.value} % afectado`}
            className={`flex w-full items-center gap-2 rounded-md px-1 py-[3px] text-left transition hover:bg-[#f3f8f5] dark:hover:bg-white/5 ${selectedId === r.id ? 'bg-[#eaf6ee] dark:bg-white/[0.07]' : ''}`}
          >
            <span className="w-6 shrink-0 text-[10.5px] font-bold text-[#334155] dark:text-slate-300">{r.label}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef2f0] dark:bg-white/10">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: r.color }}/>
            </span>
            <span className="w-9 shrink-0 text-right text-[10.5px] font-semibold tabular-nums text-[#1d2640] dark:text-slate-200">{r.value} %</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const REPORT_TONES = {
  green: { card: 'border-[#dcefe5] bg-[#f2f9f6] dark:border-emerald-400/15 dark:bg-emerald-400/[0.05]', halo: 'bg-[#c9ecd8] dark:bg-emerald-400/15', solid: 'from-[#13a35c] to-[#03823f]' },
  teal:  { card: 'border-[#d3eee6] bg-[#effaf6] dark:border-teal-400/15 dark:bg-teal-400/[0.05]', halo: 'bg-[#c3ebde] dark:bg-teal-400/15', solid: 'from-[#12a58a] to-[#0b7f6a]' },
  rust:  { card: 'border-[#f3dccd] bg-[#fdf3ec] dark:border-orange-400/15 dark:bg-orange-400/[0.05]', halo: 'bg-[#f6d6c2] dark:bg-orange-400/15', solid: 'from-[#e0703a] to-[#c2501f]' },
  amber: { card: 'border-[#f1e3c4] bg-[#fdf7ea] dark:border-amber-400/15 dark:bg-amber-400/[0.05]', halo: 'bg-[#f3e2b8] dark:bg-amber-400/15', solid: 'from-[#e8a33a] to-[#c98216]' },
}

function ReportStat({ tone, Icon, label, value, sub }) {
  const t = REPORT_TONES[tone]
  return (
    <div className={`flex h-[61px] items-center gap-3.5 rounded-xl border pl-[13px] pr-3 ${t.card}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${t.halo}`}>
        <span className={`grid h-8 w-8 place-items-center rounded-full bg-linear-to-b text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)] ${t.solid} [&>svg]:h-4 [&>svg]:w-4`}><Icon/></span>
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-[#1d2640] dark:text-slate-300">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-2">
          <span className="font-[Manrope,Inter,sans-serif] text-[21px] font-extrabold leading-none text-[#0b1226] dark:text-white">{value}</span>
          {sub && <span className="truncate text-[10px] font-semibold text-[#64748b] dark:text-slate-400">{sub}</span>}
        </p>
      </div>
    </div>
  )
}

// Detalle de una zona: foto del punto y mapa de calor, completos y lado a lado
function ZoneDetail({ sample, onClose }) {
  if (!sample) return null
  const cls   = sample.result?.target_class
  const conf  = Math.round(sample.result?.confidence ?? 0)
  const sev   = severityOf(cls, sample.result?.confidence)
  const key   = resultKeyOf(cls, isHealthyClass(cls))
  const n     = sample.label.replace('P', '')

  return (
    <section className={`${PARCEL_CARD} overflow-hidden`} aria-label={`Detalle del punto ${n}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-[#eef2f0] px-4 py-3 dark:border-white/10">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-black text-white" style={{ background: SEVERITY_PALETTE[sev] }}>{n}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] ${PARCEL_TITLE}`}>Punto {n} · {RESULT_STYLE[key]?.short ?? (DISEASE_LABELS[cls] ?? cls)}</p>
          <p className="font-mono text-[10px] text-[#64748b] dark:text-slate-400">{sample.coords[1].toFixed(5)}, {sample.coords[0].toFixed(5)}</p>
        </div>
        <div className="text-right">
          <p className="font-[Manrope,Inter,sans-serif] text-[20px] font-extrabold leading-none text-[#0b1226] dark:text-white">{conf} %</p>
          <span className={`mt-1 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold ${SEVERITY_CHIP[sev] ?? SEVERITY_CHIP.Leve}`}>{sev}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar detalle" className="grid h-8 w-8 place-items-center rounded-full text-[#64748b] transition hover:bg-black/5 hover:text-[#0b1226] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">
          <IcoCloseSm/>
        </button>
      </header>
      <div className="grid gap-2.5 p-2.5 sm:grid-cols-2">
        {[
          { label: 'Foto del punto', src: sample.preview, alt: `Foto del punto ${n}` },
          { label: 'Mapa de calor (Grad-CAM)', src: sample.result?.xai_base64_png ? `data:image/png;base64,${sample.result.xai_base64_png}` : null, alt: `Mapa de calor del punto ${n}` },
        ].map((f) => (
          <figure key={f.label} className="relative overflow-hidden rounded-[10px] bg-[#1d2a22]">
            {f.src ? (
              <img src={f.src} alt={f.alt} className="h-[230px] w-full object-contain"/>
            ) : (
              <div className="grid h-[230px] place-items-center text-[11px] text-slate-300">Sin {f.label.toLowerCase()}</div>
            )}
            <figcaption className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-[#1d2640] shadow-sm dark:bg-[#0f1a2b]/90 dark:text-slate-200">{f.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

// ── Paso 3: reporte del lote ──────────────────────────────────────────────────
function StepReport({ data, samples, parcelName, onReset, onGoHistorial }) {
  const { vertices } = data
  const { isDark }   = useTheme()
  const [selectedId, setSelectedId] = useState(null)
  const [reportTime] = useState(() => new Date().toISOString())
  const detailRef = useRef(null)

  const results  = samples.filter(s => s.status === 'done' && s.result)
  const total    = results.length
  const healthy  = results.filter(s => isHealthyClass(s.result.target_class)).length
  const sick     = total - healthy
  const avgAff   = total > 0 ? results.reduce((a, s) => a + s.result.confidence, 0) / total : 0
  const maxAff   = results.length > 0 ? Math.max(...results.map(s => s.result.confidence)) : 0

  const sorted   = [...results].sort((a, b) => b.result.confidence - a.result.confidence)
  const critical = sorted[0]

  // Distribución por resultado (misma paleta que Inicio)
  const freq = {}
  results.forEach(s => { const k = resultKeyOf(s.result.target_class, isHealthyClass(s.result.target_class)); freq[k] = (freq[k] || 0) + 1 })
  const distribution = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value, label: RESULT_STYLE[key]?.short ?? key, color: resultColor(key, isDark) }))
  const dominant = distribution.filter(d => d.key !== 'sano')[0]

  const barRows = sorted.map(s => ({
    id: s.id,
    label: s.label,
    value: Math.round(s.result.confidence),
    color: SEVERITY_PALETTE[severityOf(s.result.target_class, s.result.confidence)],
  }))

  const selectedSample = selectedId != null ? samples.find(s => s.id === selectedId) : null
  const severityLevel  = lotSeverity(avgAff)
  const select = (id) => setSelectedId((cur) => (cur === id ? null : id))

  // Al elegir una zona (en el mapa, las barras o la tabla) se muestra su detalle
  useEffect(() => {
    if (selectedId != null) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedId])

  return (
    <div className="flex flex-col gap-3">
      {/* Encabezado del reporte */}
      <section className={`${PARCEL_CARD} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`}>
        <span className={STEP_ICON}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
        </span>
        <div className="min-w-[200px] flex-1">
          <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Resultados {parcelName ? `de «${parcelName}»` : 'del lote'}</h3>
          <p className="text-[11px] text-[#4b556c] dark:text-slate-400">{total} punto{total !== 1 ? 's' : ''} analizado{total !== 1 ? 's' : ''} · {whenLabel(reportTime, ', ')} · guardado en el historial</p>
        </div>
        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[10.5px] font-bold ${SEVERITY_CHIP[severityLevel] ?? SEVERITY_CHIP.Leve}`}>
          Severidad del lote: {severityLevel}
        </span>
      </section>

      {/* Indicadores (estilo Inicio) */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStat tone="green" Icon={IcoPinSm} label="Puntos analizados" value={total}/>
        <ReportStat tone="teal" Icon={IcoLeafSm} label="Zonas sanas" value={healthy} sub={total ? `${Math.round((healthy / total) * 100)} %` : null}/>
        <ReportStat tone="rust" Icon={IcoAlertSm} label="Zonas afectadas" value={sick} sub={total ? `${Math.round((sick / total) * 100)} %` : null}/>
        <ReportStat tone="amber" Icon={IcoGaugeSm} label="Afectación promedio" value={`${avgAff.toFixed(1)} %`} sub={`máx. ${Math.round(maxAff)} %`}/>
      </div>

      {/* Avisos */}
      {critical && critical.result.confidence > SEVERITY_LIMITS.grave && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-400/20 dark:bg-red-500/10">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-600 text-white [&>svg]:h-3.5 [&>svg]:w-3.5"><IcoAlertSm/></span>
          <p className="min-w-0 flex-1 text-[11.5px] text-red-800 dark:text-red-200">
            <strong>Zona crítica: punto {critical.label.replace('P', '')}</strong> — {DISEASE_LABELS[critical.result.target_class] ?? critical.result.target_class}, {Math.round(critical.result.confidence)} % afectado. Prioriza el tratamiento aquí.
          </p>
          <button type="button" onClick={() => setSelectedId(critical.id)} className="rounded-full px-2 py-1 text-[11px] font-semibold text-red-700 underline-offset-2 transition hover:underline dark:text-red-300">
            Ver punto
          </button>
        </div>
      )}
      {dominant && (
        <div className="flex items-center gap-3 rounded-xl border border-[#efe2c6] bg-[#fdf8ec] px-4 py-2.5 dark:border-amber-400/20 dark:bg-amber-400/10">
          <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-transparent" style={{ background: dominant.color }}/>
          <p className="text-[11.5px] text-[#6b4f12] dark:text-amber-100">
            Enfermedad dominante: <strong>{dominant.label}</strong> ({dominant.value} de {total} zonas)
          </p>
        </div>
      )}

      {/* Mapa + gráficos */}
      <div className="grid gap-3 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_330px]">
        <section className={`${PARCEL_CARD} flex flex-col overflow-hidden`}>
          <header className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
            <span className="text-[#0b8a4b] dark:text-emerald-400 [&>svg]:h-4 [&>svg]:w-4"><IcoPinSm/></span>
            <h3 className={`text-[12.5px] ${PARCEL_TITLE}`}>Mapa de resultados</h3>
            <span className="ml-auto text-[10px] text-[#64748b] dark:text-slate-400">Toca un punto para ver su detalle</span>
          </header>
          {/* El mapa ocupa toda la altura de la columna de gráficos */}
          <div className="min-h-[400px] flex-1 border-y border-[#eef2f0] dark:border-white/10">
            <MapContainer center={[vertices[0].lat, vertices[0].lng]} zoom={15} style={{ height: '100%', width: '100%', minHeight: 400 }}>
              <SatelliteLayers labelsOpacity={0.5}/>
              <FitBounds vertices={vertices} />
              <Polygon positions={vertices} pathOptions={{ color: '#ffffff', fillColor: '#22c55e', fillOpacity: 0.08, weight: 2.5 }} />
              {samples.filter(s => s.status === 'done').map(sample => {
                const [lng, lat] = sample.coords
                const isSel = selectedId === sample.id
                return (
                  <Marker key={sample.id} position={[lat, lng]}
                    icon={makeReportPin(sample, isSel)}
                    zIndexOffset={isSel ? 1000 : 0}
                    eventHandlers={{ click: () => select(sample.id) }}
                  />
                )
              })}
            </MapContainer>
          </div>
          <footer className="flex flex-wrap gap-x-4 gap-y-1.5 px-3.5 py-2.5">
            {SEVERITY_LEGEND.map(([k, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[10px] text-[#4b556c] dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_PALETTE[k] }}/>
                {l}
              </span>
            ))}
          </footer>
        </section>

        <div className="flex flex-col gap-3">
          <section className={`${PARCEL_CARD} px-4 py-3`}>
            <h3 className={`text-[12.5px] ${PARCEL_TITLE}`}>Distribución de resultados</h3>
            {distribution.length > 0 ? (
              <div className="mt-2.5 flex items-center gap-4">
                <ResultRing slices={distribution} total={total}/>
                <ul className="min-w-0 flex-1 space-y-1.5">
                  {distribution.map((d) => (
                    <li key={d.key} className="flex items-center gap-2 text-[11px] text-[#1d2640] dark:text-slate-200">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: d.color }}/>
                      <span className="min-w-0 flex-1 truncate font-medium">{d.label}</span>
                      <span className="font-semibold tabular-nums">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-[#64748b] dark:text-slate-400">Sin resultados.</p>
            )}
          </section>

          <section className={`${PARCEL_CARD} px-4 py-3`}>
            <h3 className={`text-[12.5px] ${PARCEL_TITLE}`}>Afectación por zona</h3>
            <div className="mt-2">
              {barRows.length > 0 ? <ZoneBars rows={barRows} selectedId={selectedId} onSelect={select}/> : <p className="text-[11px] text-[#64748b]">Sin datos</p>}
            </div>
          </section>

          <section className={`${PARCEL_CARD} px-4 py-3`}>
            <h3 className={`text-[12.5px] ${PARCEL_TITLE}`}>Severidad del lote</h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-[Manrope,Inter,sans-serif] text-[26px] font-extrabold leading-none" style={{ color: SEVERITY_PALETTE[severityLevel] }}>{avgAff.toFixed(1)} %</span>
              <span className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold ${SEVERITY_CHIP[severityLevel] ?? SEVERITY_CHIP.Leve}`}>{severityLevel}</span>
            </div>
            <SeverityScale pct={avgAff}/>
            <p className="mt-1.5 text-[10px] text-[#64748b] dark:text-slate-400">Promedio del área afectada en los {total} puntos · máximo {Math.round(maxAff)} %</p>
          </section>
        </div>
      </div>

      {/* Detalle de la zona elegida */}
      <div ref={detailRef} className="scroll-mt-20">
        {selectedSample && <ZoneDetail sample={selectedSample} onClose={() => setSelectedId(null)}/>}
      </div>

      {/* Tabla de detalle (estilo de «Actividad reciente» en Inicio) */}
      <section className={`${PARCEL_CARD} overflow-hidden`}>
        <header className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <h3 className={`text-[12.5px] ${PARCEL_TITLE}`}>Detalle por punto</h3>
          <span className="text-[10px] text-[#64748b] dark:text-slate-400">Elige «Ver» para la foto y el mapa de calor</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[13%]"/><col className="w-[27%]"/><col className="w-[15%]"/><col className="w-[16%]"/><col className="w-[18%]"/><col className="w-[11%]"/>
            </colgroup>
            <thead className="bg-[#f3f4f8] dark:bg-white/[0.03]">
              <tr className="h-[22px] text-[10.5px] text-[#5a6478] dark:text-slate-400">
                <th scope="col" className="pl-4 font-medium">Punto</th>
                <th scope="col" className="font-medium">Resultado</th>
                <th scope="col" className="font-medium">Afectación</th>
                <th scope="col" className="font-medium">Severidad</th>
                <th scope="col" className="font-medium">Coordenadas</th>
                <th scope="col" className="pr-4 font-medium"><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              {samples.map((s) => {
                const cls  = s.result?.target_class
                const conf = s.result?.confidence ?? 0
                const ok   = s.status === 'done' && s.result
                const key  = ok ? resultKeyOf(cls, isHealthyClass(cls)) : null
                const sev  = ok ? severityOf(cls, conf) : null
                const [lng, lat] = s.coords
                const isSel = selectedId === s.id
                return (
                  <tr key={s.id} className={`h-8 border-t border-[#f1f3f8] text-[11px] text-[#1d2640] dark:border-white/5 dark:text-slate-200 ${isSel ? 'bg-[#f2faf5] dark:bg-white/[0.04]' : ''}`}>
                    <td className="pl-4 font-bold">Punto {s.label.replace('P', '')}</td>
                    <td className="pr-2">
                      {key ? (
                        <span className={`inline-flex h-[21px] max-w-full items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${RESULT_STYLE[key].chip}`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${RESULT_STYLE[key].icon}`}/>
                          <span className="truncate">{RESULT_STYLE[key].short}</span>
                        </span>
                      ) : (
                        <span className="text-[#64748b]">{s.status === 'error' ? 'Error' : '—'}</span>
                      )}
                    </td>
                    <td className="font-semibold tabular-nums">{ok ? `${Math.round(conf)} %` : '—'}</td>
                    <td>
                      {sev ? <span className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold ${SEVERITY_CHIP[sev] ?? SEVERITY_CHIP.Leve}`}>{sev}</span> : '—'}
                    </td>
                    <td className="truncate pr-2 font-mono text-[10px] text-[#64748b] dark:text-slate-400">{lat.toFixed(4)}, {lng.toFixed(4)}</td>
                    <td className="pr-4 text-right">
                      {ok && (
                        <button
                          type="button"
                          onClick={() => select(s.id)}
                          aria-pressed={isSel}
                          aria-label={`Ver el punto ${s.label.replace('P', '')}`}
                          className="inline-flex h-6 items-center rounded-full bg-[#e3f6ec] px-3 text-[10.5px] font-semibold text-[#0b6b35] transition hover:bg-[#d2efdf] dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20"
                        >
                          Ver
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex flex-wrap justify-center gap-2.5 pb-1">
        <button type="button" onClick={onReset} className={`${BTN_SECONDARY} h-9 text-[12px]`}>
          <IcoUndo/>
          Analizar otra parcela
        </button>
        {onGoHistorial && (
          <button type="button" onClick={() => onGoHistorial('parcelas')} className={`${BTN_PRIMARY} h-9 px-5 text-[12px]`}>
            Ver historial de parcelas
            <IcoArrow/>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Parcelas (lotes físicos) + historial de visitas — localStorage ───────────
export const PARCELAS_KEY = 'agro_parcelas'
export const PARCEL_HISTORY_KEY = 'agro_parcel_history'

export function loadParcelHistory() {
  try { return JSON.parse(localStorage.getItem(PARCEL_HISTORY_KEY) ?? '[]').map(normalizeParcelRecord) } catch { return [] }
}

function saveParcelHistoryRecords(records) {
  try { localStorage.setItem(PARCEL_HISTORY_KEY, JSON.stringify(records)) } catch { /* ignore quota errors */ }
}

function loadParcelasRaw() {
  try { return JSON.parse(localStorage.getItem(PARCELAS_KEY) ?? '[]') } catch { return [] }
}

function saveParcelasRaw(parcelas) {
  try { localStorage.setItem(PARCELAS_KEY, JSON.stringify(parcelas)) } catch { /* ignore quota errors */ }
}

// Registros guardados antes de que existieran las Parcelas no traen parcelaId.
// Al leerlos por primera vez se les crea una Parcela huérfana para no perder datos.
function migrateLegacyHistory() {
  const history = loadParcelHistory()
  if (!history.some(r => !r.parcelaId)) return

  const parcelas = loadParcelasRaw()
  const migrated = history.map(r => {
    if (r.parcelaId) return r
    const parcelaId = `parcela_${r.id}`
    parcelas.push({
      id: parcelaId,
      nombre: 'Parcela sin nombre',
      vertices: r.vertices,
      ha: r.ha,
      sampleCount: r.sampleCount,
      samplingPoints: r.samples.map(s => ({ geometry: { coordinates: s.coords } })),
      createdAt: r.fecha,
    })
    return { ...r, parcelaId }
  })

  saveParcelHistoryRecords(migrated)
  saveParcelasRaw(parcelas)
}

export function loadParcelas() {
  migrateLegacyHistory()
  return loadParcelasRaw()
}

export function saveParcela(parcela) {
  const parcelas = loadParcelasRaw()
  const idx = parcelas.findIndex(p => p.id === parcela.id)
  if (idx >= 0) parcelas[idx] = parcela
  else parcelas.unshift(parcela)
  saveParcelasRaw(parcelas)
  return parcela
}

export function renameParcela(id, nombre) {
  const parcelas = loadParcelasRaw()
  const idx = parcelas.findIndex(p => p.id === id)
  if (idx < 0) return
  parcelas[idx] = { ...parcelas[idx], nombre }
  saveParcelasRaw(parcelas)
}

export function deleteParcela(id) {
  saveParcelasRaw(loadParcelasRaw().filter(p => p.id !== id))
  saveParcelHistoryRecords(loadParcelHistory().filter(r => r.parcelaId !== id))
}

export function deleteParcelVisit(id) {
  saveParcelHistoryRecords(loadParcelHistory().filter(r => r.id !== id))
}

// Une cada Parcela con sus visitas (más reciente primero) y ordena por actividad reciente.
export function getParcelaSummaries() {
  const parcelas = loadParcelas()
  const history = loadParcelHistory()
  return parcelas
    .map(p => {
      const visits = history
        .filter(r => r.parcelaId === p.id)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      return { ...p, visits, lastVisit: visits[0] ?? null }
    })
    .sort((a, b) => new Date(b.lastVisit?.fecha ?? b.createdAt) - new Date(a.lastVisit?.fecha ?? a.createdAt))
}

function saveParcelToHistory(parcelaId, drawData, finishedSamples) {
  const done = finishedSamples.filter(s => s.status === 'done' && s.result)
  const total = done.length
  const healthy = done.filter(s => s.result.target_class === 'Fondo_y_Sana' || s.result.target_class === 'Fondo').length
  const avgAff = total > 0 ? done.reduce((a, s) => a + s.result.confidence, 0) / total : 0

  const freq = {}
  done.forEach(s => { const k = s.result.target_class; freq[k] = (freq[k] || 0) + 1 })
  const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const record = {
    id: Date.now(),
    parcelaId,
    fecha: new Date().toISOString(),
    ha: parseFloat(drawData.ha.toFixed(2)),
    sampleCount: drawData.sampleCount,
    vertices: drawData.vertices.map(v => ({ lat: v.lat, lng: v.lng })),
    samples: finishedSamples.map(s => ({
      id: s.id, label: s.label, coords: s.coords, status: s.status,
      result: s.result ? { target_class: s.result.target_class, confidence: s.result.confidence } : null,
    })),
    stats: { total, healthy, sick: total - healthy, avgAff: parseFloat(avgAff.toFixed(1)), dominant },
  }

  saveParcelHistoryRecords([record, ...loadParcelHistory()].slice(0, 200))
}

// ── Step: elegir una parcela existente o crear una nueva ──────────────────────
const ANALIZABLE = [
  { key: 'tizon', label: 'Tizón', foto: fotoTizon },
  { key: 'roya', label: 'Roya', foto: fotoRoya },
  { key: 'mancha', label: 'Mancha blanca', foto: fotoMancha },
]
const BENEFICIOS = ['Detección temprana de enfermedades', 'Mejora la productividad', 'Cuida tu cultivo y tu inversión']

// Lote dibujado sobre un mapa con sus puntos de muestreo y el botón «+» (estilo de la maqueta)
function ParcelIllustration() {
  return (
    <svg viewBox="0 0 180 96" aria-hidden="true" className="h-[66px] w-auto">
      <defs>
        <linearGradient id="pi-map" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9ecff"/><stop offset="1" stopColor="#d8f1df"/>
        </linearGradient>
      </defs>
      <path d="M46 84c-16-2-27-13-29-29 14 2 25 12 29 29Z" fill="#dff1e3"/>
      <path d="M38 88c-9-7-12-18-8-29 9 6 12 17 8 29Z" fill="#cfe9d6"/>
      <path d="M134 84c16-2 27-13 29-29-14 2-25 12-29 29Z" fill="#dff1e3"/>
      <path d="M142 88c9-7 12-18 8-29-9 6-12 17-8 29Z" fill="#cfe9d6"/>
      <rect x="50" y="8" width="80" height="62" rx="10" fill="url(#pi-map)"/>
      <path d="M50 46c14-6 27-4 40 2s27 6 40-2" stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.8"/>
      <polygon points="62,56 70,22 106,17 118,48 94,62" fill="#bfe6c9" fillOpacity="0.85" stroke="#0b8a4b" strokeWidth="2" strokeDasharray="4 3" strokeLinejoin="round"/>
      {[[79, 33], [96, 30], [104, 47], [84, 52], [74, 44]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill="#0b8a4b" stroke="#fff" strokeWidth="1.2"/>
      ))}
      <circle cx="124" cy="68" r="16" fill="#0b8a4b"/>
      <path d="M124 60v16M116 68h16" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"/>
    </svg>
  )
}

// Qué enfermedades detecta el modelo y beneficios (parcela y análisis individual)
export function QueAnalizarCard({ onGoEnfermedades }) {
  const { isDark } = useTheme()
  return (
    <section className={`relative overflow-hidden ${PARCEL_CARD} px-4 pb-4 pt-3`}>
      <img src={inicioHojas} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[56px] w-auto select-none dark:opacity-10"/>
      <div className="relative flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <IcoSproutGreen/>
        <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>¿Qué puedes analizar?</h3>
        {onGoEnfermedades && (
          <button type="button" onClick={onGoEnfermedades} className="ml-auto inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full bg-[#e5f6ee] px-2.5 text-[10px] font-semibold text-[#0a6332] transition hover:bg-[#d6efe2] dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20">
            <IcoInfoDot/>
            Más información
          </button>
        )}
      </div>
      <div className="relative mt-3 grid grid-cols-3 gap-2.5">
        {ANALIZABLE.map((d) => (
          <figure key={d.key} className="min-w-0">
            <img src={d.foto} alt={`Hoja de maíz con ${d.label.toLowerCase()}`} className="aspect-[1.58] w-full rounded-[9px] object-cover shadow-sm"/>
            <figcaption className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#1d2640] dark:text-slate-200">
              <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: resultColor(d.key, isDark) }}/>
              <span className="truncate">{d.label}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="relative my-3 h-px bg-[#eef2f0] dark:bg-white/10"/>
      <h4 className={`relative flex items-center gap-2 text-[13.5px] ${PARCEL_TITLE}`}>
        <IcoBarsGreen/>
        Beneficios
      </h4>
      <ul className="relative mt-2 space-y-1.5">
        {BENEFICIOS.map((b) => (
          <li key={b} className="flex items-center gap-2 text-[10.5px] text-[#1d2640] dark:text-slate-300"><CheckDot/>{b}</li>
        ))}
      </ul>
    </section>
  )
}

function StepChooseParcela({ onSelectExisting, onCreateNew, onGoHistorial, onGoEnfermedades }) {
  const [summaries] = useState(() => getParcelaSummaries())
  const [creating, setCreating] = useState(false)
  const [nombre, setNombre] = useState('')

  const confirmCreate = () => {
    const trimmed = nombre.trim()
    if (!trimmed) return
    onCreateNew(trimmed)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        {/* Crear parcela: caja punteada como la zona de carga de la maqueta */}
        <section className={`${PARCEL_CARD} p-2.5`}>
          <div className="relative flex h-full min-h-[214px] flex-col items-center justify-center overflow-hidden rounded-[12px] border-2 border-dashed border-[#c6e8d2] bg-linear-to-b from-[#fbfdfc] to-[#f0f8f2] px-6 py-5 text-center dark:border-emerald-400/20 dark:from-white/[0.02] dark:to-emerald-400/[0.05]">
            <ParcelIllustration/>
            {creating ? (
              <form className="mt-2 w-full max-w-xs" onSubmit={(e) => { e.preventDefault(); confirmCreate() }}>
                <label htmlFor="nueva-parcela" className={`block text-[13px] ${PARCEL_TITLE}`}>Nombre de la nueva parcela</label>
                <input
                  id="nueva-parcela"
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Lote Norte"
                  maxLength={60}
                  className="mt-2 w-full rounded-full border border-[#cfe3d6] bg-white px-4 py-2 text-[12px] text-[#0b1226] outline-none transition focus:border-[#0b8a4b] focus:ring-2 focus:ring-[#0b8a4b]/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <div className="mt-3 flex justify-center gap-2">
                  <button type="button" onClick={() => setCreating(false)} className="rounded-full border border-[#dfe7e2] bg-white/70 px-4 py-1.5 text-[11.5px] font-semibold text-[#334155] transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10">
                    Volver
                  </button>
                  <button type="submit" disabled={!nombre.trim()} className={`${BTN_PRIMARY} px-4 py-1.5 text-[11.5px]`}>
                    Dibujar el lote
                    <IcoArrow/>
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3 className={`mt-2 text-[16.5px] ${PARCEL_TITLE}`}>Dibuja tu parcela en el mapa</h3>
                <p className="mt-0.5 text-[11.5px] text-[#4b556c] dark:text-slate-400">Marca el contorno del lote y generamos los puntos de muestreo</p>
                <button type="button" onClick={() => { setNombre(''); setCreating(true) }} className={`${BTN_PRIMARY} mt-4 h-[34px] px-6 text-[12px]`}>
                  <IcoMapPlus/>
                  Nueva parcela
                  <IcoArrow/>
                </button>
                <p className="mt-3 text-[9.5px] text-[#64748b] dark:text-slate-500">Después subirás una foto por punto de muestreo · JPG, PNG o WEBP</p>
              </>
            )}
          </div>
        </section>

        {/* Qué detecta el modelo y beneficios */}
        <QueAnalizarCard onGoEnfermedades={onGoEnfermedades}/>
      </div>

      {/* Parcelas registradas: cada tarjeta empieza una nueva visita a esa parcela */}
      <section className={`${PARCEL_CARD} px-3 pb-3 pt-1.5`}>
        <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 py-1.5">
          <IcoHistoryGreen/>
          <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>Tus parcelas</h3>
          {summaries.length > 0 && <span className="text-[10.5px] text-[#64748b] dark:text-slate-400">Elige una para registrar una nueva visita</span>}
          {onGoHistorial && (
            <button type="button" onClick={() => onGoHistorial('parcelas')} className="ml-auto inline-flex items-center gap-1.5 rounded-md text-[10.5px] font-semibold text-[#0b6b35] transition hover:text-[#02894b] hover:underline dark:text-emerald-400">
              Ver historial completo
              <IcoArrow/>
            </button>
          )}
        </header>
        {summaries.length === 0 ? (
          <p className="px-1 pb-2 pt-1 text-[11.5px] text-[#55656f] dark:text-slate-400">Aún no tienes parcelas registradas. Crea la primera con «Nueva parcela».</p>
        ) : (
          <div className="mt-1 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((p) => {
              const last = p.lastVisit
              const key = visitResultKey(last)
              const style = key ? (RESULT_STYLE[key] ?? RESULT_STYLE.otro) : null
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectExisting(p)}
                  aria-label={`Nueva visita a ${p.nombre}`}
                  className="group flex items-center gap-3 rounded-xl border border-[#e9eef1] bg-linear-to-br from-white to-[#f5faf6] p-2 text-left shadow-[0_4px_14px_-12px_rgba(15,40,30,0.4)] transition hover:border-[#bfe3c9] hover:shadow-md dark:border-white/10 dark:from-white/[0.03] dark:to-emerald-400/[0.04] dark:hover:border-emerald-400/30"
                >
                  <ParcelMiniMap vertices={p.vertices} samples={last?.samples ?? []} width={66} height={60} dot={2.4} className="rounded-[8px]"/>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-[#0b1226] dark:text-white">{p.nombre}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[#64748b] dark:text-slate-400">
                      <IcoCalendarSm/>
                      <span className="truncate">{last ? whenLabel(last.fecha, ', ') : 'Sin visitas aún'} · {p.ha} ha</span>
                    </span>
                    {style && (
                      <span className={`mt-1.5 inline-flex h-[19px] items-center gap-1 rounded-full px-2 text-[9.5px] font-semibold ${style.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.icon}`}/>
                        {style.short}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-full bg-white text-[#0b6b35] shadow-[0_3px_10px_-4px_rgba(15,40,30,0.45)] transition group-hover:bg-[#0b8a4b] group-hover:text-white dark:bg-white/10 dark:text-emerald-300">
                    <IcoArrow/>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalizarParcela({ preselectedParcelaId, onGoHistorial, onGoEnfermedades } = {}) {
  const [step, setStep]       = useState(0) // 0 elegir · 1 dibujar · 2 confirmar · 3 muestras · 4 reporte
  const [parcela, setParcela] = useState(null)
  const [drawData, setDrawData] = useState(null)
  const [samples, setSamples] = useState([])

  const selectExistingParcela = (p) => {
    setParcela(p)
    setDrawData({ vertices: p.vertices, ha: p.ha, sampleCount: p.sampleCount, samplingPoints: p.samplingPoints })
    setStep(3)
  }

  useEffect(() => {
    if (!preselectedParcelaId) return
    const found = loadParcelas().find(p => p.id === preselectedParcelaId)
    if (found) selectExistingParcela(found)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedParcelaId])

  const startNewParcela = (nombre) => {
    setParcela({ id: `parcela_${Date.now()}`, nombre, vertices: null, ha: 0, sampleCount: 0, samplingPoints: null, createdAt: new Date().toISOString() })
    setDrawData(null)
    setStep(1)
  }

  const handleDrawDone = (data) => {
    setDrawData(data)
    setStep(2)
  }

  const handleConfirmPoints = () => {
    const updated = {
      ...parcela,
      vertices: drawData.vertices,
      ha: parseFloat(drawData.ha.toFixed(2)),
      sampleCount: drawData.sampleCount,
      samplingPoints: drawData.samplingPoints,
    }
    saveParcela(updated)
    setParcela(updated)
    setStep(3)
  }

  const handleSamplesDone = (finishedSamples) => {
    setSamples(finishedSamples)
    setStep(4)
    saveParcelToHistory(parcela.id, drawData, finishedSamples)
  }

  const handleReset = () => {
    setStep(0)
    setParcela(null)
    setDrawData(null)
    setSamples([])
  }

  // Pasos visibles: 1 elegir/dibujar/confirmar parcela · 2 subir imágenes · 3 resultados
  const stepBarIndex = step <= 2 ? 0 : step === 3 ? 1 : 2

  return (
    <div className="flex flex-col gap-3.5">
      <ParcelHero />
      <StepBar current={stepBarIndex} />

      {step === 0 && (
        <StepChooseParcela onSelectExisting={selectExistingParcela} onCreateNew={startNewParcela} onGoHistorial={onGoHistorial} onGoEnfermedades={onGoEnfermedades} />
      )}
      {step === 1 && <StepDraw onDone={handleDrawDone} parcelName={parcela?.nombre} />}
      {step === 2 && drawData && (
        <StepPreview
          data={drawData}
          onConfirm={handleConfirmPoints}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && drawData && parcela && (
        <StepSamples data={drawData} parcelName={parcela?.nombre} onDone={handleSamplesDone} onRedraw={() => setStep(1)} />
      )}
      {step === 4 && drawData && (
        <StepReport data={drawData} samples={samples} parcelName={parcela?.nombre} onReset={handleReset} onGoHistorial={onGoHistorial} />
      )}
    </div>
  )
}
