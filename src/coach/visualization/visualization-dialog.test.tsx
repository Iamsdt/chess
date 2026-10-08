import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'

import { FOLLOW_LINE_CARD } from '@/coach/fixtures/visualization-fixtures'
import { ThemeProvider } from '@/design'
import { installBoardShims } from '@/features/drills/test-support'

import { VisualizationCard } from './visualization-card'
import { VisualizationDialog } from './visualization-dialog'

beforeAll(() => {
  installBoardShims()
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

describe('follow the line', () => {
  it('reads the line, marks a wrong answer, shows the slip and lets the user peek', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <VisualizationCard attachment={FOLLOW_LINE_CARD} />
      </ThemeProvider>,
    )
    expect(screen.getByText(/Level 2/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    const dialog = await screen.findByRole('dialog')
    // The question appears once the line has been read; the key never does.
    await user.click(within(dialog).getByRole('button', { name: /skip to the question/i }))
    const input = await within(dialog).findByLabelText(/where is the white bishop/i)
    expect(dialog.textContent).not.toMatch(/\ba4\b/)

    await user.type(input, 'b5')
    await user.click(within(dialog).getByRole('button', { name: 'Answer' }))

    expect(await within(dialog).findByText('Not quite.')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/went from b5 to a4 on move 4; you left it on b5/),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Peek' }))
    expect(
      await within(dialog).findByText('Peek: the real position', { selector: 'p' }),
    ).toBeInTheDocument()
    // After the peek the board hides again.
    await waitFor(
      () => {
        expect(within(dialog).queryByText('Peek: the real position', { selector: 'p' })).toBeNull()
      },
      { timeout: 4000 },
    )
  })
})

describe('ladder mode', () => {
  it('opens on the first of five exercises', async () => {
    render(
      <ThemeProvider>
        <VisualizationDialog mode="ladder" open onOpenChange={() => undefined} />
      </ThemeProvider>,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Train with Sage' })
    expect(within(dialog).getByText(/Exercise 1 of 5/)).toBeInTheDocument()
  })
})
