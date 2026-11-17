import { useState, useCallback, useEffect, useRef } from 'react'
import { predictXai, predictSegmentation, createAnalisis } from './api.js'
import { exportAnalisisPDF } from './exportPDF.js'
import { useTheme } from './ThemeContext.jsx'
import { affectedFromRecord, affectedPercent, severityFromRecord, severityKey, severityOf } from './severity.js'
import { AnalysisTimingPanel, prepareUploadFile, timedRequest, timingFrom, useModelLoadTime } from './Rendimiento.jsx'
import AnalizarParcela from './AnalizarParcela.jsx'
import { recommendationsFor } from './diseases.js'
import PageHero, { PageGlow } from './PageHero.jsx'

const DISEASES = {
  Fondo_y_Sana:  { label: 'Cultivo Sano',   color: '#15803d', gradFrom: '#f0fdf4', gradTo: '#dcfce7', border: '#86efac', barColor: '#22c55e' },
  Fondo:         { label: 'Cultivo Sano',   color: '#15803d', gradFrom: '#f0fdf4', gradTo: '#dcfce7', border: '#86efac', barColor: '#22c55e' },
  Tizon:         { label: 'Tizón del Maíz', color: '#c2410c', gradFrom: '#fff7ed', gradTo: '#ffedd5', border: '#fdba74', barColor: '#f97316' },
  Roya:          { label: 'Roya',           color: '#92400e', gradFrom: '#fffbeb', gradTo: '#fef3c7', border: '#fcd34d', barColor: '#f59e0b' },
  Mancha_Blanca: { label: 'Mancha Blanca',  color: '#991b1b', gradFrom: '#fef2f2', gradTo: '#fee2e2', border: '#fca5a5', barColor: '#ef4444' },
  Mancha_blanca: { label: 'Mancha Blanca',  color: '#991b1b', gradFrom: '#fef2f2', gradTo: '#fee2e2', border: '#fca5a5', barColor: '#ef4444' },
}

const DISEASE_IDS = { Fondo: 1, Fondo_y_Sana: 1, Tizon: 2, Roya: 3, Mancha_blanca: 4, Mancha_Blanca: 4 }

const STEPS = [
  'Preprocesando imagen UAV…',
  'Ejecutando modelo de segmentación…',
  'Generando mapa Grad-CAM XAI…',
  'Guardando en historial…',
]

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

const CHEMICAL_TREATMENTS = {
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
    fecha: record.fecha,
    imagen: record.imagen_url,
    enfermedad: diseaseName,
    enfermedadLabel: DISEASES[diseaseName]?.label ?? diseaseName,
    confianza: confidence / 100,
    severidad: severityFromRecord(record),
    cultivo: 'Maíz',
    recomendaciones: recommendationsFor(record.enfermedad?.nombre).map(r => r.body).join(' '),
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

        const outW = origImg.naturalWidth
        const outH = origImg.naturalHeight
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(origImg, 0, 0, outW, outH)

        if (found) {
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
        }
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
function UploadIllustration() {
  return (
    <svg viewBox="0 0 220 130" className="h-32 w-56 transition-transform duration-300 group-hover:-translate-y-1 sm:h-36 sm:w-64" aria-hidden="true">
      <defs>
        <linearGradient id="agro-up-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#bfdbfe" />
        </linearGradient>
        <linearGradient id="agro-up-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="agro-up-btn" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <clipPath id="agro-up-card">
          <rect x="66" y="22" width="80" height="62" rx="10" />
        </clipPath>
      </defs>
      <ellipse cx="110" cy="74" rx="104" ry="34" fill="none" stroke="#10b981" strokeOpacity="0.25" />
      <ellipse cx="110" cy="74" rx="78" ry="25" fill="none" stroke="#10b981" strokeOpacity="0.35" strokeDasharray="3 4" />
      <circle cx="8" cy="70" r="2.5" fill="#10b981" fillOpacity="0.5" />
      <circle cx="212" cy="80" r="2.5" fill="#10b981" fillOpacity="0.5" />
      <g transform="rotate(9 122 56)">
        <rect x="84" y="14" width="76" height="58" rx="10" fill="#dbeafe" stroke="#ffffff" strokeWidth="3" />
      </g>
      <g transform="rotate(-6 106 53)">
        <g clipPath="url(#agro-up-card)">
          <rect x="66" y="22" width="80" height="62" fill="url(#agro-up-sky)" />
          <circle cx="128" cy="38" r="6" fill="#facc15" />
          <path d="M60 86 L88 54 L106 72 L118 60 L150 90 Z" fill="url(#agro-up-hill)" />
        </g>
        <rect x="66" y="22" width="80" height="62" rx="10" fill="none" stroke="#ffffff" strokeWidth="3" />
      </g>
      <circle cx="148" cy="90" r="17" fill="url(#agro-up-btn)" stroke="#ffffff" strokeWidth="3" />
      <path d="M148 98V83M141.5 89.5 148 83l6.5 6.5" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const DecorLeaf = ({ className, flip = false }) => (
  <svg viewBox="0 0 120 120" aria-hidden="true" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M10 110C10 50 50 10 110 10c0 60-40 100-100 100Z" fill="currentColor" />
    <path d="M10 110C40 80 70 50 110 10" fill="none" strokeWidth="2" className="stroke-white/60 dark:stroke-emerald-300/15" />
  </svg>
)

const IcoImage = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
  </svg>
)

const UPLOAD_FEATURES = [
  {
    text: 'Análisis seguro con IA',
    icon: <path d="M12 2.5 4.5 5.5v5.7c0 4.9 3.2 9 7.5 10.3 4.3-1.3 7.5-5.4 7.5-10.3V5.5L12 2.5Zm-1.2 13.2-3.3-3.3 1.4-1.4 1.9 1.9 4.6-4.6 1.4 1.4-6 6Z" fill="currentColor" />,
  },
  {
    text: 'Resultados en segundos',
    icon: <path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6L13.5 2Z" fill="currentColor" />,
  },
  {
    text: 'Soporte para imágenes de alta resolución',
    icon: <path d="M20.5 3.5C11 3.5 4.5 8.5 4.5 16c0 1.6.4 3 1 4.2C7.5 14.5 11 11 16 9c-4.2 2.6-7.2 6.3-8.6 11.2 1 .5 2.2.8 3.6.8 7 0 9.5-6.5 9.5-17.5Z" fill="currentColor" />,
  },
]

// El modo ('individual' | 'parcela') lo elige el submenú "Analizar" de la barra lateral (App.jsx)
export default function Analizar({ onHistoryChange, onAnalysisSaved, history = [], enfermedades = [], mode = 'individual', preselectedParcelaId = null, showPerformance = false }) {
  const { isDark } = useTheme()
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
  const [showXai, setShowXai]         = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const displayConf = useCountUp(result?.confidence ?? 0, !!result && !loading)
  const isHealthy   = result?.target_class === 'Fondo_y_Sana' || result?.target_class === 'Fondo'
  const disease     = result ? DISEASES[result.target_class] : null
  const recs        = result ? recommendationsFor(result.target_class) : []
  const severity    = result ? severityOf(result.target_class, result.confidence) : null
  const chemData    = result ? (CHEMICAL_TREATMENTS[result.target_class] ?? null) : null

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
    setMaskBase64(null)
    setShowXai(false)
    setError('')
    fileToDataUrl(f).then(setPreviewDataUrl).catch(() => setPreviewDataUrl(''))
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
    setMaskBase64(null)
    setShowXai(false)
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
    setMaskBase64(null)
    setTimings(null)
    setShowXai(false)
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

      const savedResponse = await createAnalisis({
        imagen_url:     imageDataUrl,
        grad_cam_url:   xaiDataUrl,
        afectacion_pct: data.confidence,
        severidad:      severityKey(data.confidence),
        enfermedad_id:  diseaseId,
      })

      const saved = mapAnalysisResponse(savedResponse.data)
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
      {mode === 'parcela'
        ? <PageHero title="Analiza" highlight="tu parcela" subtitle="Muestreo sistemático de un lote completo con IA" />
        : <PageHero title="Analiza" highlight="tus cultivos" subtitle="Detecta enfermedades con el poder de la IA" />}

      {/* ── Parcela completa ─────────────────────────────────────── */}
      {mode === 'parcela' && <AnalizarParcela preselectedParcelaId={preselectedParcelaId} />}

      {/* ── Análisis individual ──────────────────────────────────── */}
      {mode !== 'parcela' && <>

      {/* ── Tarjeta de carga ──────────────────────────────────────── */}
      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-[0_12px_40px_-20px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
            <IcoImage />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Cargar imagen UAV</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Fotografía aérea de cultivo de maíz · JPG, PNG, WebP</p>
          </div>
          {file && !loading ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Lista para analizar
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="hidden h-3 w-16 shrink-0 rounded-sm opacity-80 sm:block"
              style={{ background: 'repeating-linear-gradient(-45deg, #22c55e 0 6px, transparent 6px 11px)' }}
            />
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className={`group relative cursor-pointer select-none overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200 ${
              dragging
                ? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] dark:bg-emerald-400/10'
                : preview
                  ? 'border-transparent bg-slate-950'
                  : 'border-emerald-300/80 bg-linear-to-br from-emerald-50/80 via-white/60 to-green-50/80 hover:border-emerald-400 dark:border-emerald-400/30 dark:from-emerald-400/[0.07] dark:via-transparent dark:to-emerald-400/[0.04]'
            }`}
            style={{ minHeight: preview ? 300 : 280 }}
          >
            <input
              type="file"
              accept="image/*"
              aria-label="Seleccionar imagen del cultivo"
              onChange={(e) => applyFile(e.target.files?.[0])}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
            />

            {preview ? (
              <>
                <img
                  src={preview}
                  alt="Vista previa de la imagen"
                  className="mx-auto max-h-[380px] w-full object-contain transition-opacity duration-300"
                  style={{ opacity: loading ? 0.4 : 1 }}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-linear-to-t from-slate-950/80 to-transparent px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <IcoImage className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="max-w-[200px] truncate text-xs font-medium text-slate-300">{file?.name}</p>
                    <span className="text-xs text-slate-500">{fileSizeLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="pointer-events-auto z-30 flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  >
                    Cambiar
                  </button>
                </div>
              </>
            ) : (
              <>
                <DecorLeaf className="absolute -bottom-6 -left-6 h-20 w-20 text-emerald-300/40 sm:h-36 sm:w-36 dark:text-emerald-400/10" />
                <DecorLeaf flip className="absolute -bottom-8 -right-6 h-24 w-24 text-emerald-300/40 sm:h-44 sm:w-44 dark:text-emerald-400/10" />
                <div className="relative flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <UploadIllustration />
                  <p className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">
                    {dragging ? '¡Suelta la imagen aquí!' : 'Arrastra tu imagen aquí'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">o haz clic para seleccionar archivos</p>
                  <div className="mt-3 flex items-center gap-3">
                    {['JPG', 'PNG', 'WebP'].map((f) => (
                      <span key={f} className="rounded-full border border-emerald-300 bg-emerald-50/80 px-4 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {(file || error) && (
          <div className="flex flex-wrap items-center justify-end gap-3 px-4 pb-4 sm:px-5">
            {error && (
              <p className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={!file || loading}
              onClick={analyze}
              className={`inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-bold transition-all duration-200 active:scale-95 ${
                !file || loading
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'
                  : 'bg-linear-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-600/30 hover:brightness-105'
              }`}
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Analizando…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="M3 9V6a3 3 0 013-3h3M3 15v3a3 3 0 003 3h3M21 9V6a3 3 0 00-3-3h-3M21 15v3a3 3 0 01-3 3h-3"/>
                    <rect x="7" y="7" width="10" height="10" rx="2"/>
                  </svg>
                  Analizar imagen
                </>
              )}
            </button>
          </div>
        )}

        <div className="mx-4 mb-4 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 sm:mx-5 sm:mb-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-emerald-200/70 dark:border-white/10 dark:bg-white/[0.03] dark:sm:divide-white/10">
          {UPLOAD_FEATURES.map(({ text, icon }) => (
            <div key={text} className="flex items-center gap-3 sm:justify-center sm:px-4">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400">{icon}</svg>
              <p className="text-sm font-semibold leading-snug text-slate-700 dark:text-slate-200">{text}</p>
            </div>
          ))}
        </div>
      </section>

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
                          background: severity === 'Grave' ? '#fef2f2' : severity === 'Moderada' ? '#fffbeb' : '#f0fdf4',
                          color:      severity === 'Grave' ? '#b91c1c' : severity === 'Moderada' ? '#92400e' : '#15803d',
                          border:     `1px solid ${severity === 'Grave' ? '#fecaca' : severity === 'Moderada' ? '#fde68a' : '#bbf7d0'}`,
                        }}
                      >
                        {isHealthy ? 'Sano' : `Severidad ${severity}`}
                      </span>
                      {!isHealthy && result.model_confidence !== undefined && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{ background: 'rgba(255,255,255,0.6)', color: disease.color, border: `1px solid ${disease.border}` }}
                          title="Probabilidad promedio que el modelo asignó a esta clase en los píxeles que diagnosticó como tal"
                        >
                          Confianza del modelo {Math.round(result.model_confidence)}%
                        </span>
                      )}
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

          {/* Resultado visual: una sola imagen con el área afectada resaltada */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
            <div className="px-5 pt-5 pb-4">
              <p className="font-bold text-slate-900 text-sm">Resultado del análisis</p>
            </div>

            <div className="px-5 pb-5">
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 relative">
                {isHealthy ? (
                  <img src={preview} alt="Imagen analizada" className="w-full h-full object-contain"/>
                ) : (
                  <AnnotatedResultImage
                    originalSrc={preview}
                    maskBase64={maskBase64}
                    targetClassId={Number(result.target_class_id)}
                    label={disease?.label ?? result.target_class}
                    confidence={result.model_confidence ?? result.confidence}
                    highlightColor={disease?.barColor ?? '#ef4444'}
                  />
                )}
                <div className="absolute top-3 left-3">
                  <span className="rounded-lg bg-slate-950/60 backdrop-blur-sm border border-white/10 px-3 py-1 text-xs font-semibold text-white">
                    Imagen analizada UAV
                  </span>
                </div>
              </div>
            </div>

            {!isHealthy && result.xai_base64_png && (
              <div className="px-5 pb-5">
                <button
                  type="button"
                  onClick={() => setShowXai((v) => !v)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 transition-transform ${showXai ? 'rotate-90' : ''}`}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  Ver explicabilidad (Grad-CAM XAI)
                </button>
                {showXai && (
                  <div className="mt-3">
                    <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img src={`data:image/png;base64,${result.xai_base64_png}`} alt="Grad-CAM" className="w-full h-full object-cover"/>
                    </div>
                    <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 flex items-start gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="w-4 h-4 flex-shrink-0 mt-0.5">
                        <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                      </svg>
                      <span>El mapa Grad-CAM muestra las zonas donde el modelo concentró su atención para el diagnóstico. Las áreas en colores cálidos (rojo/naranja) indican mayor relevancia.</span>
                    </div>
                  </div>
                )}
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

          {/* ── Tratamiento químico ─────────────────────────────────── */}
          {!isHealthy && chemData && (
            <div className="space-y-4">

              {/* Productos recomendados */}
              <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" className="w-4 h-4"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Tratamiento químico recomendado</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Agente causal: <span className="italic">{chemData.pathogen}</span></p>
                  </div>
                </div>

                <div className={`px-6 py-3 text-xs leading-relaxed ${isDark ? 'bg-[#1a2a3a] text-slate-300' : 'bg-amber-50 text-amber-900'}`}>
                  {chemData.description}
                </div>

                <div className="p-5 space-y-3">
                  {chemData.products.map((p, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${isDark ? 'bg-[#1a2a3a] border-[#2a3d55]' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{p.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{p.brands}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: p.color + '22', color: p.color, border: `1px solid ${p.color}44` }}>{p.category}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-[#0e1929] text-slate-300 border border-[#2a3d55]' : 'bg-white text-slate-500 border border-slate-200'}`}>{p.type}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          { label: 'Por 200 L', value: p.dose200L },
                          { label: 'Por litro', value: p.dosePer1L },
                          { label: 'Frecuencia', value: p.frequency },
                        ].map((d, j) => (
                          <div key={j} className={`rounded-lg border p-2 text-center ${isDark ? 'bg-[#0e1929] border-[#2a3d55]' : 'bg-white border-slate-200'}`}>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{d.label}</p>
                            <p className={`font-bold text-xs mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{d.value}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-slate-400 italic leading-relaxed">{p.note}</p>
                    </div>
                  ))}
                </div>

                {/* Mezcla recomendada */}
                <div className="px-5 pb-5">
                  <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#0d1e35] border-blue-900/50' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`font-bold text-sm mb-0.5 ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>{chemData.mix.title}</p>
                    <p className="text-xs text-slate-400 mb-3">{chemData.mix.subtitle}</p>
                    <div className="space-y-2">
                      {chemData.mix.components.map((c, i) => (
                        <div key={i} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isDark ? 'bg-[#162032] border-[#2a3d55]' : 'bg-white border-blue-100'}`}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{ background: c.color }}>{i + 1}</span>
                            <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.product}</span>
                          </div>
                          <span className="text-xs font-bold ml-3 flex-shrink-0" style={{ color: c.color }}>{c.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preparación de la mezcla */}
              <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" className="w-4 h-4"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Preparación de la mezcla</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Procedimiento paso a paso para tanque de 200 litros</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {MIXING_STEPS.map((s) => (
                    <div key={s.num} className={`flex gap-3 rounded-xl border p-4 ${isDark ? 'bg-[#1a2a3a] border-[#2a3d55]' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm">{s.num}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base leading-none">{s.icon}</span>
                          <p className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{s.title}</p>
                        </div>
                        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Procedimiento de fumigación */}
              <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
                <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" className="w-4 h-4"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Procedimiento de fumigación</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Guía completa para una aplicación segura y efectiva</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {FUMIGATION_STEPS.map((s) => (
                    <div key={s.num} className={`flex gap-3 rounded-xl border p-4 ${
                      s.alert
                        ? isDark ? 'bg-red-950/40 border-red-800/50' : 'bg-red-50 border-red-200'
                        : isDark ? 'bg-[#1a2a3a] border-[#2a3d55]' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${s.alert ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>{s.num}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base leading-none">{s.icon}</span>
                          <p className={`font-bold text-sm ${s.alert ? isDark ? 'text-red-300' : 'text-red-800' : isDark ? 'text-slate-100' : 'text-slate-900'}`}>{s.title}</p>
                        </div>
                        <p className={`text-xs leading-relaxed ${s.alert ? isDark ? 'text-red-200' : 'text-red-700' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-xs flex items-start gap-2 ${isDark ? 'bg-amber-950/30 border-amber-800/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0 mt-0.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  <span>Las dosis indicadas son de referencia. Consulte siempre la etiqueta oficial del producto y el criterio de un ingeniero agrónomo antes de aplicar. El uso inadecuado de plaguicidas puede dañar el cultivo, la salud y el medio ambiente.</span>
                </div>
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

          {showPerformance && timings && (
            <AnalysisTimingPanel seg={timings.seg} xai={timings.xai} loadMs={modelLoadMs} prepMs={timings.prepMs} upload={timings.upload}/>
          )}
        </div>
      )}

      </>}
    </div>
  )
}
