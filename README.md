# FrontReactIA - Frontend para Segmentación de Imágenes

Este es el frontend React para la API de segmentación de malezas en cultivos de papa.

## 🚀 Instalación y Ejecución

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Ejecutar en modo desarrollo:**
   ```bash
   npm run dev
   ```

3. **Abrir en navegador:**
   Ve a `http://localhost:5173` (puerto por defecto de Vite)

## 📋 Características

- ✅ Subida de imágenes con preview
- ✅ Llamada a API FastAPI en `http://localhost:8000`
- ✅ Visualización de máscara segmentada
- ✅ Estadísticas por clase de maleza
- ✅ Interfaz responsive con Tailwind CSS
- ✅ Manejo de errores y estados de carga

## 🛠️ Tecnologías

- **React 18** - Framework principal
- **Vite** - Build tool y dev server
- **Axios** - Cliente HTTP para llamadas a API
- **Tailwind CSS** - Estilos CSS

## 🔧 Configuración

La URL de la API está hardcodeada en `src/App.jsx` como `http://localhost:8000`. Para cambiarla, modifica la constante `API_URL`.

## 📁 Estructura del Proyecto

```
FrontReactIA/
├── public/
├── src/
│   ├── App.jsx          # Componente principal
│   ├── main.jsx         # Punto de entrada
│   └── index.css        # Estilos globales
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎯 Uso

1. Selecciona una imagen de cultivo
2. Haz clic en "Analizar Imagen"
3. Espera los resultados de segmentación
4. Visualiza la máscara y estadísticas

¡Listo para usar con tu API de segmentación!