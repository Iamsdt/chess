import 'fake-indexeddb/auto'

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearAllData, puzzlesRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { makePuzzle, toPuzzleId } from '@/domain'

import { PlacementRunner } from './placement-runner'

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is laid out in jsdom.
    }
    unobserve(): void {
      // See above.
    }
    disconnect(): void {
      // See above.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
})

describe('PlacementRunner', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('hands back nothing when there are no puzzles on the device', async () => {
    const onDone = vi.fn()
    render(
      <ThemeProvider>
        <PlacementRunner level="club" onDone={onDone} />
      </ThemeProvider>,
    )
    expect(await screen.findByText(/puzzle set is still loading/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue to Today/i }))
    expect(onDone).toHaveBeenCalledWith(null)
  })

  it('measures a lower rating after a missed puzzle and stops when puzzles run out', async () => {
    await puzzlesRepo.bulkUpsert([makePuzzle()])
    const onDone = vi.fn()
    render(
      <ThemeProvider>
        <PlacementRunner level="club" onDone={onDone} />
      </ThemeProvider>,
    )
    const miss = await screen.findByRole('button', { name: /I don't know this one/i })
    await waitFor(() => {
      expect(miss).toBeEnabled()
    })
    fireEvent.click(miss)
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })
    const rating = onDone.mock.calls[0]?.[0] as { rating: number } | null
    expect(rating?.rating).toBeLessThan(1200)
  })

  it('lets the person skip placement outright', async () => {
    await puzzlesRepo.bulkUpsert([makePuzzle()])
    const onDone = vi.fn()
    render(
      <ThemeProvider>
        <PlacementRunner level="club" onDone={onDone} />
      </ThemeProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Skip placement/i }))
    expect(onDone).toHaveBeenCalledWith(null)
  })

  it('asks five different puzzles, then offers the way to Today with the measured rating', async () => {
    await puzzlesRepo.bulkUpsert(
      Array.from({ length: 8 }, (_, i) =>
        makePuzzle({ id: toPuzzleId(`pl-${String(i)}`), rating: 1100 + i * 20 }),
      ),
    )
    const onDone = vi.fn()
    render(
      <ThemeProvider>
        <PlacementRunner level="club" onDone={onDone} />
      </ThemeProvider>,
    )
    for (let n = 1; n <= 5; n += 1) {
      expect(await screen.findByText(new RegExp(`puzzle ${String(n)} of 5`))).toBeInTheDocument()
      const miss = await screen.findByRole('button', { name: /I don't know this one/i })
      await waitFor(() => {
        expect(miss).toBeEnabled()
      })
      fireEvent.click(miss)
    }
    expect(await screen.findByText('Placement complete')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Go to Today/i }))
    const rating = onDone.mock.calls[0]?.[0] as { rating: number } | null
    expect(rating?.rating).toBeLessThan(1100)
  })
})
