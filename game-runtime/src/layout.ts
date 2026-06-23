import type { Coord } from '@candylovable/contract'

export interface BoardLayout {
  cols: number
  rows: number
  /** Square cell edge in px. */
  cellSize: number
  /** Uniform gap between cells and around the board edge. */
  gap: number
  /** Top-left of the centred board within the viewport. */
  originX: number
  originY: number
  /** Total board pixel size (including outer gaps). */
  width: number
  height: number
}

/** Fit a `cols × rows` board into a `pxWidth × pxHeight` viewport, centred. */
export const computeLayout = (
  cols: number,
  rows: number,
  pxWidth: number,
  pxHeight: number,
  gap = 8,
): BoardLayout => {
  const availW = (pxWidth - gap * (cols + 1)) / cols
  const availH = (pxHeight - gap * (rows + 1)) / rows
  const cellSize = Math.max(0, Math.floor(Math.min(availW, availH)))
  const width = cellSize * cols + gap * (cols + 1)
  const height = cellSize * rows + gap * (rows + 1)
  return {
    cols,
    rows,
    cellSize,
    gap,
    originX: Math.floor((pxWidth - width) / 2),
    originY: Math.floor((pxHeight - height) / 2),
    width,
    height,
  }
}

/** Pixel centre of a board cell. */
export const cellCenter = (l: BoardLayout, x: number, y: number): { px: number; py: number } => ({
  px: l.originX + l.gap + x * (l.cellSize + l.gap) + l.cellSize / 2,
  py: l.originY + l.gap + y * (l.cellSize + l.gap) + l.cellSize / 2,
})

/** Cell at a viewport pixel, or null if outside the board or within a gap. */
export const pixelToCell = (l: BoardLayout, px: number, py: number): Coord | null => {
  const stride = l.cellSize + l.gap
  if (stride <= 0) return null
  const lx = px - l.originX - l.gap
  const ly = py - l.originY - l.gap
  if (lx < 0 || ly < 0) return null
  const cx = Math.floor(lx / stride)
  const cy = Math.floor(ly / stride)
  if (cx < 0 || cx >= l.cols || cy < 0 || cy >= l.rows) return null
  // Reject hits that land in the gap rather than on the cell itself.
  if (lx - cx * stride > l.cellSize || ly - cy * stride > l.cellSize) return null
  return { x: cx, y: cy }
}
