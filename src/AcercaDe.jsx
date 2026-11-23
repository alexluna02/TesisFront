import { PageGlow } from './PageHero.jsx'
import heroDron from './Imagenes/historial-hero.webp'
import logoHojas from './Imagenes/logo-hojas.png'
import logoUtn from './Imagenes/acerca-utn.png'
import hojasDeco from './Imagenes/inicio-hojas.png'

// «Acerca de AgroScan» según la maqueta del usuario (images/21.png)
const TITLE = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const TEXT = 'text-[#334155] dark:text-slate-300'

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-6 w-6', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoTarget = (p) => <Svg {...p}><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><circle cx="11" cy="13" r="0.6" fill="currentColor"/><path d="m11 13 8-8M15.5 4.5h4v4"/></Svg>
const IcoEye = (p) => <Svg {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></Svg>
const IcoGem = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M6.2 3.5h11.6L21.5 9 12 21 2.5 9z" fill="currentColor"/>
    <path d="M2.5 9h19M9 3.5 7.6 9 12 21l4.4-12-1.4-5.5" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
)
const IcoDrone = (p) => <Svg {...p}><rect x="9" y="10" width="6" height="4.5" rx="1.5"/><path d="M9 11.5 5.5 9M15 11.5 18.5 9M3 7.5h5M16 7.5h5M5.5 7.5V9M18.5 7.5V9"/><circle cx="12" cy="16.8" r="1.2"/></Svg>
const IcoChip = (p) => <Svg {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="0.8"/><path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21"/></Svg>
const IcoSprout = (p) => <Svg {...p}><path d="M12 21v-9"/><path d="M12 12c0-4.5-3-7-8-7 0 4.5 3 7 8 7Z"/><path d="M12 14c0-4 2.6-6.5 8-6.5 0 4-2.6 6.5-8 6.5Z"/></Svg>
const IcoGlobe = (p) => <Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z"/></Svg>
const IcoLeaf = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M20.5 3.5C11 3.6 4.5 8.4 4.5 15.6c0 1.6.4 3 1.1 4.2 7.6.2 14.4-5 14.9-16.3Z" fill="currentColor"/>
    <path d="M5.6 19.8C8.6 15 12 11.6 16.6 8.4" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

function CheckSquare() {
  return (
    <span aria-hidden="true" className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] bg-[#f5a524] text-white dark:bg-amber-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
    </span>
  )
}

const TONES = {
  mint: {
    card: 'border-[#d5eedf] from-[#f0faf4] to-[#e2f4e9] dark:border-emerald-400/15 dark:from-emerald-400/[0.08] dark:to-white/[0.02]',
    circle: 'bg-[#d3efdf] text-[#0b7a45] dark:bg-emerald-400/15 dark:text-emerald-300',
    leaves: '',
  },
  purple: {
    card: 'border-[#e4dafa] from-[#f6f2fe] to-[#ece4fc] dark:border-violet-400/15 dark:from-violet-400/[0.08] dark:to-white/[0.02]',
    circle: 'bg-[#e3d8fc] text-[#6a2bd9] dark:bg-violet-400/15 dark:text-violet-300',
    leaves: '[filter:hue-rotate(120deg)_saturate(0.7)]',
  },
  amber: {
    card: 'border-[#f6e3c3] from-[#fff9ef] to-[#fdefd9] dark:border-amber-400/15 dark:from-amber-400/[0.08] dark:to-white/[0.02]',
    circle: 'bg-[#fde6c2] text-[#f08a00] dark:bg-amber-400/15 dark:text-amber-300',
    leaves: '[filter:hue-rotate(-55deg)_saturate(1.3)]',
  },
}

function ValueCard({ tone, icon, title, children }) {
  const t = TONES[tone]
  return (
    <section className={`relative flex min-w-0 items-start gap-3.5 overflow-hidden rounded-2xl border bg-linear-to-br px-4 py-4 shadow-[0_8px_24px_-20px_rgba(15,40,30,0.35)] ${t.card}`}>
      <img src={hojasDeco} alt="" aria-hidden="true" draggable="false" className={`pointer-events-none absolute bottom-0 right-0 h-[48px] w-auto select-none opacity-70 dark:opacity-10 ${t.leaves}`}/>
      <span className={`relative grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full ${t.circle}`}>{icon}</span>
      <div className="relative min-w-0 pt-1">
        <h3 className={`text-[14px] ${TITLE}`}>{title}</h3>
        <div className={`mt-1.5 text-[11.5px] leading-relaxed ${TEXT}`}>{children}</div>
      </div>
    </section>
  )
}

const PILLARS = [
  { label: 'Drones de alta precisión', Icon: IcoDrone },
  { label: 'Inteligencia Artificial', Icon: IcoChip },
  { label: 'Agricultura Inteligente', Icon: IcoSprout },
  { label: 'Campo más sostenible', Icon: IcoGlobe },
]
const VALUES = ['Innovación', 'Compromiso', 'Sostenibilidad', 'Trabajo en equipo']

export default function AcercaDe() {
  return (
    <div className="fade-up relative isolate space-y-3.5">
      <PageGlow/>

      {/* Cabecera: marca, presentación y la foto del dron sobre el maizal */}
      <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] bg-white shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10 dark:bg-[#0f1a2b]">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-full md:w-[60%]">
          <img src={heroDron} alt="" draggable="false" className="h-full w-full select-none object-cover object-[85%_50%] md:[mask-image:linear-gradient(to_right,transparent,#000_35%)] dark:brightness-[0.45]"/>
        </div>
        <div className="absolute inset-0 bg-linear-to-r from-white/95 via-white/80 to-white/20 md:hidden dark:from-[#0c1220]/95 dark:via-[#0c1220]/80 dark:to-[#0c1220]/30"/>
        <div className="relative flex min-h-[190px] flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:gap-7 md:pl-8">
          <div className="flex shrink-0 flex-col items-center text-center md:w-[170px]">
            <img src={logoHojas} alt="" draggable="false" className="h-[54px] w-auto select-none"/>
            <p className="mt-1 font-[Manrope,Inter,sans-serif] text-[28px] font-extrabold leading-none text-[#0f5e33] dark:text-white">AgroScan</p>
            <p className="mt-2 flex items-center gap-2 text-[11.5px] font-medium text-[#3e4f5c] dark:text-slate-400">
              <span aria-hidden="true" className="h-px w-4 bg-[#9aa8b2]"/>
              UAV • Maíz • IA
              <span aria-hidden="true" className="h-px w-4 bg-[#9aa8b2]"/>
            </p>
          </div>
          <span aria-hidden="true" className="hidden h-[118px] w-px shrink-0 bg-[#d5e2da] md:block dark:bg-white/10"/>
          <div className="max-w-[410px]">
            <h2 className={`text-[23px] leading-tight ${TITLE}`}>
              Acerca de <span className="text-[#0b7a45] dark:text-emerald-400">AgroScan</span>
            </h2>
            <p className="mt-1 text-[12.5px] font-medium text-[#1d2640] dark:text-slate-200">Innovación tecnológica al servicio del campo</p>
            <p className={`mt-2.5 text-[12px] leading-relaxed ${TEXT}`}>
              AgroScan es una plataforma inteligente que utiliza drones e inteligencia artificial para detectar enfermedades en el maíz,
              ayudando a los agricultores a tomar decisiones más informadas y oportunas.
            </p>
          </div>
        </div>
      </section>

      {/* Misión, visión y valores */}
      <div className="grid gap-3.5 md:grid-cols-3">
        <ValueCard tone="mint" icon={<IcoTarget className="h-7 w-7" sw={2.2}/>} title="Nuestra misión">
          Brindar soluciones tecnológicas para el cuidado y productividad del cultivo de maíz en Ecuador.
        </ValueCard>
        <ValueCard tone="purple" icon={<IcoEye className="h-7 w-7" sw={2.2}/>} title="Nuestra visión">
          Ser una referencia en innovación agrícola, impulsando un campo más saludable y sostenible.
        </ValueCard>
        <ValueCard tone="amber" icon={<IcoGem className="h-7 w-7"/>} title="Nuestros valores">
          <ul className="space-y-1">
            {VALUES.map((v) => <li key={v} className="flex items-center gap-2"><CheckSquare/>{v}</li>)}
          </ul>
        </ValueCard>
      </div>

      {/* Universidad y pilares del proyecto */}
      <section className="rounded-2xl border border-[#dbe9ec] bg-linear-to-br from-[#f3fafb] to-[#e9f5f6] px-5 py-4 shadow-[0_8px_24px_-20px_rgba(15,40,30,0.35)] dark:border-[#1e3048] dark:from-[#162032] dark:to-[#141d2e]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <img src={logoUtn} alt="Logo de la Universidad Técnica del Norte" className="h-[84px] w-[84px] shrink-0 drop-shadow-[0_6px_10px_rgba(15,40,30,0.18)]"/>
            <span aria-hidden="true" className="hidden h-[84px] w-px shrink-0 bg-[#d3e3e6] sm:block dark:bg-white/10"/>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#0b7a45] dark:text-emerald-400">Desarrollado por:</p>
              <p className={`mt-0.5 text-[16px] leading-tight ${TITLE}`}>Universidad Técnica del Norte</p>
              <p className={`mt-1 text-[11px] ${TEXT}`}>Investigación y tecnología para un futuro mejor</p>
            </div>
          </div>
          <span aria-hidden="true" className="hidden h-[84px] w-px shrink-0 bg-[#d3e3e6] lg:block dark:bg-white/10"/>
          <ul className="grid flex-1 grid-cols-2 gap-y-3 sm:grid-cols-4">
            {PILLARS.map(({ label, Icon }, i) => (
              <li key={label} className={`flex flex-col items-center gap-1.5 px-2 text-center ${i ? 'sm:border-l sm:border-[#d3e3e6] dark:sm:border-white/10' : ''}`}>
                <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#dcf1e5] text-[#0b7a45] dark:bg-emerald-400/15 dark:text-emerald-300">
                  <Icon className="h-[22px] w-[22px]"/>
                </span>
                <span className="max-w-[110px] text-[11px] leading-tight text-[#1d2640] dark:text-slate-200">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Lema */}
      <footer className="relative overflow-hidden rounded-2xl border border-[#d5eedf] bg-linear-to-r from-[#dcf2e4] via-[#eef8f1] to-[#dcf2e4] px-4 py-3 dark:border-emerald-400/15 dark:from-emerald-400/[0.08] dark:via-white/[0.02] dark:to-emerald-400/[0.08]">
        <img src={hojasDeco} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 left-0 h-[44px] w-auto -scale-x-100 select-none opacity-80 dark:opacity-15"/>
        <img src={hojasDeco} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[44px] w-auto select-none opacity-80 dark:opacity-15"/>
        <p className="relative flex items-center justify-center gap-3 text-[12.5px] italic text-[#0b5c35] dark:text-emerald-300">
          <span aria-hidden="true" className="hidden h-px w-[18%] bg-[#9fd3b4] sm:block dark:bg-emerald-400/30"/>
          <IcoLeaf className="h-4 w-4 text-[#0b8a4b] dark:text-emerald-400"/>
          <span><span className="font-semibold">AgroScan</span> <span aria-hidden="true" className="mx-1">|</span> Tecnología que cultiva soluciones</span>
          <span aria-hidden="true" className="hidden h-px w-[18%] bg-[#9fd3b4] sm:block dark:bg-emerald-400/30"/>
        </p>
      </footer>
    </div>
  )
}
