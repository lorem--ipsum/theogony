import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cible la plus ancienne : iPad sous iOS 12 (Safari 12.1).
// Safari 12 charge les modules ES : un seul bundle « moderne » transpilé pour lui suffit.
// Pas de bundle legacy (ES5 + SystemJS) : la détection de Vite l'imposait à tout Safari < 16.4,
// alors qu'il est bien plus lourd et lent.
const TARGETS = ['chrome >= 64', 'edge >= 79', 'firefox >= 67', 'safari >= 12', 'ios >= 12']

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      modernTargets: TARGETS,
      modernPolyfills: true,
      renderLegacyChunks: false,
    }),
  ],
  // chemins relatifs : le site fonctionne aussi dans un sous-dossier (GitHub Pages)
  base: './',
})
