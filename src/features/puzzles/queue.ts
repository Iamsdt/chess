import { puzzlesRepo } from '@/data'
import { now as nowTimestamp, type Puzzle, type PuzzleId, type SessionId } from '@/domain'

import { themeMastery } from './mastery'
import {
  currentDay,
  findResumableSession,
  loadAttemptHistory,
  loadCandidates,
  loadDailyPuzzle,
  loadRecentPuzzleIds,
  openSession,
  readRatingState,
  toSolvedByBand,
  toThemeRecords,
} from './puzzle-store'
import { systemRng } from './rng'
import {
  curriculumRung,
  pickSession,
  selectionLadder,
  SESSION_SIZE,
  themeWeights,
} from './selection'
import { startSession, type SessionConfig, type SessionState } from './session'

/**
 * Drawing a set and opening the session that holds it.
 *
 * It lives apart from the runner hook because two callers need it: the hook, when a
 * screen is opened cold, and the hub, when the user picks a theme and is then sent to the
 * solver. Going through storage rather than through a router parameter is what makes that
 * hand-off survive a reload — the solver resumes the open session instead of being told
 * about it in a URL.
 */

/** A session, its queue and the rows behind it. */
export interface PreparedSession {
  readonly sessionId: SessionId | null
  readonly state: SessionState
  readonly puzzles: ReadonlyMap<PuzzleId, Puzzle>
  readonly activeIndex: number
}

/** The selection, end to end: rating, curriculum, ladder, weighted draw. */
export async function buildQueue(config: SessionConfig): Promise<Puzzle[]> {
  const count = config.goal ?? SESSION_SIZE * 2
  if (config.kind === 'daily-puzzle') {
    const daily = await loadDailyPuzzle(await currentDay())
    return daily === undefined ? [] : [daily]
  }

  const player = await readRatingState()
  const history = await loadAttemptHistory()
  const mastery = themeMastery(toThemeRecords(history))
  const rung = curriculumRung(toSolvedByBand(history))
  const excludeIds = await loadRecentPuzzleIds()
  const pool = await loadCandidates(
    selectionLadder({
      player,
      rung,
      ...(config.theme === undefined ? {} : { theme: config.theme }),
      excludeIds,
      count,
    }),
    count,
  )
  return pickSession(pool.puzzles, {
    player,
    count,
    rng: systemRng,
    weights: themeWeights(mastery),
  })
}

/** Draw a set and write the session row that makes it resumable. */
export async function startNewSession(config: SessionConfig): Promise<PreparedSession> {
  const queue = await buildQueue(config)
  const state = startSession(
    config,
    queue.map((puzzle) => puzzle.id),
    nowTimestamp(),
  )
  const opened = queue.length === 0 ? null : await openSession(state)
  return {
    sessionId: opened?.ok === true ? opened.value.id : null,
    state,
    puzzles: new Map(queue.map((puzzle) => [puzzle.id, puzzle])),
    activeIndex: 0,
  }
}

/**
 * Resume an interrupted session of one of these kinds, or start a new one.
 *
 * A resumed session whose puzzles have since been cleared out of the catalogue falls
 * through to a fresh set rather than showing an empty board.
 */
export async function resumeOrStart(
  config: SessionConfig,
  kinds: readonly SessionState['config']['kind'][],
): Promise<PreparedSession> {
  const existing = await findResumableSession(kinds)
  if (existing !== null) {
    const rows = await puzzlesRepo.getMany(existing.state.queue)
    if (rows.length > 0) {
      return {
        sessionId: existing.session.id,
        state: existing.state,
        puzzles: new Map(rows.map((puzzle) => [puzzle.id, puzzle])),
        activeIndex: existing.state.index,
      }
    }
  }
  return startNewSession(config)
}
