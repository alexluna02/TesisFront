import { useState, useCallback, useEffect, useRef } from 'react'
import { predictXai, createAnalisis } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import { useTheme } from './ThemeContext.jsx'

const DISEASES = {
  Fondo_y_Sana:  { label: 'Cultivo Sano',   color: '#15803d', gradFrom: '#f0fdf4', gradTo: '#dcfce7', border: '#86efac', barColor: '#22c55e' },
  Fondo:         { label: 'Cultivo Sano',   color: '#15803d', gradFrom: '#f0fdf4', gradTo: '#dcfce7', border: '#86efac', barColor: '#22c55e' },
  Tizon:         { label: 'Tizón del Maíz', color: '#c2410c', gradFrom: '#fff7ed', gradTo: '#ffedd5', border: '#fdba74', barColor: '#f97316' },
  Roya:          { label: 'Roya',           color: '#92400e', gradFrom: '#fffbeb', gradTo: '#fef3c7', border: '#fcd34d', barColor: '#f59e0b' },
  Mancha_Blanca: { label: 'Mancha Blanca',  color: '#991b1b', gradFrom: '#fef2f2', gradTo: '#fee2e2', border: '#fca5a5', barColor: '#ef4444' },
  Mancha_blanca: { label: 'Mancha Blanca',  color: '#991b1b', gradFrom: '#fef2f2', gradTo: '#fee2e2', border: '#fca5a5', barColor: '#ef4444' },
}

const DISEASE_IDS = { Fondo_y_Sana: 1, Tizon: 2, Roya: 3, Mancha_Blanca: 4 }

const RECOMMENDATIONS = {
  Fondo_y_Sana: [
    { title: 'Monitoreo periódico', body: 'Continuar con revisión del cultivo cada 7-10 días para detectar cambios tempranos.' },
    { title: 'Mantener prácticas', body: 'Sostener las prácticas óptimas de riego y fertilización actuales.' },
    { title: 'Registrar condiciones', body: 'Documentar condiciones actuales como referencia para análisis futuros.' },
  ],
  Tizon: [
    { title: 'Fungicidas preventivos', body: 'Aplicar fungicidas certificados para tizón del maíz de forma preventiva.' },
    { title: 'Mejorar drenaje', body: 'Optimizar el drenaje del suelo para reducir la humedad excesiva.' },
    { title: 'Rotación de cultivos', body: 'Planificar rotación de cultivos para la próxima temporada.' },
    { title: 'Vigilar parcelas', body: 'Monitorear parcelas adyacentes para detectar posible propagación.' },
  ],
  Roya: [
    { title: 'Fungicidas triazoles', body: 'Aplicar fungicidas triazoles en etapas tempranas de infección.' },
    { title: 'Ventilación', body: 'Reducir humedad relativa mejorando la ventilación entre surcos.' },
    { title: 'Mayor frecuencia', body: 'Incrementar frecuencia de monitoreo a cada 3-5 días.' },
    { title: 'Variedades resistentes', body: 'Considerar variedades resistentes a roya en próximas siembras.' },
  ],
  Mancha_Blanca: [
    { title: 'Fungicidas sistémicos', body: 'Aplicar tratamientos fungicidas sistémicos según recomendación técnica.' },
    { title: 'Sanidad del suelo', body: 'Mejorar la sanidad del suelo con enmiendas orgánicas adecuadas.' },
    { title: 'Riego uniforme', body: 'Evitar el estrés hídrico manteniendo riego constante y uniforme.' },
    { title: 'Eliminar residuos', body: 'Retirar residuos de cosecha que puedan actuar como focos de infección.' },
  ],
}

const STEPS = [
  'Preprocesando imagen UAV…',
  'Ejecutando modelo de segmentación…',
  'Generando mapa Grad-CAM XAI…',
  'Guardando en historial…',
]

const getRisk    = (conf) => conf >= 85 ? 'Alto' : conf >= 60 ? 'Medio' : 'Bajo'
const getSeverity = (conf, cls) => cls === 'Fondo_y_Sana' ? 'leve' : conf < 5 ? 'leve' : conf <= 15 ? 'moderada' : 'grave'

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload  = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('No se pudo procesar la imagen'))
  reader.readAsDataURL(file)
})

const compressImage = (file, maxWidth = 800, quality = 0.75) => new Promise((resolve) => {
  const canvas = document.createElement('canvas')
  const img = new Image()
  const tempUrl = URL.createObjectURL(file)
  img.onload = () => {
    URL.revokeObjectURL(tempUrl)
    const scale = Math.min(1, maxWidth / img.width)
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    resolve(canvas.toDataURL('image/jpeg', quality))
  }
  img.onerror = () => { URL.revokeObjectURL(tempUrl); resolve('') }
  img.src = tempUrl
})

const mapAnalysisResponse = (record, RECS) => {
  const confidence = Number(record.afectacion_pct || 0)
  const diseaseName = record.enfermedad?.nombre ?? 'Desconocido'
  return {
    id: record.id,
    fecha: record.fecha,
    imagen: record.imagen_url,
    enfermedad: diseaseName,
    enfermedadLabel: DISEASES[diseaseName]?.label ?? diseaseName,
    confianza: confidence / 100,
    riesgo: record.severidad === 'grave' ? 'Alto' : record.severidad === 'moderada' ? 'Medio' : 'Bajo',
    cultivo: 'Maíz',
    recomendaciones: RECS[record.enfermedad?.nombre]?.map(r => r.body).join(' ') ?? '',
    xaiImage: record.grad_cam_url,
    affectedPercent: confidence,
    estado: record.enfermedad?.clase_idx === 0 ? 'Sano' : 'Con enfermedad',
  }
}

function useCountUp(target, active) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active || !target) { setCount(0); return }
    let raf
    const start = performance.now()
    const duration = 1100
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active])
  return count
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  )
}

function HealthyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  )
}

function DiseaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    </svg>
  )
}

export default function Analizar({ onHistoryChange, onAnalysisSaved, history = [], enfermedades = [] }) {
  const { isDark } = useTheme()
  const [file, setFile]               = useState(null)
  const [preview, setPreview]         = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [dragging, setDragging]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [step, setStep]               = useState(-1)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState(null)
  const [imgTab, setImgTab]           = useState('original')
  const [exportingPdf, setExportingPdf] = useState(false)

  const displayConf = useCountUp(result?.confidence ?? 0, !!result && !loading)
  const isHealthy   = result?.target_class === 'Fondo_y_Sana' || result?.target_class === 'Fondo'
  const disease     = result ? DISEASES[result.target_class] : null
  const recs        = result ? (RECOMMENDATIONS[result.target_class] ?? RECOMMENDATIONS['Fondo_y_Sana']) : []
  const risk        = result ? getRisk(result.confidence) : null

  const previewUrlRef = useRef('')

  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }
  }, [])

  const applyFile = (f) => {
    if (!f?.type.startsWith('image/')) return
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(f)
    previewUrlRef.current = url
    setFile(f)
    setPreview(url)
    setResult(null)
    setError('')
    setImgTab('original')
    fileToDataUrl(f).then(setPreviewDataUrl).catch(() => setPreviewDataUrl(''))
  }

  const handleExportPDF = async () => {
    if (!result) return
    setExportingPdf(true)
    try {
      await exportAnalisisPDF({
        diseaseLabel:    disease?.label ?? result.target_class,
        affectedPercent: result.confidence,
        risk,
        fecha:           new Date().toISOString(),
        originalImg:     previewDataUrl,
        xaiImg:          result.xai_base64_png ? `data:image/png;base64,${result.xai_base64_png}` : null,
        recommendations: recs,
      })
    } finally {
      setExportingPdf(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    applyFile(e.dataTransfer.files?.[0])
  }, [])

  const clearFile = (e) => {
    e.stopPropagation()
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = '' }
    setFile(null)
    setPreview('')
    setResult(null)
    setError('')
  }

  const analyze = async () => {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('La imagen no puede superar 20 MB.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    setStep(0)

    try {
      const imageDataUrl = await compressImage(file)
      const formData = new FormData()
      formData.append('file', file)

      setStep(1)
      const response = await predictXai(formData)
      const data = response.data

      setStep(2)
      setResult(data)

      setStep(3)
      const targetIdx     = Number(data.target_class_id) || null
      const enfermedadRow = (enfermedades || []).find((e) => Number(e.clase_idx) === targetIdx)
      const diseaseId     = enfermedadRow?.id ?? DISEASE_IDS[data.target_class]
      const severity      = getSeverity(data.confidence, data.target_class)
      const xaiDataUrl    = data.xai_base64_png ? `data:image/png;base64,${data.xai_base64_png}` : null

      const savedResponse = await createAnalisis({
        imagen_url:     imageDataUrl,
        grad_cam_url:   xaiDataUrl,
        afectacion_pct: data.confidence,
        severidad:      severity,
        enfermedad_id:  diseaseId,
      })

      const saved = mapAnalysisResponse(savedResponse.data, RECOMMENDATIONS)
      if (typeof onHistoryChange === 'function') onHistoryChange([saved, ...history])
      if (typeof onAnalysisSaved === 'function') onAnalysisSaved()
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
      setStep(-1)
    }
  }

  const fileSizeLabel = file
    ? file.size < 1_000_000
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${(file.size / 1_000_000).toFixed(1)} MB`
    : ''

  return (
    <div className="space-y-5 fade-up">

      {/* ── Upload card ───────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 pt-6 pb-4 border-b flex items-center justify-between ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>
          <div>
            <h2 className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Cargar imagen UAV</h2>
            <p className="text-sm text-slate-500 mt-0.5">Fotografía aérea de cultivo de maíz · JPG, PNG, WebP</p>
          </div>
          {file && !loading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
              Lista para analizar
            </span>
          )}
        </div>

        <div className="p-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className="relative rounded-xl cursor-pointer select-none overflow-hidden transition-all duration-200"
            style={{
              minHeight: preview ? 280 : 220,
              border: dragging ? '2px dashed #22c55e' : '2px dashed #e2e8f0',
              background: dragging ? '#f0fdf4' : preview ? '#0f172a' : isDark ? 'linear-gradient(135deg, #0e1929 0%, #0c1220 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              boxShadow: dragging ? '0 0 0 4px rgba(34,197,94,0.12)' : 'none',
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => applyFile(e.target.files?.[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            {preview ? (
              <>
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full object-cover transition-all duration-300"
                  style={{ maxHeight: 340, opacity: loading ? 0.4 : 1 }}
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 py-3 flex items-center justify-between z-20 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                    </svg>
                    <p className="text-xs text-slate-300 font-medium truncate max-w-[200px]">{file?.name}</p>
                    <span className="text-xs text-slate-500">{fileSizeLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="pointer-events-auto z-30 flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 text-xs font-semibold text-white transition backdrop-blur-sm"
                  >
                    Cambiar
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-14">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200"
                  style={{
                    background: dragging ? '#dcfce7' : 'white',
                    border: dragging ? '1.5px solid #86efac' : '1.5px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(15,23,42,0.07)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke={dragging ? '#16a34a' : '#64748b'} strokeWidth="1.5" className="w-8 h-8 transition-colors">
                    <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-700">
                    {dragging ? '¡Suelta la imagen aquí!' : 'Arrastra tu imagen aquí'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">o haz clic para explorar archivos</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {['JPG', 'PNG', 'WebP'].map(f => (
                    <span key={f} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-medium">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-wrap items-center gap-3 justify-end">
          {error && (
            <p className="flex-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
          <button
            disabled={!file || loading}
            onClick={analyze}
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3 font-bold text-sm transition-all duration-200 active:scale-95"
            style={!file || loading
              ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }
              : { background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: 'white', boxShadow: '0 4px 20px rgba(22,163,74,0.35)' }
            }
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Analizando…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M3 9V6a3 3 0 013-3h3M3 15v3a3 3 0 003 3h3M21 9V6a3 3 0 00-3-3h-3M21 15v3a3 3 0 01-3 3h-3"/>
                  <rect x="7" y="7" width="10" height="10" rx="2"/>
                </svg>
                Analizar imagen
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Loading steps ─────────────────────────────────────────── */}
      {loading && (
        <div className={`rounded-2xl border p-6 shadow-sm fade-in ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="relative w-8 h-8 flex-shrink-0">
              <div className="absolute inset-0 rounded-full border-[3px] border-slate-100"/>
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-500 animate-spin"/>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Procesando con inteligencia artificial</p>
              <p className="text-xs text-slate-400">Segmentación semántica + Grad-CAM XAI</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {STEPS.map((label, i) => {
              const done    = i < step
              const active  = i === step
              const pending = i > step
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300"
                  style={{
                    background: active ? '#f0fdf4' : done ? '#fafafa' : 'transparent',
                    border: active ? '1px solid #bbf7d0' : '1px solid transparent',
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                    style={{
                      background: done ? '#22c55e' : active ? '#dcfce7' : '#f1f5f9',
                      border: active ? '1.5px solid #86efac' : 'none',
                    }}
                  >
                    {done ? (
                      <span className="text-white"><CheckIcon /></span>
                    ) : active ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"/>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300"/>
                    )}
                  </div>
                  <span
                    className="text-sm font-medium transition-colors duration-300"
                    style={{ color: done ? '#64748b' : active ? '#15803d' : '#94a3b8' }}
                  >
                    {label}
                  </span>
                  {active && (
                    <span className="ml-auto text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                      En curso
                    </span>
                  )}
                  {done && (
                    <span className="ml-auto text-xs text-slate-400">Completado</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="space-y-4 fade-up">

          {/* Diagnosis banner */}
          {disease && (
            <div
              className="rounded-2xl p-6 shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${disease.gradFrom} 0%, ${disease.gradTo} 100%)`,
                border: `1px solid ${disease.border}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.6)', border: `1.5px solid ${disease.border}` }}
                  >
                    <span style={{ color: disease.color }}>
                      {isHealthy ? <HealthyIcon /> : <DiseaseIcon />}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Diagnóstico</p>
                    <p className="text-3xl font-black text-slate-900 leading-tight">{disease.label}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          background: risk === 'Alto' ? '#fef2f2' : risk === 'Medio' ? '#fffbeb' : '#f0fdf4',
                          color:      risk === 'Alto' ? '#b91c1c' : risk === 'Medio' ? '#92400e' : '#15803d',
                          border:     `1px solid ${risk === 'Alto' ? '#fecaca' : risk === 'Medio' ? '#fde68a' : '#bbf7d0'}`,
                        }}
                      >
                        Riesgo {risk}
                      </span>
                      <span className="text-xs text-slate-500">· Cultivo de Maíz</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5">Área afectada</p>
                  <p className="font-black leading-none" style={{ fontSize: 52, color: disease.color }}>
                    {displayConf}<span className="text-2xl font-bold">%</span>
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.55)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-[1100ms] ease-out"
                    style={{ width: `${displayConf}%`, background: disease.barColor }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                  <span>0%</span>
                  <span>Porcentaje del área de la imagen con síntomas</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}

          {/* Image comparison */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <div className="px-5 pt-5 pb-0 flex items-center justify-between">
              <p className="font-bold text-slate-900 text-sm">Análisis visual</p>
              <div className="flex rounded-xl overflow-hidden border border-slate-200 text-xs font-semibold">
                {[
                  { key: 'original', label: 'Original' },
                  { key: 'xai',      label: 'Grad-CAM XAI' },
                  { key: 'ambas',    label: 'Comparar' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setImgTab(key)}
                    className="px-3 py-1.5 transition-colors"
                    style={imgTab === key
                      ? { background: '#0f172a', color: 'white' }
                      : { background: 'white', color: '#64748b' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {imgTab === 'ambas' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Imagen original</p>
                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={preview} alt="Original" className="w-full h-full object-cover"/>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Mapa de calor Grad-CAM</p>
                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={`data:image/png;base64,${result.xai_base64_png}`} alt="Grad-CAM" className="w-full h-full object-cover"/>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 relative">
                  <img
                    src={imgTab === 'original' ? preview : `data:image/png;base64,${result.xai_base64_png}`}
                    alt={imgTab === 'original' ? 'Original' : 'Grad-CAM'}
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="rounded-lg bg-slate-950/60 backdrop-blur-sm border border-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {imgTab === 'original' ? 'Imagen original UAV' : 'Mapa de calor Grad-CAM XAI'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {imgTab === 'xai' && (
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="w-4 h-4 flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                  </svg>
                  <span>El mapa Grad-CAM muestra las zonas de la imagen donde el modelo concentró su atención para el diagnóstico. Las áreas en colores cálidos (rojo/naranja) indican las regiones de mayor relevancia.</span>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className={`rounded-2xl border shadow-sm p-6 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" className="w-3.5 h-3.5">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Recomendaciones agronómicas</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recs.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-start gap-3 hover:border-slate-200 hover:bg-white transition-colors duration-150"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                      style={{ background: disease?.barColor ?? '#22c55e', color: 'white' }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-0.5">{rec.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{rec.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-400">Análisis guardado automáticamente en el historial</p>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-rose-500">
                <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                <path d="M14 3v5a1 1 0 001 1h5M9 17v-5m0 0h6m-6 0l3-3m0 0l3 3"/>
              </svg>
              {exportingPdf ? 'Generando…' : 'Exportar PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
