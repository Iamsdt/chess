import { z } from 'zod'

import { defineKvKey, kvRepo, newSessionId, profileRepo, sessionsRepo } from '@/data'
import { localDateOf, now } from '@/domain'
import { recordPractice } from '@/features/habit'

import { eloAfter, MIN_RATED_PLIES, scoreFor } from './sparring-rating'

import type { PlayState } from './machine'

/** Games already settled, newest last, so reopening a finished game never counts it twice. */
const SETTLED_GAMES = defineKvKey('settled-games', z.array(z.string()))
const SETTLED_KEEP = 50

export interface Settlement {
  /** The new sparring rating, when this game was rated. */
  readonly rating: number | undefined
  /** `false` when the game had already been settled and nothing changed. */
  readonly applied: boolean
}

/** Time the user spent on their own moves; the engine's delays are not practice. */
function yourThinkingMs(state: PlayState): number {
  return state.game.history.reduce(
    (total, move, ply) =>
      move.color === state.config.youPlay ? total + (state.moveTimesMs[ply] ?? 0) : total,
    0,
  )
}

/**
 * Everything a finished game is owed, applied exactly once: the Elo change to the sparring
 * rating, a practice session for the heatmap, and the streak.
 *
 * Why here and not in the state machine: the machine is pure and replayed on every reload;
 * this writes to storage, and "exactly once" has to survive that replay.
 */
export async function settleFinishedGame(state: PlayState): Promise<Settlement> {
  if (state.phase !== 'game-over') return { rating: undefined, applied: false }

  const settled = (await kvRepo.get(SETTLED_GAMES)) ?? []
  if (settled.includes(state.gameId)) return { rating: undefined, applied: false }
  await kvRepo.set(SETTLED_GAMES, [...settled, state.gameId].slice(-SETTLED_KEEP))

  let rating: number | undefined
  const score = scoreFor(state.result, state.config.youPlay)
  const profile = await profileRepo.get()
  if (
    profile !== undefined &&
    score !== undefined &&
    state.game.history.length >= MIN_RATED_PLIES
  ) {
    rating = eloAfter(profile.sparringRating, state.config.opponentRating, score)
    await profileRepo.update({ sparringRating: rating })
  }

  const ms = yourThinkingMs(state)
  if (ms > 0) {
    const at = state.endedAt ?? now()
    const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    await sessionsRepo.start({
      id: newSessionId(),
      kind: 'sparring',
      state: 'completed',
      day: localDateOf(at, timeZone),
      startedAt: state.startedAt,
      updatedAt: at,
      endedAt: at,
      durationMs: ms,
      itemsAttempted: 1,
      itemsCorrect: score === 1 ? 1 : 0,
      resumeState: {},
    })
    await recordPractice(ms)
  }
  return { rating, applied: true }
}
