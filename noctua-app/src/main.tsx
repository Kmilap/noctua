import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'

// Apply stored theme before first paint — prevents flash on reload
const storedTheme = localStorage.getItem('noctua_theme') ?? 'dark'
document.documentElement.setAttribute('data-theme', storedTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
