import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { toFen } from '@/domain'
import type { ActionAttachment, HintsAttachment, ThinkingAttachment } from '@/domain'

import { ActionCard } from './action-card'
import { HintsCard } from './hints-card'
import { ThinkingCard } from './thinking-card'
import { ToolChips } from './tool-chips'

const START = toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')

describe('ToolChips', () => {
  it('collapses several tools into one disclosure', async () => {
    const user = userEvent.setup()
    const tool = (name: string) => ({
      kind: 'tool' as const,
      name,
      summary: 'ok',
      status: 'done' as const,
    })
    render(<ToolChips tools={[tool('analysePosition'), tool('playLine'), tool('positionFacts')]} />)
    expect(screen.queryByText('playLine')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /3 tools used/ }))
    expect(screen.getByText('playLine')).toBeInTheDocument()
  })
})

describe('ThinkingCard', () => {
  it('opens a step and offers Save to notes on the takeaway', async () => {
    const user = userEvent.setup()
    const attachment: ThinkingAttachment = {
      kind: 'thinking',
      steps: [
        { step: 'assess', title: 'Assess', text: 'Equal.' },
        { step: 'takeaway', title: 'Takeaway', text: 'Check first.' },
      ],
    }
    render(<ThinkingCard attachment={attachment} />)
    expect(screen.getByText('Equal.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Takeaway/ }))
    expect(screen.getByRole('button', { name: /Save to notes/ })).toBeInTheDocument()
  })
})

describe('ActionCard', () => {
  const base: ActionAttachment = {
    kind: 'action',
    action: 'queue-puzzles',
    title: 'Queue',
    items: ['A'],
  }

  it('confirms into a done state', async () => {
    const user = userEvent.setup()
    render(<ActionCard attachment={base} />)
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(screen.getByText('Queued')).toBeInTheDocument()
  })

  it('disables confirm when unavailable', () => {
    render(
      <ActionCard
        attachment={{ ...base, action: 'open-lesson', unavailable: 'Lessons are coming soon' }}
      />,
    )
    expect(screen.getByText('Lessons are coming soon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})

describe('HintsCard', () => {
  it('reveals one level at a time and guards the last', async () => {
    const user = userEvent.setup()
    const attachment: HintsAttachment = {
      kind: 'hints',
      fen: START,
      orientation: 'white',
      levels: [
        { label: 'Nudge', text: 'First.', focus: [], arrows: [] },
        { label: 'Square', text: 'Second.', focus: [], arrows: [] },
        { label: 'Move', text: 'Third.', focus: [], arrows: [] },
      ],
    }
    render(<HintsCard attachment={attachment} />)
    expect(screen.queryByText(/Second\./)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next hint' }))
    expect(screen.getByText(/Second\./)).toBeInTheDocument()
    expect(screen.queryByText(/Third\./)).not.toBeInTheDocument()
    expect(screen.getByText(/Spoiler/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show the move' }))
    expect(screen.getByText(/Third\./)).toBeInTheDocument()
  })
})
