import { describe, expect, it } from 'vitest'

import { makeCoachContext, makeCoachMessage } from '@/domain'
import type { CoachContext } from '@/domain'

import { createMockCoach } from './mock-coach'
import { isCoachError, type CoachDelta } from './port'

const CONTEXT = makeCoachContext({ spoilerGuard: false })

function ask(text: string) {
  return [makeCoachMessage({ role: 'user', text })]
}

async function drain(
  iterable: AsyncIterable<CoachDelta>,
): Promise<{ text: string; deltas: CoachDelta[] }> {
  const deltas: CoachDelta[] = []
  for await (const delta of iterable) deltas.push(delta)
  return {
    text: deltas.reduce((acc, delta) => (delta.kind === 'text' ? acc + delta.text : acc), ''),
    deltas,
  }
}

describe('createMockCoach', () => {
  const coach = createMockCoach({ thinkingMs: 0, chunkMs: 0 })

  it('streams a scripted reply in chunks that rebuild the whole text', async () => {
    const { text, deltas } = await drain(
      coach.send(ask('Why do I lose to knight tricks?'), CONTEXT, {
        signal: new AbortController().signal,
      }),
    )
    expect(deltas.filter((delta) => delta.kind === 'text').length).toBeGreaterThan(5)
    expect(text).toContain('knight-jump away from your king')
  })

  it('pins the attachment, the quick replies and the usage at the end', async () => {
    const { deltas } = await drain(
      coach.send(ask('Why do I lose to knight tricks?'), CONTEXT, {
        signal: new AbortController().signal,
      }),
    )
    expect(deltas.some((delta) => delta.kind === 'attachment')).toBe(true)
    expect(deltas.some((delta) => delta.kind === 'quickReplies')).toBe(true)
    expect(deltas[deltas.length - 1]?.kind).toBe('usage')
  })

  it('answers differently when the no-spoilers toggle is on', async () => {
    const question = ask('Just tell me the answer')
    const open = await drain(
      coach.send(question, CONTEXT, { signal: new AbortController().signal }),
    )
    const guarded = await drain(
      coach.send(question, { ...CONTEXT, spoilerGuard: true } satisfies CoachContext, {
        signal: new AbortController().signal,
      }),
    )
    expect(open.text).toContain('rook lift')
    expect(guarded.text).not.toContain('rook lift')
    expect(guarded.text).toContain('spoiler-free')
  })

  it('stops producing deltas once the signal aborts', async () => {
    const controller = new AbortController()
    const received: CoachDelta[] = []
    for await (const delta of coach.send(ask('Tell me about the Italian'), CONTEXT, {
      signal: controller.signal,
    })) {
      received.push(delta)
      if (received.length === 3) controller.abort()
    }
    expect(received).toHaveLength(3)
  })

  it('throws a readable CoachError for a scripted failure', async () => {
    const failing = createMockCoach({
      thinkingMs: 0,
      script: [{ text: '', failWith: 'Sage could not reach your provider just now.' }],
    })
    const run = drain(failing.send(ask('hello'), CONTEXT, { signal: new AbortController().signal }))
    await expect(run).rejects.toSatisfy(isCoachError)
  })
})
