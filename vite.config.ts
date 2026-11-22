import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // anciens navigateurs (vieux iPad notamment) : bundle transpilé + polyfills chargé automatiquement
    // iOS 12–13 savent charger des modules ES et reçoivent donc le bundle « moderne » :
    // il doit lui aussi être transpilé pour Safari 12 (pas de ?. ni de ??).
    legacy({
      targets: ['defaults', 'safari >= 12', 'ios >= 12'],
      modernTargets: ['chrome >= 64', 'edge >= 79', 'firefox >= 67', 'safari >= 12', 'ios >= 12'],
      modernPolyfills: true,
    }),
  ],
  // chemins relatifs : le site fonctionne aussi dans un sous-dossier (GitHub Pages)
  base: './',
})
