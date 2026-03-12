import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["campus_photo.png", "logo.png", "campus_logo.png", "logo-192.png", "logo-512.png"],
      manifest: {
        name: "CampusLedger",
        short_name: "CampusLedger",
        description: "Campus Asset & Inventory Management System",
        theme_color: "#4f46e5",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/welcome",
        scope: "/",
        icons: [
          {
            src: "/logo-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/logo-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Pre-cache all built JS, CSS, HTML, images and fonts
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}"],
        // Ensure SPA navigation works when served from standalone/cached shell
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/public\//],
        runtimeCaching: [
          {
            // POST mutations — queue offline, replay via SW background sync
            urlPattern: /\/api\/v1\/.*/i,
            handler: "NetworkOnly",
            method: "POST",
            options: {
              backgroundSync: {
                name: "campusledger-post-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            // PUT mutations
            urlPattern: /\/api\/v1\/.*/i,
            handler: "NetworkOnly",
            method: "PUT",
            options: {
              backgroundSync: {
                name: "campusledger-put-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            // PATCH mutations
            urlPattern: /\/api\/v1\/.*/i,
            handler: "NetworkOnly",
            method: "PATCH",
            options: {
              backgroundSync: {
                name: "campusledger-patch-queue",
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            // GET API responses — network-first so data is always fresh when online
            urlPattern: /\/api\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Images — cache-first for performance
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts and other CDN assets
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});