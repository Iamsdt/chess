import {
  applyMove,
  attackersOf,
  createGame,
  hangingPieces,
  isCheck,
  legalMoves,
  pieceAt,
  playMoves,
  staticExchangeEvaluation,
  type ChessGame,
  type PlayedMove,
} from '@/chess'
import { type Color, type Fen, type Square, type VisualizationAttachment } from '@/domain'
import { trackPiece } from '@/features/drills/blindfold'
import { knightDistance, shortestKnightPath } from '@/features/drills/knight-route'
import {
  ALL_SQUARES,
  fileIndex,
  parseSquareGuess,
  rankIndex,
} from '@/features/drills/vision-squares'

import { pieceName } from './narrate'

/**
 * Questions and answer keys for the eight exercises (coach-agent.md §10.2), computed by
 * replaying the line with the rules engine. The model only ever phrases; it never
 * supplies an answer.
 *
 * The key lives in `Prepared.key`, apart from `Prepared.question`. Only `question` is
 * ever rendered; `revealText(key)` is called after the user has answered.
 */

export type AnswerInput = 'square' | 'squares' | 'choice' | 'moves' | 'route' | 'picture'

export interface QuestionOption {
  readonly id: string
  readonly label: string
}

export interface PictureOption {
  readonly id: string
  readonly fen: Fen
}

/** Everything the user may see before they answer. Holds no answer. */
export interface Question {
  readonly prompt: string
  readonly input: AnswerInput
  readonly hint?: string
  readonly options?: readonly QuestionOption[]
  readonly pictures?: readonly PictureOption[]
}

export type AnswerKey =
  | { readonly kind: 'squares'; readonly squares: readonly Square[] }
  | { readonly kind: 'choice'; readonly id: string; readonly label: string }
  | { readonly kind: 'moves'; readonly sans: readonly string[] }
  | {
      readonly kind: 'route'
      readonly piece: 'n' | 'b'
      readonly from: Square
      readonly to: Square
      readonly steps: number
      readonly example: readonly Square[]
    }

/** What the user said. Only the field that matches the question's input is used. */
export interface Answer {
  readonly squares?: readonly Square[]
  readonly choice?: string
  readonly moves?: readonly string[]
}

export interface Prepared {
  readonly question: Question
  readonly key: AnswerKey
  readonly startFen: Fen
  /** `positions[i]` is the board after `i` plies, so `positions[0]` is the start. */
  readonly positions: readonly Fen[]
  readonly history: readonly PlayedMove[]
  readonly finalFen: Fen
}

const colorName = (color: Color): string => (color === 'white' ? 'White' : 'Black')
const lower = (color: Color): string => (color === 'white' ? 'white' : 'black')
const stripMarks = (san: string): string => san.replace(/[+#]/g, '')
const other = (color: Color): Color => (color === 'white' ? 'black' : 'white')

/** A stable hash, so the same exercise always shuffles the same way (and tests can rely on it). */
function seeded(text: string): () => number {
  let state = 2166136261
  for (const char of text) state = Math.imul(state ^ char.charCodeAt(0), 16777619)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const order = [...items]
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)))
    const a = order[i]
    const b = order[j]
    if (a === undefined || b === undefined) continue
    order[i] = b
    order[j] = a
  }
  return order
}

function playLine(att: VisualizationAttachment): { game: ChessGame; start: ChessGame } | null {
  const start = createGame(att.fen)
  if (!start.ok) return null
  const played = playMoves(start.value, att.moves)
  return played.ok ? { game: played.value, start: start.value } : null
}

function describePiece(fen: Fen, square: Square): string {
  const piece = pieceAt(fen, square)
  return piece === null ? 'nothing' : `${lower(piece.color)} ${pieceName(piece.type)}`
}

/* ------------------------------------------------------------------ exercises */

function followLine(
  att: VisualizationAttachment,
  game: ChessGame,
  start: ChessGame,
): Pick<Prepared, 'question' | 'key'> | null {
  const track = att.target?.square
  if (track !== undefined) {
    const piece = pieceAt(start.fen, track)
    if (piece === null) return null
    const at = trackPiece(game.history, track)
    if (at === null) return null
    return {
      question: {
        prompt: `Where is the ${lower(piece.color)} ${pieceName(piece.type)} that began on ${track}?`,
        input: 'square',
        hint: 'Type a square such as e4.',
      },
      key: { kind: 'squares', squares: [at] },
    }
  }
  const on = att.target?.to
  if (on === undefined) return null
  const actual = describePiece(game.fen, on)
  const present = new Set<string>()
  for (const square of ALL_SQUARES) {
    if (square !== on && pieceAt(game.fen, square) !== null)
      present.add(describePiece(game.fen, square))
  }
  const random = seeded(`${att.fen}${att.moves.join('')}${on}`)
  const distractors = shuffled(
    [...present, 'nothing'].filter((label) => label !== actual),
    random,
  ).slice(0, 3)
  const options = shuffled([actual, ...distractors], random).map((label) => ({ id: label, label }))
  return {
    question: { prompt: `What stands on ${on} now?`, input: 'choice', options },
    key: { kind: 'choice', id: actual, label: actual },
  }
}

function whatsHanging(game: ChessGame): Pick<Prepared, 'question' | 'key'> {
  const squares = [...hangingPieces(game.fen, 'white'), ...hangingPieces(game.fen, 'black')]
    .map((piece) => piece.square)
    .sort()
  return {
    question: {
      prompt: 'Which pieces are hanging? Name each one that is attacked and not guarded.',
      input: 'squares',
      hint: 'Kings do not count. If nothing hangs, say so.',
    },
    key: { kind: 'squares', squares },
  }
}

function isItCheck(
  att: VisualizationAttachment,
  game: ChessGame,
): Pick<Prepared, 'question' | 'key'> | null {
  const named = att.target?.move
  if (named === undefined) return null
  const wanted = stripMarks(named)
  const legal = legalMoves(game).find((move) => stripMarks(move.san) === wanted)
  let id = 'illegal'
  if (legal !== undefined) {
    const next = applyMove(game, legal.uci)
    id = next.ok && isCheck(next.value) ? 'check' : 'quiet'
  }
  const options: QuestionOption[] = [
    { id: 'check', label: 'Legal, and it gives check' },
    { id: 'quiet', label: 'Legal, but no check' },
    { id: 'illegal', label: 'Not a legal move' },
  ]
  const label = options.find((option) => option.id === id)?.label ?? id
  return {
    question: {
      prompt: `${colorName(game.turn)} plays ${wanted}. Is it legal, and is it check?`,
      input: 'choice',
      options,
    },
    key: { kind: 'choice', id, label },
  }
}

function flashRecall(
  att: VisualizationAttachment,
  game: ChessGame,
): Pick<Prepared, 'question' | 'key'> | null {
  const file = att.target?.square
  if (file !== undefined) {
    const letter = file[0] ?? 'e'
    const squares = ALL_SQUARES.filter(
      (square) => square.startsWith(letter) && pieceAt(game.fen, square) !== null,
    )
    return {
      question: {
        prompt: `Which squares on the ${letter}-file held a piece?`,
        input: 'squares',
        hint: 'Type squares separated by spaces, such as e1 e4.',
      },
      key: { kind: 'squares', squares },
    }
  }
  for (const color of ['white', 'black'] as const) {
    const queens = ALL_SQUARES.filter((square) => {
      const piece = pieceAt(game.fen, square)
      return piece?.color === color && piece.type === 'q'
    })
    const [only] = queens
    if (queens.length === 1 && only !== undefined) {
      return {
        question: {
          prompt: `Where was the ${lower(color)} queen?`,
          input: 'square',
          hint: 'Type a square such as e4.',
        },
        key: { kind: 'squares', squares: [only] },
      }
    }
  }
  return null
}

function blindChecks(game: ChessGame): Pick<Prepared, 'question' | 'key'> {
  const sans = new Set<string>()
  for (const move of legalMoves(game)) {
    const next = applyMove(game, move.uci)
    if (next.ok && isCheck(next.value)) sans.add(stripMarks(move.san))
  }
  return {
    question: {
      prompt: `${colorName(game.turn)} to move. Name every move that gives check.`,
      input: 'moves',
      hint: 'Type moves such as Qh5 Bxf7, separated by spaces. If there are none, say so.',
    },
    key: { kind: 'moves', sans: [...sans].sort() },
  }
}

/** Squares a bishop can reach in one move on an empty board. */
function bishopReach(from: Square): Square[] {
  return ALL_SQUARES.filter(
    (square) =>
      square !== from &&
      Math.abs(fileIndex(square) - fileIndex(from)) ===
        Math.abs(rankIndex(square) - rankIndex(from)),
  )
}

/** One shortest bishop route (one or two moves), or `null` across colours. */
export function shortestBishopPath(from: Square, to: Square): readonly Square[] | null {
  if (from === to) return [from]
  if (bishopReach(from).includes(to)) return [from, to]
  const mid = bishopReach(from).find((square) => bishopReach(square).includes(to))
  return mid === undefined ? null : [from, mid, to]
}

function blindRoute(
  att: VisualizationAttachment,
  game: ChessGame,
): Pick<Prepared, 'question' | 'key'> | null {
  const from = att.target?.square
  const to = att.target?.to
  if (from === undefined || to === undefined) return null
  const piece = pieceAt(game.fen, from)
  if (piece === null || (piece.type !== 'n' && piece.type !== 'b')) return null
  const path = piece.type === 'n' ? shortestKnightPath(from, to) : shortestBishopPath(from, to)
  if (path === null) return null
  return {
    question: {
      prompt: `Name the shortest ${pieceName(piece.type)} route from ${from} to ${to}, square by square, on an empty board.`,
      input: 'route',
      hint: 'Type the squares it lands on, such as f3 d4.',
    },
    key: {
      kind: 'route',
      piece: piece.type,
      from,
      to,
      steps: path.length - 1,
      example: path.slice(1),
    },
  }
}

function countExchange(
  att: VisualizationAttachment,
  game: ChessGame,
): Pick<Prepared, 'question' | 'key'> | null {
  const square = att.target?.square
  if (square === undefined) return null
  const holder = pieceAt(game.fen, square)
  if (holder === null) return null
  const attackers = attackersOf(game.fen, square, other(holder.color))
  let best: number | null = null
  for (const from of attackers) {
    const see = staticExchangeEvaluation(game.fen, `${from}${square}`)
    if (see.ok && (best === null || see.value > best)) best = see.value
  }
  if (best === null) return null
  const winner = best > 0 ? other(holder.color) : best < 0 ? holder.color : null
  const options: QuestionOption[] = [
    { id: 'white', label: 'White comes out ahead' },
    { id: 'black', label: 'Black comes out ahead' },
    { id: 'even', label: 'It is an even trade' },
  ]
  const id = winner ?? 'even'
  return {
    question: {
      prompt: `Both sides keep capturing on ${square}, and either may stop. Who comes out ahead?`,
      input: 'choice',
      options,
    },
    key: { kind: 'choice', id, label: options.find((option) => option.id === id)?.label ?? id },
  }
}

function pickPicture(
  att: VisualizationAttachment,
  game: ChessGame,
): { question: Question; key: AnswerKey } | null {
  const last = game.history.at(-1)
  if (last === undefined) return null
  const before = createGame(last.fenBefore)
  if (!before.ok) return null
  const placement = (fen: Fen): string => fen.split(' ')[0] ?? ''
  const chebyshev = (a: Square, b: Square): number =>
    Math.max(Math.abs(fileIndex(a) - fileIndex(b)), Math.abs(rankIndex(a) - rankIndex(b)))
  // Plausible wrong boards: the same piece going somewhere nearby, not a random move.
  const alternatives = [...legalMoves(before.value)]
    .filter((move) => move.uci !== last.uci)
    .sort((a, b) => {
      const same = Number(b.piece === last.piece) - Number(a.piece === last.piece)
      if (same !== 0) return same
      const near = chebyshev(a.to, last.to) - chebyshev(b.to, last.to)
      return near !== 0 ? near : a.uci.localeCompare(b.uci)
    })
  const wrong: Fen[] = []
  const seen = new Set([placement(game.fen)])
  for (const move of alternatives) {
    const next = applyMove(before.value, move.uci)
    if (!next.ok || seen.has(placement(next.value.fen))) continue
    seen.add(placement(next.value.fen))
    wrong.push(next.value.fen)
    if (wrong.length === 2) break
  }
  if (wrong.length < 2) return null
  const random = seeded(`${att.fen}${att.moves.join('')}`)
  const [first, second] = wrong
  if (first === undefined || second === undefined) return null
  const order = shuffled([game.fen, first, second], random)
  const pictures = order.map((fen, index) => ({ id: String.fromCharCode(97 + index), fen }))
  const real = pictures.find((picture) => picture.fen === game.fen)
  if (real === undefined) return null
  return {
    question: { prompt: 'Which board is the real one?', input: 'picture', pictures },
    key: { kind: 'choice', id: real.id, label: `Board ${real.id.toUpperCase()}` },
  }
}

/**
 * Replays the attachment and builds its question and key, or `null` when the line is
 * illegal or the target does not fit the exercise (so a bad fixture fails loudly in tests).
 */
export function prepare(att: VisualizationAttachment): Prepared | null {
  const line = playLine(att)
  if (line === null) return null
  const { game, start } = line
  let built: { question: Question; key: AnswerKey } | null
  switch (att.exercise) {
    case 'follow-line':
      built = followLine(att, game, start)
      break
    case 'whats-hanging':
      built = whatsHanging(game)
      break
    case 'is-it-check':
      built = isItCheck(att, game)
      break
    case 'flash-recall':
      built = flashRecall(att, game)
      break
    case 'blind-checks':
      built = blindChecks(game)
      break
    case 'blind-route':
      built = blindRoute(att, game)
      break
    case 'count-exchange':
      built = countExchange(att, game)
      break
    case 'pick-picture':
      built = pickPicture(att, game)
      break
  }
  if (built === null) return null
  return {
    ...built,
    startFen: start.fen,
    positions: [start.fen, ...game.history.map((move) => move.fenAfter)],
    history: game.history,
    finalFen: game.fen,
  }
}

/* ------------------------------------------------------------------- marking */

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item) => b.includes(item))

function routeIsRight(
  key: Extract<AnswerKey, { kind: 'route' }>,
  said: readonly Square[],
): boolean {
  const path = said[0] === key.from ? said.slice(1) : said
  if (path.length !== key.steps || path.at(-1) !== key.to) return false
  let at = key.from
  for (const square of path) {
    const ok =
      key.piece === 'n' ? knightDistance(at, square) === 1 : bishopReach(at).includes(square)
    if (!ok) return false
    at = square
  }
  return true
}

/** Marks an answer against the key. */
export function checkAnswer(key: AnswerKey, answer: Answer): boolean {
  switch (key.kind) {
    case 'squares':
      return sameSet(answer.squares ?? [], key.squares)
    case 'choice':
      return answer.choice === key.id
    case 'moves':
      return sameSet(
        (answer.moves ?? []).map((san) => stripMarks(san.trim())),
        key.sans,
      )
    case 'route':
      return routeIsRight(key, answer.squares ?? [])
  }
}

/** The answer in words, for after the user has answered. */
export function revealText(key: AnswerKey): string {
  switch (key.kind) {
    case 'squares':
      return key.squares.length === 0 ? 'nothing' : key.squares.join(', ')
    case 'choice':
      return key.label
    case 'moves':
      return key.sans.length === 0 ? 'no checks' : key.sans.join(', ')
    case 'route':
      return `${key.from} to ${key.example.join(' to ')} (${String(key.steps)} ${key.steps === 1 ? 'move' : 'moves'})`
  }
}

/** Reads typed text for a question's input, or `null` when part of it is not understood. */
export function parseTyped(input: AnswerInput, text: string): Answer | null {
  const tokens = text.split(/[\s,]+/).filter((token) => token !== '')
  switch (input) {
    case 'square': {
      const square = parseSquareGuess(text)
      return square === null ? null : { squares: [square] }
    }
    case 'squares':
    case 'route': {
      const squares: Square[] = []
      for (const token of tokens) {
        const square = parseSquareGuess(token)
        if (square === null) return null
        squares.push(square)
      }
      return { squares }
    }
    case 'moves':
      return { moves: tokens.filter((token) => !/^(none|no)$/i.test(token)) }
    case 'choice':
    case 'picture':
      return null
  }
}
