import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

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

  it('updates profile settings (name, level, daily goal, reminder)', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    const nameInput = screen.getByLabelText('Display name')
    expect(nameInput).toHaveValue('Shudipto')
    fireEvent.change(nameInput, { target: { value: 'Magnus' } })
    expect(nameInput).toHaveValue('Magnus')

    const levelSelect = screen.getByLabelText('Your level')
    expect(levelSelect).toHaveValue('Club player · around 1200')
    fireEvent.change(levelSelect, { target: { value: 'Strong · 1600+' } })
    expect(levelSelect).toHaveValue('Strong · 1600+')

    const goal30 = screen.getByRole('button', { name: '30 min' })
    fireEvent.click(goal30)
    expect(goal30).toHaveClass('is-active')

    const remindInput = screen.getByLabelText('Daily reminder')
    expect(remindInput).toHaveValue('20:00')
    fireEvent.change(remindInput, { target: { value: '21:30' } })
    expect(remindInput).toHaveValue('21:30')
  })

  it('manages board appearance, themes, piece sets and preview', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    // Theme mode
    const darkBtn = screen.getByRole('button', { name: 'Dark' })
    fireEvent.click(darkBtn)
    expect(darkBtn).toHaveClass('is-active')

    // Board themes
    const walnutSwatch = screen.getByRole('radio', { name: 'Walnut' })
    fireEvent.click(walnutSwatch)
    expect(walnutSwatch).toHaveAttribute('aria-checked', 'true')

    // Piece sets
    const stauntyOption = screen.getByRole('radio', { name: 'Staunty' })
    fireEvent.click(stauntyOption)
    expect(stauntyOption).toHaveAttribute('aria-checked', 'true')

    // Live preview board
    expect(
      screen.getByRole('img', { name: 'Preview board: Italian Game after 6...O-O' }),
    ).toBeInTheDocument()

    // Move animation toggle
    const slowAnimBtn = screen.getByRole('button', { name: 'Slow' })
    fireEvent.click(slowAnimBtn)
    expect(slowAnimBtn).toHaveClass('is-active')
  })

  it('configures AI coach, tests key, reveals password, and opens remove key modal', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    const keyInput = screen.getByLabelText('API key')
    expect(keyInput).toHaveAttribute('type', 'password')

    const revealBtn = screen.getByRole('button', { name: 'Show key' })
    fireEvent.click(revealBtn)
    expect(keyInput).toHaveAttribute('type', 'text')

    const testBtn = screen.getByRole('button', { name: 'Test key' })
    fireEvent.click(testBtn)

    // Coach tone
    const bluntTone = screen.getByRole('radio', { name: /Blunt GM/i })
    fireEvent.click(bluntTone)
    expect(bluntTone).toHaveAttribute('aria-checked', 'true')

    // Token progress bar
    expect(screen.getByRole('progressbar', { name: 'Monthly token usage' })).toBeInTheDocument()

    // Remove key modal
    const removeBtn = screen.getByRole('button', { name: 'Remove key' })
    fireEvent.click(removeBtn)

    const modal = screen.getByRole('dialog', { name: 'Remove your Gemini key?' })
    expect(modal).toBeInTheDocument()

    const confirmRemoveBtn = within(modal).getByRole('button', { name: 'Remove key' })
    fireEvent.click(confirmRemoveBtn)
    expect(
      screen.queryByRole('dialog', { name: 'Remove your Gemini key?' }),
    ).not.toBeInTheDocument()
  })

  it('updates sound settings and styles', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    const volSlider = screen.getByLabelText('Volume')
    expect(volSlider).toHaveValue('60')
    fireEvent.change(volSlider, { target: { value: '80' } })
    expect(volSlider).toHaveValue('80')

    const softSoundBtn = screen.getByRole('button', { name: 'Soft' })
    fireEvent.click(softSoundBtn)
    expect(softSoundBtn).toHaveClass('is-active')
  })

  it('manages data exports, backups, and clear all data modal', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    expect(
      screen.getByRole('img', {
        name: 'Games 2.6 MB, puzzles 0.9 MB, lessons and repertoire 0.4 MB, chats 0.3 MB',
      }),
    ).toBeInTheDocument()

    const exportBackupBtn = screen.getByRole('button', { name: /Export backup/i })
    fireEvent.click(exportBackupBtn)

    const importBackupBtn = screen.getByRole('button', { name: /Import backup/i })
    fireEvent.click(importBackupBtn)

    const exportPgnBtn = screen.getByRole('button', { name: /Export all PGN/i })
    fireEvent.click(exportPgnBtn)

    // Clear all data modal
    const clearBtn = screen.getByRole('button', { name: 'Clear all data' })
    fireEvent.click(clearBtn)

    const clearDialog = screen.getByRole('dialog', { name: 'Clear everything on this device?' })
    expect(clearDialog).toBeInTheDocument()

    const cancelBtn = within(clearDialog).getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)
    expect(
      screen.queryByRole('dialog', { name: 'Clear everything on this device?' }),
    ).not.toBeInTheDocument()
  })

  it('renders about section with app version, GitHub link, and onboarding setup link', async () => {
    renderSettingsScreen()
    await screen.findByRole('heading', { level: 1, name: 'Settings' })

    expect(
      screen.getByRole('heading', { level: 2, name: /Chess King v0\.9\.2/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Free and open source under the MIT licence. Stockfish 17 runs on your device.',
      ),
    ).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/',
    )

    const checkUpdatesBtn = screen.getByRole('button', { name: /Check for updates/i })
    fireEvent.click(checkUpdatesBtn)

    expect(screen.getByRole('link', { name: /Replay first-run setup/i })).toHaveAttribute(
      'href',
      '/onboarding',
    )
  })
})
