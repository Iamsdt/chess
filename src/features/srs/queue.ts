import type { SrsCard } from '@/domain'

/**
 * Today's due queue: what is owed, capped, and mixed so no one topic arrives in a block.
 *
 * Why caps: a bank that dumps forty cards on the first day after a bad game teaches people
 * to stop opening it. Why exempt learning cards from the caps: they are mid-conversation
 * (seen minutes ago) and dropping them would strand a card between two steps.
 */

export interface QueueOptions {
  /** How many `new` cards may be introduced. Pass what is *left* today, not the daily total. */
  readonly dailyNewCap: number
  /** How many settled `review` cards may be asked. Same: pass what is left. */
  readonly dailyReviewCap: number
  /**
   * What counts as "the same kind of thing" when mixing. Defaults to the card's subject
   * kind (mistake, puzzle, lesson, opening); the mistakes screen passes the primary theme.
   */
  readonly groupOf?: ((card: SrsCard) => string) | undefined
}

const byDue = (left: SrsCard, right: SrsCard): number =>
  left.due - right.due || left.createdAt - right.createdAt || (left.id < right.id ? -1 : 1)

/**
 * Round-robin across groups, each group keeping its own due order.
 *
 * Groups are visited in the order of their most overdue card, so interleaving never
 * pushes the card that has waited longest behind the rest.
 */
export function interleave(
  cards: readonly SrsCard[],
  groupOf: (card: SrsCard) => string,
): SrsCard[] {
  const groups = new Map<string, SrsCard[]>()
  for (const card of [...cards].sort(byDue)) {
    const key = groupOf(card)
    const bucket = groups.get(key)
    if (bucket === undefined) groups.set(key, [card])
    else bucket.push(card)
  }
  const buckets = [...groups.values()]
  const mixed: SrsCard[] = []
  for (let round = 0; mixed.length < cards.length; round += 1) {
    for (const bucket of buckets) {
      const card = bucket[round]
      if (card !== undefined) mixed.push(card)
    }
  }
  return mixed
}

/**
 * The cards to ask now, in the order to ask them.
 *
 * Order: cards already in learning or relearning, then settled reviews, then new cards,
 * each block mixed by group. Mastered cards and cards not yet due are left out.
 */
export function buildDueQueue(cards: readonly SrsCard[], now: Date, opts: QueueOptions): SrsCard[] {
  const at = now.getTime()
  const groupOf = opts.groupOf ?? ((card: SrsCard) => card.subject.kind)
  const due = cards.filter((card) => card.state !== 'mastered' && card.due <= at)

  const inProgress = due.filter((card) => card.state === 'learning' || card.state === 'relearning')
  const settled = due.filter((card) => card.state === 'review').sort(byDue)
  const fresh = due.filter((card) => card.state === 'new').sort(byDue)

  return [
    ...interleave(inProgress, groupOf),
    ...interleave(settled.slice(0, Math.max(opts.dailyReviewCap, 0)), groupOf),
    ...interleave(fresh.slice(0, Math.max(opts.dailyNewCap, 0)), groupOf),
  ]
}
