import { useState, useRef, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as turf from '@turf/turf'
import { predictXai, createAnalisis } from './api.js'
import { SEVERITY_LEGEND, SEVERITY_LIMITS, SEVERITY_PALETTE, affectedPercent, lotSeverity, normalizeParcelRecord, severityOf } from './severity.js'
import { useTheme } from './ThemeContext.jsx'

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

const SEVERITY_COLORS = {
  sano:     '#22c55e',
  leve:     '#84cc16',
  moderada: '#f59e0b',
  grave:    '#ef4444',
}

const DISEASE_LABELS = {
  Fondo_y_Sana:  'Sano',
  Fondo:         'Sano',
  Tizon:         'Tizón',
  Roya:          'Roya',
  Mancha_Blanca: 'M.Blanca',
  Mancha_blanca: 'M.Blanca',
}

const DISEASE_COLORS = {
  Fondo_y_Sana:  '#22c55e',
  Fondo:         '#22c55e',
  Tizon:         '#f97316',
  Roya:          '#f59e0b',
  Mancha_Blanca: '#ef4444',
  Mancha_blanca: '#ef4444',
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

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ current }) {
  const steps = ['Elegir parcela', 'Dibujar/Confirmar', 'Muestras', 'Reporte']
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                done   ? 'bg-violet-600 border-violet-600 text-white' :
                active ? 'bg-white border-violet-600 text-violet-600' :
                         'bg-white border-slate-200 text-slate-300'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] font-semibold mt-1 whitespace-nowrap ${active ? 'text-violet-600' : done ? 'text-violet-400' : 'text-slate-300'}`}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 rounded-full transition-all ${done ? 'bg-violet-400' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 0: Draw polygon on map ───────────────────────────────────────────────
function StepDraw({ onDone }) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow" style={{ height: 420 }}>
        <MapContainer center={[0.3516, -78.1223]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.6}
          />
          <PolygonDrawer onAddPoint={addPoint} />
          {vertices.length >= 3 && (
            <Polygon
              positions={vertices}
              pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.2, weight: 2, dashArray: '6 4' }}
            />
          )}
          {vertices.length >= 1 && vertices.length < 3 && vertices.map((v, i) => (
            <Marker key={i} position={v} icon={makeIcon('#7c3aed', i + 1)} />
          ))}
        </MapContainer>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 rounded-xl bg-violet-50 border border-violet-100 px-4 py-2.5">
          <p className="text-xs text-violet-500 font-semibold">Vértices marcados</p>
          <p className="text-lg font-black text-violet-700">{vertices.length} <span className="text-xs font-normal text-violet-400">{vertices.length < 3 ? '(mínimo 3)' : '✓ listo para cerrar'}</span></p>
        </div>
        <button onClick={undo} disabled={vertices.length === 0}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition">
          ↩ Deshacer
        </button>
        <button onClick={reset} disabled={vertices.length === 0}
          className="px-4 py-2.5 rounded-xl border border-red-100 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40 transition">
          Borrar todo
        </button>
        <button onClick={closeAndConfirm} disabled={vertices.length < 3}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
          Cerrar polígono →
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Haz clic en el mapa para marcar los vértices de tu lote. Mínimo 3 puntos. Navega con scroll y arrastra.
      </p>
    </div>
  )
}

// ── Step 1: Preview polygon + sampling points ─────────────────────────────────
function StepPreview({ data, onConfirm, onBack }) {
  const { vertices, ha, sampleCount, samplingPoints } = data

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Área</p>
          <p className="text-xl font-black text-violet-700">{ha.toFixed(2)} <span className="text-xs font-normal">ha</span></p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Muestras</p>
          <p className="text-xl font-black text-emerald-700">{sampleCount}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Cobertura</p>
          <p className="text-xl font-black text-amber-700">{(ha / sampleCount * 10000).toFixed(0)} <span className="text-xs font-normal">m²/muestra</span></p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow" style={{ height: 380 }}>
        <MapContainer
          center={[vertices[0].lat, vertices[0].lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.6}
          />
          <Polygon
            positions={vertices}
            pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.15, weight: 2 }}
          />
          {samplingPoints.map((pt, i) => {
            const [lng, lat] = pt.geometry.coordinates
            return (
              <Marker key={i} position={[lat, lng]} icon={makeIcon('#6d28d9', i + 1)}>
                <Tooltip permanent direction="top" offset={[0, -34]}>
                  <span className="text-[10px] font-bold">P{i + 1}</span>
                </Tooltip>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={onBack} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
          ← Redibujar
        </button>
        <button onClick={onConfirm}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
          Comenzar análisis →
        </button>
      </div>
    </div>
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

// ── Mini-map marker icon for samples ──────────────────────────────────────────
function makeSampleIcon(sample, isHovered) {
  const size   = isHovered ? 38 : 30
  const anchor = isHovered ? 19 : 15

  let bg = '#7c3aed' // default violet (pending)
  if (sample.status === 'loading') bg = '#8b5cf6'
  else if (sample.status === 'error') bg = '#ef4444'
  else if (sample.status === 'done' && sample.result) {
    const cls = sample.result.target_class
    bg = cls === 'Fondo_y_Sana' || cls === 'Fondo' ? '#22c55e' : DISEASE_COLORS[cls] ?? '#f97316'
  }

  const border = isHovered ? '3px solid #fff' : '2px solid rgba(255,255,255,0.8)'
  const shadow = isHovered ? '0 0 0 3px rgba(124,58,237,0.5), 0 3px 10px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.3)'
  const numStr = sample.label.replace('P', '')

  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${bg};border:${border};
      box-shadow:${shadow};
      display:flex;align-items:center;justify-content:center;
      transition:all 0.15s;
    ">
      <span style="color:#fff;font-size:${isHovered ? 13 : 11}px;font-weight:900;line-height:1">${numStr}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  })
}

// ── Step 2: Upload & analyze each sample ──────────────────────────────────────
function StepSamples({ data, onDone, onRedraw }) {
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

  const handleFile = (idx, file) => {
    if (!file) return
    const preview = URL.createObjectURL(file)
    setSamples(s => s.map((item, i) =>
      i === idx ? { ...item, file, preview, status: 'pending', result: null, error: null } : item
    ))
  }

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

  const done    = samples.filter(s => s.status === 'done').length
  const hasFile = samples.some(s => s.file && s.status !== 'done')
  const allDone = samples.every(s => s.status === 'done')

  return (
    <div className="flex flex-col gap-4">
      {onRedraw && (
        <button onClick={onRedraw} className="self-start text-xs font-semibold text-slate-400 hover:text-violet-600 transition">
          ✎ Redibujar límites del lote
        </button>
      )}
      {/* Progress bar */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
            <span>Progreso</span>
            <span>{done} / {samples.length}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(done / samples.length) * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#22c55e)' }}
            />
          </div>
        </div>
        {!allDone && (
          <button onClick={analyzeAll} disabled={analyzing || !hasFile}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
            {analyzing ? 'Analizando…' : 'Analizar pendientes'}
          </button>
        )}
        {allDone && (
          <button onClick={() => onDone(samples)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white transition"
            style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)' }}>
            Ver reporte →
          </button>
        )}
      </div>

      {/* Two-column: mini-map LEFT + cards RIGHT */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Mini-map (sticky on desktop) ── */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 lg:sticky lg:top-4">
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <span className="text-sm">🗺️</span>
              <p className="text-xs font-bold text-slate-600">Tu lote — puntos de muestreo</p>
            </div>
            <div style={{ height: 340 }}>
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
                <TileLayer
                  attribution='&copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  opacity={0.5}
                />
                <FitBounds vertices={vertices} />
                <Polygon
                  positions={vertices}
                  pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.12, weight: 2 }}
                />
                {samples.map(sample => {
                  const [lng, lat] = sample.coords
                  const isHov = hoveredId === sample.id
                  return (
                    <Marker
                      key={sample.id}
                      position={[lat, lng]}
                      icon={makeSampleIcon(sample, isHov)}
                      zIndexOffset={isHov ? 1000 : 0}
                    >
                      <Tooltip direction="top" offset={[0, isHov ? -22 : -18]} permanent={isHov}>
                        <span className="text-[10px] font-bold">{sample.label}</span>
                        {sample.status === 'done' && sample.result && (
                          <span className="ml-1 text-[10px]">
                            — {DISEASE_LABELS[sample.result.target_class] ?? '?'} {Math.round(sample.result.confidence)}%
                          </span>
                        )}
                      </Tooltip>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
            {/* Legend */}
            <div className="px-4 py-2.5 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
              {[
                { color: '#7c3aed', label: 'Sin foto' },
                { color: '#22c55e', label: 'Sano' },
                { color: '#f97316', label: 'Enfermedad' },
                { color: '#ef4444', label: 'Error' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                  <span className="text-[10px] text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Cards column ── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {samples.map((sample, idx) => (
            <SampleCard
              key={sample.id}
              sample={sample}
              onFile={(f) => handleFile(idx, f)}
              onHover={(id) => setHoveredId(id)}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Pasa el cursor sobre una tarjeta para ver su ubicación en el mapa. Sube la foto y pulsa "Analizar pendientes".
      </p>
    </div>
  )
}

function SampleCard({ sample, onFile, onHover }) {
  const inputRef = useRef(null)
  const statusBadge = {
    pending: { label: 'Sin imagen',  color: 'bg-slate-100 text-slate-400' },
    loading: { label: 'Analizando…', color: 'bg-violet-100 text-violet-600 animate-pulse' },
    done:    { label: 'Listo',       color: 'bg-emerald-100 text-emerald-600' },
    error:   { label: 'Error',       color: 'bg-red-100 text-red-500' },
  }
  const badge = statusBadge[sample.status]
  const [lng, lat] = sample.coords

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-shadow hover:shadow-md hover:border-violet-200"
      onMouseEnter={() => onHover(sample.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Point badge */}
        <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
          {sample.label.replace('P', '')}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-700">{sample.label}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
        </div>

        {/* Result inline */}
        {sample.status === 'done' && sample.result && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-bold text-slate-700">{DISEASE_LABELS[sample.result.target_class] ?? sample.result.target_class}</p>
            <p className="text-lg font-black leading-tight" style={{ color: DISEASE_COLORS[sample.result.target_class] ?? '#64748b' }}>
              {Math.round(sample.result.confidence)}%
            </p>
          </div>
        )}
        {sample.status === 'error' && (
          <p className="text-xs text-red-500 flex-shrink-0 max-w-[120px] text-right">{sample.error}</p>
        )}

        {/* Upload button */}
        <div
          className="relative flex-shrink-0 cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {sample.preview
            ? (
              <div className="relative">
                <img src={sample.preview} alt="" className="w-16 h-12 object-cover rounded-xl border border-slate-200" />
                {sample.status === 'loading' && (
                  <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
                  </div>
                )}
              </div>
            )
            : (
              <div className="w-16 h-12 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-violet-300 transition flex flex-col items-center justify-center gap-0.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-slate-300">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span className="text-[9px] font-semibold text-slate-300">Foto</span>
              </div>
            )
          }
          <input
            type="file" accept="image/*" className="hidden"
            ref={inputRef}
            onChange={e => onFile(e.target.files[0])}
          />
        </div>
      </div>
    </div>
  )
}

// ── Report: label-style pin with disease + % ──────────────────────────────────
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

// ── Donut chart (SVG) ─────────────────────────────────────────────────────────
function DonutChart({ slices }) {
  const r = 48, cx = 60, cy = 60, sw = 24
  const circ = 2 * Math.PI * r
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  let cum = 0
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
      {slices.map((sl, i) => {
        const frac = sl.value / total
        const da   = `${frac * circ} ${circ}`
        const off  = circ - cum * circ
        cum += frac
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sl.color} strokeWidth={sw}
            strokeDasharray={da} strokeDashoffset={off}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray .5s' }}
          />
        )
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 18, fontWeight: 900, fill: '#1e293b' }}>
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        style={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}>
        zonas
      </text>
    </svg>
  )
}

// ── Horizontal bar chart (SVG) ────────────────────────────────────────────────
function BarChart({ bars }) {
  const max   = Math.max(...bars.map(b => b.value), 1)
  const h     = 22
  const gap   = 8
  const labelW = 28
  const totalH = bars.length * (h + gap)

  return (
    <svg width="100%" height={totalH} style={{ overflow: 'visible' }}>
      {bars.map((bar, i) => {
        const y     = i * (h + gap)
        const pct   = bar.value / max
        return (
          <g key={i}>
            <text x={0} y={y + h / 2 + 1} dominantBaseline="middle"
              style={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}>
              {bar.label}
            </text>
            <rect x={labelW} y={y} width="100%" height={h} rx={5} fill="#f1f5f9" />
            <rect x={labelW} y={y} width={`${pct * 85}%`} height={h} rx={5} fill={bar.color}
              style={{ transition: 'width .6s ease' }} />
            <text x={labelW + 6} y={y + h / 2 + 1} dominantBaseline="middle"
              style={{ fontSize: 10, fontWeight: 800, fill: 'white' }}>
              {bar.value}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Zone detail panel (appears on marker click) ───────────────────────────────
function ZoneDetail({ sample, isDark, onClose }) {
  if (!sample) return null
  const cls   = sample.result?.target_class
  const conf  = Math.round(sample.result?.confidence ?? 0)
  const color = DISEASE_COLORS[cls] ?? '#64748b'
  const sev   = severityOf(cls, sample.result?.confidence)
  const sevColor = SEVERITY_PALETTE

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-md ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ background: color }}>
            {sample.label.replace('P', '')}
          </div>
          <div>
            <p className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{sample.label} — {DISEASE_LABELS[cls] ?? cls}</p>
            <p className="text-xs text-slate-400">{sample.coords[1].toFixed(5)}, {sample.coords[0].toFixed(5)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-black" style={{ color }}>{conf}%</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: sevColor[sev] }}>{sev}</span>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
        {sample.preview && (
          <div className="relative">
            <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-slate-900/80 text-slate-300' : 'bg-white/90 text-slate-700'}`}>
              Imagen original
            </div>
            <img src={sample.preview} alt="original" className="w-full object-cover" style={{ height: 220 }} />
          </div>
        )}
        {sample.result?.xai_base64_png ? (
          <div className="relative">
            <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${isDark ? 'bg-slate-900/80 text-slate-300' : 'bg-white/90 text-slate-700'}`}>
              Mapa de calor XAI
            </div>
            <img
              src={`data:image/png;base64,${sample.result.xai_base64_png}`}
              alt="XAI heatmap"
              className="w-full object-cover"
              style={{ height: 220 }}
            />
          </div>
        ) : (
          <div className={`flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} style={{ height: 220 }}>
            <p className="text-xs text-slate-400">Sin mapa de calor disponible</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Step 3: Report Dashboard ───────────────────────────────────────────────────
function StepReport({ data, samples, onReset }) {
  const { vertices } = data
  const { isDark }   = useTheme()
  const [selectedId, setSelectedId] = useState(null)

  const results  = samples.filter(s => s.status === 'done' && s.result)
  const total    = results.length
  const healthy  = results.filter(s => s.result.target_class === 'Fondo_y_Sana' || s.result.target_class === 'Fondo').length
  const sick     = total - healthy
  const avgAff   = total > 0 ? results.reduce((a, s) => a + s.result.confidence, 0) / total : 0
  const maxAff   = results.length > 0 ? Math.max(...results.map(s => s.result.confidence)) : 0

  const sorted   = [...results].sort((a, b) => b.result.confidence - a.result.confidence)
  const critical = sorted[0]

  // Disease frequency → donut slices
  const freq = {}
  results.forEach(s => { const k = s.result.target_class; freq[k] = (freq[k] || 0) + 1 })
  const donutSlices = Object.entries(freq).map(([cls, cnt]) => ({
    label: DISEASE_LABELS[cls] ?? cls,
    value: cnt,
    color: (cls === 'Fondo_y_Sana' || cls === 'Fondo') ? '#22c55e' : DISEASE_COLORS[cls] ?? '#94a3b8',
  }))
  const dominant = donutSlices.filter(s => s.label !== 'Sano').sort((a, b) => b.value - a.value)[0]

  // Bar chart data: % per zone sorted
  const barData = [...results]
    .sort((a, b) => b.result.confidence - a.result.confidence)
    .map(s => ({
      label: s.label,
      value: Math.round(s.result.confidence),
      color: SEVERITY_PALETTE[severityOf(s.result.target_class, s.result.confidence)],
    }))

  const selectedSample = selectedId != null ? samples.find(s => s.id === selectedId) : null

  const severityLevel = lotSeverity(avgAff)
  const severityColor = SEVERITY_PALETTE

  return (
    <div className="flex flex-col gap-5">

      {/* ── KPI bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total muestras', value: total,             unit: '',  color: '#7c3aed' },
          { label: 'Zonas sanas',    value: healthy,           unit: '',  color: '#16a34a' },
          { label: 'Zonas afectadas',value: sick,              unit: '',  color: '#dc2626' },
          { label: 'Afectación prom',value: avgAff.toFixed(1), unit: '%', color: '#d97706' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-3 text-center shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className="text-2xl font-black mt-0.5" style={{ color: k.color }}>
              {k.value}<span className="text-sm font-normal">{k.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── Alerts ── */}
      {critical && critical.result.confidence > SEVERITY_LIMITS.grave && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 flex items-center gap-3">
          <span className="text-xl">🚨</span>
          <p className="text-sm text-red-700">
            <strong>Zona crítica: {critical.label}</strong> — {DISEASE_LABELS[critical.result.target_class] ?? critical.result.target_class}, {Math.round(critical.result.confidence)}% afectado. Prioriza el tratamiento aquí.
          </p>
        </div>
      )}
      {dominant && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-sm text-amber-700">
            Enfermedad dominante: <strong>{dominant.label}</strong> ({dominant.value} de {total} zonas)
          </p>
        </div>
      )}

      {/* ── Map + charts row ── */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Terrain map */}
        <div className={`flex-1 rounded-2xl border overflow-hidden shadow-sm ${isDark ? 'border-[#1e3048]' : 'border-slate-200'}`}>
          <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-slate-50 border-slate-100'}`}>
            <span className="text-sm">🛰️</span>
            <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Mapa del terreno analizado</p>
            <span className={`ml-auto text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Haz clic en un punto para ver detalles</span>
          </div>
          <div style={{ height: 380 }}>
            <MapContainer
              center={[vertices[0].lat, vertices[0].lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer attribution='&copy; Esri'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                opacity={0.5} />
              <FitBounds vertices={vertices} />
              <Polygon positions={vertices}
                pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.08, weight: 2 }} />
              {samples.filter(s => s.status === 'done').map(sample => {
                const [lng, lat] = sample.coords
                const isSel = selectedId === sample.id
                return (
                  <Marker key={sample.id} position={[lat, lng]}
                    icon={makeReportPin(sample, isSel)}
                    zIndexOffset={isSel ? 1000 : 0}
                    eventHandlers={{ click: () => setSelectedId(isSel ? null : sample.id) }}
                  />
                )
              })}
            </MapContainer>
          </div>
          {/* Legend */}
          <div className={`px-4 py-2 border-t flex flex-wrap gap-x-4 gap-y-1 ${isDark ? 'border-[#1e3048] bg-[#162032]' : 'border-slate-100 bg-white'}`}>
            {SEVERITY_LEGEND.map(([k, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_PALETTE[k] }} />
                <span className="text-[10px] text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Charts column */}
        <div className="flex flex-col gap-4 w-full lg:w-72 xl:w-80 flex-shrink-0">

          {/* Donut: disease distribution */}
          <div className={`rounded-2xl border p-4 shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Distribución de enfermedades</p>
            <div className="flex items-center gap-4">
              <DonutChart slices={donutSlices} />
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {donutSlices.map(sl => (
                  <div key={sl.label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: sl.color }} />
                    <span className={`text-xs font-semibold truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{sl.label}</span>
                    <span className="ml-auto text-xs font-black" style={{ color: sl.color }}>{sl.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart: % per zone */}
          <div className={`rounded-2xl border p-4 shadow-sm flex-1 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>% afectado por zona</p>
            {barData.length > 0
              ? <BarChart bars={barData} />
              : <p className="text-xs text-slate-400 text-center py-4">Sin datos</p>
            }
          </div>

          {/* Severity gauge card */}
          <div className={`rounded-2xl border p-4 shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Severidad global del lote</p>
            <div className="flex items-end gap-3">
              <div>
                <p className="text-3xl font-black leading-none" style={{ color: severityColor[severityLevel] }}>
                  {avgAff.toFixed(0)}%
                </p>
                <p className="text-xs font-bold mt-1" style={{ color: severityColor[severityLevel] }}>{severityLevel}</p>
              </div>
              <div className="flex-1">
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(avgAff, 100)}%`, background: severityColor[severityLevel] }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Máx. en lote: {Math.round(maxAff)}%</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Zone detail (on click) ── */}
      {selectedSample && (
        <ZoneDetail
          sample={selectedSample}
          isDark={isDark}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* ── Detail table ── */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-[#1e3048]' : 'border-slate-200'}`}>
        <div className={`px-4 py-3 border-b font-bold text-sm ${isDark ? 'bg-slate-800 border-[#1e3048] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          Detalle por zona
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-400'}>
                {['Punto', 'Diagnóstico', '% Afectado', 'Severidad', 'Coordenadas'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples.map((s, i) => {
                const cls  = s.result?.target_class
                const conf = s.result?.confidence ?? 0
                const sev  = !cls ? '—' : severityOf(cls, conf)
                const sevC = { Sano: '#16a34a', Leve: '#65a30d', Moderada: '#d97706', Grave: '#dc2626', '—': '#94a3b8' }
                const [lng, lat] = s.coords
                const isSel = selectedId === s.id
                return (
                  <tr
                    key={s.id}
                    onClick={() => s.status === 'done' && setSelectedId(isSel ? null : s.id)}
                    className={`border-t cursor-pointer transition-colors ${
                      isSel
                        ? isDark ? 'bg-violet-900/30 border-violet-800' : 'bg-violet-50 border-violet-200'
                        : isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-800/40' : 'border-slate-100 text-slate-700 hover:bg-slate-50'
                    } ${i % 2 === 0 && !isSel ? '' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-bold">{s.label}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DISEASE_COLORS[cls] ?? '#94a3b8' }} />
                        {s.status === 'done' ? (DISEASE_LABELS[cls] ?? cls) : s.status === 'error' ? 'Error' : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-black" style={{ color: DISEASE_COLORS[cls] ?? '#94a3b8' }}>
                      {s.status === 'done' ? `${Math.round(conf)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: sevC[sev] }}>{sev}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
                      {lat.toFixed(4)}, {lng.toFixed(4)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={onReset}
        className={`self-center px-5 py-2.5 rounded-xl border text-sm font-semibold transition ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
        ← Analizar otra parcela
      </button>
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
function StepChooseParcela({ onSelectExisting, onCreateNew }) {
  const { isDark } = useTheme()
  const [summaries] = useState(() => getParcelaSummaries())
  const [creating, setCreating] = useState(false)
  const [nombre, setNombre] = useState('')

  const confirmCreate = () => {
    const trimmed = nombre.trim()
    if (!trimmed) return
    onCreateNew(trimmed)
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <div>
          <label className="text-sm font-semibold text-slate-600">Nombre de la nueva parcela</label>
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmCreate()}
            placeholder="Ej. Lote Norte"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setCreating(false)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
            ← Volver
          </button>
          <button onClick={confirmCreate} disabled={!nombre.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
            Dibujar el lote →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-slate-500">
          {summaries.length > 0 ? 'Elige una parcela para registrar una nueva visita, o crea una nueva.' : 'Aún no tienes parcelas registradas.'}
        </p>
        <button onClick={() => { setNombre(''); setCreating(true) }}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
          ＋ Nueva parcela
        </button>
      </div>

      {summaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summaries.map(p => (
            <button key={p.id} onClick={() => onSelectExisting(p)}
              className={`text-left rounded-2xl border p-4 shadow-sm hover:shadow-md hover:border-violet-300 transition-all ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl">🛰️</span>
                <span className="text-[10px] font-bold text-violet-500 bg-violet-50 rounded-full px-2 py-0.5">
                  {p.visits.length} visita{p.visits.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className={`font-bold text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{p.nombre}</p>
              <p className="text-xs text-slate-400 mt-0.5">{p.ha} ha · {p.sampleCount} puntos</p>
              {p.lastVisit && (
                <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
                  Última visita: {new Date(p.lastVisit.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalizarParcela({ preselectedParcelaId } = {}) {
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

  const stepBarIndex = step === 0 ? 0 : (step === 1 || step === 2) ? 1 : step === 3 ? 2 : 3

  return (
    <div className="flex flex-col gap-6">
      <StepBar current={stepBarIndex} />

      {step === 0 && (
        <StepChooseParcela onSelectExisting={selectExistingParcela} onCreateNew={startNewParcela} />
      )}
      {step === 1 && <StepDraw onDone={handleDrawDone} />}
      {step === 2 && drawData && (
        <StepPreview
          data={drawData}
          onConfirm={handleConfirmPoints}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && drawData && parcela && (
        <StepSamples data={drawData} onDone={handleSamplesDone} onRedraw={() => setStep(1)} />
      )}
      {step === 4 && drawData && (
        <StepReport data={drawData} samples={samples} onReset={handleReset} />
      )}
    </div>
  )
}
