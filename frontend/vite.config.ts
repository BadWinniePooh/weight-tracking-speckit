import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      workbox: {
        globPatterns: [],
      },
      manifest: {
        name: "Weight Tracker",
        short_name: "WeightTracker",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#4f46e5",
        background_color: "#ffffff",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  root: "src",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        login: resolve(__dirname, "src/login.html"),
        setup: resolve(__dirname, "src/setup.html"),
        resetRequest: resolve(__dirname, "src/reset-request.html"),
        resetComplete: resolve(__dirname, "src/reset-complete.html"),
        confirmEmail: resolve(__dirname, "src/confirm-email.html"),
        profile: resolve(__dirname, "src/profile.html"),
        admin: resolve(__dirname, "src/admin.html"),
      },
    },
  },
});
