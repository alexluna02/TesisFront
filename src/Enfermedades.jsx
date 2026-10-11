import { useTheme } from './ThemeContext.jsx'

// ── Contenido de referencia de enfermedades ────────────────────────────────────
const DISEASES = [
  {
    key: 'sano',
    name: 'Cultivo Sano',
    pathogen: 'Sin patógeno detectado',
    color: '#22c55e',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    icon: '🌽',
    description: 'Tejido foliar sin lesiones visibles ni signos de patógenos. Color verde uniforme, textura normal y sin decoloraciones.',
    conditions: ['Riego y fertilización equilibrados', 'Buen drenaje del suelo', 'Densidad de siembra adecuada'],
    symptoms: ['Hojas de color verde uniforme', 'Sin manchas, pústulas ni lesiones', 'Crecimiento vigoroso'],
    management: ['Monitoreo cada 7–10 días', 'Mantener las prácticas de manejo actuales', 'Registrar condiciones como referencia futura'],
  },
  {
    key: 'tizon',
    name: 'Tizón del Maíz',
    pathogen: 'Exserohilum turcicum',
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fdba74',
    icon: '🍂',
    description: 'Produce lesiones necróticas alargadas de color gris-verdoso en forma de huso. En condiciones de alta humedad las lesiones se unen y cubren gran parte del follaje, reduciendo la capacidad fotosintética.',
    conditions: ['Humedad relativa alta (>90%)', 'Temperaturas moderadas (18–27°C)', 'Rocío prolongado sobre las hojas'],
    symptoms: ['Manchas alargadas gris-parduzcas de bordes definidos', 'Inicia en hojas inferiores y avanza hacia arriba', 'Lesiones que se fusionan en infecciones severas'],
    management: ['Fungicidas preventivos certificados', 'Mejorar el drenaje del suelo', 'Rotación de cultivos entre temporadas', 'Vigilar parcelas adyacentes'],
  },
  {
    key: 'roya',
    name: 'Roya',
    pathogen: 'Puccinia sorghi',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fcd34d',
    icon: '🟠',
    description: 'Produce pústulas de color café-anaranjado en ambas caras de la hoja. Las esporas se dispersan fácilmente con el viento, favoreciendo una propagación rápida entre parcelas vecinas.',
    conditions: ['Temperaturas frescas (16–23°C)', 'Alta humedad foliar', 'Viento moderado que dispersa esporas'],
    symptoms: ['Pústulas pulverulentas color óxido', 'Se desprenden al frotar la hoja con los dedos', 'Distribuidas en toda la lámina foliar'],
    management: ['Fungicidas triazoles en etapas tempranas', 'Reducir humedad mejorando la ventilación entre surcos', 'Monitoreo más frecuente (cada 3–5 días)', 'Variedades resistentes en próximas siembras'],
  },
  {
    key: 'mancha',
    name: 'Mancha Blanca',
    pathogen: 'Phyllachora maydis',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fca5a5',
    icon: '⚪',
    description: 'Genera manchas circulares blancas o plateadas en las hojas que afectan progresivamente la fotosíntesis. En infecciones severas puede reducir el rendimiento hasta un 40%.',
    conditions: ['Alta humedad relativa', 'Estrés hídrico del cultivo', 'Residuos de cosecha infectados en el suelo'],
    symptoms: ['Manchas circulares pequeñas blanco-plateadas', 'Halo clorótico alrededor de la lesión', 'Distribución dispersa en toda la hoja'],
    management: ['Fungicidas sistémicos según recomendación técnica', 'Riego uniforme para evitar estrés hídrico', 'Retirar residuos de cosecha infectados', 'Mejorar la sanidad del suelo con enmiendas orgánicas'],
  },
]

const SEVERITY_LEVELS = [
  { level: 'Nulo',     range: 'Cultivo sano',   bg: '#e2e8f0', color: '#475569', border: '#cbd5e1', desc: 'No se detectó afectación. El cultivo se encuentra en buen estado.' },
  { level: 'Leve',     range: '< 5% afectado',  bg: '#ecfdf5', color: '#15803d', border: '#bbf7d0', desc: 'Afectación inicial. Recomendable aumentar la vigilancia del cultivo.' },
  { level: 'Moderado', range: '5% – 15%',       bg: '#fef3c7', color: '#b45309', border: '#fde68a', desc: 'Afectación en progreso. Se recomienda iniciar tratamiento fitosanitario.' },
  { level: 'Severo',   range: '> 15% afectado', bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', desc: 'Afectación alta. Requiere intervención inmediata para evitar pérdidas.' },
]

export default function Enfermedades() {
  const { isDark } = useTheme()
  const card = `rounded-2xl border shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`
  const heading = isDark ? 'text-slate-100' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="space-y-5 fade-up max-w-4xl">

      {/* Hero */}
      <div className={`${card} px-6 py-7`}>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #22c55e)' }}>
            🦠
          </div>
          <div>
            <h1 className={`text-2xl font-black ${heading}`}>Guía de Enfermedades</h1>
            <p className="text-sm text-emerald-600 font-semibold">Maíz · Diagnóstico fitosanitario</p>
          </div>
        </div>
        <p className={`text-sm leading-relaxed ${muted}`}>
          Referencia rápida sobre las enfermedades foliares que AgroScan es capaz de detectar, para ayudarte
          a entender mejor el diagnóstico, el patógeno causante y las condiciones que favorecen su aparición.
        </p>
      </div>

      {/* Disease cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DISEASES.map((d) => (
          <div key={d.key} className={`${card} overflow-hidden`}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : d.bg, borderBottom: `1px solid ${isDark ? '#1e3048' : d.border}` }}>
              <span className="text-2xl leading-none">{d.icon}</span>
              <div className="min-w-0">
                <p className={`font-bold text-sm ${heading}`}>{d.name}</p>
                <p className="text-xs italic truncate" style={{ color: d.color }}>{d.pathogen}</p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <p className={`text-xs leading-relaxed ${muted}`}>{d.description}</p>

              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Condiciones favorables</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.conditions.map((c) => (
                    <span key={c} className="text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : d.bg, color: d.color, border: `1px solid ${isDark ? '#1e3048' : d.border}` }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Síntomas clave</p>
                <ul className="space-y-1">
                  {d.symptoms.map((s) => (
                    <li key={s} className={`text-xs flex items-start gap-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: d.color }} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Manejo recomendado</p>
                <ul className="space-y-1">
                  {d.management.map((m) => (
                    <li key={m} className={`text-xs flex items-start gap-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: d.color }} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cómo interpretar la severidad */}
      <div className={`${card} px-6 py-6`}>
        <h2 className={`font-bold text-sm mb-1 ${heading}`}>¿Cómo interpretar la severidad?</h2>
        <p className={`text-xs mb-4 ${muted}`}>
          AgroScan clasifica cada diagnóstico según el porcentaje de tejido foliar afectado detectado por el modelo de IA.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SEVERITY_LEVELS.map((s) => (
            <div key={s.level} className="rounded-xl border p-3" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : s.bg, borderColor: isDark ? '#1e3048' : s.border }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {s.level}
                </span>
                <span className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.range}</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <p className={`text-[11px] text-center ${muted}`}>
        Esta guía es informativa y contempla las enfermedades incluidas en el alcance de este proyecto de tesis. Para un diagnóstico específico use el módulo "Analizar".
      </p>
    </div>
  )
}
