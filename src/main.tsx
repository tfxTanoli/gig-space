import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'sonner/dist/styles.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'
import { holdSsr } from './ssrHandoff'

const root = document.getElementById('root')!
// Keep a public page's server-rendered content on screen until the app is
// ready to show the same thing (src/ssrHandoff.ts).
holdSsr(root)

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
