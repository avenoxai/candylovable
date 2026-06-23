import { afterEach, describe, expect, it } from 'vitest'
import { useUiStore } from './ui'

afterEach(() => {
  useUiStore.setState({ theme: 'dark' })
  document.documentElement.removeAttribute('data-theme')
})

describe('useUiStore', () => {
  it('defaults to the warm-dark theme', () => {
    expect(useUiStore.getState().theme).toBe('dark')
  })

  it('toggleTheme flips the theme and reflects it on <html>', () => {
    useUiStore.getState().toggleTheme()
    expect(useUiStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    useUiStore.getState().toggleTheme()
    expect(useUiStore.getState().theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('setTheme sets a specific theme', () => {
    useUiStore.getState().setTheme('light')
    expect(useUiStore.getState().theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
