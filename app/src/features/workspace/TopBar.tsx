import { Button } from '../../design-system/primitives'
import { useUiStore } from '../../store/ui'

export const TopBar = ({ title }: { title: string }) => {
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight text-ink">candylovable</span>
        <span className="text-sm text-muted">/ {title}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="toggle theme">
        {theme === 'dark' ? '☾ Dark' : '☀ Light'}
      </Button>
    </header>
  )
}
