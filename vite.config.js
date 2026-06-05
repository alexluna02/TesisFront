import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':         { target: BACKEND, changeOrigin: true },
      '/users':        { target: BACKEND, changeOrigin: true },
      '/analisis':     { target: BACKEND, changeOrigin: true },
      '/historial':    { target: BACKEND, changeOrigin: true },
      '/predict':      { target: BACKEND, changeOrigin: true },
      '/health':       { target: BACKEND, changeOrigin: true },
      '/enfermedades': { target: BACKEND, changeOrigin: true },
      '/stats':        { target: BACKEND, changeOrigin: true },
    },
  },
})
