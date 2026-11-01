import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Playground của trình soạn v2 — cũng là trang cho test E2E (Playwright).
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: { port: 5199, strictPort: true, fs: { allow: [path.resolve(__dirname, "..")] } },
  preview: { port: 5199, strictPort: true },
});
