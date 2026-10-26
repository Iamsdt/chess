import { z } from 'zod'

import {
  applyMove,
  attackersOf,
  countMaterial,
  createGame,
  detectOpeningFromMoves,
  hangingPieces,
  isCheck,
  legalMoves,
  legalMovesFrom,
  lookupOpening,
  materialBalance,
  parseFen,
  type ChessGame,
  type PlayedMove,
} from '@/chess'
import { SquareSchema, toSquare, type Color, type Fen, type PieceType, type Square } from '@/domain'

import { isToolFailure, resolveFen, toolFailure } from './shared'
import { defineTool, type CoachToolGroup, type CoachToolOutput } from './types'

/**
 * S21b · Rules and position (§5): legalMoves, playLine, positionFacts, identifyOpening.
 *
 * Why these exist as tools at all: a model that "sees" a board in its head invents pieces. Every
 * answer here comes from the rules, so the model can quote it instead of guessing.
 */

const FEN_FIELD = z
  .string()
  .optional()
  .describe("FEN to inspect. Omit to use the position on the learner's screen.")

const MAX_LINE_MOVES = 60
/** Enough illegal-move context to recover from, not a whole move list. */
const ALTERNATIVES_SHOWN = 30
const FILES = 'abcdefgh'
const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

function statusOf(game: ChessGame): string {
  switch (game.status.kind) {
    case 'checkmate':
      return `checkmate, ${game.status.winner} wins`
    case 'draw':
      return `draw by ${game.status.reason}`
    case 'in-progress':
      return isCheck(game) ? 'in progress, side to move is in check' : 'in progress'
  }
}

/** `1. e4 e5 2. Nf3`, with `1... e5` when the line starts on Black's move. */
function printLine(moves: readonly PlayedMove[]): string {
  return moves
    .map((move, index) => {
      if (move.color === 'white') return `${String(move.moveNumber)}. ${move.san}`
      return index === 0 ? `${String(move.moveNumber)}... ${move.san}` : move.san
    })
    .join(' ')
}

/* ── legalMoves ──────────────────────────────────────────────────────────── */

interface LegalMovesOutput extends CoachToolOutput {
  readonly fen: Fen
  readonly sideToMove: Color
  readonly count: number
  readonly moves: readonly string[]
}

const legalMovesInput = z.object({
  fen: FEN_FIELD,
  square: SquareSchema.optional().describe(
    'Only the moves of the piece on this square, e.g. "e2".',
  ),
})

/* ── playLine ────────────────────────────────────────────────────────────── */

interface PlayLineOutput extends CoachToolOutput {
  readonly startFen: Fen
  readonly finalFen: Fen
  readonly sideToMove: Color
  readonly line: string
  readonly moves: readonly string[]
  readonly status: string
}

const playLineInput = z.object({
  fen: FEN_FIELD,
  moves: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_LINE_MOVES)
    .describe('Moves in order, SAN ("Nf3") or UCI ("g1f3"), starting from the position.'),
})

/* ── positionFacts ───────────────────────────────────────────────────────── */

interface PlacedPiece {
  readonly color: Color
  readonly type: PieceType
  readonly file: number
  readonly rank: number
}

/** Pieces off the FEN's placement field, so the structure facts never depend on a model's reading. */
function piecesOf(placement: string): PlacedPiece[] {
  const pieces: PlacedPiece[] = []
  placement.split('/').forEach((row, rowIndex) => {
    let file = 0
    for (const char of row) {
      const empty = Number(char)
      if (Number.isNaN(empty)) {
        const lower = char.toLowerCase() as PieceType
        pieces.push({
          color: char === lower ? 'black' : 'white',
          type: lower,
          file,
          rank: 8 - rowIndex,
        })
        file += 1
      } else {
        file += empty
      }
    }
  })
  return pieces
}

const squareOf = (file: number, rank: number): Square =>
  toSquare(`${FILES[file] ?? 'a'}${String(rank)}`)

interface PawnFacts {
  readonly doubled: readonly string[]
  readonly isolated: readonly string[]
  readonly passed: readonly Square[]
}

function pawnFacts(pieces: readonly PlacedPiece[], color: Color): PawnFacts {
  const own = pieces.filter((piece) => piece.type === 'p' && piece.color === color)
  const enemy = pieces.filter((piece) => piece.type === 'p' && piece.color !== color)
  const forward = color === 'white' ? 1 : -1
  const filesWithPawns = own.map((pawn) => pawn.file)
  const doubled = [...new Set(filesWithPawns.filter((f, i) => filesWithPawns.indexOf(f) !== i))]
  const isolated = [...new Set(filesWithPawns)]
    .sort()
    .filter((file) => !filesWithPawns.includes(file - 1) && !filesWithPawns.includes(file + 1))
  const passed = own.filter(
    (pawn) =>
      !enemy.some(
        (other) => Math.abs(other.file - pawn.file) <= 1 && (other.rank - pawn.rank) * forward > 0,
      ),
  )
  return {
    doubled: doubled.map((file) => `${FILES[file] ?? ''}-file`),
    isolated: isolated.map((file) => `${FILES[file] ?? ''}-pawn`),
    passed: passed.map((pawn) => squareOf(pawn.file, pawn.rank)),
  }
}

interface KingFacts {
  readonly square: Square
  /** Own pawns directly in front of the king, on its file and the two beside it, within two ranks. */
  readonly pawnShield: number
  /** Files at or beside the king's with no pawn of its side: an open road to it. */
  readonly openFilesNearby: readonly string[]
  /** Enemy attacks on the king's square and the eight around it. */
  readonly attacksOnKingZone: number
  readonly inCheck: boolean
}

function kingFacts(
  fen: Fen,
  pieces: readonly PlacedPiece[],
  color: Color,
  sideToMove: Color,
  inCheck: boolean,
): KingFacts | undefined {
  const king = pieces.find((piece) => piece.type === 'k' && piece.color === color)
  if (king === undefined) return undefined
  const forward = color === 'white' ? 1 : -1
  const pawns = pieces.filter((piece) => piece.type === 'p' && piece.color === color)
  const nearbyFiles = [king.file - 1, king.file, king.file + 1].filter((f) => f >= 0 && f <= 7)
  const shield = pawns.filter(
    (pawn) =>
      nearbyFiles.includes(pawn.file) &&
      (pawn.rank - king.rank) * forward > 0 &&
      (pawn.rank - king.rank) * forward <= 2,
  )
  const enemy: Color = color === 'white' ? 'black' : 'white'
  let attacks = 0
  for (const file of nearbyFiles) {
    for (const rank of [king.rank - 1, king.rank, king.rank + 1]) {
      if (rank < 1 || rank > 8) continue
      attacks += attackersOf(fen, squareOf(file, rank), enemy).length
    }
  }
  return {
    square: squareOf(king.file, king.rank),
    pawnShield: shield.length,
    openFilesNearby: nearbyFiles
      .filter((file) => !pawns.some((pawn) => pawn.file === file))
      .map((file) => FILES[file] ?? ''),
    attacksOnKingZone: attacks,
    inCheck: color === sideToMove && inCheck,
  }
}

interface PositionFactsOutput extends CoachToolOutput {
  readonly fen: Fen
  readonly sideToMove: Color
  readonly material: {
    readonly whitePoints: number
    readonly blackPoints: number
    /** "White is up 3", "level". */
    readonly balance: string
    /** Non-zero piece differences, White minus Black, e.g. `{ n: 1, p: -3 }`. */
    readonly imbalance: Readonly<Record<string, number>>
  }
  readonly kingSafety: Readonly<Record<Color, KingFacts | undefined>>
  readonly pawnStructure: Readonly<Record<Color, PawnFacts>>
  /** Pieces attacked and not defended, by owner. */
  readonly hangingPieces: Readonly<Record<Color, readonly string[]>>
  readonly openFiles: readonly string[]
  readonly halfOpenFiles: Readonly<Record<Color, readonly string[]>>
}

const positionFactsInput = z.object({ fen: FEN_FIELD })

function filesStatus(pieces: readonly PlacedPiece[]): {
  open: string[]
  halfOpen: Record<Color, string[]>
} {
  const open: string[] = []
  const halfOpen: Record<Color, string[]> = { white: [], black: [] }
  for (let file = 0; file < 8; file += 1) {
    const name = FILES[file] ?? ''
    const white = pieces.some((p) => p.type === 'p' && p.color === 'white' && p.file === file)
    const black = pieces.some((p) => p.type === 'p' && p.color === 'black' && p.file === file)
    if (!white && !black) open.push(name)
    else if (!white) halfOpen.white.push(name)
    else if (!black) halfOpen.black.push(name)
  }
  return { open, halfOpen }
}

function describeBalance(fen: Fen): PositionFactsOutput['material'] {
  const counts = countMaterial(fen)
  const balance = materialBalance(fen)
  const imbalance = Object.fromEntries(
    Object.entries(balance.byPiece).filter(([type, diff]) => type !== 'k' && diff !== 0),
  )
  const text =
    balance.leader === null
      ? 'level'
      : `${balance.leader === 'white' ? 'White' : 'Black'} is up ${String(balance.advantage)}`
  return {
    whitePoints: counts.whitePoints,
    blackPoints: counts.blackPoints,
    balance: text,
    imbalance,
  }
}

/* ── identifyOpening ─────────────────────────────────────────────────────── */

interface IdentifyOpeningOutput extends CoachToolOutput {
  readonly opening: {
    readonly eco?: string | undefined
    readonly name: string
    readonly variation?: string | undefined
  } | null
}

const identifyOpeningInput = z.object({
  fen: z
    .string()
    .optional()
    .describe("Position to name. Omit to use the position on the learner's screen."),
  moves: z
    .array(z.string().min(1))
    .max(MAX_LINE_MOVES)
    .optional()
    .describe('Instead of a FEN: the moves from the starting position, SAN or UCI.'),
})

export const positionTools: CoachToolGroup = (env) => ({
  legalMoves: defineTool({
    description:
      'List the legal moves in a position, in SAN, optionally only for the piece on one square. Use it before claiming a move is possible.',
    inputSchema: legalMovesInput,
    execute: ({ fen, square }): LegalMovesOutput | ReturnType<typeof toolFailure> => {
      const resolved = resolveFen(env, fen)
      if (isToolFailure(resolved)) return resolved
      const game = createGame(resolved)
      if (!game.ok) return toolFailure(game.error.message)
      const found =
        square === undefined ? legalMoves(game.value) : legalMovesFrom(game.value, square)
      const moves = found.map((move) => move.san)
      const where = square === undefined ? '' : ` from ${square}`
      return {
        fen: resolved,
        sideToMove: game.value.turn,
        count: moves.length,
        moves,
        summary: `${String(moves.length)} legal move${moves.length === 1 ? '' : 's'}${where}`,
      }
    },
  }),

  playLine: defineTool({
    description:
      'Replay a sequence of moves from a position and return the resulting position, or say which move is illegal. Use it to check any line before presenting it.',
    inputSchema: playLineInput,
    execute: ({ fen, moves }): PlayLineOutput | ReturnType<typeof toolFailure> => {
      const resolved = resolveFen(env, fen)
      if (isToolFailure(resolved)) return resolved
      const start = createGame(resolved)
      if (!start.ok) return toolFailure(start.error.message)

      let game = start.value
      for (const [index, move] of moves.entries()) {
        const next = applyMove(game, move)
        if (!next.ok) {
          const options = legalMoves(game)
            .slice(0, ALTERNATIVES_SHOWN)
            .map((legal) => legal.san)
            .join(', ')
          return toolFailure(
            `Move ${String(index + 1)} "${move}" is illegal here. Legal moves: ${options}`,
          )
        }
        game = next.value
      }
      return {
        startFen: resolved,
        finalFen: game.fen,
        sideToMove: game.turn,
        line: printLine(game.history),
        moves: game.history.map((played) => played.san),
        status: statusOf(game),
        summary: `${String(moves.length)} move${moves.length === 1 ? '' : 's'} replayed · ${statusOf(game)}`,
      }
    },
  }),

  positionFacts: defineTool({
    description:
      'Material, king safety, pawn structure, hanging pieces and open files of a position, computed by the rules. Quote these instead of describing the board from memory.',
    inputSchema: positionFactsInput,
    execute: ({ fen }): PositionFactsOutput | ReturnType<typeof toolFailure> => {
      const resolved = resolveFen(env, fen)
      if (isToolFailure(resolved)) return resolved
      const fields = parseFen(resolved)
      const game = createGame(resolved)
      if (!fields.ok || !game.ok) return toolFailure(`Not a legal position: ${resolved}`)

      const pieces = piecesOf(fields.value.placement)
      const sideToMove = fields.value.sideToMove
      const inCheck = isCheck(game.value)
      const files = filesStatus(pieces)
      const hanging = (color: Color): string[] =>
        hangingPieces(resolved, color).map(
          (piece) => `${PIECE_NAMES[piece.type]} on ${piece.square}`,
        )
      const material = describeBalance(resolved)
      const hangingWhite = hanging('white')
      const hangingBlack = hanging('black')

      return {
        fen: resolved,
        sideToMove,
        material,
        kingSafety: {
          white: kingFacts(resolved, pieces, 'white', sideToMove, inCheck),
          black: kingFacts(resolved, pieces, 'black', sideToMove, inCheck),
        },
        pawnStructure: {
          white: pawnFacts(pieces, 'white'),
          black: pawnFacts(pieces, 'black'),
        },
        hangingPieces: { white: hangingWhite, black: hangingBlack },
        openFiles: files.open,
        halfOpenFiles: files.halfOpen,
        summary: `material: ${material.balance} · ${String(hangingWhite.length + hangingBlack.length)} hanging`,
      }
    },
  }),

  identifyOpening: defineTool({
    description:
      'Name the opening and variation (ECO) of a position or of a list of moves from the start. Returns null when the position is not a named opening.',
    inputSchema: identifyOpeningInput,
    execute: ({ fen, moves }): IdentifyOpeningOutput | ReturnType<typeof toolFailure> => {
      if (moves !== undefined) {
        const found = detectOpeningFromMoves(moves)
        if (!found.ok) return toolFailure(found.error.message)
        return openingOutput(found.value)
      }
      const resolved = resolveFen(env, fen)
      if (isToolFailure(resolved)) return resolved
      return openingOutput(lookupOpening(resolved) ?? null)
    },
  }),
})

function openingOutput(
  found: { eco?: string | undefined; name: string; variation?: string | undefined } | null,
): IdentifyOpeningOutput {
  if (found === null) return { opening: null, summary: 'not a named opening' }
  const opening = {
    name: found.name,
    ...(found.eco === undefined ? {} : { eco: found.eco }),
    ...(found.variation === undefined ? {} : { variation: found.variation }),
  }
  const label = found.variation === undefined ? found.name : `${found.name}: ${found.variation}`
  return { opening, summary: found.eco === undefined ? label : `${found.eco} · ${label}` }
}
