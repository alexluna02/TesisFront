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

export const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          })
          saveAuthData(refreshResponse.data)
          originalRequest.headers = originalRequest.headers ?? {}
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          clearAuthData()
          window.location.reload()
        }
      }
    }
    return Promise.reject(error)
  }
)
export const loginRequest = (email, password) => api.post('/auth/login', { email, password })
export const registerRequest = (nombre, email, password) => api.post('/auth/register', { nombre, email, password })
export const logoutRequest = (refresh_token) => api.post('/auth/logout', { refresh_token })
export const fetchMe = () => api.get('/users/me')
export const fetchAnalisis = () => api.get('/analisis')
export const fetchEnfermedades = () => api.get('/enfermedades')
export const createAnalisis = (payload) => api.post('/analisis', payload)
export const deleteAnalisis = (id) => api.delete(`/analisis/${id}`)
export const predictXai = (formData) => api.post('/predict/xai', formData)
export const googleLoginRequest  = (access_token) => api.post('/auth/google', { access_token })
export const updateProfile          = (data)  => api.put('/users/me', data)
export const changePassword         = (data)  => api.put('/users/me/password', data)
export const forgotPasswordRequest  = (email) => api.post('/auth/forgot-password', { email })
export const resetPasswordRequest   = (data)  => api.post('/auth/reset-password', data)
export default api
