import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/donerka-kitchen/'

export default defineConfig(({ mode }) => ({
  base: mode === 'test' ? '/' : BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      disable: mode === 'test',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Кухня Donerka',
        short_name: 'Кухня',
        description: 'Задачи кухни на сегодня',
        lang: 'ru',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f3ee',
        theme_color: '#f6f3ee',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: BASE + 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
  },
}))
