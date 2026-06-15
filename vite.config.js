import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      // Share page is PHP — Vite can't run it. Forward /share/* to MAMP (Apache+PHP).
      // MAMP's .htaccess isn't applied (AllowOverride None), so route via PATH_INFO:
      //   /share/p123?task=t1  ->  /slidust/public/share/index.php/p123?task=t1
      '/share': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/share/, '/slidust/public/share/index.php'),
      },
    },
  },
  optimizeDeps: {
    include: ['react-is'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.png'],
      manifest: {
        name: 'Slidust',
        short_name: 'Slidust',
        description: 'Slide in. Dust Out — For better life',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        // Activate new service worker immediately without waiting
        skipWaiting: true,
        clientsClaim: true,
        // Only cache static assets (images, fonts) — never cache API calls
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'slidust-assets-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
})
