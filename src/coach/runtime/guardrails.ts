import { mainLine, parsePgn, sanLineToUci, uciToSan, validateFen } from '@/chess'
import { START_FEN, type CoachContext } from '@/domain'

/**
 * S21b · The guardrails of coach-agent.md §7 that read Sage's prose: engine truth, line
 * validation and the spoiler guard.
 *
 * Why this is all pure string-and-JSON code: the model is the one component nobody can unit-test,
 * so everything that decides whether its words may reach the screen has to be. The port feeds
 * these functions sentences and tool results; they answer yes or no and say why.
 *
 * Why every check leans towards letting a sentence through: a wrongly rejected sentence costs a
 * retry, a wrongly rejected answer costs the user's trust in a coach that "keeps changing its
 * mind". The patterns therefore only fire on shapes that are nearly always an evaluation (a
 * signed decimal, "eval of …", "mate in …") and the line check only judges runs of two or more
 * moves.
 */

/** Pawns. Engines round, models round differently, and "+0.8" for a true 0.75 is honest. */
export const EVAL_TOLERANCE_PAWNS = 0.15

/** One evaluation the model stated. `value` is pawns for `cp`, full moves to mate for `mate`. */
export interface EvalClaim {
  readonly kind: 'cp' | 'mate'
  readonly value: number
  /** False for "eval of 2.3": the model gave a magnitude and no side, so either sign matches. */
  readonly signed: boolean
  readonly text: string
}

const MINUS = '[-\\u2212\\u2013]'
/** Why: "+0.8 seconds", "+12%" and "+3 moves" are not evaluations. */
const NOT_A_UNIT =
  '(?!\\d|[:%]|\\s?(?:%|s\\b|sec|ms\\b|min\\b|moves?\\b|plies\\b|ply\\b|points?\\b|elo\\b|rating|candidates?\\b|lines?\\b|games?\\b|pieces?\\b|cp\\b|centipawns?\\b))'

const SIGNED_PAWNS = new RegExp(
  `(?<![\\w.,])(\\+|${MINUS})\\s?(\\d{1,2}[.,]\\d{1,2})${NOT_A_UNIT}`,
  'g',
)
const WORDED_PAWNS = new RegExp(
  `\\b(?:eval(?:uation)?s?|engine (?:says|gives|shows|thinks))(?:\\s+(?:of|is|at|to|about|around|roughly|near|reads?))*\\s+(\\+|${MINUS})?\\s?(\\d{1,2}(?:[.,]\\d{1,2})?)${NOT_A_UNIT}`,
  'gi',
)
const CENTIPAWNS = new RegExp(
  `(?<![\\w.,])(\\+|${MINUS})?\\s?(\\d{2,4})\\s?(?:cp|centipawns?)\\b`,
  'gi',
)
const MATE_IN = /\b(?:check)?mat(?:e|es|ed)\s+in\s+(\d{1,2})\b/gi
const MATE_SHORT = new RegExp(`(?<![\\w#])(\\+|${MINUS})?M(\\d{1,2})\\b(?![\\w.])`, 'g')

function signOf(mark: string | undefined): 1 | -1 | undefined {
  if (mark === undefined || mark === '') return undefined
  return mark === '+' ? 1 : -1
}

function decimal(text: string): number {
  return Number(text.replace(',', '.'))
}

/** The evaluations stated in `text`, in no particular order and without duplicates. */
export function extractEvalClaims(text: string): EvalClaim[] {
  const claims = new Map<string, EvalClaim>()
  const add = (claim: EvalClaim) => {
    claims.set(`${claim.kind}:${String(claim.value)}:${String(claim.signed)}`, claim)
  }
  const pawns = (match: RegExpExecArray, mark: string | undefined, number: string | undefined) => {
    if (number === undefined) return
    const sign = signOf(mark)
    add({
      kind: 'cp',
      value: (sign ?? 1) * decimal(number),
      signed: sign !== undefined,
      text: match[0].trim(),
    })
  }

  for (const match of text.matchAll(SIGNED_PAWNS)) pawns(match, match[1], match[2])
  for (const match of text.matchAll(WORDED_PAWNS)) pawns(match, match[1], match[2])
  for (const match of text.matchAll(CENTIPAWNS)) {
    const sign = signOf(match[1])
    add({
      kind: 'cp',
      value: ((sign ?? 1) * Number(match[2])) / 100,
      signed: sign !== undefined,
      text: match[0].trim(),
    })
  }
  for (const match of text.matchAll(MATE_IN)) {
    add({ kind: 'mate', value: Number(match[1]), signed: false, text: match[0].trim() })
  }
  for (const match of text.matchAll(MATE_SHORT)) {
    const sign = signOf(match[1])
    add({
      kind: 'mate',
      value: (sign ?? 1) * Number(match[2]),
      signed: sign !== undefined,
      text: match[0].trim(),
    })
  }
  return [...claims.values()]
}

// ---------------------------------------------------------------------------------------------
// Evidence: what this answer's tools (and the context) actually said.
// ---------------------------------------------------------------------------------------------

/** Everything a sentence is allowed to quote. Mutable on purpose: tool results arrive one by one. */
export interface EngineEvidence {
  /** White-centred evaluations in pawns. */
  readonly pawns: number[]
  /** Moves to mate; negative is Black mating. */
  readonly mates: number[]
  /** The engine's best moves in SAN, without check or annotation marks. */
  readonly bestMoves: string[]
  /** Move sequences the tools produced, so quoting a stretch of one is never "illegal". */
  readonly runs: string[][]
  /** Positions the tools worked on, so a line from one of them can be replayed. */
  readonly fens: string[]
}

export function createEvidence(): EngineEvidence {
  return { pawns: [], mates: [], bestMoves: [], runs: [], fens: [] }
}

const SAN_BODY =
  '(?:O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=?[QRBN])?|[a-h][1-8](?:=?[QRBN])?)'
const SAN_MARKS = '[+#]?[!?]{0,2}'
const SAN_ONLY = new RegExp(`^${SAN_BODY}${SAN_MARKS}$`)
const FEN_SHAPE = /^[1-8pnbrqkPNBRQK/]{15,} [wb] (?:[KQkq]{1,4}|-) (?:[a-h][36]|-)(?: \d+ \d+)?$/
const UCI_SHAPE = /^[a-h][1-8][a-h][1-8][qrbn]?$/
const BEST_PHRASE = new RegExp(
  `(?<![\\w])(${SAN_BODY})${SAN_MARKS}\\s+(?:is\\s+)?best\\b|\\bbest(?:\\s+move)?\\s*(?:is|:)?\\s+(${SAN_BODY})${SAN_MARKS}(?![\\w])`,
  'gi',
)

/** Why: "Nf3+", "Nf3!" and "Nf3" are one move; castling has two spellings. */
export function normalizeSan(san: string): string {
  return san
    .replace(/[+#!?]+$/, '')
    .replace(/^0-0-0$/, 'O-O-O')
    .replace(/^0-0$/, 'O-O')
}

function addPawns(evidence: EngineEvidence, value: number, bothSigns: boolean): void {
  evidence.pawns.push(value)
  if (bothSigns && value !== 0) evidence.pawns.push(-value)
}

function addMate(evidence: EngineEvidence, value: number, bothSigns: boolean): void {
  evidence.mates.push(value)
  if (bothSigns) evidence.mates.push(-value)
}

/** Fold every evaluation a piece of prose states into the evidence. */
export function recordTextEvidence(evidence: EngineEvidence, text: string): void {
  for (const claim of extractEvalClaims(text)) {
    if (claim.kind === 'cp') addPawns(evidence, claim.value, !claim.signed)
    else addMate(evidence, claim.value, !claim.signed)
  }
  for (const match of text.matchAll(BEST_PHRASE)) {
    const san = match[1] ?? match[2]
    if (san !== undefined) evidence.bestMoves.push(normalizeSan(san))
  }
}

const MATE_KEY = /mate/i
const EVAL_KEY = /eval|score|advantage|pawn|cp|centi|loss|swing|delta|before|after|drop|gain/i
const CENTIPAWN_KEY = /cp|centi/i
const MAX_DEPTH = 8

function recordNumber(evidence: EngineEvidence, key: string, value: number): void {
  if (!Number.isFinite(value)) return
  if (MATE_KEY.test(key)) {
    addMate(evidence, Math.round(value), false)
  } else if (EVAL_KEY.test(key)) {
    if (CENTIPAWN_KEY.test(key)) {
      addPawns(evidence, value / 100, false)
      return
    }
    addPawns(evidence, value, false)
    // Why: a bare 80 under "score" is centipawns; a 20-pawn evaluation is never quoted.
    if (Number.isInteger(value) && Math.abs(value) >= 20) addPawns(evidence, value / 100, false)
  }
}

function recordBest(evidence: EngineEvidence, value: string, fen: string | undefined): void {
  if (SAN_ONLY.test(value)) {
    evidence.bestMoves.push(normalizeSan(value))
  } else if (UCI_SHAPE.test(value) && fen !== undefined) {
    const position = validateFen(fen)
    const san = position.ok ? uciToSan(position.value, value) : position
    if (san.ok) evidence.bestMoves.push(normalizeSan(san.value))
  }
}

function walk(
  evidence: EngineEvidence,
  value: unknown,
  key: string,
  fen: string | undefined,
  depth: number,
): void {
  if (depth > MAX_DEPTH) return
  if (typeof value === 'string') {
    recordTextEvidence(evidence, value)
    if (/^best/i.test(key)) recordBest(evidence, value, fen)
    if (FEN_SHAPE.test(value)) evidence.fens.push(value)
  } else if (typeof value === 'number') {
    recordNumber(evidence, key, value)
  } else if (Array.isArray(value)) {
    const items: unknown[] = value
    if (
      items.length >= 2 &&
      items.every((item) => typeof item === 'string' && SAN_ONLY.test(item))
    ) {
      evidence.runs.push(items.map((item) => normalizeSan(String(item))))
    }
    if (/^best/i.test(key) && typeof items[0] === 'string') recordBest(evidence, items[0], fen)
    for (const item of items) walk(evidence, item, key, fen, depth + 1)
  } else if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    // Why both signs: a raw engine score is side-to-move relative and carries no perspective tag.
    if (record.kind === 'cp' && typeof record.value === 'number') {
      addPawns(evidence, record.value / 100, true)
    } else if (record.kind === 'mate' && typeof record.moves === 'number') {
      addMate(evidence, record.moves, true)
    }
    for (const [childKey, child] of Object.entries(record)) {
      walk(evidence, child, childKey, fen, depth + 1)
    }
  }
}

/**
 * Add one finished tool call to the evidence.
 *
 * Why the input is walked for positions only: a number the model put in a tool's arguments is
 * the model's own claim, not engine truth.
 */
export function recordToolEvidence(
  evidence: EngineEvidence,
  input: unknown,
  output: unknown,
  fen: string | undefined,
): void {
  const inputs: EngineEvidence = createEvidence()
  walk(inputs, input, 'input', fen, 0)
  evidence.fens.push(...inputs.fens)
  walk(evidence, output, 'output', fen, 0)
}

/** The numbers Sage was shown in its prompt, the thread so far, and the user's own message. */
export function seedEvidence(context: CoachContext, thread: readonly string[]): EngineEvidence {
  const evidence = createEvidence()
  const fen = context.position?.fen
  if (fen !== undefined) evidence.fens.push(fen)
  const flip = fen?.split(' ')[1] === 'b' ? -1 : 1
  if (context.allowEngineLines) {
    for (const line of context.engineLines) {
      if (line.score.kind === 'cp') addPawns(evidence, (line.score.value * flip) / 100, false)
      else addMate(evidence, line.score.moves * flip, false)
      const run = (line.sanPv ?? []).map(normalizeSan)
      if (run.length >= 2) evidence.runs.push(run)
    }
    const first = context.engineLines[0]?.sanPv?.[0]
    if (first !== undefined) evidence.bestMoves.push(normalizeSan(first))
  }
  for (const text of thread) {
    for (const claim of extractEvalClaims(text)) {
      if (claim.kind === 'cp') addPawns(evidence, claim.value, !claim.signed)
      else addMate(evidence, claim.value, !claim.signed)
    }
  }
  return evidence
}

// ---------------------------------------------------------------------------------------------
// Engine truth
// ---------------------------------------------------------------------------------------------

function isBacked(claim: EvalClaim, evidence: EngineEvidence): boolean {
  if (claim.kind === 'mate') {
    return evidence.mates.some((moves) =>
      claim.signed ? moves === claim.value : Math.abs(moves) === Math.abs(claim.value),
    )
  }
  return evidence.pawns.some((pawns) =>
    claim.signed
      ? Math.abs(pawns - claim.value) <= EVAL_TOLERANCE_PAWNS
      : Math.abs(Math.abs(pawns) - Math.abs(claim.value)) <= EVAL_TOLERANCE_PAWNS,
  )
}

/** The claims no tool result in this answer supports. Empty means the sentence may stand. */
export function verifyEvalClaims(
  claims: readonly EvalClaim[],
  evidence: EngineEvidence,
): EvalClaim[] {
  return claims.filter((claim) => !isBacked(claim, evidence))
}

// ---------------------------------------------------------------------------------------------
// Line validation
// ---------------------------------------------------------------------------------------------

/** A run of two or more moves written in the prose. */
export interface SanLine {
  readonly text: string
  readonly moves: readonly string[]
}

const MOVE_NUMBER = '\\d{1,3}(?:\\.\\.\\.|\\.|\\u2026)'
const MOVE_TOKEN = `(?:${MOVE_NUMBER}\\s*)?${SAN_BODY}${SAN_MARKS}`
// Whitespace only between moves: "Nf3, d4 or c4" lists candidates, it is not a line.
const LINE_PATTERN = new RegExp(
  `(?<![\\w/.-])${MOVE_TOKEN}(?:[ \\t]+${MOVE_TOKEN})+(?![\\w-])`,
  'g',
)
const SAN_MENTION = new RegExp(`(?<![\\w/.-])${SAN_BODY}${SAN_MARKS}(?![\\w-])`, 'g')

/** Move sequences of at least two plies. A lone "Nf3" is a mention, not a claim about a line. */
export function extractLines(text: string): SanLine[] {
  const lines: SanLine[] = []
  for (const match of text.matchAll(LINE_PATTERN)) {
    const moves = match[0]
      .replace(new RegExp(MOVE_NUMBER, 'g'), ' ')
      .split(/\s+/)
      .filter((token) => token !== '')
      .map(normalizeSan)
    if (moves.length >= 2) lines.push({ text: match[0].trim(), moves })
  }
  return lines
}

function isSubRun(moves: readonly string[], run: readonly string[]): boolean {
  for (let start = 0; start + moves.length <= run.length; start += 1) {
    if (moves.every((move, offset) => run[start + offset] === move)) return true
  }
  return false
}

/**
 * The lines that cannot be played from any known position.
 *
 * Why several start positions: prose quotes a line from the board on screen, from the opening
 * ("1. e4 e5 …") or from wherever a tool was pointed, and nothing in the sentence says which.
 * A line is only illegal when it fails from all of them.
 */
export function validateLines(
  lines: readonly SanLine[],
  starts: readonly string[],
  knownRuns: readonly (readonly string[])[] = [],
): SanLine[] {
  return lines.filter((line) => {
    if (knownRuns.some((run) => isSubRun(line.moves, run))) return false
    return !starts.some((raw) => {
      const fen = validateFen(raw)
      return fen.ok && sanLineToUci(fen.value, line.moves).ok
    })
  })
}

// ---------------------------------------------------------------------------------------------
// Spoiler guard
// ---------------------------------------------------------------------------------------------

const ASKS_OUTRIGHT =
  /\b(?:(?:show|tell|give|reveal|what(?:'s| is)?)\b.{0,24}\b(?:answer|solution|best move|winning move|right move)|just (?:tell|show|give)|i give up|spoil(?:er)? me|solve it for me)\b/i

/** Why a phrase list and not intent detection: this is the user waiving a protection, so be literal. */
export function asksForSolution(userText: string): boolean {
  return ASKS_OUTRIGHT.test(userText)
}

/** The engine's best moves that `text` names, when the spoiler guard says it must not. */
export function findSpoilers(
  text: string,
  evidence: EngineEvidence,
  context: Pick<CoachContext, 'spoilerGuard' | 'activePuzzle'>,
  userText: string,
): string[] {
  if (!context.spoilerGuard || context.activePuzzle === undefined) return []
  if (evidence.bestMoves.length === 0 || asksForSolution(userText)) return []
  const mentioned = new Set([...text.matchAll(SAN_MENTION)].map((match) => normalizeSan(match[0])))
  return [...new Set(evidence.bestMoves)].filter((move) => mentioned.has(move))
}

// ---------------------------------------------------------------------------------------------
// The per-answer guard: sentence buffering and the corrective message
// ---------------------------------------------------------------------------------------------

export interface GuardProblem {
  readonly kind: 'eval' | 'line' | 'spoiler'
  readonly sentence: string
  /** What to tell the model, and the log, in one sentence. */
  readonly detail: string
}

export interface GuardStep {
  /** Sentences that passed, in order, ready for the screen. */
  readonly released: string
  readonly problems: readonly GuardProblem[]
}

export interface AnswerGuard {
  /** A tool finished: whatever it returned may now be quoted. */
  recordTool: (input: unknown, output: unknown) => void
  /** Feed streamed text; complete sentences are checked and released. */
  push: (chunk: string) => GuardStep
  /** End of a step or of the answer: check whatever is left in the buffer. */
  flush: () => GuardStep
}

export interface AnswerGuardOptions {
  readonly context: CoachContext
  /** The user's latest message: it may waive the spoiler guard and its numbers are theirs. */
  readonly userText: string
  /** The whole thread: numbers already on the table (the user's, Sage's verified ones) may be repeated. */
  readonly thread: readonly string[]
}

const ABBREVIATION = /^(?:e\.g|i\.e|vs|etc|approx|ca)$/i
const BOUNDARY = /[.!?][)"'\]]*\s+|\n+/g

/** Why not a plain split on ". ": "1. e4 e5 2. Nf3" and "+0.8" are full of full stops. */
export function splitSentences(buffer: string): { sentences: string[]; rest: string } {
  const sentences: string[] = []
  let from = 0
  for (const match of buffer.matchAll(BOUNDARY)) {
    const end = match.index + match[0].length
    if (match[0].startsWith('.')) {
      const word = /(\S*)$/.exec(buffer.slice(from, match.index))?.[1] ?? ''
      if (/^\d+\.*$/.test(word) || ABBREVIATION.test(word)) continue
    }
    sentences.push(buffer.slice(from, end))
    from = end
  }
  return { sentences, rest: buffer.slice(from) }
}

/** Why: the user may ask about any move of the game on screen, not only the current position. */
function pgnPositions(pgn: string | undefined): string[] {
  if (pgn === undefined) return []
  const games = parsePgn(pgn)
  const game = games.ok ? games.value[0] : undefined
  return game === undefined ? [] : mainLine(game).map((move) => move.fenAfter)
}

export function createAnswerGuard(options: AnswerGuardOptions): AnswerGuard {
  const { context, userText } = options
  const evidence = seedEvidence(context, options.thread)
  const positionFen = context.position?.fen
  const pgnFens = pgnPositions(context.pgn)
  let buffer = ''

  function check(sentence: string): GuardProblem[] {
    const problems: GuardProblem[] = []
    for (const claim of verifyEvalClaims(extractEvalClaims(sentence), evidence)) {
      problems.push({
        kind: 'eval',
        sentence,
        detail: `You stated "${claim.text}" but no tool in this answer returned that evaluation.`,
      })
    }
    const starts = [...evidence.fens, ...pgnFens, START_FEN]
    for (const line of validateLines(extractLines(sentence), starts, evidence.runs)) {
      problems.push({
        kind: 'line',
        sentence,
        detail: `The line "${line.text}" is not legal from the position being discussed.`,
      })
    }
    for (const move of findSpoilers(sentence, evidence, context, userText)) {
      problems.push({
        kind: 'spoiler',
        sentence,
        detail: `You named the engine's best move (${move}) while the spoiler guard protects an active puzzle.`,
      })
    }
    return problems
  }

  function release(sentences: readonly string[]): GuardStep {
    let released = ''
    const problems: GuardProblem[] = []
    for (const sentence of sentences) {
      const found = check(sentence)
      if (found.length === 0) released += sentence
      else problems.push(...found)
    }
    return { released, problems }
  }

  return {
    recordTool: (input, output) => {
      recordToolEvidence(evidence, input, output, positionFen)
    },
    push: (chunk) => {
      const split = splitSentences(buffer + chunk)
      buffer = split.rest
      return release(split.sentences)
    },
    flush: () => {
      const rest = buffer
      buffer = ''
      return release(rest === '' ? [] : [rest])
    },
  }
}

/** The message that makes the retry different from the first attempt. */
export function correctionFor(problems: readonly GuardProblem[]): string {
  const reasons = [...new Set(problems.map((problem) => problem.detail))]
  return [
    "The app's checks rejected your previous draft, and the user has not seen it:",
    ...reasons.map((reason) => `- ${reason}`),
    'Write the answer again from the start. Quote an evaluation only if a tool returned it in this answer (call analysePosition or evaluateMove), otherwise drop the number. Give only lines that are legal, or no line. If a puzzle is active, hint at the idea without naming the move.',
  ].join('\n')
}

/** Appended when the retry failed too and its offending sentences were cut. */
export const REMOVED_NOTICE =
  '\n\nI removed a claim from this answer because I could not verify it.'
