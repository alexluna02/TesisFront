import { useState } from 'react'
import { updateProfile, changePassword } from './api.js'
import { useTheme } from './ThemeContext.jsx'

export default function Profile({ userName, userEmail, userRol, onNameChange }) {
  const { isDark } = useTheme()
  const [nombre,      setNombre]      = useState(userName ?? '')
  const [savingName,  setSavingName]  = useState(false)
  const [nameOk,      setNameOk]      = useState(false)
  const [nameError,   setNameError]   = useState('')

  const [currentPwd,  setCurrentPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [savingPwd,   setSavingPwd]   = useState(false)
  const [pwdOk,       setPwdOk]       = useState(false)
  const [pwdError,    setPwdError]    = useState('')

  const handleSaveName = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) { setNameError('El nombre no puede estar vacío.'); return }
    setSavingName(true)
    setNameError('')
    setNameOk(false)
    try {
      await updateProfile({ nombre: nombre.trim() })
      setNameOk(true)
      if (typeof onNameChange === 'function') onNameChange(nombre.trim())
      setTimeout(() => setNameOk(false), 3000)
    } catch (err) {
      setNameError(err?.response?.data?.detail || 'No se pudo actualizar el nombre.')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdError('Completa todos los campos.'); return }
    if (newPwd.length < 8) { setPwdError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (newPwd !== confirmPwd) { setPwdError('Las contraseñas nuevas no coinciden.'); return }
    setSavingPwd(true)
    setPwdError('')
    setPwdOk(false)
    try {
      await changePassword({ current_password: currentPwd, new_password: newPwd })
      setPwdOk(true)
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setTimeout(() => setPwdOk(false), 3000)
    } catch (err) {
      setPwdError(err?.response?.data?.detail || 'No se pudo cambiar la contraseña.')
    } finally {
      setSavingPwd(false)
    }
  }

  const initial = nombre ? nombre.charAt(0).toUpperCase() : 'U'

  return (
    <div className="space-y-6 fade-up max-w-2xl mx-auto">

      {/* Avatar + info */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="px-6 py-8 flex items-center gap-6"
          style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 60%, #dcfce7 100%)' }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}
          >
            {initial}
          </div>
          <div>
            <h2 className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{userName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{userEmail}</p>
            <span
              className="inline-flex items-center gap-1.5 mt-2 rounded-full px-3 py-1 text-xs font-bold capitalize"
              style={{ background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500"/>
              {userRol}
            </span>
          </div>
        </div>

        <div className={`grid grid-cols-3 divide-x border-t ${isDark ? 'divide-[#1e3048] border-[#1e3048]' : 'divide-slate-100 border-slate-100'}`}>
          {[
            { label: 'Correo',  value: userEmail || '—' },
            { label: 'Rol',     value: userRol   || '—' },
            { label: 'Estado',  value: 'Activo'         },
          ].map((d, i) => (
            <div key={i} className="px-5 py-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{d.label}</p>
              <p className={`text-sm font-bold mt-0.5 truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{d.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit name */}
      <div className={`rounded-2xl border shadow-sm p-6 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" className="w-4 h-4">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Editar nombre</h3>
            <p className="text-xs text-slate-400">Actualiza cómo aparece tu nombre en la plataforma</p>
          </div>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="nombre" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre completo"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            />
          </div>

          {nameError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{nameError}</p>}
          {nameOk    && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">Nombre actualizado correctamente.</p>}

          <button
            type="submit"
            disabled={savingName}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
          >
            {savingName ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className={`rounded-2xl border shadow-sm p-6 ${isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" className="w-4 h-4">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Cambiar contraseña</h3>
            <p className="text-xs text-slate-400">Mínimo 8 caracteres</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {[
            { id: 'cur',  label: 'Contraseña actual',       val: currentPwd, set: setCurrentPwd, show: showCurrent, toggle: () => setShowCurrent(p => !p) },
            { id: 'new',  label: 'Nueva contraseña',        val: newPwd,     set: setNewPwd,     show: showNew,     toggle: () => setShowNew(p => !p)     },
            { id: 'conf', label: 'Confirmar nueva contraseña', val: confirmPwd, set: setConfirmPwd, show: showNew, toggle: () => setShowNew(p => !p) },
          ].map(({ id, label, val, set, show, toggle }) => (
            <div key={id} className="space-y-1.5">
              <label htmlFor={id} className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</label>
              <div className="relative">
                <input
                  id={id}
                  type={show ? 'text' : 'password'}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border px-4 py-2.5 pr-20 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                />
                <button
                  type="button"
                  onClick={toggle}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-700"
                >
                  {show ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          ))}

          {pwdError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{pwdError}</p>}
          {pwdOk    && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">Contraseña actualizada correctamente.</p>}

          <button
            type="submit"
            disabled={savingPwd}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
          >
            {savingPwd ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
