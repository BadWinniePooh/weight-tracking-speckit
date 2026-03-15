import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
        login: resolve(__dirname, "src/login.html"),
        "reset-request": resolve(__dirname, "src/reset-request.html"),
        "reset-complete": resolve(__dirname, "src/reset-complete.html"),
        setup: resolve(__dirname, "src/setup.html"),
      },
    },
  },
});
