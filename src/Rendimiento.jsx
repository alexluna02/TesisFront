import { useEffect, useRef, useState } from 'react'
import { fetchHealth, predictSegmentation, predictXai } from './api.js'
import { useTheme } from './ThemeContext.jsx'

// Reduce la imagen antes de subirla: el modelo la redimensiona a 384 px de todos
// modos, así que enviar el original de dron (varios MB) solo añade tiempo de red.
export const UPLOAD_MAX_SIDE = 1024
export const prepareUploadFile = (file, maxSide = UPLOAD_MAX_SIDE, quality = 0.92) => new Promise((resolve) => {
  const img = new Image()
  const tempUrl = URL.createObjectURL(file)
  const original = { file, width: null, height: null, originalBytes: file.size, resized: false }
  img.onload = () => {
    URL.revokeObjectURL(tempUrl)
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    if (scale === 1 && file.size < 1_000_000) {
      resolve({ ...original, width: img.width, height: img.height })
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob || blob.size >= file.size) {
        resolve({ ...original, width: img.width, height: img.height })
        return
      }
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
      resolve({
        file: new File([blob], name, { type: 'image/jpeg' }),
        width: canvas.width, height: canvas.height, originalBytes: file.size, resized: true,
      })
    }, 'image/jpeg', quality)
  }
  img.onerror = () => { URL.revokeObjectURL(tempUrl); resolve(original) }
  img.src = tempUrl
})

// Ejecuta una petición y mide el tiempo de ida y vuelta visto por el navegador
export async function timedRequest(requestFn) {
  const t0 = performance.now()
  const response = await requestFn()
  return { response, roundtripMs: performance.now() - t0 }
}

// Desglose de tiempos de una respuesta de /predict/*: servidor + red
export function timingFrom(response, roundtripMs) {
  const t = response?.data?.timing
  if (!t) return null
  return {
    inferenceMs: t.inference_time_ms,
    apiMs: t.api_response_time_ms,
    roundtripMs,
    networkMs: Math.max(roundtripMs - t.api_response_time_ms, 0),
  }
}

export function useModelLoadTime() {
  const [loadMs, setLoadMs] = useState(null)
  useEffect(() => {
    fetchHealth().then(({ data }) => setLoadMs(data?.model_load_time_ms ?? null)).catch(() => {})
  }, [])
  return loadMs
}

const ms = (v) => (v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)

function useStyles() {
  const { isDark } = useTheme()
  return {
    isDark,
    card: `rounded-2xl border shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`,
    tile: `rounded-xl p-3 ${isDark ? 'bg-[#0e1929]' : 'bg-slate-50'}`,
    heading: isDark ? 'text-slate-100' : 'text-slate-900',
    muted: isDark ? 'text-slate-400' : 'text-slate-500',
  }
}

// ── Panel de tiempos de un análisis (pantalla Analizar) ───────────────────────
const bytes = (b) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

export function AnalysisTimingPanel({ seg, xai, loadMs, prepMs = 0, upload }) {
  const { card, tile, heading, muted } = useStyles()
  if (!seg && !xai) return null
  const roundtrip = Math.max(seg?.roundtripMs ?? 0, xai?.roundtripMs ?? 0)

  const tiles = [
    { label: 'Carga del modelo', value: loadMs, hint: 'Al arrancar el servidor' },
    { label: 'Tiempo de análisis', value: seg?.inferenceMs, hint: 'Inferencia del modelo (segmentación)' },
    { label: 'Grad-CAM (XAI)', value: xai?.inferenceMs, hint: 'Inferencia + mapa de calor' },
    { label: 'Respuesta de la API', value: xai?.apiMs ?? seg?.apiMs, hint: 'Desde que llega la petición hasta la respuesta' },
    { label: 'Total percibido', value: roundtrip ? roundtrip + prepMs : null, hint: 'Preparación + red + servidor (medido en el navegador)' },
  ]

  return (
    <div className={`${card} p-5`}>
      <h3 className={`font-bold text-sm ${heading}`}>Rendimiento de este análisis</h3>
      <p className={`text-xs mt-0.5 mb-4 ${muted}`}>
        Servidor de producción en CPU. Las dos peticiones (segmentación y Grad-CAM) se ejecutan en paralelo y comparten la CPU,
        por lo que estos tiempos son mayores que en una medición aislada; usa el benchmark de la Ficha del modelo para cifras comparables.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={tile}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>{t.label}</p>
            <p className={`text-xl font-black tabular-nums mt-0.5 ${heading}`}>{ms(t.value)}</p>
            <p className={`text-[11px] leading-snug ${muted}`}>{t.hint}</p>
          </div>
        ))}
      </div>
      {upload && (
        <p className={`text-[11px] mt-3 ${muted}`}>
          Imagen enviada: {upload.width} × {upload.height} px · {bytes(upload.uploadBytes)}
          {upload.resized
            ? ` (original ${bytes(upload.originalBytes)}, reducida en el navegador en ${Math.round(prepMs)} ms)`
            : ' (sin reducir)'}
        </p>
      )}
    </div>
  )
}

// ── Benchmark secuencial en el servidor de producción (Ficha del modelo) ─────
const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length - 1, 1))
  return { mean, sd, median: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), min: sorted[0], max: sorted[sorted.length - 1] }
}

const METRICS = [
  ['inferenceMs', 'Tiempo de análisis (inferencia)'],
  ['apiMs', 'Respuesta de la API (servidor)'],
  ['networkMs', 'Red (subida + descarga)'],
  ['roundtripMs', 'Total percibido por el usuario'],
]

const ENDPOINTS = {
  seg: { label: 'Segmentación', path: '/predict/segmentation', request: predictSegmentation },
  xai: { label: 'Grad-CAM (XAI)', path: '/predict/xai', request: predictXai },
}

function downloadCsv(rows, filename) {
  const header = ['imagen', 'ronda', 'endpoint', 'bytes_enviados', 'bytes_originales', 'inference_time_ms', 'api_response_time_ms', 'network_ms', 'roundtrip_ms']
  const lines = rows.map((r) => [
    `"${r.image.replace(/"/g, '""')}"`, r.round, r.endpoint, r.bytesSent, r.bytesOriginal,
    r.inferenceMs.toFixed(1), r.apiMs.toFixed(1), r.networkMs.toFixed(1), r.roundtripMs.toFixed(1),
  ].join(','))
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ProductionBenchmark() {
  const { isDark, tile, heading, muted } = useStyles()
  const loadMs = useModelLoadTime()
  const [files, setFiles] = useState([])
  const [rounds, setRounds] = useState(3)
  const [endpoints, setEndpoints] = useState({ seg: true, xai: true })
  const [reduce, setReduce] = useState(true)
  const [samples, setSamples] = useState([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [runInfo, setRunInfo] = useState(null)
  const stopRef = useRef(false)

  const selected = Object.keys(ENDPOINTS).filter((k) => endpoints[k])
  const totalRequests = files.length * rounds * selected.length

  const run = async () => {
    if (!files.length || !selected.length) return
    stopRef.current = false
    setRunning(true)
    setError('')
    setSamples([])
    setRunInfo({ start: new Date(), files: files.length, rounds, endpoints: selected, reduce })
    const collected = []
    try {
      // Prepara cada imagen una sola vez (igual que la app) para no medir el redimensionado
      const uploads = []
      for (const f of files) uploads.push({ name: f.name, original: f.size, ...(reduce ? await prepareUploadFile(f) : { file: f }) })

      // Calentamiento: una petición por endpoint que no se cuenta
      for (const k of selected) {
        const fd = new FormData()
        fd.append('file', uploads[0].file)
        await ENDPOINTS[k].request(fd)
      }

      setProgress({ done: 0, total: totalRequests })
      let done = 0
      for (let round = 1; round <= rounds; round++) {
        for (const u of uploads) {
          for (const k of selected) {
            if (stopRef.current) throw new Error('Benchmark detenido.')
            const fd = new FormData()
            fd.append('file', u.file)
            const { response, roundtripMs } = await timedRequest(() => ENDPOINTS[k].request(fd))
            const t = timingFrom(response, roundtripMs)
            if (t) {
              collected.push({ ...t, image: u.name, round, endpoint: k, bytesSent: u.file.size, bytesOriginal: u.original })
            }
            done += 1
            setProgress({ done, total: totalRequests })
            if (done % 5 === 0) setSamples([...collected])
          }
        }
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Error durante el benchmark.')
    } finally {
      setSamples([...collected])
      setRunning(false)
    }
  }

  const statsFor = (k) => {
    const rows = samples.filter((s) => s.endpoint === k)
    return rows.length ? { n: rows.length, ...Object.fromEntries(METRICS.map(([m]) => [m, summarize(rows.map((r) => r[m]))])) } : null
  }
  const stats = Object.fromEntries(Object.keys(ENDPOINTS).map((k) => [k, statsFor(k)]))
  const segStats = stats.seg
  const thead = `text-left text-[10px] uppercase tracking-wider ${muted} ${isDark ? 'bg-[#0e1929]' : 'bg-slate-50'}`
  const rowBorder = isDark ? 'border-[#1e3048]' : 'border-slate-100'
  const input = `rounded-xl border px-3 py-2 text-sm outline-none focus:border-violet-400 ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-900'}`
  const imagesUsed = new Set(samples.map((s) => s.image)).size

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={tile}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>Carga del modelo</p>
          <p className={`text-xl font-black tabular-nums ${heading}`}>{ms(loadMs)}</p>
          <p className={`text-[11px] ${muted}`}>Último arranque del servidor</p>
        </div>
        {segStats && METRICS.slice(0, 3).map(([k, label]) => (
          <div key={k} className={tile}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>{label}</p>
            <p className={`text-xl font-black tabular-nums ${heading}`}>{ms(segStats[k].median)}</p>
            <p className={`text-[11px] ${muted}`}>Segmentación · mediana · p95 {ms(segStats[k].p95)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="image/*" multiple disabled={running}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className={`${input} max-w-xs`}/>
        <label className={`text-sm ${muted}`}>
          Rondas{' '}
          <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} className={input} disabled={running}>
            {[1, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {Object.entries(ENDPOINTS).map(([k, ep]) => (
          <label key={k} className={`flex items-center gap-2 text-sm ${muted}`}>
            <input type="checkbox" checked={endpoints[k]} disabled={running}
              onChange={(e) => setEndpoints({ ...endpoints, [k]: e.target.checked })}/>
            {ep.label}
          </label>
        ))}
        <label className={`flex items-center gap-2 text-sm ${muted}`}>
          <input type="checkbox" checked={reduce} onChange={(e) => setReduce(e.target.checked)} disabled={running}/>
          Reducir a {UPLOAD_MAX_SIDE} px como la app
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button onClick={run} disabled={!files.length || !selected.length}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            Ejecutar benchmark ({totalRequests} peticiones)
          </button>
        ) : (
          <button onClick={() => { stopRef.current = true }}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white bg-red-600">
            Detener ({progress.done}/{progress.total})
          </button>
        )}
        {samples.length > 0 && !running && (
          <button onClick={() => downloadCsv(samples, `benchmark_produccion_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`)}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${isDark ? 'border-[#1e3048] text-slate-200' : 'border-slate-200 text-slate-700'}`}>
            Descargar CSV ({samples.length} filas)
          </button>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <p className={`text-[11px] ${muted}`}>
        Selecciona varias imágenes (idealmente las 125 de test). Cada imagen se envía una vez por ronda y por endpoint, de forma secuencial,
        tras una petición de calentamiento que no se cuenta. Mide el servidor real de producción (CPU de Hugging Face); los resultados dependen
        de la carga del servidor y de tu conexión.
      </p>

      {Object.entries(stats).filter(([, st]) => st).map(([k, st]) => (
        <div key={k} className="overflow-x-auto">
          <p className={`text-xs font-bold mb-1 ${heading}`}>{ENDPOINTS[k].label} <span className={`font-normal ${muted}`}>· {ENDPOINTS[k].path} · n = {st.n}</span></p>
          <table className="w-full text-[13px]">
            <thead><tr className={thead}>
              {['Métrica (ms)', 'Media ± DE', 'Mediana', 'p95', 'Mín', 'Máx'].map((h, i) => (
                <th key={h} className={`px-2 py-2 font-semibold whitespace-nowrap ${i ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {METRICS.map(([m, label]) => (
                <tr key={m} className={`border-t ${rowBorder}`}>
                  <td className={`px-2 py-2 font-semibold ${heading}`}>{label}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading}`}>{st[m].mean.toFixed(1)} ± {st[m].sd.toFixed(1)}</td>
                  {['median', 'p95', 'min', 'max'].map((q) => (
                    <td key={q} className={`px-2 py-2 text-right tabular-nums ${heading}`}>{st[m][q].toFixed(1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {runInfo && samples.length > 0 && (
        <p className={`text-[11px] ${muted}`}>
          {imagesUsed} imágenes × {runInfo.rounds} rondas · {runInfo.reduce ? `reducidas a ${UPLOAD_MAX_SIDE} px` : 'tamaño original'} ·
          inicio {runInfo.start.toLocaleString('es-ES')}
        </p>
      )}
    </div>
  )
}
