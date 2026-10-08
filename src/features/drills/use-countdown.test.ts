import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatClock, remainingSeconds, useCountdown } from './use-countdown'
import { useRound } from './use-round'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('clock arithmetic', () => {
  it('rounds up so the clock reads 0:01 until it is truly over', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10)
    expect(remainingSeconds(10_000, 9_001)).toBe(1)
    expect(remainingSeconds(10_000, 10_000)).toBe(0)
    expect(remainingSeconds(10_000, 12_000)).toBe(0)
  })

  it('formats as m:ss', () => {
    expect(formatClock(60)).toBe('1:00')
    expect(formatClock(59)).toBe('0:59')
    expect(formatClock(5)).toBe('0:05')
    expect(formatClock(-3)).toBe('0:00')
    expect(formatClock(125)).toBe('2:05')
  })
})

describe('useCountdown', () => {
  it('waits to be started', () => {
    const { result } = renderHook(() => useCountdown(60))
    expect(result.current.status).toBe('idle')
    expect(result.current.remaining).toBe(60)
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(result.current.remaining).toBe(60)
  })

  it('counts down in real seconds and expires exactly once', () => {
    const onExpire = vi.fn()
    const { result } = renderHook(() => useCountdown(3, onExpire))
    act(() => {
      result.current.start()
    })
    expect(result.current.status).toBe('running')

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(result.current.remaining).toBe(2)

    act(() => {
      vi.advanceTimersByTime(1_800)
    })
    expect(result.current.remaining).toBe(1)
    expect(onExpire).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.remaining).toBe(0)
    expect(result.current.status).toBe('expired')
    expect(onExpire).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('follows the wall clock when timers are throttled', () => {
    const { result } = renderHook(() => useCountdown(60))
    act(() => {
      result.current.start()
    })
    // A background tab fires one late tick; the clock still shows the real time left.
    act(() => {
      vi.setSystemTime(Date.now() + 45_000)
      vi.advanceTimersByTime(200)
    })
    expect(result.current.remaining).toBe(15)
  })

  it('can be reset and started again', () => {
    const { result } = renderHook(() => useCountdown(5))
    act(() => {
      result.current.start()
    })
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.remaining).toBe(5)
  })
})

describe('useRound', () => {
  it('scores only while the clock runs and reports the final score once', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useRound(10, 4, onComplete))

    act(() => {
      result.current.point()
    })
    expect(result.current.score).toBe(0)

    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.point()
      result.current.point()
    })
    act(() => {
      result.current.miss()
    })
    expect(result.current.score).toBe(2)
    expect(result.current.streak).toBe(0)

    act(() => {
      result.current.point()
    })
    expect(result.current.streak).toBe(1)

    act(() => {
      vi.advanceTimersByTime(10_400)
    })
    expect(result.current.status).toBe('expired')
    expect(onComplete).toHaveBeenCalledExactlyOnceWith(3)

    act(() => {
      result.current.point()
    })
    expect(result.current.score).toBe(3)
    expect(result.current.bestBefore).toBe(4)
  })

  it('starts a new round from zero', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useRound(5, 0, onComplete))
    act(() => {
      result.current.start()
    })
    act(() => {
      result.current.point()
    })
    act(() => {
      vi.advanceTimersByTime(5_400)
    })
    act(() => {
      result.current.start()
    })
    expect(result.current.score).toBe(0)
    expect(result.current.status).toBe('running')
    act(() => {
      vi.advanceTimersByTime(5_400)
    })
    expect(onComplete).toHaveBeenLastCalledWith(0)
  })
})
