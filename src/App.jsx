import { useState, useEffect } from 'react'
import { useTheme } from './ThemeContext.jsx'
import Analizar from './Analizar.jsx'
import Historial from './Historial.jsx'
import Profile from './Profile.jsx'
import Login from './Login.jsx'
import foto3 from './Imagenes/foto3.png'
import { api, fetchMe, fetchAnalisis, logoutRequest, isLogged, clearAuthData } from './api.js'
import { fetchEnfermedades } from './api.js'

// ── Google Font ───────────────────────────────────────────────────────────────
const FontLink = () => (
  <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  * { font-family: 'Plus Jakarta Sans', sans-serif; }
  `}</style>
)

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ color, data }) {
  const w = 120, h = 36
  const max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ slices }) {
  const r = 54, cx = 70, cy = 70, stroke = 28
  let cumulative = 0
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  const circ = 2 * Math.PI * r

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {slices.map((sl, i) => {
        const frac = sl.value / total
        const dashArray = `${frac * circ} ${circ}`
        const offset = circ - cumulative * circ
        cumulative += frac
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={sl.color}
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeDashoffset={offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.6s ease' }}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="white"/>
    </svg>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IcoLeaf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
    <path d="M7 17s1-5 5-7 8-1 8-1-1 5-5 7-8 1-8 1z"/>
  </svg>
)
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
const IcoAbout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
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
const IcoUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
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

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'inicio',    label: 'Inicio',           Icon: IcoHome    },
  { id: 'analizar',  label: 'Analizar',          Icon: IcoScan    },
  { id: 'historial', label: 'Historial',         Icon: IcoHistory },
  { id: 'acerca',    label: 'Acerca de',          Icon: IcoAbout  },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, open, onClose, userName }) {
  const { isDark } = useTheme()
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose}/>
      )}
      <aside
        className={`fixed left-0 top-0 z-40 h-full w-52 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{
          background: isDark
            ? 'linear-gradient(170deg, #1e1040 0%, #0e1f3d 45%, #0a2218 100%)'
            : 'linear-gradient(170deg, #ede9fe 0%, #dbeafe 45%, #dcfce7 100%)',
          borderRight: isDark ? '1px solid rgba(99,102,241,0.15)' : '1px solid rgba(139,92,246,0.15)',
        }}
      >
        {/* Brand */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: isDark ? '1px solid rgba(99,102,241,0.12)' : '1px solid rgba(139,92,246,0.12)' }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #22c55e 100%)', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}
          >
            <IcoLeaf />
          </div>
          <div className="min-w-0">
            <p className={`font-black text-base leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>AgroScan</p>
            <p className="text-[11px] font-semibold leading-tight" style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}>UAV · Maíz · IA</p>
          </div>
          <button onClick={onClose} className={`lg:hidden ml-auto ${isDark ? 'text-slate-400' : 'text-slate-400'} hover:text-slate-300`}><IcoX /></button>
        </div>

        {/* Section label */}
        <div className="px-5 pt-5 pb-2">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Navegación</p>
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => { setPage(id); onClose() }}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  active ? '' : isDark
                    ? 'text-slate-400 hover:text-slate-100 hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
                style={active
                  ? isDark
                    ? { background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', boxShadow: 'inset 0 0 0 1px rgba(139,92,246,0.25)' }
                    : { background: 'rgba(255,255,255,0.72)', color: '#5b21b6', boxShadow: '0 1px 6px rgba(124,58,237,0.12), inset 0 0 0 1px rgba(139,92,246,0.25)' }
                  : { border: '1px solid transparent' }
                }
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500"/>
                )}
                <span style={{ color: active ? (isDark ? '#a78bfa' : '#7c3aed') : undefined }}><Icon /></span>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* User card */}
        <div className="px-3 pt-4 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] px-1 mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Usuario</p>
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{
              background: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{userName || 'Usuario'}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Investigador</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 mt-4 mb-3" style={{ borderTop: `1px solid ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)'}` }}/>

        {/* Status card */}
        <div className="mx-3 mb-5 rounded-2xl px-4 py-3"
          style={{
            background: isDark ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.60)',
            border: '1px solid rgba(34,197,94,0.25)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="relative w-2 h-2 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60"/>
              <span className="relative block w-2 h-2 rounded-full bg-emerald-500"/>
            </span>
            <p className="text-xs font-bold text-emerald-500">Sistema activo</p>
          </div>
          <p className={`text-[11px] leading-relaxed pl-4 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Listo para analizar imágenes UAV.
          </p>
        </div>
      </aside>
    </>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function Topbar({ page, onMenuClick, apiStatus, userName, userEmail, userRol, onLogout, weather, setPage }) {
  const { isDark, toggle: toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const titles = {
    inicio:    'Panel Principal',
    analizar:  'Análisis de Cultivos',
    historial: 'Historial de Análisis',
    acerca:    'Acerca de Nosotros',
  }
  const dateStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const wInfo = weather ? getWeatherInfo(weather.code) : null

  return (
    <header className={`sticky top-0 z-20 flex items-center justify-between px-6 py-3.5 border-b shadow-sm transition-colors ${isDark ? 'bg-[#0e1929] border-[#1e3048]' : 'bg-white border-slate-100'}`}>
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition">
          <IcoMenu />
        </button>
        <div>
          <h1 className={`font-bold text-sm leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{titles[page]}</h1>
          <p className="text-[11px] text-slate-400 capitalize">{dateStr}</p>
        </div>

        {wInfo && (
          <div className="relative hidden sm:block">
            {weatherOpen && <div className="fixed inset-0 z-10" onClick={() => setWeatherOpen(false)} />}
            <button
              type="button"
              onClick={() => { setWeatherOpen((o) => !o); setMenuOpen(false) }}
              className="relative z-20 flex items-center gap-2 rounded-2xl border px-3 py-1.5 hover:shadow-sm transition-all"
              style={{ background: wInfo.bg, borderColor: `${wInfo.color}30` }}
            >
              <span className="text-base leading-none">{wInfo.emoji}</span>
              <div className="text-left">
                <p className="text-xs font-bold leading-none" style={{ color: wInfo.color }}>{weather.temp}°C</p>
                <p className="text-[10px] leading-tight text-slate-400 max-w-[80px] truncate">{weather.city}</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3" style={{ color: wInfo.color }}><path d="M19 9l-7 7-7-7"/></svg>
            </button>

            {weatherOpen && (
              <div className="absolute left-0 top-full mt-2 z-20 w-60 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{wInfo.emoji}</span>
                  <div>
                    <p className="text-xl font-black text-slate-900">{weather.temp}°C</p>
                    <p className="text-xs text-slate-500">{wInfo.label}</p>
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-700 mb-3">📍 {weather.city}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-blue-50 p-2 text-center">
                    <p className="text-[10px] text-blue-500 font-semibold">Sensación</p>
                    <p className="text-sm font-black text-blue-700">{weather.feelsLike}°C</p>
                  </div>
                  <div className="rounded-xl bg-cyan-50 p-2 text-center">
                    <p className="text-[10px] text-cyan-500 font-semibold">Humedad</p>
                    <p className="text-sm font-black text-cyan-700">{weather.humidity}%</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2 text-center">
                    <p className="text-[10px] text-slate-500 font-semibold">Viento</p>
                    <p className="text-sm font-black text-slate-700">{weather.wind} <span className="text-[9px] font-normal">km/h</span></p>
                  </div>
                </div>
                <div className="mt-3">
                  <FlightStatusBadge weather={weather} />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 text-center">
                  📡 Ubicación actual · Open-Meteo
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative flex items-center gap-3">
        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
          title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/>
            </svg>
          )}
        </button>
        {/* API status badge */}
        <div className={`hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 ${apiStatus === 'online' ? 'bg-emerald-50 border border-emerald-200' : apiStatus === 'checking' ? 'bg-slate-100' : 'bg-rose-50 border border-rose-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'checking' ? 'bg-slate-400' : 'bg-rose-500'}`}/>
          <span className={`text-xs font-semibold ${apiStatus === 'online' ? 'text-emerald-700' : apiStatus === 'checking' ? 'text-slate-500' : 'text-rose-700'}`}>
            {apiStatus === 'online' ? 'API Activa' : apiStatus === 'checking' ? 'Verificando API...' : 'API Inactiva'}
          </span>
          <span className="text-[10px] text-slate-400">
            {apiStatus === 'online'
              ? 'Conexión establecida'
              : apiStatus === 'checking'
                ? 'Espere un momento'
                : 'No se pudo conectar'}
          </span>
        </div>

        {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />}

        <div className="relative z-20">
          <button
            type="button"
            onClick={() => { setMenuOpen((open) => !open); setWeatherOpen(false) }}
            className="flex items-center gap-2 rounded-full border border-slate-200 pr-3 pl-0.5 py-0.5 hover:bg-slate-50 transition"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-black">
              {userName ? userName.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-semibold text-slate-700">{userName}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 text-slate-400"><path d="M19 9l-7 7-7-7"/></svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-slate-200 bg-white text-left shadow-xl shadow-slate-200/40 overflow-hidden">

              {/* Cabecera con avatar */}
              <div className="px-5 py-5" style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 60%, #dcfce7 100%)' }}>
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black flex-shrink-0 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}
                  >
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900 text-base truncate">{userName}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{userEmail || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Detalles del usuario */}
              <div className="px-5 py-4 space-y-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Nombre</span>
                  <span className="text-xs font-bold text-slate-700">{userName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Correo</span>
                  <span className="text-xs font-bold text-slate-700 truncate max-w-[160px]">{userEmail || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Rol</span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize"
                    style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500"/>
                    {userRol}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="px-3 py-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setPage('perfil') }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-slate-400 flex-shrink-0">
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  Mi perfil
                </button>
              </div>

              {/* Cerrar sesión */}
              <div className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onLogout() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
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

function SeverityLevelBadge({ level }) {
  const map = {
    Nulo:     { bg: '#e2e8f0', color: '#475569', border: '#cbd5e1' },
    Leve:     { bg: '#ecfdf5', color: '#15803d', border: '#bbf7d0' },
    Moderado: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
    Severo:   { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  }
  const s = map[level] || map.Nulo
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {level}
    </span>
  )
}

function getSeverityLevel(confidencePercent, estado) {
  if (estado === 'Sano') return 'Nulo'
  if (confidencePercent < 5) return 'Leve'
  if (confidencePercent <= 15) return 'Moderado'
  return 'Severo'
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

// ── HomePage ──────────────────────────────────────────────────────────────────
function HomePage({ setPage, apiStatus, history, weather }) {
  const { isDark } = useTheme()
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null)

  const totalAnalyses = history.length
  const diseasedCount = history.filter((item) => item.estado === 'Con enfermedad').length
  const healthyCount = history.filter((item) => item.estado === 'Sano').length
  const averageConfidence = totalAnalyses > 0
    ? Math.round(history.reduce((sum, item) => sum + ((item.confianza ?? 0) * 100), 0) / totalAnalyses)
    : 0

  const stats = [
    { label: 'Imágenes analizadas', value: totalAnalyses, sub: 'Total', color: '#22c55e', bg: '#f0fdf4', icon: '🌿', data: Array(10).fill(totalAnalyses) },
    { label: 'Detecciones realizadas', value: diseasedCount, sub: 'Con enfermedad', color: '#f59e0b', bg: '#fffbeb', icon: '🔍', data: Array(10).fill(diseasedCount) },
    { label: 'Cultivos sanos', value: healthyCount, sub: 'Análisis sanos', color: '#14b8a6', bg: '#ecfeff', icon: '🌱', data: Array(10).fill(healthyCount) },
  ]

  const recentAnalysis = history.map((item, index) => {
    const confidence = Math.round((item.confianza ?? 0) * 100)
    const isHealthy = item.estado === 'Sano'
    return {
      id: index + 1,
      date: new Date(item.fecha).toLocaleDateString('es-ES'),
      time: new Date(item.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      disease: isHealthy ? 'Sano' : (item.enfermedadLabel ?? item.enfermedad),
      severity: isHealthy ? 'Nulo' : item.riesgo,
      severityLevel: getSeverityLevel(confidence, item.estado),
      confidence,
      xaiImage: item.xaiImage,
      affectedPercent: item.affectedPercent,
      seed: index,
      raw: item,
    }
  })

  useEffect(() => {
    if (recentAnalysis.length === 0) {
      setSelectedAnalysisId(null)
      return
    }
    if (!recentAnalysis.some((row) => row.id === selectedAnalysisId)) {
      setSelectedAnalysisId(recentAnalysis[0].id)
    }
  }, [recentAnalysis, selectedAnalysisId])

  const selectedAnalysis = recentAnalysis.find((row) => row.id === selectedAnalysisId) || recentAnalysis[0] || null

  const diseases = selectedAnalysis ? [
    { label: selectedAnalysis.disease, value: 100, color: selectedAnalysis.disease === 'Sano' ? '#15803d' : (selectedAnalysis.disease === 'Roya' ? '#f59e0b' : selectedAnalysis.disease === 'Mancha Blanca' ? '#8b5cf6' : '#22c55e') },
  ] : [
    { label: 'Tizón',         value: 45, color: '#22c55e' },
    { label: 'Roya',          value: 30, color: '#f59e0b' },
    { label: 'Mancha Blanca', value: 25, color: '#8b5cf6' },
  ]

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl" style={{ backgroundImage: `linear-gradient(90deg, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.18) 40%, rgba(96,165,250,0.18) 60%, rgba(96,165,250,0.12) 70%, rgba(96,165,250,0) 100%), url(${foto3})`, backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '260px' }}>
        {/* decorative circles */}
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }}/>
        <div className="absolute bottom-0 left-1/2 w-48 h-48 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }}/>

        <div className="relative flex items-center gap-0 h-full">
          {/* Left content */}
          <div className="flex-1 p-8 md:p-10 z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 mb-5">
              <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'checking' ? 'bg-slate-400' : 'bg-rose-500'}`}/>
              {apiStatus === 'online'
                ? 'API Activa · Detección en imágenes'
                : apiStatus === 'checking'
                  ? 'Verificando API · Detección en imágenes'
                  : 'API Inactiva · Detección en imágenes'}
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-tight mb-3">
              Detección inteligente<br/>
              de <span className="text-violet-600">enfermedades</span>{' '}
              <span className="text-green-500">en maíz</span>
            </h1>
            <div className="mb-6 max-w-sm rounded-2xl bg-white/90 border border-white/80 p-4 shadow-sm">
              <p className="text-sm text-slate-600 leading-relaxed">
                Plataforma de inteligencia artificial para el análisis de cultivos
                a partir de imágenes captadas con drones o cámaras. Detecta Tizón, Roya y Mancha Blanca
                con explicabilidad visual Grad-CAM.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setPage('analizar')}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold text-sm text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 6px 20px rgba(109,40,217,0.35)' }}
              >
                <IcoUpload />
                Cargar imagen
              </button>
              <button
                onClick={() => setPage('historial')}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <IcoEye />
                Ver historial
              </button>
            </div>
          </div>

        </div>
      </div>

      {weather && <WeatherBanner weather={weather} />}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: s.bg }}>
                {s.icon}
              </div>
            </div>
            <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{s.label}</p>
            <p className="text-[11px] text-slate-400">{s.sub}</p>
            <div className="mt-2">
              <Sparkline color={s.color} data={s.data}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Bottom row: Recent analysis + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Recent analysis table */}
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-100'}`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-[#1e3048]' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2">
              <h2 className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Análisis recientes</h2>
              {recentAnalysis.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  {recentAnalysis.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setPage('historial')}
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition"
            >
              Ver todo
            </button>
          </div>
          {/* Table header */}
          <div className={`grid text-[11px] font-bold text-slate-400 uppercase tracking-wider px-6 py-2 border-b ${isDark ? 'bg-[#0e1929] border-[#1e3048]' : 'bg-slate-50 border-slate-100'}`}
            style={{ gridTemplateColumns: '0.9fr 1.2fr 1.2fr 0.9fr 1fr' }}>
            <span>Id imagen</span>
            <span>Fecha</span>
            <span>Predicción</span>
            <span>Afectación</span>
            <span>Nivel severidad</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}
            className="[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400"
          >
            {recentAnalysis.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-500">
                No hay análisis recientes aún. Suba una imagen para comenzar.
              </div>
            ) : recentAnalysis.map((row) => (
              <div key={`${row.id}-${row.date}`}
                onClick={() => setSelectedAnalysisId(row.id)}
                className={`grid items-center px-6 py-3.5 border-b transition cursor-pointer ${isDark ? 'border-[#1e3048] hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'} ${row.id === selectedAnalysisId ? (isDark ? 'bg-white/5' : 'bg-slate-50') : ''}`}
                style={{ gridTemplateColumns: '0.9fr 1.2fr 1.2fr 0.9fr 1fr' }}>
                <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>#{row.id}</span>
                <span className="text-[11px] text-slate-500">{row.date}</span>
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.disease}</span>
                <span className="text-sm text-slate-700">
                  {row.affectedPercent != null
                    ? `${row.affectedPercent}%`
                    : row.confidence != null
                      ? `${row.confidence}%`
                      : '—'}
                </span>
                <SeverityLevelBadge level={row.severityLevel}/>
              </div>
            ))}
          </div>
        </div>

        {/* Disease distribution / XAI preview */}
        <div className={`rounded-2xl border shadow-sm p-6 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-100'}`}>
          <h2 className={`font-bold text-sm mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {selectedAnalysis ? 'Análisis seleccionado' : 'Distribución de enfermedades'}
          </h2>

          {selectedAnalysis ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: selectedAnalysis.disease === 'Sano' ? '#15803d' : selectedAnalysis.disease === 'Roya' ? '#f59e0b' : selectedAnalysis.disease === 'Mancha Blanca' ? '#8b5cf6' : '#22c55e' }}
                />
                <span className="font-semibold text-slate-800">{selectedAnalysis.disease}</span>
              </div>

              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                {selectedAnalysis.xaiImage ? (
                  <img src={selectedAnalysis.xaiImage} alt="Mapa XAI" className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center bg-slate-100 text-slate-400">
                    Sin mapa XAI disponible
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Afectación</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedAnalysis.affectedPercent != null
                    ? `${selectedAnalysis.affectedPercent}%`
                    : selectedAnalysis.severity !== 'Nulo'
                      ? `${selectedAnalysis.confidence}%`
                      : '0%'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <DonutChart slices={diseases}/>
              <div className="mt-4 w-full space-y-2.5">
                {diseases.map((d) => (
                  <div key={d.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }}/>
                      <span className="text-xs text-slate-600 font-medium">{d.label}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-4 text-center">
            {selectedAnalysis ? 'ⓘ Mostrando mapa XAI y afectación del análisis seleccionado' : 'ⓘ Basado en los análisis de esta semana'}
          </p>
        </div>
      </div>
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
  const confidencePercent = record.afectacion_pct != null ? Number(record.afectacion_pct) : 0
  const risk = record.severidad === 'grave' ? 'Alto' : record.severidad === 'moderada' ? 'Medio' : 'Bajo'

  return {
    id: record.id,
    fecha: record.fecha,
    imagen: record.imagen_url,
    enfermedad: diseaseName,
    enfermedadLabel: DISEASE_LABELS[diseaseName] ?? diseaseName,
    confianza: confidencePercent / 100,
    riesgo: risk,
    cultivo: 'Maíz',
    recomendaciones: '',
    xaiImage: record.grad_cam_url,
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
  const [enfermedades, setEnfermedades] = useState([])
  const [userName, setUserName]   = useState('Investigador')
  const [userEmail, setUserEmail] = useState('')
  const [userRol, setUserRol]     = useState('investigador')
  const weather = useWeather()

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
        setUserRol(meResponse.data.rol ?? 'investigador')
        const backendHistory = Array.isArray(historyResponse.data) ? historyResponse.data.map(toHistoryItem) : []
        setAnalysisHistory(backendHistory)
        setEnfermedades(Array.isArray(enfResponse.data) ? enfResponse.data : [])
      } catch (error) {
        clearAuthData()
        setAuthenticated(false)
        setAnalysisHistory([])
      }
    }

    loadApiStatus()
    loadUserData()
    return () => { canceled = true }
  }, [authenticated])

  const handleLogin = () => {
    setAuthenticated(true)
    setPage('inicio')
  }

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('agro_refresh_token')
      if (refreshToken) await logoutRequest(refreshToken)
    } catch {
      // ignore logout error
    }
    clearAuthData()
    setAuthenticated(false)
    setAnalysisHistory([])
    setUserName('Investigador')
    setUserEmail('')
    setUserRol('investigador')
    setPage('inicio')
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
        <Login onLogin={handleLogin} />
      </>
    )
  }

  return (
    <>
      <FontLink />
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c1220] flex">
        <Sidebar page={page} setPage={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} userName={userName} />

        <div className="flex-1 lg:ml-52 flex flex-col min-h-screen">
          <Topbar
            page={page}
            setPage={setPage}
            onMenuClick={() => setSidebarOpen(true)}
            apiStatus={apiStatus}
            userName={userName}
            userEmail={userEmail}
            userRol={userRol}
            onLogout={handleLogout}
            weather={weather}
          />

          <main className="flex-1 p-4 md:p-6 w-full max-w-6xl mx-auto">
            {page === 'inicio' && <HomePage setPage={setPage} apiStatus={apiStatus} history={analysisHistory} weather={weather} />}
            {page === 'analizar' && <Analizar onHistoryChange={syncHistory} onAnalysisSaved={refreshHistory} history={analysisHistory} enfermedades={enfermedades} />}
            {page === 'historial' && <Historial history={analysisHistory} onHistoryChange={syncHistory} />}
            {page === 'perfil' && (
              <Profile
                userName={userName}
                userEmail={userEmail}
                userRol={userRol}
                onNameChange={(name) => setUserName(name)}
              />
            )}
            {page === 'acerca' && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-10 text-center text-slate-500">
                <p className="text-2xl font-black text-slate-900 mb-2">AgroScan</p>
                <p className="text-sm">Universidad Técnica · Tesis 2025</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}
