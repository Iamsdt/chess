import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useReducedMotion } from './use-reduced-motion'

type Listener = () => void

function installMatchMedia(matches: boolean) {
  const listeners: Listener[] = []
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        media: query,
        matches,
        onchange: null,
        addEventListener: (_: string, listener: Listener) => listeners.push(listener),
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
  return listeners
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReducedMotion', () => {
  it('assumes full motion where the query cannot be asked', () => {
    // jsdom has no `matchMedia`, which is also the case in old embedded webviews.
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false)
  })

  it('reports the system preference', () => {
    installMatchMedia(true)
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true)
  })

  it('re-renders when the preference changes mid-session', () => {
    let matches = false
    const listeners = installMatchMedia(matches)
    const { result, rerender } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)

    matches = true
    installMatchMedia(matches)
    act(() => {
      for (const listener of listeners) listener()
    })
    rerender()

    expect(result.current).toBe(true)
  })
})
