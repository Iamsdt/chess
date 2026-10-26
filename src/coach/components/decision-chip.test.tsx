import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ok, type CoachDecision } from '@/domain'

import { DecisionChip } from './decision-chip'

beforeAll(() => {
  // Radix switches measure themselves; jsdom has no layout.
  globalThis.ResizeObserver = class implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom.
    }
    unobserve(): void {
      // See above.
    }
    disconnect(): void {
      // See above.
    }
  }
})

const decision: CoachDecision = {
  logId: 'dec_1',
  modelId: 'minilm-l6-prototype@1',
  latencyMs: 14.2,
  mode: {
    label: 'grandmaster',
    prob: 0.87,
    probs: { grandmaster: 0.87, teacher: 0.05, tutor: 0.03, 'open-qa': 0.05 },
  },
  flags: {
    needs_engine: 0.91,
    wants_solution: 0.12,
    needs_board: 0.7,
    about_history: 0.05,
    off_topic: 0.02,
    deep_answer: 0.66,
  },
}

describe('DecisionChip', () => {
  it('summarises what was decided, how sure, and how fast', () => {
    render(<DecisionChip decision={decision} />)
    expect(
      screen.getByRole('button', { name: 'Decided locally · Grandmaster 87% · 14 ms' }),
    ).toBeInTheDocument()
  })

  it('says it was unsure when the mode did not reach the bar', () => {
    render(
      <DecisionChip
        decision={{ ...decision, mode: { ...decision.mode, label: 'tutor', prob: 0.31 } }}
      />,
    )
    expect(screen.getByRole('button', { name: /unsure \(Tutor 31%\)/ })).toBeInTheDocument()
  })

  it('opens a dialog with a bar for every question', async () => {
    const user = userEvent.setup()
    render(<DecisionChip decision={decision} />)
    await user.click(screen.getByRole('button', { name: /Decided locally/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Decided on your device' })
    expect(within(dialog).getByRole('meter', { name: 'Grandmaster' })).toHaveAttribute(
      'aria-valuenow',
      '87',
    )
    expect(within(dialog).getByRole('meter', { name: 'Needs engine' })).toHaveAttribute(
      'aria-valuenow',
      '91',
    )
    expect(within(dialog).getAllByRole('meter')).toHaveLength(7 + 6)
    const results = await axe(dialog, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('saves a correction: the right mode and every flag, keyboard reachable', async () => {
    const user = userEvent.setup()
    const onCorrect = vi.fn(() => Promise.resolve(ok(undefined)))
    render(<DecisionChip decision={decision} onCorrect={onCorrect} />)
    await user.click(screen.getByRole('button', { name: /Decided locally/ }))
    await user.click(await screen.findByRole('button', { name: 'Correct this' }))

    const form = screen.getByRole('form', { name: 'Correct this decision' })
    await user.selectOptions(within(form).getByLabelText('Right mode'), 'puzzle-nudger')
    // Starts from the model's own answer.
    expect(within(form).getByRole('switch', { name: /Needs engine/ })).toBeChecked()
    expect(within(form).getByRole('switch', { name: /Wants the answer/ })).not.toBeChecked()
    await user.click(within(form).getByRole('switch', { name: /Needs engine/ }))
    await user.click(within(form).getByRole('switch', { name: /Wants the answer/ }))
    await user.click(within(form).getByRole('button', { name: 'Save correction' }))

    await waitFor(() => {
      expect(onCorrect).toHaveBeenCalledWith('dec_1', {
        mode: 'puzzle-nudger',
        needs_engine: 0,
        wants_solution: 1,
        needs_board: 1,
        about_history: 0,
        off_topic: 0,
        deep_answer: 1,
      })
    })
    expect(await within(form).findByRole('status')).toHaveTextContent('Saved')
  })

  it('reports a failed save instead of pretending', async () => {
    const user = userEvent.setup()
    const onCorrect = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'io' as const, message: 'full', where: 'test' },
      }),
    )
    render(<DecisionChip decision={decision} onCorrect={onCorrect} />)
    await user.click(screen.getByRole('button', { name: /Decided locally/ }))
    await user.click(await screen.findByRole('button', { name: 'Correct this' }))
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByText('Could not save that correction.')).toBeInTheDocument()
  })

  it('offers no correction when the decision was not logged', async () => {
    const user = userEvent.setup()
    const { logId: _logId, ...unlogged } = decision
    render(<DecisionChip decision={unlogged} />)
    await user.click(screen.getByRole('button', { name: /Decided locally/ }))
    expect(await screen.findByText(/Logging is off/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Correct this' })).not.toBeInTheDocument()
  })
})
