import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiDate, createAdminUser, fetchAdminUsers, updateAdminUser } from './api.js'
import { PageGlow } from './PageHero.jsx'
import heroUsuarios from './Imagenes/usuarios-hero.webp'
import hojasDeco from './Imagenes/inicio-hojas.png'

// «Gestión de Usuarios» según la maqueta del usuario (images/22.png), a la escala en que la ve (~0.68).
// El backend no registra el último acceso: la tabla muestra la fecha de registro.
const PAGE_SIZE = 8
const TITLE = 'font-[Manrope,Inter,sans-serif] font-extrabold text-[#0b1226] dark:text-white'
const MUTED = 'text-[#55607a] dark:text-slate-400'
const CARD = 'rounded-2xl border border-[#e6ecf0] bg-white shadow-[0_8px_24px_-18px_rgba(15,40,30,0.35)] dark:border-[#1e3048] dark:bg-[#162032]'
const FIELD = 'h-[35px] rounded-xl border border-[#e3e8ee] bg-white text-[11.5px] text-[#0b1226] outline-none transition focus:border-[#9fd8b7] focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100'
const ROUND = 'grid shrink-0 place-items-center border border-[#e3e8ee] bg-white text-[#1f2d48] shadow-[0_2px_6px_-4px_rgba(15,23,42,0.35)] transition hover:border-[#bfe3c9] hover:text-[#0b6b35] disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:text-emerald-300'

const ROLES = {
  admin:        { label: 'Administrador', chip: 'bg-[#f1e9fe] text-[#5b21b6] dark:bg-violet-400/15 dark:text-violet-200' },
  investigador: { label: 'Investigador',  chip: 'bg-[#e7f0fd] text-[#1d4ed8] dark:bg-sky-400/15 dark:text-sky-200' },
  experto:      { label: 'Experto',       chip: 'bg-[#fdf0d8] text-[#92400e] dark:bg-amber-400/15 dark:text-amber-200' },
  agricultor:   { label: 'Agricultor',    chip: 'bg-[#e4f6ea] text-[#166534] dark:bg-emerald-400/15 dark:text-emerald-200' },
  director:     { label: 'Director',      chip: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300' },
}
// Roles que el administrador puede asignar (la cuenta admin es única). El experto recibe y
// responde las consultas que los agricultores le envían sobre sus análisis.
const ASSIGNABLE_ROLES = ['agricultor', 'investigador', 'experto']
const AVATAR_COLORS = ['#16a34a', '#2f80ed', '#f39c12', '#0f6b3a', '#8e44ad', '#e2574c', '#0e9aa7']
const EMPTY_FORM = { nombre: '', email: '', password: '', rol: 'agricultor' }

const roleLabel = (rol) => ROLES[rol]?.label ?? rol
const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const fmtDay = (iso) => new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/ de /g, ' ')
const fmtDateTime = (iso) => `${fmtDay(iso)} • ${new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
const initials = (name) => String(name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
const avatarColor = (name) => AVATAR_COLORS[[...String(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
const errorDetail = (err, fallback) => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return fallback
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Svg>
const IcoChevronDown = (p) => <Svg {...p}><path d="m6 9 6 6 6-6"/></Svg>
const IcoChevronLeft = (p) => <Svg {...p}><path d="m15 18-6-6 6-6"/></Svg>
const IcoChevronRight = (p) => <Svg {...p}><path d="m9 18 6-6-6-6"/></Svg>
const IcoCalendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></Svg>
const IcoEye = (p) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Svg>
const IcoMore = (p) => <Svg {...p}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></Svg>
const IcoX = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>
const IcoCheck = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></Svg>
const IcoPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14"/></Svg>
const IcoPower = (p) => <Svg {...p}><path d="M12 3v8"/><path d="M6.4 7.2a7.5 7.5 0 1 0 11.2 0"/></Svg>
const IcoUser = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/></Svg>
const IcoFlask = (p) => <Svg {...p}><path d="M9 3h6M10 3v6l-5.2 9.2A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.8L14 9V3"/><path d="M7.5 15h9"/></Svg>
const IcoMedal = (p) => <Svg {...p}><circle cx="12" cy="9" r="6"/><path d="m8.5 13.8-1.5 7.2 5-2.6 5 2.6-1.5-7.2"/><path d="m9.5 9 1.7 1.7L14.5 7.5"/></Svg>
const IcoCrown = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M3.5 8.2 8 11.5l4-6.3 4 6.3 4.5-3.3-1.8 10.3H5.3z" fill="currentColor"/>
  </svg>
)
const IcoUsers = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="currentColor">
    <circle cx="12" cy="7.2" r="3.4"/><circle cx="5.6" cy="9" r="2.5"/><circle cx="18.4" cy="9" r="2.5"/>
    <path d="M6.4 19.5c0-3.6 2.5-6.3 5.6-6.3s5.6 2.7 5.6 6.3z"/><path d="M1.5 18.3c0-2.7 1.8-4.6 4.2-4.6 1 0 1.9.3 2.6.9-1.3 1.3-2 3.1-2.1 5.1H2.2a.7.7 0 0 1-.7-.7z"/><path d="M22.5 18.3c0-2.7-1.8-4.6-4.2-4.6-1 0-1.9.3-2.6.9 1.3 1.3 2 3.1 2.1 5.1h4a.7.7 0 0 0 .7-.7z"/>
  </svg>
)
const IcoShieldCheck = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path d="M12 2.5 19.5 5.6v5.6c0 4.8-3.2 8.9-7.5 10.3-4.3-1.4-7.5-5.5-7.5-10.3V5.6Z" fill="currentColor"/>
    <path d="m8.6 12 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoUserGear = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="currentColor">
    <circle cx="10.5" cy="7.5" r="4"/><path d="M3 20c0-4.1 3.1-7 7.5-7 1.3 0 2.5.3 3.5.7a5 5 0 0 0-1.4 6.3z"/>
    <circle cx="17.5" cy="17.5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M17.5 12.8v1.6M17.5 20.6v1.6M12.8 17.5h1.6M20.6 17.5h1.6M14.2 14.2l1.1 1.1M19.7 19.7l1.1 1.1M14.2 20.8l1.1-1.1M19.7 15.3l1.1-1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)
const IcoCalendarGrid = ({ className = 'h-6 w-6' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    <rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01M16 17.5h.01"/>
  </svg>
)
const ROLE_ICON = { admin: IcoCrown, investigador: IcoFlask, experto: IcoMedal, agricultor: IcoUser, director: IcoUser }

const Spinner = () => <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"/>

// ── Piezas ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'h-7 w-7 text-[10px]' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-bold text-white shadow-sm ${size}`} style={{ background: avatarColor(name) }}>
      {initials(name)}
    </span>
  )
}

function RoleChip({ rol }) {
  const Icon = ROLE_ICON[rol] ?? IcoUser
  return (
    <span className={`inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ${ROLES[rol]?.chip ?? ROLES.director.chip}`}>
      <Icon className="h-3.5 w-3.5"/>
      {roleLabel(rol)}
    </span>
  )
}

// Selector de rol con aspecto de etiqueta; el cambio queda pendiente hasta pulsar «Guardar»
function RoleSelect({ value, onChange, disabled, label, pending }) {
  const Icon = ROLE_ICON[value] ?? IcoUser
  return (
    <label className={`relative inline-flex h-[24px] items-center rounded-full ${ROLES[value]?.chip ?? ROLES.director.chip} ${pending ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-[#162032]' : ''}`}>
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5"/>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-[26px] pr-6 text-[11px] font-semibold outline-none [color-scheme:light] focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed dark:[color-scheme:dark]"
      >
        {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
      </select>
      <IcoChevronDown className="pointer-events-none absolute right-2 h-3 w-3"/>
    </label>
  )
}

function StatusChip({ activo }) {
  return (
    <span className={`inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ${
      activo ? 'bg-[#e4f6ea] text-[#15803d] dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-[#eef0f3] text-[#4b5563] dark:bg-white/[0.06] dark:text-slate-300'
    }`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${activo ? 'bg-[#16a34a]' : 'bg-[#9aa3ae]'}`}/>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

const KPI_TONES = {
  mint:   { card: 'border-[#d9f1e6] from-[#effaf5] to-[#e6f6ee] dark:border-emerald-400/15 dark:from-emerald-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#d3efe0] text-[#0f8a4a] dark:bg-emerald-400/15 dark:text-emerald-300', leaves: '' },
  blue:   { card: 'border-[#d6e6fb] from-[#eef5fe] to-[#e5effd] dark:border-sky-400/15 dark:from-sky-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#d3e5fc] text-[#1d6fe0] dark:bg-sky-400/15 dark:text-sky-300', leaves: '[filter:hue-rotate(75deg)_saturate(0.8)]' },
  purple: { card: 'border-[#e6dcfa] from-[#f5f0fe] to-[#ede5fc] dark:border-violet-400/15 dark:from-violet-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#e6dbfc] text-[#7c3aed] dark:bg-violet-400/15 dark:text-violet-300', leaves: '[filter:hue-rotate(130deg)_saturate(0.7)]' },
  orange: { card: 'border-[#fbe0c4] from-[#fff6ec] to-[#fdecd8] dark:border-orange-400/15 dark:from-orange-400/[0.07] dark:to-white/[0.02]', circle: 'bg-[#fde3c6] text-[#f07c0a] dark:bg-orange-400/15 dark:text-orange-300', leaves: '[filter:hue-rotate(-60deg)_saturate(1.3)]' },
}

function KpiCard({ tone, icon, value, label, valueFirst = true, title }) {
  const t = KPI_TONES[tone]
  return (
    <div title={title} className={`relative flex min-h-[73px] items-center gap-3 overflow-hidden rounded-2xl border bg-linear-to-br px-3 py-2.5 sm:gap-4 sm:px-3.5 ${t.card}`}>
      <img src={hojasDeco} alt="" aria-hidden="true" draggable="false" className={`pointer-events-none absolute bottom-0 right-0 h-[40px] w-auto select-none opacity-60 dark:opacity-10 ${t.leaves}`}/>
      <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full sm:h-[54px] sm:w-[54px] ${t.circle}`}>{icon}</span>
      <span className="relative min-w-0">
        {valueFirst ? (
          <>
            <span className={`block text-[20px] leading-none sm:text-[23px] ${TITLE}`}>{value}</span>
            <span className="mt-1.5 block text-[11px] leading-tight text-[#283c53] dark:text-slate-400">{label}</span>
          </>
        ) : (
          <>
            <span className="block text-[11px] leading-tight text-[#283c53] dark:text-slate-400">{label}</span>
            <span className="mt-1 block font-[Manrope,Inter,sans-serif] text-[17px] font-extrabold leading-tight text-[#ea7a0c] sm:text-[20px] dark:text-orange-300">{value}</span>
          </>
        )}
      </span>
    </div>
  )
}

function FilterSelect({ value, onChange, label, options }) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD} w-full cursor-pointer appearance-none pl-3 pr-8 font-medium [color-scheme:light] dark:[color-scheme:dark]`}
      >
        {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
      </select>
      <IcoChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#334155] dark:text-slate-400"/>
    </label>
  )
}

// Menús desplegables: clic fuera o Escape los cierra
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      ref.current?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  return [open, setOpen, ref]
}

function DateRangeButton({ from, to, onChange }) {
  const [open, setOpen, ref] = usePopover()
  const active = from || to
  const text = active ? `${from ? fmtDay(`${from}T00:00:00`) : '…'} – ${to ? fmtDay(`${to}T00:00:00`) : '…'}` : 'Rango de fechas'
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${FIELD} flex w-full items-center gap-2 px-3 font-medium ${active ? 'border-[#9fd8b7] bg-[#f3fbf6] dark:bg-white/10' : ''}`}
      >
        <IcoCalendar className="h-3.5 w-3.5 text-[#334155] dark:text-slate-400"/>
        <span className="min-w-0 flex-1 truncate text-left">{text}</span>
        <IcoChevronDown className={`h-3.5 w-3.5 text-[#334155] transition-transform dark:text-slate-400 ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && (
        <div role="group" aria-label="Fecha de registro" className="fade-in absolute right-0 top-full z-30 mt-2 w-[250px] rounded-2xl border border-[#e3e8ee] bg-white p-3 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#111c2e]">
          <p className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#64748b] dark:text-slate-400">Fecha de registro</p>
          {[['Desde', from, (v) => onChange(v, to), { max: to || undefined }], ['Hasta', to, (v) => onChange(from, v), { min: from || undefined }]].map(([lbl, val, set, lim]) => (
            <label key={lbl} className="mb-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#55607a] dark:text-slate-400">
              {lbl}
              <input type="date" value={val} onChange={(e) => set(e.target.value)} {...lim} className="h-[28px] rounded-lg border border-[#e3e8ee] bg-white px-2 text-[11px] text-[#1f2d48] outline-none [color-scheme:light] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]"/>
            </label>
          ))}
          {active && (
            <button type="button" onClick={() => onChange('', '')} className="text-[11px] font-semibold text-[#0b6b35] hover:underline dark:text-emerald-400">Quitar rango</button>
          )}
        </div>
      )}
    </div>
  )
}

function RowMenu({ items, label }) {
  const [open, setOpen, ref] = usePopover()
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${ROUND} h-[27px] w-[27px] rounded-full`}>
        <IcoMore className="h-4 w-4"/>
      </button>
      {open && (
        <div role="menu" className="fade-in absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-[#e3e8ee] bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#111c2e]">
          {items.map(({ text, Icon, onClick, danger }) => (
            <button
              key={text}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onClick() }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium transition ${
                danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10' : 'text-[#1f2d48] hover:bg-[#f1f5f3] dark:text-slate-200 dark:hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4"/>
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Diálogos ──────────────────────────────────────────────────────────────────
const dialogStack = []

function Dialog({ labelledBy, onClose, size = 'max-w-[440px]', children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const token = {}
    dialogStack.push(token)
    const previous = document.activeElement
    const onKey = (e) => { if (e.key === 'Escape' && dialogStack[dialogStack.length - 1] === token) closeRef.current() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const raf = requestAnimationFrame(() => {
      const auto = panelRef.current?.querySelector('[data-autofocus]')
      ;(auto ?? panelRef.current)?.focus()
    })
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      dialogStack.splice(dialogStack.indexOf(token), 1)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [])
  const trapTab = (e) => {
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length)
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
        className={`fade-up relative flex max-h-[calc(100dvh-10px)] w-full ${size} flex-col overflow-hidden rounded-t-[22px] border border-white/70 bg-white shadow-[0_30px_80px_-30px_rgba(2,12,8,0.6)] outline-none sm:max-h-[calc(100dvh-32px)] sm:rounded-[22px] dark:border-white/10 dark:bg-[#0f1a2b]`}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

function DialogHeader({ id, icon, title, subtitle, onClose }) {
  return (
    <header className="relative shrink-0 overflow-hidden px-5 pb-3 pt-4">
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-white via-[#f4fbf7] to-[#e2f2ea] dark:from-[#0f1a2b] dark:via-[#0f1d2a] dark:to-[#11271f]"/>
      <div className="relative flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 id={id} className={`truncate text-[16px] leading-tight ${TITLE}`}>{title}</h2>
          {subtitle && <p className={`mt-0.5 truncate text-[11px] ${MUTED}`}>{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className={`${ROUND} h-[28px] w-[28px] rounded-full`}>
          <IcoX className="h-3.5 w-3.5" sw={2.4}/>
        </button>
      </div>
    </header>
  )
}

const BTN_GREEN = 'inline-flex h-[32px] items-center justify-center gap-1.5 rounded-full bg-[#0b7a45] px-4 text-[11.5px] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(2,137,75,0.7)] transition hover:bg-[#096b3c] disabled:pointer-events-none disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500'
const BTN_GHOST = 'inline-flex h-[32px] items-center justify-center gap-1.5 rounded-full border border-[#e3e8ee] bg-white px-4 text-[11.5px] font-semibold text-[#334155] transition hover:bg-[#f6f8fa] dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10'

function ConfirmDialog({ title, message, confirmLabel, danger, onCancel, onConfirm }) {
  const id = `cf${useId().replace(/:/g, '')}`
  return (
    <Dialog labelledBy={id} onClose={onCancel} size="max-w-[400px]">
      <div className="p-5">
        <h2 id={id} className={`text-[15px] ${TITLE}`}>{title}</h2>
        <p className={`mt-1.5 text-[12px] leading-relaxed ${MUTED}`}>{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" data-autofocus onClick={onCancel} className={BTN_GHOST}>Cancelar</button>
          <button type="button" onClick={onConfirm} className={danger ? `${BTN_GREEN} bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500` : BTN_GREEN}>{confirmLabel}</button>
        </div>
      </div>
    </Dialog>
  )
}

function UserDialog({ user, pendingRol, saving, onClose, onRoleChange, onSave, onCancelRole, onToggle }) {
  const id = `ud${useId().replace(/:/g, '')}`
  const locked = user.rol === 'admin'
  const shownRol = pendingRol ?? user.rol
  const changed = pendingRol != null && pendingRol !== user.rol
  return (
    <Dialog labelledBy={id} onClose={onClose}>
      <DialogHeader id={id} onClose={onClose} icon={<Avatar name={user.nombre} size="h-11 w-11 text-[14px]"/>} title={user.nombre} subtitle={user.email}/>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-1">
        <dl className="grid grid-cols-2 gap-2.5">
          {[
            ['Estado', <StatusChip key="e" activo={user.activo}/>],
            ['Rol actual', <RoleChip key="r" rol={user.rol}/>],
            ['Fecha de registro', fmtDateTime(apiDate(user.created_at))],
            ['Última actualización', fmtDateTime(apiDate(user.updated_at ?? user.created_at))],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[#e6ecf0] bg-[#fafcfb] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <dt className={`text-[10px] ${MUTED}`}>{k}</dt>
              <dd className="mt-1 text-[11.5px] font-semibold text-[#0b1226] dark:text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
        {locked ? (
          <p className={`rounded-xl bg-[#f5f0fe] px-3 py-2.5 text-[11.5px] leading-snug text-[#5b21b6] dark:bg-violet-400/10 dark:text-violet-200`}>
            La cuenta de administrador es única: su rol y su acceso no se pueden cambiar desde aquí.
          </p>
        ) : (
          <>
            <section>
              <h3 className={`text-[12px] ${TITLE}`}>Cambiar rol</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RoleSelect value={shownRol} onChange={onRoleChange} disabled={saving} label={`Rol de ${user.nombre}`} pending={changed}/>
                {changed && (
                  <>
                    <button type="button" onClick={onSave} disabled={saving} className={`${BTN_GREEN} h-[28px] px-3.5`}>
                      {saving ? <Spinner/> : <IcoCheck className="h-3.5 w-3.5" sw={2.6}/>}
                      Guardar
                    </button>
                    <button type="button" onClick={onCancelRole} disabled={saving} className={`${BTN_GHOST} h-[28px] px-3`}>Cancelar</button>
                  </>
                )}
              </div>
              <p className={`mt-1.5 text-[10.5px] ${MUTED}`}>
                {changed ? `Cambio sin guardar: pasará de ${roleLabel(user.rol)} a ${roleLabel(pendingRol)}.` : 'Elige el nuevo rol y pulsa «Guardar» para aplicarlo.'}
              </p>
            </section>
            <section className="border-t border-[#eef1f5] pt-3 dark:border-white/10">
              <h3 className={`text-[12px] ${TITLE}`}>Acceso</h3>
              <p className={`mt-1 text-[11px] leading-snug ${MUTED}`}>
                {user.activo ? 'El usuario puede iniciar sesión en AgroScan.' : 'El usuario no puede iniciar sesión hasta que reactives su acceso.'}
              </p>
              <button type="button" onClick={onToggle} disabled={saving} className={`${BTN_GHOST} mt-2 h-[30px] ${user.activo ? 'text-red-600 dark:text-red-400' : 'text-[#0b6b35] dark:text-emerald-300'}`}>
                <IcoPower className="h-3.5 w-3.5"/>
                {user.activo ? 'Desactivar acceso' : 'Activar acceso'}
              </button>
            </section>
          </>
        )}
      </div>
    </Dialog>
  )
}

function CreateUserDialog({ onClose, onCreated }) {
  const id = `nu${useId().replace(/:/g, '')}`
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPwd, setShowPwd] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim() || !form.email.trim() || !form.password) { setError('Completa todos los campos.'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    setCreating(true)
    try {
      const { data } = await createAdminUser({ ...form, nombre: form.nombre.trim(), email: form.email.trim() })
      onCreated(data)
    } catch (err) {
      setError(errorDetail(err, 'No se pudo crear el usuario.'))
      setCreating(false)
    }
  }
  const input = `${FIELD} w-full px-3`
  return (
    <Dialog labelledBy={id} onClose={onClose}>
      <DialogHeader
        id={id}
        onClose={onClose}
        icon={<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#d3efe0] text-[#0f8a4a] dark:bg-emerald-400/15 dark:text-emerald-300"><IcoUsers className="h-6 w-6"/></span>}
        title="Nuevo usuario"
        subtitle="Podrá iniciar sesión con este correo y contraseña"
      />
      <form onSubmit={submit} className="space-y-3 px-5 pb-5 pt-1">
        <label className="block text-[11px] font-semibold text-[#334155] dark:text-slate-300">
          Nombre completo
          <input data-autofocus className={`${input} mt-1`} value={form.nombre} onChange={set('nombre')} autoComplete="off"/>
        </label>
        <label className="block text-[11px] font-semibold text-[#334155] dark:text-slate-300">
          Correo electrónico
          <input className={`${input} mt-1`} type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={set('email')} autoComplete="off"/>
        </label>
        <label className="block text-[11px] font-semibold text-[#334155] dark:text-slate-300">
          Contraseña
          <span className="relative mt-1 block">
            <input className={`${input} pr-20`} type={showPwd ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={form.password} onChange={set('password')} autoComplete="new-password"/>
            <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#0b6b35] dark:text-emerald-400">
              {showPwd ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
        </label>
        <label className="block text-[11px] font-semibold text-[#334155] dark:text-slate-300">
          Rol
          <span className="relative mt-1 block">
            <select className={`${input} cursor-pointer appearance-none pr-8 [color-scheme:light] dark:[color-scheme:dark]`} value={form.rol} onChange={set('rol')}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <IcoChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"/>
          </span>
        </label>
        {error && <p role="alert" className="text-[11.5px] text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancelar</button>
          <button type="submit" disabled={creating} className={BTN_GREEN}>{creating ? <Spinner/> : <IcoPlus className="h-3.5 w-3.5" sw={2.6}/>}Crear usuario</button>
        </div>
      </form>
    </Dialog>
  )
}

function pageWindow(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const nums = [...new Set([1, count, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('todos')
  const [stateFilter, setStateFilter] = useState('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState({})        // { [id]: rol } cambios de rol aún sin guardar
  const [savingId, setSavingId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const showToast = useCallback((message, tone = 'ok') => {
    clearTimeout(toastTimer.current)
    setToast({ message, tone, key: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 3400)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await fetchAdminUsers()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(errorDetail(err, 'No se pudo cargar la lista de usuarios.'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { loadUsers() }, [loadUsers])

  const kpis = useMemo(() => {
    const admins = users.filter((u) => u.rol === 'admin').length
    const agricultores = users.filter((u) => u.rol === 'agricultor').length
    const investigadores = users.filter((u) => u.rol === 'investigador').length
    const expertos = users.filter((u) => u.rol === 'experto').length
    const ultimo = users.reduce((a, u) => (!a || new Date(apiDate(u.created_at)) > new Date(apiDate(a.created_at)) ? u : a), null)
    return { total: users.length, admins, estandar: users.length - admins, agricultores, investigadores, expertos, ultimo }
  }, [users])

  const filtered = useMemo(() => {
    const q = normalize(search)
    const f = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : -Infinity
    const t = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Infinity
    return users
      .filter((u) => {
        if (roleFilter !== 'todos' && u.rol !== roleFilter) return false
        if (stateFilter === 'activos' && !u.activo) return false
        if (stateFilter === 'inactivos' && u.activo) return false
        const ts = new Date(apiDate(u.created_at)).getTime()
        if (ts < f || ts > t) return false
        return !q || normalize(`${u.nombre} ${u.email} ${roleLabel(u.rol)}`).includes(q)
      })
      .sort((a, b) => (b.rol === 'admin') - (a.rol === 'admin') || new Date(apiDate(b.created_at)) - new Date(apiDate(a.created_at)))
  }, [users, search, roleFilter, stateFilter, dateFrom, dateTo])

  useEffect(() => { setPage(1) }, [search, roleFilter, stateFilter, dateFrom, dateTo])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const start = (current - 1) * PAGE_SIZE
  const items = filtered.slice(start, start + PAGE_SIZE)

  const changeRole = (user, rol) => setPending((p) => {
    const next = { ...p }
    if (rol === user.rol) delete next[user.id]
    else next[user.id] = rol
    return next
  })
  const cancelRole = (user) => setPending((p) => {
    const next = { ...p }
    delete next[user.id]
    return next
  })

  const applyUpdate = async (user, changes, okMessage) => {
    setSavingId(user.id)
    try {
      const { data } = await updateAdminUser(user.id, changes)
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
      if (changes.rol) cancelRole(user)
      showToast(okMessage(data))
      return true
    } catch (err) {
      showToast(errorDetail(err, 'No se pudo actualizar el usuario.'), 'error')
      return false
    } finally {
      setSavingId(null)
    }
  }

  const saveRole = (user) => {
    const rol = pending[user.id]
    if (!rol || rol === user.rol) return
    applyUpdate(user, { rol }, (data) => `${data.nombre} ahora es ${roleLabel(data.rol)}.`)
  }

  const askToggle = (user) => setConfirm({
    title: user.activo ? `¿Desactivar a ${user.nombre}?` : `¿Activar a ${user.nombre}?`,
    message: user.activo
      ? 'No podrá iniciar sesión en AgroScan hasta que vuelvas a activar su acceso. Sus análisis se conservan.'
      : 'Podrá volver a iniciar sesión en AgroScan con su correo y contraseña.',
    confirmLabel: user.activo ? 'Desactivar acceso' : 'Activar acceso',
    danger: user.activo,
    onConfirm: async () => {
      setConfirm(null)
      await applyUpdate(user, { activo: !user.activo }, (data) => (data.activo ? `${data.nombre} puede volver a ingresar.` : `${data.nombre} ya no puede ingresar.`))
    },
  })

  const detailUser = detailId ? users.find((u) => u.id === detailId) : null
  const filtersActive = search || roleFilter !== 'todos' || stateFilter !== 'todos' || dateFrom || dateTo
  const resetFilters = () => {
    setSearch('')
    setRoleFilter('todos')
    setStateFilter('todos')
    setDateFrom('')
    setDateTo('')
  }

  const actionsFor = (u) => {
    const locked = u.rol === 'admin'
    const changed = pending[u.id] != null && pending[u.id] !== u.rol
    const busy = savingId === u.id
    if (changed) {
      return (
        <div className="flex items-center justify-end gap-1.5 md:justify-center">
          <button type="button" onClick={() => saveRole(u)} disabled={busy} aria-label={`Guardar el nuevo rol de ${u.nombre}`} className={`${BTN_GREEN} h-[27px] px-3 text-[11px]`}>
            {busy ? <Spinner/> : <IcoCheck className="h-3.5 w-3.5" sw={2.6}/>}
            Guardar
          </button>
          <button type="button" onClick={() => cancelRole(u)} disabled={busy} aria-label={`Cancelar el cambio de rol de ${u.nombre}`} title="Cancelar el cambio" className={`${ROUND} h-[27px] w-[27px] rounded-full`}>
            <IcoX className="h-3.5 w-3.5" sw={2.4}/>
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-end gap-2 md:justify-center">
        <button type="button" onClick={() => setDetailId(u.id)} aria-label={`Ver detalle de ${u.nombre}`} title="Ver detalle" className={`${ROUND} h-[27px] w-[38px] rounded-full`}>
          <IcoEye className="h-4 w-4"/>
        </button>
        {locked ? (
          <span aria-hidden="true" className="w-[27px]"/>
        ) : (
          <RowMenu
            label={`Más acciones para ${u.nombre}`}
            items={[
              { text: 'Ver detalle', Icon: IcoEye, onClick: () => setDetailId(u.id) },
              u.activo
                ? { text: 'Desactivar acceso', Icon: IcoPower, onClick: () => askToggle(u), danger: true }
                : { text: 'Activar acceso', Icon: IcoPower, onClick: () => askToggle(u) },
            ]}
          />
        )}
      </div>
    )
  }

  const roleCell = (u) => {
    if (u.rol === 'admin' || !ASSIGNABLE_ROLES.includes(u.rol)) return <RoleChip rol={u.rol}/>
    const changed = pending[u.id] != null && pending[u.id] !== u.rol
    return (
      <RoleSelect
        value={pending[u.id] ?? u.rol}
        onChange={(rol) => changeRole(u, rol)}
        disabled={savingId === u.id}
        label={`Rol de ${u.nombre}`}
        pending={changed}
      />
    )
  }

  const pendingCount = Object.keys(pending).length

  return (
    <div className="fade-up relative isolate space-y-3.5">
      <PageGlow/>

      {/* Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10">
        <img src={heroUsuarios} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-[75%_50%] dark:brightness-[0.45]"/>
        <div className="absolute inset-0 bg-linear-to-r from-white/90 via-white/70 to-white/10 md:hidden dark:hidden"/>
        <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block"/>
        <div className="relative flex min-h-[124px] items-center gap-4 px-4 py-4 sm:pl-[13px]">
          <span className="hidden h-[80px] w-[80px] shrink-0 place-items-center rounded-full bg-white/60 text-[#0f8a4a] ring-1 ring-white/80 shadow-[0_10px_24px_-14px_rgba(15,60,40,0.5)] backdrop-blur-sm sm:grid dark:bg-white/10 dark:text-emerald-300 dark:ring-white/15">
            <IcoUsers className="h-11 w-11"/>
          </span>
          <div className="min-w-0">
            <h2 className={`text-[21px] leading-tight sm:text-[23px] ${TITLE}`}>
              Gestión de <span className="text-[#0b8a4b] dark:text-emerald-400">Usuarios</span>
            </h2>
            <p className="mt-1.5 max-w-[420px] text-[12px] leading-snug text-[#1d2640] dark:text-slate-300">
              Administra los usuarios del sistema AgroScan de forma segura y eficiente.
            </p>
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        <KpiCard tone="mint" icon={<IcoUsers className="h-6 w-6 sm:h-7 sm:w-7"/>} value={loading ? '—' : kpis.total} label="Usuarios registrados"/>
        <KpiCard tone="blue" icon={<IcoShieldCheck className="h-6 w-6 sm:h-7 sm:w-7"/>} value={loading ? '—' : kpis.admins} label="Administradores"/>
        <KpiCard
          tone="purple"
          icon={<IcoUserGear className="h-6 w-6 sm:h-7 sm:w-7"/>}
          value={loading ? '—' : kpis.estandar}
          label="Usuarios estándar"
          title={`${kpis.agricultores} agricultores · ${kpis.investigadores} investigadores · ${kpis.expertos} expertos`}
        />
        <KpiCard
          tone="orange"
          icon={<IcoCalendarGrid className="h-6 w-6 sm:h-7 sm:w-7"/>}
          valueFirst={false}
          value={loading || !kpis.ultimo ? '—' : fmtDay(apiDate(kpis.ultimo.created_at))}
          label="Último registro"
          title={kpis.ultimo ? `${kpis.ultimo.nombre} · ${kpis.ultimo.email}` : undefined}
        />
      </div>

      {/* Búsqueda y filtros */}
      <section className={`${CARD} p-2.5`}>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_150px] xl:grid-cols-[minmax(0,1fr)_150px_160px_170px_auto]">
          <label className="relative block min-w-0 md:col-span-3 xl:col-span-1">
            <span className="sr-only">Buscar usuario</span>
            <IcoSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#334155] dark:text-slate-400"/>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuario por nombre, correo o rol…"
              className={`${FIELD} w-full pl-10 pr-3 placeholder:text-[#6b7891] dark:placeholder:text-slate-500`}
            />
          </label>
          <FilterSelect value={roleFilter} onChange={setRoleFilter} label="Rol" options={[['todos', 'Todos los roles'], ['admin', 'Administrador'], ['investigador', 'Investigador'], ['experto', 'Experto'], ['agricultor', 'Agricultor']]}/>
          <FilterSelect value={stateFilter} onChange={setStateFilter} label="Estado" options={[['todos', 'Todos los estados'], ['activos', 'Activos'], ['inactivos', 'Inactivos']]}/>
          <DateRangeButton from={dateFrom} to={dateTo} onChange={(f, t) => { setDateFrom(f); setDateTo(t) }}/>
          <button type="button" onClick={() => setCreating(true)} className={`${BTN_GREEN} h-[35px] rounded-xl md:col-span-3 xl:col-span-1`}>
            <IcoPlus className="h-4 w-4" sw={2.6}/>
            Nuevo usuario
          </button>
        </div>
      </section>

      {/* Tabla */}
      <section className={`${CARD} overflow-hidden`}>
        {pendingCount > 0 && (
          <p role="status" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500"/>
            {pendingCount === 1 ? 'Hay 1 cambio de rol sin guardar.' : `Hay ${pendingCount} cambios de rol sin guardar.`} Pulsa «Guardar» en la fila para aplicarlo.
          </p>
        )}
        {loading ? (
          <p className={`px-5 py-8 text-center text-[12px] ${MUTED}`}>Cargando usuarios…</p>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-[12px] text-red-600 dark:text-red-400">{loadError}</p>
            <button type="button" onClick={loadUsers} className={BTN_GHOST}>Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className={`text-[12px] ${MUTED}`}>{users.length ? 'Ningún usuario coincide con la búsqueda o los filtros.' : 'Aún no hay usuarios registrados.'}</p>
            {filtersActive && <button type="button" onClick={resetFilters} className={BTN_GHOST}>Limpiar filtros</button>}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#64748b] dark:text-slate-400">
                    <th scope="col" className="border-b border-[#eef1f5] py-3 pl-5 font-semibold dark:border-white/[0.06]">Usuario</th>
                    <th scope="col" className="w-[26%] border-b border-[#eef1f5] py-3 pl-3 font-semibold dark:border-white/[0.06]">Correo electrónico</th>
                    <th scope="col" className="w-[150px] border-b border-[#eef1f5] py-3 pl-3 font-semibold dark:border-white/[0.06]">Rol</th>
                    <th scope="col" className="w-[110px] border-b border-[#eef1f5] py-3 pl-3 font-semibold dark:border-white/[0.06]">Estado</th>
                    <th scope="col" className="hidden w-[170px] border-b border-[#eef1f5] py-3 pl-3 font-semibold lg:table-cell dark:border-white/[0.06]">Fecha de registro</th>
                    <th scope="col" className="w-[150px] border-b border-[#eef1f5] py-3 pr-4 text-center font-semibold dark:border-white/[0.06]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => {
                    const changed = pending[u.id] != null && pending[u.id] !== u.rol
                    const td = 'border-b border-[#eef1f5] py-[7px] pl-3 align-middle dark:border-white/[0.06]'
                    return (
                      <tr key={u.id} className={`transition-colors ${changed ? 'bg-amber-50/70 dark:bg-amber-400/[0.06]' : 'hover:bg-[#f7fbf8] dark:hover:bg-white/[0.03]'}`}>
                        <td className={`${td} pl-5`}>
                          <span className="flex min-w-0 items-center gap-3">
                            <Avatar name={u.nombre}/>
                            <span className="truncate text-[12px] font-bold text-[#0b1226] dark:text-white" title={u.nombre}>{u.nombre}</span>
                          </span>
                        </td>
                        <td className={`${td} truncate text-[12px] text-[#1f2d48] dark:text-slate-200`} title={u.email}>{u.email}</td>
                        <td className={td}>{roleCell(u)}</td>
                        <td className={td}><StatusChip activo={u.activo}/></td>
                        <td className={`${td} hidden whitespace-nowrap text-[12px] text-[#1f2d48] lg:table-cell dark:text-slate-200`}>{fmtDateTime(apiDate(u.created_at))}</td>
                        <td className={`${td} pr-4`}>{actionsFor(u)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-[#eef1f5] md:hidden dark:divide-white/[0.06]">
              {items.map((u) => {
                const changed = pending[u.id] != null && pending[u.id] !== u.rol
                return (
                  <li key={u.id} className={`px-3.5 py-3 ${changed ? 'bg-amber-50/70 dark:bg-amber-400/[0.06]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.nombre} size="h-9 w-9 text-[12px]"/>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-[#0b1226] dark:text-white">{u.nombre}</p>
                        <p className={`truncate text-[11px] ${MUTED}`}>{u.email}</p>
                      </div>
                      <StatusChip activo={u.activo}/>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {roleCell(u)}
                      {actionsFor(u)}
                    </div>
                    <p className={`mt-1.5 text-[10.5px] ${MUTED}`}>Registrado el {fmtDateTime(apiDate(u.created_at))}</p>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-2.5 px-5 py-3.5 sm:flex-row">
            <p className="text-[11.5px] text-[#3d4b71] dark:text-slate-400">
              Mostrando {start + 1} – {Math.min(start + PAGE_SIZE, filtered.length)} de {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
            </p>
            <nav aria-label="Paginación" className="flex items-center gap-1.5">
              <button type="button" aria-label="Página anterior" disabled={current === 1} onClick={() => setPage(current - 1)} className={`${ROUND} h-[27px] w-[27px] rounded-full text-[#64748b] disabled:pointer-events-none disabled:opacity-40`}>
                <IcoChevronLeft className="h-3.5 w-3.5"/>
              </button>
              {pageWindow(current, pageCount).map((p, i) => (p === '…' ? (
                <span key={`g${i}`} className="px-1 text-[11px] text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  aria-current={p === current ? 'page' : undefined}
                  onClick={() => setPage(p)}
                  className={`grid h-[27px] min-w-[27px] place-items-center rounded-full px-1 text-[11.5px] font-semibold transition ${
                    p === current ? 'bg-[#16a34a] text-white shadow-[0_6px_12px_-6px_rgba(22,163,74,0.8)] dark:bg-emerald-600' : 'text-[#131d32] hover:bg-[#eef3f0] dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  {p}
                </button>
              )))}
              <button type="button" aria-label="Página siguiente" disabled={current === pageCount} onClick={() => setPage(current + 1)} className={`${ROUND} h-[27px] w-[27px] rounded-full text-[#64748b] disabled:pointer-events-none disabled:opacity-40`}>
                <IcoChevronRight className="h-3.5 w-3.5"/>
              </button>
            </nav>
          </div>
        )}
      </section>

      {detailUser && (
        <UserDialog
          user={detailUser}
          pendingRol={pending[detailUser.id]}
          saving={savingId === detailUser.id}
          onClose={() => setDetailId(null)}
          onRoleChange={(rol) => changeRole(detailUser, rol)}
          onSave={() => saveRole(detailUser)}
          onCancelRole={() => cancelRole(detailUser)}
          onToggle={() => askToggle(detailUser)}
        />
      )}
      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={(data) => {
            setUsers((prev) => [data, ...prev])
            setCreating(false)
            showToast(`Usuario ${data.email} creado como ${roleLabel(data.rol)}.`)
          }}
        />
      )}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)}/>}
      {toast && createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
          <div key={toast.key} role="status" className={`fade-up pointer-events-auto rounded-2xl px-4 py-3 text-[12.5px] font-semibold shadow-2xl ${toast.tone === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-emerald-950'}`}>
            {toast.message}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
