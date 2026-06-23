import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// `import './tokens.css?raw'` is swallowed by the Tailwind plugin (returns ''), and
// Vite rewrites the `new URL('./x', import.meta.url)` asset pattern — so resolve the
// path from the bare module URL and read the token source straight off disk.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8')

/**
 * WCAG contrast guard for the OKLCH design tokens. jsdom can't run axe's
 * color-contrast rule (no layout), so we compute it from the token source here:
 * OKLCH → linear sRGB → relative luminance → contrast ratio. Locks in 4.5:1 for
 * body/button text and 3:1 for the focus ring, so a token tweak can't silently
 * regress accessibility.
 */
type Oklch = { L: number; C: number; h: number; a: number }

const block = (selector: string): string => {
  const i = css.indexOf(selector)
  const open = css.indexOf('{', i)
  const close = css.indexOf('}', open)
  return css.slice(open, close)
}

const token = (scope: string, name: string): Oklch => {
  const m = scope.match(
    new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*/\\s*([\\d.]+))?\\)`),
  )
  if (!m) throw new Error(`token --${name} not found`)
  return { L: +m[1]!, C: +m[2]!, h: +m[3]!, a: m[4] ? +m[4]! : 1 }
}

const toLinear = ({ L, C, h }: Oklch): [number, number, number] => {
  const hr = (h * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number]
}

const lum = (rgb: [number, number, number]): number =>
  0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

const over = (
  fg: [number, number, number],
  bg: [number, number, number],
  a: number,
): [number, number, number] => fg.map((v, i) => v * a + bg[i]! * (1 - a)) as [number, number, number]

const ratio = (a: Oklch, b: Oklch): number => {
  const la = lum(over(toLinear(a), toLinear(b), a.a))
  const lb = lum(toLinear(b))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const root = block(':root')
const light = block("[data-theme='light']")

describe('token contrast (WCAG)', () => {
  describe('warm-dark (default)', () => {
    const t = (n: string) => token(root, n)
    it('body text ≥ 4.5:1 on bg and surface', () => {
      expect(ratio(t('text'), t('bg'))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(t('text'), t('surface'))).toBeGreaterThanOrEqual(4.5)
    })
    it('muted text ≥ 4.5:1 on bg', () => {
      expect(ratio(t('text-muted'), t('bg'))).toBeGreaterThanOrEqual(4.5)
    })
    it('accent-ink ≥ 4.5:1 on both gradient stops (button text)', () => {
      expect(ratio(t('accent-ink'), t('accent'))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(t('accent-ink'), t('accent-2'))).toBeGreaterThanOrEqual(4.5)
    })
    it('focus ring ≥ 3:1 on bg and surface-2 (non-text UI)', () => {
      expect(ratio(t('accent'), t('bg'))).toBeGreaterThanOrEqual(3)
      expect(ratio(t('accent'), t('surface-2'))).toBeGreaterThanOrEqual(3)
    })
  })

  describe('parchment-light', () => {
    const t = (n: string) => token(light, n)
    it('body text ≥ 4.5:1 on bg and surface', () => {
      expect(ratio(t('text'), t('bg'))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(t('text'), t('surface'))).toBeGreaterThanOrEqual(4.5)
    })
    it('muted text ≥ 4.5:1 on bg', () => {
      expect(ratio(t('text-muted'), t('bg'))).toBeGreaterThanOrEqual(4.5)
    })
    it('accent-ink (inherited accent) ≥ 4.5:1 as button text', () => {
      // light theme inherits --accent from :root
      expect(ratio(token(root, 'accent-ink'), token(root, 'accent'))).toBeGreaterThanOrEqual(4.5)
    })
    it('focus ring ≥ 3:1 on light bg', () => {
      expect(ratio(token(root, 'accent'), t('bg'))).toBeGreaterThanOrEqual(3)
    })
  })
})
