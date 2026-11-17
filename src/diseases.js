// Catálogo de las clases que detecta el modelo: etiqueta, color, descripción y
// recomendaciones agronómicas. La API devuelve los nombres de clase del
// entrenamiento (Fondo, Tizon, Roya, Mancha_blanca) y algunos registros antiguos
// usan variantes (Fondo_y_Sana, Mancha_Blanca): todo pasa por diseaseKey().

const ALIASES = {
  Fondo: 'sano',
  Fondo_y_Sana: 'sano',
  Tizon: 'tizon',
  Roya: 'roya',
  Mancha_blanca: 'mancha',
  Mancha_Blanca: 'mancha',
}

export const DISEASES = {
  mancha: {
    key: 'mancha',
    label: 'Mancha Blanca',
    short: 'Mancha Blanca',
    color: '#8b5cf6',
    description: 'Presencia de manchas blancas en las hojas del maíz.',
  },
  tizon: {
    key: 'tizon',
    label: 'Tizón del Maíz',
    short: 'Tizón',
    color: '#f97316',
    description: 'Síntomas de tizón en las hojas del maíz.',
  },
  roya: {
    key: 'roya',
    label: 'Roya',
    short: 'Roya',
    color: '#d97706',
    description: 'Presencia de roya en las hojas del maíz.',
  },
  sano: {
    key: 'sano',
    label: 'Cultivo Sano',
    short: 'Sano',
    color: '#10b981',
    description: 'Sin síntomas de enfermedad en la muestra analizada.',
  },
}

export const diseaseKey = (cls) => ALIASES[cls] ?? null

export const diseaseMeta = (cls) => DISEASES[diseaseKey(cls)] ?? {
  key: null,
  label: cls || 'Desconocido',
  short: cls || 'Desconocido',
  color: '#94a3b8',
  description: '',
}

const RECOMMENDATIONS = {
  sano: [
    { title: 'Monitoreo periódico', body: 'Continuar con revisión del cultivo cada 7-10 días para detectar cambios tempranos.' },
    { title: 'Mantener prácticas', body: 'Sostener las prácticas óptimas de riego y fertilización actuales.' },
    { title: 'Registrar condiciones', body: 'Documentar condiciones actuales como referencia para análisis futuros.' },
  ],
  tizon: [
    { title: 'Fungicidas preventivos', body: 'Aplicar fungicidas certificados para tizón del maíz de forma preventiva.' },
    { title: 'Mejorar drenaje', body: 'Optimizar el drenaje del suelo para reducir la humedad excesiva.' },
    { title: 'Rotación de cultivos', body: 'Planificar rotación de cultivos para la próxima temporada.' },
    { title: 'Vigilar parcelas', body: 'Monitorear parcelas adyacentes para detectar posible propagación.' },
  ],
  roya: [
    { title: 'Fungicidas triazoles', body: 'Aplicar fungicidas triazoles en etapas tempranas de infección.' },
    { title: 'Ventilación', body: 'Reducir humedad relativa mejorando la ventilación entre surcos.' },
    { title: 'Mayor frecuencia', body: 'Incrementar frecuencia de monitoreo a cada 3-5 días.' },
    { title: 'Variedades resistentes', body: 'Considerar variedades resistentes a roya en próximas siembras.' },
  ],
  mancha: [
    { title: 'Fungicidas sistémicos', body: 'Aplicar tratamientos fungicidas sistémicos según recomendación técnica.' },
    { title: 'Sanidad del suelo', body: 'Mejorar la sanidad del suelo con enmiendas orgánicas adecuadas.' },
    { title: 'Riego uniforme', body: 'Evitar el estrés hídrico manteniendo riego constante y uniforme.' },
    { title: 'Eliminar residuos', body: 'Retirar residuos de cosecha que puedan actuar como focos de infección.' },
  ],
}

// Lista vacía para clases desconocidas: nunca se devuelven las de "sano" por descarte
export const recommendationsFor = (cls) => RECOMMENDATIONS[diseaseKey(cls)] ?? []
