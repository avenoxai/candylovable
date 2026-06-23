import { sampleMatch3 } from '@candylovable/mocks'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetProjectStore, useProjectStore } from '../../store/project'
import { VersionTimeline } from './VersionTimeline'

const variant = (title: string) => ({ ...sampleMatch3, id: title, meta: { ...sampleMatch3.meta, title } })

afterEach(resetProjectStore)

describe('VersionTimeline', () => {
  it('renders nothing with only the initial checkpoint', () => {
    const { container } = render(<VersionTimeline />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists checkpoints and marks the current one', () => {
    act(() => useProjectStore.getState().commit(variant('Spooky'), 'Spooky'))
    render(<VersionTimeline />)
    expect(screen.getByRole('navigation', { name: 'version history' })).toBeInTheDocument()
    const current = screen.getByRole('button', { name: 'Spooky' })
    expect(current).toHaveAttribute('aria-current', 'true')
  })

  it('restores a past checkpoint on click', () => {
    act(() => useProjectStore.getState().commit(variant('Later'), 'Later'))
    render(<VersionTimeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Initial board' }))
    expect(useProjectStore.getState().current).toBe(sampleMatch3)
    expect(screen.getByRole('button', { name: 'Initial board' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
