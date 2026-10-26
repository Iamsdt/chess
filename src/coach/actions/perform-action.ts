import { validateFen } from '@/chess'
import {
  domainError,
  err,
  ok,
  type ActionAttachment,
  type Color,
  type Fen,
  type Result,
} from '@/domain'

import { readActionHref, type ActionPath } from './action-href'

/**
 * S21b · What confirming an action card does.
 *
 * Why the effects arrive as ports: the card runs in the browser against IndexedDB and the
 * router, but the rules below (which parameters an action needs, where it lands) are the
 * part worth testing, and they should not need either. `use-action-ports` binds the real
 * ones; a test passes spies.
 */
export interface ActionPorts {
  readonly navigate: (path: ActionPath) => void
  /** Draws a set on one theme (or the weakest, when `undefined`) and opens it as a session. */
  readonly startThemePuzzles: (theme: string | undefined, goal: number) => Promise<Result<void>>
  /** Banks a position the user is looking at; `added: false` when it was already there. */
  readonly bankPosition: (position: {
    readonly fen: Fen
    readonly color: Color
  }) => Promise<Result<{ readonly added: boolean }>>
  readonly savePlan: (items: readonly string[]) => Promise<Result<void>>
}

/** The line the card shows once the action went through. */
export interface ActionDone {
  readonly message?: string
}

const DEFAULT_GOAL = 10

function invalid(where: string, message: string): Result<never> {
  return err(domainError('validation', message, { where }))
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function performAction(
  attachment: ActionAttachment,
  ports: ActionPorts,
): Promise<Result<ActionDone>> {
  const target = readActionHref(attachment.href)
  switch (attachment.action) {
    case 'queue-puzzles': {
      const theme = target?.params.get('theme') ?? undefined
      const started = await ports.startThemePuzzles(
        theme,
        positiveInt(target?.params.get('goal') ?? null, DEFAULT_GOAL),
      )
      if (!started.ok) return started
      ports.navigate('/puzzles/solve')
      return ok({})
    }
    case 'add-to-mistake-bank': {
      const fen = validateFen(target?.params.get('fen') ?? '')
      if (!fen.ok) return fen
      const color = target?.params.get('color') === 'black' ? 'black' : 'white'
      const banked = await ports.bankPosition({ fen: fen.value, color })
      if (!banked.ok) return banked
      return ok(banked.value.added ? {} : { message: 'Already in the Mistake Bank' })
    }
    case 'start-drill': {
      if (!target?.path.startsWith('/drills/')) {
        return invalid('performAction.start-drill', 'This drill has no screen to open')
      }
      ports.navigate(target.path)
      return ok({})
    }
    case 'set-plan': {
      const saved = await ports.savePlan(attachment.items)
      if (!saved.ok) return saved
      ports.navigate('/')
      return ok({})
    }
    case 'open-lesson':
      return invalid('performAction.open-lesson', attachment.unavailable ?? 'Lessons are not ready')
    // Notes and spend confirmations belong to the memory and cost features; the card
    // acknowledges them and leaves the write to the caller that owns the store.
    case 'save-note':
    case 'confirm-spend':
      return ok({})
  }
}
