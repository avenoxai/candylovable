import { defineConfig } from 'vitest/config'

// Root test runner. Packages with no DOM needs run in the default `node`
// environment; app/component suites will be added as their own projects
// (jsdom) when the app package is scaffolded.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    passWithNoTests: false,
  },
})
