import 'fake-indexeddb/auto'

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { clearAllData, lessonsProgressRepo, packsRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { domainError, err, FIXTURE_NOW, ok, toLessonId, toTimestamp } from '@/domain'

import { TEST_PACK_ID, testPack } from './learn-fixtures'
import { LearnScreen } from './learn-screen'

const ensure = vi.hoisted(() => vi.fn())
vi.mock('./lesson-store', () => ({ ensureBuiltinLessons: ensure }))

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

function renderLearn() {
  const root = createRootRoute()
  const routes = [
    createRoute({ getParentRoute: () => root, path: '/learn', component: LearnScreen }),
    createRoute({
      getParentRoute: () => root,
      path: '/learn/lesson',
      component: () => <div>Lesson player</div>,
    }),
  ]
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ['/learn'] }),
  })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

/** The count is split across a bold number and plain text, so match the whole line. */
function summaryOf(text: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === 'P' && element.textContent === text
}

function lessonPack(source: 'imported' | 'builtin' = 'imported') {
  return testPack({ source })
}

describe('LearnScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    ensure.mockReset()
    ensure.mockResolvedValue(ok({ skipped: 0 }))
  })

  it('shows a calm loading line, then the course', async () => {
    await packsRepo.install(lessonPack())
    renderLearn()
    expect(await screen.findByRole('heading', { level: 1, name: 'Learn' })).toBeInTheDocument()
    expect(await screen.findByText(summaryOf('0 of 3 lessons finished'))).toBeInTheDocument()
  })

  it('groups lessons into tracks, biggest first, each linking to its own lesson', async () => {
    await packsRepo.install(lessonPack())
    renderLearn()

    const tactics = await screen.findByRole('button', { name: /Tactics/ })
    expect(tactics).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Open games/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    const pins = screen.getByRole('link', { name: /Pins/ })
    expect(pins).toHaveAttribute('href', '/learn/lesson?id=lesson-pins')

    fireEvent.click(screen.getByRole('button', { name: /Open games/ }))
    expect(await screen.findByRole('link', { name: /Take the centre/ })).toHaveAttribute(
      'href',
      '/learn/lesson?id=lesson-centre',
    )
  })

  it('reads progress: finished lessons, steps reached, and where to continue', async () => {
    await packsRepo.install(lessonPack())
    const base = {
      packId: TEST_PACK_ID,
      lessonVersion: 1,
      completedStepIds: [],
      hintsUsed: 0,
      wrongMoves: 0,
      timeSpentMs: 0,
      startedAt: FIXTURE_NOW,
    }
    await lessonsProgressRepo.put({
      ...base,
      lessonId: toLessonId('lesson-pins'),
      status: 'completed',
      currentStepIndex: 2,
      updatedAt: FIXTURE_NOW,
      completedAt: FIXTURE_NOW,
    })
    await lessonsProgressRepo.put({
      ...base,
      lessonId: toLessonId('lesson-forks'),
      status: 'in-progress',
      currentStepIndex: 1,
      updatedAt: toTimestamp(FIXTURE_NOW + 5),
      completedAt: null,
    })
    renderLearn()

    expect(await screen.findByText(summaryOf('1 of 3 lessons finished'))).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Forks' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue lesson' })).toHaveAttribute(
      'href',
      '/learn/lesson?id=lesson-forks',
    )
    const bar = screen.getByRole('progressbar', { name: 'Tactics progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText(/step 2 of 3/)).toBeInTheDocument()
  })

  it('offers the first lesson to a new learner', async () => {
    await packsRepo.install(lessonPack())
    renderLearn()
    expect(await screen.findByText('Up next')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start lesson' })).toBeInTheDocument()
  })

  it('says so, and offers a retry, when the lessons could not be installed', async () => {
    ensure.mockResolvedValueOnce(err(domainError('io', 'No network', { where: 'lessons' })))
    renderLearn()
    expect(await screen.findByText('The lessons could not be loaded')).toBeInTheDocument()
    expect(screen.getByText('No network')).toBeInTheDocument()

    await packsRepo.install(lessonPack())
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByRole('button', { name: /Tactics/ })).toBeInTheDocument()
    expect(ensure).toHaveBeenCalledTimes(2)
  })

  it('lists installed packs and removes only the ones that were imported', async () => {
    await packsRepo.install(lessonPack('imported'))
    renderLearn()
    const packs = await screen.findByRole('region', { name: 'Lesson packs' })
    expect(within(packs).getByText('Test pack')).toBeInTheDocument()
    expect(within(packs).getByText(/Imported/)).toBeInTheDocument()

    fireEvent.click(within(packs).getByRole('button', { name: 'Remove Test pack' }))
    await waitFor(async () => {
      expect(await packsRepo.count()).toBe(0)
    })
    expect(await screen.findByText('No lessons installed')).toBeInTheDocument()
  })

  it('never offers to remove the pack that ships with the app', async () => {
    await packsRepo.install(lessonPack('builtin'))
    renderLearn()
    const packs = await screen.findByRole('region', { name: 'Lesson packs' })
    expect(within(packs).getByText(/Ships with the app/)).toBeInTheDocument()
    expect(within(packs).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('imports a pack from a file and adds its lessons to the map', async () => {
    await packsRepo.install(lessonPack())
    renderLearn()
    await screen.findByRole('button', { name: /Tactics/ })

    const base = testPack()
    const first = base.lessons[0]
    if (first === undefined) throw new Error('fixture has no lessons')
    // The file format carries no install metadata; that is stamped on when it is imported.
    const { source: _source, importedAt: _importedAt, updatedAt: _updatedAt, ...fileFields } = base
    const extra = {
      ...fileFields,
      id: 'extra-pack',
      name: 'Extra pack',
      itemCount: 1,
      lessons: [
        { ...first, id: 'extra-1', packId: 'extra-pack', title: 'Skewers', trackId: 'tactics' },
      ],
    }
    const file = new File([JSON.stringify(extra)], 'extra.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText('Content pack file'), file)

    expect(await screen.findByText('Extra pack')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Skewers/ })).toBeInTheDocument()
  })

  it('refuses a file that is not a pack and installs nothing', async () => {
    await packsRepo.install(lessonPack())
    renderLearn()
    await screen.findByRole('button', { name: /Tactics/ })
    const file = new File(['{"not":"a pack"}'], 'bad.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText('Content pack file'), file)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(await packsRepo.count()).toBe(1)
  })

  it('passes automated accessibility checks', async () => {
    await packsRepo.install(lessonPack())
    const { container } = renderLearn()
    await screen.findByRole('button', { name: /Tactics/ })
    expect((await axe(container, axeOptions)).violations.map((v) => v.id)).toEqual([])
  })
})
