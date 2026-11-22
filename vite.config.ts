import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // chemins relatifs : le site fonctionne aussi dans un sous-dossier (GitHub Pages)
  base: './',
})
