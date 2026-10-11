import { useEffect, useRef, useState } from 'react'
import { useTheme } from './ThemeContext.jsx'
import { ProductionBenchmark } from './Rendimiento.jsx'
import {
  CLASSES, MODEL_INFO, DATASET, DATASET_SPLIT, TRAINING, FINAL_METRICS, TEST_PER_CLASS,
  VAL_PER_CLASS, ENCODER_COMPARISON, RESOLUTION_STUDY, CONFUSION, INFERENCE, HISTORY,
} from './data/modelCard.js'
import gradcamImg from './Imagenes/modelo/gradcam_test.jpg'
import trainingImg from './Imagenes/modelo/entrenamiento_b0.jpg'

// Paleta categórica validada (dataviz validate_palette: light y dark pasan)
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark:  ['#3987e5', '#d95926', '#199e70', '#c98500'],
}
const SEQ_HUE = { light: [42, 120, 214], dark: [57, 135, 229] }

const fmt = (v, d = 4) => (v == null ? 'N/D' : v.toFixed(d))
const fmtInt = (v) => v.toLocaleString('es-ES')

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

// ── Gráfico de líneas con crosshair y tooltip ─────────────────────────────────
function LineChart({ series, yDomain, yFormat = (v, precise) => v.toFixed(precise ? 4 : 2), markers = [], height = 240, tickCount = 5, isDark }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const epochs = HISTORY.map((h) => h.epoch)
  const pad = { top: 12, right: series.length > 1 ? 112 : 16, bottom: 28, left: 44 }
  const w = Math.max(width - pad.left - pad.right, 10)
  const h = height - pad.top - pad.bottom
  const [y0, y1] = yDomain
  const x = (e) => pad.left + ((e - epochs[0]) / (epochs[epochs.length - 1] - epochs[0])) * w
  const y = (v) => pad.top + (1 - (v - y0) / (y1 - y0)) * h
  const ticks = Array.from({ length: tickCount }, (_, i) => y0 + ((y1 - y0) * i) / (tickCount - 1))
  const grid = isDark ? '#1e3048' : '#e2e8f0'
  const ink2 = isDark ? '#94a3b8' : '#64748b'
  const ink1 = isDark ? '#e2e8f0' : '#0f172a'
  const surface = isDark ? '#162032' : '#ffffff'

  const onMove = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect()
    const px = ev.clientX - rect.left
    const e = Math.round(epochs[0] + ((px - pad.left) / w) * (epochs[epochs.length - 1] - epochs[0]))
    if (e >= epochs[0] && e <= epochs[epochs.length - 1]) setHover(e)
  }

  // Etiquetas directas al final de cada serie, separadas para no solaparse
  const endLabels = series
    .map((s, i) => ({ i, name: s.name, y: y(s.values[s.values.length - 1]) }))
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < endLabels.length; k++) {
    if (endLabels[k].y - endLabels[k - 1].y < 13) endLabels[k].y = endLabels[k - 1].y + 13
  }

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1"/>
              <text x={pad.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill={ink2}>{yFormat(t)}</text>
            </g>
          ))}
          {[1, 10, 20, 30, 40, 49].map((e) => (
            <text key={e} x={x(e)} y={height - 8} textAnchor="middle" fontSize="10" fill={ink2}>{e}</text>
          ))}
          {markers.map((m, k) => (
            <g key={m.epoch}>
              <line x1={x(m.epoch)} x2={x(m.epoch)} y1={pad.top} y2={pad.top + h} stroke={ink2} strokeWidth="1" strokeDasharray="3 3"/>
              <text x={x(m.epoch) + 4} y={pad.top + 10 + k * 13} fontSize="10" fill={ink2}>{m.label}</text>
            </g>
          ))}
          {series.map((s) => (
            <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              points={s.values.map((v, i) => `${x(epochs[i])},${y(v)}`).join(' ')}/>
          ))}
          {series.length > 1 && endLabels.map((l) => (
            <text key={l.name} x={pad.left + w + 8} y={l.y} dominantBaseline="middle" fontSize="11" fontWeight="600" fill={ink1}>
              <tspan fill={series[l.i].color}>●</tspan> {l.name}
            </text>
          ))}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + h} stroke={ink2} strokeWidth="1"/>
              {series.map((s) => (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover - 1])} r="4.5" fill={s.color} stroke={surface} strokeWidth="2"/>
              ))}
            </g>
          )}
        </svg>
      )}
      {hover != null && (
        <div
          className={`pointer-events-none absolute top-2 z-10 rounded-xl border px-3 py-2 text-xs shadow-lg ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
          style={x(hover) > width / 2 ? { right: width - x(hover) + 12 } : { left: x(hover) + 12 }}
        >
          <p className="font-bold mb-1">Época {hover}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-2 whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }}/>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{s.name}</span>
              <span className="ml-auto font-semibold tabular-nums">{yFormat(s.values[hover - 1], true)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function SplitToggle({ value, onChange, isDark }) {
  return (
    <div className="flex gap-2 mb-3">
      {[['test', 'Test'], ['val', 'Validación']].map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${value === k
            ? 'bg-violet-600 text-white'
            : isDark ? 'bg-[#0e1929] text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Matriz de confusión ───────────────────────────────────────────────────────
function ConfusionMatrix({ isDark }) {
  const [split, setSplit] = useState('test')
  const [hover, setHover] = useState(null)
  const m = CONFUSION[split]
  const rowSums = m.map((r) => r.reduce((a, b) => a + b, 0))
  const [r, g, b] = SEQ_HUE[isDark ? 'dark' : 'light']
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <SplitToggle value={split} onChange={setSplit} isDark={isDark}/>
        <span className={`text-xs mb-3 ${muted}`}>Normalizada por fila (recall). Pasa el cursor para ver píxeles.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className={`px-2 text-right font-semibold ${muted}`}>Real ↓ / Predicción →</th>
              {CLASSES.map((c) => <th key={c} className={`px-2 pb-1 font-semibold ${muted}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {m.map((row, i) => (
              <tr key={i}>
                <th className={`pr-3 text-right font-semibold whitespace-nowrap ${muted}`}>{CLASSES[i]}</th>
                {row.map((v, j) => {
                  const p = v / rowSums[i]
                  const strong = p > 0.5
                  return (
                    <td key={j}
                      onMouseEnter={() => setHover({ i, j, v, p })} onMouseLeave={() => setHover(null)}
                      className="w-20 h-14 md:w-24 text-center rounded-md tabular-nums font-semibold cursor-default"
                      style={{
                        background: `rgba(${r},${g},${b},${0.06 + p * 0.94})`,
                        color: strong ? '#ffffff' : isDark ? '#e2e8f0' : '#0f172a',
                        outline: hover && hover.i === i && hover.j === j ? `2px solid ${isDark ? '#e2e8f0' : '#0f172a'}` : 'none',
                      }}>
                      {p.toFixed(3)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`mt-3 text-xs min-h-[1rem] ${muted}`}>
        {hover
          ? <>Real <b>{CLASSES[hover.i]}</b> → predicho <b>{CLASSES[hover.j]}</b>: {fmtInt(hover.v)} píxeles ({(hover.p * 100).toFixed(1)} % de la fila, total fila {fmtInt(rowSums[hover.i])})</>
          : 'Filas = clase real; columnas = clase predicha.'}
      </p>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  const { isDark } = useTheme()
  return (
    <section className={`rounded-2xl border shadow-sm p-5 md:p-6 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
      <h3 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
      <p className={`text-xs mt-0.5 mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
      {children}
    </section>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ModeloIA() {
  const { isDark } = useTheme()
  const [showTable, setShowTable] = useState(false)
  const [classSplit, setClassSplit] = useState('test')
  const perClass = classSplit === 'test' ? TEST_PER_CLASS : VAL_PER_CLASS
  const bestOf = (key) => Math.max(...ENCODER_COMPARISON.map((e) => e[key]))
  const best = { miou: bestOf('miou'), f1: bestOf('f1'), pixAcc: bestOf('pixAcc'), fps: bestOf('fps') }
  const tested = ENCODER_COMPARISON.filter((e) => e.test)
  const bestTest = (key) => Math.max(...tested.map((e) => e.test[key]))
  const bestT = { miou: bestTest('miou'), f1: bestTest('f1') }
  const selectedRow = isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
  const badge = (text) => <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">{text}</span>
  const colors = SERIES[isDark ? 'dark' : 'light']
  const card = `rounded-2xl border shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`
  const heading = isDark ? 'text-slate-100' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const rowBorder = isDark ? 'border-[#1e3048]' : 'border-slate-100'
  const thead = `text-left text-[10px] uppercase tracking-wider ${muted} ${isDark ? 'bg-[#0e1929]' : 'bg-slate-50'}`

  const testMiou = FINAL_METRICS[0].test
  const totalImgs = DATASET_SPLIT.reduce((a, d) => a + d.images, 0)
  const lossMarkers = [{ epoch: 26, label: 'Añade Lovász' }, { epoch: TRAINING.bestEpoch, label: 'Mejor' }]

  return (
    <div className="space-y-6 fade-up">

      {/* Encabezado */}
      <div className={`${card} p-6`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-500">Ficha del modelo · desplegado en producción</p>
        <h2 className={`text-2xl font-black mt-1 ${heading}`}>{MODEL_INFO.name}</h2>
        <p className={`text-sm mt-1 ${muted}`}>
          Segmentación semántica de enfermedades foliares del maíz en imágenes UAV: {CLASSES.join(', ')}.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            `${fmtInt(MODEL_INFO.params)} parámetros`,
            `${MODEL_INFO.sizeMB} MB`,
            `Entrada ${MODEL_INFO.inputSize}`,
            `Pesos: ${MODEL_INFO.weightsFile}`,
          ].map((t) => (
            <span key={t} className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-[#0e1929] text-slate-300' : 'bg-slate-100 text-slate-700'}`}>{t}</span>
          ))}
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${card} p-4 col-span-2 md:col-span-1`} style={{ borderColor: isDark ? '#5b21b6' : '#c4b5fd' }}>
          <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>mIoU · Test</p>
          <p className={`text-3xl font-black mt-1 tabular-nums ${heading}`}>{testMiou.toFixed(4)}</p>
          <p className={`text-[11px] mt-1 ${muted}`}>Métrica definitiva (125 imágenes no vistas)</p>
        </div>
        {FINAL_METRICS.slice(1).map((m) => (
          <div key={m.metric} className={`${card} p-4`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>{m.metric} · Test</p>
            <p className={`text-2xl font-black mt-1 tabular-nums ${heading}`}>{m.test.toFixed(4)}</p>
            <p className={`text-[11px] mt-1 ${muted}`}>Validación: {m.val.toFixed(4)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Métricas globales" subtitle={`${TRAINING.evaluation}. Validación se usó para seleccionar el modelo; Test es independiente.`}>
          <table className="w-full text-sm">
            <thead><tr className={thead}>
              <th className="px-3 py-2 font-semibold">Métrica</th>
              <th className="px-3 py-2 font-semibold text-right">Validación</th>
              <th className="px-3 py-2 font-semibold text-right">Test</th>
              <th className="px-3 py-2 font-semibold text-right">Δ</th>
            </tr></thead>
            <tbody>
              {FINAL_METRICS.map((m) => (
                <tr key={m.metric} className={`border-t ${rowBorder}`}>
                  <td className={`px-3 py-2 font-semibold ${heading}`}>{m.metric}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${muted}`}>{fmt(m.val)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold ${heading}`}>{fmt(m.test)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${muted}`}>{(m.test - m.val).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Métricas por clase" subtitle="IoU, precisión, recall, F1 y precisión promedio (AP) por clase.">
          <SplitToggle value={classSplit} onChange={setClassSplit} isDark={isDark}/>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className={thead}>
                {['Clase', 'IoU', 'Precisión', 'Recall', 'F1', 'AP'].map((h, i) => (
                  <th key={h} className={`px-2 py-2 font-semibold ${i ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {perClass.map((c, i) => (
                  <tr key={c.cls} className={`border-t ${rowBorder}`}>
                    <td className={`px-2 py-2 font-semibold whitespace-nowrap ${heading}`}>
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: colors[i] }}/>{c.cls}
                    </td>
                    {[c.iou, c.precision, c.recall, c.f1, c.ap].map((v, k) => (
                      <td key={k} className={`px-2 py-2 text-right tabular-nums ${v == null ? 'text-amber-500 font-semibold' : heading}`}>
                        {fmt(v)}{v == null && '*'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {classSplit === 'test' && <p className={`text-[11px] mt-3 ${muted}`}>* El AP de Roya en test no se calculó (NaN en el registro del entrenamiento).</p>}
        </Section>
      </div>

      <Section title="Comparación de encoders" subtitle="DeepLabV3+ con distintos encoders, mismo protocolo, 384 × 384 px. Validación se usó para seleccionar cada modelo; test es independiente. En negrita el mejor valor de cada columna.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className={thead}>
              {['Encoder', 'Tipo', 'Parámetros', 'Tamaño (MB)', 'mIoU val', 'F1 val', 'Pixel Acc. val', 'FPS', 'mIoU test', 'F1 test', 'Δ mIoU'].map((h, i) => (
                <th key={h} className={`px-2 py-2 font-semibold whitespace-nowrap ${i > 1 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ENCODER_COMPARISON.map((e) => (
                <tr key={e.encoder} className={`border-t ${rowBorder} ${e.selected ? selectedRow : ''}`}>
                  <td className={`px-2 py-2 font-semibold whitespace-nowrap ${heading}`}>{e.encoder}{e.selected && badge('Seleccionado')}</td>
                  <td className={`px-2 py-2 ${muted}`}>{e.type}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading}`}>{fmtInt(e.params)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading}`}>{e.sizeMB.toFixed(2)}</td>
                  {['miou', 'f1', 'pixAcc'].map((k) => (
                    <td key={k} className={`px-2 py-2 text-right tabular-nums ${heading} ${e[k] === best[k] ? 'font-black' : ''}`}>{e[k].toFixed(4)}</td>
                  ))}
                  <td className={`px-2 py-2 text-right tabular-nums ${heading} ${e.fps === best.fps ? 'font-black' : ''}`}>{e.fps.toFixed(1)}</td>
                  {e.test ? (
                    <>
                      <td className={`px-2 py-2 text-right tabular-nums ${heading} ${e.test.miou === bestT.miou ? 'font-black' : ''}`}>{e.test.miou.toFixed(4)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${heading} ${e.test.f1 === bestT.f1 ? 'font-black' : ''}`}>{e.test.f1.toFixed(4)}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${muted}`}>{(e.test.miou - e.miou).toFixed(4)}</td>
                    </>
                  ) : (
                    <td colSpan={3} className={`px-2 py-2 text-center text-xs italic ${muted}`}>pendiente</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`text-[11px] mt-3 ${muted}`}>FPS medidos en GPU sin TTA. Δ mIoU = test − validación. Métricas de test con EMA + TTA.</p>
        <div className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-relaxed ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-slate-300' : 'border-emerald-200 bg-emerald-50 text-slate-700'}`}>
          <p className={`font-bold mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>¿Por qué MiT-B0?</p>
          En el conjunto de test, los tres encoders Transformer (MiT-B1, MiT-B2 y MiT-B0) obtienen los mayores mIoU, por delante de las
          cuatro CNN; ResNet18, primero en validación, cae al quinto puesto en test. MiT-B1 es el más exacto, pero MiT-B0 queda a solo
          0.8 puntos de mIoU con 3.5 veces menos parámetros (4.14 M frente a 14.30 M) y 15.78 MB frente a 54.57 MB. Es el encoder más
          liviano de los siete y el más exacto entre los modelos de menos de 20 MB, el mejor equilibrio entre exactitud y costo para
          ejecutarse en la aplicación web.
        </div>
      </Section>

      <Section title="Sensibilidad a la resolución de entrada (MiT-B0)" subtitle="Métricas sobre validación. 384 px ofrece la mejor exactitud con un entrenamiento rápido.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className={thead}>
              {['Resolución', 'mIoU', 'F1 macro', 'Tiempo/época (s)', 'FPS'].map((h, i) => (
                <th key={h} className={`px-2 py-2 font-semibold whitespace-nowrap ${i ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {RESOLUTION_STUDY.map((r) => (
                <tr key={r.res} className={`border-t ${rowBorder} ${r.selected ? selectedRow : ''}`}>
                  <td className={`px-2 py-2 font-semibold whitespace-nowrap ${heading}`}>{r.res} × {r.res}{r.selected && badge('Seleccionada')}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading} ${r.selected ? 'font-black' : ''}`}>{r.miou.toFixed(4)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading} ${r.selected ? 'font-black' : ''}`}>{r.f1.toFixed(4)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading}`}>{r.secPerEpoch.toFixed(1)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${heading}`}>{r.fps.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Matriz de confusión a nivel de píxel" subtitle="Evaluación con el mejor modelo (EMA) + TTA.">
        <ConfusionMatrix isDark={isDark}/>
      </Section>

      {/* Curvas */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Pérdida por época" subtitle="En la época 26 la pérdida pasa de Dice+CE a Lovász+CE+Dice: el salto refleja el cambio de función, no del modelo.">
          <LineChart isDark={isDark} yDomain={[0.2, 0.7]} tickCount={6} markers={lossMarkers}
            series={[
              { name: 'Train', color: colors[0], values: HISTORY.map((h) => h.trainLoss) },
              { name: 'Val', color: colors[1], values: HISTORY.map((h) => h.valLoss) },
            ]}/>
        </Section>
        <Section title="mIoU de validación por época" subtitle={`Mejor valor ${TRAINING.bestValMiou.toFixed(4)} en la época ${TRAINING.bestEpoch} (sin TTA).`}>
          <LineChart isDark={isDark} yDomain={[0.65, 0.85]} markers={[{ epoch: TRAINING.bestEpoch, label: 'Mejor' }]}
            series={[{ name: 'mIoU', color: colors[0], values: HISTORY.map((h) => h.miou) }]}/>
        </Section>
      </div>

      <Section title="IoU por clase en validación" subtitle="Evolución del IoU de cada clase durante el entrenamiento.">
        <LineChart isDark={isDark} yDomain={[0.5, 1]} tickCount={6} height={280}
          series={CLASSES.map((c, i) => ({ name: c, color: colors[i], values: HISTORY.map((h) => h.iou[i]) }))}/>
        <button onClick={() => setShowTable((v) => !v)} className="mt-3 text-xs font-semibold text-violet-500">
          {showTable ? 'Ocultar datos por época' : 'Ver datos por época'}
        </button>
        {showTable && (
          <div className={`mt-3 max-h-80 overflow-auto rounded-xl border ${rowBorder}`}>
            <table className="w-full text-xs">
              <thead className="sticky top-0"><tr className={thead}>
                {['Época', 'LR', 'Loss train', 'Loss val', 'mIoU', ...CLASSES].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold text-right whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {HISTORY.map((h) => (
                  <tr key={h.epoch} className={`border-t ${rowBorder} ${h.epoch === TRAINING.bestEpoch ? (isDark ? 'bg-violet-500/10' : 'bg-violet-50') : ''}`}>
                    <td className={`px-3 py-1.5 text-right font-semibold ${heading}`}>{h.epoch}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${muted}`}>{h.lr.toExponential(2)}</td>
                    {[h.trainLoss, h.valLoss, h.miou, ...h.iou].map((v, k) => (
                      <td key={k} className={`px-3 py-1.5 text-right tabular-nums ${heading}`}>{v.toFixed(4)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Configuración del entrenamiento">
          <dl className="space-y-2 text-sm">
            {[
              ['Decoder / Encoder', `${MODEL_INFO.decoder} / ${MODEL_INFO.encoder}`],
              ['Pesos iniciales', MODEL_INFO.pretrained],
              ['Épocas', `${TRAINING.epochsRun} de ${TRAINING.maxEpochs} (early stopping, paciencia ${TRAINING.earlyStoppingPatience})`],
              ['Mejor época', `${TRAINING.bestEpoch}`],
              ['Optimizador', TRAINING.optimizer],
              ['LR encoder / decoder', `${TRAINING.lrEncoder.toExponential(0)} / ${TRAINING.lrDecoder.toExponential(0)}`],
              ['Planificador', TRAINING.scheduler],
              ['Iteraciones/época', TRAINING.itersPerEpoch],
              ...TRAINING.lossSchedule.map((l) => [`Pérdida (ép. ${l.epochs})`, l.loss]),
              ['Evaluación', TRAINING.evaluation],
              ['Tiempo total', `${TRAINING.totalMinutes} min (${TRAINING.secondsPerEpoch} s/época)`],
              ['Framework', TRAINING.framework],
              ['Hardware', TRAINING.hardware],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className={muted}>{k}</dt>
                <dd className={`text-right font-semibold ${heading}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Partición del dataset" subtitle={`${fmtInt(DATASET.annotated)} imágenes anotadas, partición ${DATASET.splitRatio}. Aumento ${DATASET.augmentation}. ${fmtInt(totalImgs)} imágenes en total.`}>
          <div className="space-y-3">
            {DATASET_SPLIT.map((d, i) => (
              <div key={d.split}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={muted}>{d.split}</span>
                  <span className={`font-semibold tabular-nums ${heading}`}>{fmtInt(d.images)} · {((d.images / totalImgs) * 100).toFixed(1)} %</span>
                </div>
                <div className={`h-2 rounded-full ${isDark ? 'bg-[#0e1929]' : 'bg-slate-100'}`}>
                  <div className="h-2 rounded-full" style={{ width: `${(d.images / totalImgs) * 100}%`, background: colors[i] }}/>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Velocidad de inferencia" subtitle={`Medida en ${INFERENCE.device}, 384 × 384 px.`}>
          <div className="grid grid-cols-2 gap-3">
            {[['Sin TTA', INFERENCE.noTta], ['Con TTA', INFERENCE.tta]].map(([label, v]) => (
              <div key={label} className={`rounded-xl p-3 ${isDark ? 'bg-[#0e1929]' : 'bg-slate-50'}`}>
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>{label}</p>
                <p className={`text-xl font-black tabular-nums ${heading}`}>{v.ms} ms</p>
                <p className={`text-xs ${muted}`}>{v.fps} FPS</p>
              </div>
            ))}
          </div>
          <p className={`text-[11px] mt-3 ${muted}`}>El servidor de producción (CPU de Hugging Face) reporta sus propios tiempos en cada análisis.</p>
        </Section>
      </div>

      <Section title="Rendimiento en producción (CPU)" subtitle="Tiempo de carga del modelo, tiempo de análisis y tiempo de respuesta de la API medidos en el servidor desplegado.">
        <ProductionBenchmark/>
      </Section>

      <Section title="Explicabilidad (Grad-CAM) sobre el conjunto de test" subtitle="Imagen original, etiqueta real, predicción del modelo y mapa Grad-CAM de la clase predicha.">
        <img src={gradcamImg} alt="Ejemplos de test: imagen original, máscara real, predicción y Grad-CAM" className="w-full rounded-xl" loading="lazy"/>
      </Section>

      <details className={`${card} p-5 md:p-6`}>
        <summary className={`cursor-pointer font-bold text-sm ${heading}`}>Figura original del notebook (incluye F1 macro, mAP y LR por época)</summary>
        <img src={trainingImg} alt="Evolución del entrenamiento: pérdida, LR, mIoU, F1, mAP e IoU/F1 por clase" className="w-full rounded-xl mt-4" loading="lazy"/>
      </details>
    </div>
  )
}
