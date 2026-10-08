import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { LINE_CARD } from '../fixtures/board-fixtures'

import { SageBoardCard } from './sage-board-card'

describe('SageBoardCard', () => {
  it('opens Sage board, steps forward, and closes back to the chat', async () => {
    const user = userEvent.setup()
    render(<SageBoardCard attachment={LINE_CARD} />)

    // Closed: only the card is on screen.
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: /open the giuoco/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Black develops/i)).toBeInTheDocument()
    expect(within(dialog).getByText('Step 1 of 7')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Next step' }))
    expect(within(dialog).getByText('Step 2 of 7')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Black develops/i)).toBeNull()
    expect(within(dialog).getByText(/d3 guards e4/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Back to my game' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    // The card stays, and reopening starts again from the first step.
    await user.click(screen.getByRole('button', { name: /open the giuoco/i }))
    expect(await screen.findByText('Step 1 of 7')).toBeInTheDocument()
  })
})
