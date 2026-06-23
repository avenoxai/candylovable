import type { Coord } from './coord'

/** Puzzle families the platform supports. match3 ships first. */
export const GAME_TYPES = ['match3', 'merge2048', 'sliding', 'connect', 'sort'] as const
export type GameType = (typeof GAME_TYPES)[number]

/** Special tiles (Candy-Crush-canonical; see match3-research §specials). */
export const SPECIAL_KINDS = ['striped-h', 'striped-v', 'wrapped', 'colorBomb', 'fish'] as const
export type SpecialKind = (typeof SPECIAL_KINDS)[number]

export type GoalKind = 'score' | 'clearJelly' | 'collect' | 'bringDown'
export interface Goal {
  kind: GoalKind
  target: number
  /** colorId to collect, for `kind: 'collect'`. */
  collectColorId?: number
}

export interface CellType {
  colorId: number
  label?: string
}

/** Match shape → which special it spawns. */
export interface SpecialRule {
  match: 'line4' | 'square' | 'tShape' | 'lShape' | 'line5'
  creates: SpecialKind
}

export interface ScoringConfig {
  /** Points per cleared tile (Candy Crush ≈ 60). */
  baseClear: number
  /** Cascade reward growth; sources conflict, so this is tunable. */
  cascadeMultiplier: 'linear' | 'factorial' | number
  specialCreateBonus: Partial<Record<SpecialKind, number>>
}

export interface Blocker {
  at: Coord
  kind: 'jelly' | 'crate' | 'rock' | 'lock'
  layers?: number
}

/** A single level — levels are DATA, not code. */
export interface LevelDef {
  index: number
  /** colorId per cell, `null` = engine-generated/empty. Length = width*height when present. */
  boardOverride?: (number | null)[]
  goal: Goal
  moveLimit?: number
  blockers?: Blocker[]
  /** Score thresholds for 1/2/3 stars. */
  stars?: [number, number, number]
}

/**
 * One tile sprite within a theme tileset. Mirrors the on-disk asset manifest
 * at `assets/themes/<id>/tile_<id>.manifest.json` produced by the asset pipeline.
 */
export interface ThemeTileAsset {
  file: string
  index: number
  colorId: number
  /** [x0, y0, x1, y1] in source-sheet pixels. */
  bbox: [number, number, number, number]
  area_px?: number
  description?: string
}

export interface ThemeManifest {
  source: string
  prefix: string
  /** Chroma key color used when the sheet was sliced. */
  key: string
  size: number
  count: number
  assets: ThemeTileAsset[]
}

export interface ThemeTokens {
  id: string
  displayName: string
  /** Resolved tile manifest (the candy-replacement art). */
  tileset: ThemeManifest
  /** Base URL the tile PNGs are served from. */
  assetBaseUrl: string
  /** CSS color/gradient behind the board. */
  background: string
  /** Per-colorId accent (for particles/glow), hex or OKLCH. */
  palette: string[]
}

export interface AudioPack {
  pack: string
  /** Cue name → asset URL (e.g. `match`, `cascade`, `win`). */
  cues: Record<string, string>
}

/** Author-tunable juice intensities (0..1) the renderer reads per event. */
export interface JuiceConfig {
  particles: number
  screenShake: number
  squashStretch: number
  cascadePitch: number
  /** When true, the runtime auto-degrades juice under prefers-reduced-motion. */
  reducedMotionFallback: boolean
}

/** The compiled game — generation pipeline output, renderer input. */
export interface GameDefinition {
  schemaVersion: 1
  id: string
  meta: { title: string; gameType: GameType }
  board: { width: number; height: number; cellTypes: CellType[] }
  rules: {
    minMatch: number
    allowDiagonal: boolean
    specials: SpecialRule[]
    scoring: ScoringConfig
  }
  levels: LevelDef[]
  theme: ThemeTokens
  audio: AudioPack
  juice: JuiceConfig
}
