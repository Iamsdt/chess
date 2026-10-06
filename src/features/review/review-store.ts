import {
  gamesRepo,
  mistakesRepo,
  movesRepo,
  newMistakeId,
  newSrsCardId,
  srsCardsRepo,
} from '@/data'
import { now, ok, type GameId, type Result, type SrsCard } from '@/domain'

import type { GameReview } from './analyse'

/** A card that has never been reviewed: due straight away, so the Mistake Bank has work in it. */
function newCard(
  mistakeId: SrsCard['subject'],
  id: SrsCard['id'],
  at: SrsCard['createdAt'],
): SrsCard {
  return {
    id,
    subject: mistakeId,
    state: 'new',
    due: at,
    lastReviewedAt: null,
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    learningStep: null,
    consecutiveCorrect: 0,
    masteredAt: null,
    createdAt: at,
    updatedAt: at,
  }
}

export interface SavedReview {
  /** How many mistakes this review put in the bank. */
  readonly mistakes: number
}

/**
 * Writes a finished review: every move's verdict, the game's accuracy and counts, and the
 * mistakes worth practising, each with a spaced-repetition card.
 *
 * Why it clears the game's earlier mistakes first: a game can be reviewed again (a better
 * engine, a changed setting), and the bank must hold one set of cards for it, not two.
 */
export async function saveReview(gameId: GameId, review: GameReview): Promise<Result<SavedReview>> {
  const moves = await movesRepo.putMany(review.moves)
  if (!moves.ok) return moves

  const earlier = await mistakesRepo.listForGame(gameId)
  for (const entry of earlier) {
    if (entry.srsCardId !== undefined) await srsCardsRepo.remove(entry.srsCardId)
  }
  const cleared = await mistakesRepo.removeForGame(gameId)
  if (!cleared.ok) return cleared

  const at = now()
  const entries = review.mistakes.map((draft) => {
    const id = newMistakeId()
    const cardId = newSrsCardId()
    return {
      entry: { ...draft, id, createdAt: at, updatedAt: at, srsCardId: cardId },
      card: newCard({ kind: 'mistake', mistakeId: id }, cardId, at),
    }
  })
  if (entries.length > 0) {
    const added = await mistakesRepo.addMany(entries.map((item) => item.entry))
    if (!added.ok) return added
    const cards = await srsCardsRepo.putMany(entries.map((item) => item.card))
    if (!cards.ok) return cards
  }

  const updated = await gamesRepo.update(gameId, {
    reviewState: 'reviewed',
    ...(review.accuracy === undefined ? {} : { accuracy: review.accuracy }),
    qualityCounts: review.counts,
    mistakeCount: entries.length,
  })
  if (!updated.ok) return updated
  return ok({ mistakes: entries.length })
}
