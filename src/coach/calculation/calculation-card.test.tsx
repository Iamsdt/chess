import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/design'

import { CALCULATION_CARD } from '../fixtures/calculation-fixtures'

import { CalculationCard } from './calculation-card'
import { reviewAttempt } from './test-me-model'

import type { ReactNode } from 'react'

// The dialog links to /analysis and /play; the router itself is not under test here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

describe('CalculationCard', () => {
  it('opens Explore, selects a node and switches to Test me', () => {
    render(
      <ThemeProvider>
        <CalculationCard attachment={CALCULATION_CARD} />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open full screen' }))

    const graph = document.querySelector<HTMLElement>('[data-slot="calc-tree-graph"]')
    expect(graph).not.toBeNull()
    fireEvent.click(within(graph!).getByRole('button', { name: /^6…exd4/ }))
    expect(screen.getAllByText(/6…exd4/).length).toBeGreaterThan(0)

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Test me' }))
    expect(screen.getByRole('heading', { name: 'What would you consider?' })).toBeTruthy()
  })
})

describe('reviewAttempt', () => {
  it('rewards the best move and flags the tempting trap', () => {
    const picks = [
      { first: 'd4', reply: 'exd4', follow: 'O-O', verdict: 'equal' as const },
      { first: 'Nxf7', reply: 'Kxf7', follow: 'Qf3+', verdict: 'winning' as const },
    ]
    const review = reviewAttempt(CALCULATION_CARD, CALCULATION_CARD.fen, picks, 0)
    expect(review.foundBest).toBe(true)
    expect(review.picks[1]?.tempting).toBe(true)
    expect(review.picks[1]?.verdictRight).toBe(false)
    expect(review.missed.map((n) => n.san)).toEqual(['Nc3', 'O-O'])
    expect(review.score).toBeGreaterThan(50)
  })
})
