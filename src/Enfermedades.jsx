import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PageGlow } from './PageHero.jsx'
import { SEVERITY_LIMITS } from './severity.js'
import { SEVERITY_CHIP } from './resultados.js'
import heroEnfermedades from './Imagenes/enfermedades-hero.webp'
import hojaInsignia from './Imagenes/enfermedades-hoja.png'
import iconoRoya from './Imagenes/enf-icono-roya.png'
import iconoTizon from './Imagenes/enf-icono-tizon.png'
import iconoMancha from './Imagenes/enf-icono-mancha.png'
import iconoConsejo from './Imagenes/enf-icono-consejo.png'
import fotoRoya from './Imagenes/enf-foto-roya.webp'
import fotoTizon from './Imagenes/enf-foto-tizon.webp'
import fotoMancha from './Imagenes/enf-foto-mancha.webp'
import brote from './Imagenes/enf-brote.webp'
import hojasDeco from './Imagenes/inicio-hojas.png'

// ── Enfermedades del maíz que detecta AgroScan (imágenes recortadas de la maqueta del usuario) ──
// «tipo» es el tipo de patógeno; el texto corto y los síntomas clave son los de la maqueta, y la
// descripción, síntomas, condiciones y manejo del detalle son los de la guía anterior.
const DISEASES = [
  {
    key: 'roya',
    name: 'Roya',
    pathogen: 'Puccinia sorghi',
    tipo: 'Hongo',
    chip: 'bg-[#fff1df] dark:bg-orange-400/15',
    dot: 'bg-[#d75a08] dark:bg-orange-400',
    icon: iconoRoya,
    photo: fotoRoya,
    summary: 'Provoca lesiones de color amarillo anaranjado en las hojas, afectando el crecimiento y el rendimiento.',
    keySymptoms: ['Pústulas anaranjadas', 'Amarillamiento de hojas', 'Secado prematuro'],
    description: 'Produce pústulas de color café-anaranjado en ambas caras de la hoja. Las esporas se dispersan fácilmente con el viento, favoreciendo una propagación rápida entre parcelas vecinas.',
    symptoms: ['Pústulas pulverulentas color óxido', 'Se desprenden al frotar la hoja con los dedos', 'Distribuidas en toda la lámina foliar'],
    conditions: ['Temperaturas frescas (16–23 °C)', 'Alta humedad foliar', 'Viento moderado que dispersa esporas'],
    management: ['Fungicidas triazoles en etapas tempranas', 'Reducir humedad mejorando la ventilación entre surcos', 'Monitoreo más frecuente (cada 3–5 días)', 'Variedades resistentes en próximas siembras'],
  },
  {
    key: 'tizon',
    name: 'Tizón del Maíz',
    pathogen: 'Exserohilum turcicum',
    tipo: 'Hongo',
    chip: 'bg-[#ffeed8] dark:bg-amber-400/15',
    dot: 'bg-[#f09602] dark:bg-amber-400',
    icon: iconoTizon,
    photo: fotoTizon,
    summary: 'Causa manchas alargadas de color grisáceo en las hojas, reduciendo la fotosíntesis.',
    keySymptoms: ['Manchas alargadas', 'Bordes definidos', 'Secado de hojas'],
    description: 'Produce lesiones necróticas alargadas de color gris-verdoso en forma de huso. En condiciones de alta humedad las lesiones se unen y cubren gran parte del follaje, reduciendo la capacidad fotosintética.',
    symptoms: ['Manchas alargadas gris-parduzcas de bordes definidos', 'Inicia en hojas inferiores y avanza hacia arriba', 'Lesiones que se fusionan en infecciones severas'],
    conditions: ['Humedad relativa alta (>90 %)', 'Temperaturas moderadas (18–27 °C)', 'Rocío prolongado sobre las hojas'],
    management: ['Fungicidas preventivos certificados', 'Mejorar el drenaje del suelo', 'Rotación de cultivos entre temporadas', 'Vigilar parcelas adyacentes'],
  },
  {
    key: 'mancha',
    name: 'Mancha blanca',
    pathogen: 'Pantoea ananatis',
    tipo: 'Bacteria',
    chip: 'bg-[#eeeaff] dark:bg-violet-400/15',
    dot: 'bg-[#8028dc] dark:bg-violet-400',
    icon: iconoMancha,
    photo: fotoMancha,
    summary: 'Genera manchas de color blanco o gris en las hojas, pudiendo avanzar en condiciones húmedas.',
    keySymptoms: ['Manchas blancas', 'Halo amarillento', 'Reducción del área foliar'],
    description: 'Genera manchas circulares blancas o plateadas en las hojas que afectan progresivamente la fotosíntesis. En infecciones severas puede reducir el rendimiento hasta un 40 %.',
    symptoms: ['Manchas circulares pequeñas blanco-plateadas', 'Halo clorótico alrededor de la lesión', 'Distribución dispersa en toda la hoja'],
    conditions: ['Alta humedad relativa', 'Estrés hídrico del cultivo', 'Residuos de cosecha infectados en el suelo'],
    management: ['Fungicidas sistémicos según recomendación técnica', 'Riego uniforme para evitar estrés hídrico', 'Retirar residuos de cosecha infectados', 'Mejorar la sanidad del suelo con enmiendas orgánicas'],
  },
]

const SEVERITY_LEVELS = [
  { level: 'Sano', range: 'Sin área afectada', desc: 'No se detectó enfermedad. El cultivo se encuentra en buen estado.' },
  { level: 'Leve', range: `Menos del ${SEVERITY_LIMITS.moderada} %`, desc: 'Afectación inicial. Recomendable aumentar la vigilancia del cultivo.' },
  { level: 'Moderada', range: `${SEVERITY_LIMITS.moderada} – ${SEVERITY_LIMITS.grave} %`, desc: 'Afectación en progreso. Se recomienda iniciar tratamiento fitosanitario.' },
  { level: 'Grave', range: `Más del ${SEVERITY_LIMITS.grave} %`, desc: 'Afectación alta. Requiere intervención inmediata para evitar pérdidas.' },
]

const TITLE = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const MUTED = 'text-[#55607a] dark:text-slate-400'

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoBook = (p) => <Svg {...p}><path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2Z"/><path d="M12 6.5v13"/></Svg>
const IcoArrow = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>
const IcoScan = (p) => <Svg {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></Svg>

function CheckDot({ small = false }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-[#2bb34f] text-white dark:bg-emerald-500 ${small ? 'mt-px h-[13px] w-[13px]' : 'mt-px h-[15px] w-[15px]'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" className={small ? 'h-2 w-2' : 'h-2.5 w-2.5'}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </span>
  )
}

// ── Diálogo (detalle de una enfermedad y «Aprender más») ──────────────────────
function Dialog({ labelledBy, onClose, children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const previous = document.activeElement
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => panelRef.current?.focus())
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [])
  // Tab y Mayús+Tab no salen del diálogo
  const trapTab = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fade-in absolute inset-0 bg-[#0b1220]/45 backdrop-blur-[3px]" onClick={() => closeRef.current()}/>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="fade-up relative flex max-h-[calc(100dvh-10px)] w-full max-w-[680px] flex-col overflow-hidden rounded-t-[22px] border border-white/70 bg-white shadow-[0_30px_80px_-30px_rgba(2,12,8,0.6)] outline-none sm:max-h-[calc(100dvh-32px)] sm:rounded-[22px] dark:border-white/10 dark:bg-[#0f1a2b]"
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

function DialogHeader({ id, icon, title, subtitle, aside, onClose }) {
  return (
    <header className="relative shrink-0 overflow-hidden px-5 pb-3 pt-4">
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-white via-[#f4fbf7] to-[#e2f2ea] dark:from-[#0f1a2b] dark:via-[#0f1d2a] dark:to-[#11271f]"/>
      <div className="relative flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 id={id} className={`text-[17px] leading-tight ${TITLE}`}>{title}</h2>
          {subtitle && <p className={`mt-0.5 text-[11px] ${MUTED}`}>{subtitle}</p>}
        </div>
        {aside}
        <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full border border-[#e3e8ee] bg-white text-[#1f2d48] shadow-[0_2px_6px_-4px_rgba(15,23,42,0.35)] transition hover:border-[#bfe3c9] hover:text-[#0b6b35] dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
          <IcoX className="h-3.5 w-3.5" sw={2.4}/>
        </button>
      </div>
    </header>
  )
}

function TipoChip({ disease }) {
  return (
    <span className={`inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold text-[#1d2640] dark:text-slate-100 ${disease.chip}`} title="Tipo de patógeno">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${disease.dot}`}/>
      {disease.tipo}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className={`text-[12px] ${TITLE}`}>{title}</h3>
      <div className="mt-1.5">{children}</div>
    </section>
  )
}

function CheckList({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2 text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-200"><CheckDot/><span>{t}</span></li>
      ))}
    </ul>
  )
}

function DiseaseDialog({ disease, onClose }) {
  const id = `enf${useId().replace(/:/g, '')}`
  return (
    <Dialog labelledBy={id} onClose={onClose}>
      <DialogHeader
        id={id}
        onClose={onClose}
        icon={<img src={disease.icon} alt="" className="h-11 w-11 shrink-0"/>}
        title={disease.name}
        subtitle={<i>{disease.pathogen}</i>}
        aside={<TipoChip disease={disease}/>}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
        <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <img src={disease.photo} alt={`Hoja de maíz con ${disease.name.toLowerCase()}`} className="aspect-[171/198] w-full max-w-[200px] rounded-xl object-cover ring-1 ring-black/5 sm:max-w-none dark:ring-white/10"/>
          <div className="space-y-4">
            <p className="text-[12px] leading-relaxed text-[#334155] dark:text-slate-300">{disease.description}</p>
            <Section title="Síntomas"><CheckList items={disease.symptoms}/></Section>
          </div>
        </div>
        <Section title="Condiciones que la favorecen">
          <div className="flex flex-wrap gap-1.5">
            {disease.conditions.map((c) => (
              <span key={c} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#1d2640] dark:text-slate-100 ${disease.chip}`}>
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${disease.dot}`}/>
                {c}
              </span>
            ))}
          </div>
        </Section>
        <Section title="Manejo recomendado"><CheckList items={disease.management}/></Section>
        <p className={`border-t border-[#eef1f5] pt-3 text-[10.5px] leading-snug dark:border-white/10 ${MUTED}`}>
          Información de referencia. Consulta a un ingeniero agrónomo antes de aplicar cualquier tratamiento.
        </p>
      </div>
    </Dialog>
  )
}

function LearnDialog({ onClose, onGoAnalizar }) {
  const id = `apr${useId().replace(/:/g, '')}`
  return (
    <Dialog labelledBy={id} onClose={onClose}>
      <DialogHeader
        id={id}
        onClose={onClose}
        icon={<img src={hojaInsignia} alt="" className="h-11 w-11 shrink-0"/>}
        title="Cómo usar esta guía"
        subtitle="Qué detecta AgroScan y cómo se mide la severidad"
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
        <p className="text-[12px] leading-relaxed text-[#334155] dark:text-slate-300">
          AgroScan analiza fotos de hojas de maíz y reconoce tres enfermedades: <strong>roya</strong>, <strong>tizón</strong> y{' '}
          <strong>mancha blanca</strong>. Si no encuentra ninguna, la hoja se clasifica como sana. Usa esta guía para entender
          cada diagnóstico: qué la causa, cómo se ve y cómo manejarla.
        </p>
        <Section title="¿Cómo se mide la severidad?">
          <p className={`mb-2 text-[11.5px] leading-snug ${MUTED}`}>Según el porcentaje de la imagen que el modelo detecta con la enfermedad:</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SEVERITY_LEVELS.map((s) => (
              <li key={s.level} className="rounded-xl border border-[#e6ecf0] bg-[#fafcfb] p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-bold ${SEVERITY_CHIP[s.level]}`}>{s.level}</span>
                  <span className="text-[11px] font-semibold text-[#334155] dark:text-slate-300">{s.range}</span>
                </div>
                <p className={`mt-1.5 text-[11px] leading-snug ${MUTED}`}>{s.desc}</p>
              </li>
            ))}
          </ul>
        </Section>
        <p className={`text-[10.5px] leading-snug ${MUTED}`}>
          Esta guía es informativa y contempla las enfermedades incluidas en el alcance de este proyecto de tesis. No reemplaza el criterio de un ingeniero agrónomo.
        </p>
        {onGoAnalizar && (
          <button type="button" onClick={onGoAnalizar} className="inline-flex h-[32px] items-center gap-2 rounded-full bg-[#0b7a45] px-4 text-[11.5px] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(2,137,75,0.7)] transition hover:bg-[#096b3c]">
            <IcoScan className="h-4 w-4"/>
            Analizar una hoja
          </button>
        )}
      </div>
    </Dialog>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
function Hero({ onLearn }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] bg-[#eef6f0] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10 dark:bg-[#0f1a2b]">
      <img src={heroEnfermedades} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-right dark:brightness-[0.45]"/>
      <div className="absolute inset-0 bg-linear-to-r from-white/90 via-white/70 to-white/10 sm:hidden dark:hidden"/>
      <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block"/>
      <img src={hojaInsignia} alt="" aria-hidden="true" draggable="false" className="absolute left-[6px] top-[3px] hidden h-[104px] w-[104px] select-none sm:block dark:opacity-80"/>
      <div className="relative flex min-h-[146px] flex-col justify-center px-4 py-4 sm:pl-[116px]">
        <h2 className={`text-[21px] leading-tight sm:text-[23px] ${TITLE}`}>
          Guía de <span className="text-[#0b7a45] dark:text-emerald-400">Enfermedades</span>
        </h2>
        <p className="mt-1.5 max-w-[290px] text-[12px] leading-snug text-[#1d2640] dark:text-slate-300">
          Conoce, identifica y aprende sobre las principales enfermedades del maíz.
        </p>
        <button
          type="button"
          onClick={onLearn}
          className="mt-3 inline-flex h-[27px] w-fit items-center gap-2 rounded-full bg-linear-to-r from-[#0b7a45] to-[#0a6b3d] px-3.5 text-[11px] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(7,124,71,0.8)] transition hover:brightness-110 dark:from-emerald-600 dark:to-emerald-700"
        >
          <IcoBook className="h-3.5 w-3.5"/>
          Aprender más
          <IcoArrow className="h-3.5 w-3.5"/>
        </button>
      </div>
    </section>
  )
}

function DiseaseCard({ disease, onOpen }) {
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e6ecf0] bg-white p-[9px] pb-2.5 shadow-[0_8px_24px_-18px_rgba(15,40,30,0.35)] dark:border-[#1e3048] dark:bg-[#162032]">
      <img src={hojasDeco} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[46px] w-auto select-none opacity-70 dark:opacity-10"/>
      <header className="relative flex items-center gap-[11px] pr-1">
        <img src={disease.icon} alt="" className="h-11 w-11 shrink-0"/>
        <div className="min-w-0 flex-1">
          <h3 className={`truncate text-[15px] leading-tight ${TITLE}`}>{disease.name}</h3>
          <p className="mt-0.5 truncate text-[11.5px] italic text-[#55607a] dark:text-slate-400">{disease.pathogen}</p>
        </div>
        <span className="self-start pt-0.5"><TipoChip disease={disease}/></span>
      </header>
      <div className="relative mt-3 grid grid-cols-[116px_minmax(0,1fr)] gap-3">
        <img src={disease.photo} alt={`Hoja de maíz con ${disease.name.toLowerCase()}`} className="h-[137px] w-[116px] rounded-xl object-cover ring-1 ring-black/5 dark:ring-white/10"/>
        <div className="min-w-0">
          <p className="text-[11px] leading-[16px] text-[#1d2640] dark:text-slate-200">{disease.summary}</p>
          <div className="my-2 h-px bg-[#eef1f5] dark:bg-white/10"/>
          <p className={`text-[11px] ${TITLE}`}>Síntomas clave:</p>
          <ul className="mt-1 space-y-1">
            {disease.keySymptoms.map((s) => (
              <li key={s} className="flex items-start gap-1.5 text-[10px] leading-tight text-[#334155] dark:text-slate-300"><CheckDot small/><span>{s}</span></li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="relative mt-2.5 inline-flex h-[26px] w-fit items-center gap-2 rounded-full border border-[#d6efdf] bg-[#eaf8ef] px-[18px] text-[10.5px] font-semibold text-[#0b5c35] transition hover:bg-[#dcf3e5] dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20"
      >
        Ver más detalles
        <IcoArrow className="h-3.5 w-3.5"/>
      </button>
    </article>
  )
}

function ConsejosCard() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#e3ece6] bg-linear-to-r from-[#f8fbf2] via-[#f8fbf2] to-[#f2fae6] px-4 pb-3.5 pt-3 shadow-[0_8px_24px_-18px_rgba(15,40,30,0.35)] dark:border-[#1e3048] dark:from-[#162032] dark:via-[#162032] dark:to-[#13261f]">
      <img src={brote} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-4 h-[78px] w-auto select-none [mask-image:linear-gradient(to_right,transparent,#000_30%)] dark:hidden"/>
      <div className="relative flex items-center gap-2.5">
        <img src={iconoConsejo} alt="" className="h-[31px] w-[31px] shrink-0"/>
        <h3 className={`text-[12.5px] ${TITLE}`}>Consejos clave</h3>
      </div>
      <p className="relative mt-2 max-w-[420px] pr-24 text-[11.5px] leading-snug text-[#334155] sm:pr-0 dark:text-slate-300">
        Realiza monitoreos frecuentes en tu cultivo y aplica medidas de control a tiempo para evitar pérdidas.
      </p>
    </section>
  )
}

export default function Enfermedades({ onGoAnalizar }) {
  const [openKey, setOpenKey] = useState(null)
  const [learn, setLearn] = useState(false)
  const open = DISEASES.find((d) => d.key === openKey) ?? null

  return (
    <div className="fade-up relative isolate space-y-3.5">
      <PageGlow/>
      <Hero onLearn={() => setLearn(true)}/>

      <div className="grid gap-3 xl:grid-cols-3">
        {DISEASES.map((d) => <DiseaseCard key={d.key} disease={d} onOpen={() => setOpenKey(d.key)}/>)}
      </div>

      <ConsejosCard/>

      {open && <DiseaseDialog disease={open} onClose={() => setOpenKey(null)}/>}
      {learn && <LearnDialog onClose={() => setLearn(false)} onGoAnalizar={onGoAnalizar && (() => { setLearn(false); onGoAnalizar() })}/>}
    </div>
  )
}
