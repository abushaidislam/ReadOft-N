import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'katex/dist/katex.min.css'
import App from './App.jsx'
import { AuthProvider } from './state/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Service Worker handling
// In development, unregister any existing SW to avoid interfering with Vite HMR.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}))
    }).catch(() => {})
  })
}
// Only register the SW in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      if (import.meta.env.DEV) console.debug('Service worker registration failed', err)
    })
  })
}
