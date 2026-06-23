import type { DesignDirection, GameDefinition, GenerationEvent } from '@candylovable/contract'
import { sampleMatch3 } from './fixtures'

const titleFromPrompt = (prompt: string): string => {
  const words = prompt.trim().split(/\s+/).slice(0, 4).join(' ')
  return words ? words.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Custom Puzzle'
}

const DIRECTIONS: DesignDirection[] = [
  { id: 'gems', title: 'Gem Cavern', summary: 'Faceted jewels on a deep violet board', themeId: 'gems', previewColors: ['#ff5a6e', '#4aa3ff', '#4bd07a'] },
  { id: 'candy', title: 'Candy Rush', summary: 'Glossy sweets, bright and playful', themeId: 'candy', previewColors: ['#ff7eb3', '#7afcff', '#feff9c'] },
  { id: 'fruit', title: 'Fruit Stand', summary: 'Juicy fruit, fresh and friendly', themeId: 'fruit', previewColors: ['#ff9f43', '#10ac84', '#ee5253'] },
]

/**
 * Deterministic mock of the deepseek-infra generation pipeline: the exact
 * {@link GenerationEvent} sequence the FE streams against. Doubles as a contract
 * reference for the deepseek-infra lane (target this event order/shape).
 */
export const mockGenerationEvents = (prompt: string): GenerationEvent[] => {
  const def: GameDefinition = {
    ...sampleMatch3,
    id: 'generated',
    meta: { ...sampleMatch3.meta, title: titleFromPrompt(prompt) },
  }
  return [
    { type: 'plan', steps: ['Pick a look', 'Set the rules', 'Build levels', 'Theme & juice'] },
    { type: 'step', id: 'design', label: 'Picking a look', status: 'start', kind: 'design' },
    { type: 'designDirections', options: DIRECTIONS },
    { type: 'step', id: 'design', label: 'Picking a look', status: 'done', kind: 'design' },
    { type: 'step', id: 'rules', label: 'Setting the rules', status: 'start', kind: 'rules' },
    { type: 'token', text: 'An 8×8 match-3' },
    { type: 'token', text: ' — clear three or more to score.' },
    { type: 'partial', def: { meta: def.meta } },
    { type: 'step', id: 'rules', label: 'Setting the rules', status: 'done', kind: 'rules' },
    { type: 'step', id: 'levels', label: 'Building levels', status: 'start', kind: 'level' },
    { type: 'step', id: 'levels', label: 'Building levels', status: 'done', kind: 'level' },
    { type: 'step', id: 'theme', label: 'Theme & juice', status: 'start', kind: 'theme' },
    { type: 'step', id: 'theme', label: 'Theme & juice', status: 'done', kind: 'theme' },
    { type: 'gameReady', def },
    { type: 'done' },
  ]
}

/** Encode events as an SSE body (`data: <json>\n\n` per event). */
export const toSSE = (events: GenerationEvent[]): string =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
