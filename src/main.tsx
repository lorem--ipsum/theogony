import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// CSS de React Flow avant le nôtre : sans @layer (retiré pour Safari 12), l'ordre fixe la priorité
import '@xyflow/react/dist/style.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App.tsx'
import { loadStories } from './data/stories'
import { loadPrecomputed } from './graph/layout'

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // téléchargés en parallèle dès le démarrage (morceaux séparés pour alléger le bundle principal)
  loadPrecomputed()
  loadStories()
}

// React Flow a besoin de ResizeObserver (absent avant Safari 13.1 / iOS 13.4)
if ('ResizeObserver' in window) {
  render()
} else {
  import('@juggle/resize-observer')
    .then(({ ResizeObserver }) => {
      ;(window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserver
    })
    .finally(render)
}
