import { applyMove, createGame, hangingPieces, pieceAt, type PlayedMove } from '@/chess'
import { pieceName } from '@/coach/visualization/narrate'
import type {
  Arrow,
  BoardView,
  CoachEval,
  Color,
  EngineScore,
  Fen,
  SageBoardAttachment,
  SageBoardStep,
  Square,
} from '@/domain'

import type { CoachToolEnv } from './types'

/**
 * S21b · The pure parts of the Sage board tools, and the per-answer board registry.
 *
 * Why a registry: a board is opened by one tool call and then marked, re-viewed or handed to
 * the user by later ones, and the model can only refer to it by a short id. The ids live in
 * memory for one answer, so the model can address a Sage board and nothing else, never the
 * board the user is playing on (coach-agent.md §7 "Your board is yours").
 */

export type Replay =
  | { readonly ok: true; readonly moves: readonly PlayedMove[]; readonly fen: Fen }
  | { readonly ok: false; readonly error: string }

/**
 * Replays `line` from `fen` through the rules (§7 "Line validation").
 *
 * Why every board tool goes through here: a variation the model wrote is a claim, and a card
 * that animates an impossible move would teach the wrong thing. The moves that come back are
 * the rules' own, so the SAN on screen is canonical whatever spelling the model used.
 */
export function replayLine(fen: Fen, line: readonly string[]): Replay {
  const start = createGame(fen)
  if (!start.ok) return { ok: false, error: `Not a legal position: ${fen}` }
  let game = start.value
  for (const [index, text] of line.entries()) {
    const next = applyMove(game, text)
    if (!next.ok) {
      return {
        ok: false,
        error: `Move ${String(index + 1)} ("${text}") is not legal there, so nothing was shown.`,
      }
    }
    game = next.value
  }
  return { ok: true, moves: game.history, fen: game.fen }
}

/** A score as the card wants it: white-centred, centipawns or mate. */
export function evalOf(score: EngineScore, sideToMove: Color): CoachEval {
  const sign = sideToMove === 'white' ? 1 : -1
  return score.kind === 'cp' ? { cp: sign * score.value } : { mate: sign * score.moves }
}

export const colorName = (color: Color): string => (color === 'white' ? 'White' : 'Black')
export const otherColor = (color: Color): Color => (color === 'white' ? 'black' : 'white')

export interface StepInit {
  readonly caption: string
  readonly san?: PlayedMove['san']
  readonly arrows?: readonly Arrow[]
  readonly focus?: readonly Square[]
  readonly danger?: readonly Square[]
  readonly eval?: CoachEval
  readonly yourTurn?: NonNullable<SageBoardStep['yourTurn']>
}

export function makeStep(init: StepInit): SageBoardStep {
  return {
    caption: init.caption,
    arrows: [...(init.arrows ?? [])],
    focus: [...(init.focus ?? [])],
    danger: [...(init.danger ?? [])],
    controlMap: false,
    ...(init.san === undefined ? {} : { san: init.san }),
    ...(init.eval === undefined ? {} : { eval: init.eval }),
    ...(init.yourTurn === undefined ? {} : { yourTurn: init.yourTurn }),
  }
}

/**
 * The danger a move creates for `victim`: pieces that hang after it and did not before.
 *
 * Why the difference and not the list: a knight that was already loose is not what the move
 * did, and pinning it in the warning colour would blame the wrong move.
 */
export function newDanger(before: Fen, after: Fen, victim: Color): readonly Square[] {
  const already = new Set(hangingPieces(before, victim).map((piece) => piece.square))
  return hangingPieces(after, victim)
    .filter((piece) => !already.has(piece.square))
    .map((piece) => piece.square)
}

/** What a move did, in plain words the rules can vouch for: capture, check, mate, hanging. */
export function describeMove(move: PlayedMove, danger: readonly Square[], after: Fen): string {
  const parts: string[] = []
  if (move.captured !== undefined) parts.push(`takes the ${pieceName(move.captured)}`)
  if (move.isCheckmate) parts.push('checkmate')
  else if (move.isCheck) parts.push('check')
  for (const square of danger) {
    const piece = pieceAt(after, square)
    if (piece !== null) parts.push(`the ${pieceName(piece.type)} on ${square} hangs`)
  }
  return parts.length === 0 ? '' : ` ${parts.join('; ')}.`
}

/* ------------------------------------------------------------------- registry */

interface Marks {
  /** The step the marks sit on: the board's final step when Sage first drew. */
  readonly at: number
  readonly arrows: readonly Arrow[]
  readonly focus: readonly Square[]
  readonly danger: readonly Square[]
  readonly controlMap: boolean
}

const NO_MARKS: Marks = { at: -1, arrows: [], focus: [], danger: [], controlMap: false }

interface Entry {
  readonly base: SageBoardAttachment
  readonly marks: Marks
}

export interface BoardMarkInput {
  readonly arrows?: readonly Arrow[]
  readonly focus?: readonly Square[]
  readonly danger?: readonly Square[]
  readonly controlMap?: boolean
}

export interface BoardRegistry {
  /** Pins `card` in the chat and returns the id later calls address it by. */
  open: (card: SageBoardAttachment) => string
  /** The card as it stands now, marks included; `undefined` for an id this answer never opened. */
  get: (id: string) => SageBoardAttachment | undefined
  /** Adds to what Sage has drawn on a board and pins the updated card. */
  draw: (id: string, marks: BoardMarkInput) => SageBoardAttachment | undefined
  /** Removes everything `draw` added, leaving the board as it was opened. */
  clear: (id: string) => SageBoardAttachment | undefined
  setView: (id: string, view: BoardView) => SageBoardAttachment | undefined
  /** Appends a step to a board (a hand-over) and pins the updated card. */
  append: (id: string, step: SageBoardStep) => SageBoardAttachment | undefined
  ids: () => readonly string[]
}

const unique = <T>(items: readonly T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = key(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/** The opened card with Sage's marks laid over the step they were drawn on. */
function render({ base, marks }: Entry): SageBoardAttachment {
  return {
    ...base,
    steps: base.steps.map((step, index) =>
      index === marks.at
        ? {
            ...step,
            arrows: unique([...step.arrows, ...marks.arrows], (a) => `${a.from}${a.to}${a.kind}`),
            focus: unique([...step.focus, ...marks.focus], String),
            danger: unique([...step.danger, ...marks.danger], String),
            controlMap: step.controlMap || marks.controlMap,
          }
        : step,
    ),
  }
}

function createRegistry(emit: CoachToolEnv['emit']): BoardRegistry {
  const boards = new Map<string, Entry>()

  const change = (id: string, next: (entry: Entry) => Entry): SageBoardAttachment | undefined => {
    const entry = boards.get(id)
    if (entry === undefined) return undefined
    const updated = next(entry)
    boards.set(id, updated)
    const card = render(updated)
    emit(card)
    return card
  }

  return {
    open: (card) => {
      const id = `board-${String(boards.size + 1)}`
      boards.set(id, { base: card, marks: NO_MARKS })
      emit(card)
      return id
    },
    get: (id) => {
      const entry = boards.get(id)
      return entry === undefined ? undefined : render(entry)
    },
    draw: (id, add) =>
      change(id, (entry) => ({
        ...entry,
        marks: {
          at: entry.marks.at < 0 ? entry.base.steps.length - 1 : entry.marks.at,
          arrows: [...entry.marks.arrows, ...(add.arrows ?? [])],
          focus: [...entry.marks.focus, ...(add.focus ?? [])],
          danger: [...entry.marks.danger, ...(add.danger ?? [])],
          controlMap: entry.marks.controlMap || add.controlMap === true,
        },
      })),
    clear: (id) => change(id, (entry) => ({ ...entry, marks: NO_MARKS })),
    setView: (id, view) => change(id, (entry) => ({ ...entry, base: { ...entry.base, view } })),
    append: (id, step) =>
      change(id, (entry) => ({
        ...entry,
        base: { ...entry.base, steps: [...entry.base.steps, step] },
      })),
    ids: () => [...boards.keys()],
  }
}

const registries = new WeakMap<CoachToolEnv, BoardRegistry>()

/**
 * The boards of one answer. Keyed by the env because both tool groups that touch boards
 * (`boardTools`, `visualizationTools`) are built from the same env and must see the same ids.
 */
export function boardsFor(env: CoachToolEnv): BoardRegistry {
  const existing = registries.get(env)
  if (existing !== undefined) return existing
  const created = createRegistry(env.emit)
  registries.set(env, created)
  return created
}
