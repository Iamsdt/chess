import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DesktopOnlyGate } from './desktop-only-gate'

function setWidth(width: number): void {
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    window.dispatchEvent(new Event('resize'))
  })
}

describe('DesktopOnlyGate', () => {
  afterEach(() => {
    setWidth(1024)
  })

  it('shows the funny refusal on a phone and hides the app', () => {
    setWidth(390)
    render(
      <DesktopOnlyGate>
        <p>the app</p>
      </DesktopOnlyGate>,
    )
    expect(screen.getByRole('heading', { name: /too big for your pocket/i })).toBeVisible()
    expect(screen.queryByText('the app')).toBeNull()
  })

  it('lets a tablet in at exactly 768px', () => {
    setWidth(768)
    render(
      <DesktopOnlyGate>
        <p>the app</p>
      </DesktopOnlyGate>,
    )
    expect(screen.getByText('the app')).toBeVisible()
  })

  it('swaps when the window is resized across the line', () => {
    setWidth(1280)
    render(
      <DesktopOnlyGate>
        <p>the app</p>
      </DesktopOnlyGate>,
    )
    setWidth(767)
    expect(screen.queryByText('the app')).toBeNull()
    setWidth(900)
    expect(screen.getByText('the app')).toBeVisible()
  })
})
