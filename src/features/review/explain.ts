import type { MoveQuality, San } from '@/domain'

/**
 * S13 · Plain-language explanations, as templates.
 *
 * No model writes these. Each sentence is filled in from the engine's numbers and the
 * move's own notation, so it cannot name a move or a line the engine did not give. Kept
 * apart from the review so the wording can change without touching the analysis, and so
 * a test can hold every template to the engine data it is built from.
 */

export interface ExplainInput {
  readonly san: San
  readonly quality: MoveQuality
  /** The engine's preferred move when it differs from the one played. */
  readonly bestSan: San | undefined
  /** The mover's winning chances before and after, as percentages. */
  readonly winBefore: number
  readonly winAfter: number
  readonly matedAfter: boolean
}

function percent(value: number): string {
  return `${String(Math.round(value))}%`
}

const VERDICT: Readonly<Partial<Record<MoveQuality, string>>> = {
  inaccuracy: 'was a small slip',
  mistake: 'was a mistake',
  miss: 'let a win slip away',
  blunder: 'was a blunder',
}

/**
 * Plain words for one move, from the numbers alone.
 *
 * It states how the mover's winning chances changed and what the engine preferred. It
 * does not guess at why: "you missed a fork" would need to know what the engine saw, and
 * a sentence that might be wrong is worse than a shorter one that cannot be.
 */
export function explainMove(input: ExplainInput): string {
  const { san, quality, bestSan, winBefore, winAfter, matedAfter } = input
  const verdict = VERDICT[quality]
  if (verdict !== undefined) {
    const chances = `Your winning chances went from ${percent(winBefore)} to ${percent(winAfter)}.`
    const mate = matedAfter ? ' It allows a forced mate.' : ''
    const better = bestSan === undefined ? '' : ` ${bestSan} was the engine's choice.`
    return `${san} ${verdict}. ${chances}${mate}${better}`
  }
  switch (quality) {
    case 'brilliant':
      return `${san} gives up material for something better, and the engine agrees.`
    case 'great':
      return `${san} was the only move that held the position together.`
    case 'best':
      return `${san} is the engine's top choice.`
    case 'excellent':
      return `${san} is as good as the engine's first choice, within a point.`
    case 'good':
      return `${san} is a sound move.`
    case 'book':
      return `${san} is a standard opening move.`
    default:
      return `${san}.`
  }
}
