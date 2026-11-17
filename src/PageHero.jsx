import heroImg from './Imagenes/foto3.webp'

// Encabezado común de las páginas rediseñadas (Historial, Analizar): foto del dron
// sobre el maizal, degradado para que el texto se lea y el logo de la hoja.

const LeafIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
)

// Brillo verde difuso detrás del contenido. El contenedor de la página debe llevar
// `relative isolate` para que quede detrás de las tarjetas y no del fondo general.
export function PageGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-[560px] overflow-hidden">
      <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10" />
      <div className="absolute -right-10 top-64 h-80 w-80 rounded-full bg-teal-200/30 blur-3xl dark:bg-teal-400/10" />
    </div>
  )
}

export default function PageHero({ title, highlight, subtitle }) {
  return (
    <section className="relative isolate flex min-h-[168px] items-center overflow-hidden rounded-3xl border border-white/60 shadow-[0_24px_60px_-30px_rgba(5,150,105,0.55)] sm:min-h-[200px] dark:border-white/10">
      <img src={heroImg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover object-[72%_18%]" />
      {/* En móvil el texto ocupa casi todo el ancho: el velo es más opaco para que se lea */}
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-white via-white/90 to-white/60 sm:via-white/85 sm:to-white/5 dark:from-[#07111f] dark:via-[#07111f]/90 dark:to-[#07111f]/70 dark:sm:via-[#07111f]/85 dark:sm:to-[#07111f]/20" />
      <div className="flex items-center gap-4 px-5 py-6 sm:gap-5 sm:px-8">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-emerald-400 to-green-600 text-white shadow-lg shadow-emerald-600/30 sm:h-16 sm:w-16">
          <LeafIcon className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {title} <span className="text-emerald-600 dark:text-emerald-400">{highlight}</span>
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600 sm:text-base dark:text-slate-300">{subtitle}</p>}
        </div>
      </div>
    </section>
  )
}
