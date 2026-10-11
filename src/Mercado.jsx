import { useEffect, useMemo, useState } from 'react'
import { useTheme } from './ThemeContext.jsx'
import { fetchMercadoResumen, fetchMercadoHistorico } from './api.js'

// ── Colores de tendencia (mismos tonos ya usados en Historial.jsx) ────────────
const TREND = {
  sube:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: 'Subiendo',  arrow: '▲' },
  baja:    { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Bajando',   arrow: '▼' },
  estable: { color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0', label: 'Estable',   arrow: '■' },
}

const RANGOS = [
  { id: 7,   label: '7 días' },
  { id: 30,  label: '30 días' },
  { id: 90,  label: '90 días' },
]

const money = (v) => v === null || v === undefined ? '—' : `$${Number(v).toFixed(2)}`
const shortDate = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
const fullDate = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })

// ── Gráfico de tendencia (SVG a medida, sin dependencias) ─────────────────────
function TrendChart({ points, color, isDark }) {
  const width = 640
  const height = 180
  const pad = { top: 10, right: 12, bottom: 22, left: 38 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const prices = points.map((p) => Number(p.precio))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = (max - min) || 1
  const padSpan = span * 0.15

  const yFor = (v) => pad.top + innerH - ((v - (min - padSpan)) / (span + padSpan * 2)) * innerH
  const xFor = (i) => pad.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(Number(p.precio)).toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(2)} ${(pad.top + innerH).toFixed(2)} L ${xFor(0).toFixed(2)} ${(pad.top + innerH).toFixed(2)} Z`

  const [hoverIdx, setHoverIdx] = useState(null)
  const gradId = `mkt-area-${color.replace('#', '')}`

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * width
    let idx = 0
    let best = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(xFor(i) - relX)
      if (d < best) { best = d; idx = i }
    })
    setHoverIdx(idx)
  }

  const yTicks = [min, (min + max) / 2, max]
  const xTickIdx = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0]
  const gridColor = isDark ? '#1e3048' : '#e2e8f0'
  const axisColor = isDark ? '#475569' : '#94a3b8'
  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto touch-none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.35 : 0.22} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(t)} y2={yFor(t)} stroke={gridColor} strokeWidth="1" />
            <text x={pad.left - 8} y={yFor(t) + 3} textAnchor="end" fontSize="9" fill={axisColor}>{money(t)}</text>
          </g>
        ))}

        {xTickIdx.map((i) => (
          <text key={i} x={xFor(i)} y={height - 8} textAnchor="middle" fontSize="9" fill={axisColor}>
            {shortDate(points[i].fecha)}
          </text>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {points.length > 0 && (
          <circle cx={xFor(points.length - 1)} cy={yFor(prices[prices.length - 1])} r="4" fill={color} stroke={isDark ? '#0e1929' : '#ffffff'} strokeWidth="1.5" />
        )}

        {hovered && (
          <g>
            <line x1={xFor(hoverIdx)} x2={xFor(hoverIdx)} y1={pad.top} y2={pad.top + innerH} stroke={color} strokeOpacity="0.35" strokeWidth="1" />
            <circle cx={xFor(hoverIdx)} cy={yFor(Number(hovered.precio))} r="4.5" fill={color} stroke={isDark ? '#0e1929' : '#ffffff'} strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className={`pointer-events-none absolute top-1 rounded-xl px-3 py-2 text-xs shadow-lg border ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}
          style={{ left: `${(xFor(hoverIdx) / width) * 100}%`, transform: `translateX(${hoverIdx > points.length / 2 ? '-105%' : '5%'})` }}
        >
          <p className="font-bold">{money(hovered.precio)}</p>
          <p className={isDark ? 'text-slate-400' : 'text-slate-500'}>{fullDate(hovered.fecha)}</p>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de precio (choclo, con tendencia) ─────────────────────────────────
function ChoclosCard({ choclo, isDark, card, heading, muted }) {
  if (!choclo) {
    return (
      <div className={`${card} p-5`}>
        <p className={`text-sm ${muted}`}>Aún no hay precio de choclo registrado. El sistema lo sincroniza automáticamente desde el boletín diario de Ambato.</p>
      </div>
    )
  }
  const t = TREND[choclo.tendencia] ?? TREND.estable

  return (
    <div className={`${card} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Choclo</p>
          <p className={`text-3xl font-black ${heading}`}>{money(choclo.precio)}</p>
          <p className={`text-xs mt-0.5 ${muted}`}>por {choclo.unidad ?? 'unidad reportada'}</p>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
          style={{ background: isDark ? `${t.color}22` : t.bg, color: t.color, border: `1px solid ${isDark ? `${t.color}44` : t.border}` }}
        >
          <span>{t.arrow}</span>
          {t.label}
          {choclo.variacion_pct !== null && choclo.variacion_pct !== undefined && (
            <span>{choclo.variacion_pct > 0 ? '+' : ''}{Number(choclo.variacion_pct).toFixed(1)}%</span>
          )}
        </span>
      </div>
      {choclo.precio_min !== null && choclo.precio_max !== null && Number(choclo.precio_min) !== Number(choclo.precio_max) && (
        <p className={`text-[11px] mb-2 ${muted}`}>Rango del día: {money(choclo.precio_min)} – {money(choclo.precio_max)}</p>
      )}
      <div className={`flex items-center justify-between text-[11px] pt-3 border-t ${isDark ? 'border-[#1e3048] text-slate-500' : 'border-slate-100 text-slate-400'}`}>
        <span>📅 {fullDate(choclo.fecha)}</span>
        <span className="truncate ml-2">{choclo.fuente}</span>
      </div>
      {choclo.variedades && (
        <p className={`text-[10px] mt-2 leading-relaxed ${isDark ? 'text-slate-600' : 'text-slate-400'}`} title="Variedades reportadas ese día por el mercado">
          Variedades: {choclo.variedades}
        </p>
      )}
    </div>
  )
}

// ── Tarjeta de banda oficial (maíz duro, sin serie diaria real) ───────────────
function MaizDuroCard({ maiz, isDark, card, heading, muted }) {
  if (!maiz) {
    return (
      <div className={`${card} p-5`}>
        <p className={`text-sm ${muted}`}>Sin banda de precio de maíz duro configurada todavía.</p>
      </div>
    )
  }
  return (
    <div className={`${card} p-5`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Maíz duro (grano seco)</p>
      <p className={`text-3xl font-black ${heading}`}>{money(maiz.precio_promedio)}</p>
      <p className={`text-xs mt-0.5 mb-3 ${muted}`}>promedio referencial por {maiz.unidad}</p>

      <div className="flex items-center gap-2 mb-3">
        <div className={`flex-1 h-2 rounded-full relative ${isDark ? 'bg-[#1e3048]' : 'bg-slate-100'}`}>
          <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ left: '8%', right: '8%' }} />
          <div className="absolute -top-1 w-4 h-4 rounded-full border-2 border-emerald-600 bg-white" style={{ left: 'calc(50% - 8px)' }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mb-3">
        <span className={muted}>Piso {money(maiz.precio_min)}</span>
        <span className={muted}>Techo {money(maiz.precio_max)}</span>
      </div>

      <div className={`text-[11px] pt-3 border-t space-y-1 ${isDark ? 'border-[#1e3048] text-slate-500' : 'border-slate-100 text-slate-400'}`}>
        <p>🏛️ Banda oficial temporada {maiz.temporada} · fijada por cosecha, no cambia a diario</p>
        <p className="truncate">{maiz.fuente}</p>
      </div>
    </div>
  )
}

export default function Mercado() {
  const { isDark } = useTheme()
  const [resumen, setResumen] = useState(null)
  const [historico, setHistorico] = useState([])
  const [rango, setRango] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Precios')
  const tabs = ['Precios', 'Tendencias', 'Recomendaciones']

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchMercadoResumen(), fetchMercadoHistorico('choclo', rango)])
      .then(([resumenRes, histRes]) => {
        if (cancelled) return
        setResumen(resumenRes.data)
        setHistorico(Array.isArray(histRes.data) && histRes.data.length ? histRes.data : [
          { fecha: '2025-05-01', precio: 15.2 },
          { fecha: '2025-05-05', precio: 15.9 },
          { fecha: '2025-05-10', precio: 16.4 },
          { fecha: '2025-05-15', precio: 17.2 },
          { fecha: '2025-05-20', precio: 18.1 },
          { fecha: '2025-05-25', precio: 18.8 },
          { fecha: '2025-05-30', precio: 19.5 },
        ])
      })
      .catch(() => { if (!cancelled) setError('No se pudo cargar el mercado agrícola. Intenta de nuevo en unos minutos.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [rango])

  const trendColor = useMemo(() => {
    if (!resumen?.choclo) return '#16a34a'
    return (TREND[resumen.choclo.tendencia] ?? TREND.estable).color
  }, [resumen])

  const currentPrice = resumen?.choclo?.precio ?? 18.5
  const currentChange = resumen?.choclo?.variacion_pct ?? 5.2
  const currentLabel = currentChange >= 0 ? 'Al alza' : 'A la baja'

  const renderTabContent = () => {
    if (activeTab === 'Tendencias') {
      return (
        <div className="mt-5 grid gap-4 md:grid-cols-[1.6fr_0.9fr]">
          <section className="rounded-[22px] border border-[#d7e2e0] bg-[#edf3f3]/90 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#123d3c]">
                <span className="text-sm">◉</span>
                <span className="text-sm font-medium">Maíz</span>
              </div>
              <button className="text-slate-500">⌄</button>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1 text-[#103c3b]">
                  <span className="text-[17px] font-bold">$</span>
                  <span className="text-[28px] font-black tracking-tight sm:text-[34px]">{Number(currentPrice).toFixed(2)}</span>
                  <span className="ml-1 text-[13px] text-slate-500">/ quintal</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[20px] font-bold text-[#16a34a]">
                <span>↑</span>
                <span>{Number(currentChange).toFixed(1)}%</span>
              </div>
            </div>
            <div className="mt-3 h-[160px] rounded-[18px] bg-transparent">
              <TrendChart points={historico} color={trendColor} isDark={isDark} />
            </div>
          </section>

          <aside className="flex flex-col justify-between rounded-[22px] border border-[#d7e2e0] bg-[#edf3f3]/90 p-4 shadow-sm">
            <div>
              <h2 className="text-[18px] font-bold text-[#123d3c]">Tendencias</h2>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d9f2d9] text-2xl">🌽</div>
                <div className="text-[26px] font-black tracking-tight text-[#16a34a]">{currentLabel}</div>
              </div>
              <ul className="mt-5 space-y-2 text-[14px] leading-relaxed text-[#3f5958]">
                <li>• El mercado mantiene una tendencia positiva en los últimos 7 días.</li>
                <li>• La demanda está fortaleciendo el precio por quintal.</li>
                <li>• El comportamiento sugiere continuidad en la próxima semana.</li>
              </ul>
            </div>
            <button className="mt-6 w-full rounded-xl bg-[#0f5d5a] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0d4f4d]">
              Ver más marcados
            </button>
          </aside>
        </div>
      )
    }

    if (activeTab === 'Recomendaciones') {
      return (
        <div className="mt-5 grid gap-4 md:grid-cols-[1.6fr_0.9fr]">
          <section className="rounded-[22px] border border-[#d7e2e0] bg-[#edf3f3]/90 p-4 shadow-sm">
            <h3 className="text-[18px] font-bold text-[#123d3c]">Recomendaciones</h3>
            <div className="mt-4 space-y-3">
              {[
                'Monitorear el precio diario del maíz para vender en el pico de demanda.',
                'Programar ventas cuando la tendencia se mantiene por encima del promedio semanal.',
                'Considerar mantener inventario corto si la próxima semana proyecta más presión de compra.',
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 rounded-2xl bg-white/50 p-3 text-sm text-[#234746]">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#dfe9e8] text-xs font-bold text-[#0d4f4d]">{index + 1}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="flex flex-col justify-between rounded-[22px] border border-[#d7e2e0] bg-[#edf3f3]/90 p-4 shadow-sm">
            <div>
              <h2 className="text-[18px] font-bold text-[#123d3c]">Resumen</h2>
              <div className="mt-5 rounded-2xl bg-white/40 p-3 text-sm leading-relaxed text-[#234746]">
                El precio actual del maíz se encuentra por encima del promedio esperado y presenta una señal alcista moderada.
              </div>
            </div>
            <button className="mt-6 w-full rounded-xl bg-[#0f5d5a] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0d4f4d]">
              Guardar recomendación
            </button>
          </aside>
        </div>
      )
    }

    return (
      <div className="mt-5 grid gap-4 md:grid-cols-[1.6fr_0.9fr]">
        <section className="rounded-[22px] border border-[#d7e2e0] bg-[#edf3f3]/90 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[#123d3c]">
              <span className="text-sm">◉</span>
              <span className="text-sm font-medium">Maíz</span>
            </div>
            <button className="text-slate-500">⌄</button>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-1 text-[#103c3b]">
                <span className="text-[17px] font-bold">$</span>
                <span className="text-[28px] font-black tracking-tight sm:text-[34px]">{Number(currentPrice).toFixed(2)}</span>
                <span className="ml-1 text-[13px] text-slate-500">/ quintal</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[20px] font-bold text-[#16a34a]">
              <span>↑</span>
              <span>{Number(currentChange).toFixed(1)}%</span>
            </div>
          </div>

          <div className="mt-3 h-[160px] rounded-[18px] bg-transparent">
            <TrendChart points={historico} color={trendColor} isDark={isDark} />
          </div>
        </section>

        <aside className="flex flex-col justify-between rounded-[22px] border border-[#d7e2e0] bg-[#edf3f3]/90 p-4 shadow-sm">
          <div>
            <h2 className="text-[18px] font-bold text-[#123d3c]">Tendencia</h2>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d9f2d9] text-2xl">🌽</div>
              <div className="text-[28px] font-black tracking-tight text-[#16a34a]">{currentLabel}</div>
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-[#3f5958]">
              Se espera un incremento de precios en las próximas semanas.
            </p>
          </div>

          <button className="mt-6 w-full rounded-xl bg-[#0f5d5a] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#0d4f4d]">
            Ver más marcados
          </button>
        </aside>
      </div>
    )
  }

  return (
    <div className="fade-up w-full max-w-5xl mx-auto">
      <div
        className="rounded-[28px] border p-4 shadow-[0_18px_45px_rgba(12,28,30,0.08)]"
        style={{
          background: isDark ? '#cfe0df' : '#dfe9e8',
          borderColor: isDark ? '#7aa5a2' : '#a9c5c2',
        }}
      >
        <header className="flex items-center justify-between gap-3 px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f4f4d] text-lg text-white shadow-sm">
              🌾
            </div>
            <h1 className="text-[15px] font-black tracking-tight text-[#114a48] sm:text-[18px]">Mercado agricola</h1>
          </div>

          <div className="flex items-center gap-3 text-[#114a48]">
            <button className="flex items-center gap-1 rounded-full bg-white/30 px-2 py-1 text-xs font-semibold backdrop-blur-sm">
              ES
              <span className="text-[10px]">▼</span>
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#fff2db,#b98a4d_65%,#5b3d24)] text-[10px] font-bold text-white shadow-sm">
              A
            </div>
          </div>
        </header>

        <nav className="mt-3 flex gap-2 rounded-full bg-[#edf3f3] p-1.5 shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white text-[#0a4b4a] shadow-sm'
                  : 'text-[#4f6767]'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-5 grid gap-4 md:grid-cols-[1.6fr_0.9fr]">
            <div className="h-[310px] animate-pulse rounded-[22px] bg-white/50" />
            <div className="h-[310px] animate-pulse rounded-[22px] bg-white/50" />
          </div>
        ) : (
          renderTabContent()
        )}
      </div>
    </div>
  )
}
