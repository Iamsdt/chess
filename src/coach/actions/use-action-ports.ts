import { useRouter } from '@tanstack/react-router'
import { useMemo } from 'react'
import { z } from 'zod'

import { defineKvKey, kvRepo, mistakesRepo, newMistakeId, profileRepo, srsCardsRepo } from '@/data'
import { domainError, err, localDateOf, now, ok } from '@/domain'

import type { ActionPorts } from './perform-action'

/**
 * S21b · The real effects behind a confirmed action card.
 *
 * Why the feature modules are imported on click: a card is confirmed rarely, and the
 * puzzle queue, the engine and the SRS scheduler are each a chunk the chat panel should not
 * pull in just to render.
 */

/** Today's path as the user confirmed it. One row: setting a new plan replaces the old. */
export const TODAYS_PLAN_KEY = defineKvKey(
  'coach:todays-plan',
  z.object({ day: z.string(), items: z.array(z.string()), setAt: z.number() }),
)

const BANK_MOVETIME_MS = 600

export function createActionPorts(navigate: ActionPorts['navigate']): ActionPorts {
  return {
    navigate,

    startThemePuzzles: async (theme, goal) => {
      const { configFor, startNewSession } = await import('@/features/puzzles')
      await startNewSession(
        configFor('theme-puzzles', { goal, ...(theme === undefined ? {} : { theme }) }),
      )
      return ok(undefined)
    },

    bankPosition: async ({ fen, color }) => {
      const [{ engine }, { uciToSan }, { newCardFrom }] = await Promise.all([
        import('@/engine'),
        import('@/chess'),
        import('@/features/srs'),
      ])
      const searched = await engine.bestMove(fen, {
        movetimeMs: BANK_MOVETIME_MS,
        lane: 'interactive',
      })
      if (!searched.ok) return searched
      const { move, eval: reading } = searched.value
      if (move === null) {
        return err(
          domainError('validation', 'This position has no move to practise', {
            where: 'bankPosition',
          }),
        )
      }
      const best = uciToSan(fen, move)
      if (!best.ok) return best

      const existing = await mistakesRepo.list({ source: 'manual' })
      if (existing.some((entry) => entry.fen === fen)) return ok({ added: false })

      const at = now()
      const id = newMistakeId()
      const card = newCardFrom({ kind: 'mistake', mistakeId: id }, new Date(at))
      const added = await mistakesRepo.add({
        id,
        createdAt: at,
        updatedAt: at,
        source: 'manual',
        fen,
        yourColor: color,
        // The position was saved, not a move: the "played" side repeats the best move, as a
        // skipped puzzle does.
        playedSan: best.value,
        playedUci: move,
        bestSan: best.value,
        bestUci: move,
        solution: [move],
        quality: 'miss',
        evalBefore: reading.score,
        evalAfter: reading.score,
        themes: [],
        explanation: 'Saved from a chat with Sage. Find the strongest move here.',
        originLabel: 'Saved from Sage',
        srsCardId: card.id,
      })
      if (!added.ok) return added
      const stored = await srsCardsRepo.put(card)
      return stored.ok ? ok({ added: true }) : stored
    },

    savePlan: async (items) => {
      const profile = await profileRepo.get()
      const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      const at = now()
      const saved = await kvRepo.set(TODAYS_PLAN_KEY, {
        day: localDateOf(at, timeZone),
        items: [...items],
        setAt: at,
      })
      return saved.ok ? ok(undefined) : saved
    },
  }
}

/**
 * Ports bound to the router. Outside a router (a story, a test) navigation is a no-op, so
 * the card still renders and its effects still run.
 */
export function useActionPorts(): ActionPorts {
  const router = useRouter({ warn: false }) as ReturnType<typeof useRouter> | undefined
  return useMemo(
    () =>
      createActionPorts((path) => {
        void router?.navigate({ to: path })
      }),
    [router],
  )
}
