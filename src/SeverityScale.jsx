import { SEVERITY_LIMITS } from './severity.js'

// Escala de severidad por tramos iguales (Leve | Moderada | Grave) con la posición del valor.
// Se usa en «Último análisis» (Inicio) y en el reporte de parcela.
export default function SeverityScale({ pct, className = 'mt-2.5' }) {
  const { moderada, grave } = SEVERITY_LIMITS
  const pos = pct < moderada
    ? (pct / moderada) / 3
    : pct <= grave
      ? 1 / 3 + ((pct - moderada) / (grave - moderada)) / 3
      : 2 / 3 + Math.min(1, (pct - grave) / (50 - grave)) / 3
  return (
    <div className={className} aria-hidden="true">
      <div className="relative flex h-1.5 gap-0.5">
        <span className="flex-1 rounded-l-full bg-lime-400/80"/>
        <span className="flex-1 bg-amber-400/80"/>
        <span className="flex-1 rounded-r-full bg-red-400/80"/>
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0b1226] shadow dark:border-[#162032] dark:bg-white" style={{ left: `${Math.min(98, Math.max(2, pos * 100))}%` }}/>
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[#64748b] dark:text-slate-400">
        <span>Leve</span><span>Moderada</span><span>Grave</span>
      </div>
    </div>
  )
}
