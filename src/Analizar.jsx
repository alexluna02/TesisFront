import { useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// ── Disease config ────────────────────────────────────────────────────────────

const DISEASES = {
  Fondo_y_Sana:  { label: 'Cultivo Sano',    color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', barColor: '#22c55e' },
  Tizon:         { label: 'Tizón del Maíz',  color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', barColor: '#f97316' },
  Roya:          { label: 'Roya',            color: '#b45309', bg: '#fffbeb', border: '#fde68a', barColor: '#f59e0b' },
  Mancha_Blanca: { label: 'Mancha Blanca',   color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', barColor: '#ef4444' },
}

const RECOMMENDATIONS = {
  Fondo_y_Sana: [
    'Continuar con el monitoreo periódico del cultivo cada 7-10 días.',
    'Mantener las prácticas óptimas de riego y fertilización.',
    'Registrar condiciones actuales como referencia para análisis futuros.',
  ],
  Tizon: [
    'Aplicar fungicidas preventivos certificados para tizón del maíz.',
    'Mejorar el drenaje del suelo para reducir humedad excesiva.',
    'Realizar rotación de cultivos en la próxima temporada.',
    'Monitorear parcelas adyacentes para detectar posible propagación.',
  ],
  Roya: [
    'Aplicar fungicidas triazoles en etapas tempranas de infección.',
    'Reducir humedad relativa mejorando la ventilación entre surcos.',
    'Incrementar la frecuencia de monitoreo a cada 3-5 días.',
    'Considerar variedades resistentes a roya en próximas siembras.',
  ],
  Mancha_Blanca: [
    'Aplicar tratamientos fungicidas sistémicos según recomendación técnica.',
    'Mejorar la sanidad del suelo con enmiendas orgánicas.',
    'Evitar el estrés hídrico manteniendo riego uniforme y constante.',
    'Eliminar residuos de cosecha que puedan actuar como focos de infección.',
  ],
}

const getRisk = (conf) => conf >= 85 ? 'Alto' : conf >= 60 ? 'Medio' : 'Bajo'

// ── Component ─────────────────────────────────────────────────────────────────

export default function Analizar({ onHistoryChange, history = [] }) {
  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState(null)

  const applyFile = (f) => {
    if (!f?.type.startsWith('image/')) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    applyFile(e.dataTransfer.files?.[0])
  }, [])

  const analyze = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_URL}/predict/xai`, { method: 'POST', body })
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`)
      const data = await res.json()
      setResult(data)

      const d = DISEASES[data.target_class]
      const entry = {
        fecha:           new Date().toISOString(),
        imagen:          preview,
        enfermedad:      data.target_class,
        enfermedadLabel: d?.label ?? data.target_class,
        confianza:       data.confidence / 100,
        riesgo:          getRisk(data.confidence),
        cultivo:         'Maíz',
        recomendaciones: (RECOMMENDATIONS[data.target_class] ?? []).join(' '),
        xaiData:         `Confianza: ${data.confidence}% — Clase: ${data.target_class}`,
        xaiImage:        data.xai_base64_png ? `data:image/png;base64,${data.xai_base64_png}` : null,
        affectedPercent: data.affected_percent ?? null,
        estado:          data.target_class === 'Fondo_y_Sana' ? 'Sano' : 'Con enfermedad',
      }
      const prev = JSON.parse(localStorage.getItem('analysisHistory') ?? '[]')
      const next = [entry, ...prev]
      localStorage.setItem('analysisHistory', JSON.stringify(next))
      if (typeof onHistoryChange === 'function') onHistoryChange(next)
    } catch (e) {
      setError(e.message || 'No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  const disease = result ? DISEASES[result.target_class] : null
  const recs    = result ? (RECOMMENDATIONS[result.target_class] ?? []) : []

  return (
    <div className="space-y-5 fade-up">

      {/* ── Upload card ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-1">Cargar imagen UAV</h2>
        <p className="text-sm text-slate-500 mb-5">
          Sube una fotografía aérea de tu cultivo de maíz capturada con dron
        </p>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          className="relative rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer select-none"
          style={dragging
            ? { borderColor: '#22c55e', background: '#f0fdf4' }
            : { borderColor: '#e2e8f0', background: '#f8fafc' }
          }
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => applyFile(e.target.files?.[0])}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {preview ? (
            <div className="flex flex-col items-center gap-3">
              <img src={preview} alt="Preview" className="h-40 w-auto rounded-xl object-cover shadow-md"/>
              <div>
                <p className="text-sm font-semibold text-slate-700">{file?.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">Haz clic o arrastra para cambiar la imagen</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center transition-colors"
                style={dragging
                  ? { background: '#dcfce7', border: '1px solid #bbf7d0' }
                  : { background: '#f1f5f9', border: '1px solid #e2e8f0' }
                }
              >
                <svg viewBox="0 0 24 24" fill="none" stroke={dragging ? '#16a34a' : '#94a3b8'} strokeWidth="1.5" className="w-7 h-7">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Arrastra tu imagen aquí</p>
                <p className="text-sm text-slate-400 mt-1">o haz clic para seleccionar · JPG, PNG, WebP</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 justify-end">
          {error && (
            <p className="flex-1 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              {error}
            </p>
          )}
          <button
            disabled={!file || loading}
            onClick={analyze}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-bold text-sm transition-all active:scale-95"
            style={!file || loading
              ? { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }
              : { background: '#16a34a', color: 'white', boxShadow: '0 4px 16px rgba(22,163,74,0.28)' }
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

      {/* ── Loading state ────────────────────────────────────────── */}
      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-14 shadow-sm flex flex-col items-center gap-5 fade-in">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100"/>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-500 animate-spin"/>
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-800">Procesando imagen con IA</p>
            <p className="text-sm text-slate-400 mt-1">Segmentación semántica + Grad-CAM XAI en curso…</p>
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────── */}
      {result && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 fade-up">
          <h2 className="font-bold text-slate-900">Resultados del análisis</h2>

          {/* Image comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Imagen original
              </p>
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img src={preview} alt="Original" className="w-full h-full object-cover"/>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Mapa de calor XAI (Grad-CAM)
              </p>
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={`data:image/png;base64,${result.xai_base64_png}`}
                  alt="Grad-CAM"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Diagnosis */}
          {disease && (
            <div
              className="rounded-xl p-5"
              style={{ background: disease.bg, border: `1px solid ${disease.border}` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Diagnóstico</p>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: disease.color }}/>
                    <p className="text-2xl font-black text-slate-900">{disease.label}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Confianza del modelo</p>
                  <p className="text-4xl font-black" style={{ color: disease.color }}>
                    {result.confidence}<span className="text-xl font-bold">%</span>
                  </p>
                </div>
              </div>

              <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.65)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${result.confidence}%`, background: disease.barColor }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs text-slate-400">
                <span>0%</span>
                <span>Nivel de confianza</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                Recomendaciones agronómicas
              </p>
              <ul className="space-y-2.5">
                {recs.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                    <span
                      className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: '#dcfce7', border: '1px solid #bbf7d0' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3" className="w-3 h-3">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-400 text-right">
            Análisis guardado automáticamente en el historial
          </p>
        </div>
      )}
    </div>
  )
}
