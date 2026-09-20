import { useCallback, useRef, useState } from 'react'

import type { ImportProgress } from '@/content'
import { attemptsRepo, puzzlesRepo, type PracticeSession, type PuzzleStats } from '@/data'
import { type Puzzle, type PuzzleAttempt } from '@/domain'

import { themeMastery, weakestThemes, type ThemeMastery } from './mastery'
import {
  currentDay,
  EMPTY_BESTS,
  findResumableSession,
  loadAttemptHistory,
  loadDailyPuzzle,
  readBests,
  readRatingState,
  toSolvedByBand,
  toThemeRecords,
  type PuzzleBests,
} from './puzzle-store'
import { curriculumRung, ratingWindow, type CurriculumRung, type RatingWindow } from './selection'
import { useAsyncData, type AsyncState } from './use-async'

import type { GlickoRating } from './glicko2'
import type { PuzzleImportPort } from './ports'
import type { SessionState } from './session'

/**
 * Everything the Puzzles hub puts on screen, folded once.
 *
 * The hub is a report, not a live surface: it reads the catalogue, the attempt history
 * and the open session once per visit and folds them through the pure modules. A single
 * read also means the numbers on the screen all describe the same instant, which a set of
 * independent live queries could not promise.
 */

export interface HubResume {
  readonly session: PracticeSession
  readonly state: SessionState
}

export interface HubData {
  readonly stats: PuzzleStats
  readonly rating: GlickoRating
  readonly window: RatingWindow
  readonly rung: CurriculumRung
  readonly mastery: readonly ThemeMastery[]
  /** Solve rate over the last fifty attempts, or `null` before there are any. */
  readonly solveRate: number | null
  readonly attempted: number
  readonly bests: PuzzleBests
  readonly daily: { readonly puzzle: Puzzle; readonly attempt: PuzzleAttempt | undefined } | null
  readonly resume: HubResume | null
  /** The theme today's set leans on, or `null` when there is not enough history to say. */
  readonly focusTheme: string | null
}

const RECENT_WINDOW = 50

async function loadHub(): Promise<HubData> {
  const [stats, rating, history, bests, resume, day] = await Promise.all([
    puzzlesRepo.stats(),
    readRatingState(),
    loadAttemptHistory(),
    readBests(),
    findResumableSession(),
    currentDay(),
  ])

  const mastery = themeMastery(toThemeRecords(history))
  const recent = history.slice(0, RECENT_WINDOW)
  const daily = stats.total === 0 ? undefined : await loadDailyPuzzle(day)
  const dailyAttempts = daily === undefined ? [] : await attemptsRepo.listForPuzzle(daily.id)

  return {
    stats,
    rating,
    window: ratingWindow(rating),
    rung: curriculumRung(toSolvedByBand(history)),
    mastery,
    solveRate:
      recent.length === 0
        ? null
        : recent.filter((entry) => entry.attempt.solved).length / recent.length,
    attempted: history.length,
    bests: bests,
    daily:
      daily === undefined
        ? null
        : {
            puzzle: daily,
            attempt: dailyAttempts.find((attempt) => attempt.mode === 'daily-puzzle'),
          },
    resume: resume === null ? null : { session: resume.session, state: resume.state },
    focusTheme: weakestThemes(mastery, 1)[0] ?? null,
  }
}

export function usePuzzleHub(): AsyncState<HubData> {
  return useAsyncData(useCallback(() => loadHub(), []))
}

/** The empty hub's numbers, so the screen can render before anything has been imported. */
export const EMPTY_HUB_BESTS = EMPTY_BESTS

export type ImportStatus = 'idle' | 'running' | 'done' | 'error'

export interface PuzzleImportState {
  readonly status: ImportStatus
  readonly progress: ImportProgress | null
  readonly message: string | null
  readonly start: () => void
  readonly cancel: () => void
}

/**
 * Bringing the 10,000 puzzles in, from the hub's empty state.
 *
 * It runs through {@link PuzzleImportPort} rather than calling S10 directly so a test can
 * hand it a fake, and so the day S11's queue exists this becomes an enqueue without the
 * screen noticing.
 */
export function usePuzzleImport(port: PuzzleImportPort, onFinished: () => void): PuzzleImportState {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  const start = useCallback(() => {
    if (controller.current !== null) return
    const abort = new AbortController()
    controller.current = abort
    setStatus('running')
    setMessage(null)
    void port
      .run({ onProgress: setProgress, signal: abort.signal })
      .then((report) => {
        controller.current = null
        if (report.ok) {
          setStatus('done')
          onFinished()
          return
        }
        setStatus('error')
        setMessage(report.error.message)
      })
      .catch((cause: unknown) => {
        controller.current = null
        setStatus('error')
        setMessage(cause instanceof Error ? cause.message : 'The puzzles could not be imported.')
      })
  }, [onFinished, port])

  const cancel = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setStatus('idle')
  }, [])

  return { status, progress, message, start, cancel }
}
