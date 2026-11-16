// Escala única de severidad de la aplicación. El porcentaje es el área afectada:
// píxeles de la enfermedad dominante sobre el total de píxeles de la imagen.
// Los límites no provienen de una escala agronómica validada.
export const SEVERITY_LIMITS = { moderada: 5, grave: 15 }

export const SEVERITY_PALETTE = { Sano: '#16a34a', Leve: '#65a30d', Moderada: '#d97706', Grave: '#dc2626' }

export const SEVERITY_LEGEND = [
  ['Sano', 'Sano'],
  ['Leve', `Leve (<${SEVERITY_LIMITS.moderada}%)`],
  ['Moderada', `Moderada (${SEVERITY_LIMITS.moderada}–${SEVERITY_LIMITS.grave}%)`],
  ['Grave', `Grave (>${SEVERITY_LIMITS.grave}%)`],
]

export const isHealthyClass = (cls) => cls === 'Fondo' || cls === 'Fondo_y_Sana'

// Una imagen sana tiene 0 % de área afectada: el 100 % que devolvía la API era el propio fondo
export const affectedPercent = (cls, pct) => (isHealthyClass(cls) ? 0 : Number(pct) || 0)

// Valor del enum nivel_severidad de la base de datos (no incluye "sano")
export const severityKey = (pct) => (
  pct < SEVERITY_LIMITS.moderada ? 'leve' : pct <= SEVERITY_LIMITS.grave ? 'moderada' : 'grave'
)

const LABELS = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave' }

export const severityOf = (cls, pct) => (isHealthyClass(cls) ? 'Sano' : LABELS[severityKey(Number(pct) || 0)])

// Severidad global de un lote a partir de la afectación promedio de sus zonas
export const lotSeverity = (avgAff) => (avgAff > 0 ? LABELS[severityKey(avgAff)] : 'Sano')

const isHealthyRecord = (record) => record.enfermedad?.clase_idx === 0

export const affectedFromRecord = (record) => (
  isHealthyRecord(record) ? 0 : Number(record.afectacion_pct ?? 0)
)

export const severityFromRecord = (record) => (
  isHealthyRecord(record) ? 'Sano' : LABELS[record.severidad] ?? LABELS.leve
)

// Corrige las visitas de parcela guardadas cuando una zona sana contaba como 100 %
export function normalizeParcelRecord(record) {
  if (!record.samples?.length) return record
  const samples = record.samples.map((s) => (
    s.result ? { ...s, result: { ...s.result, confidence: affectedPercent(s.result.target_class, s.result.confidence) } } : s
  ))
  const done = samples.filter((s) => s.status === 'done' && s.result)
  if (!done.length) return { ...record, samples }
  const avgAff = done.reduce((a, s) => a + s.result.confidence, 0) / done.length
  return { ...record, samples, stats: { ...record.stats, avgAff: parseFloat(avgAff.toFixed(1)) } }
}
