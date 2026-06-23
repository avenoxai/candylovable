import type { GameDefinition, GenerationEvent } from '@candylovable/contract'
import type { AuthoringDeps, AuthoringPort, GenerateInput, IterateInput } from './authoring'
import type { Session } from './store/store'

/** A minimal, valid, solvable match-3 def — the scripted FakeAuthoring output. */
export const demoDef = (id: string, title = 'Demo Match-3'): GameDefinition => ({
  schemaVersion: 1,
  id,
  meta: { title, gameType: 'match3' },
  board: { width: 8, height: 8, cellTypes: Array.from({ length: 6 }, (_, i) => ({ colorId: i })) },
  rules: {
    minMatch: 3,
    allowDiagonal: false,
    specials: [
      { match: 'line4', creates: 'striped-h' },
      { match: 'line5', creates: 'colorBomb' },
    ],
    scoring: { baseClear: 60, cascadeMultiplier: 'linear', specialCreateBonus: {} },
  },
  levels: [{ index: 0, goal: { kind: 'score', target: 1000 }, moveLimit: 20, stars: [1000, 2000, 3000] }],
  theme: {
    id: 'gems',
    displayName: 'Gems',
    assetBaseUrl: '/assets',
    background: 'themes/gems/bg_gems.png',
    tiles: [],
    palette: [],
  },
  audio: { pack: 'default', cues: {} },
  juice: { particles: 0.7, screenShake: 0.4, squashStretch: 0.6, cascadePitch: 0.8, reducedMotionFallback: true },
})

/**
 * A scripted {@link AuthoringPort} stand-in (BE-D10): deterministic `GenerationEvent`
 * streams that produce a real, valid def — so the SSE routes + persistence are built and
 * tested end-to-end with no network and no DeepSeek. Swapped for the real
 * `@candylovable/authoring` at P8 via a deps adapter (BE-O1/BE-D3).
 */
export class FakeAuthoring implements AuthoringPort {
  async *generate(input: GenerateInput, deps: AuthoringDeps): AsyncIterable<GenerationEvent> {
    const { signal } = deps
    const stop = (): boolean => signal?.aborted === true
    const def = demoDef(deps.ids(), titleFrom(input.prompt))

    if (stop()) return
    yield { type: 'plan', steps: ['design', 'theme', 'rules', 'levels', 'validate', 'finalize'] }

    if (stop()) return
    yield { type: 'step', id: 's1', label: 'Design directions', status: 'start', kind: 'design' }
    yield {
      type: 'designDirections',
      options: [
        { id: 'd1', title: 'Gem Cascade', summary: 'classic jewels', themeId: 'gems', previewColors: ['#e44', '#4ae'] },
        { id: 'd2', title: 'Candy Pop', summary: 'sweet + juicy', themeId: 'candy', previewColors: ['#f7c', '#fd6'] },
      ],
    }
    yield { type: 'step', id: 's1', label: 'Design directions', status: 'done', kind: 'design' }

    if (stop()) return
    yield { type: 'token', text: 'Building a match-3 around your prompt… ' }
    yield { type: 'step', id: 's2', label: 'Theme', status: 'start', kind: 'theme' }
    yield { type: 'partial', def: { theme: def.theme } }
    yield { type: 'step', id: 's2', label: 'Theme', status: 'done', kind: 'theme' }

    if (stop()) return
    yield { type: 'step', id: 's3', label: 'Levels', status: 'start', kind: 'level' }
    yield { type: 'partial', def: { levels: def.levels } }
    yield { type: 'step', id: 's3', label: 'Levels', status: 'done', kind: 'level' }

    if (stop()) return
    yield { type: 'gameReady', def }
    yield { type: 'done' }
  }

  async *iterate(
    input: IterateInput,
    deps: AuthoringDeps & { session: Session },
  ): AsyncIterable<GenerationEvent> {
    const { signal, session } = deps
    const stop = (): boolean => signal?.aborted === true
    const base = session.currentDef ?? demoDef(deps.ids())
    // a deterministic edit: bump level 0's target (simulates "make it harder")
    const next: GameDefinition = {
      ...base,
      levels: base.levels.map((l) =>
        l.index === 0 ? { ...l, goal: { ...l.goal, target: l.goal.target + 500 } } : l,
      ),
    }

    if (stop()) return
    yield { type: 'plan', steps: ['classify edit', 'apply', 'validate'] }
    yield { type: 'token', text: `Applying: ${input.message} ` }
    yield { type: 'step', id: 'e1', label: 'Apply edit', status: 'start', kind: 'level' }
    yield { type: 'partial', def: { levels: next.levels } }
    yield { type: 'step', id: 'e1', label: 'Apply edit', status: 'done', kind: 'level' }
    if (stop()) return
    yield { type: 'gameReady', def: next }
    yield { type: 'done' }
  }
}

const titleFrom = (prompt: string): string => {
  const trimmed = prompt.trim()
  if (!trimmed) return 'Demo Match-3'
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
}
