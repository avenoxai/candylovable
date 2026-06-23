import type {
  AssetTile,
  Blocker,
  CellType,
  DesignDirection,
  GameDefinition,
  Goal,
  JuiceConfig,
  LevelDef,
  ScoringConfig,
  SpecialRule,
  ThemeTokens,
} from '@candylovable/contract'
import { GAME_TYPES } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import { simulateLevel } from '../validate/simulate-level'
import { assembleDraft } from './finalize'
import { type Tool, asArray, asNumber, asObject, asString, fail, ok } from './types'

/** Per-colorId accent for particles/glow when the model doesn't specify one. */
const DEFAULT_PALETTE = ['#ff4d6d', '#3d9bff', '#3fc06a', '#ffd23f', '#a77bff', '#ff8a3d']

function buildThemeTokens(themeId: string, catalog: AssetCatalog): ThemeTokens {
  const theme = catalog.getTheme(themeId)!
  const tiles: AssetTile[] = theme.tiles.map((tile) => ({
    colorId: tile.colorId,
    file: tile.file,
    description: tile.description,
  }))
  return {
    id: themeId,
    displayName: themeId.charAt(0).toUpperCase() + themeId.slice(1),
    assetBaseUrl: '/assets',
    // Contract v-current: `background` is the bg IMAGE path (relative to assetBaseUrl);
    // `backdropColor` is the CSS fallback behind transparent tiles. (Resolves the bg-image seam.)
    background: theme.background.file,
    backdropColor: 'linear-gradient(180deg, #ffd9ec 0%, #c8a2ff 100%)',
    tiles,
    palette: DEFAULT_PALETTE,
  }
}

/** The standardized tool set, in fixed registry order (the cache prefix depends on it). */
export function buildTools(): Tool[] {
  return [
    {
      tier: 'flash',
      def: {
        name: 'propose_design_directions',
        description: 'Offer 2-3 art/mechanic directions for the prompt, each tied to a library theme.',
        parameters: { type: 'object', properties: { prompt: { type: 'string' } } },
      },
      handler: (_args, ctx) => {
        const cat = ctx.catalog
        if (!cat) return fail('no asset catalog available')
        const dirs: DesignDirection[] = cat.themeIds().slice(0, 3).map((themeId, i) => ({
          id: `dir-${i}`,
          title: `${themeId.charAt(0).toUpperCase()}${themeId.slice(1)} match-3`,
          summary: cat.getTheme(themeId)?.background.description ?? themeId,
          themeId,
          previewColors: DEFAULT_PALETTE,
        }))
        return ok(dirs)
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'list_themes',
        description: 'List the theme ids available in the asset library (the model picks ONE).',
        parameters: { type: 'object', properties: {} },
      },
      handler: (_args, ctx) =>
        ctx.catalog ? ok(ctx.catalog.themeIds()) : fail('no asset catalog available'),
    },
    {
      tier: 'flash',
      def: {
        name: 'get_theme_assets',
        description: "Get a theme's background + 6 tiles (colorId, file, description).",
        parameters: { type: 'object', properties: { theme: { type: 'string' } }, required: ['theme'] },
      },
      handler: (args, ctx) => {
        const id = asString(args, 'theme')
        if (!id) return fail('theme is required')
        const t = ctx.catalog?.getTheme(id)
        return t ? ok(t) : fail(`unknown theme "${id}"`)
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'list_shared',
        description: 'List shared overlays/blockers/textures/particles (optionally by kind).',
        parameters: { type: 'object', properties: { kind: { type: 'string' } } },
      },
      handler: (args, ctx) => {
        if (!ctx.catalog) return fail('no asset catalog available')
        const kind = asString(args, 'kind')
        return ok(ctx.catalog.shared(kind as never))
      },
    },
    {
      tier: 'system',
      def: {
        name: 'validate_asset_refs',
        description: 'Hard guard: every referenced asset file/name must exist in the library.',
        parameters: { type: 'object', properties: { refs: { type: 'array', items: { type: 'string' } } }, required: ['refs'] },
      },
      handler: (args, ctx) => {
        if (!ctx.catalog) return fail('no asset catalog available')
        const refs = (asArray(args, 'refs') ?? []).filter((r): r is string => typeof r === 'string')
        const unknown = ctx.catalog.unknownRefs(refs)
        return unknown.length > 0 ? fail(...unknown.map((u) => `unknown asset: ${u}`)) : ok({ refs })
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'select_theme',
        description: 'Choose ONE theme for the game; resolves its tile/background tokens.',
        parameters: { type: 'object', properties: { theme: { type: 'string' } }, required: ['theme'] },
      },
      handler: (args, ctx) => {
        const id = asString(args, 'theme')
        if (!id) return fail('theme is required')
        if (!ctx.catalog?.hasTheme(id)) return fail(`theme "${id}" is not in the asset library`)
        ctx.draft.def.theme = buildThemeTokens(id, ctx.catalog)
        return ok({ theme: id })
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'set_meta',
        description: 'Set the game title and type (match3 for now).',
        parameters: {
          type: 'object',
          properties: { title: { type: 'string' }, gameType: { type: 'string' } },
          required: ['title', 'gameType'],
        },
      },
      handler: (args, ctx) => {
        const title = asString(args, 'title')
        const gameType = asString(args, 'gameType')
        if (!title) return fail('title is required')
        if (!gameType || !GAME_TYPES.includes(gameType as never)) return fail(`gameType must be one of ${GAME_TYPES.join(', ')}`)
        ctx.draft.def.meta = { title, gameType: gameType as GameDefinition['meta']['gameType'] }
        return ok()
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'set_board',
        description: 'Set board width/height. Tiles are always the 6 theme colors (colorId 0-5).',
        parameters: {
          type: 'object',
          properties: { width: { type: 'number' }, height: { type: 'number' } },
          required: ['width', 'height'],
        },
      },
      handler: (args, ctx) => {
        const width = asNumber(args, 'width')
        const height = asNumber(args, 'height')
        if (width === undefined || height === undefined) return fail('width and height are required')
        const theme = ctx.draft.def.theme
        const cellTypes: CellType[] = Array.from({ length: 6 }, (_unused, i) => {
          const desc = theme?.tiles.find((t) => t.colorId === i)?.description
          const label = desc?.split(/[\s—]+/).slice(0, 2).join(' ')
          return label ? { colorId: i, label } : { colorId: i }
        })
        ctx.draft.def.board = { width, height, cellTypes }
        return ok()
      },
    },
    {
      tier: 'pro',
      def: {
        name: 'set_rules',
        description: 'Set match rules: minMatch, allowDiagonal, special-tile rules, scoring.',
        parameters: {
          type: 'object',
          properties: {
            minMatch: { type: 'number' },
            allowDiagonal: { type: 'boolean' },
            specials: { type: 'array' },
            scoring: { type: 'object' },
          },
        },
      },
      handler: (args, ctx) => {
        const specials: SpecialRule[] = (asArray(args, 'specials') ?? []).flatMap((s) => {
          if (s && typeof s === 'object') {
            const o = s as Record<string, unknown>
            if (typeof o.match === 'string' && typeof o.creates === 'string') {
              return [{ match: o.match as SpecialRule['match'], creates: o.creates as SpecialRule['creates'] }]
            }
          }
          return []
        })
        const scoringIn = asObject(args, 'scoring') ?? {}
        const scoring: ScoringConfig = {
          baseClear: asNumber(scoringIn, 'baseClear') ?? 60,
          cascadeMultiplier: (scoringIn.cascadeMultiplier as ScoringConfig['cascadeMultiplier']) ?? 'linear',
          specialCreateBonus: (asObject(scoringIn, 'specialCreateBonus') as ScoringConfig['specialCreateBonus']) ?? {},
        }
        ctx.draft.def.rules = {
          minMatch: asNumber(args, 'minMatch') ?? 3,
          allowDiagonal: typeof args.allowDiagonal === 'boolean' ? args.allowDiagonal : false,
          specials,
          scoring,
        }
        return ok()
      },
    },
    {
      tier: 'pro',
      def: {
        name: 'author_level',
        description: 'Append one level: index, goal {kind,target,collectColorId?}, moveLimit, blockers, stars.',
        parameters: {
          type: 'object',
          properties: {
            index: { type: 'number' },
            goal: { type: 'object' },
            moveLimit: { type: 'number' },
            blockers: { type: 'array' },
            stars: { type: 'array' },
          },
          required: ['index', 'goal'],
        },
      },
      handler: (args, ctx) => {
        const index = asNumber(args, 'index')
        const goalIn = asObject(args, 'goal')
        if (index === undefined || !goalIn) return fail('index and goal are required')
        const goal: Goal = {
          kind: (goalIn.kind as Goal['kind']) ?? 'score',
          target: asNumber(goalIn, 'target') ?? 0,
        }
        if (typeof goalIn.collectColorId === 'number') goal.collectColorId = goalIn.collectColorId
        const level: LevelDef = { index, goal }
        const moveLimit = asNumber(args, 'moveLimit')
        if (moveLimit !== undefined) level.moveLimit = moveLimit
        const blockers = asArray(args, 'blockers')
        if (blockers) level.blockers = blockers.flatMap(coerceBlocker)
        const stars = asArray(args, 'stars')
        if (stars && stars.length === 3 && stars.every((s) => typeof s === 'number')) {
          level.stars = [stars[0] as number, stars[1] as number, stars[2] as number]
        }
        ctx.draft.def.levels = [...(ctx.draft.def.levels ?? []), level]
        return ok({ levels: ctx.draft.def.levels.length })
      },
    },
    {
      tier: 'system',
      def: {
        name: 'simulate_level',
        description: 'Check a level is solvable from its starting board (engine simulation).',
        parameters: { type: 'object', properties: { index: { type: 'number' } }, required: ['index'] },
      },
      handler: (args, ctx) => {
        const index = asNumber(args, 'index')
        if (index === undefined) return fail('index is required')
        const board = ctx.draft.def.board
        const levels = ctx.draft.def.levels
        if (!board || !levels?.length) return fail('set_board + author_level before simulating')
        if (index < 0 || index >= levels.length) return fail(`level ${index} does not exist yet (have ${levels.length}); author it first`)
        const simDef = {
          schemaVersion: 1,
          id: 'sim',
          meta: { title: 'sim', gameType: 'match3' },
          board,
          rules: { minMatch: 3, allowDiagonal: false, specials: [], scoring: { baseClear: 60, cascadeMultiplier: 'linear', specialCreateBonus: {} } },
          levels,
          theme: ctx.draft.def.theme,
          audio: { pack: '', cues: {} },
          juice: { particles: 0, screenShake: 0, squashStretch: 0, cascadePitch: 0, reducedMotionFallback: true },
        } as unknown as GameDefinition
        const sim = simulateLevel(simDef, index, ctx.makeEngine)
        return sim.solvableStart ? ok(sim) : fail(`level ${index} has no available moves at start`)
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'set_juice',
        description: 'Set juice intensities 0..1 (particles, screenShake, squashStretch, cascadePitch). Tuned, not maxed.',
        parameters: {
          type: 'object',
          properties: {
            particles: { type: 'number' },
            screenShake: { type: 'number' },
            squashStretch: { type: 'number' },
            cascadePitch: { type: 'number' },
          },
        },
      },
      handler: (args, ctx) => {
        const clamp = (n: number | undefined, d: number): number => Math.min(1, Math.max(0, n ?? d))
        const juice: JuiceConfig = {
          particles: clamp(asNumber(args, 'particles'), 0.6),
          screenShake: clamp(asNumber(args, 'screenShake'), 0.25),
          squashStretch: clamp(asNumber(args, 'squashStretch'), 0.6),
          cascadePitch: clamp(asNumber(args, 'cascadePitch'), 0.8),
          reducedMotionFallback: true,
        }
        ctx.draft.def.juice = juice
        return ok()
      },
    },
    {
      tier: 'system',
      def: {
        name: 'validate_game',
        description: 'Run the full validation gate on the current draft; returns the error list.',
        parameters: { type: 'object', properties: {} },
      },
      handler: (_args, ctx) => {
        const { def, errors } = assembleDraft(ctx.draft, ctx.catalog)
        return errors.length > 0 ? fail(...errors.map((e) => `${e.path}: ${e.message}`)) : ok({ valid: true, id: def?.id })
      },
    },
    {
      tier: 'flash',
      def: {
        name: 'request_asset',
        description: 'Request a missing asset from the assets lane (returns pending; do not block on it).',
        parameters: {
          type: 'object',
          properties: { kind: { type: 'string' }, description: { type: 'string' } },
          required: ['kind', 'description'],
        },
      },
      handler: (args) => ok({ status: 'pending', kind: asString(args, 'kind'), description: asString(args, 'description') }),
    },
    {
      tier: 'system',
      def: {
        name: 'finalize',
        description: 'Assemble + validate the game; on success returns the final GameDefinition.',
        parameters: { type: 'object', properties: {} },
      },
      handler: (_args, ctx) => {
        const { def, errors } = assembleDraft(ctx.draft, ctx.catalog)
        return def ? ok(def) : fail(...errors.map((e) => `${e.path}: ${e.message}`))
      },
    },
  ]
}

function coerceBlocker(b: unknown): Blocker[] {
  if (!b || typeof b !== 'object') return []
  const o = b as Record<string, unknown>
  const at = asObject(o, 'at')
  const x = at ? asNumber(at, 'x') : undefined
  const y = at ? asNumber(at, 'y') : undefined
  if (x === undefined || y === undefined || typeof o.kind !== 'string') return []
  const blocker: Blocker = { at: { x, y }, kind: o.kind as Blocker['kind'] }
  if (typeof o.layers === 'number') blocker.layers = o.layers
  return [blocker]
}

/** Map of tool name → Tool, plus the ordered ToolDef list for the model. */
export function buildToolRegistry(): { tools: Map<string, Tool>; defs: Tool['def'][] } {
  const list = buildTools()
  return { tools: new Map(list.map((t) => [t.def.name, t])), defs: list.map((t) => t.def) }
}
