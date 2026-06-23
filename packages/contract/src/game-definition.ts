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
 * One tile in the SHARED asset catalog (`assets/library.json`, owned by the
 * assets/visual lane). Asset file naming is a hard contract: `tile_<theme>_NN`.
 */
export interface AssetTile {
  colorId: number
  /** Path relative to `assets/` (e.g. `themes/gems/tile_gems_00.png`). */
  file: string
  description?: string
}

/** A background image in the asset catalog (`bg_<theme>`). */
export interface AssetBackground {
  /** Path relative to `assets/`. */
  file: string
  description?: string
}

/** A theme entry in `assets/library.json`. */
export interface AssetThemeEntry {
  background: AssetBackground
  /** Six tiles, index === colorId (0–5). */
  tiles: AssetTile[]
}

/** A named, theme-agnostic shared asset (special overlay, blocker, texture, particle). */
export interface SharedAsset {
  /** Stable name, e.g. `fx_special_striped`, `blocker_ice`, `tex_button`, `fx_particle_spark`. */
  name: string
  /** Path relative to `assets/`. */
  file: string
  description?: string
}

/** Theme-agnostic shared assets in `assets/library.json`. */
export interface AssetSharedSection {
  /** Special-tile overlays: `fx_special_<striped|wrapped|bomb|color>`. */
  overlay: SharedAsset[]
  /** Cell obstacles: `blocker_<ice|jelly|crate|lock>`. */
  blocker: SharedAsset[]
  /** 9-slice UI/board skins: `tex_<button|panel|frame|slot>`. */
  texture_9slice: SharedAsset[]
  /** Particle sprites the renderer tints/blends: `fx_particle_<spark|star|ring>`. */
  particle: SharedAsset[]
}

/**
 * The shared asset catalog — owned by the assets/visual lane (`assets/library.json`).
 * The renderer resolves a {@link ThemeTokens} from one theme entry, and maps engine
 * enums (`SpecialKind`, blocker kind) onto {@link AssetSharedSection} entries.
 */
export interface AssetLibrary {
  version: number
  /** Source sprite size in px (currently 256). */
  tile_size: number
  /** Asset kind, e.g. `whole_sprite`. */
  kind: string
  themes: Record<string, AssetThemeEntry>
  shared: AssetSharedSection
}

/** Resolved theme the renderer uses: one library entry + display name + accent palette. */
export interface ThemeTokens {
  id: string
  displayName: string
  /** Base URL the asset `file` paths are resolved against (e.g. `/assets`). */
  assetBaseUrl: string
  /** Background image path (relative to {@link assetBaseUrl}). */
  background: string
  /** Optional CSS color/gradient behind the (transparent) tiles. */
  backdropColor?: string
  /** Tile sprites; `tiles[colorId]` is the art for that colour. */
  tiles: AssetTile[]
  /** Per-colorId accent for particles/glow (renderer-side; not in the catalog). */
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
