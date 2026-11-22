import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { AtRule } from 'postcss'

// Cible la plus ancienne : iPad sous iOS 12 (Safari 12.1).
// Safari 12 charge les modules ES : un seul bundle « moderne » transpilé pour lui suffit.
// Pas de bundle legacy (ES5 + SystemJS) : la détection de Vite l'imposait à tout Safari < 16.4,
// alors qu'il est bien plus lourd et lent.
const TARGETS = ['chrome >= 64', 'edge >= 79', 'firefox >= 67', 'safari >= 12', 'ios >= 12']

/**
 * Safari < 15.4 ignore entièrement les blocs @layer, or tout le CSS de React Flow est dans
 * « @layer xyflow { … } » : sur iOS 12 le graphe était invisible. On garde le contenu sans la couche.
 * (inset, light-dark… sont déjà convertis par Lightning CSS lors de la minification.)
 * Sans couche, l'ordre d'import fixe la priorité : le CSS de React Flow est importé avant app.css.
 */
const unwrapLayers = {
  postcssPlugin: 'unwrap-layers',
  AtRule: {
    layer(rule: AtRule) {
      if (rule.nodes?.length) rule.replaceWith(rule.nodes)
      else rule.remove() // déclaration d'ordre « @layer a, b; »
    },
  },
}

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
  css: { postcss: { plugins: [unwrapLayers] } },
  // chemins relatifs : le site fonctionne aussi dans un sous-dossier (GitHub Pages)
  base: './',
})
