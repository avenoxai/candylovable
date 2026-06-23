import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CostBadge } from './CostBadge'

describe('CostBadge', () => {
  it('shows the cumulative total when cost is available', async () => {
    render(<CostBadge load={async () => ({ totalUSD: 0.0123, generations: 3, lastUSD: 0.004 })} />)
    expect(await screen.findByText(/≈ \$0\.0123/)).toBeInTheDocument()
  })

  it('renders nothing when cost is unavailable (mock mode / offline)', async () => {
    const { container } = render(<CostBadge load={async () => null} />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('refetches when refreshKey changes', async () => {
    let calls = 0
    const load = async () => {
      calls += 1
      return { totalUSD: 0.001 * calls, generations: calls, lastUSD: 0.001 }
    }
    const { rerender } = render(<CostBadge refreshKey={0} load={load} />)
    expect(await screen.findByText(/≈ \$0\.0010/)).toBeInTheDocument()
    rerender(<CostBadge refreshKey={1} load={load} />)
    expect(await screen.findByText(/≈ \$0\.0020/)).toBeInTheDocument()
  })
})
