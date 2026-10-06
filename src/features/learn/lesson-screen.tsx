import { Link, useSearch } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  Lightbulb,
  LockOpen,
  MousePointerClick,
  Palette,
  RotateCcw,
  Sparkles,
  Sprout,
  Target,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { Board, type BoardHandle, type BoardMove } from '@/board'
import { useAllLessonProgress, useLesson, useLessons, useSettings } from '@/data'
import type { LessonProgress } from '@/data'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SimpleTooltip,
  toast,
} from '@/design'
import {
  emptyBoardShapes,
  toFen,
  toLessonId,
  type BoardShapes,
  type Lesson,
  type LessonId,
} from '@/domain'

import { buildCourse, trackTitle } from './course'
import {
  hintLadder,
  initialState,
  isFinalStep,
  judgeMove,
  legalMoveMap,
  playerReducer,
  positionAfter,
  summarise,
  type PlayerEvent,
  type PlayerState,
} from './lesson-player'
import { ensureBuiltinLessons, recordLessonCompleted, saveLessonProgress } from './lesson-store'

/** Lessons are paragraphs and bullet lists in one string; the screen only has to keep the breaks. */
function Prose({ text, className }: { readonly text: string; readonly className?: string }) {
  return <p className={`whitespace-pre-line ${className ?? ''}`}>{text}</p>
}

/**
 * Lesson Screen (`/learn/lesson?id=…`) — the player, ported from `prototype/lesson.html`.
 *
 * Any lesson in any installed pack plays here: `info` steps are read, `move` steps are
 * played on a real board with real rules, with a three-rung hint ladder and feedback from
 * the lesson's own text. Progress is saved as the player moves on, so a lesson resumes
 * where it was left, and finishing one counts as practice.
 */
export function LessonScreen() {
  const search: unknown = useSearch({ strict: false })
  const rawId =
    typeof search === 'object' && search !== null && 'id' in search && typeof search.id === 'string'
      ? search.id
      : undefined
  const id: LessonId | undefined = rawId === undefined ? undefined : toLessonId(rawId)

  const lesson = useLesson(id)
  const progress = useAllLessonProgress()

  // A link straight to a lesson on a fresh device has to install the pack first.
  useEffect(() => {
    void ensureBuiltinLessons()
  }, [])

  if (id === undefined) {
    return (
      <main className="page">
        <h1 className="sr-only">Lesson</h1>
        <EmptyState
          icon={BookOpen}
          title="Pick a lesson to begin"
          description="Lessons are chosen from the course map."
          action={
            <Button asChild>
              <Link to="/learn">Open the course</Link>
            </Button>
          }
        />
      </main>
    )
  }
  if (lesson === undefined || progress === undefined) {
    return (
      <main className="page">
        <h1 className="sr-only">Lesson</h1>
        <p className="text-sm text-muted-foreground" role="status">
          Opening your lesson…
        </p>
      </main>
    )
  }
  if (lesson === null) {
    return (
      <main className="page">
        <h1 className="sr-only">Lesson</h1>
        <EmptyState
          icon={TriangleAlert}
          title="That lesson isn't installed"
          description="The link may be old, or its content pack was removed."
          action={
            <Button asChild>
              <Link to="/learn">Back to the course</Link>
            </Button>
          }
        />
      </main>
    )
  }

  const saved = progress.find((entry) => entry.lessonId === lesson.id)
  return <LessonPlayer key={lesson.id} lesson={lesson} saved={saved} />
}

interface LessonPlayerProps {
  readonly lesson: Lesson
  readonly saved: LessonProgress | undefined
}

function LessonPlayer({ lesson, saved }: LessonPlayerProps) {
  const settings = useSettings()
  const boardRef = useRef<BoardHandle>(null)
  const [boardKey, setBoardKey] = useState(0)
  const [doneOpen, setDoneOpen] = useState(false)

  const alreadyCompleted = saved?.status === 'completed'
  const resumeAt = saved?.status === 'in-progress' ? saved.currentStepIndex : 0
  const [state, dispatch] = useReducer(
    (current: PlayerState, event: PlayerEvent) => playerReducer(lesson, current, event),
    undefined,
    () => initialState(lesson, resumeAt),
  )

  const step = lesson.steps[state.index] ?? lesson.steps[0]
  const lastSave = useRef(0)
  useEffect(() => {
    lastSave.current = Date.now()
  }, [])
  const finished = useRef(false)

  const ladder = useMemo(() => (step === undefined ? [] : hintLadder(step)), [step])
  const legal = useMemo(() => (step === undefined ? new Map() : legalMoveMap(step.fen)), [step])
  const summary = summarise(lesson, state.results)

  const lessons = useLessons()
  const progressRows = useAllLessonProgress()
  /** The next lesson worth offering: unfinished, and in this track first. */
  const nextLesson = useMemo(() => {
    if (lessons === undefined || progressRows === undefined) return undefined
    const rows = buildCourse(lessons, progressRows).tracks.flatMap((track) => track.lessons)
    const candidates = rows.filter(
      (row) => row.lesson.id !== lesson.id && row.status !== 'completed',
    )
    return candidates.find((row) => row.lesson.trackId === lesson.trackId) ?? candidates[0]
  }, [lessons, progressRows, lesson.id, lesson.trackId])

  if (step === undefined) return null
  const isMove = step.kind === 'move'
  const final = isFinalStep(lesson, state.index)
  const showAnswer = state.solved && isMove
  const fen = toFen(showAnswer ? positionAfter(step) : step.fen)

  const shapes: BoardShapes = {
    ...emptyBoardShapes(),
    highlight: [...step.focusSquares],
    // The author's arrows on a move step usually are the answer, so they wait for the
    // third hint or for the step to be solved.
    arrows: !isMove || state.solved || state.hintsShown >= 3 ? [...step.arrows] : [],
  }

  const stepLabel = isMove ? 'Your turn' : final ? 'Done' : 'Read'
  const stepsTotal = lesson.steps.length
  const track = trackTitle(lesson.trackId ?? '')

  function handleMove(move: BoardMove): void {
    if (step === undefined) return
    const judged = judgeMove(step, { from: move.from, to: move.to })
    dispatch({ type: 'move', verdict: judged.verdict, san: judged.san })
    if (judged.verdict === 'correct') boardRef.current?.flash('success')
    else if (judged.verdict === 'wrong') boardRef.current?.shake()
    else if (judged.verdict === 'alternative') boardRef.current?.flash('error')
  }

  function retry(): void {
    dispatch({ type: 'retry' })
    boardRef.current?.clearSelection()
    setBoardKey((key) => key + 1)
  }

  /** Moves on, saving where the player has got to and what the step they finished cost them. */
  function goTo(index: number): void {
    if (step === undefined) return
    const forward = index > state.index
    if (forward) {
      const result = state.results[state.index]
      const reachedEnd = isFinalStep(lesson, index)
      const elapsed = Date.now() - lastSave.current
      lastSave.current = Date.now()
      void saveLessonProgress({
        lesson,
        stepIndex: index,
        completedStepIds: [step.id],
        hintsUsed: result?.hints ?? 0,
        wrongMoves: result?.misses ?? 0,
        sinceLastSaveMs: elapsed,
        completed: reachedEnd,
      }).then((saved) => {
        if (!saved.ok)
          toast.error('Your progress was not saved', { description: saved.error.message })
      })
      if (reachedEnd && !alreadyCompleted && !finished.current) {
        finished.current = true
        void recordLessonCompleted(
          lesson,
          saved?.timeSpentMs ?? elapsed,
          summarise(lesson, state.results).firstTry,
        )
      }
      if (reachedEnd) setDoneOpen(true)
    }
    dispatch({ type: 'go', index })
    setBoardKey((key) => key + 1)
  }

  const canAdvance = state.solved && !final
  const feedback = state.feedback

  return (
    <main className="min-h-full">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4 lg:px-6">
        <Button asChild variant="ghost" size="sm" className="h-9 px-2.5 text-xs sm:px-3 sm:text-sm">
          <Link to="/learn">
            <X className="mr-1 size-4" aria-hidden="true" />
            Exit
          </Link>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <h1
          aria-label="Lesson"
          className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:gap-2 sm:text-base"
        >
          <Sprout className="size-4 shrink-0 text-cta" aria-hidden="true" />
          <span className="truncate">{lesson.title}</span>
        </h1>
        <span className="badge max-md:hidden">{track}</span>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={stepsTotal}
            aria-valuenow={state.index + 1}
            aria-label={`Step ${String(state.index + 1)} of ${String(stepsTotal)} progress`}
            className="progress hidden h-1.5 w-24 sm:block lg:w-40"
          >
            <span style={{ width: `${String(((state.index + 1) / stepsTotal) * 100)}%` }} />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums sm:text-sm">
            Step {state.index + 1} <span className="text-muted-foreground">of {stepsTotal}</span>
          </span>
          <SimpleTooltip content="Board and piece settings">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="size-8 shrink-0 px-0 sm:size-9"
              aria-label="Board and piece settings"
            >
              <Link to="/settings">
                <Palette className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </SimpleTooltip>
        </div>
      </header>

      <div className="grid gap-4 p-3 sm:gap-5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex justify-center" aria-label="Lesson board">
          <div className="w-full max-w-[min(100%,calc(100dvh-200px),620px)] space-y-2 sm:space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium sm:gap-2">
                <span
                  className={`size-2.5 rounded-full ring-1 ring-border sm:size-3 ${step.orientation === 'white' ? 'bg-white' : 'bg-neutral-800'}`}
                  aria-hidden="true"
                />
                {step.orientation === 'white' ? 'White' : 'Black'} · {stepLabel}
              </span>
              {isMove && !state.solved && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MousePointerClick className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="hidden min-[380px]:inline">Click a piece, then a square</span>
                  <span className="min-[380px]:hidden">Tap to move</span>
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-xl shadow-[0_18px_40px_-18px_rgba(30,40,30,.45)] ring-1 ring-border">
              <Board
                key={boardKey}
                ref={boardRef}
                fen={fen}
                orientation={step.orientation}
                legalMoves={legal}
                movable={isMove && !state.solved ? step.orientation : 'none'}
                onMove={handleMove}
                shapes={shapes}
                coordinates={settings.board.coordinates}
                animationSpeed={settings.board.animation}
                label={`Lesson board, ${step.orientation === 'white' ? 'White' : 'Black'} ${isMove ? 'to move' : 'position'}. ${step.prompt}`}
              />
            </div>

            {step.focusSquares.length > 0 && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full ring-2 ring-cta sm:size-3"
                  aria-hidden="true"
                />
                Circled: where to look.
              </p>
            )}
          </div>
        </section>

        <aside
          className="card flex min-h-0 flex-col overflow-hidden lg:max-h-[calc(100dvh-56px-48px)]"
          aria-label="Lesson step"
        >
          <div className="min-h-0 flex-1 space-y-3.5 overflow-auto p-4 sm:space-y-4 sm:p-5">
            <div>
              <p className="eyebrow">
                Step {state.index + 1} · {stepLabel}
              </p>
              <h2 className="mt-1.5 text-lg leading-snug font-bold sm:text-xl">{step.prompt}</h2>
              {step.text !== undefined && (
                <Prose
                  text={step.text}
                  className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm"
                />
              )}
            </div>

            {ladder.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="label">Hints</span>
                  <span className="text-xs text-muted-foreground">
                    {state.hintsShown} of {ladder.length} used
                  </span>
                </div>
                <ol className="mt-2 space-y-1.5 text-xs sm:text-sm">
                  {ladder.map((rung, index) => {
                    const open = index < state.hintsShown
                    const next = index === state.hintsShown && !state.solved
                    return (
                      <li key={rung.label}>
                        {open ? (
                          <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-2 sm:p-2.5">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                              {index + 1}
                            </span>
                            <span>
                              <span className="font-medium">{rung.label}.</span>{' '}
                              <span className="text-muted-foreground">{rung.text}</span>
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!next}
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-dashed p-2 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 sm:p-2.5"
                            onClick={() => {
                              dispatch({ type: 'hint' })
                            }}
                          >
                            <span className="grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="flex-1 text-muted-foreground">
                              Show {rung.label.toLowerCase()}
                            </span>
                            {index === ladder.length - 1 ? (
                              <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
                            ) : (
                              <LockOpen
                                className="size-4 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}

            {feedback !== null && feedback.verdict === 'correct' && (
              <div
                role="status"
                className="rounded-xl border border-primary/25 bg-accent/60 p-3 sm:p-3.5"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-primary sm:text-sm">
                  <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                  {feedback.san === undefined ? 'Correct' : `Correct: ${feedback.san}`}
                </div>
                {step.successText !== undefined && (
                  <Prose
                    text={step.successText}
                    className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm"
                  />
                )}
              </div>
            )}

            {feedback !== null && feedback.verdict !== 'correct' && (
              <div
                role="status"
                className="rounded-xl border border-reward/40 bg-reward-soft p-3 sm:p-3.5"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-reward-ink sm:text-sm">
                  <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
                  {feedback.verdict === 'alternative'
                    ? `${feedback.san ?? 'That'} works, but there is a better one`
                    : 'Not quite'}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {feedback.verdict === 'alternative'
                    ? (step.alternativeText ??
                      'A playable move, though not the idea of this lesson.')
                    : (step.failureText ??
                      `${feedback.san ?? 'That move'} is not what this step is after. Take another look at the board.`)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5 h-8 text-xs sm:h-9"
                  onClick={retry}
                >
                  <RotateCcw className="mr-1 size-3.5" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            )}

            {state.solved && step.keyIdea !== undefined && (
              <div className="flex gap-2.5 rounded-xl bg-lilac/60 p-3 sm:gap-3 sm:p-3.5">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-lilac-ink" aria-hidden="true" />
                <div>
                  <div className="text-xs font-semibold text-lilac-ink sm:text-sm">Key idea</div>
                  <Prose
                    text={step.keyIdea}
                    className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 min-h-[44px] text-xs sm:h-10 sm:min-h-0 sm:text-sm"
                disabled={state.index === 0}
                onClick={() => {
                  goTo(state.index - 1)
                }}
              >
                <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
                Prev step
              </Button>
              {final ? (
                <Button
                  size="sm"
                  className="h-9 min-h-[44px] text-xs sm:h-10 sm:min-h-0 sm:text-sm"
                  onClick={() => {
                    setDoneOpen(true)
                  }}
                >
                  Finish
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-9 min-h-[44px] text-xs sm:h-10 sm:min-h-0 sm:text-sm"
                  disabled={!canAdvance}
                  onClick={() => {
                    goTo(state.index + 1)
                  }}
                >
                  {isMove && !state.solved ? 'Play the move' : 'Next step'}
                  <ChevronRight className="ml-1 size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto p-0 text-center">
          <div className="relative p-4 sm:p-6">
            <div className="absolute inset-x-0 top-0 h-24 bg-reward-soft" />
            <div className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-reward shadow-lg sm:size-16">
              <Sprout className="size-7 sm:size-8" aria-hidden="true" />
            </div>
            <DialogHeader className="relative mt-3 sm:mt-4">
              <p className="eyebrow mx-auto">Lesson complete</p>
              <DialogTitle className="mt-1 text-xl font-bold sm:text-2xl">
                {lesson.title}
              </DialogTitle>
              <DialogDescription className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground sm:text-sm">
                {summary.moveSteps === 0
                  ? `${String(stepsTotal)} steps read.`
                  : `You played ${String(summary.moveSteps)} ${summary.moveSteps === 1 ? 'move' : 'moves'} and got ${String(summary.firstTry)} right first time.`}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid grid-cols-3 gap-1.5 text-left sm:mt-5 sm:gap-2">
              <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
                <div className="font-display text-lg font-bold sm:text-xl">
                  {summary.firstTry}/{summary.moveSteps}
                </div>
                <div className="text-[11px] text-muted-foreground sm:text-xs">first try</div>
              </div>
              <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
                <div className="font-display text-lg font-bold sm:text-xl">{summary.hints}</div>
                <div className="text-[11px] text-muted-foreground sm:text-xs">
                  {summary.hints === 1 ? 'hint used' : 'hints used'}
                </div>
              </div>
              <div className="rounded-xl bg-muted/60 p-2.5 sm:p-3">
                <div className="font-display text-lg font-bold sm:text-xl">{summary.misses}</div>
                <div className="text-[11px] text-muted-foreground sm:text-xs">
                  {summary.misses === 1 ? 'slip' : 'slips'}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-center gap-2 sm:mt-6">
              {nextLesson !== undefined && (
                <Button
                  asChild
                  className="btn-cta h-10 w-full bg-cta text-white hover:bg-cta/90 sm:h-11"
                >
                  <Link to="/learn/lesson" search={{ id: nextLesson.lesson.id }}>
                    <Target className="mr-1.5 size-4" aria-hidden="true" />
                    Next: {nextLesson.lesson.title}
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="h-9 text-muted-foreground">
                <Link to="/learn">Back to course</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
