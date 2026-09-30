import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { FriendsScreen } from './friends-screen'

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom.
    }
    unobserve(): void {
      // See above.
    }
    disconnect(): void {
      // See above.
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // No viewport in jsdom.
  }
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  })
})

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

function renderFriendsScreen() {
  const rootRoute = createRootRoute()
  const friendsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/friends',
    component: FriendsScreen,
  })
  const liveRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/friends/live',
    component: () => <div>Live Game Screen</div>,
  })
  const shareRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/share',
    component: () => <div>Share Screen</div>,
  })
  const gamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/games',
    component: () => <div>Games Library</div>,
  })

  const routeTree = rootRoute.addChildren([friendsRoute, liveRoute, shareRoute, gamesRoute])
  const history = createMemoryHistory({ initialEntries: ['/friends'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('FriendsScreen', () => {
  it('renders heading with accessible name "Friends" and hero section', async () => {
    renderFriendsScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Friends' })
    expect(heading).toBeInTheDocument()

    expect(screen.getByText('No accounts. Just links.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Send a link. Play a friend.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Invite a friend/i })).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderFriendsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Friends' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('renders active games and handles cancelling invite', async () => {
    renderFriendsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Friends' })

    expect(screen.getByRole('heading', { level: 2, name: 'Active games' })).toBeInTheDocument()
    expect(screen.getByText('Your move vs Rafi')).toBeInTheDocument()
    expect(screen.getByText('Rafi is online now')).toBeInTheDocument()
    expect(screen.getByText('Invite waiting')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    expect(screen.queryByText('Invite waiting')).not.toBeInTheDocument()
    expect(screen.getByText(/No other active invites/i)).toBeInTheDocument()
  })

  it('renders share link options and handles copying links', async () => {
    renderFriendsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Friends' })

    expect(screen.getByRole('heading', { level: 2, name: 'Share a link' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'A position' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'A challenge' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'An annotated game' })).toBeInTheDocument()

    const copyPosBtn = screen.getByRole('button', { name: 'Copy last position' })
    fireEvent.click(copyPosBtn)

    const copyChallengeBtn = screen.getByRole('button', { name: 'Copy challenge' })
    fireEvent.click(copyChallengeBtn)
  })

  it('renders correspondence explainer and recent friends list', async () => {
    renderFriendsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Friends' })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Correspondence, by link' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Recent friends' })).toBeInTheDocument()

    expect(screen.getByText('Rafi')).toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()
    expect(screen.getByText('Tomás')).toBeInTheDocument()

    const inviteRafiBtn = screen.getByRole('button', { name: 'Invite Rafi' })
    fireEvent.click(inviteRafiBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens invite modal, toggles time controls and color', async () => {
    renderFriendsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Friends' })

    const inviteBtn = screen.getByRole('button', { name: /Invite a friend/i })
    fireEvent.click(inviteBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Invite a friend' })).toBeInTheDocument()

    // Select time control
    const tc15 = screen.getByRole('button', { name: '15 + 10' })
    fireEvent.click(tc15)
    expect(tc15).toHaveClass('is-active')

    // Select color
    const blackBtn = screen.getByRole('button', { name: 'Black' })
    fireEvent.click(blackBtn)
    expect(blackBtn).toHaveClass('is-active')

    // QR code is rendered
    expect(screen.getByRole('img', { name: 'QR code for the invite link' })).toBeInTheDocument()
  })
})
