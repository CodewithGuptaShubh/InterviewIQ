import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail loudly if another copy is already running instead of silently starting a second one on 5174.
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8080"
    }
  }
});
