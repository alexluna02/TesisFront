import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) })
  return null
}

function reverseGeocode(lat, lng) {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`
  )
    .then((r) => r.json())
    .then((data) => {
      const addr = data.address ?? {}
      return (
        addr.city ?? addr.city_district ?? addr.town ?? addr.municipality ??
        addr.state_district ?? addr.village ?? addr.hamlet ??
        addr.county ?? addr.state ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      )
    })
    .catch(() => `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
}

export default function MapPicker({ notFoundCity, onConfirm, onCancel }) {
  const [pos, setPos] = useState(null)
  const [cityName, setCityName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!pos) return
    let canceled = false
    setLoading(true)
    setCityName('')
    reverseGeocode(pos.lat, pos.lng).then((name) => {
      if (!canceled) { setCityName(name); setLoading(false) }
    })
    return () => { canceled = true }
  }, [pos])

  const handleConfirm = () => {
    if (pos && !loading) onConfirm(pos.lat, pos.lng, cityName)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-base">Seleccionar ubicación en el mapa</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {notFoundCity
              ? <>No se encontró <span className="font-semibold text-slate-700">"{notFoundCity}"</span>. Haz clic en el mapa para fijar tu ubicación manualmente.</>
              : 'Haz clic en el mapa para fijar tu ubicación.'}
          </p>
        </div>

        {/* Map */}
        <div style={{ height: '420px', flexShrink: 0 }}>
          <MapContainer
            center={[-0.35, -78.13]}
            zoom={7}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={setPos} />
            {pos && <Marker position={pos} />}
          </MapContainer>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            {!pos && (
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <span className="text-lg">👆</span>
                Haz clic en el mapa para seleccionar
              </p>
            )}
            {pos && loading && (
              <p className="text-sm text-slate-400 animate-pulse">Detectando nombre del lugar…</p>
            )}
            {pos && !loading && (
              <div>
                <p className="text-sm font-semibold text-slate-900 truncate">📍 {cityName}</p>
                <p className="text-[11px] text-slate-400">
                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onCancel}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!pos || loading}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition"
            >
              Confirmar ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
