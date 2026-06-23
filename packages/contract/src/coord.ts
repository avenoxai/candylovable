/** A board cell coordinate. Origin top-left; +x right, +y down. */
export interface Coord {
  readonly x: number
  readonly y: number
}

/** Stable string key for a coordinate (e.g. for Set/Map dedupe). */
export const coordKey = (c: Coord): string => `${c.x},${c.y}`

export const coordEquals = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y

/** Whether two coords are orthogonally adjacent (the only legal swap). */
export const isAdjacent = (a: Coord, b: Coord): boolean => {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx + dy === 1
}

/** Flat-array index for a board cell: `idx = x + y * width` (see match3-research). */
export const toIndex = (x: number, y: number, width: number): number => x + y * width

/** Inverse of {@link toIndex}. */
export const fromIndex = (i: number, width: number): Coord => ({
  x: i % width,
  y: Math.floor(i / width),
})
