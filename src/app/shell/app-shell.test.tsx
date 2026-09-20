import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { routeTree } from '../routes'

/** jsdom lays nothing out, so the handful of layout APIs the shell's Radix and cmdk
 *  dependencies reach for have to be stubbed before anything renders. */
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
    }
    unobserve(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
    }
    disconnect(): void {
      // Nothing is ever laid out in jsdom, so there is nothing to report.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // No viewport in jsdom.
  }
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {
    // The router restores scroll on navigation; jsdom has nothing to scroll.
  })
})

/** The shell reads `innerWidth` directly, exactly as the prototype's shell.js does. */
function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

async function renderShell(path: string, width: number) {
  setViewport(width)
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const user = userEvent.setup()
  const { container } = render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  await waitFor(() => {
    expect(router.state.status).toBe('idle')
  })
  return { router, user, container }
}

const chatPanel = () => screen.queryByRole('complementary', { name: 'Chat with Sage' })
const askSage = () => screen.queryByRole('button', { name: 'Ask Sage' })

beforeEach(() => {
  localStorage.clear()
})

describe('AppShell layout', () => {
  it('docks the sidebar and the Sage panel at 1440', async () => {
    await renderShell('/', 1440)

    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeVisible()
    expect(chatPanel()).toBeVisible()
    expect(askSage()).not.toBeInTheDocument()
    expect(screen.getByText('Your chess garden')).toBeVisible()
  })

  it('collapses the sidebar to the rail on a board screen at 1440', async () => {
    await renderShell('/analysis', 1440)

    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeVisible()
    expect(screen.queryByText('Your chess garden')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Analysis/ })).toHaveAttribute('aria-current', 'page')
  })

  it('swaps the sidebar for the bottom bar at 390', async () => {
    await renderShell('/', 390)

    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).not.toBeInTheDocument()
    const bar = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(bar).getByRole('link', { name: 'Puzzles' })).toBeVisible()
    expect(within(bar).getByRole('button', { name: 'Sage' })).toBeVisible()
  })

  it('follows the viewport when it changes under the user', async () => {
    await renderShell('/', 1440)
    expect(chatPanel()).toBeVisible()

    act(() => {
      setViewport(1100)
    })
    await waitFor(() => {
      expect(screen.queryByText('Your chess garden')).not.toBeInTheDocument()
    })
  })
})

describe('Sage panel behaviour', () => {
  it('starts closed below 1280 and opens over the page from the FAB', async () => {
    const { user } = await renderShell('/', 1024)

    expect(chatPanel()).not.toBeInTheDocument()
    const fab = askSage()
    expect(fab).toBeVisible()

    await user.click(fab!)
    expect(chatPanel()).toBeVisible()
    await waitFor(() => {
      expect(chatPanel()).toHaveFocus()
    })
  })

  it('closes the overlay on Escape and hands focus back to the FAB', async () => {
    const { user } = await renderShell('/', 1024)
    await user.click(askSage()!)
    expect(chatPanel()).toBeVisible()

    await user.keyboard('{Escape}')

    expect(chatPanel()).not.toBeInTheDocument()
    await waitFor(() => {
      expect(askSage()).toHaveFocus()
    })
  })

  it('obeys a screen that asks to start closed even on a wide viewport', async () => {
    await renderShell('/friends/live', 1600)
    expect(chatPanel()).not.toBeInTheDocument()
    expect(askSage()).toBeVisible()
  })

  it('remembers the panel preference only from docked widths', async () => {
    const { user } = await renderShell('/', 1440)
    await user.click(await screen.findByRole('button', { name: 'Close chat' }))

    expect(chatPanel()).not.toBeInTheDocument()
    expect(localStorage.getItem('ck-chat')).toBe('closed')
  })

  it('shows the screen context and the attachment the screen declares', async () => {
    await renderShell('/puzzles/solve', 1600)

    expect(await screen.findByText(/Sage sees: puzzle 4 of 10/)).toBeVisible()
    expect(await screen.findByText(/Attached: Puzzle 4 of 10/)).toBeVisible()
  })

  it('shows the screen note where the prototype pauses the panel', async () => {
    const { user } = await renderShell('/friends/live', 1600)
    await user.click(screen.getByRole('button', { name: 'Ask Sage' }))

    expect(await screen.findByText(/Fair play: Sage is paused during live games/)).toBeVisible()
  })

  it('asks the question when a quick reply is chosen', async () => {
    const { user } = await renderShell('/', 1440)

    await user.click(screen.getByRole('button', { name: 'Plan my week' }))

    // S09's panel sends a quick reply rather than loading it into the composer, so the
    // question lands in the thread and the composer stays empty for the next one.
    const thread = document.querySelector('[data-slot="coach-thread"]')
    expect(thread).not.toBeNull()
    await waitFor(() => {
      expect(thread?.textContent).toContain('Plan my week')
    })
    expect(screen.getByLabelText('Message Sage')).toHaveValue('')
  })
})

describe('keyboard layer', () => {
  it('opens the panel and focuses the composer on "/"', async () => {
    const { user } = await renderShell('/', 1024)
    expect(chatPanel()).not.toBeInTheDocument()

    await user.keyboard('/')

    expect(chatPanel()).toBeVisible()
    await waitFor(() => {
      expect(screen.getByLabelText('Message Sage')).toHaveFocus()
    })
  })

  it('leaves "/" alone while the user is writing', async () => {
    const { user } = await renderShell('/', 1440)
    const composer = screen.getByLabelText('Message Sage')

    await user.click(composer)
    await user.keyboard('1/2')

    expect(composer).toHaveValue('1/2')
  })

  it('navigates on the "g" chord', async () => {
    const { user, router } = await renderShell('/', 1440)

    await user.keyboard('gz')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/puzzles')
    })
  })

  it('forgets a "g" that is not followed by a destination', async () => {
    const { user, router } = await renderShell('/', 1440)

    await user.keyboard('gq')
    await user.keyboard('z')

    expect(router.state.location.pathname).toBe('/')
  })

  it('opens the command palette on ⌘K and navigates from it', async () => {
    const { user, router } = await renderShell('/', 1440)

    await user.keyboard('{Meta>}k{/Meta}')
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' })
    await user.click(within(dialog).getByText('Openings'))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/openings')
    })
  })
})

describe('accessibility', () => {
  it('has no axe violations with the panel docked', async () => {
    const { container } = await renderShell('/', 1440)
    // color-contrast needs real pixels to sample; jsdom has none, so it is checked by
    // eye against the prototype rather than asserted here.
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)

  it('has no axe violations on the mobile frame', async () => {
    const { container } = await renderShell('/puzzles', 390)
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  }, 30_000)
})
