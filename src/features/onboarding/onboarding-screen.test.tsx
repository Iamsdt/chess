import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { clearAllData, profileRepo, settingsRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { createProfile } from '@/domain'

import { OnboardingScreen } from './onboarding-screen'

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

function renderOnboardingScreen() {
  const rootRoute = createRootRoute()
  const onboardingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/onboarding',
    component: OnboardingScreen,
  })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>Today Screen</div>,
  })
  const puzzlesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/puzzles',
    component: () => <div>Puzzles Screen</div>,
  })

  const routeTree = rootRoute.addChildren([onboardingRoute, homeRoute, puzzlesRoute])
  const history = createMemoryHistory({ initialEntries: ['/onboarding'] })
  const router = createRouter({ routeTree, history })

  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

describe('OnboardingScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    localStorage.clear()
  })

  it('renders heading with accessible name "Welcome"', async () => {
    renderOnboardingScreen()

    const heading = await screen.findByRole('heading', { level: 1, name: 'Welcome' })
    expect(heading).toBeInTheDocument()
    expect(screen.getByText("Let's set you up")).toBeInTheDocument()
    expect(
      screen.getByText("Four quick questions. You'll be playing in under a minute."),
    ).toBeInTheDocument()
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })

    const results = await axe(container, axeOptions)
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })

  it('completes the 4-step onboarding flow from start to finish', async () => {
    renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })

    // STEP 1: Level
    expect(
      screen.getByRole('heading', { level: 2, name: 'How well do you know chess?' }),
    ).toBeInTheDocument()

    const clubOption = screen.getByRole('radio', { name: /Club player/i })
    fireEvent.click(clubOption)
    expect(clubOption).toHaveAttribute('aria-checked', 'true')

    const placementCheckbox = screen.getByLabelText(/Not sure\? Take a 5-puzzle placement/i)
    fireEvent.click(placementCheckbox)
    expect(placementCheckbox).toBeChecked()

    const toStep2Btn = screen.getByRole('button', { name: /Continue/i })
    fireEvent.click(toStep2Btn)

    // STEP 2: Goals
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'What would you like to get better at?',
      }),
    ).toBeInTheDocument()

    const openingsBtn = screen.getByRole('button', { name: 'Openings' })
    expect(openingsBtn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(openingsBtn)
    expect(openingsBtn).toHaveAttribute('aria-pressed', 'true')

    // Test Back button
    const backTo1 = screen.getByRole('button', { name: /Back/i })
    fireEvent.click(backTo1)
    expect(
      screen.getByRole('heading', { level: 2, name: 'How well do you know chess?' }),
    ).toBeInTheDocument()

    // Forward to 2, then to 3
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    const toStep3Btn = screen.getByRole('button', { name: /Continue/i })
    fireEvent.click(toStep3Btn)

    // STEP 3: Time & Board
    expect(
      screen.getByRole('heading', { level: 2, name: 'How much time a day?' }),
    ).toBeInTheDocument()

    const time30 = screen.getByRole('radio', { name: /30/i })
    fireEvent.click(time30)
    expect(time30).toHaveAttribute('aria-checked', 'true')

    const walnutSwatch = screen.getByRole('radio', { name: 'Walnut' })
    fireEvent.click(walnutSwatch)
    expect(walnutSwatch).toHaveAttribute('aria-checked', 'true')

    expect(
      screen.getByRole('img', { name: 'Board preview after 1.e4 e5 2.Nf3' }),
    ).toBeInTheDocument()

    const toStep4Btn = screen.getByRole('button', { name: /Continue/i })
    fireEvent.click(toStep4Btn)

    // STEP 4: Coach
    expect(
      screen.getByRole('heading', { level: 2, name: 'Want Sage, your AI coach?' }),
    ).toBeInTheDocument()

    const provSelect = screen.getByLabelText('Provider')
    fireEvent.change(provSelect, { target: { value: 'openai' } })
    expect(provSelect).toHaveValue('openai')

    fireEvent.click(screen.getByRole('button', { name: /Start playing/i }))

    // Nothing is written until the end, and then all of it is written at once.
    expect(await screen.findByText('Puzzles Screen')).toBeInTheDocument()
    const profile = await profileRepo.get()
    expect(profile?.skillLevel).toBe('club')
    expect(profile?.puzzleRating).toBe(1200)
    expect(profile?.goals).toEqual(['tactics', 'friends', 'blunders', 'openings'])
    expect(profile?.onboardingCompletedAt).not.toBeNull()
    const settings = await settingsRepo.peek()
    expect(settings?.dailyGoalMinutes).toBe(30)
    expect(settings?.board.theme).toBe('walnut')
    expect(settings?.coach.provider).toBe('openai')
    expect(settings?.coach.model).toBe('gpt-4.1-mini')
  })

  it('writes nothing if the person leaves before the last step', async () => {
    renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })
    fireEvent.click(screen.getByRole('radio', { name: /Club player/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    expect(await profileRepo.get()).toBeUndefined()
    expect(await settingsRepo.peek()).toBeUndefined()
  })

  it('skipping the coach still finishes setup and goes to Today', async () => {
    renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })

    fireEvent.change(screen.getByLabelText('What should we call you?'), {
      target: { value: 'Magnus' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Step 4: AI coach' }))
    fireEvent.click(screen.getByRole('button', { name: /Skip — everything works without it/i }))

    expect(await screen.findByText('Today Screen')).toBeInTheDocument()
    const profile = await profileRepo.get()
    expect(profile?.displayName).toBe('Magnus')
    expect(profile?.skillLevel).toBe('beginner')
    expect(profile?.onboardingCompletedAt).not.toBeNull()
  })

  it('replaying setup starts from the saved answers and keeps earned ratings', async () => {
    await profileRepo.save({
      ...createProfile({
        displayName: 'Ada',
        skillLevel: 'strong',
        goals: ['openings'],
        timeZone: 'UTC',
        onboardingCompleted: true,
      }),
      puzzleRating: 1777,
    })
    renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })

    expect(await screen.findByLabelText('What should we call you?')).toHaveValue('Ada')
    expect(screen.getByRole('radio', { name: /Strong/i })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Step 4: AI coach' }))
    fireEvent.click(screen.getByRole('button', { name: /Start playing/i }))
    expect(await screen.findByText('Today Screen')).toBeInTheDocument()

    await waitFor(async () => {
      const profile = await profileRepo.get()
      expect(profile?.puzzleRating).toBe(1777)
      expect(profile?.goals).toEqual(['openings'])
    })
  })

  it('navigates between steps via stepper indicators', async () => {
    renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })

    const step3Button = screen.getByRole('button', { name: 'Step 3: Daily time' })
    fireEvent.click(step3Button)

    expect(
      screen.getByRole('heading', { level: 2, name: 'How much time a day?' }),
    ).toBeInTheDocument()

    const step1Button = screen.getByRole('button', { name: 'Step 1: Your level' })
    fireEvent.click(step1Button)

    expect(
      screen.getByRole('heading', { level: 2, name: 'How well do you know chess?' }),
    ).toBeInTheDocument()
  })

  it('toggles dark theme from header button', async () => {
    renderOnboardingScreen()
    await screen.findByRole('heading', { level: 1, name: 'Welcome' })

    const themeBtn = screen.getByRole('button', { name: 'Toggle dark mode' })
    expect(themeBtn).toBeInTheDocument()
    fireEvent.click(themeBtn)
  })
})
