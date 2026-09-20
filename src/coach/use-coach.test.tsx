import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { makeCoachContext } from '@/domain'

import { CoachError, type CoachDelta, type CoachPort } from './port'
import { useCoach } from './use-coach'

const CONTEXT = makeCoachContext()

/** A port whose stream can be watched and interrupted, which is the whole point. */
function slowPort(chunks: readonly string[], gapMs = 5) {
  // Gaps are wide enough that `waitFor`'s 50ms poll lands between two chunks.
  const seen = { aborted: false, released: 0 }
  const port: CoachPort = {
    send(_messages, _context, { signal }) {
      return (async function* (): AsyncGenerator<CoachDelta> {
        try {
          for (const text of chunks) {
            if (signal.aborted) return
            yield { kind: 'text', text }
            await new Promise((resolve) => setTimeout(resolve, gapMs))
          }
        } finally {
          seen.aborted = signal.aborted
          seen.released += 1
        }
      })()
    },
  }
  return { port, seen }
}

function failingPort(message: string, failures: number) {
  let calls = 0
  const port: CoachPort = {
    send() {
      calls += 1
      const shouldFail = calls <= failures
      return (async function* (): AsyncGenerator<CoachDelta> {
        await Promise.resolve()
        if (shouldFail) throw new CoachError(message)
        yield { kind: 'text', text: 'Second time lucky.' }
      })()
    },
  }
  return port
}

describe('useCoach', () => {
  it('renders a streamed reply token by token and settles', async () => {
    const { port } = slowPort(['Look ', 'for ', 'checks.'])
    const { result } = renderHook(() => useCoach({ port, context: CONTEXT }))

    act(() => {
      result.current.send('What should I look at?')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]?.role).toBe('user')
    expect(result.current.status).toBe('thinking')

    await waitFor(() => {
      expect(result.current.status).toBe('idle')
    })
    expect(result.current.messages[1]?.text).toBe('Look for checks.')
    expect(result.current.messages[1]?.status).toBe('complete')
  })

  it('ignores an empty draft', () => {
    const { port } = slowPort(['x'])
    const { result } = renderHook(() => useCoach({ port, context: CONTEXT }))
    act(() => {
      result.current.send('   ')
    })
    expect(result.current.messages).toHaveLength(0)
  })

  it('cancel aborts the stream and keeps what already arrived', async () => {
    const { port, seen } = slowPort(['one ', 'two ', 'three ', 'four'], 150)
    const { result } = renderHook(() => useCoach({ port, context: CONTEXT }))

    act(() => {
      result.current.send('go')
    })
    await waitFor(() => {
      expect(result.current.messages[1]?.text).toBe('one ')
    })

    act(() => {
      result.current.cancel()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('idle')
    })
    expect(seen.aborted).toBe(true)
    expect(seen.released).toBe(1)
    expect(result.current.messages[1]?.text).not.toContain('four')
    // Stopping is a choice, not a failure: no error state, nothing to retry.
    expect(result.current.error).toBeNull()
    expect(result.current.messages[1]?.status).toBe('complete')
  })

  it('aborts the stream when the panel unmounts', async () => {
    const { port, seen } = slowPort(['a ', 'b ', 'c'], 150)
    const { result, unmount } = renderHook(() => useCoach({ port, context: CONTEXT }))
    act(() => {
      result.current.send('go')
    })
    await waitFor(() => {
      expect(result.current.messages[1]?.text).toBe('a ')
    })
    unmount()
    await waitFor(() => {
      expect(seen.aborted).toBe(true)
    })
  })

  it('surfaces a readable failure and recovers on retry', async () => {
    const port = failingPort('Your key was refused.', 1)
    const { result } = renderHook(() => useCoach({ port, context: CONTEXT }))

    act(() => {
      result.current.send('hello')
    })
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    expect(result.current.error).toBe('Your key was refused.')
    expect(result.current.messages[1]?.status).toBe('error')
    expect(result.current.canRetry).toBe(true)

    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.status).toBe('idle')
    })
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]?.text).toBe('Second time lucky.')
  })

  it('refuses a malformed delta rather than trusting it', async () => {
    const port: CoachPort = {
      send() {
        return (async function* (): AsyncGenerator<CoachDelta> {
          await Promise.resolve()
          // A provider adapter that got its own contract wrong.
          yield { kind: 'text' } as unknown as CoachDelta
        })()
      },
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useCoach({ port, context: CONTEXT }))
    act(() => {
      result.current.send('hello')
    })
    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
    consoleError.mockRestore()
  })

  it('starts a new thread, greets, and keeps the old one in history', async () => {
    const { port } = slowPort(['ok'])
    const { result } = renderHook(() => useCoach({ port, context: CONTEXT }))
    act(() => {
      result.current.send('first question')
    })
    await waitFor(() => {
      expect(result.current.status).toBe('idle')
    })
    const firstThread = result.current.threadId

    act(() => {
      result.current.newThread()
    })
    expect(result.current.threadId).not.toBe(firstThread)
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.threads.map((thread) => thread.id)).toContain(firstThread)

    act(() => {
      result.current.openThread(firstThread)
    })
    expect(result.current.threadId).toBe(firstThread)
    expect(result.current.messages[0]?.text).toBe('first question')
  })
})
