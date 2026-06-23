import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge, Button, Card, Input, Skeleton } from './index'

describe('Button', () => {
  it('renders a button with an accessible name and default type', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('fires onClick, but not when disabled', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1) // unchanged
  })

  it('reflects the variant in its classes', () => {
    render(<Button variant="gradient">G</Button>)
    expect(screen.getByRole('button').className).toContain('accent-gradient')
  })

  it('asChild renders the child element (composition), not a nested button', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Link' })
    expect(link).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('forwards its ref', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>R</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})

describe('Input', () => {
  it('is controllable and forwards a ref', () => {
    const onChange = vi.fn()
    const ref = createRef<HTMLInputElement>()
    render(<Input ref={ref} value="hi" onChange={onChange} placeholder="type…" />)
    const input = screen.getByPlaceholderText('type…')
    expect(input).toHaveValue('hi')
    fireEvent.change(input, { target: { value: 'hey' } })
    expect(onChange).toHaveBeenCalled()
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})

describe('Card', () => {
  it('renders children', () => {
    render(<Card>inside</Card>)
    expect(screen.getByText('inside')).toBeInTheDocument()
  })
})

describe('Skeleton', () => {
  it('is decorative (aria-hidden) and pulses', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    const el = container.firstElementChild
    expect(el).toHaveAttribute('aria-hidden', 'true')
    expect(el?.className).toContain('animate-pulse')
  })
})

describe('Badge', () => {
  it('renders its label and tone', () => {
    render(<Badge tone="success">Ready</Badge>)
    const badge = screen.getByText('Ready')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-success')
  })
})
