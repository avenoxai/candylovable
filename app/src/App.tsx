import { motion } from 'motion/react'
import { useState } from 'react'
import { UI_DURATION, UI_EASE } from './design-system/motion/motion'

type Theme = 'dark' | 'light'

/**
 * Phase 0 landing placeholder — proves the design tokens + UI motion vocabulary
 * are wired. Replaced by the real empty-state / workspace shell in Phase 2.
 */
export const App = () => {
  const [theme, setTheme] = useState<Theme>('dark')

  const toggleTheme = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <motion.h1
        className="text-5xl font-medium tracking-tight text-ink"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: UI_DURATION.base, ease: UI_EASE.decelerate }}
      >
        candylovable
      </motion.h1>
      <p className="max-w-md text-center text-muted">
        Describe a simple puzzle game. Watch it come to life.
      </p>
      <motion.button
        type="button"
        onClick={toggleTheme}
        whileTap={{ scale: 0.97 }}
        className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-ink"
      >
        Theme: {theme}
      </motion.button>
    </main>
  )
}
