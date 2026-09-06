import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backend = "http://127.0.0.1:8000";

const apiProxy = {
  "/api": {
    target: backend,
    changeOrigin: true,
    secure: false,
    timeout: 600_000,
    proxyTimeout: 600_000,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
  "/results": { target: backend, changeOrigin: true, secure: false },
  "/samples": { target: backend, changeOrigin: true, secure: false },
} as const;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: { ...apiProxy },
  },
  // `vite preview` does not inherit server.proxy — mirror it so production
  // preview builds do not hard-fail with browser "Failed to fetch".
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    proxy: { ...apiProxy },
  },
});
