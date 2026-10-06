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

import { clearAllData, KV_KEYS, kvRepo, lessonsProgressRepo, packsRepo, sessionsRepo } from '@/data'
import { ThemeProvider } from '@/design'
import { ok, toLessonId } from '@/domain'

import { testPack } from './learn-fixtures'
import { LessonScreen } from './lesson-screen'

vi.mock('./lesson-store', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, ensureBuiltinLessons: () => Promise.resolve(ok({ skipped: 0 })) }
})

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
  // The board captures the pointer while dragging; jsdom has no pointer capture.
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.hasPointerCapture = () => false
})

const axeOptions = { rules: { 'color-contrast': { enabled: false } } }

function renderLesson(path = '/learn/lesson?id=lesson-centre') {
  const root = createRootRoute()
  const routes = [
    createRoute({ getParentRoute: () => root, path: '/learn/lesson', component: LessonScreen }),
    createRoute({ getParentRoute: () => root, path: '/learn', component: () => <div>Course</div> }),
    createRoute({
      getParentRoute: () => root,
      path: '/settings',
      component: () => <div>Settings</div>,
    }),
  ]
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
}

/** Plays a move by clicking the two squares, as a person would. */
async function play(container: HTMLElement, from: string, to: string) {
  const user = userEvent.setup()
  await user.click(container.querySelector(`[data-square="${from}"]`)!)
  await user.click(container.querySelector(`[data-square="${to}"]`)!)
}

describe('LessonScreen', () => {
  beforeEach(async () => {
    await clearAllData()
    await packsRepo.install(testPack())
  })

  it('asks for a lesson when the link names none', async () => {
    renderLesson('/learn/lesson')
    expect(await screen.findByText('Pick a lesson to begin')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the course' })).toHaveAttribute('href', '/learn')
  })

  it('says so for a lesson that is not installed', async () => {
    renderLesson('/learn/lesson?id=nope')
    expect(await screen.findByText("That lesson isn't installed")).toBeInTheDocument()
  })

  it('opens at the first step with the lesson’s own words and no made-up content', async () => {
    renderLesson()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/First paragraph\./)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Lesson' })).toHaveTextContent(
      'Take the centre',
    )
    expect(screen.getByText('Step 1')).toBeInTheDocument()
    expect(screen.queryByText(/royal fork|Royal fork|Ne7/)).not.toBeInTheDocument()
    // A read step needs no move: it can be moved on from straight away.
    expect(screen.getByRole('button', { name: 'Next step' })).toBeEnabled()
  })

  it('makes the player move on a move step, and teaches from the hints and feedback', async () => {
    const { container } = renderLesson()
    await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' })
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Take the centre' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play the move' })).toBeDisabled()

    // The hint ladder opens one rung at a time.
    expect(screen.getByText('0 of 3 used')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show nudge/ }))
    expect(screen.getByText('Which pawn guards the king’s side?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show the move/ })).toBeDisabled()

    // A wrong move gets the lesson's own words and a way to try again.
    await play(container, 'a2', 'a3')
    expect(await screen.findByText('Not quite')).toBeInTheDocument()
    expect(screen.getByText('That does not fight for the centre.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(screen.queryByText('Not quite')).not.toBeInTheDocument()

    // A listed alternative is accepted as playable but not as the answer.
    await play(container, 'd2', 'd4')
    expect(await screen.findByText(/d4 works, but there is a better one/)).toBeInTheDocument()
    expect(screen.getByText('d4 is fine too, but this lesson wants e4.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))

    // The right move solves the step and reveals the key idea.
    await play(container, 'e2', 'e4')
    expect(await screen.findByText('Correct: e4')).toBeInTheDocument()
    expect(screen.getByText('That is the idea.')).toBeInTheDocument()
    expect(screen.getByText('Pawns in the centre give your pieces room.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next step' })).toBeEnabled()
  })

  it('saves where the player got to, so the lesson resumes there', async () => {
    renderLesson()
    await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' })
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    await screen.findByRole('heading', { level: 2, name: 'Take the centre' })

    await waitFor(async () => {
      const saved = await lessonsProgressRepo.get(toLessonId('lesson-centre'))
      expect(saved).toMatchObject({ status: 'in-progress', currentStepIndex: 1 })
    })
  })

  it('resumes an unfinished lesson at the step it was left on', async () => {
    const now = Date.now() as never
    await lessonsProgressRepo.put({
      lessonId: toLessonId('lesson-centre'),
      packId: testPack().id,
      status: 'in-progress',
      lessonVersion: 1,
      currentStepIndex: 1,
      completedStepIds: [],
      hintsUsed: 0,
      wrongMoves: 0,
      timeSpentMs: 0,
      startedAt: now,
      updatedAt: now,
      completedAt: null,
    })
    renderLesson()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Take the centre' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Step 2')).toBeInTheDocument()
  })

  it('goes back a step without losing the answer, and cannot go back from the first', async () => {
    const { container } = renderLesson()
    await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' })
    expect(screen.getByRole('button', { name: /Prev step/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    await screen.findByRole('heading', { level: 2, name: 'Take the centre' })
    await play(container, 'e2', 'e4')
    await screen.findByText('Correct: e4')

    fireEvent.click(screen.getByRole('button', { name: /Prev step/ }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    await screen.findByRole('heading', { level: 2, name: 'Take the centre' })
    // Already solved: the player is not asked the same question twice.
    expect(screen.getByRole('button', { name: 'Next step' })).toBeEnabled()
  })

  it('finishes: records the lesson, practice, a session and the streak, and offers what is next', async () => {
    const { container } = renderLesson()
    await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' })
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    await screen.findByRole('heading', { level: 2, name: 'Take the centre' })
    fireEvent.click(screen.getByRole('button', { name: /Show nudge/ }))
    await play(container, 'e2', 'e4')
    await screen.findByText('Correct: e4')
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Lesson complete')).toBeInTheDocument()
    expect(within(dialog).getByText('0/1')).toBeInTheDocument() // a hint ends first-try credit
    expect(within(dialog).getByText('hint used')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /Next: / })).toHaveAttribute(
      'href',
      expect.stringContaining('/learn/lesson?id=lesson-'),
    )

    await waitFor(async () => {
      expect(await lessonsProgressRepo.get(toLessonId('lesson-centre'))).toMatchObject({
        status: 'completed',
        hintsUsed: 1,
      })
      expect(await sessionsRepo.listByKind('lesson')).toHaveLength(1)
      expect((await kvRepo.get(KV_KEYS.streak))?.current).toBe(1)
    })
  })

  it('does not count a replay of a finished lesson as new practice', async () => {
    const now = Date.now() as never
    await lessonsProgressRepo.put({
      lessonId: toLessonId('lesson-centre'),
      packId: testPack().id,
      status: 'completed',
      lessonVersion: 1,
      currentStepIndex: 2,
      completedStepIds: [],
      hintsUsed: 0,
      wrongMoves: 0,
      timeSpentMs: 0,
      startedAt: now,
      updatedAt: now,
      completedAt: now,
    })
    const { container } = renderLesson()
    await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' })
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    await screen.findByRole('heading', { level: 2, name: 'Take the centre' })
    await play(container, 'e2', 'e4')
    await screen.findByText('Correct: e4')
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    await screen.findByRole('dialog')

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(await sessionsRepo.listByKind('lesson')).toHaveLength(0)
    expect((await lessonsProgressRepo.get(toLessonId('lesson-centre')))?.status).toBe('completed')
  })

  it('passes automated accessibility checks', async () => {
    const { container } = renderLesson()
    await screen.findByRole('heading', { level: 2, name: 'Welcome to Take the centre' })
    expect((await axe(container, axeOptions)).violations.map((v) => v.id)).toEqual([])
  })
})
