import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [react(), crx({ manifest })],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    target: 'esnext',
    rollupOptions: {
      // A pagina do app nao esta declarada no manifest (nao e popup nem
      // options_page) porque e aberta programaticamente pelo service worker.
      // Sem esta entrada explicita o crxjs nao a incluiria no bundle.
      input: {
        app: 'src/app/index.html',
      },
    },
  },
})
