import 'fake-indexeddb/auto'

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { toGameId } from '@/domain'

import { db } from './db'
import {
  useActiveJobs,
  useDueCount,
  useGame,
  useGameMoves,
  useProfile,
  useRecentGames,
  useSettings,
  useStreak,
} from './hooks'
import { repositories } from './repositories'
import { seedDatabase } from './seed'

/**
 * A smoke test per hook family: the hook resolves, and it resolves again when
 * the underlying table changes. The queries themselves are covered by the
 * repository tests, so these assert the wiring rather than the data.
 */
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

describe('live query hooks', () => {
  it('start undefined and settle on the query result', async () => {
    await seedDatabase(db, { games: 3 })

    const { result } = renderHook(() => useRecentGames(2))
    expect(result.current).toBeUndefined()
    await waitFor(() => {
      expect(result.current?.length).toBe(2)
    })
  })

  it('re-run when the table they read changes', async () => {
    const { result } = renderHook(() => useActiveJobs())
    await waitFor(() => {
      expect(result.current).toEqual([])
    })

    await seedDatabase(db, { games: 1 })
    await waitFor(() => {
      expect(result.current?.length).toBe(1)
    })
  })

  it('hand a single row and its moves to the review screen', async () => {
    await seedDatabase(db, { games: 2 })
    const id = toGameId('game-seed-0')

    const { result: game } = renderHook(() => useGame(id))
    const { result: moves } = renderHook(() => useGameMoves(id))

    await waitFor(() => {
      expect(game.current?.id).toBe('game-seed-0')
      expect(moves.current?.length).toBe(4)
    })
  })

  it('answer for an absent id without throwing', async () => {
    const { result } = renderHook(() => useGame(undefined))
    await waitFor(() => {
      expect(result.current).toBeUndefined()
    })
    expect(await repositories.games.count()).toBe(0)
  })

  it('give settings their defaults before anything is saved', async () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.theme).toBe('system')

    await seedDatabase(db, { games: 1 })
    await waitFor(() => {
      expect(result.current.dailyGoalMinutes).toBe(15)
    })
  })

  it('surface the profile, the streak and the due count', async () => {
    await seedDatabase(db, { games: 1, srsCards: 4 })

    const { result: profile } = renderHook(() => useProfile())
    const { result: streak } = renderHook(() => useStreak())
    const { result: due } = renderHook(() => useDueCount())

    await waitFor(() => {
      expect(profile.current?.displayName).toBe('Shudipto')
      expect(streak.current?.current).toBe(12)
      expect(typeof due.current).toBe('number')
    })
  })
})
