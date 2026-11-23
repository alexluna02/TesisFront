import { useTheme } from './ThemeContext.jsx'
import { diseaseKey } from './diseases.js'
import { resultColor } from './resultados.js'

// Mini-mapa de una parcela: su contorno y los puntos de muestreo coloreados por resultado.
// Sirve de miniatura donde no hay foto (las visitas de parcela no guardan imágenes).
export default function ParcelMiniMap({ vertices = [], samples = [], width = 53, height = 24, dot = 1.7, className = '' }) {
  const { isDark } = useTheme()
  if (!Array.isArray(vertices) || vertices.length < 3) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-[4px] bg-[#e9f5ec] text-[#0b6b35] dark:bg-white/5 dark:text-emerald-300 ${className}`} style={{ width, height }} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M6 5h12l3 14H3L6 5Z"/><path d="M10 5 9 19M14 5l1 14M4.6 12h14.8"/>
        </svg>
      </span>
    )
  }
  const pad = Math.max(3, Math.round(Math.min(width, height) * 0.12))
  const k = Math.cos((vertices[0].lat * Math.PI) / 180)        // la longitud se encoge con la latitud
  const xs = vertices.map((v) => v.lng * k), ys = vertices.map((v) => v.lat)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const s = Math.min((width - 2 * pad) / (x1 - x0 || 1e-9), (height - 2 * pad) / (y1 - y0 || 1e-9))
  const ox = (width - (x1 - x0) * s) / 2, oy = (height - (y1 - y0) * s) / 2
  const pt = (lng, lat) => [ox + (lng * k - x0) * s, oy + (y1 - lat) * s]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={`shrink-0 rounded-[4px] bg-[#eef7f0] dark:bg-white/5 ${className}`} style={{ width, height }}>
      <polygon
        points={vertices.map((v) => pt(v.lng, v.lat).join(',')).join(' ')}
        strokeWidth={width > 60 ? 1.5 : 1}
        strokeLinejoin="round"
        className="fill-[#c4e8cf] stroke-[#0b8a4b] dark:fill-emerald-400/20 dark:stroke-emerald-400"
      />
      {samples.filter((sm) => Array.isArray(sm.coords) && sm.result).map((sm) => {
        const [cx, cy] = pt(sm.coords[0], sm.coords[1])
        return <circle key={sm.id} cx={cx} cy={cy} r={dot} fill={resultColor(diseaseKey(sm.result.target_class), isDark)}/>
      })}
    </svg>
  )
}
