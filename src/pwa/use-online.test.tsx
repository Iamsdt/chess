import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OnlineOnlyNotice } from './online-only-notice'
import { useOnline } from './use-online'

function setOnLine(value: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useOnline', () => {
  it('follows the online and offline events', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)
    act(() => {
      setOnLine(false)
    })
    expect(result.current).toBe(false)
    act(() => {
      setOnLine(true)
    })
    expect(result.current).toBe(true)
  })

  it('stops listening on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    renderHook(() => useOnline()).unmount()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})

describe('OnlineOnlyNotice', () => {
  it('renders nothing online and names the feature offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    render(<OnlineOnlyNotice feature="The explorer" />)
    expect(screen.queryByRole('status')).toBeNull()
    act(() => {
      setOnLine(false)
    })
    expect(screen.getByRole('status')).toHaveTextContent('The explorer needs a connection')
  })
})
