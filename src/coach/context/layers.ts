import type {
  CoachContext,
  CoachMessage,
  CoachPositionContext,
  CoachTaughtItem,
  GameMeta,
} from '@/domain'

import { describeEngineLine, estimateTokens } from '../runtime/system-prompt'

import { fitThread, threadBudget } from './thread'

/**
 * What each memory layer holds, as lines a person can read (coach-agent.md §6).
 *
 * Why this is a function of the finished context and not a second bookkeeping pass in the
 * builder: "what Sage sees" has to be what was sent. Rendering the layers from the `CoachContext`
 * the port receives means the sheet cannot drift from the request, and a field that is not in the
 * context cannot be shown as if it were.
 */

export const CONTEXT_LAYERS = ['turn', 'session', 'profile', 'taught', 'summary'] as const
export type ContextLayerId = (typeof CONTEXT_LAYERS)[number]

export interface ContextLayer {
  readonly id: ContextLayerId
  readonly label: string
  readonly holds: string
  /** One entry per fact; empty when the layer has nothing to send. */
  readonly lines: readonly string[]
  readonly tokens: number
}

const LAYER_INFO: Readonly<Record<ContextLayerId, { label: string; holds: string }>> = {
  turn: { label: 'Turn', holds: 'This position and your last question' },
  session: { label: 'Session', holds: 'This chat so far' },
  profile: { label: 'Profile', holds: 'Rating, weak themes, goals, recent games' },
  taught: { label: 'Taught', holds: 'Concepts covered, so Sage builds on them' },
  summary: { label: 'Summary', holds: 'A digest of older chats' },
}

const MAX_QUESTION_CHARS = 200

export function positionLine(position: CoachPositionContext): string {
  const side = position.fen.split(' ')[1] === 'b' ? 'Black' : 'White'
  const last = position.lastMove === undefined ? '' : `, after ${position.lastMove}`
  return `Position ${position.fen} (${side} to move${last}), seen from ${position.orientation}`
}

export function gameLine(game: GameMeta): string {
  const opponent = game.youPlay === 'white' ? game.black : game.white
  const opening = game.opening === undefined ? '' : `, ${game.opening.name}`
  return `As ${game.youPlay} vs ${opponent.name}, ${game.result}${opening}`
}

export function taughtLine(item: CoachTaughtItem): string {
  const when = item.daysAgo === 0 ? 'today' : `${String(item.daysAgo)}d ago`
  return `${item.label} (${when}, ${String(item.times)}x)`
}

export function userLine(user: NonNullable<CoachContext['user']>): string {
  const goals = user.goals === undefined || user.goals.length === 0 ? '' : ` · goals: ${user.goals.join(', ')}`
  return `${user.displayName}: puzzles ${String(user.puzzleRating)}, play ${String(user.sparringRating)}${goals}`
}

function turnLines(context: CoachContext, question: CoachMessage | undefined): string[] {
  const lines: string[] = []
  if (context.position !== undefined) lines.push(positionLine(context.position))
  if (context.activePuzzle !== undefined) {
    lines.push('A puzzle is on the board. Its solution is not sent.')
  }
  if (context.pgn !== undefined && context.pgn.trim() !== '') lines.push(`Moves: ${context.pgn}`)
  if (context.allowEngineLines) {
    for (const line of context.engineLines) {
      lines.push(`Engine ${describeEngineLine(line, context.position?.fen)}`)
    }
  }
  if (question !== undefined) {
    const text = question.text.trim()
    const shown = text.length > MAX_QUESTION_CHARS ? `${text.slice(0, MAX_QUESTION_CHARS)}…` : text
    lines.push(`You asked: ${shown}`)
  }
  return lines
}

function profileLines(context: CoachContext): string[] {
  return [
    ...(context.user === undefined ? [] : [userLine(context.user)]),
    ...(context.weakThemes.length === 0 ? [] : [`Weakest themes: ${context.weakThemes.join(', ')}`]),
    ...context.recentGames.map(gameLine),
  ]
}

function layer(id: ContextLayerId, lines: readonly string[]): ContextLayer {
  return { id, ...LAYER_INFO[id], lines, tokens: estimateTokens(lines.join('\n')) }
}

/**
 * The five layers of one request, in the spec's order.
 *
 * `thread` is the whole chat including the new question; the question is shown in Turn and the
 * rest, trimmed the way `useCoach` trims it before sending, is Session.
 */
export function describeLayers(
  context: CoachContext,
  thread: readonly CoachMessage[],
): readonly ContextLayer[] {
  const last = thread[thread.length - 1]
  const question = last?.role === 'user' ? last : undefined
  const earlier = question === undefined ? thread : thread.slice(0, -1)
  const sent = fitThread(earlier, threadBudget(context.tokenBudget))
  const session = sent.map((message) => `${message.role === 'user' ? 'You' : 'Sage'}: ${message.text.trim()}`)

  return [
    layer('turn', turnLines(context, question)),
    layer('session', session),
    layer('profile', profileLines(context)),
    layer('taught', (context.taught ?? []).map(taughtLine)),
    layer('summary', context.summary === undefined ? [] : [context.summary]),
  ]
}
