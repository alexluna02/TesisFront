import { useState, useRef, useEffect } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import fotoCampo from './Imagenes/login-campo.webp'
import hojasEsquina from './Imagenes/login-hojas.png'
import logoHojas from './Imagenes/logo-hojas.png'
import hojasFondo from './Imagenes/topbar-hojas.png'
import hojasFondo2 from './Imagenes/inicio-hojas.png'
import {
  loginRequest, registerRequest, saveAuthData, googleLoginRequest, apiErrorMessage,
  forgotPasswordRequest, verifyResetCodeRequest, resetPasswordRequest,
} from './api.js'

// Inicio de sesión según la maqueta del usuario (images/25.png): foto del dron sobre el maizal con
// el mensaje y tres tarjetas a la izquierda, y el formulario en un panel blanco a la derecha.
// Las medidas están a la escala en que el usuario ve la maqueta (pantalla de ~1366×610).

const MIN_PASSWORD_LENGTH = 8
const RESEND_COOLDOWN_SECONDS = 60 // igual que RESET_CODE_RESEND_SECONDS en el backend

const VERDE = 'text-[#0b7a45]'
const TINTA = 'text-[#121a3d]'
// Botón principal (también en la ventana de recuperación)
const BTN_VERDE = 'flex w-full items-center justify-center gap-3 rounded-full bg-linear-to-r from-[#046f4a] via-[#2a9a55] to-[#62c464] font-bold text-white shadow-[0_12px_24px_-12px_rgba(4,111,74,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

// ── Iconos ────────────────────────────────────────────────────────────────────
const Svg = ({ children, className = 'h-4 w-4', sw = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
    {children}
  </svg>
)
const IcoCorreo = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></Svg>
const IcoCandado = (p) => <Svg {...p}><rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/></Svg>
const IcoUsuario = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.7-3.9 3.7-6 7.5-6s6.8 2.1 7.5 6"/></Svg>
const IcoOjo = (p) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Svg>
const IcoOjoTachado = (p) => <Svg {...p}><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></Svg>
const IcoFlecha = (p) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Svg>
const IcoChevron = (p) => <Svg {...p}><path d="m9 6 6 6-6 6"/></Svg>
const IcoX = (p) => <Svg {...p}><path d="M6 18 18 6M6 6l12 12"/></Svg>
const IcoCheck = (p) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5"/></Svg>
const IcoDron = (p) => (
  <Svg {...p}>
    <path d="M3 5.5h6M15 5.5h6"/><path d="M6 5.5v3M18 5.5v3"/><path d="M6 8.5h12"/>
    <rect x="9" y="8.5" width="6" height="4.5" rx="1.6"/><path d="m9.8 13-1.6 3M14.2 13l1.6 3"/><circle cx="12" cy="16.6" r="1.4"/>
  </Svg>
)
const IcoChipIA = ({ className }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>
      <path d="M9 2.5v3M12 2.5v3M15 2.5v3M9 18.5v3M12 18.5v3M15 18.5v3M2.5 9h3M2.5 12h3M2.5 15h3M18.5 9h3M18.5 12h3M18.5 15h3"/>
    </g>
    <text x="12" y="14.6" textAnchor="middle" fontSize="6.6" fontWeight="800" fill="currentColor" fontFamily="'Plus Jakarta Sans', sans-serif">AI</text>
  </svg>
)
const IcoHoja = ({ className }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
    <path fill="currentColor" d="M20.5 3.5C11 3.6 4.5 8.4 4.5 15.2c0 1.7.5 3.2 1.2 4.4l-1.5 1.6 1.2 1.1 1.5-1.6c1.3.9 2.9 1.3 4.5 1.3 6.8 0 9.9-7.4 9.1-18.5Z"/>
    <path d="M7.2 19.2C10 14.6 13.4 10.7 17.3 7.7" fill="none" stroke="#2f6b3a" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

// Campo de la maqueta: píldora con una franja clara a la izquierda y el área gris del texto
function Campo({ id, icono: Icono, etiqueta, children }) {
  return (
    <div>
      <label htmlFor={id} className={`mb-1.5 flex items-center gap-2.5 text-[13.5px] font-semibold ${TINTA} [@media(max-height:640px)]:mb-1`}>
        <Icono className={`h-[19px] w-[19px] ${VERDE}`} sw={1.9}/>
        {etiqueta}
      </label>
      <div className="relative h-[42px] rounded-full border border-[#e1e6ee] bg-[#fbfcfc] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-within:border-[#7cc79a] focus-within:ring-2 focus-within:ring-emerald-500/15 [@media(max-height:640px)]:h-[40px]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-[30px] right-0 rounded-l-[16px] rounded-r-full border-l border-[#e6ebf1] bg-[#f2f5fa]"/>
        {children}
      </div>
    </div>
  )
}
const ENTRADA = `relative h-full w-full rounded-full bg-transparent pl-[46px] pr-4 text-[13.5px] ${TINTA} outline-none placeholder:text-[#6b7489]`

export default function Login({ onLogin, notice = '' }) {
  const [mode, setMode] = useState('login')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Forgot password state ────────────────────────────────────
  const [resetStep,       setResetStep]       = useState(null) // null | 'email' | 'code' | 'newpwd'
  const [resetEmail,      setResetEmail]      = useState('')
  const [resetCode,       setResetCode]       = useState(['', '', '', '', '', ''])
  const [resendIn,        setResendIn]        = useState(0)
  const [resetNewPwd,     setResetNewPwd]     = useState('')
  const [resetConfirmPwd, setResetConfirmPwd] = useState('')
  const [resetLoading,    setResetLoading]    = useState(false)
  const [resetError,      setResetError]      = useState('')
  const [resetSuccess,    setResetSuccess]    = useState('')
  const [showResetPwd,    setShowResetPwd]    = useState(false)
  const codeRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

  // Cuenta regresiva para "Reenviar código" (el backend ignora reenvíos más seguidos)
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const handleCodeDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...resetCode]
    next[i] = val
    setResetCode(next)
    if (val && i < 5) codeRefs[i + 1].current?.focus()
  }

  const handleCodeKey = (i, e) => {
    if (e.key === 'Backspace' && !resetCode[i] && i > 0) codeRefs[i - 1].current?.focus()
    if (e.key === 'ArrowLeft'  && i > 0) codeRefs[i - 1].current?.focus()
    if (e.key === 'ArrowRight' && i < 5) codeRefs[i + 1].current?.focus()
  }

  const handleCodePaste = (e) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('')
    const next = ['', '', '', '', '', '']
    digits.forEach((d, i) => { next[i] = d })
    setResetCode(next)
    const last = Math.min(digits.length, 5)
    codeRefs[last].current?.focus()
  }

  const openReset = () => {
    setResetStep('email')
    setResetEmail(email)
    setResetError('')
    setResetSuccess('')
    setResetCode(['', '', '', '', '', ''])
    setResetNewPwd('')
    setResetConfirmPwd('')
  }

  const closeReset = () => {
    setResetStep(null)
    setResetError('')
    setResetSuccess('')
  }

  const handleSendCode = async (e) => {
    e?.preventDefault()
    const target = resetEmail.trim()
    if (!target) { setResetError('Ingresa tu correo electrónico.'); return }
    setResetLoading(true)
    setResetError('')
    try {
      // El backend responde igual exista o no la cuenta: el código solo llega por correo
      await forgotPasswordRequest(target)
      setResetCode(['', '', '', '', '', ''])
      setResetStep('code')
      setResendIn(RESEND_COOLDOWN_SECONDS)
      setTimeout(() => codeRefs[0].current?.focus(), 100)
    } catch (err) {
      setResetError(apiErrorMessage(err, 'No se pudo enviar el código.'))
    } finally {
      setResetLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    const code = resetCode.join('')
    if (code.length < 6) { setResetError('Ingresa los 6 dígitos del código.'); return }
    setResetLoading(true)
    setResetError('')
    try {
      // Solo valida el código; la contraseña no se toca hasta el paso 3
      await verifyResetCodeRequest({ email: resetEmail.trim(), code })
      setResetStep('newpwd')
    } catch (err) {
      setResetError(apiErrorMessage(err, 'Código incorrecto o expirado.'))
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (resetNewPwd.length < MIN_PASSWORD_LENGTH) { setResetError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`); return }
    if (resetNewPwd !== resetConfirmPwd)          { setResetError('Las contraseñas no coinciden.'); return }
    setResetLoading(true)
    setResetError('')
    try {
      await resetPasswordRequest({ email: resetEmail.trim(), code: resetCode.join(''), new_password: resetNewPwd })
      setResetSuccess('¡Contraseña actualizada! Ya puedes iniciar sesión.')
      setEmail(resetEmail.trim())
      setPassword('')
      setTimeout(() => closeReset(), 2500)
    } catch (err) {
      setResetError(apiErrorMessage(err, 'No se pudo actualizar la contraseña.'))
    } finally {
      setResetLoading(false)
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError('')
      try {
        const response = await googleLoginRequest(tokenResponse.access_token)
        saveAuthData(response.data)
        onLogin()
      } catch (err) {
        setError(apiErrorMessage(err, 'Error al iniciar sesión con Google.'))
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Error al iniciar sesión con Google. Intenta de nuevo.'),
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Por favor ingresa correo y contraseña.')
      return
    }
    if (mode === 'register' && !nombre.trim()) {
      setError('Por favor ingresa tu nombre.')
      return
    }
    if (mode === 'register' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }

    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        await registerRequest(nombre.trim(), email.trim(), password)
      }

      const response = await loginRequest(email.trim(), password)
      saveAuthData(response.data)
      onLogin()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const cambiarModo = () => {
    setMode(mode === 'register' ? 'login' : 'register')
    setError('')
    setNombre('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
  }

  const registro = mode === 'register'

  return (
    <>
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#e9f3ef] px-4 py-4 sm:px-6">
      {/* Fondo: el mismo campo, desenfocado y aclarado, con hojas translúcidas en las esquinas */}
      <img src={fotoCampo} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover opacity-70 blur-[26px]"/>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/90 via-white/75 to-[#e3f1e8]/55"/>
      <img src={hojasFondo} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute -left-10 -top-3 hidden w-[360px] -scale-x-100 select-none opacity-60 lg:block"/>
      <img src={hojasFondo2} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute -bottom-2 -left-4 hidden w-[230px] select-none opacity-70 lg:block"/>

      <div className="relative w-full max-w-[440px] lg:max-w-[1096px]">
        {/* Hojas de la esquina del panel blanco: el borde recto coincide con el borde de la tarjeta */}
        <img src={hojasEsquina} alt="" aria-hidden="true" draggable="false" className="pointer-events-none absolute -right-[52px] -top-[61px] z-20 hidden w-[200px] select-none lg:block"/>

        <div className="relative grid overflow-hidden rounded-[30px] shadow-[0_34px_70px_-40px_rgba(10,60,35,0.55)] ring-4 ring-white/70 lg:grid-cols-[minmax(0,623fr)_minmax(0,473fr)]">
          {/* ── Foto con el mensaje ─────────────────────────────── */}
          <section className="relative hidden min-h-[560px] overflow-hidden lg:-mr-8 lg:block" aria-label="AgroScan">
            <img src={fotoCampo} alt="" aria-hidden="true" draggable="false" className="absolute inset-0 h-full w-full select-none object-cover object-[78%_50%]"/>
            {/* Neblina clara solo detrás del título; la parte baja se oscurece para que el texto blanco se lea */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[58%] bg-linear-to-r from-white/55 via-white/20 to-transparent [mask-image:linear-gradient(to_bottom,#000_65%,transparent)]"/>
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[56%] bg-linear-to-t from-[#0b2612]/70 via-[#0b2612]/35 to-transparent"/>
            {/* Panel esmerilado detrás del mensaje */}
            <div aria-hidden="true" className="absolute left-[4%] top-[27%] h-[50%] w-[55%] rounded-[26px] border border-white/25 bg-white/10 backdrop-blur-[1.5px]"/>

            <div className="relative flex h-full flex-col px-[42px] pb-[30px] pt-[38px]">
              <div className="flex items-center gap-3">
                <img src={logoHojas} alt="" draggable="false" className="h-[60px] w-auto select-none drop-shadow-[0_4px_8px_rgba(0,60,20,0.25)]"/>
                <div className="leading-none">
                  <p className="text-[29px] font-extrabold tracking-[-0.01em] text-[#0e6b3a]">AgroScan</p>
                  <p className="mt-1.5 pl-[18px] text-[13px] font-semibold text-[#1c3b35]">UAV • Maíz • IA</p>
                </div>
              </div>

              <div className="mt-[52px] max-w-[330px]">
                <h2 className="text-[44px] font-extrabold leading-[1.04] tracking-[-0.02em] text-[#121a45]">
                  Inteligencia para cultivos{' '}
                  <span className="relative inline-block bg-linear-to-r from-[#17843b] to-[#3cad4b] bg-clip-text pb-1 text-transparent">
                    más sanos
                    <svg viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2 left-0 h-[12px] w-full text-[#2f9e45]">
                      <path d="M3 11C70 4 180 2 297 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                    </svg>
                  </span>
                </h2>
                <p className="mt-6 text-[14.5px] font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6),0_0_14px_rgba(0,0,0,0.35)]">
                  Analizamos tus cultivos con drones y tecnología IA para detectar enfermedades y mejorar tu rendimiento.
                </p>
              </div>

              <ul className="mt-auto flex gap-3.5">
                {[
                  { Icono: IcoDron, texto: 'Visión por dron', clase: 'h-[36px] w-[36px]' },
                  { Icono: IcoChipIA, texto: 'IA avanzada', clase: 'h-[33px] w-[33px]' },
                  { Icono: IcoHoja, texto: 'Agricultura inteligente', clase: 'h-[30px] w-[30px]' },
                ].map(({ Icono, texto, clase }) => (
                  <li key={texto} className="flex h-[86px] w-[122px] flex-col items-center justify-center gap-1 rounded-[18px] border border-white/30 bg-[#3f7a35]/30 px-2 text-center text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)] backdrop-blur-md">
                    <Icono className={clase} sw={1.8}/>
                    <span className="text-[12.5px] font-semibold leading-tight">{texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ── Formulario ──────────────────────────────────────── */}
          <section className="relative z-10 flex flex-col rounded-[30px] bg-white px-6 pb-5 pt-5 sm:px-[42px] lg:shadow-[-18px_0_40px_-28px_rgba(10,40,25,0.45)] [@media(max-height:640px)]:pb-4 [@media(max-height:640px)]:pt-4">
            <div className="flex flex-col items-center text-center">
              <span className="grid h-[84px] w-[84px] place-items-center rounded-full bg-linear-to-b from-[#f1faf4] to-[#e2f4e8] shadow-[0_8px_20px_-12px_rgba(10,90,45,0.5)] ring-[5px] ring-white [@media(max-height:640px)]:h-[72px] [@media(max-height:640px)]:w-[72px]">
                <img src={logoHojas} alt="" draggable="false" className="h-[46px] w-auto select-none [@media(max-height:640px)]:h-[40px]"/>
              </span>
              <h1 className={`mt-2.5 text-[25px] font-extrabold leading-tight tracking-[-0.01em] ${TINTA}`}>
                {registro ? 'Crea tu cuenta en ' : 'Bienvenido a '}
                <span className="text-[#0e7a44]">AgroScan</span>
              </h1>
              <p className="mt-1 text-[12.5px] text-[#4a5264]">
                {registro ? 'Regístrate para empezar a analizar tus cultivos' : 'Inicia sesión para continuar con tu análisis'}
              </p>
            </div>

            {notice && !registro && (
              <p role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] text-amber-800">
                {notice}
              </p>
            )}

            <form className="mt-4 space-y-3.5 [@media(max-height:640px)]:mt-3 [@media(max-height:640px)]:space-y-3" onSubmit={handleSubmit}>
              {registro && (
                <Campo id="nombre" icono={IcoUsuario} etiqueta="Nombre completo">
                  <input id="nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo" className={ENTRADA}/>
                </Campo>
              )}
              <Campo id="email" icono={IcoCorreo} etiqueta="Correo electrónico">
                <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={ENTRADA}/>
              </Campo>
              <Campo id="password" icono={IcoCandado} etiqueta="Contraseña">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={registro ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={registro ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres` : 'Ingresa tu contraseña'}
                  className={`${ENTRADA} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#5b6476] transition hover:bg-black/5 hover:text-[#121a3d]"
                >
                  {showPassword ? <IcoOjoTachado className="h-[19px] w-[19px]"/> : <IcoOjo className="h-[19px] w-[19px]"/>}
                </button>
              </Campo>

              {!registro && (
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <label className={`inline-flex cursor-pointer items-center gap-2.5 ${TINTA}`}>
                    <input type="checkbox" className="peer sr-only"/>
                    <span aria-hidden="true" className="grid h-[19px] w-[19px] place-items-center rounded-[5px] border-[1.5px] border-[#c3cad5] bg-white text-transparent transition peer-checked:border-[#0b7a45] peer-checked:bg-[#0b7a45] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/30">
                      <IcoCheck className="h-3 w-3" sw={3.2}/>
                    </span>
                    Recordarme
                  </label>
                  <button type="button" onClick={openReset} className={`font-semibold ${VERDE} hover:underline`}>¿Olvidaste tu contraseña?</button>
                </div>
              )}

              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12.5px] text-rose-700">{error}</p>}

              <button type="submit" disabled={loading} className={`${BTN_VERDE} h-[44px] text-[15px] [@media(max-height:640px)]:h-[42px]`}>
                <span className="grid h-[28px] w-[28px] place-items-center rounded-full bg-white text-[#0b7a45] shadow-sm">
                  {loading
                    ? <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"/>
                    : <IcoFlecha className="h-4 w-4" sw={2.4}/>}
                </span>
                {loading ? 'Procesando…' : registro ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-3.5 flex items-center gap-3 text-[11.5px] text-[#505c73] [@media(max-height:640px)]:mt-3">
              <span className="h-px flex-1 bg-[#e6eaf0]"/>
              o continúa con
              <span className="h-px flex-1 bg-[#e6eaf0]"/>
            </div>

            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              className={`mt-3 flex h-[40px] w-full items-center justify-center gap-3 rounded-full border border-[#dfe4ea] bg-white text-[13.5px] font-semibold ${TINTA} shadow-[0_2px_6px_-4px_rgba(15,23,42,0.25)] transition hover:bg-[#f7f9fa] disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <GoogleIcon/>
              Continuar con Google
            </button>

            <p className="mx-auto mt-3.5 flex min-h-[40px] w-full max-w-[360px] flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 rounded-full border border-[#d3ecdc] bg-[#eaf7ee] px-4 py-1.5 text-[12.5px] text-[#1d2435] [@media(max-height:640px)]:mt-3">
              <img src={logoHojas} alt="" draggable="false" className="h-[18px] w-auto select-none"/>
              {registro ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
              <button type="button" onClick={cambiarModo} className="inline-flex items-center gap-0.5 font-semibold text-[#0b6b35] underline underline-offset-2 hover:text-[#095a2d]">
                {registro ? 'Inicia sesión' : 'Regístrate aquí'}
                <IcoChevron className="h-3.5 w-3.5" sw={2.4}/>
              </button>
            </p>
          </section>
        </div>
      </div>
    </div>

    {/* ── Ventana «Recuperar contraseña» ─────────────────────────── */}
    {resetStep && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-recuperar" className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/20">

          {/* Cabecera */}
          <div className="border-b border-slate-100 px-7 pb-5 pt-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-linear-to-br from-[#dcf3e4] to-[#eaf7ee] text-[#0b7a45]">
                  {resetStep === 'email'  && <IcoCorreo className="h-5 w-5"/>}
                  {resetStep === 'code'   && <IcoCheck className="h-5 w-5" sw={2.4}/>}
                  {resetStep === 'newpwd' && <IcoCandado className="h-5 w-5"/>}
                </div>
                <div>
                  <h3 id="titulo-recuperar" className={`text-base font-bold ${TINTA}`}>
                    {resetStep === 'email'  && 'Recuperar contraseña'}
                    {resetStep === 'code'   && 'Verificar código'}
                    {resetStep === 'newpwd' && 'Nueva contraseña'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paso {resetStep === 'email' ? 1 : resetStep === 'code' ? 2 : 3} de 3
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeReset} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100">
                <IcoX className="h-4 w-4" sw={2.5}/>
              </button>
            </div>

            {/* Progreso */}
            <div className="mt-4 flex items-center gap-2">
              {['email', 'code', 'newpwd'].map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
                  s === resetStep ? 'bg-[#0b7a45]' :
                  (resetStep === 'code' && i === 0) || (resetStep === 'newpwd' && i < 2) ? 'bg-[#bfe5cc]' : 'bg-slate-100'
                }`}/>
              ))}
            </div>
          </div>

          <div className="px-7 py-6">
            {resetSuccess ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-[#15803d]">
                  <IcoCheck className="h-8 w-8" sw={2.5}/>
                </div>
                <p className={`text-lg font-bold ${TINTA}`}>¡Listo!</p>
                <p className="mt-1 text-sm text-slate-500">{resetSuccess}</p>
              </div>
            ) : (
              <>
                {/* ── Paso 1: correo ── */}
                {resetStep === 'email' && (
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <p className="text-sm text-slate-500">Ingresa el correo de tu cuenta y te enviaremos un código de 6 dígitos.</p>
                    <div className="space-y-1.5">
                      <label htmlFor="reset-email" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Correo electrónico</label>
                      <div className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[#7cc79a] focus-within:ring-2 focus-within:ring-emerald-500/15">
                        <span className="absolute inset-y-0 left-4 flex items-center text-slate-400"><IcoCorreo className="h-4 w-4"/></span>
                        <input id="reset-email" type="email" autoComplete="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                          placeholder="tucorreo@ejemplo.com" autoFocus
                          className="w-full border-none bg-transparent pl-7 text-sm text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                    {resetError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">{resetError}</p>}
                    <button type="submit" disabled={resetLoading} className={`${BTN_VERDE} h-[44px] text-sm`}>
                      {resetLoading ? 'Enviando…' : 'Enviar código'}
                    </button>
                  </form>
                )}

                {/* ── Paso 2: código ── */}
                {resetStep === 'code' && (
                  <form onSubmit={handleVerifyCode} className="space-y-5">
                    <p className="text-sm text-slate-500">
                      Si <span className="font-semibold text-slate-700">{resetEmail}</span> tiene una cuenta, te enviamos un código de 6 dígitos válido por 15 minutos. Revisa también la carpeta de spam.
                    </p>
                    <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                      {resetCode.map((digit, i) => (
                        <input
                          key={i}
                          ref={codeRefs[i]}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          aria-label={`Dígito ${i + 1} del código`}
                          onChange={e => handleCodeDigit(i, e.target.value)}
                          onKeyDown={e => handleCodeKey(i, e)}
                          className="h-14 w-12 rounded-2xl border-2 text-center text-2xl font-black text-slate-900 outline-none transition-all focus:border-[#0b7a45] focus:ring-2 focus:ring-emerald-500/20"
                          style={{ borderColor: digit ? '#0b7a45' : '#e2e8f0', background: digit ? '#ecf8f0' : '#f8fafc' }}
                        />
                      ))}
                    </div>
                    <p className="text-center text-xs text-slate-500">
                      ¿No llegó?{' '}
                      {resendIn > 0 ? (
                        <span>Puedes reenviarlo en {resendIn} s</span>
                      ) : (
                        <button type="button" onClick={handleSendCode} disabled={resetLoading} className={`font-semibold ${VERDE} hover:underline disabled:opacity-60`}>Reenviar código</button>
                      )}
                      {' · '}
                      <button type="button" onClick={() => { setResetStep('email'); setResetError('') }} className={`font-semibold ${VERDE} hover:underline`}>Cambiar correo</button>
                    </p>
                    {resetError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-center text-sm text-rose-600">{resetError}</p>}
                    <button type="submit" disabled={resetLoading || resetCode.join('').length < 6} className={`${BTN_VERDE} h-[44px] text-sm`}>
                      {resetLoading ? 'Verificando…' : 'Verificar código'}
                    </button>
                  </form>
                )}

                {/* ── Paso 3: nueva contraseña ── */}
                {resetStep === 'newpwd' && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-sm text-slate-500">Código verificado. Ingresa tu nueva contraseña.</p>
                    {[
                      { id: 'reset-nueva', label: 'Nueva contraseña',     val: resetNewPwd,     set: setResetNewPwd     },
                      { id: 'reset-conf',  label: 'Confirmar contraseña', val: resetConfirmPwd, set: setResetConfirmPwd },
                    ].map(({ id, label, val, set }, i) => (
                      <div key={id} className="space-y-1.5">
                        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</label>
                        <div className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[#7cc79a] focus-within:ring-2 focus-within:ring-emerald-500/15">
                          <span className="absolute inset-y-0 left-4 flex items-center text-slate-400"><IcoCandado className="h-4 w-4"/></span>
                          <input id={id} type={showResetPwd ? 'text' : 'password'} autoComplete="new-password" value={val} onChange={e => set(e.target.value)}
                            placeholder="••••••••" autoFocus={i === 0}
                            className="w-full border-none bg-transparent pl-7 pr-14 text-sm text-slate-900 outline-none"
                          />
                          {i === 0 && (
                            <button type="button" onClick={() => setShowResetPwd(p => !p)}
                              className="absolute inset-y-0 right-4 text-xs font-semibold text-slate-500 hover:text-slate-700">
                              {showResetPwd ? 'Ocultar' : 'Mostrar'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {resetError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">{resetError}</p>}
                    <button type="submit" disabled={resetLoading} className={`${BTN_VERDE} h-[44px] text-sm`}>
                      {resetLoading ? 'Guardando…' : 'Cambiar contraseña'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
