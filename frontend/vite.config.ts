import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  root: "src",
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
