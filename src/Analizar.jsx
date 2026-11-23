import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { predictXai, predictSegmentation, createAnalisis, apiDate } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import { useTheme } from './ThemeContext.jsx'
import { affectedFromRecord, affectedPercent, isHealthyClass, severityFromRecord, severityKey, severityOf } from './severity.js'
import { AnalysisTimingPanel, prepareUploadFile, timedRequest, timingFrom, useModelLoadTime } from './Rendimiento.jsx'
import AnalizarParcela, { BTN_PRIMARY, CheckDot, IcoArrow, IcoCloudUp, PARCEL_CARD, PARCEL_TITLE, QueAnalizarCard, StepBar } from './AnalizarParcela.jsx'
import { diseaseMeta, recommendationsFor } from './diseases.js'
import { PageGlow } from './PageHero.jsx'
import { RESULT_STYLE, resultColor, resultKeyOf, whenLabel } from './resultados.js'
import SeverityScale from './SeverityScale.jsx'
import heroDron from './Imagenes/hero-dron.webp'
import ilustracionSubir from './Imagenes/parcela-subir.png'
import inicioHojas from './Imagenes/inicio-hojas.png'

const DISEASES = {
  Fondo_y_Sana:  { label: 'Cultivo Sano',   color: '#15803d', gradFrom: '#f0fdf4', gradTo: '#dcfce7', border: '#86efac', barColor: '#22c55e' },
  Fondo:         { label: 'Cultivo Sano',   color: '#15803d', gradFrom: '#f0fdf4', gradTo: '#dcfce7', border: '#86efac', barColor: '#22c55e' },
  Tizon:         { label: 'Tizón del Maíz', color: '#c2410c', gradFrom: '#fff7ed', gradTo: '#ffedd5', border: '#fdba74', barColor: '#f97316' },
  Roya:          { label: 'Roya',           color: '#92400e', gradFrom: '#fffbeb', gradTo: '#fef3c7', border: '#fcd34d', barColor: '#f59e0b' },
  Mancha_Blanca: { label: 'Mancha Blanca',  color: '#991b1b', gradFrom: '#fef2f2', gradTo: '#fee2e2', border: '#fca5a5', barColor: '#ef4444' },
  Mancha_blanca: { label: 'Mancha Blanca',  color: '#991b1b', gradFrom: '#fef2f2', gradTo: '#fee2e2', border: '#fca5a5', barColor: '#ef4444' },
}

const DISEASE_IDS = { Fondo: 1, Fondo_y_Sana: 1, Tizon: 2, Roya: 3, Mancha_blanca: 4, Mancha_Blanca: 4 }

// ── Datos de tratamiento químico ──────────────────────────────────────────────

const _TIZON = {
  pathogen: 'Exserohilum turcicum',
  description: 'Produce lesiones necróticas alargadas de color gris-verdoso en las hojas. En condiciones de alta humedad puede unirse y causar pérdidas severas de rendimiento.',
  products: [
    { name: 'Mancozeb 80% WP', brands: 'Dithane M-45 · Manzate 200', category: 'Ditiocarbamato', type: 'Protector de contacto', dose200L: '600–800 g', dosePer1L: '3–4 g/L', frequency: 'Cada 10–14 días', color: '#f59e0b', note: 'Disolver en un balde con agua antes de agregar al tanque. No mezclar con productos alcalinos (cal, sulfato de cobre).' },
    { name: 'Propiconazol 25% EC', brands: 'Tilt 250 EC · Bumper 250 EC', category: 'Triazol', type: 'Sistémico', dose200L: '200–400 mL', dosePer1L: '1–2 mL/L', frequency: 'Cada 14–21 días', color: '#3b82f6', note: 'Penetra en el tejido vegetal y controla el hongo desde el interior. Rotar con otros grupos químicos para prevenir resistencia.' },
    { name: 'Azoxistrobin 25% SC', brands: 'Amistar 250 SC · Quadris', category: 'Estrobilurina', type: 'Sistémico + preventivo', dose200L: '200–400 mL', dosePer1L: '1–2 mL/L', frequency: 'Cada 14–21 días', color: '#8b5cf6', note: 'Excelente acción preventiva y curativa. Combinar siempre con adherente agrícola para mejorar la cobertura foliar.' },
  ],
  mix: {
    title: 'Mezcla recomendada · Tanque de 200 L',
    subtitle: 'Combinación protector + sistémico de alta efectividad',
    components: [
      { product: 'Mancozeb 80% WP (Dithane M-45)', amount: '600 g', color: '#f59e0b' },
      { product: 'Propiconazol 25% EC (Tilt 250)', amount: '300 mL', color: '#3b82f6' },
      { product: 'Adherente agrícola (Agral 90 o similar)', amount: '100–150 mL', color: '#8b5cf6' },
      { product: 'Agua limpia (pH 5.5–6.5)', amount: 'completar hasta 200 L', color: '#06b6d4' },
    ],
  },
}

const _ROYA = {
  pathogen: 'Puccinia sorghi',
  description: 'Produce pústulas café-anaranjadas en ambas caras de la hoja. Las esporas se dispersan fácilmente por el viento, favoreciendo una propagación rápida entre parcelas.',
  products: [
    { name: 'Tebuconazol 25% EW', brands: 'Folicur 250 EW · Orius 25 EW', category: 'Triazol', type: 'Sistémico', dose200L: '400–600 mL', dosePer1L: '2–3 mL/L', frequency: 'Cada 14–21 días', color: '#f59e0b', note: 'Aplicar desde los primeros síntomas. Muy efectivo contra royas. Respetar período de carencia de 28 días antes de cosecha.' },
    { name: 'Azoxistrobin + Ciproconazol', brands: 'Amistar Top · Priori Xtra', category: 'Estrobilurina + Triazol', type: 'Sistémico', dose200L: '400–600 mL', dosePer1L: '2–3 mL/L', frequency: 'Cada 21 días', color: '#3b82f6', note: 'Combina dos mecanismos de acción. Recomendado cuando la infección ya está establecida y se requiere control rápido.' },
    { name: 'Propiconazol 25% EC', brands: 'Tilt 250 EC · Bumper 250 EC', category: 'Triazol', type: 'Sistémico', dose200L: '300–400 mL', dosePer1L: '1.5–2 mL/L', frequency: 'Cada 14–21 días', color: '#8b5cf6', note: 'Alternativa económica de amplia disponibilidad. Rotar con estrobilurinas para mayor efectividad a largo plazo.' },
  ],
  mix: {
    title: 'Mezcla recomendada · Tanque de 200 L',
    subtitle: 'Triazol de alta eficacia para control de roya',
    components: [
      { product: 'Tebuconazol 25% EW (Folicur 250)', amount: '500 mL', color: '#f59e0b' },
      { product: 'Adherente agrícola (Agral 90 o similar)', amount: '100–150 mL', color: '#8b5cf6' },
      { product: 'Agua limpia (pH 5.5–6.5)', amount: 'completar hasta 200 L', color: '#06b6d4' },
    ],
  },
}

const _MANCHA = {
  pathogen: 'Phyllachora maydis',
  description: 'Produce manchas blancas o plateadas circulares en las hojas del maíz. Afecta la fotosíntesis progresivamente y puede reducir el rendimiento hasta un 40% en infecciones severas.',
  products: [
    { name: 'Clorotalonil 72% SC', brands: 'Bravo 720 SC · Daconil 720', category: 'Organoclorado', type: 'Protector de contacto', dose200L: '400–600 mL', dosePer1L: '2–3 mL/L', frequency: 'Cada 7–10 días', color: '#f59e0b', note: 'Uno de los más efectivos contra mancha blanca. Acción multisitio que reduce el riesgo de resistencia. No mezclar con aceites.' },
    { name: 'Mancozeb 80% WP', brands: 'Dithane M-45 · Manzate 200', category: 'Ditiocarbamato', type: 'Protector de contacto', dose200L: '600–800 g', dosePer1L: '3–4 g/L', frequency: 'Cada 10–14 días', color: '#3b82f6', note: 'Alternativa económica de buena cobertura. Disolver previamente en un balde con agua antes de incorporar al tanque.' },
    { name: 'Azoxistrobin 25% SC', brands: 'Amistar 250 SC · Quadris', category: 'Estrobilurina', type: 'Sistémico', dose200L: '200–400 mL', dosePer1L: '1–2 mL/L', frequency: 'Cada 14–21 días', color: '#8b5cf6', note: 'Complementa la acción del Clorotalonil. Usar en mezcla para ampliar el espectro de control en infecciones moderadas a graves.' },
  ],
  mix: {
    title: 'Mezcla recomendada · Tanque de 200 L',
    subtitle: 'Protector + sistémico de alta cobertura',
    components: [
      { product: 'Clorotalonil 72% SC (Bravo 720)', amount: '500 mL', color: '#f59e0b' },
      { product: 'Azoxistrobin 25% SC (Amistar 250)', amount: '200 mL', color: '#3b82f6' },
      { product: 'Adherente agrícola (Agral 90 o similar)', amount: '100–150 mL', color: '#8b5cf6' },
      { product: 'Agua limpia (pH 5.5–6.5)', amount: 'completar hasta 200 L', color: '#06b6d4' },
    ],
  },
}

export const CHEMICAL_TREATMENTS = {
  Tizon: _TIZON, Roya: _ROYA,
  Mancha_Blanca: _MANCHA, Mancha_blanca: _MANCHA,
}

const MIXING_STEPS = [
  { num: 1, icon: '💧', title: 'Verificar la calidad del agua', desc: 'Use agua limpia y libre de sedimentos. Mida el pH con papel indicador (rango ideal 5.5–6.5). Si el pH es mayor a 7 (agua alcalina), agregue corrector de pH o vinagre hasta alcanzar el rango correcto. El agua dura reduce la eficacia de los fungicidas.' },
  { num: 2, icon: '🪣', title: 'Llenar el tanque a la mitad', desc: 'Vierta 100 litros de agua en el tanque (la mitad del volumen total). Active el agitador mecánico si dispone de uno. Nunca agregue el producto concentrado primero y luego el agua —esto genera zonas de alta concentración que pueden dañar las plantas y el equipo.' },
  { num: 3, icon: '🧪', title: 'Agregar productos en polvo', desc: 'Disuelva primero los productos en polvo (ej. Mancozeb, Clorotalonil WP) en un balde aparte con agua, formando una pasta homogénea. Luego vierta la pasta lentamente en el tanque mientras agita constantemente para evitar grumos y garantizar una mezcla uniforme.' },
  { num: 4, icon: '🔬', title: 'Agregar productos líquidos', desc: 'Mida con exactitud los productos líquidos (ej. Propiconazol, Tebuconazol) usando un recipiente graduado. Vierta lentamente por la pared del tanque mientras agita. Orden correcto: sistémicos primero, luego protectores de contacto. Esto evita reacciones químicas indeseadas.' },
  { num: 5, icon: '🧴', title: 'Agregar el adherente', desc: 'Incorpore el adherente/surfactante agrícola (Agral 90 u otro) al final para evitar exceso de espuma durante la mezcla. El adherente mejora la retención del producto en las hojas y la resistencia al lavado por lluvia, aumentando la eficacia de la aplicación.' },
  { num: 6, icon: '🚰', title: 'Completar el volumen a 200 L', desc: 'Agregue agua hasta la marca de 200 litros. Agite vigorosamente durante 2–3 minutos hasta obtener una mezcla completamente homogénea sin grumos ni separación de fases. La mezcla debe tener un color y consistencia uniformes en todo el tanque.' },
  { num: 7, icon: '✅', title: 'Verificación final y uso inmediato', desc: 'La mezcla debe verse uniforme y sin separación. Prepare solo la cantidad necesaria para el mismo día —nunca almacene la mezcla preparada. Los productos pierden efectividad y los residuos almacenados pueden generar compuestos peligrosos o taponar el equipo.' },
]

const FUMIGATION_STEPS = [
  { num: 1, icon: '🦺', title: 'Equipos de protección personal (EPP)', desc: 'OBLIGATORIO: guantes de nitrilo o neopreno, mascarilla con filtros para vapores orgánicos (tipo 3M 6200 + P100), lentes de seguridad herméticos, overol impermeable de manga larga y botas de caucho. Nunca aplique sin EPP completo — los fungicidas son absorbidos por la piel.', alert: true },
  { num: 2, icon: '🕐', title: 'Seleccionar el horario correcto', desc: 'Aplique entre las 6:00–9:00 AM o las 16:00–18:30 PM. Evite las horas de mayor calor (10 AM–3 PM): las altas temperaturas aumentan la volatilización del producto, reducen su efectividad y aumentan el riesgo de quemaduras en las hojas del cultivo.' },
  { num: 3, icon: '🌤️', title: 'Condiciones climáticas adecuadas', desc: 'No aplique si: el viento supera 15 km/h (las hojas se agitan visiblemente), hay lluvia presente, o se pronostica lluvia en las próximas 4 horas. Condiciones ideales: temperatura 15–28°C, humedad relativa mayor al 50% (mejora la absorción foliar), cielo parcialmente nublado.' },
  { num: 4, icon: '🔧', title: 'Calibrar el equipo de aspersión', desc: 'Verifique que la bomba funcione correctamente y que las boquillas estén limpias y sin desgaste. Para bombas de mochila: presión de 2–3 bar. Use boquillas de abanico plano de 110° para mayor cobertura uniforme. Calcule la descarga: 200–400 L/ha según el tamaño del cultivo.' },
  { num: 5, icon: '🌽', title: 'Técnica correcta de aplicación', desc: 'Camine en hileras alternas a favor del viento para evitar inhalar el producto. Cubra ambas caras de la hoja (haz y envés), donde se concentran las esporas del hongo. Mantenga la boquilla a 30–40 cm de la planta. No aplique en el mismo surco dos veces para evitar sobredosificación.' },
  { num: 6, icon: '📐', title: 'Volumen de mezcla por área', desc: 'Plantas pequeñas hasta 80 cm: aplicar 200 L/ha. Plantas medianas de 80 a 150 cm: 300 L/ha. Plantas grandes mayores a 150 cm: 400 L/ha. Con una mochila de 20 litros necesitará entre 10 y 20 cargas por hectárea. Calcule antes de mezclar para no generar sobrantes.' },
  { num: 7, icon: '🚿', title: 'Limpieza posterior al uso', desc: 'Lave el equipo con agua y detergente inmediatamente al terminar —nunca deje residuos secar dentro de la bomba ya que pueden tapar las boquillas. Báñese con abundante agua y jabón. Lave la ropa de trabajo por separado. Perfore y almacene los envases vacíos lejos de fuentes de agua.' },
  { num: 8, icon: '📋', title: 'Registrar cada aplicación', desc: 'Anote: fecha y hora, producto y dosis utilizada, área tratada en hectáreas, condiciones climáticas y persona responsable. Consulte la etiqueta para el período de carencia antes de la cosecha (Mancozeb: 7 días, Propiconazol: 14 días, Tebuconazol: 28 días, Clorotalonil: 7 días).' },
]

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

const mapAnalysisResponse = (record) => {
  const confidence = affectedFromRecord(record)
  const diseaseName = record.enfermedad?.nombre ?? 'Desconocido'
  return {
    id: record.id,
    fecha: apiDate(record.fecha),
    imagen: record.imagen_url,
    enfermedad: diseaseName,
    enfermedadLabel: DISEASES[diseaseName]?.label ?? diseaseName,
    confianza: confidence / 100,
    severidad: severityFromRecord(record),
    cultivo: 'Maíz',
    recomendaciones: recommendationsFor(record.enfermedad?.nombre).map(r => r.body).join(' '),
    xaiImage: record.grad_cam_url,
    resultadoImage: record.resultado_url,
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
      const t = Math.min(Math.max((now - start) / duration, 0), 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setCount(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active])
  return count
}

// ── Máscara de clases del modelo (mismo orden/paleta que model.py::PALETTE) ────
const MASK_PALETTE_RGB = [
  [0, 0, 0],     // Fondo_y_Sana
  [255, 0, 0],   // Tizon
  [0, 255, 0],   // Roya
  [0, 0, 255],   // Mancha_Blanca
]

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [239, 68, 68]
}

// ── Imagen anotada: original + área afectada pintada + caja + etiqueta ───────
// Pinta en `canvas` (outW × outH) la imagen original con el área de la clase detectada
// resaltada, su caja y la etiqueta. Devuelve false si la máscara no contiene esa clase
// (el lienzo queda entonces solo con la imagen original).
function paintAnnotation(canvas, origImg, maskImg, { targetClassId, label, confidence, highlightColor, outW, outH }) {
  const mW = maskImg.naturalWidth
  const mH = maskImg.naturalHeight
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = mW
  maskCanvas.height = mH
  const maskCtx = maskCanvas.getContext('2d')
  maskCtx.drawImage(maskImg, 0, 0)
  const maskData = maskCtx.getImageData(0, 0, mW, mH)

  const [tr, tg, tb] = MASK_PALETTE_RGB[targetClassId] ?? [255, 0, 0]
  const [hr, hg, hb] = hexToRgb(highlightColor)
  const highlight = maskCtx.createImageData(mW, mH)
  let minX = mW, minY = mH, maxX = 0, maxY = 0, found = false

  for (let y = 0; y < mH; y++) {
    for (let x = 0; x < mW; x++) {
      const i = (y * mW + x) * 4
      if (maskData.data[i] === tr && maskData.data[i + 1] === tg && maskData.data[i + 2] === tb) {
        highlight.data[i] = hr; highlight.data[i + 1] = hg; highlight.data[i + 2] = hb; highlight.data[i + 3] = 150
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        found = true
      }
    }
  }

  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(origImg, 0, 0, outW, outH)
  if (!found) return false

  maskCtx.putImageData(highlight, 0, 0)
  // Sin suavizado: evita que manchas pequeñas y separadas (roya, mancha blanca)
  // se difuminen entre sí al escalar la máscara 768x768 al tamaño de salida.
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(maskCanvas, 0, 0, outW, outH)
  ctx.imageSmoothingEnabled = true

  const scaleX = outW / mW
  const scaleY = outH / mH
  const bx = minX * scaleX, by = minY * scaleY
  const bw = Math.max((maxX - minX) * scaleX, 1)
  const bh = Math.max((maxY - minY) * scaleY, 1)

  ctx.strokeStyle = highlightColor
  ctx.lineWidth = Math.max(2, outW * 0.004)
  ctx.strokeRect(bx, by, bw, bh)

  const labelText = `${label} ${Math.round(confidence)}%`
  const fontSize = Math.max(16, Math.round(outW * 0.024))
  ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`
  const paddingX = fontSize * 0.6
  const textW = ctx.measureText(labelText).width
  const badgeW = textW + paddingX * 2
  const badgeH = fontSize * 1.8
  let badgeX = bx
  let badgeY = by - badgeH - 4
  if (badgeY < 0) badgeY = by + 4
  if (badgeX + badgeW > outW) badgeX = outW - badgeW - 4
  if (badgeX < 0) badgeX = 0

  ctx.fillStyle = highlightColor
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH)
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(labelText, badgeX + paddingX, badgeY + badgeH / 2)
  return true
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
  img.src = src
})

// Imagen de salida que se guarda con el análisis (JPEG, lado mayor ≤ maxSide) para mostrarla
// después en Inicio. null si no hay máscara o la máscara no contiene la clase detectada.
async function annotatedImageDataUrl({ originalSrc, maskBase64, maxSide = 900, quality = 0.82, ...opts }) {
  if (!originalSrc || !maskBase64 || opts.targetClassId === null || opts.targetClassId === undefined) return null
  const [origImg, maskImg] = await Promise.all([loadImage(originalSrc), loadImage(`data:image/png;base64,${maskBase64}`)])
  const scale = Math.min(1, maxSide / Math.max(origImg.naturalWidth, origImg.naturalHeight))
  const canvas = document.createElement('canvas')
  const found = paintAnnotation(canvas, origImg, maskImg, {
    ...opts,
    outW: Math.round(origImg.naturalWidth * scale),
    outH: Math.round(origImg.naturalHeight * scale),
  })
  return found ? canvas.toDataURL('image/jpeg', quality) : null
}

function AnnotatedResultImage({ originalSrc, maskBase64, targetClassId, label, confidence, highlightColor }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!originalSrc || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current

    const drawPlain = (img) => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
    }

    const origImg = new Image()
    origImg.onload = () => {
      if (cancelled) return
      if (!maskBase64 || targetClassId === null || targetClassId === undefined) {
        drawPlain(origImg)
        return
      }

      const maskImg = new Image()
      maskImg.onload = () => {
        if (cancelled) return
        paintAnnotation(canvas, origImg, maskImg, {
          targetClassId, label, confidence, highlightColor,
          outW: origImg.naturalWidth, outH: origImg.naturalHeight,
        })
      }
      maskImg.onerror = () => drawPlain(origImg)
      maskImg.src = `data:image/png;base64,${maskBase64}`
    }
    origImg.src = originalSrc

    return () => { cancelled = true }
  }, [originalSrc, maskBase64, targetClassId, label, confidence, highlightColor])

  return <canvas ref={canvasRef} className="w-full h-full object-contain" />
}

// ── Zona de carga: ilustración, hojas decorativas y ventajas ─────────────────
// ── Análisis individual (diseño de la maqueta del usuario) ────────────────────
// Antes de analizar: banner, pasos, zona de carga con vista previa tipo escáner y tarjetas de
// apoyo. Al terminar: imagen original y máscara de segmentación, diagnóstico con la confianza del
// modelo, mapa de calor Grad-CAM, recomendaciones e historial relacionado. Todo con datos reales
// de la API; medidas a la escala en que el usuario ve sus maquetas (~0,68).
const INDIVIDUAL_STEPS = ['Subir imagen', 'Procesar análisis', 'Ver resultados']
const PROCESS_STEPS = [
  'Preparando la imagen',
  'Detectando enfermedades (segmentación y Grad-CAM)',
  'Calculando el área afectada y la severidad',
  'Guardando en tu historial',
]
const HERO_BULLETS = ['Diagnóstico en segundos', 'Detección y mapa de calor', 'Se guarda en tu historial']
const PHOTO_TIPS = [
  'Una sola hoja de maíz que ocupe casi toda la foto',
  'Luz natural pareja, sin sombras fuertes ni flash',
  'Imagen nítida: acércate hasta ver bien las manchas',
  'Fondo despejado, sin otras plantas delante de la hoja',
]
// Escala TURBO de OpenCV (la que usa el backend para el Grad-CAM), de mayor a menor atención
export const TURBO = 'linear-gradient(to bottom, #7a0403, #e5470b, #faba39, #a4fc3c, #1ae4b6, #4685fa, #30123b)'
const MUTED = 'text-[#55656f] dark:text-slate-400'
const ICON_BADGE = 'grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e3f4e9] text-[#0b8a4b] dark:bg-emerald-400/15 dark:text-emerald-300 [&>svg]:h-4 [&>svg]:w-4'
const BTN_SOFT = 'inline-flex items-center justify-center gap-1.5 rounded-full border border-[#dfe7e2] bg-white font-semibold text-[#334155] transition hover:border-[#bfe3c9] hover:bg-[#f6fbf7] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 [&>svg]:h-3.5 [&>svg]:w-3.5'
const BTN_DARK = 'flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#0f6b46] text-[12px] font-semibold text-white shadow-[0_8px_16px_-10px_rgba(15,107,70,0.9)] transition hover:bg-[#0c5c3c] dark:bg-emerald-600 dark:hover:bg-emerald-500'

// Colores de las tarjetas pequeñas del diagnóstico (texto con contraste ≥ 4.5:1)
const TONES = {
  base:     { card: 'border-[#dcefe3] bg-white/80 dark:border-white/10 dark:bg-white/[0.04]', icon: 'bg-[#e0f3e7] text-[#0b8a4b] dark:bg-emerald-400/15 dark:text-emerald-300', value: 'text-[#0b1226] dark:text-white' },
  Sano:     { card: 'border-[#d3eedd] bg-[#f0faf3] dark:border-white/10 dark:bg-white/[0.04]', icon: 'bg-[#d6efdf] text-[#0b6b35] dark:bg-emerald-400/15 dark:text-emerald-300', value: 'text-[#0b6b35] dark:text-emerald-300' },
  Leve:     { card: 'border-[#e2efcf] bg-[#f6fbef] dark:border-white/10 dark:bg-white/[0.04]', icon: 'bg-[#e6f4d2] text-[#4d7c0f] dark:bg-lime-400/15 dark:text-lime-300', value: 'text-[#4d7c0f] dark:text-lime-300' },
  Moderada: { card: 'border-[#f5e2bf] bg-[#fdf7ec] dark:border-white/10 dark:bg-white/[0.04]', icon: 'bg-[#fbe9c4] text-[#b45309] dark:bg-amber-400/15 dark:text-amber-300', value: 'text-[#b45309] dark:text-amber-300' },
  Grave:    { card: 'border-[#f6d5d5] bg-[#fdf1f1] dark:border-white/10 dark:bg-white/[0.04]', icon: 'bg-[#fbdcdc] text-[#c81e1e] dark:bg-red-400/15 dark:text-red-300', value: 'text-[#c81e1e] dark:text-red-300' },
}

const fechaHora = (iso) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = '', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>{children}</svg>
)
const IcoLeaf = ({ className }) => <Svg className={className}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/></Svg>
const IcoImage = ({ className }) => <Svg className={className}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m21 16-5-5-9 9"/></Svg>
const IcoChevronRight = ({ className }) => <Svg className={className} sw={2.4}><path d="m9 6 6 6-6 6"/></Svg>
const IcoTrendUp = ({ className }) => <Svg className={className} sw={2.2}><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></Svg>
const IcoBars = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`shrink-0 ${className}`}>
    <rect x="4" y="12" width="3.6" height="8" rx="1"/><rect x="10.2" y="8" width="3.6" height="12" rx="1"/><rect x="16.4" y="4" width="3.6" height="16" rx="1"/>
  </svg>
)
const IcoPlant = ({ className }) => <Svg className={className}><path d="M12 21v-8"/><path d="M12 13c0-4.5-3-7-8-7 0 4.5 3 7 8 7Z"/><path d="M12 15c0-4 2.6-6.5 8-6.5 0 4-2.6 6.5-8 6.5Z"/></Svg>
const IcoTarget = ({ className }) => <Svg className={className}><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></Svg>
const IcoBulb = ({ className }) => <Svg className={className}><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V17h5v-1.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"/></Svg>
const IcoClock = ({ className }) => <Svg className={className} sw={2.2}><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 7.5V12l3 2"/></Svg>
const IcoPdf = ({ className }) => <Svg className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M12 18v-6M9.5 15.5 12 18l2.5-2.5"/></Svg>
const IcoPlus = ({ className }) => <Svg className={className} sw={2.4}><path d="M12 5v14M5 12h14"/></Svg>
const IcoCamera = ({ className }) => <Svg className={className}><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></Svg>
const IcoShield = ({ className }) => <Svg className={className}><path d="M12 3 19 6v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6l7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/></Svg>
const IcoFlask = ({ className }) => <Svg className={className}><path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/></Svg>
const IcoBeaker = ({ className }) => <Svg className={className}><path d="M5 3h14M6 3v15a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V3"/><path d="M6 12h12"/></Svg>
const IcoSpray = ({ className }) => <Svg className={className}><path d="M9 9h6v12H9z"/><path d="M10 9V6h4v3M14 6h2l2-2M18 8h2M18 11h2M17 14h2"/></Svg>
const IcoZoom = ({ className }) => <Svg className={className} sw={2.2}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5"/></Svg>
const IcoClose = ({ className }) => <Svg className={className} sw={2.4}><path d="M18 6 6 18M6 6l12 12"/></Svg>
const IcoScan = ({ className }) => <Svg className={className}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></Svg>

function CheckCircle() {
  return (
    <span aria-hidden="true" className="mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#16a34a] text-white dark:bg-emerald-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </span>
  )
}
const Spinner = ({ className = 'h-4 w-4' }) => (
  <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}/>
)

// ── Antes de analizar ─────────────────────────────────────────────────────────
function IndividualHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10">
      <img src={heroDron} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-left dark:brightness-[0.45]"/>
      <div className="absolute inset-0 bg-linear-to-r from-white/80 via-white/55 to-white/10 lg:hidden dark:hidden"/>
      <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block"/>
      <div className="relative flex items-start gap-4 px-4 pb-4 pt-5 sm:pl-[18px] sm:pr-6">
        <span className="hidden h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-linear-to-b from-[#13a35c] to-[#03823f] text-white shadow-[0_8px_18px_-8px_rgba(3,130,63,0.8)] sm:grid">
          <IcoLeaf className="h-7 w-7"/>
        </span>
        <div className="min-w-0">
          <h2 className="text-[23px] font-extrabold leading-tight text-[#0b1226] dark:text-white">
            Analiza <span className="text-[#0b8a4b] dark:text-emerald-400">tu cultivo</span> individual
          </h2>
          <p className="mt-1 text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-300">Detecta enfermedades en tus hojas con el poder de la IA.</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {HERO_BULLETS.map((t) => (
              <li key={t} className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#1d2640] dark:text-slate-200"><CheckDot/>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

// Esquinas de visor sobre la vista previa
function ScanCorners() {
  const corners = ['left-0 top-0 rounded-tl-lg border-l-2 border-t-2', 'right-0 top-0 rounded-tr-lg border-r-2 border-t-2', 'bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2', 'bottom-0 right-0 rounded-br-lg border-b-2 border-r-2']
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 bottom-[46px] top-3">
      {corners.map((c) => <span key={c} className={`absolute h-6 w-6 border-emerald-300/90 ${c}`}/>)}
    </span>
  )
}

// Rejilla y línea de escaneo mientras el modelo trabaja (sin animación si se pide menos movimiento)
function ScanOverlay() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{'@keyframes agro-scan{0%{transform:translateY(-100%)}100%{transform:translateY(400%)}}'}</style>
      <span
        className="absolute inset-0 bg-emerald-950/25"
        style={{ backgroundImage: 'linear-gradient(rgba(52,211,153,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,.16) 1px, transparent 1px)', backgroundSize: '26px 26px' }}
      />
      <span className="absolute inset-x-0 top-0 h-1/4 bg-linear-to-b from-transparent to-emerald-300/30 motion-safe:animate-[agro-scan_2.2s_linear_infinite]">
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-300 shadow-[0_0_14px_3px_rgba(52,211,153,0.7)]"/>
      </span>
    </span>
  )
}

function UploadPanel({ file, preview, sizeLabel, dragging, loading, error, onPick, onAnalyze, dropProps }) {
  return (
    <section className={`${PARCEL_CARD} p-2.5`} {...dropProps}>
      {!preview ? (
        <div
          onClick={onPick}
          className={`relative flex h-full min-h-[262px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[12px] border-2 border-dashed px-6 py-5 text-center transition ${
            dragging
              ? 'border-[#0b8a4b] bg-[#e9f6ee] dark:border-emerald-400 dark:bg-emerald-400/10'
              : 'border-[#c6e8d2] bg-linear-to-b from-[#fbfdfc] to-[#f0f8f2] hover:border-[#8fd0a6] dark:border-emerald-400/20 dark:from-white/[0.02] dark:to-emerald-400/[0.05]'
          }`}
        >
          <img src={ilustracionSubir} alt="" aria-hidden="true" draggable="false" className="h-[66px] w-auto select-none"/>
          <h3 className={`mt-2 text-[16.5px] ${PARCEL_TITLE}`}>{dragging ? '¡Suelta la imagen aquí!' : 'Arrastra tu imagen aquí'}</h3>
          <p className="mt-0.5 text-[11.5px] text-[#4b556c] dark:text-slate-400">o selecciónala desde tu dispositivo</p>
          <button type="button" onClick={(e) => { e.stopPropagation(); onPick() }} className={`${BTN_PRIMARY} mt-4 h-[34px] px-6 text-[12px]`}>
            <IcoCloudUp/>
            Seleccionar imagen
            <IcoArrow/>
          </button>
          <p className="mt-3 text-[9.5px] text-[#64748b] dark:text-slate-500">JPG, PNG o WEBP · hasta 20 MB · una hoja de maíz por foto</p>
          {error && <p role="alert" className="mt-2 text-[11px] font-semibold text-red-600 dark:text-red-300">{error}</p>}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="relative h-[250px] overflow-hidden rounded-[12px] bg-[#0f1a14] sm:h-[290px]">
            <img src={preview} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-50 blur-xl"/>
            <img src={preview} alt="Vista previa de la imagen elegida" className={`relative h-full w-full object-contain transition-opacity ${loading ? 'opacity-80' : ''}`}/>
            <ScanCorners/>
            {loading && <ScanOverlay/>}
            {dragging && !loading && (
              <span className="absolute inset-0 grid place-items-center bg-emerald-950/60 text-[13px] font-semibold text-white">Suelta para cambiar la imagen</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-black/75 to-transparent px-3 pb-2.5 pt-6">
              <IcoImage className="h-4 w-4 text-white/80"/>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/90" title={file?.name}>{file?.name}</span>
              <span className="text-[10.5px] text-white/70">{sizeLabel}</span>
              {!loading && (
                <button type="button" onClick={onPick} className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10.5px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/25">
                  Cambiar imagen
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-1.5 pb-0.5 pt-3">
            <p className="min-w-0 flex-1 text-[11px]" aria-live="polite">
              {error ? (
                <span role="alert" className="font-semibold text-red-600 dark:text-red-300">{error}</span>
              ) : loading ? (
                <span className="font-semibold text-[#0b6b35] dark:text-emerald-300">Analizando la imagen…</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#0b6b35] dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-[#0b8a4b] dark:bg-emerald-400"/>Lista para analizar</span>
              )}
            </p>
            <button type="button" onClick={onAnalyze} disabled={loading} className={`${BTN_PRIMARY} h-[34px] px-6 text-[12px]`}>
              {loading ? <><Spinner className="h-3.5 w-3.5"/>Analizando…</> : <><IcoScan className="h-4 w-4"/>{error ? 'Reintentar' : 'Analizar imagen'}<IcoArrow/></>}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function PhotoTipsCard() {
  return (
    <section className={`relative overflow-hidden ${PARCEL_CARD} px-4 pb-4 pt-3`}>
      <img src={inicioHojas} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[56px] w-auto select-none dark:opacity-10"/>
      <h3 className={`relative flex items-center gap-2.5 text-[13.5px] ${PARCEL_TITLE}`}>
        <span className={ICON_BADGE}><IcoCamera/></span>
        Consejos para una buena foto
      </h3>
      <ul className="relative mt-3 space-y-2.5">
        {PHOTO_TIPS.map((t) => (
          <li key={t} className="flex items-start gap-2 text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-300"><span className="mt-px"><CheckDot/></span>{t}</li>
        ))}
      </ul>
      <p className="relative mt-3.5 max-w-[85%] rounded-lg bg-[#f3faf6] px-3 py-2 text-[10.5px] leading-snug text-[#33584a] dark:bg-white/[0.04] dark:text-slate-300">
        El modelo analiza la foto a 384 × 384 píxeles: encuadra bien la hoja para que se vea clara a ese tamaño.
      </p>
    </section>
  )
}

function ProcessingCard({ step }) {
  return (
    <section className={`${PARCEL_CARD} px-4 pb-4 pt-3.5`} aria-live="polite">
      <header className="flex items-center gap-3">
        <span className="relative h-9 w-9 shrink-0">
          <span className="absolute inset-0 rounded-full border-[3px] border-[#e3f1e8] dark:border-white/10"/>
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#0b8a4b] dark:border-t-emerald-400"/>
        </span>
        <div className="min-w-0">
          <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>Procesando con inteligencia artificial</h3>
          <p className={`text-[11px] ${MUTED}`}>Segmentación semántica y mapa de calor Grad-CAM</p>
        </div>
      </header>
      <ol className="mt-3.5 space-y-2">
        {PROCESS_STEPS.map((label, i) => {
          const done = i < step
          const active = i === step
          return (
            <li key={label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${active ? 'border-[#bfe3c9] bg-[#f1faf4] dark:border-emerald-400/30 dark:bg-emerald-400/10' : 'border-transparent'}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${done ? 'bg-[#0b8a4b] text-white dark:bg-emerald-500' : active ? 'bg-[#d6efdf] dark:bg-emerald-400/20' : 'bg-slate-100 dark:bg-white/10'}`}>
                {done ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
                ) : active ? (
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#0b8a4b] dark:bg-emerald-400"/>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-white/30"/>
                )}
              </span>
              <span className={`min-w-0 flex-1 text-[12px] font-medium ${done ? MUTED : active ? 'text-[#0b6b35] dark:text-emerald-300' : 'text-[#64748b] dark:text-slate-500'}`}>{label}</span>
              {active && <span className="rounded-full bg-[#e5f6ee] px-2 py-0.5 text-[10px] font-semibold text-[#0a6332] dark:bg-emerald-400/10 dark:text-emerald-300">En curso</span>}
              {done && <span className={`text-[10px] ${MUTED}`}>Listo</span>}
            </li>
          )
        })}
      </ol>
      <p className={`mt-3 text-[10px] ${MUTED}`}>Suele tardar unos segundos; la primera vez del día puede demorar más mientras el servidor se activa.</p>
    </section>
  )
}

function RecentAnalyses({ history, onGoHistorial }) {
  const items = [...history].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 4)
  return (
    <section className={`${PARCEL_CARD} px-3 pb-3 pt-1.5`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 py-1.5">
        <span className="text-[#0b8a4b] dark:text-emerald-400"><IcoClock className="h-[18px] w-[18px]"/></span>
        <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>Tus últimos análisis</h3>
        {onGoHistorial && items.length > 0 && (
          <button type="button" onClick={() => onGoHistorial('individual')} className="ml-auto inline-flex items-center gap-1.5 rounded-md text-[10.5px] font-semibold text-[#0b6b35] transition hover:text-[#02894b] hover:underline dark:text-emerald-400">
            Ver historial completo
            <IcoArrow/>
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <p className={`px-1 pb-2 pt-1 text-[11.5px] ${MUTED}`}>Aún no tienes análisis individuales. Sube tu primera foto para empezar.</p>
      ) : (
        <div className="mt-1 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((h) => {
            const key = resultKeyOf(h.enfermedad, h.estado === 'Sano')
            const st = RESULT_STYLE[key] ?? RESULT_STYLE.otro
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onGoHistorial?.('individual')}
                aria-label={`${st.short}, ${whenLabel(h.fecha, ' a las ')}: ver en el historial`}
                className="flex items-center gap-3 rounded-xl border border-[#e9eef1] bg-linear-to-br from-white to-[#f5faf6] p-2 text-left shadow-[0_4px_14px_-12px_rgba(15,40,30,0.4)] transition hover:border-[#bfe3c9] hover:shadow-md dark:border-white/10 dark:from-white/[0.03] dark:to-emerald-400/[0.04] dark:hover:border-emerald-400/30"
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#e3f2e6] dark:bg-white/5">
                  {(h.resultadoImage || h.imagen) && <img src={h.resultadoImage || h.imagen} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }}/>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`inline-flex h-[19px] max-w-full items-center gap-1 rounded-full px-2 text-[9.5px] font-semibold ${st.chip}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.icon}`}/>
                    <span className="truncate">{st.short}</span>
                  </span>
                  <span className={`mt-1 block truncate text-[10.5px] ${MUTED}`}>{whenLabel(h.fecha, ', ')}</span>
                  {key !== 'sano' && <span className="block text-[10.5px] font-semibold text-[#1d2640] dark:text-slate-200">{Number(h.affectedPercent ?? 0).toFixed(1)} % afectado</span>}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Resultado ─────────────────────────────────────────────────────────────────
// Ampliación de una imagen: un clic la abre a pantalla completa; otro clic (o Escape) la cierra y
// el foco vuelve a la imagen pequeña
export function ZoomOverlay({ label, onClose, children }) {
  const closeRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const previous = document.activeElement
    // En fase de captura y sin propagarse: si la imagen está dentro de otro diálogo (detalle del
    // historial), Escape cierra solo la ampliación
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${label} ampliada`}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-[#020a06]/85 px-3 pb-14 pt-14 backdrop-blur-sm sm:px-8"
    >
      <style>{'@keyframes agro-zoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}'}</style>
      <div className="relative h-full w-full max-w-[1400px] motion-safe:animate-[agro-zoom_.18s_ease-out]">{children}</div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Cerrar la imagen ampliada"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5"
      >
        <IcoClose className="h-4 w-4"/>
      </button>
      <p className="pointer-events-none absolute bottom-3 left-1/2 max-w-[90vw] -translate-x-1/2 truncate rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
        {label} · haz clic para volver
      </p>
    </div>,
    document.body,
  )
}

// Zona de imagen que se amplía al hacer clic
export function ZoomTrigger({ label, onOpen, children }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ampliar: ${label}`}
      title="Clic para ampliar"
      className="group absolute inset-0 block cursor-zoom-in overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
    >
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white opacity-80 backdrop-blur-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <IcoZoom className="h-3.5 w-3.5"/>
        Ampliar
      </span>
    </button>
  )
}

export function FittedImage({ src, alt }) {
  return (
    <>
      <img src={src} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-50 blur-lg"/>
      <img src={src} alt={alt} className="relative h-full w-full object-contain"/>
    </>
  )
}

function ImagePanel({ icon, label, children }) {
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-[#e9eef1] bg-[#f7f9fa] dark:border-white/10 dark:bg-white/[0.03]">
      <figcaption className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-[#1d2640] dark:text-slate-200">
        <span className="text-[#0b6b35] dark:text-emerald-300">{icon}</span>
        <span className="truncate">{label}</span>
      </figcaption>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0f1a14]">{children}</div>
    </figure>
  )
}

function ResultImagesCard({ preview, maskBase64, result, isHealthy, disease, exporting, onExport, onNew }) {
  const [zoom, setZoom] = useState(null)   // 'original' | 'deteccion' | null
  const label = disease?.label ?? result.target_class
  const color = disease?.barColor ?? '#ef4444'
  const area = Number(result.confidence ?? 0)
  const conDeteccion = !isHealthy && !!maskBase64
  // Imagen de salida del modelo: original + zona afectada en color + caja + etiqueta
  const deteccion = (
    <AnnotatedResultImage
      originalSrc={preview}
      maskBase64={maskBase64}
      targetClassId={Number(result.target_class_id)}
      label={label}
      confidence={result.model_confidence ?? result.confidence}
      highlightColor={color}
    />
  )
  const chip = (texto) => (
    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#0b6b35] shadow-md backdrop-blur-sm dark:bg-[#0f1a2b]/90 dark:text-emerald-300">{texto}</span>
  )
  return (
    <section className={`${PARCEL_CARD} flex min-w-0 flex-col px-3.5 pb-3 pt-3`}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span className={ICON_BADGE}><IcoLeaf/></span>
        <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Resultado del análisis</h3>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={onExport} disabled={exporting} className={`${BTN_SOFT} h-7 px-3 text-[11px]`}>
            <IcoPdf/>
            {exporting ? 'Generando…' : 'Exportar PDF'}
          </button>
          <button type="button" onClick={onNew} className={`${BTN_SOFT} h-7 px-3 text-[11px]`}>
            <IcoPlus/>
            Analizar otra imagen
          </button>
        </div>
      </header>
      <div className="relative mt-2.5 grid gap-3 sm:grid-cols-2">
        <ImagePanel icon={<IcoImage className="h-3.5 w-3.5"/>} label="Imagen original">
          <ZoomTrigger label="imagen original" onOpen={() => setZoom('original')}>
            <FittedImage src={preview} alt="Imagen original analizada"/>
          </ZoomTrigger>
        </ImagePanel>
        <ImagePanel icon={<IcoScan className="h-3.5 w-3.5"/>} label="Detección del modelo">
          <ZoomTrigger label="detección del modelo" onOpen={() => setZoom('deteccion')}>
            {conDeteccion ? (
              <>
                <img src={preview} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-40 blur-lg"/>
                <span className="relative block h-full w-full">{deteccion}</span>
              </>
            ) : (
              <>
                <FittedImage src={preview} alt={isHealthy ? 'Imagen analizada: sin zonas afectadas' : 'Imagen analizada'}/>
                {chip(isHealthy ? 'Sin zonas afectadas' : 'Detección no disponible')}
              </>
            )}
          </ZoomTrigger>
        </ImagePanel>
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[calc(50%+13px)] hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#e6ebf0] bg-white text-[#0b1226] shadow-md sm:grid dark:border-white/10 dark:bg-[#1b2940] dark:text-white">
          <IcoChevronRight className="h-4 w-4"/>
        </span>
      </div>
      <p className={`mt-2 flex items-center gap-1.5 text-[10.5px] ${MUTED}`}>
        {isHealthy ? (
          'El modelo no encontró zonas con Tizón, Roya ni Mancha blanca en esta foto.'
        ) : (
          <>
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }}/>
            En color, la zona que el modelo detectó como {label.toLowerCase()}: {area.toFixed(1)} % de la imagen. Haz clic en una imagen para ampliarla.
          </>
        )}
      </p>
      {zoom === 'original' && (
        <ZoomOverlay label="Imagen original" onClose={() => setZoom(null)}>
          <img src={preview} alt="Imagen original analizada" className="h-full w-full object-contain"/>
        </ZoomOverlay>
      )}
      {zoom === 'deteccion' && (
        <ZoomOverlay label="Detección del modelo" onClose={() => setZoom(null)}>
          {conDeteccion ? deteccion : <img src={preview} alt="Imagen analizada" className="h-full w-full object-contain"/>}
        </ZoomOverlay>
      )}
    </section>
  )
}

function ResultBadgeIcon({ resultKey }) {
  const { isDark } = useTheme()
  const color = resultColor(resultKey, isDark)
  const crema = resultKey === 'mancha'
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_8px_18px_-10px_rgba(15,40,30,0.45)] ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-10 w-10">
        {resultKey === 'sano' ? (
          <>
            <circle cx="24" cy="24" r="20" fill={color}/>
            <path d="m15 24.5 6 6 12-13" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </>
        ) : (
          <>
            <path d="M24 4.5c1.6 0 3 .8 3.8 2.2l17 29.4c1.7 3-.4 6.6-3.8 6.6H7c-3.4 0-5.5-3.6-3.8-6.6l17-29.4C21 5.3 22.4 4.5 24 4.5Z" fill={color} stroke={crema ? '#b8994f' : 'none'} strokeWidth="1.5"/>
            <path d="M16.5 35c0-8.4 4.8-14 14.6-15-.6 9.6-5.8 14.6-14.6 15Z" fill={crema ? '#76602b' : '#fff'}/>
            <path d="M16.5 35 26 25.6" stroke={crema ? '#f6efdb' : color} strokeWidth="1.8" strokeLinecap="round"/>
          </>
        )}
      </svg>
    </span>
  )
}

function ConfidenceRing({ value, shown }) {
  const r = 46
  const c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, shown))
  return (
    <div className="relative h-[112px] w-[112px] shrink-0" title="Probabilidad media que el modelo asignó a este resultado en los píxeles donde lo detectó">
      <svg viewBox="0 0 112 112" aria-hidden="true" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="agro-conf-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399"/>
            <stop offset="100%" stopColor="#0b7a45"/>
          </linearGradient>
        </defs>
        <circle cx="56" cy="56" r={r} fill="none" strokeWidth="11" className="stroke-[#dcefe3] dark:stroke-white/10"/>
        <circle cx="56" cy="56" r={r} fill="none" stroke="url(#agro-conf-ring)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`}/>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-[Manrope,Inter,sans-serif] text-[23px] font-extrabold leading-none text-[#0b5c3a] dark:text-emerald-300">{value == null ? '—' : `${shown}%`}</p>
          <p className="mt-1 text-[10.5px] font-semibold text-[#1d2640] dark:text-slate-300">Confianza</p>
        </div>
      </div>
      <span className="sr-only">{value == null ? 'Confianza no disponible' : `Confianza del modelo: ${value} %`}</span>
    </div>
  )
}

function MiniStat({ tone, icon, label, value }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 ${tone.card}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full [&>svg]:h-4 [&>svg]:w-4 ${tone.icon}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`block truncate text-[10px] ${MUTED}`}>{label}</span>
        <span className={`block truncate text-[13px] font-extrabold leading-tight ${tone.value}`}>{value}</span>
      </span>
    </div>
  )
}

function DiagnosisCard({ result, isHealthy, resultKey, severity }) {
  const meta = diseaseMeta(result.target_class)
  const conf = result.model_confidence != null ? Math.round(Number(result.model_confidence)) : null
  const area = Number(result.confidence ?? 0)
  const shownConf = useCountUp(conf ?? 0, conf != null)
  const shownArea = useCountUp(Math.round(area * 10), area > 0) / 10
  const nombre = isHealthy ? 'Cultivo sano' : meta.label
  const corto = (RESULT_STYLE[resultKey]?.short ?? meta.short).toLowerCase()
  const fuerte = (txt) => <strong className="text-[#0b8a4b] dark:text-emerald-400">{txt}</strong>
  return (
    <section className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#d6eedd] bg-linear-to-br from-[#f2fbf5] via-white to-[#eaf7ee] px-4 pb-3.5 pt-3 shadow-[0_6px_18px_-14px_rgba(15,40,30,0.28)] dark:border-[#1e3048] dark:from-[#162032] dark:via-[#162032] dark:to-[#12281f]">
      <header className="flex items-center gap-2.5">
        <span className={ICON_BADGE}><IcoTrendUp/></span>
        <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Diagnóstico</h3>
      </header>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex min-w-[220px] flex-1 items-start gap-3">
          <ResultBadgeIcon resultKey={resultKey}/>
          <div className="min-w-0">
            <p className="font-[Manrope,Inter,sans-serif] text-[22px] font-extrabold leading-tight text-[#0b1226] dark:text-white">{nombre}</p>
            <p className="mt-1.5 text-[11.5px] leading-snug text-[#334155] dark:text-slate-300">
              {isHealthy ? (
                <>No se detectan síntomas de enfermedad en la hoja{conf != null && <> (confianza {fuerte(`${conf}%`)})</>}.</>
              ) : (
                <>Se detecta presencia de {corto} en la hoja{conf != null && <> con un {fuerte(`${conf}%`)} de confianza</>}.</>
              )}
            </p>
            {!isHealthy && <SeverityScale pct={area} className="mt-2.5 max-w-[280px]"/>}
          </div>
        </div>
        <ConfidenceRing value={conf} shown={shownConf}/>
      </div>
      <div className="mt-auto grid gap-2 pt-3 sm:grid-cols-3">
        <MiniStat tone={TONES.base} icon={<IcoLeaf/>} label="Área afectada" value={isHealthy ? '0%' : `≈ ${shownArea.toFixed(1)}%`}/>
        <MiniStat tone={TONES[severity] ?? TONES.base} icon={<IcoBars/>} label="Severidad" value={severity}/>
        <MiniStat tone={TONES.base} icon={<IcoPlant/>} label="Cultivo" value="Maíz"/>
      </div>
    </section>
  )
}

function GradCamCard({ xai, isHealthy }) {
  const [zoom, setZoom] = useState(false)
  const alt = 'Mapa de calor: zonas de la hoja en las que se fijó el modelo para el diagnóstico'
  const leyenda = (claro) => (
    <div className="flex gap-2.5 self-stretch py-1">
      <span aria-hidden="true" className={`rounded-full ${claro ? 'w-3' : 'w-2.5'}`} style={{ background: TURBO }}/>
      <span className={`flex flex-col justify-between leading-tight ${claro ? 'text-[11.5px] text-white/85' : `text-[10px] ${MUTED}`}`}>
        <span>Mayor<br/>atención</span>
        <span>Menor<br/>atención</span>
      </span>
    </div>
  )
  return (
    <section className={`${PARCEL_CARD} flex min-w-0 flex-col px-4 pb-3.5 pt-3`}>
      <header className="flex items-center gap-2.5">
        <span className={ICON_BADGE}><IcoTarget/></span>
        <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>Mapa de calor (Grad-CAM)</h3>
      </header>
      {xai ? (
        <div className="mt-3 flex flex-1 items-center gap-4">
          <div className="relative aspect-square w-[52%] max-w-[190px] shrink-0 overflow-hidden rounded-[10px] bg-[#0f1a14] ring-1 ring-black/5 dark:ring-white/10">
            <ZoomTrigger label="mapa de calor" onOpen={() => setZoom(true)}>
              <img src={xai} alt={alt} className="h-full w-full object-contain"/>
            </ZoomTrigger>
          </div>
          {leyenda(false)}
        </div>
      ) : (
        <p className={`mt-3 text-[11.5px] ${MUTED}`}>El mapa de calor no está disponible para este análisis.</p>
      )}
      <p className={`mt-2.5 text-[10px] leading-snug ${MUTED}`}>
        {isHealthy ? 'Zonas en las que el modelo se apoyó para decidir que la hoja está sana.' : 'Los colores cálidos marcan las zonas que más influyeron en el diagnóstico.'}
      </p>
      {zoom && xai && (
        <ZoomOverlay label="Mapa de calor (Grad-CAM)" onClose={() => setZoom(false)}>
          <div className="flex h-full w-full items-center justify-center gap-5">
            <img src={xai} alt={alt} className="h-full max-w-[calc(100%-96px)] object-contain"/>
            <div className="flex h-[55%]">{leyenda(true)}</div>
          </div>
        </ZoomOverlay>
      )}
    </section>
  )
}

function RecsCard({ recs, hasMore, open, onToggle, isHealthy, onGoEnfermedades }) {
  return (
    <section className={`${PARCEL_CARD} flex min-w-0 flex-col px-4 pb-3.5 pt-3`}>
      <header className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#fdf3d4] text-[#b7791f] dark:bg-amber-400/15 dark:text-amber-300 [&>svg]:h-4 [&>svg]:w-4"><IcoBulb/></span>
        <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>Recomendaciones</h3>
      </header>
      <ul className="mt-3 space-y-2.5">
        {recs.slice(0, 3).map((r) => (
          <li key={r.title} className="flex items-start gap-2.5 text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-200"><CheckCircle/><span>{r.body}</span></li>
        ))}
      </ul>
      <div className="mt-auto pt-3">
        {hasMore ? (
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls="detalle-tratamiento" className={BTN_DARK}>
            {open ? 'Ocultar detalles' : 'Ver más recomendaciones'}
            <span className={`transition-transform ${open ? 'rotate-90' : ''}`}><IcoArrow/></span>
          </button>
        ) : isHealthy && onGoEnfermedades ? (
          <button type="button" onClick={onGoEnfermedades} className={BTN_DARK}>
            Conocer las enfermedades del maíz
            <IcoArrow/>
          </button>
        ) : null}
      </div>
    </section>
  )
}

function RelatedHistoryCard({ history, savedId, resultKey, onGoHistorial }) {
  const keyOf = (h) => resultKeyOf(h.enfermedad, h.estado === 'Sano')
  const previos = history.filter((h) => h.id !== savedId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  const mismos = previos.filter((h) => keyOf(h) === resultKey)
  const item = mismos[0] ?? previos[0] ?? null
  const st = item ? (RESULT_STYLE[keyOf(item)] ?? RESULT_STYLE.otro) : null
  const etiqueta = resultKey === 'sano' ? 'sin enfermedad' : `con ${(RESULT_STYLE[resultKey]?.short ?? '').toLowerCase()}`
  const ir = () => onGoHistorial?.('individual')
  return (
    <section className={`relative flex min-w-0 flex-col overflow-hidden ${PARCEL_CARD} px-4 pb-3.5 pt-3`}>
      <img src={inicioHojas} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[60px] w-auto select-none dark:opacity-10"/>
      <header className="relative flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className={ICON_BADGE}><IcoClock/></span>
        <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>Historial relacionado</h3>
        {onGoHistorial && (
          <button type="button" onClick={ir} className="ml-auto inline-flex items-center gap-1.5 rounded-md text-[10.5px] font-semibold text-[#0b6b35] transition hover:text-[#02894b] hover:underline dark:text-emerald-400">
            Ver historial
            <IcoArrow/>
          </button>
        )}
      </header>
      {item ? (
        <>
          <p className={`relative mt-2.5 text-[10.5px] ${MUTED}`}>{mismos.length > 0 ? `Tu último análisis ${etiqueta}` : 'Tu análisis anterior'}</p>
          <button
            type="button"
            onClick={ir}
            aria-label={`${st.short}, ${fechaHora(item.fecha)}: ver en el historial`}
            className="relative mt-1.5 flex w-full items-center gap-3 rounded-xl border border-[#e9eef1] bg-white/85 p-2 text-left shadow-[0_4px_14px_-12px_rgba(15,40,30,0.4)] transition hover:border-[#bfe3c9] hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/30"
          >
            <span className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-lg bg-[#e3f2e6] dark:bg-white/5">
              {(item.resultadoImage || item.imagen) && <img src={item.resultadoImage || item.imagen} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }}/>}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[10.5px] ${MUTED}`}>Análisis · {fechaHora(item.fecha)}</span>
              <span className={`mt-1.5 inline-flex h-[22px] max-w-full items-center gap-1 rounded-full px-2.5 text-[10.5px] font-semibold ${st.chip}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.icon}`}/>
                <span className="truncate">{st.short}</span>
              </span>
              {keyOf(item) !== 'sano' && (
                <span className="mt-1 block text-[10.5px] font-semibold text-[#1d2640] dark:text-slate-200">{Number(item.affectedPercent ?? 0).toFixed(1)} % afectado · {item.severidad}</span>
              )}
            </span>
            <IcoChevronRight className="h-4 w-4 text-[#64748b] dark:text-slate-400"/>
          </button>
          {mismos.length > 1 && <p className={`relative mt-2 text-[10.5px] ${MUTED}`}>Tienes {mismos.length} análisis anteriores {etiqueta}.</p>}
        </>
      ) : (
        <p className={`relative mt-3 text-[11.5px] ${MUTED}`}>Este es tu primer análisis: aquí aparecerán los anteriores para que compares.</p>
      )}
    </section>
  )
}

function StepsCard({ icon, title, subtitle, steps }) {
  return (
    <section className={`${PARCEL_CARD} px-4 py-3.5`}>
      <header className="flex items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <h3 className={`text-[13.5px] ${PARCEL_TITLE}`}>{title}</h3>
          <p className={`text-[10.5px] ${MUTED}`}>{subtitle}</p>
        </div>
      </header>
      <ol className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.num} className={`flex gap-3 rounded-xl border p-3 ${s.alert ? 'border-red-200 bg-red-50 dark:border-red-400/25 dark:bg-red-500/10' : 'border-[#eef2f0] bg-[#fafcfb] dark:border-white/10 dark:bg-white/[0.03]'}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black text-white ${s.alert ? 'bg-red-600' : 'bg-[#0b8a4b] dark:bg-emerald-600'}`}>{s.num}</span>
            <div className="min-w-0">
              <p className={`flex items-center gap-1.5 text-[12px] font-bold ${s.alert ? 'text-red-800 dark:text-red-200' : 'text-[#0b1226] dark:text-white'}`}>
                <span aria-hidden="true">{s.icon}</span>{s.title}
              </p>
              <p className={`mt-0.5 text-[11px] leading-snug ${s.alert ? 'text-red-700 dark:text-red-200/90' : 'text-[#334155] dark:text-slate-300'}`}>{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

// «Ver más recomendaciones»: todas las recomendaciones y el tratamiento químico detallado
export function TreatmentDetails({ recs, chemData }) {
  return (
    <div className="space-y-3">
      <section className={`${PARCEL_CARD} px-4 py-3.5`}>
        <h3 className={`flex items-center gap-2.5 text-[14px] ${PARCEL_TITLE}`}>
          <span className={ICON_BADGE}><IcoShield/></span>
          Recomendaciones agronómicas
        </h3>
        <ol className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {recs.map((r, i) => (
            <li key={r.title} className="flex gap-3 rounded-xl border border-[#eef2f0] bg-[#fafcfb] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0b8a4b] text-[11px] font-black text-white dark:bg-emerald-600">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-[#0b1226] dark:text-white">{r.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#334155] dark:text-slate-300">{r.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {chemData && (
        <>
          <section className={`${PARCEL_CARD} overflow-hidden`}>
            <header className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300 [&>svg]:h-4 [&>svg]:w-4"><IcoFlask/></span>
              <div className="min-w-0">
                <h3 className={`text-[14px] ${PARCEL_TITLE}`}>Tratamiento químico recomendado</h3>
                <p className={`text-[11px] ${MUTED}`}>Agente causal: <i>{chemData.pathogen}</i></p>
              </div>
            </header>
            <p className="mx-4 rounded-lg bg-[#fdf7ec] px-3 py-2 text-[11.5px] leading-snug text-[#7a4b0c] dark:bg-amber-400/10 dark:text-amber-100">{chemData.description}</p>
            <div className="grid gap-2.5 p-4 lg:grid-cols-3">
              {chemData.products.map((p) => (
                <article key={p.name} className="flex flex-col rounded-xl border border-[#eef2f0] bg-[#fafcfb] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[12.5px] font-bold text-[#0b1226] dark:text-white">{p.name}</p>
                  <p className={`text-[10.5px] ${MUTED}`}>{p.brands}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#334155] ring-1 ring-black/5 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }}/>
                      {p.category}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{p.type}</span>
                  </div>
                  <dl className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {[['Por 200 L', p.dose200L], ['Por litro', p.dosePer1L], ['Frecuencia', p.frequency]].map(([k, v]) => (
                      <div key={k} className="rounded-lg border border-[#e9eef1] bg-white px-1.5 py-1.5 text-center dark:border-white/10 dark:bg-white/[0.04]">
                        <dt className={`text-[9px] font-semibold uppercase tracking-wide ${MUTED}`}>{k}</dt>
                        <dd className="mt-0.5 text-[11px] font-bold text-[#0b1226] dark:text-white">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className={`mt-2 text-[10.5px] italic leading-snug ${MUTED}`}>{p.note}</p>
                </article>
              ))}
            </div>
            <div className="mx-4 mb-4 rounded-xl border border-[#dcefe3] bg-[#f3faf6] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[12.5px] font-bold text-[#0b1226] dark:text-white">{chemData.mix.title}</p>
              <p className={`text-[10.5px] ${MUTED}`}>{chemData.mix.subtitle}</p>
              <ol className="mt-2 space-y-1.5">
                {chemData.mix.components.map((c, i) => (
                  <li key={c.product} className="flex items-center justify-between gap-3 rounded-lg border border-[#e3efe7] bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black text-white" style={{ background: c.color }}>{i + 1}</span>
                      <span className="text-[11.5px] font-medium text-[#1d2640] dark:text-slate-200">{c.product}</span>
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold text-[#0b1226] dark:text-white">{c.amount}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <div className="grid items-start gap-3 xl:grid-cols-2">
            <StepsCard
              icon={<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300 [&>svg]:h-4 [&>svg]:w-4"><IcoBeaker/></span>}
              title="Preparación de la mezcla"
              subtitle="Paso a paso para un tanque de 200 litros"
              steps={MIXING_STEPS}
            />
            <StepsCard
              icon={<span className={`${ICON_BADGE} h-8 w-8`}><IcoSpray/></span>}
              title="Procedimiento de fumigación"
              subtitle="Guía para una aplicación segura y efectiva"
              steps={FUMIGATION_STEPS}
            />
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-snug text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
            <span aria-hidden="true">⚠️</span>
            Las dosis indicadas son de referencia. Consulta siempre la etiqueta oficial del producto y el criterio de un ingeniero agrónomo antes de aplicar. El uso inadecuado de plaguicidas puede dañar el cultivo, la salud y el medio ambiente.
          </p>
        </>
      )}
    </div>
  )
}

// El modo ('individual' | 'parcela') lo elige el submenú "Analizar" de la barra lateral (App.jsx)
export default function Analizar({ onHistoryChange, onAnalysisSaved, history = [], enfermedades = [], mode = 'individual', preselectedParcelaId = null, showPerformance = false, onGoHistorial, onGoEnfermedades }) {
  const [file, setFile]               = useState(null)
  const [preview, setPreview]         = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [dragging, setDragging]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [step, setStep]               = useState(-1)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState(null)
  const [maskBase64, setMaskBase64]   = useState(null)
  const [timings, setTimings]         = useState(null)
  const modelLoadMs                   = useModelLoadTime()
  const [exportingPdf, setExportingPdf] = useState(false)
  const [savedId, setSavedId]         = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const inputRef      = useRef(null)
  const detailsRef    = useRef(null)
  const previewUrlRef = useRef('')

  const isHealthy  = isHealthyClass(result?.target_class)
  const disease    = result ? DISEASES[result.target_class] : null
  const recs       = result ? recommendationsFor(result.target_class) : []
  const severity   = result ? severityOf(result.target_class, result.confidence) : null
  const chemData   = result ? (CHEMICAL_TREATMENTS[result.target_class] ?? null) : null
  const resultKey  = result ? resultKeyOf(result.target_class, isHealthy) : null
  const showResult = !!result && !loading
  const stepIndex  = showResult ? 2 : file ? 1 : 0

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }, [])
  useEffect(() => {
    if (showDetails) detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showDetails])

  const applyFile = (f) => {
    if (!f || loading) return
    if (!f.type?.startsWith('image/')) {
      setError('El archivo no es una imagen. Usa una foto JPG, PNG o WEBP.')
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(f)
    previewUrlRef.current = url
    setFile(f)
    setPreview(url)
    setResult(null)
    setMaskBase64(null)
    setTimings(null)
    setSavedId(null)
    setShowDetails(false)
    setError('')
    fileToDataUrl(f).then(setPreviewDataUrl).catch(() => setPreviewDataUrl(''))
  }

  const pickFile = () => { if (!loading) inputRef.current?.click() }

  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); if (!loading) setDragging(true) },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) },
    onDrop: (e) => { e.preventDefault(); setDragging(false); applyFile(e.dataTransfer.files?.[0]) },
  }

  const resetAll = () => {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = '' }
    setFile(null)
    setPreview('')
    setPreviewDataUrl('')
    setResult(null)
    setMaskBase64(null)
    setTimings(null)
    setSavedId(null)
    setShowDetails(false)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleExportPDF = async () => {
    if (!result) return
    setExportingPdf(true)
    try {
      await exportAnalisisPDF({
        diseaseLabel:    disease?.label ?? result.target_class,
        affectedPercent: result.confidence,
        severity,
        fecha:           new Date().toISOString(),
        originalImg:     previewDataUrl,
        xaiImg:          result.xai_base64_png ? `data:image/png;base64,${result.xai_base64_png}` : null,
        recommendations: recs,
      })
    } finally {
      setExportingPdf(false)
    }
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
    setMaskBase64(null)
    setTimings(null)
    setSavedId(null)
    setShowDetails(false)
    setStep(0)

    try {
      const imageDataUrl = await compressImage(file)
      const tPrep = performance.now()
      const upload = await prepareUploadFile(file)
      const prepMs = performance.now() - tPrep
      const formData = new FormData()
      formData.append('file', upload.file)
      const segFormData = new FormData()
      segFormData.append('file', upload.file)

      setStep(1)
      const [xaiOutcome, segOutcome] = await Promise.allSettled([
        timedRequest(() => predictXai(formData)),
        timedRequest(() => predictSegmentation(segFormData)),
      ])
      if (xaiOutcome.status !== 'fulfilled') throw xaiOutcome.reason
      const rawData = xaiOutcome.value.response.data
      const data = { ...rawData, confidence: affectedPercent(rawData.target_class, rawData.confidence) }
      const segResponse = segOutcome.status === 'fulfilled' ? segOutcome.value.response : null
      setMaskBase64(segResponse?.data?.mask_base64_png ?? null)
      setTimings({
        xai: timingFrom(xaiOutcome.value.response, xaiOutcome.value.roundtripMs),
        seg: segResponse ? timingFrom(segResponse, segOutcome.value.roundtripMs) : null,
        prepMs,
        upload: { ...upload, uploadBytes: upload.file.size },
      })

      setStep(2)
      setResult(data)

      setStep(3)
      const targetIdx     = Number(data.target_class_id)
      const enfermedadRow = (enfermedades || []).find((e) => Number(e.clase_idx) === targetIdx)
      const diseaseId     = enfermedadRow?.id ?? DISEASE_IDS[data.target_class]
      const xaiDataUrl    = data.xai_base64_png ? `data:image/png;base64,${data.xai_base64_png}` : null
      // Imagen de salida (original + área afectada + caja + etiqueta) para mostrarla luego en Inicio
      const resultadoUrl  = isHealthyClass(data.target_class) ? null : await annotatedImageDataUrl({
        originalSrc:    imageDataUrl,
        maskBase64:     segResponse?.data?.mask_base64_png,
        targetClassId:  targetIdx,
        label:          DISEASES[data.target_class]?.label ?? data.target_class,
        confidence:     data.model_confidence ?? data.confidence,
        highlightColor: DISEASES[data.target_class]?.barColor ?? '#ef4444',
      }).catch(() => null)

      const savedResponse = await createAnalisis({
        imagen_url:     imageDataUrl,
        grad_cam_url:   xaiDataUrl,
        resultado_url:  resultadoUrl,
        afectacion_pct: data.confidence,
        severidad:      severityKey(data.confidence),
        enfermedad_id:  diseaseId,
      })

      const saved = mapAnalysisResponse(savedResponse.data)
      setSavedId(saved.id)
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
    <div className="fade-up relative isolate space-y-5">
      <PageGlow />

      {/* ── Parcela completa ─────────────────────────────────────── */}
      {mode === 'parcela' && <AnalizarParcela preselectedParcelaId={preselectedParcelaId} onGoHistorial={onGoHistorial} onGoEnfermedades={onGoEnfermedades} />}

      {/* ── Análisis individual ──────────────────────────────────── */}
      {mode !== 'parcela' && (
        <div className="flex flex-col gap-3.5">
          <IndividualHero/>
          <StepBar current={stepIndex} steps={INDIVIDUAL_STEPS}/>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-label="Seleccionar imagen del cultivo"
            className="hidden"
            onChange={(e) => { applyFile(e.target.files?.[0]); e.target.value = '' }}
          />

          {!showResult ? (
            <>
              <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
                <UploadPanel
                  file={file}
                  preview={preview}
                  sizeLabel={fileSizeLabel}
                  dragging={dragging}
                  loading={loading}
                  error={error}
                  onPick={pickFile}
                  onAnalyze={analyze}
                  dropProps={dropProps}
                />
                {loading ? <ProcessingCard step={step}/> : file ? <PhotoTipsCard/> : <QueAnalizarCard onGoEnfermedades={onGoEnfermedades}/>}
              </div>
              <RecentAnalyses history={history} onGoHistorial={onGoHistorial}/>
            </>
          ) : (
            <>
              {error && (
                <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[11.5px] text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
                  El análisis se completó, pero no se pudo guardar en tu historial: {error}
                </p>
              )}
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.33fr)_minmax(0,1fr)]">
                <ResultImagesCard
                  preview={preview}
                  maskBase64={maskBase64}
                  result={result}
                  isHealthy={isHealthy}
                  disease={disease}
                  exporting={exportingPdf}
                  onExport={handleExportPDF}
                  onNew={resetAll}
                />
                <DiagnosisCard result={result} isHealthy={isHealthy} resultKey={resultKey} severity={severity}/>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <GradCamCard xai={result.xai_base64_png ? `data:image/png;base64,${result.xai_base64_png}` : null} isHealthy={isHealthy}/>
                <RecsCard
                  recs={recs}
                  hasMore={recs.length > 3 || !!chemData}
                  open={showDetails}
                  onToggle={() => setShowDetails((v) => !v)}
                  isHealthy={isHealthy}
                  onGoEnfermedades={onGoEnfermedades}
                />
                <RelatedHistoryCard history={history} savedId={savedId} resultKey={resultKey} onGoHistorial={onGoHistorial}/>
              </div>
              {showDetails && (
                <div ref={detailsRef} id="detalle-tratamiento" className="scroll-mt-20">
                  <TreatmentDetails recs={recs} chemData={chemData}/>
                </div>
              )}
              {savedId && (
                <p className={`flex items-center gap-2 px-1 text-[10.5px] ${MUTED}`}><CheckCircle/>Análisis guardado en tu historial</p>
              )}
              {showPerformance && timings && (
                <AnalysisTimingPanel seg={timings.seg} xai={timings.xai} loadMs={modelLoadMs} prepMs={timings.prepMs} upload={timings.upload}/>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
