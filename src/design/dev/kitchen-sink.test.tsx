import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { KitchenSink } from './kitchen-sink'

/** jsdom ships none of the layout APIs Radix needs; the kitchen sink is the only
 *  test that mounts every Radix primitive at once, so the shims live here. */
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // jsdom never lays anything out, so there is nothing to report.
    }
    unobserve(): void {
      // jsdom never lays anything out, so there is nothing to report.
    }
    disconnect(): void {
      // jsdom never lays anything out, so there is nothing to report.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub

  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // No viewport in jsdom.
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
  Element.prototype.setPointerCapture = function setPointerCapture(): void {
    // Pointer capture is meaningless without a real pointer.
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
    // Pointer capture is meaningless without a real pointer.
  }
})
function renderKitchenSink() {
  return render(
    <ThemeProvider>
      <KitchenSink />
    </ThemeProvider>,
  )
}

describe('KitchenSink', () => {
  it('renders a light and a dark copy of the gallery', () => {
    renderKitchenSink()
    expect(screen.getByRole('heading', { level: 1, name: 'Kitchen sink' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Sharpen your eye' })).toHaveLength(2)
    expect(screen.getAllByText('QualityGlyph')).toHaveLength(2)
  })

  it('switches the page theme from the in-page control', async () => {
    const { container } = renderKitchenSink()
    const header = within(container.querySelector('.sticky')!)

    await userEvent.click(header.getByRole('button', { name: 'dark' }))
    expect(document.documentElement).toHaveClass('dark')

    await userEvent.click(header.getByRole('button', { name: 'light' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('switches the board palette from the in-page control', async () => {
    const { container } = renderKitchenSink()
    const header = within(container.querySelector('.sticky')!)

    await userEvent.click(header.getByRole('button', { name: 'walnut' }))
    expect(document.documentElement).toHaveAttribute('data-board', 'walnut')

    await userEvent.click(header.getByRole('button', { name: 'grove' }))
    expect(document.documentElement).not.toHaveAttribute('data-board')
  })

  it('has no axe violations', async () => {
    const { container } = renderKitchenSink()
    // color-contrast needs a real canvas to sample pixels; jsdom has none, so it is
    // checked by eye against the prototype rather than asserted here.
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)
})
