import { defineConfig } from 'vitest/config'

// Two projects: pure-logic packages run in node; the app runs in jsdom (its own
// vite.config.ts supplies the react plugin + jsdom test settings).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'packages',
          include: ['packages/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      './app',
    ],
  },
})
