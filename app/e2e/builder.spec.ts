import { type Coord } from '@candylovable/contract'
import { cellCenter, computeLayout } from '@candylovable/game-runtime'
import { FakeEngine, sampleMatch3 } from '@candylovable/mocks'
import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * End-to-end smoke in a real browser — the path jsdom can't run: the Pixi/WebGL
 * preview canvas + the MSW dev worker serving the live generation stream.
 *
 * Runs headless (no GPU flags needed). NOTE: each PixiScene mounts its own canvas
 * so React StrictMode's double-mount can't lose the WebGL context — without that
 * fix this stalls with "Could not initialize shader". Kept out of the default
 * vitest gate (vitest only globs the unit test files under src).
 */
const BOARD_SIZE = 560
const INITIAL_LAYOUT = computeLayout(sampleMatch3.board.width, sampleMatch3.board.height, BOARD_SIZE, BOARD_SIZE)

const playInitialMoves = async (page: Page, board: Locator, count: number): Promise<void> => {
  const engine = new FakeEngine()
  engine.init(sampleMatch3, 0)
  for (let i = 0; i < count; i++) {
    const move = engine.getAvailableMoves()[0]
    if (!move) throw new Error(`sampleMatch3 has no available move at step ${i}`)
    await clickCell(page, board, move.a)
    await expect(board).toHaveAttribute('data-selected', `${move.a.x},${move.a.y}`)
    await clickCell(page, board, move.b)
    const result = engine.trySwap(move.a, move.b)
    if (!result.accepted) throw new Error(`test move ${i} was rejected`)
    await expect(page.getByLabel('game status')).toContainText(`Moves ${20 - engine.getState().movesUsed}`)
  }
}

const clickCell = async (page: Page, board: Locator, cell: Coord): Promise<void> => {
  const box = await board.boundingBox()
  if (!box) throw new Error('game board box is unavailable')
  const { px, py } = cellCenter(INITIAL_LAYOUT, cell.x, cell.y)
  await page.mouse.click(box.x + px, box.y + py)
}

const expectPreviewContentAligned = async (page: Page): Promise<void> => {
  const preview = page.getByLabel('live preview')
  const status = page.getByLabel('game status')
  const board = page.getByLabel('game board')
  await expect(status).toBeVisible()
  await expect(board).toBeVisible()
  const [previewBox, statusBox, boardBox] = await Promise.all([
    preview.boundingBox(),
    status.boundingBox(),
    board.boundingBox(),
  ])
  expect(previewBox).not.toBeNull()
  expect(statusBox).not.toBeNull()
  expect(boardBox).not.toBeNull()
  expect(statusBox!.y).toBeGreaterThanOrEqual(previewBox!.y)
  expect(boardBox!.y).toBeGreaterThan(statusBox!.y)
  expect(boardBox!.x).toBeGreaterThanOrEqual(previewBox!.x)
  expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(previewBox!.x + previewBox!.width)
}


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

  // Multi-line clears/cascades can retarget the same sprite several times before
  // Pixi gets a frame. Replaying several deterministic moves catches stale tween
  // targets that used to leave visual holes after explosions.
  await playInitialMoves(page, board, 5)
  await page.waitForTimeout(1_000)

  // prompt → streamed generation (MSW worker) → committed version
  await page.getByLabel('prompt').fill('spooky ghost match game')
  await page.getByRole('button', { name: /generate/i }).click()

  // the streamed steps show in the action timeline…
  await expect(page.getByText('Picking a look')).toBeVisible()
  // …and the finished game is committed as a version with the prompt-derived title
  const versions = page.getByRole('navigation', { name: 'version history' })
  await expect(versions).toBeVisible({ timeout: 15_000 })
  await expect(versions).toContainText('Spooky Ghost Match Game', { timeout: 15_000 })
  await expectPreviewContentAligned(page)

  // select-and-edit: pick a previewed entity → it attaches as edit context
  await page.getByRole('button', { name: /edit Background/i }).click()
  await expect(page.getByText('Editing')).toBeVisible()
  await expect(page.getByRole('button', { name: /^update$/i })).toBeVisible()

  // the Pixi path must not have thrown
  expect(pageErrors, pageErrors.join('\n')).toHaveLength(0)
})
