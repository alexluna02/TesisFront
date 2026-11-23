import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  apiDate, apiErrorMessage, crearConsulta, descargarDocumentoConsulta, enviarDocumentoConsulta, enviarMensajeConsulta,
  fetchConsultas, fetchExpertos, fetchMensajesConsulta, marcarConsultaLeida,
} from './api.js'
import { ZoomOverlay } from './Analizar.jsx'
import { PageGlow } from './PageHero.jsx'
import heroConsultas from './Imagenes/consultas-hero.webp'

// «Consultas» según la maqueta del usuario (images/24.png): banner, «Nuestros Expertos» y un chat
// normal con el experto elegido. El análisis se comparte como el PDF que la app ya exporta (o una
// foto), adjuntándolo en el chat. Para el experto, la lista muestra a quienes le escribieron.
// Sin WebSockets: el chat abierto pide mensajes nuevos cada 5 s (con margen, descartando repetidos
// por id) y las listas se refrescan cada 20 s. «En línea» lo calcula el servidor con la actividad
// reciente de cada usuario.
const POLL_CHAT_MS = 5000
const POLL_LISTA_MS = 20000
const MARGEN_MS = 15000
const PDF_MAX_BYTES = 10 * 1024 * 1024

const TITULO = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const TENUE = 'text-[#55607a] dark:text-slate-400'
const CARD = 'rounded-[18px] border border-[#e3ebe7] bg-white shadow-[0_14px_30px_-26px_rgba(15,60,40,0.5)] dark:border-white/10 dark:bg-[#162032]'
const AVATAR = ['#16a34a', '#2f80ed', '#f39c12', '#0f6b3a', '#8e44ad', '#e2574c', '#0e9aa7']

// ── Utilidades ────────────────────────────────────────────────────────────────
const iniciales = (nombre) => String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const colorAvatar = (nombre) => AVATAR[[...String(nombre ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length]
const fechaApi = (iso) => (iso ? new Date(apiDate(iso)) : null)
const ahoraApi = () => new Date().toISOString().replace('Z', '')     // UTC sin zona, como la API
const nuevoId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
const hora = (fecha) => fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const inicioDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
const diasDesde = (fecha) => Math.round((inicioDia(new Date()) - inicioDia(fecha)) / 86400000)
const diaDe = (fecha) => {
  const dias = diasDesde(fecha)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return fecha.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
}
const pesoArchivo = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// «hace 5 min», «hace 3 h», «ayer», «hace 4 días», «el 12 nov»
function haceTiempo(iso) {
  const d = fechaApi(iso)
  if (!d) return ''
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400 && diasDesde(d) === 0) return `hace ${Math.floor(s / 3600)} h`
  const dias = diasDesde(d)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return `el ${d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }).replace('.', '')}`
}
const presencia = (p) => (p?.en_linea
  ? { en: true, texto: 'En línea' }
  : { en: false, texto: p?.ultima_actividad ? `Últ. vez ${haceTiempo(p.ultima_actividad)}` : 'Sin conexión' })

const compararMensajes = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : String(a.id).localeCompare(String(b.id)))
// Une los mensajes confirmados (sin duplicar por id) y conserva los pendientes que aún no llegaron
function fusionar(previos, nuevos) {
  const porId = new Map()
  for (const m of previos) if (!m._estado) porId.set(m.id, m)
  for (const m of nuevos) porId.set(m.id, m)
  const confirmados = [...porId.values()].sort(compararMensajes)
  const llegados = new Set(confirmados.map((m) => m.client_id).filter(Boolean))
  return [...confirmados, ...previos.filter((m) => m._estado && !llegados.has(m.client_id))]
}
const vistaPrevia = (u, meId) => {
  if (!u) return 'Sin mensajes todavía'
  const texto = u.texto || (u.documento_nombre ? `📄 ${u.documento_nombre}` : u.tiene_imagen ? '📷 Foto' : '')
  return `${u.autor_id === meId ? 'Tú: ' : ''}${texto}`
}

// Foto del usuario → JPEG ≤ 1600 px y < 1.9 MB (el servidor acepta hasta 2 MB)
async function comprimirImagen(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen. Usa una foto JPG, PNG o WEBP.'))
      i.src = url
    })
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const calidad of [0.85, 0.75, 0.62, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', calidad)
      if ((dataUrl.length - 23) * 0.75 < 1.9 * 1024 * 1024) return dataUrl
    }
    throw new Error('La imagen es demasiado grande. Prueba con otra foto.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function useEsEscritorio() {
  const consulta = '(min-width: 1024px)'
  const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(consulta)
    if (!mq) return undefined
    const cambio = () => setEs(mq.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return !!es
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoChat = (p) => <Svg {...p}><path d="M7 4.5h10A2.5 2.5 0 0 1 19.5 7v7a2.5 2.5 0 0 1-2.5 2.5h-6.5L6 20v-3.5h-.5A1.5 1.5 0 0 1 4 15V7a2.5 2.5 0 0 1 3-2.5Z"/><path d="M8.5 9.5h7M8.5 12.5h4"/></Svg>
const IcoGrupo = (p) => <Svg {...p}><circle cx="12" cy="8" r="3"/><path d="M6.5 19c.6-3 2.9-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="5.3" cy="9.8" r="2.1"/><path d="M2.4 17.4c.4-1.9 1.7-3 3.4-3.2"/><circle cx="18.7" cy="9.8" r="2.1"/><path d="M21.6 17.4c-.4-1.9-1.7-3-3.4-3.2"/></Svg>
const IcoFlecha = (p) => <Svg {...p}><path d="m9 18 6-6-6-6"/></Svg>
const IcoAtras = (p) => <Svg {...p}><path d="m15 18-6-6 6-6"/></Svg>
const IcoCheck = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></Svg>
const IcoDobleCheck = (p) => <Svg {...p}><path d="m2 12.5 4.5 4.5L16 7.5"/><path d="m11.5 16.5.5.5L21.5 7.5"/></Svg>
const IcoReloj = (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></Svg>
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>
const IcoClip = (p) => <Svg {...p}><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></Svg>
const IcoEnviar = (p) => <Svg {...p}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></Svg>
const IcoImagen = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5.2-5.2L5 20"/></Svg>
const IcoDescargar = (p) => <Svg {...p}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></Svg>
const IcoHistorial = (p) => <Svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></Svg>
const IcoVerificado = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path fill="currentColor" d="M12 1.8 14.6 4l3.4-.3.9 3.3 3 1.6-1.2 3.2 1.2 3.2-3 1.6-.9 3.3-3.4-.3L12 22.2 9.4 20l-3.4.3-.9-3.3-3-1.6L3.3 12 2.1 8.8l3-1.6.9-3.3L9.4 4z"/>
    <path d="m8 12.2 2.7 2.7L16.2 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const Spinner = ({ className = 'h-3.5 w-3.5' }) => <span aria-hidden="true" className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}/>

function Avatar({ nombre, className = 'h-[52px] w-[52px] text-[16px]', color }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white shadow-[0_4px_10px_-6px_rgba(15,23,42,0.5)] dark:ring-[#162032] ${className}`} style={{ background: color ?? colorAvatar(nombre) }}>
      {iniciales(nombre)}
    </span>
  )
}

function Presencia({ persona, className = '' }) {
  const p = presencia(persona)
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${p.en ? 'bg-[#08a553]' : 'bg-[#8c94b2]'}`}/>
      <span className={`truncate ${p.en ? 'font-medium text-[#0b5c35] dark:text-emerald-300' : 'text-[#495179] dark:text-slate-400'}`}>{p.texto}</span>
    </span>
  )
}

// ── Banner ────────────────────────────────────────────────────────────────────
function Banner({ soyExperto }) {
  return (
    <section className={`relative shrink-0 overflow-hidden ${CARD}`}>
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-br from-[#f2f8fb] via-white to-[#ecf7ef] dark:from-[#0f1a26] dark:via-[#111c2b] dark:to-[#0f1d17]"/>
      <img
        src={heroConsultas}
        alt=""
        aria-hidden="true"
        draggable="false"
        className="absolute inset-y-0 right-0 h-full w-[72%] select-none object-cover object-[62%_50%] [mask-image:linear-gradient(to_right,transparent,#000_32%)] sm:w-[64%] dark:brightness-[0.5]"
      />
      {/* En pantallas angostas el texto queda sobre la foto: una capa clara lo mantiene legible */}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-white/95 via-white/80 to-white/20 sm:hidden dark:from-[#111c2b]/95 dark:via-[#111c2b]/80 dark:to-[#111c2b]/20"/>
      <div className="relative flex min-h-[136px] items-center gap-4 px-4 py-3.5 sm:pl-5 [@media(max-height:700px)]:min-h-[112px]">
        <span className="hidden h-[88px] w-[88px] shrink-0 place-items-center rounded-full bg-white/60 ring-1 ring-white/80 shadow-[0_10px_26px_-18px_rgba(15,60,40,0.5)] sm:grid dark:bg-white/[0.06] dark:ring-white/10 [@media(max-height:700px)]:h-[74px] [@media(max-height:700px)]:w-[74px]">
          <span className="grid h-[66px] w-[66px] place-items-center rounded-[18px] bg-linear-to-b from-[#12a35c] to-[#048a47] text-white shadow-[0_10px_20px_-10px_rgba(2,120,60,0.85)] [@media(max-height:700px)]:h-[56px] [@media(max-height:700px)]:w-[56px] [@media(max-height:700px)]:rounded-[15px]">
            <IcoChat className="h-9 w-9 [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8" sw={1.9}/>
          </span>
        </span>
        <div className="min-w-0">
          <h2 className={`text-[26px] leading-tight sm:text-[29px] [@media(max-height:700px)]:text-[25px] ${TITULO}`}>
            Con<span className="text-[#0d7a42] dark:text-emerald-400">sultas</span>
          </h2>
          <p className="mt-1 max-w-[340px] text-[12.5px] leading-snug text-[#4a5578] sm:text-[13.5px] dark:text-slate-300">
            {soyExperto
              ? 'Responde las dudas de los agricultores y revisa los análisis que te envían.'
              : 'Resuelve tus dudas con expertos en agricultura y obtén asesoramiento confiable.'}
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Lista de la izquierda ─────────────────────────────────────────────────────
function FilaPersona({ persona, subtitulo, noLeidos, seleccionado, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={seleccionado}
        className={`relative flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left transition [@media(max-height:700px)]:py-2 ${
          seleccionado
            ? 'border-[#1f9d55] bg-[#e5f7ea] shadow-[0_6px_16px_-12px_rgba(15,110,60,0.6)] ring-1 ring-[#1f9d55] dark:border-emerald-400 dark:bg-emerald-400/10 dark:ring-emerald-400'
            : 'border-[#eceff1] bg-[#f8f9f9] hover:border-[#cfe8d9] hover:bg-[#f2faf5] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
        }`}
      >
        <Avatar nombre={persona.nombre} className="h-[56px] w-[56px] text-[17px] [@media(max-height:700px)]:h-[48px] [@media(max-height:700px)]:w-[48px] [@media(max-height:700px)]:text-[15px]"/>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-extrabold text-[#0b1226] dark:text-white">{persona.nombre}</span>
          <span className="block truncate text-[12px] text-[#3c4a5f] dark:text-slate-300">{subtitulo}</span>
          <Presencia persona={persona} className="mt-1 max-w-full text-[11px]"/>
        </span>
        {noLeidos > 0 && (
          <>
            <span aria-hidden="true" className="grid h-[20px] min-w-[20px] shrink-0 place-items-center rounded-full bg-[#0b7a45] px-1.5 text-[10.5px] font-bold text-white dark:bg-emerald-400 dark:text-[#04130b]">{noLeidos}</span>
            <span className="sr-only">, {noLeidos} {noLeidos === 1 ? 'mensaje sin leer' : 'mensajes sin leer'}</span>
          </>
        )}
        {seleccionado ? (
          <span className="absolute right-2.5 top-2.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-[#16a05c] text-white shadow-sm dark:bg-emerald-500"><IcoCheck className="h-3.5 w-3.5" sw={3}/></span>
        ) : (
          <IcoFlecha className="h-[18px] w-[18px] text-[#171b3f] dark:text-slate-300"/>
        )}
      </button>
    </li>
  )
}

function ListaVacia({ titulo, texto }) {
  return (
    <div className="flex flex-col items-center px-5 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e3f6ec] text-[#0b8a4b] dark:bg-emerald-400/10 dark:text-emerald-400"><IcoGrupo className="h-6 w-6"/></span>
      <p className={`mt-3 text-[13px] ${TITULO}`}>{titulo}</p>
      <p className={`mt-1 max-w-[260px] text-[11.5px] leading-snug ${TENUE}`}>{texto}</p>
    </div>
  )
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function TarjetaDocumento({ m, onAbrir, onDescargar }) {
  const subiendo = m._estado === 'enviando'
  return (
    <span className="flex min-w-[220px] max-w-full items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/85 p-2 dark:border-white/10 dark:bg-white/[0.06]">
      <button type="button" onClick={onAbrir} disabled={subiendo} title="Abrir el PDF" className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default">
        <span aria-hidden="true" className="grid h-[40px] w-[34px] shrink-0 place-items-center rounded-[6px] bg-[#e5484d] text-[9px] font-extrabold tracking-wide text-white shadow-sm">PDF</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-[#0b1226] dark:text-white">{m.documento_nombre}</span>
          {subiendo ? (
            <span className="mt-1 block">
              <span className="block h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><span className="block h-full rounded-full bg-[#16a05c] transition-[width]" style={{ width: `${Math.round((m._progreso ?? 0) * 100)}%` }}/></span>
              <span className={`mt-0.5 block text-[10px] ${TENUE}`}>Subiendo… {Math.round((m._progreso ?? 0) * 100)}%</span>
            </span>
          ) : (
            <span className={`block text-[10.5px] ${TENUE}`}>{pesoArchivo(m.documento_tamano ?? 0)} · PDF</span>
          )}
        </span>
      </button>
      {!subiendo && (
        <button type="button" onClick={onDescargar} aria-label={`Descargar ${m.documento_nombre}`} title="Descargar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#334155] transition hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10">
          <IcoDescargar className="h-4 w-4"/>
        </button>
      )}
    </span>
  )
}

function Burbuja({ m, mia, otro, me, primero, leida, onReintentar, onZoom, onImagen, onAbrirDoc, onDescargarDoc }) {
  const fecha = fechaApi(m.created_at) ?? new Date()
  const avatar = primero
    ? <Avatar nombre={mia ? me.nombre : otro.nombre} color={mia ? '#03824a' : undefined} className={mia ? 'mt-0.5 h-[34px] w-[34px] text-[12px]' : 'mt-0.5 h-[30px] w-[30px] text-[11px]'}/>
    : <span aria-hidden="true" className={mia ? 'w-[34px] shrink-0' : 'w-[30px] shrink-0'}/>
  return (
    <div className={`flex items-start gap-2 ${mia ? 'flex-row-reverse' : ''}`}>
      {avatar}
      <div className={`max-w-[78%] rounded-2xl px-3 pb-1.5 pt-2 text-[13px] leading-snug shadow-[0_1px_2px_rgba(15,23,42,0.07)] sm:max-w-[68%] ${
        mia
          ? `${primero ? 'rounded-tr-md' : ''} border border-[#cdebd2] bg-[#dff5e1] text-[#0b1226] dark:border-emerald-400/20 dark:bg-emerald-600/25 dark:text-slate-50`
          : `${primero ? 'rounded-tl-md' : ''} bg-[#f0f2f7] text-[#1b2333] dark:bg-[#1f2b3d] dark:text-slate-100`
      } ${m._estado === 'error' ? 'ring-1 ring-red-400' : ''}`}
      >
        {m.imagen_url && (
          <button type="button" onClick={() => onZoom(m.imagen_url)} aria-label="Ampliar la foto" className="mb-1 block cursor-zoom-in overflow-hidden rounded-xl">
            <img src={m.imagen_url} alt="Foto enviada en el chat" onLoad={onImagen} className="max-h-[220px] w-auto max-w-full object-cover"/>
          </button>
        )}
        {m.documento_nombre && <div className="mb-1"><TarjetaDocumento m={m} onAbrir={() => onAbrirDoc(m)} onDescargar={() => onDescargarDoc(m)}/></div>}
        {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
        <p className={`mt-0.5 flex items-center justify-end gap-1 text-[9.5px] ${mia ? 'text-[#5d7a66] dark:text-emerald-100/70' : 'text-[#8088a5] dark:text-slate-400'}`}>
          {hora(fecha)}
          {mia && (m._estado === 'enviando' ? (
            <span title="Enviando"><IcoReloj className="h-3 w-3"/></span>
          ) : m._estado === 'error' ? null : leida ? (
            <span className="text-[#3b8fd6]" title="Leído"><IcoDobleCheck className="h-3.5 w-3.5" sw={2.4}/></span>
          ) : (
            <span title="Enviado"><IcoCheck className="h-3 w-3" sw={2.6}/></span>
          ))}
        </p>
        {m._estado === 'error' && (
          <p className="mt-1 flex flex-wrap items-center justify-end gap-x-2 text-[10.5px] text-red-600 dark:text-red-300">
            {m._error}
            <button type="button" onClick={onReintentar} className="font-bold underline">Reintentar</button>
          </p>
        )}
      </div>
    </div>
  )
}

// Conversación con `otro`. consultaId puede ser null (aún no se han escrito): el chat se crea con el
// primer mensaje mediante onCrear() → id.
function Chat({ consultaId, otro, me, otroEsExperto, onCrear, onCambio, onBack, onGoHistorial }) {
  const [idChat, setIdChat] = useState(consultaId)
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(!!consultaId)
  const [errorCarga, setErrorCarga] = useState('')
  const [leidoOtro, setLeidoOtro] = useState(null)
  const [texto, setTexto] = useState('')
  const [adjunto, setAdjunto] = useState(null)   // { tipo: 'imagen', dataUrl } | { tipo: 'pdf', file, nombre, tamano }
  const [procesando, setProcesando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [zoom, setZoom] = useState(null)
  const [hayNuevosAbajo, setHayNuevosAbajo] = useState(false)
  const listaRef = useRef(null)
  const archivoRef = useRef(null)
  const pegadoAbajo = useRef(true)
  const mensajesRef = useRef([])
  const idRef = useRef(consultaId)
  const creandoRef = useRef(null)
  const urlsLocales = useRef([])
  const onCambioRef = useRef(onCambio)
  useEffect(() => { onCambioRef.current = onCambio })
  useEffect(() => { mensajesRef.current = mensajes }, [mensajes])
  useEffect(() => () => urlsLocales.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const marcarLeida = useCallback(async (id) => {
    try {
      await marcarConsultaLeida(id)
      onCambioRef.current?.()
    } catch { /* se reintenta con el siguiente mensaje */ }
  }, [])

  // Carga inicial (solo la conversación con la que se abrió el chat: si se crea con el primer
  // mensaje, el id nuevo no debe volver a cargar y borrar el mensaje que se está enviando)
  const idInicial = useRef(consultaId)
  useEffect(() => {
    const id = idInicial.current
    if (!id) return undefined
    let vivo = true
    ;(async () => {
      try {
        const { data } = await fetchMensajesConsulta(id)
        if (!vivo) return
        setMensajes(data.mensajes)
        setLeidoOtro(data.leido_contraparte_at)
        pegadoAbajo.current = true
        marcarLeida(id)
      } catch (err) {
        if (vivo) setErrorCarga(apiErrorMessage(err, 'No se pudo abrir la conversación.'))
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [marcarLeida])

  // Mensajes nuevos cada 5 s (solo con la pestaña visible)
  useEffect(() => {
    if (!idChat) return undefined
    const t = setInterval(async () => {
      if (document.hidden) return
      const confirmados = mensajesRef.current.filter((m) => !m._estado)
      const ultimo = confirmados[confirmados.length - 1]
      const despues = ultimo ? new Date(fechaApi(ultimo.created_at).getTime() - MARGEN_MS).toISOString() : undefined
      try {
        const { data } = await fetchMensajesConsulta(idChat, despues)
        const conocidos = new Set(confirmados.map((m) => m.id))
        const nuevos = data.mensajes.filter((m) => !conocidos.has(m.id))
        if (nuevos.length) {
          if (!pegadoAbajo.current) setHayNuevosAbajo(true)
          setMensajes((prev) => fusionar(prev, data.mensajes))
        }
        setLeidoOtro(data.leido_contraparte_at)
        if (nuevos.some((m) => m.autor_id !== me.id)) marcarLeida(idChat)
      } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
    }, POLL_CHAT_MS)
    return () => clearInterval(t)
  }, [idChat, me.id, marcarLeida])

  // Bajar al último mensaje si el usuario ya estaba abajo
  useEffect(() => {
    const el = listaRef.current
    if (el && pegadoAbajo.current) el.scrollTop = el.scrollHeight
  }, [mensajes, cargando])

  const onScroll = () => {
    const el = listaRef.current
    if (!el) return
    pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (pegadoAbajo.current) setHayNuevosAbajo(false)
  }
  const alCargarImagen = () => {
    const el = listaRef.current
    if (el && pegadoAbajo.current) el.scrollTop = el.scrollHeight
  }
  const irAbajo = () => {
    const el = listaRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    pegadoAbajo.current = true
    setHayNuevosAbajo(false)
  }

  // El chat se crea con el primer envío (una sola vez aunque se manden varios seguidos)
  const asegurarChat = async () => {
    if (idRef.current) return idRef.current
    if (!creandoRef.current) {
      creandoRef.current = onCrear().then((id) => {
        idRef.current = id
        setIdChat(id)
        return id
      }).finally(() => { creandoRef.current = null })
    }
    return creandoRef.current
  }

  const actualizar = (clientId, cambios) => setMensajes((prev) => prev.map((x) => (x._estado && x.client_id === clientId ? { ...x, ...cambios } : x)))

  const mandar = async (m) => {
    try {
      const id = await asegurarChat()
      const { data } = m._archivo
        ? await enviarDocumentoConsulta(id, { archivo: m._archivo, texto: m.texto, client_id: m.client_id }, (p) => actualizar(m.client_id, { _progreso: p }))
        : await enviarMensajeConsulta(id, { texto: m.texto ?? undefined, imagen_url: m.imagen_url ?? undefined, client_id: m.client_id })
      setMensajes((prev) => fusionar(prev.filter((x) => !(x._estado && x.client_id === m.client_id)), [data]))
      onCambioRef.current?.()
    } catch (err) {
      actualizar(m.client_id, { _estado: 'error', _error: apiErrorMessage(err, 'No se pudo enviar.') })
    }
  }

  const enviar = () => {
    const t = texto.trim()
    if ((!t && !adjunto) || procesando) return
    const client_id = nuevoId()
    const pendiente = {
      id: `pendiente-${client_id}`, client_id, autor_id: me.id, texto: t || null, created_at: ahoraApi(), _estado: 'enviando',
      imagen_url: adjunto?.tipo === 'imagen' ? adjunto.dataUrl : null,
      documento_nombre: adjunto?.tipo === 'pdf' ? adjunto.nombre : null,
      documento_tamano: adjunto?.tipo === 'pdf' ? adjunto.tamano : null,
      _archivo: adjunto?.tipo === 'pdf' ? adjunto.file : null,
      _progreso: 0,
    }
    setMensajes((prev) => [...prev, pendiente])
    setTexto('')
    setAdjunto(null)
    setAviso('')
    pegadoAbajo.current = true
    mandar(pendiente)
  }

  const reintentar = (m) => {
    actualizar(m.client_id, { _estado: 'enviando', _error: undefined, _progreso: 0 })
    mandar(m)
  }

  // Imagen (se comprime) o PDF (≤ 10 MB, se envía tal cual)
  const tomarArchivo = async (file) => {
    if (!file) return
    setAviso('')
    const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (esPdf) {
      if (file.size > PDF_MAX_BYTES) { setAviso('El PDF supera los 10 MB.'); return }
      if (!file.size) { setAviso('El archivo está vacío.'); return }
      setAdjunto({ tipo: 'pdf', file, nombre: file.name, tamano: file.size })
      return
    }
    if (!file.type.startsWith('image/')) { setAviso('Solo puedes adjuntar imágenes (JPG, PNG, WEBP) o documentos PDF.'); return }
    setProcesando(true)
    try {
      setAdjunto({ tipo: 'imagen', dataUrl: await comprimirImagen(file), nombre: file.name })
    } catch (err) {
      setAviso(err.message)
    } finally {
      setProcesando(false)
    }
  }
  const elegirArchivo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    tomarArchivo(file)
  }
  const arrastre = {
    onDragOver: (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); setArrastrando(true) } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setArrastrando(false) },
    onDrop: (e) => { e.preventDefault(); setArrastrando(false); tomarArchivo(e.dataTransfer.files?.[0]) },
  }

  // Abrir un PDF: la pestaña se abre en el mismo clic (si no, el navegador la bloquea) y luego se carga
  const abrirDocumento = async (m) => {
    const ventana = window.open('', '_blank')
    try {
      const { data } = await descargarDocumentoConsulta(idRef.current, m.id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      urlsLocales.current.push(url)
      if (ventana) {
        ventana.opener = null
        ventana.location.href = url
      } else {
        guardarComo(url, m.documento_nombre)
      }
    } catch (err) {
      ventana?.close()
      setAviso(apiErrorMessage(err, 'No se pudo abrir el documento.'))
    }
  }
  const descargarDocumento = async (m) => {
    try {
      const { data } = await descargarDocumentoConsulta(idRef.current, m.id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      urlsLocales.current.push(url)
      guardarComo(url, m.documento_nombre)
    } catch (err) {
      setAviso(apiErrorMessage(err, 'No se pudo descargar el documento.'))
    }
  }

  const grupos = []
  for (const m of mensajes) {
    const fecha = fechaApi(m.created_at) ?? new Date()
    const dia = diaDe(fecha)
    if (!grupos.length || grupos[grupos.length - 1].dia !== dia) grupos.push({ dia, mensajes: [] })
    grupos[grupos.length - 1].mensajes.push(m)
  }
  const leidoHasta = fechaApi(leidoOtro)
  const p = presencia(otro)
  const subtitulo = otroEsExperto ? (otro.especialidad || 'Experto de AgroScan') : 'Agricultor'

  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden ${CARD}`} {...arrastre}>
      {/* Cabecera */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[#e6edf0] bg-[#f3f7f8] px-3.5 py-2.5 sm:px-4 dark:border-white/10 dark:bg-[#131d2e] [@media(max-height:700px)]:py-2">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Volver a la lista" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#334155] transition hover:bg-black/5 lg:hidden dark:text-slate-300 dark:hover:bg-white/10">
            <IcoAtras className="h-5 w-5"/>
          </button>
        )}
        <Avatar nombre={otro.nombre} className="h-[50px] w-[50px] text-[16px] [@media(max-height:700px)]:h-[42px] [@media(max-height:700px)]:w-[42px] [@media(max-height:700px)]:text-[14px]"/>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-extrabold text-[#0b1226] dark:text-white">{otro.nombre}</span>
            {otroEsExperto && <span className="text-[#16a05c] dark:text-emerald-400" title="Experto verificado: el administrador le asignó este rol"><IcoVerificado className="h-[16px] w-[16px]"/></span>}
          </p>
          <p className="truncate text-[12px] text-[#3c4a5f] dark:text-slate-300">{subtitulo}</p>
        </div>
        <span className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold shadow-[0_4px_10px_-8px_rgba(15,60,40,0.6)] ${
          p.en ? 'bg-[#dff3e6] text-[#0b5c35] dark:bg-emerald-400/15 dark:text-emerald-200' : 'bg-[#eef0f3] text-[#4b5563] dark:bg-white/[0.06] dark:text-slate-300'
        }`}
        >
          <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${p.en ? 'bg-[#08a553]' : 'bg-[#8c94b2]'}`}/>
          <span className="max-w-[120px] truncate sm:max-w-none">{p.texto}</span>
        </span>
      </header>

      {/* Mensajes */}
      <div className="relative min-h-0 flex-1">
        <div ref={listaRef} onScroll={onScroll} className="h-full space-y-3 overflow-y-auto bg-[#fcfdfc] px-3.5 py-3 sm:px-4 dark:bg-[#111a28]" aria-live="polite" aria-label="Mensajes">
          {cargando ? (
            <div className="flex h-full items-center justify-center"><Spinner className="h-6 w-6 text-[#0b8a4b]"/></div>
          ) : errorCarga ? (
            <p className="py-8 text-center text-[12px] text-red-600 dark:text-red-400">{errorCarga}</p>
          ) : mensajes.length === 0 ? (
            <div className="mx-auto flex max-w-[400px] flex-col items-center py-6 text-center">
              <Avatar nombre={otro.nombre} className="h-[56px] w-[56px] text-[18px]"/>
              <p className={`mt-2.5 text-[14px] ${TITULO}`}>Escríbele a {otro.nombre}</p>
              <p className={`mt-1 text-[12px] leading-snug ${TENUE}`}>
                {otroEsExperto
                  ? 'Cuéntale tu duda. Si quieres que revise un análisis, descarga su PDF en tu historial y adjúntalo aquí.'
                  : 'Aún no hay mensajes en esta conversación.'}
              </p>
              {otroEsExperto && onGoHistorial && (
                <button type="button" onClick={onGoHistorial} className="mt-3 inline-flex h-[32px] items-center gap-1.5 rounded-full border border-[#cfe8d9] bg-white px-3.5 text-[11.5px] font-semibold text-[#0b6b35] transition hover:bg-[#f2faf5] dark:border-white/10 dark:bg-white/5 dark:text-emerald-300">
                  <IcoHistorial className="h-3.5 w-3.5"/>
                  Ir a mi historial
                </button>
              )}
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.dia} className="space-y-2">
                <p className="mx-auto w-fit rounded-full bg-[#eef1f4] px-2.5 py-0.5 text-[10px] font-semibold text-[#55607a] dark:bg-white/[0.06] dark:text-slate-300">{g.dia}</p>
                {g.mensajes.map((m, i) => {
                  const mia = m.autor_id === me.id
                  const anterior = g.mensajes[i - 1]
                  const leida = mia && !m._estado && leidoHasta && leidoHasta >= (fechaApi(m.created_at) ?? new Date())
                  return (
                    <Burbuja
                      key={m.id}
                      m={m}
                      mia={mia}
                      otro={otro}
                      me={me}
                      primero={!anterior || anterior.autor_id !== m.autor_id}
                      leida={leida}
                      onReintentar={() => reintentar(m)}
                      onZoom={setZoom}
                      onImagen={alCargarImagen}
                      onAbrirDoc={abrirDocumento}
                      onDescargarDoc={descargarDocumento}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>
        {hayNuevosAbajo && (
          <button type="button" onClick={irAbajo} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0b7a45] px-3 py-1 text-[11px] font-semibold text-white shadow-lg">
            Nuevos mensajes ↓
          </button>
        )}
      </div>

      {/* Adjuntar y escribir */}
      <div className="shrink-0 space-y-2.5 bg-white px-3.5 pb-3.5 pt-2.5 sm:px-4 dark:bg-[#162032] [@media(max-height:700px)]:space-y-2 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-2">
        <input ref={archivoRef} type="file" accept="image/*,application/pdf,.pdf" onChange={elegirArchivo} className="hidden" tabIndex={-1} aria-hidden="true"/>
        {adjunto || procesando ? (
          <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-[#a8dcbc] bg-[#ecfaf0] px-3 py-2 dark:border-emerald-400/30 dark:bg-emerald-400/[0.06]">
            {procesando ? (
              <span className={`flex items-center gap-2 text-[12px] ${TENUE}`}><Spinner/>Preparando la foto…</span>
            ) : adjunto.tipo === 'imagen' ? (
              <img src={adjunto.dataUrl} alt="Foto a enviar" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-black/10"/>
            ) : (
              <span aria-hidden="true" className="grid h-[42px] w-[36px] shrink-0 place-items-center rounded-[6px] bg-[#e5484d] text-[9px] font-extrabold tracking-wide text-white">PDF</span>
            )}
            {adjunto && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-[#11663a] dark:text-emerald-200">{adjunto.tipo === 'pdf' ? adjunto.nombre : 'Foto lista para enviar'}</span>
                <span className={`block text-[11px] ${TENUE}`}>{adjunto.tipo === 'pdf' ? `${pesoArchivo(adjunto.tamano)} · se enviará con tu mensaje` : 'Se enviará con tu mensaje'}</span>
              </span>
            )}
            {adjunto && (
              <button type="button" onClick={() => setAdjunto(null)} aria-label="Quitar el archivo" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#334155] transition hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10">
                <IcoX className="h-4 w-4"/>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => archivoRef.current?.click()}
            className={`flex w-full items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-dashed px-4 py-2.5 text-left transition [@media(max-height:700px)]:py-1.5 ${
              arrastrando
                ? 'border-[#16a05c] bg-[#dcf4e4] dark:border-emerald-400 dark:bg-emerald-400/15'
                : 'border-[#a8dcbc] bg-[#ecfaf0] hover:bg-[#e3f6ea] dark:border-emerald-400/30 dark:bg-emerald-400/[0.06] dark:hover:bg-emerald-400/10'
            }`}
          >
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[#dcf3e4] text-[#0b6b35] dark:bg-emerald-400/15 dark:text-emerald-300 [@media(max-height:700px)]:h-[32px] [@media(max-height:700px)]:w-[32px]">
              <IcoImagen className="h-5 w-5"/>
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-[#11663a] dark:text-emerald-200">
                {otroEsExperto ? 'Adjunta una imagen o el PDF de tu análisis (opcional)' : 'Adjunta una imagen o un PDF (opcional)'}
              </span>
              <span className={`hidden text-[11px] sm:block ${TENUE}`}>{arrastrando ? 'Suelta el archivo aquí' : 'Arrastra tu archivo o haz clic para subirlo · PDF hasta 10 MB'}</span>
            </span>
          </button>
        )}
        {aviso && <p role="alert" className="text-[11.5px] text-red-600 dark:text-red-400">{aviso}</p>}
        <div className="flex items-end gap-2.5">
          <div className="flex min-h-[44px] min-w-0 flex-1 items-end gap-1.5 rounded-[14px] border border-[#e3e8ef] bg-white px-2 py-1 transition focus-within:border-[#9fd8b7] focus-within:ring-2 focus-within:ring-emerald-500/15 dark:border-white/10 dark:bg-white/[0.04]">
            <button type="button" onClick={() => archivoRef.current?.click()} disabled={procesando} aria-label="Adjuntar una imagen o un PDF" title="Adjuntar una imagen o un PDF" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#67728b] transition hover:bg-black/5 hover:text-[#0b6b35] disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10">
              <IcoClip className="h-[18px] w-[18px]"/>
            </button>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Mensaje</span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  // En pantallas táctiles Enter hace un salto de línea (se envía con el botón)
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia?.('(pointer: coarse)').matches) {
                    e.preventDefault()
                    enviar()
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Escribe tu mensaje aquí..."
                className="block max-h-[120px] min-h-[34px] w-full resize-none bg-transparent py-[7px] text-[13px] leading-snug text-[#0b1226] outline-none [field-sizing:content] placeholder:text-[#8a93ad] dark:text-slate-100"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={enviar}
            disabled={(!texto.trim() && !adjunto) || procesando}
            aria-label="Enviar mensaje"
            className="grid h-[44px] w-[50px] shrink-0 place-items-center rounded-[14px] bg-linear-to-b from-[#3fae5b] to-[#22964a] text-white shadow-[0_8px_16px_-8px_rgba(20,140,70,0.85)] transition hover:brightness-105 disabled:cursor-default disabled:opacity-60 dark:from-emerald-500 dark:to-emerald-600"
          >
            <IcoEnviar className="h-[19px] w-[19px]"/>
          </button>
        </div>
      </div>

      {zoom && (
        <ZoomOverlay label="Foto del chat" onClose={() => setZoom(null)}>
          <img src={zoom} alt="Foto del chat" className="h-full w-full object-contain"/>
        </ZoomOverlay>
      )}
    </section>
  )
}

function guardarComo(url, nombre) {
  const a = document.createElement('a')
  a.href = url
  a.download = nombre || 'documento.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function SinSeleccion({ texto }) {
  return (
    <section className={`hidden h-full flex-col items-center justify-center p-8 text-center lg:flex ${CARD}`}>
      <span className="grid h-16 w-16 place-items-center rounded-full bg-[#ecfaf0] text-[#0b8a4b] dark:bg-emerald-400/10 dark:text-emerald-400"><IcoChat className="h-8 w-8"/></span>
      <p className={`mt-3 text-[14px] ${TITULO}`}>Selecciona una conversación</p>
      <p className={`mt-1 max-w-[320px] text-[12px] leading-snug ${TENUE}`}>{texto}</p>
    </section>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Consultas({ me, seleccion, onNovedades, onGoHistorial }) {
  const soyExperto = me.rol === 'experto'
  const escritorio = useEsEscritorio()
  const [expertos, setExpertos] = useState(null)   // null = cargando (solo para quien consulta)
  const [chats, setChats] = useState(null)         // conversaciones (GET /consultas)
  const [error, setError] = useState('')
  const [sel, setSel] = useState(null)             // id del experto (quien consulta) o de la consulta (experto)
  const pendienteSel = useRef(seleccion?.id ?? null)
  const onNovedadesRef = useRef(onNovedades)
  useEffect(() => { onNovedadesRef.current = onNovedades })

  const cargar = useCallback(async () => {
    try {
      const [{ data: lista }, expertosResp] = await Promise.all([fetchConsultas(), soyExperto ? Promise.resolve(null) : fetchExpertos()])
      setChats(Array.isArray(lista) ? lista : [])
      if (expertosResp) setExpertos(Array.isArray(expertosResp.data) ? expertosResp.data : [])
      setError('')
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron cargar las consultas.'))
      setChats((c) => c ?? [])
      setExpertos((e) => e ?? [])
    }
  }, [soyExperto])

  useEffect(() => {
    cargar()
    const t = setInterval(() => { if (!document.hidden) cargar() }, POLL_LISTA_MS)
    return () => clearInterval(t)
  }, [cargar])

  // Desde la campana estando ya en la página
  useEffect(() => {
    if (seleccion?.id) {
      pendienteSel.current = seleccion.id
      cargar()
    }
  }, [seleccion, cargar])

  // Chat general de cada experto (para quien consulta)
  const chatDeExperto = useMemo(() => {
    const mapa = new Map()
    for (const c of chats ?? []) {
      if (c.tipo === 'general' && c.rol_en_consulta === 'solicitante' && c.estado === 'abierta') mapa.set(c.contraparte.id, c)
    }
    return mapa
  }, [chats])

  // Selección: la conversación pedida desde la campana o, en escritorio, la más reciente / el primer experto
  useEffect(() => {
    if (chats === null || (!soyExperto && expertos === null)) return
    if (pendienteSel.current) {
      const c = chats.find((x) => x.id === pendienteSel.current)
      if (c) {
        setSel(soyExperto ? c.id : c.contraparte.id)
        pendienteSel.current = null
        return
      }
    }
    if (sel || !escritorio) return
    if (soyExperto) {
      if (chats.length) setSel(chats[0].id)
    } else {
      const reciente = chats.find((c) => c.tipo === 'general' && c.rol_en_consulta === 'solicitante' && c.estado === 'abierta')
      const primero = reciente && expertos.some((e) => e.id === reciente.contraparte.id) ? reciente.contraparte.id : expertos[0]?.id
      if (primero) setSel(primero)
    }
  }, [chats, expertos, soyExperto, escritorio, sel])

  const alCambiar = useCallback(() => {
    cargar()
    onNovedadesRef.current?.()
  }, [cargar])

  const abrir = (id) => {
    setSel(id)
    // Al abrirla, deja de contar como no leída (el chat la marca leída en el servidor)
    setChats((lista) => lista?.map((c) => ((soyExperto ? c.id === id : c.contraparte.id === id && c.tipo === 'general') ? { ...c, no_leidos: 0, nueva: false } : c)))
  }

  // Lo que se muestra a la derecha
  let chat = null
  if (soyExperto) {
    const c = chats?.find((x) => x.id === sel)
    if (c) {
      chat = (
        <Chat
          key={c.id}
          consultaId={c.id}
          otro={c.contraparte}
          me={me}
          otroEsExperto={c.contraparte.rol === 'experto'}
          onCambio={alCambiar}
          onBack={() => setSel(null)}
        />
      )
    }
  } else {
    const experto = expertos?.find((e) => e.id === sel)
    if (experto) {
      const c = chatDeExperto.get(experto.id)
      chat = (
        <Chat
          key={experto.id}
          consultaId={c?.id ?? null}
          otro={experto}
          me={me}
          otroEsExperto
          onCrear={async () => {
            const { data } = await crearConsulta({ experto_id: experto.id, tipo: 'general' })
            setChats((lista) => [data, ...(lista ?? []).filter((x) => x.id !== data.id)])
            return data.id
          }}
          onCambio={alCambiar}
          onBack={() => setSel(null)}
          onGoHistorial={onGoHistorial}
        />
      )
    }
  }

  const cargandoLista = chats === null || (!soyExperto && expertos === null)
  const filas = soyExperto ? (chats ?? []) : (expertos ?? [])
  const enChat = !!chat

  return (
    <div className="fade-up relative isolate flex flex-col gap-3 lg:h-[calc(100dvh-88px)] lg:min-h-[500px] lg:max-h-[880px]">
      <PageGlow/>
      <div className={enChat ? 'hidden lg:block' : ''}><Banner soyExperto={soyExperto}/></div>

      <div className={`grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[minmax(290px,1fr)_minmax(0,1.97fr)] ${enChat ? 'h-[calc(100dvh-84px)] lg:h-auto' : ''}`}>
        {/* Expertos (o agricultores, para el experto) */}
        <section className={`${enChat ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col overflow-hidden ${CARD}`}>
          <header className="flex shrink-0 items-start gap-2.5 px-4 pb-2.5 pt-3.5">
            <IcoGrupo className="mt-0.5 h-[26px] w-[26px] text-[#0b8a4b] dark:text-emerald-400" sw={1.8}/>
            <div className="min-w-0">
              <h3 className={`text-[15px] leading-tight ${TITULO}`}>{soyExperto ? 'Agricultores' : 'Nuestros Expertos'}</h3>
              <p className={`mt-0.5 text-[11.5px] leading-snug ${TENUE}`}>{soyExperto ? 'Personas que te escribieron para consultarte' : 'Selecciona un experto para iniciar la conversación'}</p>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {cargandoLista ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2].map((i) => <div key={i} className="h-[78px] animate-pulse rounded-[14px] bg-[#eef2f0] dark:bg-white/[0.05]"/>)}
              </div>
            ) : error && !filas.length ? (
              <div className="p-4 text-center">
                <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
                <button type="button" onClick={cargar} className="mt-2 rounded-full border border-[#e3e8ee] px-3 py-1 text-[11.5px] font-semibold text-[#334155] dark:border-white/10 dark:text-slate-200">Reintentar</button>
              </div>
            ) : !filas.length ? (
              soyExperto
                ? <ListaVacia titulo="Aún no tienes consultas" texto="Cuando un agricultor te escriba, aparecerá aquí y te avisaremos en la campana."/>
                : <ListaVacia titulo="Todavía no hay expertos" texto="Cuando el administrador registre a un experto, aparecerá aquí para que puedas escribirle."/>
            ) : (
              <ul className="space-y-2">
                {soyExperto
                  ? chats.map((c) => (
                    <FilaPersona
                      key={c.id}
                      persona={c.contraparte}
                      subtitulo={vistaPrevia(c.ultimo_mensaje, me.id)}
                      noLeidos={c.no_leidos}
                      seleccionado={c.id === sel}
                      onClick={() => abrir(c.id)}
                    />
                  ))
                  : expertos.map((e) => (
                    <FilaPersona
                      key={e.id}
                      persona={e}
                      subtitulo={e.especialidad || 'Experto de AgroScan'}
                      noLeidos={chatDeExperto.get(e.id)?.no_leidos ?? 0}
                      seleccionado={e.id === sel}
                      onClick={() => abrir(e.id)}
                    />
                  ))}
              </ul>
            )}
          </div>
        </section>

        {/* Conversación */}
        {chat ?? (
          <SinSeleccion texto={soyExperto ? 'Elige a un agricultor de la lista para ver sus mensajes y responderle.' : 'Elige a un experto de la lista para escribirle.'}/>
        )}
      </div>
    </div>
  )
}
