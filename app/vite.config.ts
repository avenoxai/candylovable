import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Where the real backend lives when running without mocks (VITE_USE_MOCKS=false).
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    // FE calls relative /api/* and /assets/* (see lib/api/sse.ts); proxy them to the
    // backend so `VITE_USE_MOCKS=false pnpm dev` runs the full real chain in-browser.
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: true },
      '/assets': { target: BACKEND_URL, changeOrigin: true },
    },
  },
  test: {
    name: 'app',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
