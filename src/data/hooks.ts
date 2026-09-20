import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'

import type {
  Color,
  GameId,
  Job,
  JobState,
  LessonId,
  MistakeEntry,
  MoveRecord,
  Profile,
  Puzzle,
  PuzzleAttempt,
  PuzzleId,
  RepertoireNode,
  SessionKind,
  Settings,
  SrsCard,
  SrsState,
  StreakState,
} from '@/domain'

import { KV_KEYS } from './kv-keys'
import { defaultSettings, repositories } from './repositories'
import { estimateStorage, type StorageEstimateInfo } from './storage'

import type { KvKey } from './kv-keys'
import type { GameFilter, GamePage } from './repositories/games'
import type { MistakeFilter } from './repositories/mistakes'
import type { PuzzleSelection, PuzzleStats } from './repositories/puzzles'
import type { DueQuery } from './repositories/srs-cards'
import type { GameRow, LessonProgress, PracticeSession } from './schema'

/**
 * Live-query hooks.
 *
 * Every one of these re-runs when the tables it touched change, in this tab and
 * in any other, because that is what `useLiveQuery` observes. The rule for
 * adding one: the hook calls a repository, never Dexie, so the query stays
 * testable without React.
 *
 * A hook returns `undefined` on its first render, before the query has resolved.
 * Screens treat that as their loading state; it is never the same as "empty".
 *
 * Filter objects are dependencies, so a caller that builds one inline must wrap
 * it in `useMemo`; otherwise every render is a new object and the subscription
 * restarts on each one.
 */

export function useGames(filter?: GameFilter, page?: GamePage): GameRow[] | undefined {
  return useLiveQuery(() => repositories.games.list(filter, page), [filter, page])
}

export function useGameCount(filter?: GameFilter): number | undefined {
  return useLiveQuery(() => repositories.games.count(filter), [filter])
}

export function useRecentGames(limit = 10): GameRow[] | undefined {
  return useLiveQuery(() => repositories.games.listRecent(limit), [limit])
}

export function useGame(id: GameId | undefined): GameRow | undefined {
  return useLiveQuery(
    () => (id === undefined ? Promise.resolve(undefined) : repositories.games.get(id)),
    [id],
  )
}

export function useGameMoves(id: GameId | undefined): MoveRecord[] | undefined {
  return useLiveQuery(
    () => (id === undefined ? Promise.resolve([]) : repositories.moves.listForGame(id)),
    [id],
  )
}

export function usePuzzle(id: PuzzleId | undefined): Puzzle | undefined {
  return useLiveQuery(
    () => (id === undefined ? Promise.resolve(undefined) : repositories.puzzles.get(id)),
    [id],
  )
}

export function usePuzzleSelection(selection?: PuzzleSelection): Puzzle[] | undefined {
  return useLiveQuery(() => repositories.puzzles.select(selection), [selection])
}

export function usePuzzleStats(): PuzzleStats | undefined {
  return useLiveQuery(() => repositories.puzzles.stats(), [])
}

export function useRecentAttempts(limit = 20): PuzzleAttempt[] | undefined {
  return useLiveQuery(() => repositories.attempts.listRecent(limit), [limit])
}

export function useDueCards(query?: DueQuery): SrsCard[] | undefined {
  return useLiveQuery(() => repositories.srsCards.listDue(query), [query])
}

export function useDueCount(query?: DueQuery): number | undefined {
  return useLiveQuery(() => repositories.srsCards.countDue(query), [query])
}

export function useSrsCountsByState(): Record<SrsState, number> | undefined {
  return useLiveQuery(() => repositories.srsCards.countsByState(), [])
}

export function useMistakes(filter?: MistakeFilter): MistakeEntry[] | undefined {
  return useLiveQuery(() => repositories.mistakes.list(filter), [filter])
}

export function useMistakeCount(filter?: MistakeFilter): number | undefined {
  return useLiveQuery(() => repositories.mistakes.count(filter), [filter])
}

export function useLessonProgress(lessonId: LessonId | undefined): LessonProgress | undefined {
  return useLiveQuery(
    () =>
      lessonId === undefined
        ? Promise.resolve(undefined)
        : repositories.lessonsProgress.get(lessonId),
    [lessonId],
  )
}

export function useAllLessonProgress(): LessonProgress[] | undefined {
  return useLiveQuery(() => repositories.lessonsProgress.list(), [])
}

export function useRepertoireRoots(color: Color): RepertoireNode[] | undefined {
  return useLiveQuery(() => repositories.repertoire.listRoots(color), [color])
}

export function useRepertoireTree(color: Color): RepertoireNode[] | undefined {
  return useLiveQuery(() => repositories.repertoire.listByColor(color), [color])
}

export function useActiveSession(kind?: SessionKind): PracticeSession | undefined {
  return useLiveQuery(() => repositories.sessions.findActive(kind), [kind])
}

export function useRecentSessions(limit = 20): PracticeSession[] | undefined {
  return useLiveQuery(() => repositories.sessions.listRecent(limit), [limit])
}

export function useActiveJobs(): Job[] | undefined {
  return useLiveQuery(() => repositories.jobs.listActive(), [])
}

export function useJobCounts(): Record<JobState, number> | undefined {
  return useLiveQuery(() => repositories.jobs.countByState(), [])
}

/** Never `undefined` after the first render: absent settings mean the defaults. */
export function useSettings(): Settings {
  return useLiveQuery(() => repositories.settings.get(), [], defaultSettings())
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => repositories.profile.get(), [])
}

export function useStreak(): StreakState | undefined {
  return useLiveQuery(() => repositories.kv.get(KV_KEYS.streak), [])
}

/** Why generic: every sprint keeps its own small singletons in `kv`. */
export function useKvValue<T>(key: KvKey<T>): T | undefined {
  return useLiveQuery(() => repositories.kv.get(key), [key])
}

export interface StorageState {
  estimate: StorageEstimateInfo | undefined
  /** `true` once the browser has answered, whether or not it could. */
  checked: boolean
  refresh: () => void
}

/**
 * The storage meter and the quota warning.
 *
 * Not a live query: `navigator.storage.estimate()` is not a Dexie table and does
 * not change on write, so it is polled on mount and whenever a screen asks.
 */
export function useStorageEstimate(): StorageState {
  const [estimate, setEstimate] = useState<StorageEstimateInfo | undefined>(undefined)
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(() => {
    void estimateStorage().then((result) => {
      setEstimate(result.ok ? result.value : undefined)
      setChecked(true)
    })
  }, [])

  useEffect(refresh, [refresh])

  return { estimate, checked, refresh }
}
