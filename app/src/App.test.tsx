import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { useUiStore } from './store/ui'

afterEach(() => {
  useUiStore.setState({ theme: 'dark' })
  document.documentElement.removeAttribute('data-theme')
})

describe('App', () => {
  it('renders the builder workspace: brand, chat empty-state, and a preview', () => {
    render(<App />)
    expect(screen.getByText('candylovable')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /describe a puzzle game/i })).toBeInTheDocument()
    expect(screen.getByLabelText('live preview')).toBeInTheDocument()
    expect(screen.getByLabelText('game board')).toBeInTheDocument()
  })
})
