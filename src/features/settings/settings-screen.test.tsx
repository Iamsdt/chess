import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { clearAllData, profileRepo, settingsRepo } from '@/data'
import { ThemeProvider } from '@/design'

import { SettingsScreen } from './settings-screen'

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
})

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

function renderSettingsScreen() {
  const rootRoute = createRootRoute()
  const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: SettingsScreen,
  })
  const onboardingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/onboarding',
    component: () => <div>Onboarding Screen</div>,
  })

  const routeTree = rootRoute.addChildren([settingsRoute, onboardingRoute])
  const history = createMemoryHistory({ initialEntries: ['/settings'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('SettingsScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    localStorage.clear()
  })

  it('renders heading with accessible name "Settings"', async () => {
    renderSettingsScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(heading).toBeInTheDocument()

    expect(
      screen.getByText('Everything saves automatically, on this device only'),
    ).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('saves the profile: name on blur and level on change, creating the profile if needed', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    const nameInput = screen.getByLabelText('Display name')
    fireEvent.change(nameInput, { target: { value: 'Magnus' } })
    fireEvent.blur(nameInput)
    await waitFor(async () => {
      expect((await profileRepo.get())?.displayName).toBe('Magnus')
    })

    fireEvent.change(screen.getByLabelText('Your level'), { target: { value: 'strong' } })
    await waitFor(async () => {
      expect((await profileRepo.get())?.skillLevel).toBe('strong')
    })
    expect(screen.getByLabelText('Your level')).toHaveValue('strong')
  })

  it('persists the daily goal and the reminder', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    fireEvent.click(screen.getByRole('button', { name: '30 min' }))
    fireEvent.change(screen.getByLabelText('Daily reminder'), { target: { value: '21:30' } })
    await waitFor(async () => {
      const saved = await settingsRepo.peek()
      expect(saved?.dailyGoalMinutes).toBe(30)
      expect(saved?.reminderTime).toBe('21:30')
    })
    expect(screen.getByRole('button', { name: '30 min' })).toHaveClass('is-active')
  })

  it('applies the look at once and keeps it in the database', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Walnut' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Staunty' }))
    fireEvent.click(screen.getByRole('button', { name: 'Slow' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.dataset.board).toBe('walnut')
    expect(screen.getByRole('radio', { name: 'Walnut' })).toHaveAttribute('aria-checked', 'true')

    await waitFor(async () => {
      const saved = await settingsRepo.peek()
      expect(saved?.theme).toBe('dark')
      expect(saved?.board.theme).toBe('walnut')
      expect(saved?.board.pieceSet).toBe('staunty')
      expect(saved?.board.animation).toBe('slow')
    })
    expect(
      screen.getByRole('img', { name: 'Preview board: Italian Game after 6...O-O' }),
    ).toBeInTheDocument()
  })

  it('keeps two quick board toggles instead of letting the second overwrite the first', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    fireEvent.click(screen.getByLabelText('Premoves'))
    fireEvent.click(screen.getByLabelText('Coordinates'))
    await waitFor(async () => {
      const saved = await settingsRepo.peek()
      expect(saved?.board.premoves).toBe(true)
      expect(saved?.board.coordinates).toBe(false)
    })
  })

  it('persists coach preferences and never shows a made-up key', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    const keyInput = screen.getByLabelText('API key')
    expect(keyInput).toBeDisabled()
    expect(keyInput).toHaveValue('')
    expect(screen.getByText('No key yet')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Blunt GM/i }))
    fireEvent.click(screen.getByLabelText(/Spoiler guard/i))
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openai' } })
    await waitFor(async () => {
      const saved = await settingsRepo.peek()
      expect(saved?.coach.tone).toBe('blunt')
      expect(saved?.coach.spoilerGuard).toBe(false)
      expect(saved?.coach.provider).toBe('openai')
      expect(saved?.coach.model).toBe('gpt-4.1-mini')
    })
    expect(screen.getByRole('progressbar', { name: 'Monthly token usage' })).toBeInTheDocument()
  })

  it('persists sound settings', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Soft' }))
    await waitFor(async () => {
      const saved = await settingsRepo.peek()
      expect(saved?.sound.volume).toBe(80)
      expect(saved?.sound.style).toBe('soft')
    })
  })

  it('does not clear anything until DELETE is typed, then wipes the database and look', async () => {
    await settingsRepo.update({ dailyGoalMinutes: 30 })
    localStorage.setItem('ck-board', 'walnut')
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }))
    const dialog = screen.getByRole('dialog', { name: 'Clear everything on this device?' })
    const confirm = within(dialog).getByRole('button', { name: 'Clear all data' })
    expect(confirm).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), {
      target: { value: 'delete' },
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(async () => {
      expect(await settingsRepo.peek()).toBeUndefined()
    })
    expect(localStorage.getItem('ck-board')).toBeNull()
  })

  it('can be cancelled out of the clear dialog', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }))
    const dialog = screen.getByRole('dialog', { name: 'Clear everything on this device?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByRole('dialog', { name: 'Clear everything on this device?' }),
    ).not.toBeInTheDocument()
  })

  it('offers backup export, import and PGN export', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    expect(screen.getByRole('button', { name: /Export backup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Import backup/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export all PGN/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Backup file')).toHaveAttribute('type', 'file')
    expect(await screen.findByText(/games in your library/)).toBeInTheDocument()
  })

  it('renders the about section with the first-run link', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    expect(screen.getByRole('heading', { level: 2, name: /Chess King/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/',
    )
    expect(screen.getByRole('link', { name: /Replay first-run setup/i })).toHaveAttribute(
      'href',
      '/onboarding',
    )
  })
})
