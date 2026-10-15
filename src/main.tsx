import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled rather than pulled from Google Fonts: the desktop app's
// CSP and cross-origin isolation block third-party stylesheets and fonts.
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import './index.css'
import { applyTheme, pickMode, pickSkin, resolveMode, MODE_KEY, SKIN_KEY } from './theme/theme'
import App from './App.tsx'

// Set the theme before the first paint so the page never flashes the default skin.
applyTheme(
  document.documentElement,
  pickSkin(location.search, localStorage.getItem(SKIN_KEY)),
  resolveMode(pickMode(localStorage.getItem(MODE_KEY)), window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
