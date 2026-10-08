import 'fake-indexeddb/auto'

import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ThemeProvider } from '@/design'

import { routeTree } from './routes'
import { SCREENS, type ScreenId } from './screens'

/**
 * The accessibility gate (S29). Every screen a visitor reaches from the main navigation is
 * rendered through the real router and checked with axe-core; any violation fails CI.
 *
 * jsdom has no layout or paint, so axe's `color-contrast` rule cannot run here (it would
 * report "incomplete", never a result). Contrast is held by the design tokens' own tests
 * and by Lighthouse's accessibility category in CI. `region` is off too: it flags content
 * outside landmarks on a bare fragment, which says nothing about the shell's structure.
 */
const AXE_OPTIONS = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
} as const

const AUDITED: readonly ScreenId[] = [
  'today',
  'play-setup',
  'puzzles',
  'learn',
  'mistakes',
  'games',
  'analysis',
  'openings',
  'progress',
  'settings',
  'onboarding',
]

const LAZY_SCREEN_TIMEOUT_MS = 20_000
vi.setConfig({ testTimeout: LAZY_SCREEN_TIMEOUT_MS * 2 })

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      // Nothing is laid out in jsdom.
    }
    unobserve(): void {
      // Nothing is laid out in jsdom.
    }
    disconnect(): void {
      // Nothing is laid out in jsdom.
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

describe('accessibility (axe-core)', () => {
  it.each(AUDITED.map((id) => [id, SCREENS[id].path, SCREENS[id].title] as const))(
    '%s (%s) has no axe violations',
    async (_id, path, title) => {
      const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [path] }),
      })
      const { container } = render(
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>,
      )
      await screen.findByRole(
        'heading',
        { level: 1, name: title },
        { timeout: LAZY_SCREEN_TIMEOUT_MS },
      )
      const results = await axe(container, AXE_OPTIONS)
      const report = results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.help}\n` +
          violation.nodes.map((node) => `  ${node.target.join(' ')}`).join('\n'),
      )
      expect(report).toEqual([])
    },
  )
})
