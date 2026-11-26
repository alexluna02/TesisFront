import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './ThemeContext.jsx'
import Analizar from './Analizar.jsx'
import Historial from './Historial.jsx'
import Enfermedades from './Enfermedades.jsx'
import AcercaDe from './AcercaDe.jsx'
import Mercado from './Mercado.jsx'
import Profile from './Profile.jsx'
import Usuarios from './Usuarios.jsx'
import ModeloIA from './ModeloIA.jsx'
import Consultas from './Consultas.jsx'
import CalendarioLunar from './CalendarioLunar.jsx'
import { affectedFromRecord, severityFromRecord, SEVERITY_PALETTE } from './severity.js'
import Login from './Login.jsx'
import heroDron from './Imagenes/hero-dron.webp'
import heroInsignia from './Imagenes/hero-insignia.png'
import topbarHojas from './Imagenes/topbar-hojas.png'
import inicioMazorca from './Imagenes/inicio-mazorca.png'
import inicioHojas from './Imagenes/inicio-hojas.png'
import { DISEASES, diseaseKey, diseaseMeta, recommendationsFor } from './diseases.js'
import { RESULT_STYLE, SEVERITY_CHIP, resultColor, resultKeyOf, visitResultKey, daysAgo, whenLabel } from './resultados.js'
import SeverityScale from './SeverityScale.jsx'
import ParcelMiniMap from './ParcelMiniMap.jsx'
import sidebarPhoto from './Imagenes/sidebar-maizal.webp'
import logoHojas from './Imagenes/logo-hojas.png'
import { api, fetchMe, fetchAnalisis, logoutRequest, isLogged, clearAuthData, getRefreshToken, SESSION_EXPIRED_EVENT } from './api.js'
import { fetchEnfermedades, apiDate, fetchConsultas, fetchConsultasResumen } from './api.js'
import { loadParcelHistory, PARCEL_HISTORY_KEY, getParcelaSummaries, PARCELAS_KEY } from './AnalizarParcela.jsx'

// ── Google Font ───────────────────────────────────────────────────────────────
const FontLink = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  * { font-family: 'Plus Jakarta Sans', sans-serif; }
  `}</style>
)

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>
)
const IcoScan = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
  </svg>
)
const IcoHistory = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const IcoInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>
  </svg>
)
const IcoDisease = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/>
    <path d="M12 8v.01M9 12v.01M15 10v.01M8 16v.01M16 15v.01M12 16v.01"/>
  </svg>
)
const IcoMarket = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l5-5 4 4 7-9M14 6h5v5"/>
  </svg>
)
const IcoUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V6l7-3z"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a2 2 0 100-4 2 2 0 000 4zm-3.5 4c.6-1.4 2-2 3.5-2s2.9.6 3.5 2"/>
  </svg>
)
const IcoModel = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 16V10m5 6V6m5 10v-4"/>
  </svg>
)
const IcoLuna = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>
  </svg>
)
const IcoChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/><path d="M8.5 10.5h7M8.5 13.5h4.5"/>
  </svg>
)
const IcoMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
)
const IcoX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M6 18L18 6M6 6l12 12"/>
  </svg>
)
const IcoChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <path d="M9 18l6-6-6-6"/>
  </svg>
)
const IcoEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)

// ── Weather ───────────────────────────────────────────────────────────────────
const WEATHER_CODES = {
  0:  { emoji: '☀️',  label: 'Despejado',            bg: '#fef9c3', color: '#854d0e' },
  1:  { emoji: '🌤️', label: 'Mayormente despejado', bg: '#f0f9ff', color: '#0369a1' },
  2:  { emoji: '⛅',  label: 'Parcialmente nublado', bg: '#f1f5f9', color: '#475569' },
  3:  { emoji: '☁️',  label: 'Nublado',              bg: '#f1f5f9', color: '#64748b' },
  45: { emoji: '🌫️', label: 'Neblina',              bg: '#f8fafc', color: '#64748b' },
  48: { emoji: '🌫️', label: 'Neblina helada',       bg: '#f8fafc', color: '#64748b' },
  51: { emoji: '🌦️', label: 'Llovizna leve',         bg: '#eff6ff', color: '#1d4ed8' },
  53: { emoji: '🌦️', label: 'Llovizna moderada',     bg: '#eff6ff', color: '#1d4ed8' },
  55: { emoji: '🌧️', label: 'Llovizna intensa',      bg: '#eff6ff', color: '#1d4ed8' },
  61: { emoji: '🌧️', label: 'Lluvia leve',           bg: '#eff6ff', color: '#1d4ed8' },
  63: { emoji: '🌧️', label: 'Lluvia moderada',       bg: '#eff6ff', color: '#1d4ed8' },
  65: { emoji: '🌧️', label: 'Lluvia intensa',        bg: '#dbeafe', color: '#1e3a8a' },
  71: { emoji: '🌨️', label: 'Nevada leve',           bg: '#f0f9ff', color: '#0369a1' },
  73: { emoji: '🌨️', label: 'Nevada moderada',       bg: '#e0f2fe', color: '#075985' },
  75: { emoji: '❄️',  label: 'Nevada intensa',        bg: '#e0f2fe', color: '#075985' },
  80: { emoji: '🌦️', label: 'Chubascos leves',       bg: '#eff6ff', color: '#1d4ed8' },
  81: { emoji: '🌧️', label: 'Chubascos moderados',   bg: '#eff6ff', color: '#1d4ed8' },
  82: { emoji: '⛈️', label: 'Chubascos fuertes',    bg: '#dbeafe', color: '#1e3a8a' },
  95: { emoji: '⛈️', label: 'Tormenta',             bg: '#f3e8ff', color: '#7e22ce' },
  99: { emoji: '⛈️', label: 'Tormenta con granizo', bg: '#f3e8ff', color: '#7e22ce' },
}

function getWeatherInfo(code) {
  if (WEATHER_CODES[code]) return WEATHER_CODES[code]
  const sorted = Object.keys(WEATHER_CODES).map(Number).sort((a, b) => a - b)
  let best = sorted[0]
  for (const c of sorted) { if (c <= code) best = c }
  return WEATHER_CODES[best] ?? { emoji: '🌡️', label: 'Desconocido', bg: '#f8fafc', color: '#64748b' }
}

function useWeather() {
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    let canceled = false
    let lastCoords = null

    const WEATHER_API = (lat, lon) =>
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto&forecast_days=1`

    const kmBetween = (a, b) => {
      const dLat = (b.lat - a.lat) * 111
      const dLon = (b.lon - a.lon) * 111 * Math.cos(a.lat * Math.PI / 180)
      return Math.sqrt(dLat ** 2 + dLon ** 2)
    }

    const fetchWeather = async (lat, lon) => {
      if (lastCoords && kmBetween(lastCoords, { lat, lon }) < 5) return
      lastCoords = { lat, lon }
      try {
        const [wRes, gRes] = await Promise.all([
          fetch(WEATHER_API(lat, lon)),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`),
        ])
        const wData = await wRes.json()
        const addr = (await gRes.json()).address ?? {}
        const city =
          addr.city ?? addr.city_district ?? addr.town ??
          addr.municipality ?? addr.state_district ??
          addr.village ?? addr.hamlet ?? addr.state ?? 'Mi ubicación'
        if (!canceled) {
          const c = wData.current
          setWeather({
            temp: Math.round(c.temperature_2m),
            feelsLike: Math.round(c.apparent_temperature),
            humidity: c.relative_humidity_2m,
            wind: Math.round(c.wind_speed_10m),
            code: c.weather_code,
            city,
          })
        }
      } catch { /* silent */ }
    }

    let watchId = null

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => fetchWeather(coords.latitude, coords.longitude),
        () => { /* permiso denegado — widget no se muestra */ },
        { enableHighAccuracy: false, timeout: 10000 },
      )
      watchId = navigator.geolocation.watchPosition(
        ({ coords }) => fetchWeather(coords.latitude, coords.longitude),
        () => { /* silent */ },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 },
      )
    }

    return () => {
      canceled = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  return weather
}

const IcoUserSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
    <circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>
  </svg>
)
const IcoMapSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
    <path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>
  </svg>
)
const IcoChevronDown = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 flex-shrink-0 ${className}`}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
)

const IcoImageSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
    <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
  </svg>
)

// ── Nav config ────────────────────────────────────────────────────────────────
// Analizar e Historial se abren como submenús: cada opción elige el modo / la pestaña
const ANALIZAR_SUBNAV = [
  { tab: 'individual', label: 'Individual',  Icon: IcoImageSm },
  { tab: 'parcela',    label: 'Por parcela', Icon: IcoMapSm   },
]
const HISTORIAL_SUBNAV = [
  { tab: 'individual', label: 'Individual',  Icon: IcoUserSm },
  { tab: 'parcelas',   label: 'Por parcela', Icon: IcoMapSm  },
]
// Título de la barra superior para cada opción de los submenús
const SUBNAV_TITLES = {
  analizar:  { individual: 'Análisis individual', parcela: 'Análisis por parcela' },
  historial: { individual: 'Historial de análisis individual', parcelas: 'Historial de análisis por parcela' },
}
const NAV = [
  { id: 'inicio',       label: 'Inicio',           Icon: IcoHome    },
  { id: 'analizar',     label: 'Analizar',         Icon: IcoScan,    children: ANALIZAR_SUBNAV },
  { id: 'historial',    label: 'Historial',        Icon: IcoHistory, children: HISTORIAL_SUBNAV },
  { id: 'consultas',    label: 'Consultas',        Icon: IcoChat    },
  { id: 'luna',         label: 'Calendario Lunar', Icon: IcoLuna    },
  { id: 'enfermedades', label: 'Enfermedades',     Icon: IcoDisease },
  { id: 'mercado',      label: 'Mercado',          Icon: IcoMarket  },
  { id: 'acerca',       label: 'Acerca de',        Icon: IcoInfo    },
]
const RESEARCH_NAV = [
  { id: 'modelo',       label: 'Ficha del modelo', Icon: IcoModel   },
]
const ADMIN_NAV = [
  { id: 'usuarios',     label: 'Usuarios',         Icon: IcoUsers   },
]

const normalizeRole = (role) => String(role ?? '').trim().toLowerCase()
const ROLE_LABELS = { agricultor: 'Agricultor', investigador: 'Investigador', experto: 'Experto', admin: 'Administrador' }
const roleLabel = (role) => ROLE_LABELS[normalizeRole(role)] ?? 'Agricultor'
const canSeeResearch = (role) => ['investigador', 'admin'].includes(normalizeRole(role))
const navForRole = (role) => [
  ...NAV,
  ...(canSeeResearch(role) ? RESEARCH_NAV : []),
  ...(normalizeRole(role) === 'admin' ? ADMIN_NAV : []),
]

// ── Sidebar ───────────────────────────────────────────────────────────────────
// Diseño de la maqueta del usuario: panel claro flotante y delgado (166 px, lo que mide la
// maqueta tal como el usuario la ve en su pantalla), logo de hojas, botones compactos con
// texto gris azulado, píldora verde degradada para la sección activa y, al pie, la foto de
// maizal al atardecer: su onda verde se funde con el pie verde claro donde van la tarjeta de
// usuario y "Cerrar sesión", siempre debajo de la foto (nunca encima).
//
// En pantallas de poca altura (< 760 px) todo se compacta un poco más para que la foto siga
// a la vista. Las clases van completas porque Tailwind solo genera las que encuentra
// escritas literalmente.
const SB_ITEM = 'group relative flex w-full items-center gap-2 rounded-xl py-1 pl-2 pr-1.5 text-[11.5px] outline-hidden transition-[background-color] duration-200 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f1d17] [@media(max-height:759px)]:py-[2px]'
const SB_ITEM_ACTIVE = 'bg-linear-to-r from-[#0a8f4f] via-[#2fa865] to-[#68c470] font-semibold text-white shadow-[0_6px_14px_-8px_rgba(10,143,79,0.75)]'
const SB_ITEM_IDLE = 'font-medium text-[#223048] hover:bg-[#eef6f0] dark:text-slate-200 dark:hover:bg-white/[0.06]'
const SB_ICON = 'grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full transition-[background-color] [&>svg]:h-4 [&>svg]:w-4 [@media(max-height:759px)]:[&>svg]:h-[15px] [@media(max-height:759px)]:[&>svg]:w-[15px]'

const IcoLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
)

const initialsOf = (name) => (
  String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'U'
)

// Onda verde translúcida de la maqueta bajo el logo
const HeaderWave = () => (
  <svg viewBox="0 0 166 24" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-4 w-full">
    <path d="M0 15C34 4 77 22 116 12c19-5 36-6 50-4v16H0Z" className="fill-[#e6f4e7] dark:fill-emerald-400/[0.06]" />
    <path d="M0 19C45 8 86 26 128 15c16-4 29-5 38-3" fill="none" strokeWidth="1" className="stroke-[#c8e7cb] dark:stroke-emerald-400/20" />
  </svg>
)

// Icono del botón: dentro de un círculo translúcido cuando la sección está activa
function NavIcon({ Icon, active }) {
  return (
    <span className={`${SB_ICON} ${active ? 'bg-white/25 text-white' : 'text-[#253446] dark:text-emerald-300/90'}`}>
      <Icon />
    </span>
  )
}

function NavGroup({ item, active, expanded, onToggle, currentTab, onSelect }) {
  const { label, Icon, children } = item
  const submenuId = `submenu-${item.id}`
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={submenuId}
        className={`${SB_ITEM} ${active ? SB_ITEM_ACTIVE : SB_ITEM_IDLE}`}
      >
        <NavIcon Icon={Icon} active={active} />
        <span className="min-w-0 flex-1 break-words text-left">{label}</span>
        <span className="mr-0.5 flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
          <IcoChevronDown className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${active ? 'text-white/90' : 'text-[#223048]/60 dark:text-slate-400'}`} />
        </span>
      </button>

      {/* grid-rows 0fr → 1fr anima la altura del submenú sin medirla */}
      <div
        id={submenuId}
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          {/* La línea del árbol queda centrada bajo el icono del botón padre */}
          <div className="mb-0.5 ml-5 mt-0.5 space-y-0.5 border-l-2 border-[#cfe6d2] pl-1.5 dark:border-emerald-400/20">
            {children.map(({ tab, label: subLabel, Icon: SubIcon }) => {
              const subActive = active && currentTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  tabIndex={expanded ? 0 : -1}
                  onClick={() => onSelect(tab)}
                  aria-current={subActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-1.5 py-[3px] text-[11px] outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-500 [&>svg]:h-[13px] [&>svg]:w-[13px] ${
                    subActive
                      ? 'bg-[#e1f2e3] font-bold text-[#11663a] dark:bg-emerald-400/15 dark:text-emerald-200'
                      : 'font-medium text-[#3a4a5a] hover:bg-[#eef6f0] hover:text-[#223048] dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-100'
                  }`}
                >
                  <SubIcon />
                  <span className="truncate">{subLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ page, setPage, open, onClose, userName, userEmail, userRol, subTabs, onSelectSub, onLogout, badges = {} }) {
  // Acordeón: un solo submenú abierto. Al cambiar de página se abre el de esa página
  // (p. ej. llegar al historial desde "Ver todo" en Inicio) y se cierran los demás.
  const [openGroup, setOpenGroup] = useState(page)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)
  const userBtnRef = useRef(null)
  useEffect(() => { setOpenGroup(page) }, [page])

  useEffect(() => {
    if (!userMenuOpen) return undefined
    const onDown = (e) => { if (!userMenuRef.current?.contains(e.target)) setUserMenuOpen(false) }
    // Escape cierra; si el foco estaba en el menú vuelve a la tarjeta (no se pierde en <body>)
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const inside = userMenuRef.current?.contains(document.activeElement)
      setUserMenuOpen(false)
      if (inside) userBtnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  const go = (id) => { setPage(id); onClose() }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden" onClick={onClose}/>
      )}
      <aside
        aria-label="Barra lateral"
        className={`fixed inset-y-3 left-3 z-40 flex w-[166px] flex-col overflow-hidden rounded-[18px] border border-[#e3e9ee] bg-linear-to-b from-white via-[#f8fbf9] to-[#eef6f0] shadow-[0_18px_40px_-30px_rgba(15,60,40,0.45)] transition-transform duration-300 dark:border-white/10 dark:from-[#0f1d17] dark:via-[#0c1813] dark:to-[#0a1510] ${open ? 'translate-x-0' : '-translate-x-[110%]'} lg:translate-x-0`}
      >
        {/* Logo, menú y foto se desplazan juntos (sin barra visible) solo si la pantalla es
            demasiado baja; el pie con la tarjeta de usuario queda siempre fijo abajo */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="relative flex shrink-0 flex-col items-center px-3 pb-4 pt-3.5 [@media(max-height:759px)]:pb-3 [@media(max-height:759px)]:pt-2.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-black/5 hover:text-slate-600 lg:hidden dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <IcoX />
            </button>
            <img
              src={logoHojas}
              alt=""
              draggable="false"
              className="h-8 w-auto select-none [@media(max-height:759px)]:h-[26px]"
            />
            <p className="mt-0.5 text-[18px] font-extrabold leading-tight text-[#0f4a2a] dark:text-white [@media(max-height:759px)]:text-[17px]">
              AgroScan
            </p>
            <p className="text-[9px] font-medium text-[#3e4f5c] dark:text-slate-400">UAV • Maíz • IA</p>
            <HeaderWave />
          </div>

          <nav aria-label="Navegación principal" className="relative space-y-[3px] px-2.5 pt-1 [@media(max-height:759px)]:space-y-0.5 [@media(max-height:759px)]:pt-0.5">
            {navForRole(userRol).map((item) => {
              const { id, label, Icon, children } = item
              const active = page === id
              if (children) {
                return (
                  <NavGroup
                    key={id}
                    item={item}
                    active={active}
                    expanded={openGroup === id}
                    onToggle={() => setOpenGroup((g) => (g === id ? null : id))}
                    currentTab={subTabs[id]}
                    onSelect={(tab) => { onSelectSub(id, tab); onClose() }}
                  />
                )
              }
              const badge = badges[id] ?? 0
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`${SB_ITEM} ${active ? SB_ITEM_ACTIVE : SB_ITEM_IDLE}`}
                >
                  <NavIcon Icon={Icon} active={active} />
                  <span className="min-w-0 break-words">{label}</span>
                  {/* Conversaciones con novedades (mensajes sin leer, consulta nueva o dictamen nuevo) */}
                  {badge > 0 && (
                    <>
                      <span aria-hidden="true" className={`ml-auto grid h-[17px] min-w-[17px] shrink-0 place-items-center rounded-full px-1 text-[9.5px] font-bold leading-none ${active ? 'bg-white text-[#0a6b3c]' : 'bg-[#0b7a45] text-white dark:bg-emerald-400 dark:text-[#04130b]'}`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                      <span className="sr-only">, {badge} con novedades</span>
                    </>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Foto de la maqueta pegada al pie: crece con el espacio libre (hasta el 40 % del alto
              de la pantalla) y se alinea por abajo para que su onda verde empalme siempre con el
              pie. Arriba se desvanece sobre el fondo del panel. */}
          <div className="h-1.5 shrink-0" />
          <div
            aria-hidden="true"
            className="relative mt-auto max-h-[min(40vh,330px)] min-h-[110px] flex-1 overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,transparent,#000_28px)] [mask-image:linear-gradient(to_bottom,transparent,#000_28px)] [@media(max-height:759px)]:min-h-[96px]"
          >
            <img src={sidebarPhoto} alt="" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-[30%_100%] dark:brightness-[0.82]" />
            <div className="absolute inset-x-0 bottom-0 hidden h-14 bg-linear-to-b from-transparent to-[#0e1f16] dark:block" />
          </div>
        </div>

        {/* Pie verde claro bajo la foto: tarjeta de usuario y cierre de sesión */}
        <div ref={userMenuRef} className="relative z-10 shrink-0 bg-[#d4efd2] px-3 pb-3.5 pt-[3px] dark:bg-[#0e1f16] [@media(max-height:759px)]:pb-2.5">
          {/* Punta de la onda de la foto que continúa por el borde izquierdo, como en la maqueta */}
          <svg viewBox="0 0 10 12" aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-3 w-2.5 dark:hidden">
            <path d="M0 0h10C6 2 2.5 6 0 12Z" fill="#83d18a" />
          </svg>
          <button
            ref={userBtnRef}
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-controls="sb-user-menu"
            aria-expanded={userMenuOpen}
            aria-label={`${userName || 'Usuario'}, ${roleLabel(userRol)}: opciones de la cuenta`}
            title={userName || undefined}
            className="relative flex w-full items-center gap-2 rounded-[11px] border border-white/45 bg-white/30 py-1.5 pl-2.5 pr-2 text-left shadow-[0_4px_12px_-8px_rgba(15,60,40,0.45)] transition hover:bg-white/45 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/10"
          >
            <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#06683b] text-[9.5px] font-bold text-white">
              {initialsOf(userName)}
            </span>
            <span className="min-w-0 flex-1">
              {/* Nombre y primer apellido, como en la maqueta; el nombre completo va en title/aria-label */}
              <span className="block truncate text-[11px] font-bold leading-tight text-[#1e2a33] dark:text-white">{String(userName ?? '').trim().split(/\s+/).slice(0, 2).join(' ') || 'Usuario'}</span>
              <span className="block break-words text-[9.5px] leading-tight text-[#55656f] dark:text-slate-400">{roleLabel(userRol)}</span>
            </span>
            <span className="flex shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">
              <IcoChevronDown className={`text-[#223048] transition-transform dark:text-slate-300 ${userMenuOpen ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {/* Desplegable de la tarjeta: va después del botón para que el orden de tabulación sea el visual */}
          {userMenuOpen && (
            <div id="sb-user-menu" className="absolute inset-x-3 bottom-full mb-1.5 rounded-xl border border-[#e3e9ee] bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#0f1d17]">
              <p className="truncate px-2 pb-1 pt-1 text-[10px] text-[#55656f] dark:text-slate-400">{userEmail || 'Sin correo'}</p>
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); go('perfil') }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-[#223048] transition hover:bg-[#eef6f0] dark:text-slate-200 dark:hover:bg-white/5 [&>svg]:h-3.5 [&>svg]:w-3.5"
              >
                <IcoUserSm />
                Mi perfil
              </button>
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); onLogout() }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400 [&>svg]:h-3.5 [&>svg]:w-3.5"
              >
                <IcoLogout />
                Cerrar sesión
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="ml-2.5 mt-[7px] flex items-center gap-2 rounded-lg px-1.5 py-1 text-[10.5px] font-medium text-[#3b4754] transition hover:bg-white/50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-red-400 [&>svg]:h-3.5 [&>svg]:w-3.5"
          >
            <IcoLogout />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
// Barra superior de la maqueta: «AgroScan / sección» con la fecha debajo, estado de la API,
// clima, campana de alertas y el avatar con su menú (perfil, modo oscuro y cerrar sesión).
// No tiene fondo propio (comparte el de la página, translúcido al desplazarse) y alinea su
// contenido con el de <main> (max-w-6xl). Medidas a la escala en que el usuario ve la maqueta.
const TOPBAR_TITLES = {
  inicio:       'Panel principal',
  analizar:     'Análisis de cultivos',
  historial:    'Historial de análisis',
  enfermedades: 'Guía de enfermedades',
  mercado:      'Mercado agrícola',
  acerca:       'Acerca de nosotros',
  usuarios:     'Gestión de usuarios',
  modelo:       'Ficha del modelo',
  perfil:       'Mi perfil',
  consultas:    'Consultas',
  luna:         'Calendario Lunar',
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
// «Lunes, 16 de Noviembre de 2026», como en la maqueta
const longDate = (d) => (
  `${capitalize(d.toLocaleDateString('es-ES', { weekday: 'long' }))}, ${d.getDate()} de ${capitalize(d.toLocaleDateString('es-ES', { month: 'long' }))} de ${d.getFullYear()}`
)
const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const days = Math.floor(s / 86400)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

// Cierra un desplegable al hacer clic fuera de `ref` o al pulsar Escape; si el foco estaba
// dentro, vuelve al botón que lo abrió (`triggerRef`) en vez de perderse en <body>
function useDismiss(ref, open, setOpen, triggerRef) {
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      const inside = ref.current?.contains(document.activeElement)
      setOpen(false)
      if (inside) triggerRef?.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, setOpen, triggerRef])
}

const IcoCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0">
    <rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>
  </svg>
)
const IcoBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[21px] w-[21px]">
    <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 003.4 0"/>
  </svg>
)
const IcoMoon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/>
  </svg>
)
const IcoSun = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
  </svg>
)

const API_PILL = {
  online:   { label: 'API conectada',    pill: 'bg-[#e5f6ee] text-[#0a6332] dark:bg-emerald-400/10 dark:text-emerald-300', dot: 'bg-[#0f8a4c] dark:bg-emerald-400' },
  checking: { label: 'Verificando API…', pill: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400',           dot: 'bg-slate-400' },
  offline:  { label: 'API desconectada', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',           dot: 'bg-rose-500' },
}

function WeatherPill({ weather }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)
  useDismiss(ref, open, setOpen, btnRef)
  const info = getWeatherInfo(weather.code)
  return (
    <div ref={ref} className="relative hidden shrink-0 md:block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="topbar-clima"
        aria-label={`Clima: ${weather.temp} °C en ${weather.city}`}
        className="inline-flex h-[23px] items-center gap-1.5 rounded-full border border-[#e3e9ee] bg-white/70 px-2.5 text-[10.5px] font-semibold text-[#334155] transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <span className="text-[12px] leading-none">{info.emoji}</span>
        {weather.temp}°C
        <span className="max-w-[90px] truncate font-medium text-[#64748b] dark:text-slate-400">{weather.city}</span>
      </button>

      {open && (
        <div id="topbar-clima" role="region" aria-label="Clima" className="absolute left-0 top-full z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/30 dark:border-white/10 dark:bg-[#111a2b] dark:shadow-none">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-3xl">{info.emoji}</span>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-white">{weather.temp}°C</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{info.label}</p>
            </div>
          </div>
          <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-300">📍 {weather.city}</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-blue-50 p-2 text-center dark:bg-blue-500/10">
              <p className="text-[10px] font-semibold text-blue-500">Sensación</p>
              <p className="text-sm font-black text-blue-700 dark:text-blue-300">{weather.feelsLike}°C</p>
            </div>
            <div className="rounded-xl bg-cyan-50 p-2 text-center dark:bg-cyan-500/10">
              <p className="text-[10px] font-semibold text-cyan-500">Humedad</p>
              <p className="text-sm font-black text-cyan-700 dark:text-cyan-300">{weather.humidity}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2 text-center dark:bg-white/5">
              <p className="text-[10px] font-semibold text-slate-500">Viento</p>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">{weather.wind} <span className="text-[9px] font-normal">km/h</span></p>
            </div>
          </div>
          <div className="mt-3">
            <FlightStatusBadge weather={weather} />
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">📡 Ubicación actual · Open-Meteo</p>
        </div>
      )}
    </div>
  )
}

// Campana: novedades de las consultas a expertos (mensajes sin leer, consultas recibidas sin
// abrir, dictámenes sin ver) y detecciones moderadas y graves recientes del historial. El punto
// rojo indica que hay consultas con novedades o alguna detección posterior a la última vez que se
// abrió el panel (guardado en este navegador).
const ALERTS_SEEN_KEY = 'agro_alerts_seen_at'
const readAlertsSeenAt = () => {
  try { return Number(localStorage.getItem(ALERTS_SEEN_KEY)) || 0 } catch { return 0 }
}

const novedadConsulta = (c) => {
  if (c.no_leidos > 0) return `${c.no_leidos} ${c.no_leidos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`
  if (c.nueva) return 'Nueva conversación'
  if (c.dictamen_nuevo) return 'Emitió su dictamen sobre tu análisis'
  return 'Conversación actualizada'
}

function AlertsBell({ history = [], onOpenHistorial, consultas = [], onOpenConsulta }) {
  const [open, setOpen] = useState(false)
  const [seenAt, setSeenAt] = useState(readAlertsSeenAt)
  const ref = useRef(null)
  const btnRef = useRef(null)
  useDismiss(ref, open, setOpen, btnRef)
  const alerts = history
    .filter((h) => h.severidad === 'Grave' || h.severidad === 'Moderada')
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5)
  const unseen = consultas.length > 0 || alerts.some((a) => new Date(a.fecha).getTime() > seenAt)

  const toggle = () => {
    if (!open) {
      const now = Date.now()
      setSeenAt(now)
      try { localStorage.setItem(ALERTS_SEEN_KEY, String(now)) } catch { /* sin almacenamiento */ }
    }
    setOpen(!open)
  }
  const goHistorial = () => { setOpen(false); onOpenHistorial() }

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-controls="topbar-alertas"
        aria-expanded={open}
        aria-label={unseen ? 'Alertas (hay novedades)' : 'Alertas'}
        className="relative grid h-8 w-8 place-items-center rounded-full text-[#0d1424] transition hover:bg-black/[0.04] dark:text-slate-200 dark:hover:bg-white/5"
      >
        <IcoBell />
        {unseen && <span className="absolute right-[5px] top-[4px] h-[7px] w-[7px] rounded-full bg-[#f7252d] ring-2 ring-slate-50 dark:ring-[#0c1220]" />}
      </button>

      {open && (
        <div id="topbar-alertas" role="region" aria-label="Alertas" className="absolute right-0 top-full z-30 mt-2 max-h-[calc(100dvh-64px)] w-72 overflow-y-auto overscroll-contain rounded-2xl border border-[#e3e9ee] bg-white text-left shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#111a2b]">
          {consultas.length > 0 && (
            <>
              <div className="border-b border-[#eef2f0] px-4 py-3 dark:border-white/10">
                <p className="text-[12.5px] font-bold text-[#0d1424] dark:text-slate-100">Consultas a expertos</p>
                <p className="text-[10.5px] text-[#55656f] dark:text-slate-400">Mensajes que aún no has visto</p>
              </div>
              <ul className="border-b border-[#eef2f0] py-1 dark:border-white/10">
                {consultas.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => { setOpen(false); onOpenConsulta(c.id) }} className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-[#f3f8f5] dark:hover:bg-white/5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e3f6ec] text-[#0b7a45] dark:bg-emerald-400/10 dark:text-emerald-300 [&>svg]:h-[15px] [&>svg]:w-[15px]"><IcoChat /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-[#0d1424] dark:text-slate-100">{c.contraparte?.nombre ?? 'Consulta'}</span>
                        <span className="block truncate text-[10.5px] text-[#55656f] dark:text-slate-400">{novedadConsulta(c)} · {timeAgo(apiDate(c.ultimo_mensaje_at))}</span>
                      </span>
                      {c.no_leidos > 0 && (
                        <span aria-hidden="true" className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[#0b7a45] px-1 text-[10px] font-bold text-white dark:bg-emerald-400 dark:text-[#04130b]">{c.no_leidos}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="border-b border-[#eef2f0] px-4 py-3 dark:border-white/10">
            <p className="text-[12.5px] font-bold text-[#0d1424] dark:text-slate-100">Alertas</p>
            <p className="text-[10.5px] text-[#55656f] dark:text-slate-400">Detecciones moderadas y graves recientes</p>
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-[11.5px] text-[#55656f] dark:text-slate-400">Sin alertas por ahora.</p>
          ) : (
            <ul className="py-1">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={goHistorial} className="flex w-full items-start gap-3 px-4 py-2 text-left transition hover:bg-[#f3f8f5] dark:hover:bg-white/5">
                    <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_PALETTE[a.severidad] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-[#0d1424] dark:text-slate-100">{a.enfermedadLabel} · {a.severidad.toLowerCase()}</span>
                      <span className="block text-[10.5px] text-[#55656f] dark:text-slate-400">{Number(a.affectedPercent ?? 0).toFixed(1)} % afectado · {timeAgo(a.fecha)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={goHistorial} className="block w-full border-t border-[#eef2f0] py-2.5 text-center text-[11.5px] font-semibold text-[#0c6532] transition hover:bg-[#f3f8f5] dark:border-white/10 dark:text-emerald-400 dark:hover:bg-white/5">
            Ver historial
          </button>
        </div>
      )}
    </div>
  )
}

function UserMenu({ userName, userEmail, userRol, onLogout, onProfile }) {
  const { isDark, toggle: toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)
  useDismiss(ref, open, setOpen, btnRef)
  const initials = initialsOf(userName)
  const item = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition [&>svg]:h-4 [&>svg]:w-4'
  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-controls="topbar-cuenta"
        aria-expanded={open}
        aria-label="Menú de usuario"
        className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition hover:bg-black/[0.04] dark:hover:bg-white/5"
      >
        <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#025c33] text-[11.5px] font-bold text-white">{initials}</span>
        <span className="flex text-[#0d1424] dark:text-slate-300 [&>svg]:h-[18px] [&>svg]:w-[18px]">
          <IcoChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div id="topbar-cuenta" className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-[#e3e9ee] bg-white text-left shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#111a2b]">
          <div className="flex items-center gap-3 bg-linear-to-br from-[#e5f4e9] to-[#f5faf7] px-4 py-3.5 dark:from-emerald-400/10 dark:to-transparent">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#025c33] text-[13px] font-bold text-white">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-[#0d1424] dark:text-white">{userName || 'Usuario'}</p>
              <p className="truncate text-[11px] text-[#55656f] dark:text-slate-400">{userEmail || 'Sin correo'}</p>
              <span className="mt-1 inline-flex rounded-full bg-[#d6eedb] px-2 py-0.5 text-[10px] font-bold text-[#0c6532] dark:bg-emerald-400/15 dark:text-emerald-300">{roleLabel(userRol)}</span>
            </div>
          </div>
          <div className="p-1.5">
            <button type="button" onClick={() => { setOpen(false); onProfile() }} className={`${item} text-[#223048] hover:bg-[#f1f7f3] dark:text-slate-200 dark:hover:bg-white/5`}>
              <IcoUserSm />
              Mi perfil
            </button>
            <button type="button" role="switch" aria-checked={isDark} onClick={toggleTheme} className={`${item} text-[#223048] hover:bg-[#f1f7f3] dark:text-slate-200 dark:hover:bg-white/5`}>
              {isDark ? <IcoSun /> : <IcoMoon />}
              <span className="flex-1 text-left">Modo oscuro</span>
              <span aria-hidden="true" className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${isDark ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${isDark ? 'left-4' : 'left-0.5'}`} />
              </span>
            </button>
            <div className="mx-2 my-1 h-px bg-[#eef2f0] dark:bg-white/10" />
            <button type="button" onClick={() => { setOpen(false); onLogout() }} className={`${item} text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400`}>
              <IcoLogout />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Topbar({ page, subTabs = {}, onMenuClick, apiStatus, userName, userEmail, userRol, onLogout, weather, setPage, history, onGoHistorial, consultas, onOpenConsulta }) {
  const title = SUBNAV_TITLES[page]?.[subTabs[page]] ?? TOPBAR_TITLES[page] ?? ''
  const api = API_PILL[apiStatus] ?? API_PILL.offline

  return (
    <header className="sticky top-0 z-20 bg-slate-50/85 backdrop-blur-md dark:bg-[#0c1220]/85">
      <div className="relative mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pb-1.5 pt-2.5 md:px-6">
        {/* Hojas translúcidas de la maqueta detrás de la campana y el avatar */}
        <img
          src={topbarHojas}
          alt=""
          aria-hidden="true"
          draggable="false"
          className="pointer-events-none absolute right-[129px] top-0 hidden h-full w-auto select-none md:block dark:opacity-[0.12]"
        />

        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="relative rounded-lg p-1.5 text-slate-500 transition hover:bg-black/5 lg:hidden dark:text-slate-300 dark:hover:bg-white/10"
        >
          <IcoMenu />
        </button>

        <div className="relative min-w-0">
          <h1 className="truncate font-[Inter,system-ui,sans-serif] text-[13px] font-bold leading-tight text-[#0d1424] dark:text-slate-100">
            AgroScan <span className="font-semibold text-[#0c6532] dark:text-emerald-400">/ {title}</span>
          </h1>
          <p className="mt-[3px] flex items-center gap-1.5 truncate text-[11px] text-[#4b556c] dark:text-slate-400">
            <span className="text-[#384862] dark:text-slate-500"><IcoCalendar /></span>
            {longDate(new Date())}
          </p>
        </div>

        <span className={`relative ml-4 hidden h-[23px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-semibold sm:inline-flex ${api.pill}`}>
          <span className={`h-[7px] w-[7px] rounded-full ${api.dot}`} />
          {api.label}
        </span>

        {weather && <WeatherPill weather={weather} />}

        <div className="relative ml-auto flex shrink-0 items-center gap-4">
          <AlertsBell history={history} onOpenHistorial={() => onGoHistorial('individual')} consultas={consultas} onOpenConsulta={onOpenConsulta} />
          <UserMenu userName={userName} userEmail={userEmail} userRol={userRol} onLogout={onLogout} onProfile={() => setPage('perfil')} />
        </div>
      </div>
    </header>
  )
}

// ── Thumbnail placeholder (heatmap-like) ─────────────────────────────────────
function HeatThumb({ seed = 1 }) {
  const colors = [['#ef4444','#f97316','#eab308'],['#f97316','#eab308','#84cc16'],['#8b5cf6','#a78bfa','#c4b5fd']]
  const c = colors[seed % colors.length]
  return (
    <div className="w-12 h-10 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: '#1e293b' }}>
      <svg viewBox="0 0 48 40" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id={`hg${seed}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={c[0]} stopOpacity="1"/>
            <stop offset="40%" stopColor={c[1]} stopOpacity="0.7"/>
            <stop offset="100%" stopColor={c[2]} stopOpacity="0.2"/>
          </radialGradient>
        </defs>
        <rect width="48" height="40" fill="#0f172a"/>
        <ellipse cx="24" cy="20" rx="16" ry="13" fill={`url(#hg${seed})`}/>
      </svg>
    </div>
  )
}

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ level }) {
  const map = {
    Alta:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    Media: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    Baja:  { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    Nulo:  { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  }
  const s = map[level] || map.Media
  return (
    <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {level}
    </span>
  )
}

// ── Disease dot ───────────────────────────────────────────────────────────────
function DiseaseDot({ name }) {
  const colors = { Sano: '#15803d', Tizón: '#22c55e', Roya: '#f59e0b', 'Mancha Blanca': '#8b5cf6' }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[name] || '#94a3b8' }}/>
      <span className="text-sm text-slate-700 font-medium">{name}</span>
    </div>
  )
}

// ── Flight status badge (semáforo de vuelo) ───────────────────────────────────
const FLIGHT_PALETTE = {
  green:  { bg: '#f0fdf4', border: '#86efac', titleColor: '#166534', msgColor: '#15803d', dot: '#22c55e' },
  yellow: { bg: '#fefce8', border: '#fde68a', titleColor: '#92400e', msgColor: '#b45309', dot: '#eab308' },
  red:    { bg: '#fef2f2', border: '#fca5a5', titleColor: '#991b1b', msgColor: '#b91c1c', dot: '#ef4444' },
}

function getFlightStatus(weather) {
  const now = new Date()
  const h = now.getHours() + now.getMinutes() / 60
  const inHours = h >= 8 && h < 17

  const hasStorm       = weather.code >= 95
  const hasPrecip      = weather.code >= 51
  const hasFog         = weather.code >= 45 && weather.code <= 48
  const isOvercast     = weather.code === 3
  const windDanger     = weather.wind > 30
  const windModerate   = weather.wind > 20 && weather.wind <= 30

  if (hasStorm) {
    return {
      level: 'red',
      title: 'Peligro — No volar',
      msg: 'Tormenta eléctrica activa. Riesgo extremo para el equipo y el piloto.',
    }
  }

  if (!inHours) {
    let msg
    if (now.getHours() < 8) {
      const totalMin = Math.round((8 - h) * 60)
      const hh = Math.floor(totalMin / 60), mm = totalMin % 60
      msg = `El horario de vuelo es 08:00 – 17:00. Disponible en ${hh > 0 ? `${hh}h ` : ''}${mm}min.`
    } else {
      msg = 'Horario de vuelo finalizado. Mañana estará disponible desde las 08:00.'
    }
    return { level: 'red', title: 'Fuera de horario de vuelo', msg }
  }

  if (hasPrecip || hasFog || windDanger) {
    const reasons = []
    if (windDanger)  reasons.push(`viento fuerte ${weather.wind} km/h`)
    if (hasPrecip)   reasons.push('precipitación activa')
    if (hasFog)      reasons.push('visibilidad por niebla')
    return {
      level: 'red',
      title: 'No recomendado volar',
      msg: `Condición adversa detectada: ${reasons.join(', ')}.`,
    }
  }

  if (isOvercast || windModerate) {
    const reasons = []
    if (windModerate) reasons.push(`viento moderado ${weather.wind} km/h`)
    if (isOvercast)   reasons.push('cielo cubierto reduce contraste en imágenes')
    return {
      level: 'yellow',
      title: 'Volar con precaución',
      msg: `Atención: ${reasons.join(', ')}.`,
    }
  }

  const remaining = 17 - h
  const rm = Math.round((remaining % 1) * 60)
  const rh = Math.floor(remaining)
  const window = remaining < 1 ? `${Math.round(remaining * 60)} min restantes` : `${rh}h${rm > 0 ? ` ${rm}m` : ''} restantes`
  return {
    level: 'green',
    title: 'Condiciones óptimas para volar',
    msg: weather.code <= 1
      ? `Cielo despejado, viento ${weather.wind} km/h. Ventana de vuelo: ${window}.`
      : `Luz difusa favorable para imágenes. Viento ${weather.wind} km/h. Ventana: ${window}.`,
  }
}

function FlightStatusBadge({ weather, compact = false }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const { level, title, msg } = getFlightStatus(weather)
  const p = FLIGHT_PALETTE[level]

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border"
        style={{ background: p.bg, borderColor: p.border }}
      >
        <span className="relative flex-shrink-0 w-1.5 h-1.5">
          {level === 'red' && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background: p.dot }} />
          )}
          <span className="relative block w-1.5 h-1.5 rounded-full" style={{ background: p.dot }} />
        </span>
        <span className="text-[10px] font-semibold" style={{ color: p.titleColor }}>{title}</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ background: p.bg, borderColor: p.border }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="relative flex-shrink-0 w-2 h-2">
          {level === 'red' && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background: p.dot }} />
          )}
          <span className="relative block w-2 h-2 rounded-full" style={{ background: p.dot }} />
        </span>
        <p className="text-xs font-bold" style={{ color: p.titleColor }}>{title}</p>
      </div>
      <p className="text-[11px] leading-relaxed pl-4" style={{ color: p.msgColor }}>{msg}</p>
    </div>
  )
}

// ── Weather banner ────────────────────────────────────────────────────────────
function WeatherBanner({ weather }) {
  const info = getWeatherInfo(weather.code)

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${info.bg} 0%, #ffffff 100%)`, borderColor: `${info.color}25` }}
    >
      <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
        <span className="text-4xl select-none">{info.emoji}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black" style={{ color: info.color }}>{weather.temp}°C</span>
            <span className="text-sm font-semibold text-slate-600">{info.label}</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">📍 {weather.city}</p>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Sensación</p>
            <p className="font-black text-slate-700">{weather.feelsLike}°C</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Humedad</p>
            <p className="font-black text-slate-700">{weather.humidity}%</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Viento</p>
            <p className="font-black text-slate-700">{weather.wind} <span className="text-[10px] font-normal">km/h</span></p>
          </div>
        </div>

        <div className="hidden lg:block max-w-xs w-full lg:w-auto">
          <FlightStatusBadge weather={weather} />
        </div>
      </div>

      <div
        className="px-5 py-1.5 border-t flex items-center justify-between"
        style={{ borderColor: `${info.color}15`, background: `${info.bg}80` }}
      >
        <span className="text-[10px] text-slate-400">📡 Ubicación actual · Open-Meteo · Nominatim OSM</span>
        <span className="text-[10px] text-slate-400">
          {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ── Parcel disease maps (shared shape with Historial.jsx) ─────────────────────
function useParcelHistory() {
  const [records, setRecords] = useState(() => loadParcelHistory())
  useEffect(() => {
    const sync = (e) => { if (!e || e.key === PARCEL_HISTORY_KEY) setRecords(loadParcelHistory()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return records
}

// Una tarjeta por parcela física (no por visita) — evita duplicar la misma parcela al revisitarla.
function useParcelaSummaries() {
  const [summaries, setSummaries] = useState(() => getParcelaSummaries())
  useEffect(() => {
    const sync = (e) => { if (!e || e.key === PARCELAS_KEY || e.key === PARCEL_HISTORY_KEY) setSummaries(getParcelaSummaries()) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  return summaries
}

// Iconos de los botones del banner de Inicio
const IcoDrone = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px] shrink-0">
    <rect x="9" y="9.5" width="6" height="5" rx="1.3"/><path d="M9.5 10 6.5 7.5M14.5 10l3-2.5M9.5 14l-3 2.5M14.5 14l3 2.5"/><path d="M3.5 6.5h6M14.5 6.5h6M3.5 17.5h6M14.5 17.5h6"/>
  </svg>
)
const IcoParcelGrid = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
    <path d="M6 5h12l3 14H3L6 5Z"/><path d="M10 5 9 19M14 5l1 14M4.6 12h14.8"/>
  </svg>
)
const IcoArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
)

// ── HomePage ──────────────────────────────────────────────────────────────────
// Panel de Inicio de la maqueta del usuario: banner, tres indicadores con su tendencia semanal,
// último análisis, distribución de detecciones y actividad reciente. Todo sale de datos
// reales: el historial de análisis individuales (API) y las visitas de parcela guardadas en
// este navegador. Medidas a la escala en que el usuario ve la maqueta (~0,68).

// Serie diaria de los últimos `days` días (de más antiguo a hoy) a partir de eventos { fecha, n }
function dailySeries(events, days = 14) {
  const out = Array(days).fill(0)
  events.forEach(({ fecha, n = 1 }) => {
    const idx = days - 1 - daysAgo(fecha)
    if (idx >= 0 && idx < days) out[idx] += n
  })
  return out
}
// Totales por semana de las últimas `weeks` semanas (la última = los 7 días hasta hoy)
function weeklySeries(events, weeks = 8) {
  const out = Array(weeks).fill(0)
  events.forEach(({ fecha, n = 1 }) => {
    const idx = weeks - 1 - Math.floor(daysAgo(fecha) / 7)
    if (idx >= 0 && idx < weeks) out[idx] += n
  })
  return out
}
const sum = (arr) => arr.reduce((a, b) => a + b, 0)

// Porcentajes enteros que suman 100 (método del mayor resto)
function percentages(values) {
  const total = sum(values)
  if (!total) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const out = raw.map(Math.floor)
  let rest = 100 - sum(out)
  raw.map((v, i) => [v - out[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest > 0) { out[i] += 1; rest -= 1 } })
  return out
}

const IcoBars = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="4.5" y="12" width="3.6" height="7.5" rx="1.1"/><rect x="10.2" y="8" width="3.6" height="11.5" rx="1.1"/><rect x="15.9" y="4.5" width="3.6" height="15" rx="1.1"/>
  </svg>
)
const IcoImageFrame = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="m4 17.5 5-5 4 4 2.5-2.5 4.5 4.5"/>
  </svg>
)
const IcoShieldCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3 19 6v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6l7-3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>
  </svg>
)
const IcoSprout = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path d="M11.4 20.6C11 15.4 8.4 12 3.2 11.2c.3 4.8 3.4 8.2 8.2 9.4Z" fill="#14a35d"/>
    <path d="M12.6 20.6c.2-6.6 2.8-11.6 8.3-14.8.9 6.8-2.1 12.5-8.3 14.8Z" fill="#05803f"/>
    <path d="M12 21v-3.5" stroke="#05803f" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)
const IcoPie = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
    <path d="M11 3.1a9 9 0 1 0 9.9 9.9H11Z" fill="#05803f"/><path d="M13 2.1V11h8.9A9 9 0 0 0 13 2.1Z" fill="#14a35d"/>
  </svg>
)
const IcoHistoryArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px] shrink-0">
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 7.5V12l3 2"/>
  </svg>
)
const IcoClockSm = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  </svg>
)

// Estilo de cada indicador (colores muestreados de la maqueta)
const HOME_STATS = [
  { key: 'analisis', label: 'Análisis realizados', Icon: IcoBars, spark: '#16a35a',
    card: 'border-[#dcefe5] bg-[#f2f9f6] dark:border-emerald-400/15 dark:bg-emerald-400/[0.05]',
    halo: 'bg-[#c9ecd8] dark:bg-emerald-400/15', solid: 'from-[#13a35c] to-[#03823f]' },
  { key: 'imagenes', label: 'Imágenes procesadas', Icon: IcoImageFrame, spark: '#2f8ef5',
    card: 'border-[#d7e8fb] bg-[#ecf5fe] dark:border-sky-400/15 dark:bg-sky-400/[0.05]',
    halo: 'bg-[#cfe4fd] dark:bg-sky-400/15', solid: 'from-[#2b95fd] to-[#0473e8]' },
  { key: 'enfermedades', label: 'Enfermedades identificadas', Icon: IcoShieldCheck, spark: '#a35cf0',
    card: 'border-[#e3daf9] bg-[#f3effe] dark:border-violet-400/15 dark:bg-violet-400/[0.05]',
    halo: 'bg-[#e4d7fd] dark:bg-violet-400/15', solid: 'from-[#9150fb] to-[#7430ec]' },
]

function ResultBadge({ resultKey }) {
  const s = RESULT_STYLE[resultKey] ?? RESULT_STYLE.otro
  return (
    <span className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-full pl-1.5 pr-2.5 text-[10.5px] font-semibold ${s.chip}`}>
      <span className={`grid h-[13px] w-[13px] shrink-0 place-items-center rounded-full text-white ${s.icon}`}>
        {resultKey === 'sano' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="h-2 w-2"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
        ) : (
          <span className="text-[9px] font-black leading-none">!</span>
        )}
      </span>
      <span className="truncate">{s.text}</span>
    </span>
  )
}

// Variación de los últimos 7 días frente a los 7 anteriores
function TrendChip({ cur, prev }) {
  const up = cur >= prev
  const text = prev > 0 ? `${up ? '+' : '−'}${Math.round((Math.abs(cur - prev) / prev) * 100)}%` : cur > 0 ? `+${cur}` : '+0%'
  return (
    <span
      title={`Últimos 7 días: ${cur} · 7 días anteriores: ${prev}`}
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? 'text-[#0b8a4b] dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`h-2.5 w-2.5 ${up ? '' : 'rotate-180'}`}>
        <path d="M12 19V5M6 11l6-6 6 6"/>
      </svg>
      {text}
    </span>
  )
}

// Curva suave con relleno degradado (Catmull-Rom → Bézier), como las de la maqueta
function AreaSparkline({ data, color, id }) {
  const w = 120, h = 30
  const max = Math.max(1, ...data)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - (v / max) * (h - 9)])
  const clampY = (y) => Math.min(h - 1, Math.max(1, y))
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${clampY(p1[1] + (p2[1] - p0[1]) / 6)} ${p2[0] - (p3[0] - p1[0]) / 6},${clampY(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${id})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  )
}

// Anillo de la distribución: empieza arriba, sentido horario, con la mazorca en el centro
function DetectionDonut({ slices }) {
  const size = 128, stroke = 23, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const total = sum(slices.map((s) => s.value))
  let acc = 0
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-white/5"/>
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * c
          const gap = slices.length > 1 ? 1.5 : 0
          const arc = (
            <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0)} ${c}`} strokeDashoffset={-acc}/>
          )
          acc += len
          return arc
        })}
        {/* Borde exterior muy suave: define el anillo cuando un tramo es claro (crema) sobre blanco */}
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 0.5} fill="none" strokeWidth="1" className="stroke-black/[0.08] dark:stroke-white/[0.08]"/>
      </svg>
      <div className="absolute inset-[23px] grid place-items-center rounded-full border border-[#eef1f4] bg-white shadow-[0_4px_12px_-6px_rgba(15,40,30,0.3)] dark:border-white/10 dark:bg-[#0f1a2b]">
        <img src={inicioMazorca} alt="" draggable="false" className="h-[52px] w-auto select-none"/>
      </div>
    </div>
  )
}

// Imagen del análisis completa dentro de un cuadro: la de salida (original + área afectada +
// caja + etiqueta, guardada al analizar) o la original. Nunca se recorta (object-contain); el
// sobrante del cuadro se rellena con la misma imagen ampliada y desenfocada.
function AnalysisSquare({ result, original, alt }) {
  const [view, setView] = useState(result ? 'result' : 'original')
  const [broken, setBroken] = useState(false)
  const src = view === 'result' ? (result || original) : (original || result)
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px] shrink-0 overflow-hidden rounded-[10px] bg-[#1d2a22] ring-1 ring-black/5 sm:mx-0 sm:w-[176px] dark:ring-white/10">
      {src && !broken ? (
        <>
          <img src={src} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-80 blur-md"/>
          <img key={src} src={src} alt={alt} className="relative h-full w-full object-contain" onError={() => setBroken(true)}/>
        </>
      ) : (
        <div className="grid h-full place-items-center bg-[#eef3ef] px-3 text-center text-[10.5px] text-[#55656f] dark:bg-white/5 dark:text-slate-400">Imagen no disponible</div>
      )}
      {result && original && (
        <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
          <div role="group" aria-label="Imagen mostrada" className="inline-flex rounded-full bg-white/90 p-0.5 shadow-sm backdrop-blur-sm dark:bg-[#0f1a2b]/85">
            {[['result', 'Resultado'], ['original', 'Original']].map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => { setView(v); setBroken(false) }}
                className={`rounded-full px-2 py-[3px] text-[9.5px] font-semibold transition ${view === v ? 'bg-[#02894b] text-white' : 'text-[#1d2640] hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Diagnóstico junto a la imagen: enfermedad, severidad, área afectada y la recomendación
// principal del catálogo
function AnalysisSummary({ item, resultKey, onOpen }) {
  const { isDark } = useTheme()
  const healthy = resultKey === 'sano'
  const meta = diseaseMeta(item.enfermedad)
  const pct = Number(item.affectedPercent ?? 0)
  const rec = recommendationsFor(healthy ? 'Fondo' : item.enfermedad)[0]
  return (
    <div className="min-w-0 flex-1 pr-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: resultColor(resultKey, isDark) }}/>
        <p className="truncate font-[Manrope,Inter,sans-serif] text-[15px] font-extrabold text-[#0b1226] dark:text-white">{healthy ? 'Cultivo sano' : meta.label}</p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold ${SEVERITY_CHIP[item.severidad] ?? SEVERITY_CHIP.Leve}`}>{item.severidad}</span>
        <span className="text-[10.5px] text-[#55656f] dark:text-slate-400">
          {healthy ? 'Sin síntomas de enfermedad' : `${pct.toFixed(1)} % del área afectada`}
        </span>
      </div>
      {!healthy && <SeverityScale pct={pct}/>}
      {rec && (
        <div className="mt-2.5 rounded-lg bg-[#f4f8f5] px-2.5 py-1.5 dark:bg-white/[0.04]">
          <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#0b6b35] dark:text-emerald-400">Recomendación</p>
          <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-[#334155] dark:text-slate-300">
            <span className="font-semibold">{rec.title}:</span> {rec.body}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="mt-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-[9px] bg-[#02894b] px-3 text-[10.5px] font-semibold text-white shadow-[0_6px_12px_-8px_rgba(2,137,75,0.8)] transition hover:bg-[#027a42] [&>svg:first-child]:h-[13px] [&>svg:first-child]:w-[13px]"
      >
        <IcoEye/>
        Ver diagnóstico
        <IcoArrowRight/>
      </button>
    </div>
  )
}

const HOME_CARD = 'rounded-xl border border-[#e6ebf0] bg-white shadow-[0_6px_18px_-14px_rgba(15,40,30,0.28)] dark:border-[#1e3048] dark:bg-[#162032]'
const HOME_TITLE = 'font-[Manrope,Inter,sans-serif] text-[14px] font-extrabold text-[#0b1226] dark:text-white'

function HomePage({ onGoAnalizar, onGoHistorial, history }) {
  const { isDark } = useTheme()
  const parcelHistory = useParcelHistory()
  const parcelaSummaries = useParcelaSummaries()
  const [selectedId, setSelectedId] = useState(null)
  const lastCardRef = useRef(null)

  // ── Indicadores: total, serie diaria de 14 días y tendencia de la última semana
  const doneSamples = (r) => (r.samples ?? []).filter((s) => s.status === 'done' && s.result)
  const sickKey = (cls) => { const key = diseaseKey(cls); return key && key !== 'sano' ? key : null }
  const analysisEvents = [...history.map((h) => ({ fecha: h.fecha })), ...parcelHistory.map((r) => ({ fecha: r.fecha }))]
  const imageEvents = [...history.map((h) => ({ fecha: h.fecha })), ...parcelHistory.map((r) => ({ fecha: r.fecha, n: doneSamples(r).length }))]
  const detections = [
    ...history.map((h) => ({ fecha: h.fecha, key: h.estado === 'Sano' ? null : sickKey(h.enfermedad) })),
    ...parcelHistory.flatMap((r) => doneSamples(r).map((s) => ({ fecha: r.fecha, key: sickKey(s.result.target_class) }))),
  ].filter((d) => d.key)
  const distinctBetween = (lo, hi) => new Set(detections.filter((d) => { const n = daysAgo(d.fecha); return n >= lo && n <= hi }).map((d) => d.key)).size
  // Tendencia: últimos 7 días frente a los 7 anteriores. Curva: totales de las últimas 8 semanas
  const week = (events) => { const d = dailySeries(events); return { cur: sum(d.slice(7)), prev: sum(d.slice(0, 7)) } }
  const stats = [
    { ...HOME_STATS[0], value: analysisEvents.length, ...week(analysisEvents), series: weeklySeries(analysisEvents) },
    { ...HOME_STATS[1], value: sum(imageEvents.map((e) => e.n ?? 1)), ...week(imageEvents), series: weeklySeries(imageEvents) },
    { ...HOME_STATS[2], value: new Set(detections.map((d) => d.key)).size, cur: distinctBetween(0, 6), prev: distinctBetween(7, 13), series: weeklySeries(detections) },
  ]

  // ── Distribución de resultados: cada imagen analizada (individual o muestra de parcela)
  // cuenta con su clase, incluida «sano» (clase 0 del modelo)
  const counts = {}
  ;[
    ...history.map((h) => (h.estado === 'Sano' ? 'sano' : diseaseKey(h.enfermedad))),
    ...parcelHistory.flatMap((r) => doneSamples(r).map((s) => diseaseKey(s.result.target_class))),
  ].filter(Boolean).forEach((key) => { counts[key] = (counts[key] ?? 0) + 1 })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const pcts = percentages(entries.map(([, v]) => v))
  const distribution = entries.map(([key, value], i) => ({ key, value, pct: pcts[i], label: DISEASES[key].short, color: resultColor(key, isDark) }))

  // ── Último análisis individual (o el que se eligió con «Ver» en la tabla)
  const byDate = [...history].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  const latest = byDate[0] ?? null
  const shown = (selectedId != null && history.find((h) => h.id === selectedId)) || latest
  const showingLatest = !shown || shown === latest
  const shownKey = shown ? resultKeyOf(shown.enfermedad, shown.estado === 'Sano') : null

  // ── Actividad reciente: análisis individuales y visitas de parcela, lo más nuevo primero
  const parcelName = (r) => parcelaSummaries.find((p) => p.id === r.parcelaId)?.nombre ?? 'Parcela'
  const activity = [
    ...history.map((h) => ({ kind: 'individual', id: `i-${h.id}`, fecha: h.fecha, h })),
    ...parcelHistory.map((r) => ({ kind: 'parcela', id: `p-${r.id}`, fecha: r.fecha, r })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5)

  const viewRow = (row) => {
    if (row.kind === 'parcela') { onGoHistorial('parcelas'); return }
    setSelectedId(row.h.id)
    lastCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="space-y-3">
      {/* ── Hero (maqueta del usuario): foto del dron con cristal esmerilado a la izquierda ── */}
      <section className="relative overflow-hidden rounded-2xl border border-[#dbe8df] shadow-[0_14px_30px_-24px_rgba(15,60,40,0.55)] dark:border-white/10">
        <img src={heroDron} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-left dark:brightness-[0.45]" />
        {/* Si el banner es estrecho el texto queda sobre la foto: velo para que se lea */}
        <div className="absolute inset-0 bg-linear-to-r from-white/80 via-white/55 to-white/10 lg:hidden dark:hidden" />
        <div className="absolute inset-0 hidden bg-linear-to-r from-[#0c1220]/90 via-[#0c1220]/60 to-[#0c1220]/10 dark:block" />

        <div className="relative flex items-start gap-3.5 px-4 pb-3 pt-5 sm:pl-[13px] sm:pr-6">
          <img src={heroInsignia} alt="" aria-hidden="true" draggable="false" className="-mt-[7px] hidden h-[66px] w-[66px] shrink-0 select-none drop-shadow-[0_6px_10px_rgba(15,60,40,0.16)] sm:block" />
          <div className="min-w-0">
            <h2 className="text-[23px] font-extrabold leading-tight text-[#0b1226] dark:text-white">Panel de diagnóstico</h2>
            <p className="mt-1 text-[11.5px] leading-snug text-[#1d2640] dark:text-slate-300">
              Supervisa la salud de tus cultivos de maíz con inteligencia artificial.
            </p>
            <div className="mt-3.5 flex flex-wrap gap-3.5">
              <button
                type="button"
                onClick={() => onGoAnalizar('individual')}
                className="inline-flex h-[30px] items-center gap-2 rounded-[11px] bg-[#02894b] px-4 text-[11.5px] font-semibold text-white shadow-[0_8px_16px_-8px_rgba(2,137,75,0.7)] transition hover:bg-[#027a42] active:scale-[0.98]"
              >
                <IcoDrone />
                Nuevo análisis
                <IcoArrowRight />
              </button>
              <button
                type="button"
                onClick={() => onGoAnalizar('parcela')}
                className="inline-flex h-[30px] items-center gap-2 rounded-[11px] border border-[#8ccf9f] bg-white/75 px-4 text-[11.5px] font-semibold text-[#0f3d26] backdrop-blur-sm transition hover:bg-white active:scale-[0.98] dark:border-emerald-400/40 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/15"
              >
                <span className="text-[#0b6b35] dark:text-emerald-300"><IcoParcelGrid /></span>
                Analizar parcela
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Indicadores ── */}
      <div className="grid gap-2.5 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.key} className={`flex h-[61px] items-center gap-4 overflow-hidden rounded-xl border pl-[13px] pr-3 ${s.card}`}>
            {/* El texto conserva su ancho; la curva ocupa el espacio que sobre (y desaparece si no hay) */}
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${s.halo}`}>
              <span className={`grid h-9 w-9 place-items-center rounded-full bg-linear-to-b text-white shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)] ${s.solid} [&>svg]:h-[18px] [&>svg]:w-[18px]`}>
                <s.Icon/>
              </span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-medium text-[#1d2640] dark:text-slate-300">{s.label}</p>
              <div className="mt-0.5 flex items-baseline gap-3">
                <span className="font-[Manrope,Inter,sans-serif] text-[22px] font-extrabold leading-none text-[#0b1226] dark:text-white">{s.value}</span>
                <TrendChip cur={s.cur} prev={s.prev}/>
              </div>
            </div>
            <div className="mb-[11px] ml-auto h-[29px] min-w-0 max-w-[170px] flex-1 basis-0 self-end">
              <AreaSparkline data={s.series} color={s.spark} id={`spark-${s.key}`}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Último análisis + Distribución de detecciones ── */}
      <div className="grid gap-[11px] lg:grid-cols-[1.4fr_1fr]">
        <section ref={lastCardRef} className={`flex scroll-mt-20 flex-col overflow-hidden ${HOME_CARD}`}>
          <header className="flex min-h-[37px] flex-wrap items-center gap-x-3 gap-y-1 px-[15px] py-1.5">
            <IcoSprout/>
            <h3 className={HOME_TITLE}>{showingLatest ? 'Último análisis' : 'Análisis seleccionado'}</h3>
            {shown && (
              <div className="ml-auto flex items-center gap-3.5">
                <span className="inline-flex h-[21px] items-center gap-1.5 rounded-full bg-[#e5f6ee] px-2.5 text-[10px] font-semibold text-[#0a6332] dark:bg-emerald-400/10 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0f8a4c] dark:bg-emerald-400"/>
                  Análisis individual
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[#1d2640] dark:text-slate-300">
                  <IcoClockSm/>
                  {whenLabel(shown.fecha, ' · ')}
                </span>
              </div>
            )}
          </header>
          {shown ? (
            <div className="flex flex-1 flex-col gap-3.5 px-2 pb-3 sm:flex-row sm:items-center">
              <AnalysisSquare
                key={shown.id}
                result={shown.resultadoImage}
                original={shown.imagen}
                alt={`Análisis: ${shownKey === 'sano' ? 'cultivo sano' : diseaseMeta(shown.enfermedad).label}`}
              />
              <AnalysisSummary item={shown} resultKey={shownKey} onOpen={() => onGoHistorial('individual')}/>
            </div>
          ) : (
            <div className="mx-2 mb-3 grid flex-1 place-items-center rounded-[10px] bg-linear-to-br from-[#e3f2e6] to-[#cfe7d5] px-6 py-8 text-center dark:from-white/5 dark:to-white/[0.02]">
              <div>
                <p className="text-[12px] font-semibold text-[#1d2640] dark:text-slate-200">Aún no hay análisis</p>
                <p className="mt-0.5 text-[10.5px] text-[#55656f] dark:text-slate-400">Sube una imagen para ver aquí su diagnóstico.</p>
                <button type="button" onClick={() => onGoAnalizar('individual')} className="mt-2.5 inline-flex h-[26px] items-center gap-1.5 rounded-[9px] bg-[#02894b] px-3 text-[10.5px] font-semibold text-white transition hover:bg-[#027a42]">
                  Nuevo análisis
                  <IcoArrowRight/>
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={`relative flex flex-col overflow-hidden ${HOME_CARD}`}>
          <img src={inicioHojas} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute bottom-0 right-0 h-[56px] w-auto select-none dark:opacity-10"/>
          <header className="flex h-[37px] items-center gap-3 px-[15px]">
            <IcoPie/>
            <h3 className={HOME_TITLE}>Distribución de detecciones</h3>
          </header>
          {distribution.length > 0 ? (
            <div className="relative flex flex-1 items-center justify-center gap-5 px-5 pb-4 pt-0.5 xl:gap-10">
              <DetectionDonut slices={distribution}/>
              <ul className="min-w-0 max-w-[220px] flex-1 space-y-[7px]">
                {distribution.map((d) => (
                  <li key={d.key} className="flex items-center gap-2.5 text-[12px] text-[#1d2640] dark:text-slate-200">
                    <span className="h-[13px] w-[13px] shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10" style={{ background: d.color }}/>
                    <span className="min-w-0 flex-1 truncate whitespace-nowrap font-medium">{d.label}</span>
                    <span className="font-semibold tabular-nums">{d.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="relative grid min-h-[149px] flex-1 place-items-center px-6 text-center">
              <div>
                <p className="text-[12px] font-semibold text-[#1d2640] dark:text-slate-200">Aún no hay resultados</p>
                <p className="mt-0.5 text-[10.5px] text-[#55656f] dark:text-slate-400">Cuando analices imágenes verás aquí qué proporción salió sana y con cada enfermedad.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Actividad reciente ── */}
      <section className={`overflow-hidden ${HOME_CARD}`}>
        <header className="flex h-[30px] items-center gap-2.5 px-[15px]">
          <span className="text-[#0b8a4b] dark:text-emerald-400"><IcoHistoryArrow/></span>
          <h3 className={`${HOME_TITLE} text-[13.5px]`}>Actividad reciente</h3>
          <button type="button" onClick={() => onGoHistorial('individual')} className="ml-auto inline-flex items-center gap-1.5 rounded-md text-[10.5px] font-semibold text-[#0b6b35] transition hover:text-[#02894b] hover:underline dark:text-emerald-400">
            Ver todo el historial
            <IcoArrowRight/>
          </button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[24%]"/><col className="w-[20%]"/><col className="w-[17%]"/><col className="w-[25%]"/><col className="w-[14%]"/>
            </colgroup>
            <thead className="bg-[#f3f4f8] dark:bg-white/[0.03]">
              <tr className="h-[22px] text-[10.5px] text-[#5a6478] dark:text-slate-400">
                <th scope="col" className="pl-[15px] font-medium">Imagen</th>
                <th scope="col" className="font-medium">Cultivo / parcela</th>
                <th scope="col" className="font-medium">Fecha</th>
                <th scope="col" className="font-medium">Resultado</th>
                <th scope="col" className="pr-[15px] font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-[15px] py-6 text-center text-[11.5px] text-[#55656f] dark:text-slate-400">
                    Aún no hay actividad. Analiza una imagen o una parcela para empezar.
                  </td>
                </tr>
              ) : activity.map((row) => {
                const isParcel = row.kind === 'parcela'
                const resultKey = isParcel
                  ? visitResultKey(row.r)
                  : resultKeyOf(row.h.enfermedad, row.h.estado === 'Sano')
                const selected = !isParcel && shown && row.h.id === shown.id
                return (
                  <tr key={row.id} className={`h-8 border-t border-[#f1f3f8] text-[11px] text-[#1d2640] dark:border-white/5 dark:text-slate-200 ${selected ? 'bg-[#f6fbf8] dark:bg-white/[0.03]' : ''}`}>
                    <td className="pl-[15px]">
                      <div className="flex items-center gap-[15px]">
                        {isParcel ? (
                          <ParcelMiniMap vertices={row.r.vertices} samples={row.r.samples}/>
                        ) : (
                          <span className="h-6 w-[53px] shrink-0 overflow-hidden rounded-[4px] bg-[#e3f2e6] dark:bg-white/5">
                            {row.h.imagen && <img src={row.h.imagen} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }}/>}
                          </span>
                        )}
                        <span className="truncate text-[11.5px]">{isParcel ? 'Muestreo de parcela' : 'Análisis individual'}</span>
                      </div>
                    </td>
                    <td className="truncate pr-3">
                      {isParcel ? `${parcelName(row.r)} · ${row.r.ha} ha` : (row.h.cultivo ?? 'Maíz')}
                    </td>
                    <td className="truncate pr-3">{whenLabel(row.fecha, ', ')}</td>
                    <td className="pr-3"><ResultBadge resultKey={resultKey}/></td>
                    <td className="pr-[15px]">
                      <button
                        type="button"
                        onClick={() => viewRow(row)}
                        aria-label={isParcel ? `Ver la parcela ${parcelName(row.r)} en el historial` : `Ver el análisis del ${whenLabel(row.fecha, ' a las ')}`}
                        className="inline-flex h-6 items-center gap-1.5 rounded-full bg-[#e3f6ec] px-3 text-[10.5px] font-semibold text-[#0b6b35] transition hover:bg-[#d2efdf] dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/20 [&>svg]:h-[13px] [&>svg]:w-[13px]"
                      >
                        <IcoEye/>
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function ResearchHomePage({ setPage, apiStatus, history, weather, onGoAnalizar, onGoHistorial }) {
  const { isDark } = useTheme()
  const totalAnalyses = history.length
  const diseasedCount = history.filter((item) => item.estado === 'Con enfermedad').length
  const healthyCount = history.filter((item) => item.estado === 'Sano').length
  const avgConfidence = history.length
    ? (history.reduce((sum, item) => sum + (Number(item.confianza ?? 0) * 100), 0) / history.length).toFixed(1)
    : '0.0'

  const researchCards = [
    { label: 'Pruebas ejecutadas', value: String(totalAnalyses), subtitle: 'Total de evaluaciones', color: '#22c55e', icon: '🧪' },
    { label: 'Confianza promedio', value: `${avgConfidence}%`, subtitle: 'Predicción media', color: '#3b82f6', icon: '📊' },
    { label: 'Casos detectados', value: String(diseasedCount), subtitle: 'Con enfermedad', color: '#f59e0b', icon: '🦠' },
    { label: 'Casos sanos', value: String(healthyCount), subtitle: 'Sin patología', color: '#14b8a6', icon: '✅' },
  ]

  const modelMetrics = [
    { label: 'Precisión', value: '92.4%', note: 'Sobre validación cruzada' },
    { label: 'Sensibilidad', value: '94.1%', note: 'Detección de enfermedad' },
    { label: 'F1-score', value: '91.8%', note: 'Balance clase / error' },
    { label: 'Latencia', value: '1.8s', note: 'Promedio por imagen' },
  ]

  return (
    <div className="space-y-5">
      <div className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-500">Modo investigador</p>
            <h2 className={`mt-2 text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Panel de pruebas y evaluación</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Sistema operativo
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {researchCards.map((card) => (
            <div key={card.label} className={`rounded-2xl border p-4 ${isDark ? 'border-[#1e3048] bg-[#0e1929]' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <div className="text-2xl">{card.icon}</div>
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: card.color }} />
              </div>
              <p className="mt-3 text-2xl font-black text-slate-900">{card.value}</p>
              <p className="text-sm font-semibold text-slate-700">{card.label}</p>
              <p className="text-[11px] text-slate-500">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Métricas del modelo</h3>
            <button className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold text-violet-700">Última validación</button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {modelMetrics.map((metric) => (
              <div key={metric.label} className={`rounded-2xl border p-4 ${isDark ? 'border-[#1e3048] bg-[#0e1929]' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Estado del sistema</h3>

          <div className="mt-5 space-y-4">
            {[
              ['API', apiStatus === 'online' ? 'Activa' : 'Revisando'],
              ['Modelo', 'MIT-B1 + DeepLabV3+'],
              ['XAI', 'Grad-CAM habilitado'],
              ['Dataset', 'Maíz / Imbabura'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-sm font-semibold text-slate-600">{label}</span>
                <span className="text-sm font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-[28px] border p-5 shadow-sm ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className={`text-lg font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Herramientas de prueba</h3>
          <div className="flex gap-2">
            <button onClick={() => onGoAnalizar('individual')} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">Probar análisis</button>
            <button onClick={() => onGoHistorial('individual')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Ver historial</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            { title: 'Validación por imagen', desc: 'Subir una imagen para verificar la clasificación del modelo y observar la activación XAI.', icon: '🖼️' },
            { title: 'Evaluación de lote', desc: 'Analizar parcelas completas para comparar umbrales y detectar patrones espaciales.', icon: '🚁' },
            { title: 'Reporte de métricas', desc: 'Revisar resultados y analizar confiabilidad del diagnóstico para investigación.', icon: '📈' },
          ].map((item) => (
            <div key={item.title} className={`rounded-2xl border p-4 ${isDark ? 'border-[#1e3048] bg-[#0e1929]' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-2xl">{item.icon}</div>
              <h4 className={`mt-3 text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.title}</h4>
              <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {weather && <WeatherBanner weather={weather} />}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
const DISEASE_LABELS = {
  Fondo: 'Cultivo Sano',
  Tizon: 'Tizón del Maíz',
  Roya: 'Roya',
  Mancha_blanca: 'Mancha Blanca',
}

function toHistoryItem(record) {
  const diseaseName = record.enfermedad?.nombre ?? 'Desconocido'
  const confidencePercent = affectedFromRecord(record)

  return {
    id: record.id,
    fecha: apiDate(record.fecha),
    imagen: record.imagen_url,
    enfermedad: diseaseName,
    enfermedadLabel: DISEASE_LABELS[diseaseName] ?? diseaseName,
    confianza: confidencePercent / 100,
    severidad: severityFromRecord(record),
    cultivo: 'Maíz',
    recomendaciones: '',
    xaiImage: record.grad_cam_url,
    resultadoImage: record.resultado_url,
    affectedPercent: confidencePercent,
    estado: record.enfermedad?.clase_idx === 0 ? 'Sano' : 'Con enfermedad',
  }
}

export default function App() {
  const [page, setPage] = useState('inicio')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [apiStatus, setApiStatus] = useState('checking')
  const [analysisHistory, setAnalysisHistory] = useState([])
  const [authenticated, setAuthenticated] = useState(() => isLogged())
  const [authNotice, setAuthNotice] = useState('')
  const [enfermedades, setEnfermedades] = useState([])
  const [userName, setUserName]   = useState('Usuario')
  const [userEmail, setUserEmail] = useState('')
  const [userRol, setUserRol]     = useState('agricultor')
  const [userId, setUserId]       = useState(null)
  const [userEspecialidad, setUserEspecialidad] = useState('')
  const [analizarMode, setAnalizarMode] = useState('individual')
  const isResearcher = normalizeRole(userRol) === 'investigador' || normalizeRole(userRol) === 'researcher'
  const isAdmin = normalizeRole(userRol) === 'admin'
  const [historialTab, setHistorialTab] = useState('individual')
  const [historialVisit, setHistorialVisit] = useState(0)
  const [preselectedParcelaId, setPreselectedParcelaId] = useState(null)
  // Consultas a expertos: conversación a abrir (desde la campana o al enviar un análisis),
  // resumen para el contador del menú y las conversaciones con novedades para la campana
  const [consultaSel, setConsultaSel] = useState(null)
  const [consultasResumen, setConsultasResumen] = useState(null)
  const [consultasNovedades, setConsultasNovedades] = useState([])
  const weather = useWeather()

  const goToAnalizar = (mode = 'individual', parcelaId = null) => {
    setAnalizarMode(mode)
    setPreselectedParcelaId(parcelaId)
    setPage('analizar')
  }

  // Cada clic en el submenú remonta el historial: volver a pulsar la sección activa regresa a la lista
  const goToHistorial = (tab = 'individual') => {
    setHistorialTab(tab)
    setHistorialVisit((n) => n + 1)
    setPage('historial')
  }

  // Abre la página de consultas con esa conversación seleccionada
  const goToConsulta = (id) => {
    setConsultaSel({ id, at: Date.now() })
    setPage('consultas')
  }

  // Opción activa de cada submenú del lateral (y título de la barra superior)
  const subTabs = { analizar: analizarMode, historial: historialTab }

  // Evita reusar un parcelaId preseleccionado si el usuario navega a Analizar
  // por otra vía (ej. la barra lateral) después de haberlo consumido.
  useEffect(() => {
    if (page !== 'analizar') setPreselectedParcelaId(null)
    if (page !== 'consultas') setConsultaSel(null)
  }, [page])

  // Novedades de las consultas cada 30 s (y al volver a la pestaña). Solo si hay alguna se pide
  // la lista, para mostrar en la campana de quién son.
  const refreshConsultas = useCallback(async () => {
    try {
      const { data } = await fetchConsultasResumen()
      setConsultasResumen(data)
      if (data?.consultas_con_novedad > 0) {
        const { data: lista } = await fetchConsultas()
        setConsultasNovedades((Array.isArray(lista) ? lista : []).filter((c) => c.no_leidos > 0 || c.nueva || c.dictamen_nuevo).slice(0, 5))
      } else {
        setConsultasNovedades([])
      }
    } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
  }, [])

  useEffect(() => {
    if (!authenticated) return undefined
    refreshConsultas()
    const timer = setInterval(() => { if (!document.hidden) refreshConsultas() }, 30000)
    const onVisible = () => { if (!document.hidden) refreshConsultas() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authenticated, refreshConsultas])

  useEffect(() => {
    let canceled = false

    const loadApiStatus = async () => {
      setApiStatus('checking')
      try {
        await api.get('/health')
        if (!canceled) setApiStatus('online')
      } catch {
        if (!canceled) setApiStatus('offline')
      }
    }

    const loadUserData = async () => {
      if (!authenticated) return
      try {
        const [meResponse, historyResponse, enfResponse] = await Promise.all([fetchMe(), fetchAnalisis(), fetchEnfermedades()])
        if (canceled) return
        setUserName(meResponse.data.nombre)
        setUserEmail(meResponse.data.email ?? '')
        setUserRol(meResponse.data.rol ?? 'agricultor')
        setUserId(meResponse.data.id ?? null)
        setUserEspecialidad(meResponse.data.especialidad ?? '')
        // El experto entra directo a sus consultas
        if (normalizeRole(meResponse.data.rol) === 'experto') setPage((p) => (p === 'inicio' ? 'consultas' : p))
        const backendHistory = Array.isArray(historyResponse.data) ? historyResponse.data.map(toHistoryItem) : []
        setAnalysisHistory(backendHistory)
        setEnfermedades(Array.isArray(enfResponse.data) ? enfResponse.data : [])
      } catch (error) {
        if (error?.response?.status === 401) {
          clearAuthData()
          setAuthenticated(false)
          setAnalysisHistory([])
        }
        // Otros errores (red caída, 500, timeout) no cierran la sesión
      }
    }

    loadApiStatus()
    loadUserData()
    return () => { canceled = true }
  }, [authenticated])

  const handleLogin = () => {
    setAuthNotice('')
    setAuthenticated(true)
    setPage('inicio')
  }

  const resetSession = () => {
    clearAuthData()
    setAuthenticated(false)
    setAnalysisHistory([])
    setUserName('Usuario')
    setUserEmail('')
    setUserRol('agricultor')
    setUserId(null)
    setUserEspecialidad('')
    setConsultaSel(null)
    setConsultasResumen(null)
    setConsultasNovedades([])
    setPage('inicio')
  }

  // api.js emite este evento cuando el servidor rechaza la renovación de la sesión
  useEffect(() => {
    const onSessionExpired = () => {
      resetSession()
      setAuthNotice('Tu sesión expiró. Vuelve a iniciar sesión para continuar.')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
  }, [])

  const handleLogout = async () => {
    try {
      const refreshToken = getRefreshToken()
      if (refreshToken) await logoutRequest(refreshToken)
    } catch {
      // El cierre local continúa aunque falle la red
    }
    resetSession()
  }

  const syncHistory = (nextHistory) => {
    setAnalysisHistory(nextHistory)
  }

  const refreshHistory = async () => {
    try {
      const historyResponse = await fetchAnalisis()
      const fresh = Array.isArray(historyResponse.data) ? historyResponse.data.map(toHistoryItem) : []
      setAnalysisHistory(fresh)
    } catch { /* ignore */ }
  }

  if (!authenticated) {
    return (
      <>
        <FontLink />
        <Login onLogin={handleLogin} notice={authNotice} />
      </>
    )
  }

  return (
    <>
      <FontLink />
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c1220] flex">
        <Sidebar
          page={page}
          setPage={setPage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          userName={userName}
          userEmail={userEmail}
          userRol={userRol}
          subTabs={subTabs}
          onSelectSub={(group, tab) => (group === 'historial' ? goToHistorial(tab) : goToAnalizar(tab))}
          onLogout={handleLogout}
          badges={{ consultas: consultasResumen?.consultas_con_novedad ?? 0 }}
        />

        {/* 190 px = barra lateral flotante (166) + sus márgenes (12 + 12) */}
        {/* min-w-0: sin él, el carrusel de parcelas de Inicio ensanchaba toda la columna más allá de la pantalla */}
        <div className="flex-1 min-w-0 lg:ml-[190px] flex flex-col min-h-screen">
          <Topbar
            page={page}
            subTabs={subTabs}
            setPage={setPage}
            onMenuClick={() => setSidebarOpen(true)}
            apiStatus={apiStatus}
            userName={userName}
            userEmail={userEmail}
            userRol={userRol}
            onLogout={handleLogout}
            weather={weather}
            history={analysisHistory}
            onGoHistorial={goToHistorial}
            consultas={consultasNovedades}
            onOpenConsulta={goToConsulta}
          />

          <main className="flex-1 px-4 pb-4 pt-3 md:px-6 md:pb-6 w-full max-w-6xl mx-auto">
            {page === 'inicio' && (isResearcher ? (
              <ResearchHomePage setPage={setPage} apiStatus={apiStatus} history={analysisHistory} weather={weather} onGoAnalizar={goToAnalizar} onGoHistorial={goToHistorial} />
            ) : (
              <HomePage setPage={setPage} apiStatus={apiStatus} history={analysisHistory} weather={weather} onGoAnalizar={goToAnalizar} onGoHistorial={goToHistorial} />
            ))}
            {page === 'analizar' && <Analizar onHistoryChange={syncHistory} onAnalysisSaved={refreshHistory} history={analysisHistory} enfermedades={enfermedades} mode={analizarMode} preselectedParcelaId={preselectedParcelaId} showPerformance={canSeeResearch(userRol)} onGoHistorial={goToHistorial} onGoEnfermedades={() => setPage('enfermedades')} />}
            {page === 'historial' && <Historial key={historialVisit} history={analysisHistory} onHistoryChange={syncHistory} tab={historialTab} onGoAnalizarParcela={(id) => goToAnalizar('parcela', id)} onGoAnalizar={(mode) => goToAnalizar(mode)} />}
            {page === 'enfermedades' && <Enfermedades onGoAnalizar={() => goToAnalizar('individual')} />}
            {page === 'mercado' && <Mercado />}
            {page === 'perfil' && (
              <Profile
                userName={userName}
                userEmail={userEmail}
                userRol={userRol}
                userEspecialidad={userEspecialidad}
                onNameChange={(name) => setUserName(name)}
                onEspecialidadChange={setUserEspecialidad}
              />
            )}
            {page === 'acerca' && <AcercaDe />}
            {page === 'usuarios' && isAdmin && <Usuarios />}
            {page === 'modelo' && canSeeResearch(userRol) && <ModeloIA />}
            {page === 'luna' && <CalendarioLunar />}
            {page === 'consultas' && (
              <Consultas
                me={{ id: userId, rol: normalizeRole(userRol), nombre: userName }}
                seleccion={consultaSel}
                onNovedades={refreshConsultas}
                onGoHistorial={() => goToHistorial('individual')}
              />
            )}
          </main>
        </div>
      </div>
    </>
  )
}
