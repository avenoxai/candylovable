import { expect, test } from '@playwright/test'

/**
 * End-to-end smoke in a real browser — the path jsdom can't run: the Pixi/WebGL
 * preview canvas + the MSW dev worker serving the live generation stream.
 *
 * Runs headless (no GPU flags needed). NOTE: each PixiScene mounts its own canvas
 * so React StrictMode's double-mount can't lose the WebGL context — without that
 * fix this stalls with "Could not initialize shader". Kept out of the default
 * vitest gate (vitest only globs the unit test files under src).
 */
test('builds a game end-to-end: prompt → stream → preview → select-and-edit', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto('/')

  // shell surfaces
  await expect(page.getByLabel('builder chat')).toBeVisible()
  await expect(page.getByLabel('live preview')).toBeVisible()
  await expect(page.getByLabel('author panel')).toBeVisible()

  // the live preview mounts a real Pixi canvas inside the board host
  const board = page.getByLabel('game board')
  await expect(board).toBeVisible()
  await expect(board.locator('canvas')).toBeVisible({ timeout: 10_000 })

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
