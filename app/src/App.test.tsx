import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('App', () => {
  it('renders the product name and tagline', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /candylovable/i })).toBeInTheDocument()
    expect(screen.getByText(/watch it come to life/i)).toBeInTheDocument()
  })

  it('toggles the theme on the document element', () => {
    render(<App />)
    const btn = screen.getByRole('button', { name: /theme:/i })
    expect(btn).toHaveTextContent(/dark/i)
    fireEvent.click(btn)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(btn).toHaveTextContent(/light/i)
    fireEvent.click(btn)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
