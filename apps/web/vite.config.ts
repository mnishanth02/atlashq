import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@atlashq/api-client": fileURLToPath(
        new URL("../../packages/api-client/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    port: 4187,
    strictPort: true,
    proxy: {
      // Proxies both the `/api/v1/*` REST surface and the `/api/auth/*` Better Auth
      // handler to the local API, so browser requests stay same-origin in dev and
      // Better Auth's session cookie (SameSite=Lax) is sent without CORS.
      "/api": {
        target: process.env.VITE_DEV_API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
