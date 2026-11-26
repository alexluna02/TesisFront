import { useEffect, useMemo, useState } from 'react'
import { PageGlow } from './PageHero.jsx'
import { estadoLuna, fasesEntre } from './lunar.js'
import texturaLuna from './Imagenes/luna-textura.png'
import heroLuna from './Imagenes/luna-hero.webp'
import maizConsejos from './Imagenes/luna-maiz.webp'

// «Calendario Lunar» según la maqueta del usuario (images/26.png).
// · Astronomía (fechas, horas, iluminación): src/lunar.js, algoritmos de Meeus verificados contra el
//   catálogo de fases 2001–2100 de Fred Espenak (diferencia máxima 31 s). Horas de Ecuador (UTC−5).
// · Labores por fase: solo lo que documenta el calendario agrícola lunar andino de Chimborazo
//   (agrónoma Leonor Andino, Diario Expreso, 2017), presentado como saber tradicional.
// · Ciencia: revisión de Mayoral et al. (2020), Agronomy 10(7):955 — no hay evidencia de que la Luna
//   influya en las plantas.

const OFFSET_EC = -5 * 3600000          // Ecuador continental: UTC−5 todo el año (sin horario de verano)
const DIA = 86400000
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const TITULO = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const TENUE = 'text-[#55607a] dark:text-slate-400'
const CARD = 'rounded-[18px] border border-[#e3ebe7] bg-white shadow-[0_14px_30px_-26px_rgba(15,60,40,0.5)] dark:border-white/10 dark:bg-[#162032]'

const NOMBRE_FASE = { nueva: 'Luna nueva', creciente: 'Cuarto creciente', llena: 'Luna llena', menguante: 'Cuarto menguante' }
const NOMBRE_VISIBLE = {
  ...NOMBRE_FASE,
  'creciente-iluminante': 'Luna creciente',
  'gibosa-creciente': 'Gibosa creciente',
  'gibosa-menguante': 'Gibosa menguante',
  'menguante-iluminante': 'Luna menguante',
}
const SIGUIENTE = { nueva: 'creciente', creciente: 'llena', llena: 'menguante', menguante: 'nueva' }
const ARTICULO = { nueva: 'la', creciente: 'el', llena: 'la', menguante: 'el' }

// Calendario agrícola lunar andino (Chimborazo). Solo lo que la fuente dice; «evitar» vacío = la
// fuente no menciona labores que evitar en ese periodo.
const TRADICION = {
  nueva: {
    resumen: 'es un periodo de descanso: la tradición recomienda no sembrar ni hacer cortes, y aprovechar para el trampeo de plagas del suelo.',
    hacer: ['Trampeo de plagas que viven en el suelo'],
    evitar: ['Sembrar (se cree que los brotes se llenan de plagas)', 'Hacer cortes o podas (la planta se marchita)', 'Otras labores en el campo'],
  },
  creciente: {
    resumen: 'es la época que la tradición señala para sembrar las plantas que dan fruto sobre el suelo, como el maíz.',
    hacer: ['Sembrar gramíneas como el maíz', 'Sembrar leguminosas y pastos'],
    evitar: [],
  },
  llena: {
    resumen: 'la tradición la dedica a preparar y cuidar el cultivo: arado, abonado, aporque, riego y control de plagas aéreas.',
    hacer: ['Arar y abonar', 'Aporcar', 'Regar', 'Controlar plagas aéreas', 'Cosechar plantas medicinales'],
    evitar: [],
  },
  menguante: {
    resumen: 'la tradición lo reserva para podas, injertos y corte de madera.',
    hacer: ['Podar', 'Hacer injertos', 'Cortar madera'],
    evitar: [],
  },
}
const FUENTE_TRADICION = 'https://www.expreso.ec/actualidad/luna-influencia-cuidado-chacra-53456.html'
const FUENTE_CIENCIA = 'https://doi.org/10.3390/agronomy10070955'
const FUENTE_ESPENAK = 'https://astropixels.com/ephemeris/moon/phases2001gmt.html'

// ── Fechas en hora de Ecuador ─────────────────────────────────────────────────
const enEcuador = (fecha) => new Date(fecha.getTime() + OFFSET_EC)            // leer con getUTC*
const claveDia = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const claveDeFecha = (fecha) => { const e = enEcuador(fecha); return claveDia(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()) }
const mediodia = (y, m, d) => new Date(Date.UTC(y, m, d, 12) - OFFSET_EC)    // 12:00 en Ecuador
// Al minuto más cercano, como las tablas astronómicas (Espenak)
const alMinuto = (fecha) => new Date(Math.round(fecha.getTime() / 60000) * 60000)
const hora = (fecha) => { const e = enEcuador(alMinuto(fecha)); return `${String(e.getUTCHours()).padStart(2, '0')}:${String(e.getUTCMinutes()).padStart(2, '0')}` }
const fechaLarga = (fecha) => { const e = enEcuador(fecha); return `${e.getUTCDate()} de ${MESES[e.getUTCMonth()]} de ${e.getUTCFullYear()}` }
const fechaCorta = (fecha) => { const e = enEcuador(alMinuto(fecha)); return `${e.getUTCDate()} ${MESES_CORTOS[e.getUTCMonth()]}` }
const diasEntre = (a, b) => Math.round((Date.parse(claveDeFecha(b)) - Date.parse(claveDeFecha(a))) / DIA)
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function useAhora() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  return ahora
}

// ── Luna dibujada con su fase real ────────────────────────────────────────────
// Vista desde el hemisferio norte (Ibarra está a 0°21′ N): al crecer se ilumina el lado derecho.
// La zona iluminada es medio disco más media elipse (el terminador), con semieje |1 − 2k|·r.
function Luna({ fraccion, creciendo, className = 'h-6 w-6', sombra = true }) {
  const k = Math.min(1, Math.max(0, fraccion))
  const rx = Math.abs(1 - 2 * k) * 50
  const xTerminador = 50 + (creciendo ? 1 : -1) * (1 - 2 * k) * 50
  const barrido = xTerminador > 50 ? 0 : 1
  const limboOscuro = creciendo ? 0 : 1
  const oscura = `M 50 0 A 50 50 0 0 ${limboOscuro} 50 100 A ${rx.toFixed(3)} 50 0 0 ${barrido} 50 0 Z`
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 overflow-visible ${className}`}>
      {sombra && <circle cx="50" cy="52" r="49" fill="rgba(15,23,42,0.18)" className="dark:fill-black/40"/>}
      <image href={texturaLuna} x="0" y="0" width="100" height="100"/>
      {k < 0.999 && <path d={oscura} fillOpacity={k < 0.001 ? 0.9 : 0.86} className="fill-[#0c1222] dark:fill-[#2b3650]"/>}
      <circle cx="50" cy="50" r="49.4" fill="none" stroke="rgba(15,23,42,0.22)" strokeWidth="1.2" className="dark:stroke-white/20"/>
    </svg>
  )
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoCalendario = (p) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01M16.5 17h.01" strokeWidth="2.6"/></Svg>
const IcoIzq = (p) => <Svg {...p}><path d="m15 18-6-6 6-6"/></Svg>
const IcoDer = (p) => <Svg {...p}><path d="m9 18 6-6-6-6"/></Svg>
const IcoFlecha = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>
const IcoHoja = (p) => <Svg {...p}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/></Svg>
const IcoBrote = (p) => <Svg {...p}><path d="M12 21v-8"/><path d="M12 13c0-4 3-7 8-7 0 5-3 7-8 7Z"/><path d="M12 15c0-3.5-2.5-6-7-6 0 4 2.5 6 7 6Z"/></Svg>
const IcoEstrella = ({ className }) => <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}><path fill="currentColor" d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"/></svg>
const IcoSi = ({ className }) => <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}><circle cx="12" cy="12" r="10" fill="#16a05c"/><path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoNo = ({ className }) => <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}><circle cx="12" cy="12" r="10" fill="#e5484d"/><path d="m8.5 8.5 7 7m0-7-7 7" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/></svg>
const IcoLunaCreciente = ({ className }) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M40 8a25 25 0 1 0 16 36A21 21 0 0 1 40 8Z" fill="#f2f7ee"/>
    <circle cx="27" cy="38" r="3.2" fill="#cfe3c9"/><circle cx="20" cy="27" r="2.2" fill="#cfe3c9"/><circle cx="31" cy="49" r="2" fill="#cfe3c9"/>
  </svg>
)

// ── Banner ────────────────────────────────────────────────────────────────────
function Banner() {
  return (
    <section className="relative overflow-hidden rounded-[18px] bg-[#0f2347] shadow-[0_14px_30px_-22px_rgba(8,20,50,0.7)]">
      {/* Cielo nocturno con estrellas a la izquierda; la foto de la luna sobre el maizal a la derecha */}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-[#0d1f3f] via-[#13294f] to-[#1b3a68]"/>
      <div aria-hidden="true" className="absolute inset-0 opacity-70 [background-image:radial-gradient(1px_1px_at_12%_22%,#fff_50%,transparent),radial-gradient(1px_1px_at_28%_64%,#fff_50%,transparent),radial-gradient(1.4px_1.4px_at_36%_18%,#fff_50%,transparent),radial-gradient(1px_1px_at_44%_48%,#fff_50%,transparent),radial-gradient(1px_1px_at_52%_12%,#fff_50%,transparent),radial-gradient(1.2px_1.2px_at_58%_70%,#fff_50%,transparent),radial-gradient(1px_1px_at_21%_84%,#fff_50%,transparent),radial-gradient(1px_1px_at_6%_58%,#fff_50%,transparent)]"/>
      <img src={heroLuna} alt="" aria-hidden="true" draggable="false" className="absolute inset-y-0 right-0 h-full w-[64%] select-none object-cover object-[40%_50%] [mask-image:linear-gradient(to_right,transparent,#000_26%)]"/>
      {/* En pantallas angostas el texto queda sobre la foto: una capa oscura lo mantiene legible */}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-[#0d1f3f]/95 via-[#0d1f3f]/75 to-[#0d1f3f]/25 sm:hidden"/>
      <div className="relative flex min-h-[118px] items-center gap-4 px-4 py-4 sm:pl-5">
        <span className="hidden h-[84px] w-[84px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#3cc06a,#0d8a46_70%)] shadow-[0_0_0_6px_rgba(46,170,90,0.18),0_10px_24px_-10px_rgba(0,0,0,0.6)] sm:grid">
          <IcoLunaCreciente className="h-[52px] w-[52px]"/>
        </span>
        <div className="min-w-0">
          <h2 className="font-[Manrope,Inter,sans-serif] text-[24px] font-extrabold leading-tight text-white sm:text-[28px]">Calendario Lunar</h2>
          <p className="mt-1 max-w-[460px] text-[12.5px] font-medium leading-snug text-white/90 sm:text-[14px]">Planifica tus actividades agrícolas según las fases de la luna</p>
        </div>
      </div>
    </section>
  )
}

// ── Calendario del mes ────────────────────────────────────────────────────────
function Calendario({ anio, mes, hoyClave, selClave, onSel, fasesPorDia }) {
  const primero = new Date(Date.UTC(anio, mes, 1))
  const inicio = (primero.getUTCDay() + 6) % 7                 // lunes = 0
  const diasMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const celdas = []
  for (let i = 0; i < Math.ceil((inicio + diasMes) / 7) * 7; i += 1) {
    const d = new Date(Date.UTC(anio, mes, 1 + i - inicio))
    celdas.push({ y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), fuera: d.getUTCMonth() !== mes })
  }
  return (
    <div>
      <div role="row" className="grid grid-cols-7 rounded-t-xl bg-[#e3f3e7] text-center text-[12px] font-semibold text-[#1f3b2c] dark:bg-emerald-400/10 dark:text-emerald-100">
        {DIAS_SEMANA.map((d) => <div key={d} role="columnheader" className="py-1.5">{d}</div>)}
      </div>
      <div role="grid" aria-label={`${capital(MESES[mes])} de ${anio}`} className="grid grid-cols-7 border-l border-t border-[#eef1f3] dark:border-white/10">
        {celdas.map((c) => {
          const clave = claveDia(c.y, c.m, c.d)
          const est = estadoLuna(mediodia(c.y, c.m, c.d))
          const fase = fasesPorDia.get(clave)
          const hoy = clave === hoyClave
          const sel = clave === selClave
          const etiqueta = `${c.d} de ${MESES[c.m]}: ${NOMBRE_VISIBLE[est.visible]}, ${Math.round(est.fraccion * 100)} % iluminada${fase ? `. ${NOMBRE_FASE[fase.tipo]} a las ${hora(fase.fecha)}` : ''}${hoy ? ' (hoy)' : ''}`
          return (
            <button
              key={clave}
              type="button"
              onClick={() => onSel(clave, c.fuera ? { y: c.y, m: c.m } : null)}
              aria-label={etiqueta}
              aria-pressed={sel}
              title={etiqueta}
              className={`relative flex h-[56px] flex-col items-center justify-center gap-1 border-b border-r border-[#eef1f3] text-[12.5px] font-semibold transition dark:border-white/10 ${
                hoy ? 'z-[1] rounded-xl bg-[#d4f2dd] text-[#0b1226] shadow-[inset_0_0_0_2px_#16a05c] dark:bg-emerald-400/20 dark:text-white'
                  : sel ? 'z-[1] rounded-xl bg-[#f0f8f3] text-[#0b1226] shadow-[inset_0_0_0_2px_#7cc79a] dark:bg-white/[0.06] dark:text-white'
                    : c.fuera ? 'text-[#b3bac6] hover:bg-[#f7faf8] dark:text-slate-600 dark:hover:bg-white/[0.03]'
                      : 'text-[#0b1226] hover:bg-[#f3faf6] dark:text-slate-100 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span className="leading-none">{c.d}</span>
              <span className={`relative grid place-items-center ${c.fuera ? 'opacity-40' : ''}`}>
                <Luna fraccion={est.fraccion} creciendo={est.creciendo} className="h-[22px] w-[22px]" sombra={false}/>
                {fase && !c.fuera && <span aria-hidden="true" className="absolute -inset-[3px] rounded-full ring-2 ring-[#f0b429]"/>}
              </span>
              {hoy && <span aria-hidden="true" className="absolute bottom-[3px] h-1 w-1 rounded-full bg-[#16a05c]"/>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function CalendarioLunar() {
  const ahora = useAhora()
  const hoyClave = claveDeFecha(ahora)
  const hoyEc = enEcuador(ahora)
  const [vista, setVista] = useState({ y: hoyEc.getUTCFullYear(), m: hoyEc.getUTCMonth() })
  const [selClave, setSelClave] = useState(null)   // null = hoy

  // Fases principales del mes a la vista (con margen para los días de los meses vecinos)
  const fasesMes = useMemo(() => fasesEntre(new Date(Date.UTC(vista.y, vista.m, 1) - OFFSET_EC - 8 * DIA), new Date(Date.UTC(vista.y, vista.m + 1, 1) - OFFSET_EC + 8 * DIA)), [vista])
  const fasesPorDia = useMemo(() => new Map(fasesMes.map((f) => [claveDeFecha(f.fecha), f])), [fasesMes])
  const delMes = fasesMes.filter((f) => { const e = enEcuador(f.fecha); return e.getUTCFullYear() === vista.y && e.getUTCMonth() === vista.m })

  // Día mostrado a la derecha: hoy (al instante actual) o el día elegido (a mediodía)
  const clave = selClave ?? hoyClave
  const esHoy = clave === hoyClave
  const [cy, cm, cd] = clave.split('-').map(Number)
  const instante = esHoy ? ahora : mediodia(cy, cm - 1, cd)
  const est = estadoLuna(instante)
  const tradicion = TRADICION[est.periodo]
  const proximaNueva = fasesEntre(instante, new Date(instante.getTime() + 31 * DIA)).find((f) => f.tipo === 'nueva')
  const faltan = diasEntre(instante, est.siguiente.fecha)

  const cambiarMes = (delta) => setVista(({ y, m }) => { const d = new Date(Date.UTC(y, m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  const elegir = (k, otroMes) => {
    setSelClave(k === hoyClave ? null : k)
    if (otroMes) setVista(otroMes)
  }
  const irAHoy = () => { setSelClave(null); setVista({ y: hoyEc.getUTCFullYear(), m: hoyEc.getUTCMonth() }) }
  const vistaEsHoy = vista.y === hoyEc.getUTCFullYear() && vista.m === hoyEc.getUTCMonth()

  // Secuencia «Fases del mes»: cada fase principal y, si caben (meses con 4 fases), la intermedia
  const secuencia = []
  delMes.forEach((f, i) => {
    secuencia.push({ principal: true, ...f, est: estadoLuna(new Date(f.fecha.getTime() + 60000)) })
    const sig = delMes[i + 1]
    if (sig && delMes.length <= 4) secuencia.push({ principal: false, est: estadoLuna(new Date((f.fecha.getTime() + sig.fecha.getTime()) / 2)) })
  })

  return (
    <div className="fade-up relative isolate space-y-3.5">
      <PageGlow/>
      <Banner/>

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* Calendario */}
        <section className={`${CARD} px-4 pb-3.5 pt-3.5`}>
          <header className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-[#0b8a4b] dark:text-emerald-400"><IcoCalendario className="h-[26px] w-[26px]" sw={1.9}/></span>
            <div className="min-w-[140px] flex-1">
              <h3 className={`text-[15px] leading-tight ${TITULO}`}>Calendario Lunar</h3>
              <p className={`text-[12px] ${TENUE}`}>{capital(MESES[vista.m])} {vista.y}</p>
            </div>
            <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
              {!vistaEsHoy && (
                <button type="button" onClick={irAHoy} className="h-[32px] rounded-full border border-[#cfe8d9] bg-[#f2faf5] px-3 text-[11.5px] font-semibold text-[#0b6b35] transition hover:bg-[#e6f5ec] dark:border-white/10 dark:bg-white/5 dark:text-emerald-300">Hoy</button>
              )}
              <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className="grid h-[32px] w-[32px] place-items-center rounded-lg border border-[#e3e8ee] bg-white text-[#0b8a4b] shadow-sm transition hover:border-[#bfe3c9] dark:border-white/10 dark:bg-white/5 dark:text-emerald-300">
                <IcoIzq className="h-4 w-4" sw={2.6}/>
              </button>
              <span aria-live="polite" className="grid h-[32px] min-w-[132px] place-items-center rounded-lg border border-[#e3e8ee] bg-white px-3 text-[13px] font-bold text-[#0b1226] shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
                {capital(MESES[vista.m])} {vista.y}
              </span>
              <button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente" className="grid h-[32px] w-[32px] place-items-center rounded-lg border border-[#e3e8ee] bg-white text-[#0b8a4b] shadow-sm transition hover:border-[#bfe3c9] dark:border-white/10 dark:bg-white/5 dark:text-emerald-300">
                <IcoDer className="h-4 w-4" sw={2.6}/>
              </button>
            </div>
          </header>
          <Calendario anio={vista.y} mes={vista.m} hoyClave={hoyClave} selClave={clave} onSel={elegir} fasesPorDia={fasesPorDia}/>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11.5px] text-[#334155] dark:text-slate-300">
            {[['Luna nueva', 0, true], ['Cuarto creciente', 0.5, true], ['Luna llena', 1, true], ['Cuarto menguante', 0.5, false]].map(([n, f, c]) => (
              <span key={n} className="inline-flex items-center gap-1.5"><Luna fraccion={f} creciendo={c} className="h-[17px] w-[17px]" sombra={false}/>{n}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-[15px] w-[15px] rounded-full ring-2 ring-[#f0b429]"/>Día de fase principal</span>
          </div>
          <p className={`mt-2 text-center text-[10.5px] leading-snug ${TENUE}`}>
            Horas de Ecuador (UTC−5). Fases calculadas con los algoritmos de Jean Meeus y verificadas con el{' '}
            <a href={FUENTE_ESPENAK} target="_blank" rel="noreferrer" className="font-semibold text-[#0b6b35] underline-offset-2 hover:underline dark:text-emerald-400">catálogo de Fred Espenak</a>.
          </p>
        </section>

        <div className="flex flex-col gap-3.5">
          {/* Fase del día */}
          <section className={`${CARD} px-4 pb-4 pt-3.5`}>
            <header className="flex flex-wrap items-center gap-2.5">
              <span className="text-[#0b8a4b] dark:text-emerald-400"><IcoCalendario className="h-[24px] w-[24px]" sw={1.9}/></span>
              <h3 className={`flex-1 text-[15px] ${TITULO}`}>{esHoy ? 'Fase Actual' : 'Fase del día'}</h3>
              <span className="text-[12.5px] font-medium text-[#1f2d48] dark:text-slate-200">{fechaLarga(instante)}</span>
            </header>
            <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <span className="grid h-[150px] w-[150px] shrink-0 place-items-center rounded-full bg-[radial-gradient(circle,#d9f3e1_0%,#eaf8ef_55%,transparent_72%)] dark:bg-[radial-gradient(circle,rgba(52,211,153,0.16)_0%,transparent_70%)]">
                <Luna fraccion={est.fraccion} creciendo={est.creciendo} className="h-[118px] w-[118px] drop-shadow-[0_10px_18px_rgba(15,23,42,0.35)]"/>
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[24px] leading-tight ${TITULO}`}>{NOMBRE_FASE[est.periodo]}</p>
                <p className="mt-1 text-[13px] leading-snug text-[#1f2d48] dark:text-slate-200">
                  {NOMBRE_VISIBLE[est.visible]}: iluminada al <strong>{Math.round(est.fraccion * 100)} %</strong> y {est.creciendo ? 'creciendo' : 'menguando'}.
                  {' '}Este periodo empezó con {ARTICULO[est.anterior.tipo]} {NOMBRE_FASE[est.anterior.tipo].toLowerCase()} del {fechaCorta(est.anterior.fecha)} a las {hora(est.anterior.fecha)}.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f6f8] px-3 py-2.5 dark:bg-white/[0.05]">
                    <IcoHoja className="h-[22px] w-[22px] text-[#16a05c] dark:text-emerald-400"/>
                    <span className="min-w-0">
                      <span className={`block text-[11px] ${TENUE}`}>Días restantes</span>
                      <span className="block text-[15px] font-bold text-[#0b1226] dark:text-white">{faltan <= 0 ? 'Hoy' : faltan === 1 ? '1 día' : `${faltan} días`}</span>
                      <span className={`block text-[10.5px] leading-tight ${TENUE}`}>hasta {ARTICULO[SIGUIENTE[est.periodo]] === 'el' ? 'el' : 'la'} {NOMBRE_FASE[SIGUIENTE[est.periodo]].toLowerCase()} ({fechaCorta(est.siguiente.fecha)}, {hora(est.siguiente.fecha)})</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#f3f6f8] px-3 py-2.5 dark:bg-white/[0.05]">
                    <IcoCalendario className="h-[22px] w-[22px] text-[#16a05c] dark:text-emerald-400" sw={1.9}/>
                    <span className="min-w-0">
                      <span className={`block text-[11px] ${TENUE}`}>Próxima Luna Nueva</span>
                      <span className="block text-[15px] font-bold text-[#0b1226] dark:text-white">{proximaNueva ? `${fechaCorta(proximaNueva.fecha)} ${enEcuador(proximaNueva.fecha).getUTCFullYear()}` : '—'}</span>
                      <span className={`block text-[10.5px] ${TENUE}`}>{proximaNueva ? `a las ${hora(proximaNueva.fecha)}` : ''}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-[#cfe8d6] bg-[#eef9f1] px-3.5 py-2.5 text-[12.5px] leading-snug text-[#1f2d48] dark:border-emerald-400/20 dark:bg-emerald-400/[0.07] dark:text-slate-200">
              <IcoSi className="mt-0.5 h-[22px] w-[22px]"/>
              <span><strong>Recomendación tradicional:</strong> en {NOMBRE_FASE[est.periodo].toLowerCase()} {tradicion.resumen}</span>
            </p>
          </section>

          {/* Labores según la tradición */}
          <section className={`${CARD} px-4 pb-3.5 pt-3.5`}>
            <header className="flex items-center gap-2.5">
              <IcoHoja className="h-[22px] w-[22px] text-[#16a05c] dark:text-emerald-400"/>
              <h3 className={`text-[15px] ${TITULO}`}>¿Qué puedes hacer?</h3>
              <span className={`ml-auto hidden text-[10.5px] sm:inline ${TENUE}`}>Calendario agrícola andino</span>
            </header>
            <div className="mt-2.5 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
              <ul className="space-y-1.5">
                {tradicion.hacer.map((t) => <li key={t} className="flex items-start gap-2 text-[12.5px] text-[#1f2d48] dark:text-slate-200"><IcoSi className="mt-px h-[18px] w-[18px]"/>{t}</li>)}
              </ul>
              <ul className="space-y-1.5">
                {tradicion.evitar.length
                  ? tradicion.evitar.map((t) => <li key={t} className="flex items-start gap-2 text-[12.5px] text-[#1f2d48] dark:text-slate-200"><IcoNo className="mt-px h-[18px] w-[18px]"/>{t}</li>)
                  : <li className={`text-[12px] leading-snug ${TENUE}`}>La tradición no señala labores que evitar en este periodo.</li>}
              </ul>
            </div>
            <p className={`mt-2.5 text-[10.5px] leading-snug ${TENUE}`}>
              Saber tradicional de Chimborazo recopilado por la agrónoma Leonor Andino (
              <a href={FUENTE_TRADICION} target="_blank" rel="noreferrer" className="font-semibold text-[#0b6b35] underline-offset-2 hover:underline dark:text-emerald-400">Diario Expreso, 2017</a>
              ). Las prácticas varían entre comunidades.
            </p>
          </section>
        </div>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Fases principales del mes */}
        <section className={`${CARD} px-4 pb-4 pt-3.5`}>
          <header className="flex items-center gap-2.5">
            <IcoEstrella className="h-[22px] w-[22px] text-[#16a05c] dark:text-emerald-400"/>
            <h3 className={`text-[15px] ${TITULO}`}>Fases Lunares del Mes</h3>
            <span className={`ml-auto text-[11px] ${TENUE}`}>{capital(MESES[vista.m])} {vista.y}</span>
          </header>
          <ol className="mt-3 flex flex-wrap items-start justify-center gap-x-1 gap-y-3 sm:flex-nowrap sm:justify-between">
            {secuencia.map((s, i) => (
              <li key={i} className={`items-start gap-1 ${s.principal ? 'flex' : 'hidden sm:flex'}`}>
                {i > 0 && <IcoFlecha className="mt-[22px] hidden h-4 w-4 shrink-0 text-[#8a95a8] sm:block"/>}
                <div className={`flex flex-col items-center text-center ${s.principal ? 'min-w-[76px]' : 'min-w-[48px]'}`}>
                  <Luna fraccion={s.est.fraccion} creciendo={s.est.creciendo} className={s.principal ? 'h-[56px] w-[56px]' : 'h-[46px] w-[46px] mt-[5px] opacity-90'}/>
                  {s.principal && (
                    <>
                      <span className="mt-1.5 text-[11.5px] font-semibold text-[#1f2d48] dark:text-slate-200">{NOMBRE_FASE[s.tipo]}</span>
                      <span className={`text-[11px] font-bold text-[#0b1226] dark:text-white`}>{fechaCorta(s.fecha)}</span>
                      <span className={`text-[10.5px] ${TENUE}`}>{hora(s.fecha)}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Lo que dice la ciencia */}
        <section className="relative overflow-hidden rounded-[18px] border border-[#d6ecdf] bg-linear-to-br from-[#eef9f1] to-[#e2f4e8] px-4 pb-4 pt-3.5 dark:border-emerald-400/15 dark:from-emerald-400/[0.07] dark:to-white/[0.02]">
          <img src={maizConsejos} alt="" aria-hidden="true" draggable="false" className="absolute inset-y-0 right-0 h-full w-[38%] select-none object-cover object-left [mask-image:linear-gradient(to_right,transparent,#000_35%)] dark:opacity-40"/>
          <div className="relative max-w-[66%]">
            <h3 className="flex items-center gap-2 font-[Manrope,Inter,sans-serif] text-[15px] font-extrabold text-[#0b5c35] dark:text-emerald-300">
              <IcoBrote className="h-[22px] w-[22px]"/>
              Consejos <span className="text-[#16a05c] dark:text-emerald-400">Agrícolas</span>
            </h3>
            <p className="mt-2 text-[12.5px] leading-snug text-[#1f2d48] dark:text-slate-200">
              Usa la luna como guía tradicional, <strong>no como diagnóstico</strong>. Una revisión científica de 2020 no encontró evidencia de que las fases lunares influyan en las plantas. El estado real de tu maíz lo dice el monitoreo: analiza tus hojas con AgroScan.
            </p>
            <p className={`mt-2 text-[10.5px] leading-snug ${TENUE}`}>
              Mayoral, Solbes, Cantó y Pina (2020),{' '}
              <a href={FUENTE_CIENCIA} target="_blank" rel="noreferrer" className="font-semibold text-[#0b6b35] underline-offset-2 hover:underline dark:text-emerald-400"><em>Agronomy</em> 10(7):955</a>.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
