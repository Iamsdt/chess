import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CHORD_TIMEOUT_MS, useShellShortcuts } from './use-shell-shortcuts'

function setup() {
  const handlers = {
    onFocusChat: vi.fn(),
    onEscape: vi.fn(),
    onTogglePalette: vi.fn(),
    onNavigate: vi.fn(),
  }
  renderHook(() => {
    useShellShortcuts(handlers)
  })
  return handlers
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
  })
}

describe('useShellShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps the single-key shortcuts', () => {
    const handlers = setup()

    press('/')
    expect(handlers.onFocusChat).toHaveBeenCalledTimes(1)

    press('Escape')
    expect(handlers.onEscape).toHaveBeenCalledTimes(1)

    press('k', { metaKey: true })
    press('k', { ctrlKey: true })
    expect(handlers.onTogglePalette).toHaveBeenCalledTimes(2)
  })

  it('navigates on a completed chord', () => {
    const handlers = setup()

    press('g')
    press('h')

    expect(handlers.onNavigate).toHaveBeenCalledWith('today')
  })

  it('disarms the chord after the timeout, so a stray "g" costs nothing', () => {
    const handlers = setup()

    press('g')
    act(() => {
      vi.advanceTimersByTime(CHORD_TIMEOUT_MS + 1)
    })
    press('h')

    expect(handlers.onNavigate).not.toHaveBeenCalled()
  })

  it('disarms the chord on a letter that means nothing', () => {
    const handlers = setup()

    press('g')
    press('q')
    press('h')

    expect(handlers.onNavigate).not.toHaveBeenCalled()
  })

  it('stays out of the way while the user is writing', () => {
    const handlers = setup()
    const input = document.createElement('textarea')
    document.body.append(input)

    press('/', {}, input)
    press('g', {}, input)
    press('h', {}, input)

    expect(handlers.onFocusChat).not.toHaveBeenCalled()
    expect(handlers.onNavigate).not.toHaveBeenCalled()

    // Escape still works there: it is how the user leaves.
    press('Escape', {}, input)
    expect(handlers.onEscape).toHaveBeenCalledTimes(1)

    input.remove()
  })

  it('ignores a letter that arrives with a modifier', () => {
    const handlers = setup()

    press('g', { altKey: true })
    press('h')

    expect(handlers.onNavigate).not.toHaveBeenCalled()
  })
})
