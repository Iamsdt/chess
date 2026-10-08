import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { captureInstallPrompt, useInstallPrompt } from './use-install-prompt'

function promptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  const prompt = vi.fn(() => Promise.resolve())
  return Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) })
}

describe('useInstallPrompt', () => {
  it('holds the browser prompt until asked, then reports the choice', async () => {
    captureInstallPrompt()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(await result.current.install()).toBe(false)

    const event = promptEvent('accepted')
    act(() => {
      window.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(true)
    expect(result.current.canInstall).toBe(true)

    let accepted = false
    await act(async () => {
      accepted = await result.current.install()
    })
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(accepted).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('stops offering the install once the app is installed', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(promptEvent('dismissed'))
    })
    expect(result.current.canInstall).toBe(true)
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.canInstall).toBe(false)
  })
})
