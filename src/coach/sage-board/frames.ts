import { applyMove, createGame, squareControl, type ChessGame, type PlayedMove } from '@/chess'
import {
  toSquare,
  type BoardShapes,
  type BoardView,
  type Color,
  type SageBoardStep,
  type Square,
} from '@/domain'

/**
 * One step of a Sage demonstration, with the real position it leads to.
 *
 * Why frames are built up front: a step whose SAN is not legal from the one before it
 * should end the demonstration there, not draw a position that never existed.
 */
export interface SageFrame {
  readonly step: SageBoardStep
  readonly game: ChessGame
  /** The move this step played; absent on a step that only annotates. */
  readonly move: PlayedMove | undefined
}

export function buildFrames(fen: string, steps: readonly SageBoardStep[]): SageFrame[] {
  const start = createGame(fen)
  if (!start.ok) return []
  const frames: SageFrame[] = []
  let game = start.value
  for (const step of steps) {
    let move: PlayedMove | undefined
    if (step.san !== undefined) {
      const next = applyMove(game, step.san)
      if (!next.ok) break
      game = next.value
      move = game.history.at(-1)
    }
    frames.push({ step, game, move })
  }
  return frames
}

/** The king of `color`, read from the FEN's placement field. Display only; no rules here. */
export function kingSquareOf(fen: string, color: Color): Square | null {
  const target = color === 'white' ? 'K' : 'k'
  const rows = fen.split(' ')[0]?.split('/') ?? []
  for (const [rowIndex, row] of rows.entries()) {
    let file = 0
    for (const character of row) {
      const skip = Number.parseInt(character, 10)
      if (!Number.isNaN(skip)) {
        file += skip
        continue
      }
      if (character === target) return toSquare(`${'abcdefgh'.charAt(file)}${String(8 - rowIndex)}`)
      file += 1
    }
  }
  return null
}

/** FEN spelling of the piece that moved: upper case for White. */
const pieceLetter = (move: PlayedMove): string =>
  move.color === 'white' ? move.piece.toUpperCase() : move.piece

export interface ShapeInput {
  readonly frame: SageFrame
  /** The game to draw, which differs from `frame.game` once the user has answered. */
  readonly game: ChessGame
  readonly next: SageFrame | undefined
  readonly view: BoardView
}

/** Everything the board overlays for one moment of the demonstration. */
export function shapesFor({ frame, game, next, view }: ShapeInput): BoardShapes {
  const last = game.history.at(-1)
  const inCheck = game.status.kind === 'in-progress' && game.status.inCheck
  const mated = game.status.kind === 'checkmate'
  const checked = inCheck || mated
  const king = checked ? kingSquareOf(game.fen, game.turn) : null
  const focus: Square[] = [...frame.step.focus]
  // Outline the checking piece as well as the king, so the check reads at a glance.
  if (checked && last !== undefined && !focus.includes(last.to)) focus.push(last.to)

  const ghost = view === 'ghost' ? next?.move : undefined
  return {
    highlight: last === undefined ? [] : [last.from, last.to],
    focus,
    check: king,
    arrows: [...frame.step.arrows],
    marks: [],
    danger: [...frame.step.danger],
    ...(ghost === undefined ? {} : { ghosts: [{ square: ghost.to, piece: pieceLetter(ghost) }] }),
    ...(frame.step.controlMap ? { control: squareControl(game.fen) } : {}),
  }
}
