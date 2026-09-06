import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backend = "http://127.0.0.1:8000";

const proxyCommon: ProxyOptions = {
  target: backend,
  changeOrigin: true,
  secure: false,
  timeout: 600_000,
  proxyTimeout: 600_000,
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        ...proxyCommon,
        rewrite: (path) => path.replace(/^\/api/, "") || "/",
      },
      "/results": proxyCommon,
      "/samples": proxyCommon,
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        ...proxyCommon,
        rewrite: (path) => path.replace(/^\/api/, "") || "/",
      },
      "/results": proxyCommon,
      "/samples": proxyCommon,
    },
  },
});
