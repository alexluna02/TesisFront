import { useState, useRef } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import foto3 from './Imagenes/foto3.png'
import { loginRequest, registerRequest, saveAuthData, googleLoginRequest, forgotPasswordRequest, resetPasswordRequest } from './api.js'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

export default function Login({ onLogin }) {
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
  const [resetToken,      setResetToken]      = useState('')
  const [resetCode,       setResetCode]       = useState(['', '', '', '', '', ''])
  const [resetNewPwd,     setResetNewPwd]     = useState('')
  const [resetConfirmPwd, setResetConfirmPwd] = useState('')
  const [resetLoading,    setResetLoading]    = useState(false)
  const [resetError,      setResetError]      = useState('')
  const [resetSuccess,    setResetSuccess]    = useState('')
  const [showResetPwd,    setShowResetPwd]    = useState(false)
  const codeRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]

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
    e.preventDefault()
    if (!resetEmail.trim()) { setResetError('Ingresa tu correo electrónico.'); return }
    setResetLoading(true)
    setResetError('')
    try {
      const res = await forgotPasswordRequest(resetEmail.trim())
      setResetToken(res.data.reset_token ?? '')
      setResetStep('code')
      setTimeout(() => codeRefs[0].current?.focus(), 100)
    } catch (err) {
      setResetError(err?.response?.data?.detail || 'No se pudo enviar el código.')
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
      await resetPasswordRequest({ reset_token: resetToken, code, new_password: 'placeholder_verify' })
      // Si llega aquí sin error de contraseña, el código es válido
      setResetStep('newpwd')
      setResetError('')
    } catch (err) {
      const msg = err?.response?.data?.detail ?? ''
      if (msg.toLowerCase().includes('contras')) {
        // Código correcto, solo falla la contraseña → avanzar al paso de nueva contraseña
        setResetStep('newpwd')
        setResetError('')
      } else {
        setResetError(msg || 'Código incorrecto o expirado.')
      }
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (resetNewPwd.length < 8)           { setResetError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (resetNewPwd !== resetConfirmPwd)   { setResetError('Las contraseñas no coinciden.'); return }
    setResetLoading(true)
    setResetError('')
    try {
      const code = resetCode.join('')
      await resetPasswordRequest({ reset_token: resetToken, code, new_password: resetNewPwd })
      setResetSuccess('¡Contraseña actualizada! Ya puedes iniciar sesión.')
      setTimeout(() => closeReset(), 2500)
    } catch (err) {
      setResetError(err?.response?.data?.detail || 'No se pudo actualizar la contraseña.')
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
        const message = err?.response?.data?.detail || err?.message || 'Error al iniciar sesión con Google.'
        setError(message)
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
      const message = err?.response?.data?.detail || err?.message || 'Ocurrió un error. Intenta de nuevo.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] ring-1 ring-slate-200 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden lg:block order-2 lg:order-1 relative overflow-hidden bg-slate-50">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${foto3})` }} />
          <div className="absolute inset-0 bg-slate-950/10" />
          <div className="relative flex min-h-[420px] flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
            <div className="inline-flex items-center gap-3 rounded-3xl border border-white/60 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500 text-white">A</span>
              <div>
                <p className="font-semibold">AgroScan</p>
                <p className="text-[11px] text-slate-500">UAV • Maíz • IA</p>
              </div>
            </div>

            <div className="mt-6 max-w-md space-y-5 text-slate-100">
              <div className="rounded-[28px] border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-xl shadow-xl shadow-slate-950/10">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">Inteligencia</p>
                <h2 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">Inteligencia para cultivos más sanos</h2>
                <p className="mt-4 text-sm leading-7 text-slate-100/80">
                  Analizamos tus cultivos con drones y tecnología IA para detectar enfermedades y mejorar tu rendimiento.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-white/10 p-4 text-sm text-white shadow-lg shadow-slate-950/5 backdrop-blur-xl">
                  <p className="font-semibold">Visión por computadora</p>
                  <p className="mt-2 text-slate-200/80">Procesa imágenes y detecta patrones con precisión.</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 text-sm text-white shadow-lg shadow-slate-950/5 backdrop-blur-xl">
                  <p className="font-semibold">Alertas rápidas</p>
                  <p className="mt-2 text-slate-200/80">Recibe información clave antes de que el problema crezca.</p>
                </div>
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="mt-8 rounded-3xl border border-white/20 bg-white/10 p-5 text-sm text-slate-100 shadow-xl shadow-slate-950/5 backdrop-blur-xl">
                <p className="font-semibold text-white">Control total de tu campo</p>
                <p className="mt-2 text-slate-200/80">Observa el estado de tus cultivos, recibe recomendaciones y actúa rápido.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2 relative p-6 sm:p-10 lg:p-12 bg-white/85 lg:bg-white overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center lg:hidden" style={{ backgroundImage: `url(${foto3})` }} />
          <div className="absolute inset-0 bg-white/30 lg:hidden" />
          <div className="relative z-10 max-w-md mx-auto rounded-[32px] bg-white/95 lg:bg-transparent shadow-xl shadow-slate-900/5 lg:shadow-none p-6 lg:p-0">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-slate-900">{mode === 'register' ? 'Crea tu cuenta' : 'Bienvenido'}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {mode === 'register' ? 'Regístrate para comenzar a usar AgroScan' : 'Inicia sesión para continuar'}
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <div className="space-y-2">
                  <label htmlFor="nombre" className="block text-sm font-semibold text-slate-700">Nombre completo</label>
                  <div className="relative rounded-3xl border border-slate-200 bg-white/90 lg:bg-slate-50 px-4 py-3 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-100">
                    <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">👤</span>
                    <input
                      id="nombre"
                      type="text"
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      placeholder="Tu nombre completo"
                      className="w-full border-none bg-transparent pl-11 pr-3 text-sm text-slate-900 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700">Correo electrónico</label>
                <div className="relative rounded-3xl border border-slate-200 bg-white/90 lg:bg-slate-50 px-4 py-3 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-100">
                  <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">✉</span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ejemplo@correo.com"
                    className="w-full border-none bg-transparent pl-11 pr-3 text-sm text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">Contraseña</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <div className="relative rounded-3xl border border-slate-200 bg-white/90 lg:bg-slate-50 px-4 py-3 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-100">
                  <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">🔒</span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Ingresa tu contraseña"
                    className="w-full border-none bg-transparent pl-11 pr-3 text-sm text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  <span>Recuérdame</span>
                </label>
                <button type="button" onClick={openReset} className="font-semibold text-violet-600 hover:text-violet-700">¿Olvidaste tu contraseña?</button>
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-3xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200/40 transition hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100"
              >
                {loading ? 'Procesando...' : mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              o continúa con
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              Continuar con Google
            </button>

            <p className="mt-7 text-center text-sm text-slate-500">
              {mode === 'register' ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'register' ? 'login' : 'register')
                  setError('')
                  setNombre('')
                  setEmail('')
                  setPassword('')
                  setShowPassword(false)
                }}
                className="font-semibold text-violet-600 hover:text-violet-700"
              >
                {mode === 'register' ? 'Inicia sesión' : 'Regístrate aquí'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* ── Forgot password modal ──────────────────────────────── */}
    {resetStep && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}>
        <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl shadow-slate-900/20 overflow-hidden">

          {/* Modal header */}
          <div className="px-7 pt-7 pb-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ede9fe, #dbeafe)' }}>
                  {resetStep === 'email'  && <span className="text-xl">📧</span>}
                  {resetStep === 'code'   && <span className="text-xl">🔢</span>}
                  {resetStep === 'newpwd' && <span className="text-xl">🔒</span>}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {resetStep === 'email'  && 'Recuperar contraseña'}
                    {resetStep === 'code'   && 'Verificar código'}
                    {resetStep === 'newpwd' && 'Nueva contraseña'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Paso {resetStep === 'email' ? 1 : resetStep === 'code' ? 2 : 3} de 3
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeReset} className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Step progress dots */}
            <div className="flex items-center gap-2 mt-4">
              {['email', 'code', 'newpwd'].map((s, i) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
                  s === resetStep ? 'bg-violet-500' :
                  (resetStep === 'code' && i === 0) || (resetStep === 'newpwd' && i < 2) ? 'bg-violet-200' : 'bg-slate-100'
                }`}/>
              ))}
            </div>
          </div>

          <div className="px-7 py-6">
            {resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" className="w-8 h-8"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <p className="font-bold text-slate-900 text-lg">¡Listo!</p>
                <p className="text-sm text-slate-500 mt-1">{resetSuccess}</p>
              </div>
            ) : (
              <>
                {/* ── Step 1: Email ── */}
                {resetStep === 'email' && (
                  <form onSubmit={handleSendCode} className="space-y-4">
                    <p className="text-sm text-slate-500">Ingresa el correo de tu cuenta y te enviaremos un código de 6 dígitos.</p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Correo electrónico</label>
                      <div className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
                        <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">✉</span>
                        <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                          placeholder="tu@correo.com" autoFocus
                          className="w-full border-none bg-transparent pl-7 text-sm text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                    {resetError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{resetError}</p>}
                    <button type="submit" disabled={resetLoading}
                      className="w-full rounded-2xl py-3 text-sm font-bold text-white transition disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                      {resetLoading ? 'Enviando…' : 'Enviar código'}
                    </button>
                  </form>
                )}

                {/* ── Step 2: Code ── */}
                {resetStep === 'code' && (
                  <form onSubmit={handleVerifyCode} className="space-y-5">
                    <p className="text-sm text-slate-500">
                      Enviamos un código de 6 dígitos a <span className="font-semibold text-slate-700">{resetEmail}</span>. Puede tardar unos segundos.
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
                          onChange={e => handleCodeDigit(i, e.target.value)}
                          onKeyDown={e => handleCodeKey(i, e)}
                          className="w-12 h-14 rounded-2xl border-2 text-center text-2xl font-black text-slate-900 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                          style={{ borderColor: digit ? '#7c3aed' : '#e2e8f0', background: digit ? '#f5f3ff' : '#f8fafc' }}
                        />
                      ))}
                    </div>
                    <p className="text-center text-xs text-slate-400">
                      ¿No llegó?{' '}
                      <button type="button" onClick={handleSendCode} className="font-semibold text-violet-600 hover:text-violet-700">Reenviar código</button>
                    </p>
                    {resetError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 text-center">{resetError}</p>}
                    <button type="submit" disabled={resetLoading || resetCode.join('').length < 6}
                      className="w-full rounded-2xl py-3 text-sm font-bold text-white transition disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                      {resetLoading ? 'Verificando…' : 'Verificar código'}
                    </button>
                  </form>
                )}

                {/* ── Step 3: New password ── */}
                {resetStep === 'newpwd' && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <p className="text-sm text-slate-500">Código verificado. Ingresa tu nueva contraseña.</p>
                    {[
                      { label: 'Nueva contraseña',      val: resetNewPwd,     set: setResetNewPwd     },
                      { label: 'Confirmar contraseña',   val: resetConfirmPwd, set: setResetConfirmPwd },
                    ].map(({ label, val, set }, i) => (
                      <div key={i} className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</label>
                        <div className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
                          <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">🔒</span>
                          <input type={showResetPwd ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)}
                            placeholder="••••••••" autoFocus={i === 0}
                            className="w-full border-none bg-transparent pl-7 pr-14 text-sm text-slate-900 outline-none"
                          />
                          {i === 0 && (
                            <button type="button" onClick={() => setShowResetPwd(p => !p)}
                              className="absolute inset-y-0 right-4 text-xs font-semibold text-slate-400 hover:text-slate-700">
                              {showResetPwd ? 'Ocultar' : 'Mostrar'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {resetError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{resetError}</p>}
                    <button type="submit" disabled={resetLoading}
                      className="w-full rounded-2xl py-3 text-sm font-bold text-white transition disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
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
