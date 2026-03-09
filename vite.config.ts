import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [runtimeErrorOverlay()]
      : []),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}"],
        // Network-first for HTML documents to ensure fresh page load on refresh
        navigateFallbackDenylist: [/^\/api\//],
        // Separate runtime caching rules for different file types
        runtimeCaching: [
          {
            // HTML - network first to ensure fresh content on refresh
            urlPattern: /\.html$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 300, // 5 minutes
              }
            }
          },
          {
            // Assets - cache first since they have hash in filename
            urlPattern: /^\/assets\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      manifest: {
        name: "Card Game",
        short_name: "CardGame",
        description: "Koleksi kartu interaktif dengan push notifications",
        theme_color: "#0066cc",
        background_color: "#ffffff",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        icons: [
          {
            src: "/favicon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/favicon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
        categories: ["games"],
        shortcuts: [
          {
            name: "Gacha Pull",
            short_name: "Gacha",
            description: "Tarik kartu baru",
            url: "/gacha",
            icons: [
              {
                src: "/favicon.png",
                sizes: "96x96",
              },
            ],
          },
          {
            name: "Inventory",
            short_name: "Inventory",
            description: "Lihat koleksi kartu Anda",
            url: "/inventory",
            icons: [
              {
                src: "/favicon.png",
                sizes: "96x96",
              },
            ],
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    middlewareMode: true,
    hmr: false,
  },
});
