// Utilidades compartidas para mostrar resultados de análisis (Inicio y Análisis por parcela):
// colores y etiquetas por resultado, y fechas relativas.
import { diseaseKey } from './diseases.js'

// Colores de cada resultado, elegidos con el usuario: sano verde, tizón marrón, roya óxido y
// mancha blanca crema. Comprobados para que cualquier par se distinga también con protanopía,
// deuteranopía y tritanopía (ΔE2000 ≥ 15 en claro, ≥ 11 en oscuro). En modo oscuro el marrón se
// aclara y el óxido se aviva para que se vean sobre el fondo de la tarjeta.
export const RESULT_COLORS = {
  sano:   { light: '#0d9473', dark: '#23b58a' },
  tizon:  { light: '#5c3a21', dark: '#86634a' },
  roya:   { light: '#d8612a', dark: '#ef6a35' },
  mancha: { light: '#dfc890', dark: '#e3cf9c' },
}
export const resultColor = (key, isDark) => (RESULT_COLORS[key] ?? { light: '#94a3b8', dark: '#94a3b8' })[isDark ? 'dark' : 'light']

// Etiqueta de un resultado: texto largo (tablas), corto (chips) y clases de color con contraste
// ≥ 5:1 del texto sobre su fondo en ambos temas
export const RESULT_STYLE = {
  tizon:  { text: 'Tizón detectado',         short: 'Tizón',          chip: 'bg-[#f1e7de] text-[#5c3a21] dark:bg-[#86634a]/25 dark:text-[#dcc2a8]', icon: 'bg-[#5c3a21] dark:bg-[#86634a]' },
  roya:   { text: 'Roya detectada',          short: 'Roya',           chip: 'bg-[#fbe5d8] text-[#9c3f17] dark:bg-[#ef6a35]/20 dark:text-[#f8b08c]', icon: 'bg-[#d8612a] dark:bg-[#ef6a35]' },
  mancha: { text: 'Mancha blanca detectada', short: 'Mancha blanca',  chip: 'bg-[#f6efdb] text-[#76602b] dark:bg-[#e3cf9c]/15 dark:text-[#eadcb3]', icon: 'bg-[#b8994f]' },
  sano:   { text: 'Sano',                    short: 'Sano',           chip: 'bg-[#d8f1e8] text-[#0a6b53] dark:bg-[#23b58a]/15 dark:text-[#7fe0c0]', icon: 'bg-[#0d9473] dark:bg-[#23b58a]' },
  otro:   { text: 'Sin clasificar',          short: 'Sin clasificar', chip: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300', icon: 'bg-slate-400' },
}
export const resultKeyOf = (cls, healthy = false) => (healthy ? 'sano' : diseaseKey(cls) ?? 'otro')

// Resultado de una visita de parcela: la enfermedad con más zonas afectadas, o «sano» si no hay
// ninguna. No se usa stats.dominant porque cuenta también las zonas sanas: un lote con 6 zonas
// sanas y 3 con roya quedaba como «Sano».
export function visitResultKey(visit) {
  if (!visit) return null
  const counts = {}
  for (const s of visit.samples ?? []) {
    const k = s.status === 'done' && s.result ? diseaseKey(s.result.target_class) : null
    if (k && k !== 'sano') counts[k] = (counts[k] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  if (top) return top[0]
  if (visit.stats?.sick > 0 && visit.stats?.dominant) return resultKeyOf(visit.stats.dominant)   // registros sin muestras
  return 'sano'
}

// Etiqueta de severidad (Sano / Leve / Moderada / Grave) con texto legible sobre su fondo
export const SEVERITY_CHIP = {
  Sano:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  Leve:     'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300',
  Moderada: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Grave:    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

const DAY_MS = 86400000
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
// Días transcurridos desde la fecha (0 = hoy); Math.round absorbe los cambios de horario
export const daysAgo = (d) => Math.round((startOfDay(Date.now()) - startOfDay(d)) / DAY_MS)

// «Hoy · 10:42», «Ayer, 15:20», «12 nov, 09:15»
export function whenLabel(iso, sep) {
  const d = new Date(iso)
  const n = daysAgo(iso)
  const hm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const day = n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
  return `${day}${sep}${hm}`
}
