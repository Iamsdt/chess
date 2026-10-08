import {
  timestampFromDate,
  toSrsCardId,
  type SrsCard,
  type SrsCardId,
  type SrsSubject,
} from '@/domain'

/** Matches the repository's own id format, so a card minted here and one minted there sort alike. */
function mintCardId(): SrsCardId {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return toSrsCardId(`card_${hex}`)
}

/**
 * A card that has never been reviewed: due straight away, so the bank has work in it.
 *
 * `difficulty` starts at the schema's midpoint and is replaced by the first review, which
 * is why nothing reads it while the state is `new`.
 */
export function newCardFrom(subject: SrsSubject, now: Date, id: SrsCardId = mintCardId()): SrsCard {
  const at = timestampFromDate(now)
  return {
    id,
    subject,
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

/** Whether a card is still in the rotation. Mastered cards have left it. */
export function isActive(card: SrsCard): boolean {
  return card.state !== 'mastered'
}
