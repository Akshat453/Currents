import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "../../packages/shared/src")
    }
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          map: ["leaflet", "react-leaflet"],
          data: ["@tanstack/react-query", "axios", "zustand", "socket.io-client"],
          charts: ["recharts"]
        }
      }
    }
  },
  test: { environment: "jsdom", setupFiles: "./src/test/setup.js" }
});
