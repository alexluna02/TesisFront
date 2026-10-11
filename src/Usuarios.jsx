import { useEffect, useMemo, useState } from 'react'
import { fetchAdminUsers, createAdminUser, updateAdminUser } from './api.js'
import { useTheme } from './ThemeContext.jsx'

const ROLE_LABELS = {
  agricultor:   'Agricultor',
  investigador: 'Investigador',
  admin:        'Administrador',
  director:     'Director',
}

const ROLE_STYLES = {
  agricultor:   { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  investigador: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  admin:        { background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' },
  director:     { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
}

// Roles que el administrador puede asignar (la cuenta admin es única)
const ASSIGNABLE_ROLES = ['agricultor', 'investigador']

const EMPTY_FORM = { nombre: '', email: '', password: '', rol: 'agricultor' }

const errorDetail = (err, fallback) => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return fallback
}

function RoleBadge({ rol }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={ROLE_STYLES[rol] ?? ROLE_STYLES.director}>
      {ROLE_LABELS[rol] ?? rol}
    </span>
  )
}

export default function Usuarios() {
  const { isDark } = useTheme()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('todos')
  const [savingId, setSavingId] = useState(null)
  const [rowError, setRowError] = useState('')

  const [form, setForm]         = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk]     = useState('')
  const [showPwd, setShowPwd]   = useState(false)

  const card  = isDark ? 'bg-[#162032] border-[#1e3048]' : 'bg-white border-slate-200'
  const input = `w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900'}`
  const heading = isDark ? 'text-slate-100' : 'text-slate-900'
  const muted   = isDark ? 'text-slate-400' : 'text-slate-500'

  const loadUsers = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data } = await fetchAdminUsers()
      setUsers(data)
    } catch (err) {
      setLoadError(errorDetail(err, 'No se pudo cargar la lista de usuarios.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) =>
      (roleFilter === 'todos' || u.rol === roleFilter) &&
      (!q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    )
  }, [users, search, roleFilter])

  const counts = useMemo(() => ({
    total:        users.length,
    agricultor:   users.filter((u) => u.rol === 'agricultor').length,
    investigador: users.filter((u) => u.rol === 'investigador').length,
    inactivos:    users.filter((u) => !u.activo).length,
  }), [users])

  const handleUpdate = async (user, changes) => {
    setSavingId(user.id)
    setRowError('')
    try {
      const { data } = await updateAdminUser(user.id, changes)
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
    } catch (err) {
      setRowError(errorDetail(err, 'No se pudo actualizar el usuario.'))
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormOk('')
    if (!form.nombre.trim() || !form.email.trim() || !form.password) { setFormError('Completa todos los campos.'); return }
    if (form.password.length < 8) { setFormError('La contraseña debe tener al menos 8 caracteres.'); return }
    setCreating(true)
    try {
      const { data } = await createAdminUser({ ...form, nombre: form.nombre.trim(), email: form.email.trim() })
      setUsers((prev) => [data, ...prev])
      setForm(EMPTY_FORM)
      setFormOk(`Usuario ${data.email} creado como ${ROLE_LABELS[data.rol]}.`)
      setTimeout(() => setFormOk(''), 4000)
    } catch (err) {
      setFormError(errorDetail(err, 'No se pudo crear el usuario.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 fade-up">

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Usuarios',      value: counts.total,        color: '#7c3aed' },
          { label: 'Agricultores',  value: counts.agricultor,   color: '#16a34a' },
          { label: 'Investigadores', value: counts.investigador, color: '#2563eb' },
          { label: 'Inactivos',     value: counts.inactivos,    color: '#dc2626' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border shadow-sm px-4 py-3 ${card}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold ${muted}`}>{s.label}</p>
            <p className="text-2xl font-black mt-0.5" style={{ color: s.color }}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Crear usuario */}
      <div className={`rounded-2xl border shadow-sm p-6 ${card}`}>
        <div className="mb-5">
          <h3 className={`font-bold text-sm ${heading}`}>Crear nuevo usuario</h3>
          <p className={`text-xs ${muted}`}>El usuario podrá iniciar sesión con este correo y contraseña.</p>
        </div>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <input className={input} placeholder="Nombre completo" value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}/>
          <input className={input} type="email" placeholder="correo@ejemplo.com" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}/>
          <div className="relative">
            <input className={`${input} pr-20`} type={showPwd ? 'text' : 'password'} placeholder="Contraseña (mín. 8 caracteres)"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password"/>
            <button type="button" onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-violet-500">
              {showPwd ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <select className={input} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={creating}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 transition"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              {creating ? 'Creando…' : 'Crear usuario'}
            </button>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            {formOk && <p className="text-sm text-emerald-500">{formOk}</p>}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        <div className="p-5 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div>
            <h3 className={`font-bold text-sm ${heading}`}>Usuarios registrados</h3>
            <p className={`text-xs ${muted}`}>Cambia el rol o desactiva el acceso de cada usuario.</p>
          </div>
          <div className="flex gap-2">
            <input className={`${input} md:w-56`} placeholder="Buscar nombre o correo" value={search}
              onChange={(e) => setSearch(e.target.value)}/>
            <select className={`${input} w-auto`} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="todos">Todos</option>
              {Object.keys(ROLE_LABELS).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>

        {rowError && <p className="px-5 pb-3 text-sm text-red-500">{rowError}</p>}

        {loading ? (
          <p className={`px-5 pb-6 text-sm ${muted}`}>Cargando usuarios…</p>
        ) : loadError ? (
          <div className="px-5 pb-6 flex items-center gap-3">
            <p className="text-sm text-red-500">{loadError}</p>
            <button onClick={loadUsers} className="text-sm font-semibold text-violet-500">Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className={`px-5 pb-6 text-sm ${muted}`}>No hay usuarios que coincidan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left text-[10px] uppercase tracking-wider ${muted} ${isDark ? 'bg-[#0e1929]' : 'bg-slate-50'}`}>
                  <th className="px-5 py-2.5 font-semibold">Usuario</th>
                  <th className="px-5 py-2.5 font-semibold">Rol</th>
                  <th className="px-5 py-2.5 font-semibold">Estado</th>
                  <th className="px-5 py-2.5 font-semibold">Registrado</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#1e3048]' : 'divide-slate-100'}`}>
                {filtered.map((u) => {
                  const locked = u.rol === 'admin'
                  const busy = savingId === u.id
                  return (
                    <tr key={u.id} className={busy ? 'opacity-60' : ''}>
                      <td className="px-5 py-3">
                        <p className={`font-semibold ${heading}`}>{u.nombre}</p>
                        <p className={`text-xs ${muted}`}>{u.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        {locked ? <RoleBadge rol={u.rol}/> : (
                          <select
                            value={ASSIGNABLE_ROLES.includes(u.rol) ? u.rol : ''}
                            disabled={busy}
                            onChange={(e) => handleUpdate(u, { rol: e.target.value })}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold outline-none ${isDark ? 'bg-[#0e1929] border-[#1e3048] text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}
                          >
                            {!ASSIGNABLE_ROLES.includes(u.rol) && <option value="" disabled>{ROLE_LABELS[u.rol] ?? u.rol}</option>}
                            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {locked ? (
                          <span className="text-xs font-semibold text-emerald-500">Activo</span>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => handleUpdate(u, { activo: !u.activo })}
                            className={`rounded-full px-3 py-1 text-xs font-bold transition ${u.activo
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                            title={u.activo ? 'Clic para desactivar' : 'Clic para activar'}
                          >
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        )}
                      </td>
                      <td className={`px-5 py-3 text-xs whitespace-nowrap ${muted}`}>
                        {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
