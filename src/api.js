import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL ?? ''
const ACCESS_TOKEN_KEY = 'agro_access_token'
const REFRESH_TOKEN_KEY = 'agro_refresh_token'
const LOGGED_KEY = 'agro_logged_in'

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY)
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY)
export const isLogged = () => localStorage.getItem(LOGGED_KEY) === 'true'

export const saveAuthData = ({ access_token, refresh_token }) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
  localStorage.setItem(LOGGED_KEY, 'true')
}

export const clearAuthData = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(LOGGED_KEY)
}

// App.jsx escucha este evento para volver al login sin recargar la página
export const SESSION_EXPIRED_EVENT = 'agro:session-expired'

export const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
    config._accessToken = token
  }
  return config
})

// Una sola renovación a la vez: el backend rota el refresh token en cada uso, así que si
// dos peticiones lo renovaran en paralelo la segunda usaría un token ya revocado.
let refreshInFlight = null
const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_URL}/auth/refresh`, { refresh_token: getRefreshToken() })
      .then(({ data }) => {
        saveAuthData(data)
        return data.access_token
      })
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

const endSession = () => {
  clearAuthData()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original?.url?.startsWith('/auth/')
    if (error.response?.status !== 401 || !original || original._retry || isAuthEndpoint) {
      return Promise.reject(error)
    }
    original._retry = true

    // Otra petición u otra pestaña ya renovó el token mientras esta viajaba
    const current = getAccessToken()
    if (current && original._accessToken && current !== original._accessToken) {
      return api(original)
    }

    if (!getRefreshToken()) {
      endSession()
      return Promise.reject(error)
    }

    try {
      await refreshAccessToken()
      return api(original)
    } catch (refreshError) {
      // Solo se cierra la sesión si el servidor rechaza el refresh token. Un corte de red
      // (frecuente en el campo) no debe sacar al usuario ni hacerle perder su trabajo.
      const status = refreshError?.response?.status
      if (status === 401 || status === 403) endSession()
      return Promise.reject(error)
    }
  }
)

// FastAPI devuelve `detail` como texto o, en errores de validación (422), como una lista
// de objetos que React no puede mostrar directamente.
const FIELD_LABELS = {
  email: 'el correo',
  password: 'la contraseña',
  new_password: 'la contraseña',
  current_password: 'la contraseña actual',
  nombre: 'el nombre',
  code: 'el código',
}
export const apiErrorMessage = (err, fallback = 'Ocurrió un error. Intenta de nuevo.') => {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] ?? {}
    const field = FIELD_LABELS[first.loc?.[first.loc.length - 1]]
    if (field && first.type === 'string_too_short' && first.ctx?.min_length) {
      return `${field.charAt(0).toUpperCase()}${field.slice(1)} debe tener al menos ${first.ctx.min_length} caracteres.`
    }
    return field ? `Revisa ${field}: el valor no es válido.` : 'Revisa los datos ingresados.'
  }
  if (err?.request && !err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.'
  return fallback
}
export const loginRequest = (email, password) => api.post('/auth/login', { email, password })
export const registerRequest = (nombre, email, password) => api.post('/auth/register', { nombre, email, password })
export const logoutRequest = (refresh_token) => api.post('/auth/logout', { refresh_token })
export const fetchMe = () => api.get('/users/me')
export const fetchHealth = () => api.get('/health')
export const fetchAnalisis = () => api.get('/analisis')
export const fetchEnfermedades = () => api.get('/enfermedades')
export const createAnalisis = (payload) => api.post('/analisis', payload)
export const deleteAnalisis = (id) => api.delete(`/analisis/${id}`)
export const predictXai = (formData) => api.post('/predict/xai', formData)
export const predictSegmentation = (formData) => api.post('/predict/segmentation', formData)
export const googleLoginRequest  = (access_token) => api.post('/auth/google', { access_token })
export const updateProfile          = (data)  => api.put('/users/me', data)
export const changePassword         = (data)  => api.put('/users/me/password', data)
export const forgotPasswordRequest  = (email) => api.post('/auth/forgot-password', { email })
export const verifyResetCodeRequest = (data)  => api.post('/auth/verify-reset-code', data)
export const resetPasswordRequest   = (data)  => api.post('/auth/reset-password', data)
export const fetchMercadoResumen    = () => api.get('/mercado/resumen')
export const fetchMercadoHistorico  = (producto, dias = 30) => api.get('/mercado/historico', { params: { producto, dias } })
export const fetchAdminUsers        = () => api.get('/admin/users')
export const createAdminUser        = (data) => api.post('/admin/users', data)
export const updateAdminUser        = (id, data) => api.patch(`/admin/users/${id}`, data)
export default api
