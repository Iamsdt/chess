import { TUTORIAL_PACK_ID, loadTutorialPack } from '@/content'
import { lessonsProgressRepo, newSessionId, packsRepo, profileRepo, sessionsRepo } from '@/data'
import type { LessonProgress } from '@/data'
import { domainError, err, localDateOf, now, ok, type Lesson, type Result } from '@/domain'
import { recordPractice } from '@/features/habit'

/** One download-and-install per page load, however many screens ask. */
let installing: Promise<Result<{ skipped: number }>> | null = null

/**
 * Makes sure the 49 shipped tutorials are installed as the builtin lesson pack.
 *
 * Why on first use and not at startup: converting them replays every line with chess.js,
 * which is real work, and only the Learn screens need the result. After the first time
 * the pack is a row in the database and this is a single read.
 */
export function ensureBuiltinLessons(): Promise<Result<{ skipped: number }>> {
  installing ??= (async () => {
    const existing = await packsRepo.get(TUTORIAL_PACK_ID)
    if (existing !== undefined) return ok({ skipped: 0 })
    const loaded = await loadTutorialPack({ source: 'builtin' })
    if (!loaded.ok) {
      return err(
        domainError('io', loaded.error.problems[0]?.message ?? 'The lessons could not be read', {
          where: 'lessons',
        }),
      )
    }
    const installed = await packsRepo.install(loaded.value.pack)
    if (!installed.ok) return installed
    return ok({ skipped: loaded.value.skipped.length })
  })().finally(() => {
    // A failure should be retryable on the next visit; only a success is worth remembering.
    installing = null
  })
  return installing
}

/** Time between saves above which the gap is treated as the player walking away. */
const IDLE_CAP_MS = 5 * 60_000

export interface ProgressSave {
  readonly lesson: Lesson
  readonly stepIndex: number
  readonly completedStepIds: readonly string[]
  readonly hintsUsed: number
  readonly wrongMoves: number
  /** Milliseconds since the previous save, capped so a forgotten tab does not count as study. */
  readonly sinceLastSaveMs: number
  readonly completed: boolean
}

/** Writes where the player has got to; completing a lesson closes it exactly once. */
export async function saveLessonProgress(save: ProgressSave): Promise<Result<LessonProgress>> {
  const { lesson } = save
  const at = now()
  const previous = await lessonsProgressRepo.get(lesson.id)
  const finishedBefore = previous?.status === 'completed' ? previous : undefined
  const spent = Math.min(Math.max(save.sinceLastSaveMs, 0), IDLE_CAP_MS)

  const next: LessonProgress = {
    lessonId: lesson.id,
    packId: lesson.packId,
    // Replaying a finished lesson must not un-finish it.
    status: finishedBefore !== undefined || save.completed ? 'completed' : 'in-progress',
    lessonVersion: lesson.version,
    currentStepIndex: finishedBefore?.currentStepIndex ?? save.stepIndex,
    completedStepIds: [
      ...new Set([...(previous?.completedStepIds ?? []), ...save.completedStepIds]),
    ] as LessonProgress['completedStepIds'],
    hintsUsed: (previous?.hintsUsed ?? 0) + save.hintsUsed,
    wrongMoves: (previous?.wrongMoves ?? 0) + save.wrongMoves,
    timeSpentMs: (previous?.timeSpentMs ?? 0) + spent,
    startedAt: previous?.startedAt ?? at,
    updatedAt: at,
    completedAt: finishedBefore?.completedAt ?? (save.completed ? at : null),
  }
  return lessonsProgressRepo.put(next)
}

/**
 * A lesson finished for the first time counts as practice: a session for the heatmap and
 * the day's goal, and a day on the streak. Replays do not, so the goal cannot be farmed.
 */
export async function recordLessonCompleted(
  lesson: Lesson,
  timeSpentMs: number,
  itemsCorrect: number,
): Promise<void> {
  const profile = await profileRepo.get()
  const at = now()
  const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const ms = Math.max(timeSpentMs, 60_000)
  await sessionsRepo.start({
    id: newSessionId(),
    kind: 'lesson',
    state: 'completed',
    day: localDateOf(at, timeZone),
    startedAt: at,
    updatedAt: at,
    endedAt: at,
    durationMs: ms,
    itemsAttempted: lesson.steps.filter((step) => step.kind === 'move').length,
    itemsCorrect,
    resumeState: {},
  })
  await recordPractice(ms)
}
