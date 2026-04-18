import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/verbyte/',
      scope: '/verbyte/',
      injectRegister: 'auto',
      strategies: 'generateSW',
      workbox: {
        // App shell'i precache et
        globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
        // Data JSON dosyalarını istek üzerine cache'le (CacheFirst)
        runtimeCaching: [
          {
            urlPattern: /\/verbyte\/data\/.+\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'verbyte-data-v1',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 gün
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Ses dosyaları — NetworkFirst (büyük, isteğe bağlı)
          {
            urlPattern: /\/verbyte\/audio/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'verbyte-audio-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 gün
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: '/verbyte/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/worker/],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Verbyte',
        short_name: 'Verbyte',
        description: 'Bite-sized language learning — FR, EN, DE',
        theme_color: '#151432',
        background_color: '#0C0B1F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/verbyte/',
        scope: '/verbyte/',
        lang: 'tr',
        categories: ['education'],
        icons: [
          {
            src: '/verbyte/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/verbyte/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/verbyte/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  base: '/verbyte/',
})
