import type { LegalMoveMap } from '@/board'
import { applyMove, createGame, legalMoves } from '@/chess'
import { toSquare, type Lesson, type LessonStep, type Square } from '@/domain'

/**
 * S16 · The lesson player's rules, with no React and no storage.
 *
 * A lesson is data: `info` steps are read, `move` steps are played. Everything here
 * works on the declared step, so all 49 tutorials and any imported pack run through
 * the same code — there is no lesson-specific behaviour to get wrong.
 */

export type MoveVerdict = 'correct' | 'alternative' | 'wrong' | 'illegal'

/** `Nxe7+!?` and `Nxe7` are the same move; authors and chess.js disagree about the suffix. */
function core(san: string): string {
  return san.replace(/[+#!?]/g, '')
}

export interface Judgement {
  readonly verdict: MoveVerdict
  /** The move in SAN, when it was legal — what the feedback quotes back. */
  readonly san: string | undefined
  /** The position after the move, for a correct or accepted-alternative move. */
  readonly fenAfter: string | undefined
}

/** Decides what a played move is worth on this step. */
export function judgeMove(
  step: LessonStep,
  played: {
    readonly from: Square
    readonly to: Square
    readonly promotion?: 'q' | 'r' | 'b' | 'n'
  },
): Judgement {
  const game = createGame(step.fen)
  if (!game.ok) return { verdict: 'illegal', san: undefined, fenAfter: undefined }
  const moved = applyMove(game.value, played)
  if (!moved.ok) return { verdict: 'illegal', san: undefined, fenAfter: undefined }

  const san = moved.value.history.at(-1)?.san
  if (san === undefined) return { verdict: 'illegal', san: undefined, fenAfter: undefined }
  const played_ = core(san)
  if (step.expectedMoves.some((expected) => core(expected) === played_)) {
    return { verdict: 'correct', san, fenAfter: moved.value.fen }
  }
  if (step.alternativeMoves.some((alternative) => core(alternative) === played_)) {
    return { verdict: 'alternative', san, fenAfter: moved.value.fen }
  }
  return { verdict: 'wrong', san, fenAfter: undefined }
}

/** Which squares each piece may move to, in the shape the board wants. */
export function legalMoveMap(fen: string): LegalMoveMap {
  const game = createGame(fen)
  const map = new Map<Square, Square[]>()
  if (!game.ok) return map
  for (const move of legalMoves(game.value)) {
    map.set(move.from, [...(map.get(move.from) ?? []), toSquare(move.to)])
  }
  return map
}

/** The position a step leads to once it is played correctly, or the same one for `info`. */
export function positionAfter(step: LessonStep): string {
  const expected = step.expectedMoves[0]
  if (step.kind !== 'move' || expected === undefined) return step.fen
  const game = createGame(step.fen)
  if (!game.ok) return step.fen
  const moved = applyMove(game.value, expected)
  return moved.ok ? moved.value.fen : step.fen
}

const PIECE_NAMES: Readonly<Record<string, string>> = {
  N: 'knight',
  B: 'bishop',
  R: 'rook',
  Q: 'queen',
  K: 'king',
}

export interface HintRung {
  readonly label: string
  readonly text: string
}

/**
 * The hint ladder: a nudge, then the piece, then the move itself.
 *
 * The author's own hint is the first rung when there is one, because it knows the idea;
 * the other two are derived from the expected move so every move step has all three.
 */
export function hintLadder(step: LessonStep): HintRung[] {
  const expected = step.expectedMoves[0]
  if (step.kind !== 'move' || expected === undefined) return []
  const first = step.hints[0] ?? 'Look at the circled squares. What do they have in common?'
  const piece = PIECE_NAMES[expected.charAt(0)] ?? (/^[a-h]/.test(expected) ? 'pawn' : 'piece')
  const second = expected.startsWith('O-O') ? 'This is a castling move.' : `Move your ${piece}.`
  return [
    { label: 'Nudge', text: first },
    { label: 'The piece', text: second },
    { label: 'The move', text: `Play ${expected}.` },
  ]
}

/* ------------------------------------------------------------------ state */

export interface StepResult {
  /** Solved with no wrong move and no hint. */
  readonly firstTry: boolean
  readonly hints: number
  readonly misses: number
}

export interface PlayerState {
  readonly index: number
  /** Hints taken on the current step. */
  readonly hintsShown: number
  readonly misses: number
  /** The current step is done: a move step solved, or an info step read. */
  readonly solved: boolean
  readonly feedback: { readonly verdict: MoveVerdict; readonly san: string | undefined } | null
  /** One entry per move step finished, keyed by step index. */
  readonly results: Readonly<Record<number, StepResult>>
}

export function initialState(lesson: Lesson, startIndex = 0): PlayerState {
  const index = Math.min(Math.max(startIndex, 0), lesson.steps.length - 1)
  return {
    index,
    hintsShown: 0,
    misses: 0,
    solved: lesson.steps[index]?.kind !== 'move',
    feedback: null,
    results: {},
  }
}

export type PlayerEvent =
  | { readonly type: 'move'; readonly verdict: MoveVerdict; readonly san: string | undefined }
  | { readonly type: 'hint' }
  | { readonly type: 'retry' }
  | { readonly type: 'go'; readonly index: number }

export function playerReducer(lesson: Lesson, state: PlayerState, event: PlayerEvent): PlayerState {
  const step = lesson.steps[state.index]
  if (step === undefined) return state
  switch (event.type) {
    case 'hint': {
      if (step.kind !== 'move' || state.solved) return state
      return { ...state, hintsShown: Math.min(state.hintsShown + 1, 3) }
    }
    case 'retry':
      return { ...state, feedback: null }
    case 'go':
      return initialStateAt(lesson, state, event.index)
    case 'move': {
      if (step.kind !== 'move' || state.solved) return state
      if (event.verdict === 'illegal') return state
      if (event.verdict === 'wrong' || event.verdict === 'alternative') {
        return {
          ...state,
          misses: state.misses + 1,
          feedback: { verdict: event.verdict, san: event.san },
        }
      }
      return {
        ...state,
        solved: true,
        feedback: { verdict: 'correct', san: event.san },
        results: {
          ...state.results,
          [state.index]: {
            firstTry: state.misses === 0 && state.hintsShown === 0,
            hints: state.hintsShown,
            misses: state.misses,
          },
        },
      }
    }
  }
}

function initialStateAt(lesson: Lesson, from: PlayerState, index: number): PlayerState {
  const next = initialState(lesson, index)
  const target = lesson.steps[next.index]
  // Going back to a step already solved shows it solved, not as a fresh question.
  const redone = from.results[next.index] !== undefined && target?.kind === 'move'
  return { ...next, results: from.results, solved: next.solved || redone }
}

export interface LessonSummary {
  readonly moveSteps: number
  readonly firstTry: number
  readonly hints: number
  readonly misses: number
}

export function summarise(lesson: Lesson, results: PlayerState['results']): LessonSummary {
  const moveSteps = lesson.steps.filter((step) => step.kind === 'move').length
  const done = Object.values(results)
  return {
    moveSteps,
    firstTry: done.filter((result) => result.firstTry).length,
    hints: done.reduce((sum, result) => sum + result.hints, 0),
    misses: done.reduce((sum, result) => sum + result.misses, 0),
  }
}

/** The last step of a lesson is its own completion card, so "finishing" means reaching it. */
export function isFinalStep(lesson: Lesson, index: number): boolean {
  return index >= lesson.steps.length - 1
}
