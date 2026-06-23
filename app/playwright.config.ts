import { defineConfig, devices } from '@playwright/test'

const PORT = 5181
const BASE_URL = `http://localhost:${PORT}`

/**
 * E2E smoke for the real-browser path that jsdom can't exercise: the Pixi/WebGL
 * preview + the MSW dev worker serving the live generation stream. Runs the Vite
 * dev server (DEV → MSW worker auto-boots).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
