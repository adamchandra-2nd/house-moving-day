import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    /**
     * `--mode lan` serves HTTPS with a throwaway certificate, for testing on
     * phones over wifi. Phones only open the camera on HTTPS (or localhost),
     * so the door QR scan cannot be tried any other way. The phone warns
     * about the certificate once; that is expected for a dev certificate.
     */
    ...(mode === 'lan' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HMD Event Companion · Potara',
        short_name: 'HMD Potara',
        description: 'Pendamping tamu House Moving Day Potara.',
        lang: 'id',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FCF2E3',
        theme_color: '#FCF2E3',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        /**
         * Precache is an explicit allowlist, not "every .js".
         *
         * The guest shell, fonts and room art are precached, so after the first
         * visit the app opens from disk and keeps working with no network. Only
         * woff2 — no browser that runs this app fetches woff.
         *
         * Everything lazy stays out: admin (desktop only), the MC and
         * Performance sides, the review hub, and above all Spline, whose
         * runtime splits into ~90 chunks totalling about
         * 4.6 MB. A pattern matching every .js file swept all of that into the
         * precache and had every guest's service worker fetch it in the
         * background — the exact thing this app is built to avoid. Those are
         * runtime-cached below, so only whoever opens that screen pays for them.
         */
        globDirectory: 'dist',
        globPatterns: [
          'index.html',
          'registerSW.js',
          'assets/index-*.{js,css}',
          'assets/*.woff2',
          'assets/*.webp',
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        /** Spline's scene is far bigger than the default cache ceiling. */
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            /**
             * The Spline scene: ~1 MB, self-hosted and content-hashed, so cache
             * first and never re-download it for a returning guest. Kept out of
             * the precache so a guest's first visit does not pay for it.
             */
            urlPattern: /\.splinecode$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hmd-spline-scene',
              expiration: { maxEntries: 3, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Admin, review hub and the Spline runtime chunks, on first use.
            urlPattern: /\/assets\/.*\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'hmd-lazy-chunks' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  /** Vite does not know this extension; emit it as a hashed asset URL. */
  assetsInclude: ['**/*.splinecode'],
  server: {
    host: true,
    /**
     * The API on the same origin. An HTTPS page cannot call an http:// API
     * (mixed content), and a phone cannot reach "localhost:8081" anyway --
     * so in lan mode VITE_API_URL is empty and /api goes through here.
     */
    proxy: {
      '/api': { target: process.env.HMD_API ?? 'http://localhost:8081', changeOrigin: false },
    },
  },
}))
