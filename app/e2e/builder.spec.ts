import { expect, test } from '@playwright/test'

/**
 * End-to-end smoke in a real browser — the path jsdom can't run: the Pixi/WebGL
 * preview canvas + the MSW dev worker serving the live generation stream.
 *
 * ⚠️ Run on a real GPU: `pnpm test:e2e --headed` (or a CI runner with hardware
 * WebGL). Chromium's *headless-shell* can't compile Pixi v8's shaders — it logs
 * "Could not initialize shader" and the render loop stalls the page, so the
 * preview never settles. This isn't an app bug (PixiScene degrades gracefully and
 * 89 jsdom tests cover the React logic); it's a headless-WebGL limitation. Kept
 * out of the default `pnpm test` gate (vitest only runs src/**/*.test.*).
 */
test('builds a game end-to-end: prompt → stream → preview → select-and-edit', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')

  // shell surfaces
  await expect(page.getByLabel('builder chat')).toBeVisible()
  await expect(page.getByLabel('live preview')).toBeVisible()
  await expect(page.getByLabel('author panel')).toBeVisible()

  // the live preview mounts a real Pixi canvas
  const canvas = page.getByLabel('game board')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('width', '560')

  // prompt → streamed generation (MSW worker) → committed version
  await page.getByLabel('prompt').fill('spooky ghost match game')
  await page.getByRole('button', { name: /generate/i }).click()

  // the streamed steps show in the action timeline…
  await expect(page.getByText('Picking a look')).toBeVisible()
  // …and the finished game is committed as a version with the prompt-derived title
  const versions = page.getByRole('navigation', { name: 'version history' })
  await expect(versions).toBeVisible({ timeout: 15_000 })
  await expect(versions).toContainText('Spooky Ghost Match Game', { timeout: 15_000 })

  // select-and-edit: pick a previewed entity → it attaches as edit context
  await page.getByRole('button', { name: /edit Background/i }).click()
  await expect(page.getByText('Editing')).toBeVisible()
  await expect(page.getByRole('button', { name: /^update$/i })).toBeVisible()

  // the Pixi path must not have thrown
  expect(pageErrors, pageErrors.join('\n')).toHaveLength(0)
})
