import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { makeCoachContext, makeCoachMessage, toMessageId, toThreadId } from '@/domain'
import type { CoachMessage } from '@/domain'

import { createMockCoach } from '../mock-coach'

import { CoachPanel, type CoachContextBase } from './coach-panel'
import { CoachThread, VIRTUALIZE_AFTER_ROWS } from './coach-thread'

const { spoilerGuard: _guard, allowEngineLines: _engine, ...CONTEXT } = makeCoachContext()
const BASE: CoachContextBase = CONTEXT

const instantMock = () => createMockCoach({ thinkingMs: 0, chunkMs: 0 })

function liveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>('[data-slot="coach-live-region"]')
  if (region === null) throw new Error('the panel must always render its live region')
  return region
}

describe('CoachPanel', () => {
  it('renders a seeded thread with its divider, bubbles, card and quick replies', () => {
    render(<CoachPanel context={BASE} seedScreen="home" port={instantMock()} />)

    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText(/one step from finishing today/)).toBeInTheDocument()
    expect(screen.getByText(/Why do I keep losing to knight tricks/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Black knight on g5/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes, 8 fork puzzles' })).toBeInTheDocument()
    expect(screen.getByText(/Sage sees:/)).toBeInTheDocument()
  })

  it('streams a reply and announces it once, as prose, in the live region', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <CoachPanel context={BASE} seedScreen="puzzle" port={instantMock()} />,
    )

    await user.type(screen.getByLabelText('Message Sage'), 'Why is my knight bad?')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText('Why is my knight bad?')).toBeInTheDocument()

    await waitFor(() => {
      expect(liveRegion(container)).toHaveTextContent(/^Sage said:/)
    })
    // The markers never reach the announcement.
    expect(liveRegion(container).textContent).not.toContain('**')
  })

  it('shows the typing indicator while Sage composes', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <CoachPanel
        context={BASE}
        seedScreen="home"
        port={createMockCoach({ thinkingMs: 400, chunkMs: 0 })}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'What should I work on?' }))
    expect(container.querySelector('[data-slot="coach-typing"]')).not.toBeNull()
    expect(liveRegion(container)).toHaveTextContent('Sage is writing')
    await waitFor(() => {
      expect(container.querySelector('[data-slot="coach-typing"]')).toBeNull()
    })
  })

  it('offers Stop while streaming instead of Send', async () => {
    const user = userEvent.setup()
    render(
      <CoachPanel
        context={BASE}
        seedScreen="home"
        port={createMockCoach({ thinkingMs: 400, chunkMs: 0 })}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Plan my week' }))
    const stop = screen.getByRole('button', { name: 'Stop' })
    await user.click(stop)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    })
  })

  it('renders the bring-your-own-key state with an inert composer', () => {
    const { container } = render(<CoachPanel context={BASE} hasKey={false} />)
    expect(container.querySelector('[data-slot="coach-no-key"]')).not.toBeNull()
    expect(screen.getByText('Needs your API key')).toBeInTheDocument()
    expect(screen.getByLabelText('Message Sage')).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Add API key' })).toBeInTheDocument()
  })

  it('invites a first question when there is no seed', () => {
    render(<CoachPanel context={BASE} port={instantMock()} />)
    expect(screen.getByText('Ask Sage anything')).toBeInTheDocument()
  })

  it('shows a skeleton while the screen works out what Sage can see', () => {
    const { container } = render(<CoachPanel context={BASE} seedScreen="home" loading />)
    expect(container.querySelector('[data-slot="coach-thread-skeleton"]')).not.toBeNull()
  })

  it('offers a calm retry when the port fails', async () => {
    const user = userEvent.setup()
    render(
      <CoachPanel
        context={BASE}
        quickReplies={['Ask anything']}
        port={createMockCoach({
          thinkingMs: 0,
          script: [{ text: '', failWith: 'Sage could not reach your provider just now.' }],
        })}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Ask anything' }))
    await waitFor(() => {
      expect(screen.getByText('Sage could not reach your provider just now.')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })

  it('flips the no-spoilers and engine toggles', async () => {
    const user = userEvent.setup()
    render(<CoachPanel context={BASE} seedScreen="puzzle" port={instantMock()} />)
    const spoilers = screen.getByRole('button', { name: 'No spoilers' })
    const engine = screen.getByRole('button', { name: 'Engine' })
    expect(spoilers).toHaveAttribute('aria-pressed', 'true')
    expect(engine).toHaveAttribute('aria-pressed', 'false')
    await user.click(spoilers)
    await user.click(engine)
    expect(spoilers).toHaveAttribute('aria-pressed', 'false')
    expect(engine).toHaveAttribute('aria-pressed', 'true')
  })

  it('attaches the current position and lets it be removed', async () => {
    const user = userEvent.setup()
    render(
      <CoachPanel
        context={BASE}
        seedScreen="puzzle"
        attachmentLabel="Current position"
        port={instantMock()}
      />,
    )
    expect(screen.getByText(/Current position/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove attachment' }))
    expect(screen.queryByText(/Current position/)).not.toBeInTheDocument()
  })

  it('starts a new chat that greets and clears the thread', async () => {
    const user = userEvent.setup()
    render(<CoachPanel context={BASE} seedScreen="home" port={instantMock()} />)
    await user.click(screen.getByRole('button', { name: 'New chat' }))
    expect(screen.getByText('Fresh start. What are we working on?')).toBeInTheDocument()
    expect(screen.queryByText(/Why do I keep losing to knight tricks/)).not.toBeInTheDocument()
  })

  it('only renders a close button when the shell gives it one', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<CoachPanel context={BASE} port={instantMock()} />)
    expect(screen.queryByRole('button', { name: 'Close chat' })).not.toBeInTheDocument()

    let closed = 0
    rerender(
      <CoachPanel
        context={BASE}
        port={instantMock()}
        onClose={() => {
          closed += 1
        }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Close chat' }))
    expect(closed).toBe(1)
  })

  it('has no axe violations', async () => {
    const { container } = render(
      <CoachPanel context={BASE} seedScreen="review" port={instantMock()} />,
    )
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations).toEqual([])
  })
})

describe('CoachThread', () => {
  function longThread(count: number): readonly CoachMessage[] {
    const threadId = toThreadId('thread-long')
    return Array.from({ length: count }, (_, index) =>
      makeCoachMessage({
        id: toMessageId(`message-long-${String(index)}`),
        threadId,
        role: index % 2 === 0 ? 'user' : 'sage',
        text: `Message number ${String(index)}`,
        attachments: [],
        quickReplies: [],
      }),
    )
  }

  it('renders every row while the thread is short', () => {
    const { container } = render(<CoachThread messages={longThread(10)} status="idle" />)
    const thread = container.querySelector<HTMLElement>('[data-slot="coach-thread"]')
    expect(thread).not.toBeNull()
    expect(within(thread!).getAllByText(/Message number/)).toHaveLength(10)
  })

  it('windows a long thread instead of mounting all of it', () => {
    const count = VIRTUALIZE_AFTER_ROWS * 4
    const { container } = render(<CoachThread messages={longThread(count)} status="idle" />)
    const thread = container.querySelector<HTMLElement>('[data-slot="coach-thread"]')
    expect(within(thread!).queryAllByText(/Message number/).length).toBeLessThan(count)
  })
})
