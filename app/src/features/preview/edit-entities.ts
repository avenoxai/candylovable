import type { GameDefinition } from '@candylovable/contract'
import type { EditContext } from '../../lib/api/sse'

export interface EditEntity extends EditContext {
  /** Swatch color for tiles (from the theme palette); undefined for non-tiles. */
  swatch?: string
}

/**
 * The selectable preview entities derived from a game definition: each tile colour,
 * the background, and the level goal. These are what "select-and-edit" attaches as
 * context for an iteration.
 */
export const entitiesFor = (def: GameDefinition): EditEntity[] => {
  const tiles: EditEntity[] = def.theme.tiles.map((t) => ({
    kind: 'tile',
    ref: String(t.colorId),
    label: t.description ?? `Tile ${t.colorId + 1}`,
    swatch: def.theme.palette[t.colorId],
  }))
  return [
    ...tiles,
    { kind: 'background', label: 'Background' },
    { kind: 'goal', label: 'Goal' },
  ]
}
