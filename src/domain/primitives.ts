import { z } from 'zod'

/**
 * Branded chess and time primitives.
 *
 * Why: a FEN, a SAN move, a UCI move and a square are all "just strings", and so
 * are the four of them to the compiler unless they are branded. Swapping `San`
 * for `Uci` is the single easiest mistake to make in this codebase.
 *
 * Every brand is applied by a schema, so the nominal type and the run-time check
 * are the same thing and cannot drift.
 */

const PLACEMENT_PIECES = 'pnbrqkPNBRQK'

function isValidPlacement(placement: string): boolean {
  const ranks = placement.split('/')
  if (ranks.length !== 8) return false
  let whiteKings = 0
  let blackKings = 0
  for (const rank of ranks) {
    let files = 0
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        files += Number(char)
      } else if (PLACEMENT_PIECES.includes(char)) {
        files += 1
        if (char === 'K') whiteKings += 1
        if (char === 'k') blackKings += 1
      } else {
        return false
      }
    }
    if (files !== 8) return false
  }
  return whiteKings === 1 && blackKings === 1
}

/**
 * Structural FEN check: six fields, eight full ranks, exactly one king a side.
 *
 * Why only structural: full legality (side not already in check, reachable en
 * passant square, …) needs the rules engine, which lives in `@/chess` (S06). This
 * layer rejects the malformed strings so the rules engine never sees them.
 */
export function isStructurallyValidFen(value: string): boolean {
  const parts = value.trim().split(/\s+/)
  if (parts.length !== 6) return false
  const placement = parts[0] ?? ''
  const side = parts[1] ?? ''
  const castling = parts[2] ?? ''
  const enPassant = parts[3] ?? ''
  const halfmove = parts[4] ?? ''
  const fullmove = parts[5] ?? ''
  if (!isValidPlacement(placement)) return false
  if (side !== 'w' && side !== 'b') return false
  if (castling !== '-' && !/^(?=.)K?Q?k?q?$/.test(castling)) return false
  if (enPassant !== '-' && !/^[a-h][36]$/.test(enPassant)) return false
  if (!/^\d+$/.test(halfmove)) return false
  if (!/^[1-9]\d*$/.test(fullmove)) return false
  return true
}

export const FenSchema = z
  .string()
  .refine(isStructurallyValidFen, { error: 'Not a well-formed six-field FEN' })
  .brand<'Fen'>()
export type Fen = z.infer<typeof FenSchema>
/** Why: the one validated place where a plain string becomes a `Fen`. */
export const toFen = (value: string): Fen => FenSchema.parse(value)

/** The starting position, as the one FEN every sprint can rely on. */
export const START_FEN: Fen = toFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')

/** Standard algebraic notation for a single move, with no `!`/`?` decoration. */
export const SAN_PATTERN =
  /^(?:[NBRQK][a-h]?[1-8]?x?[a-h][1-8]|(?:[a-h]x)?[a-h][1-8](?:=[NBRQ])?|O-O-O|O-O)[+#]?$/

export const SanSchema = z
  .string()
  .regex(SAN_PATTERN, { error: 'Not a standard algebraic move' })
  .brand<'San'>()
export type San = z.infer<typeof SanSchema>
/** Why: the one validated place where a plain string becomes a `San`. */
export const toSan = (value: string): San => SanSchema.parse(value)

/** Long algebraic engine/dataset notation, e.g. `e2e4`, `g7g8q`. */
export const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/

export const UciSchema = z
  .string()
  .regex(UCI_PATTERN, { error: 'Not a UCI move such as e2e4 or g7g8q' })
  .brand<'Uci'>()
export type Uci = z.infer<typeof UciSchema>
/** Why: the one validated place where a plain string becomes a `Uci`. */
export const toUci = (value: string): Uci => UciSchema.parse(value)

export const SquareSchema = z
  .string()
  .regex(/^[a-h][1-8]$/, { error: 'Not a board square such as e4' })
  .brand<'Square'>()
export type Square = z.infer<typeof SquareSchema>
/** Why: the one validated place where a plain string becomes a `Square`. */
export const toSquare = (value: string): Square => SquareSchema.parse(value)

/**
 * Every instant in this app is epoch milliseconds — never `Date`, never ISO
 * strings, never seconds.
 *
 * Why: it survives IndexedDB, `structuredClone` to a worker, JSON backups and
 * URL fragments unchanged, sorts and diffs as a plain number, and the brand stops
 * a seconds-based value (share links carry those) being mistaken for it.
 */
export const TimestampSchema = z.number().int().min(0).brand<'Timestamp'>()
export type Timestamp = z.infer<typeof TimestampSchema>
/** Why: the one validated place where a plain number becomes a `Timestamp`. */
export const toTimestamp = (value: number): Timestamp => TimestampSchema.parse(value)
/** Why: `Date` is allowed at the edges; this is where it stops. */
export const timestampFromDate = (date: Date): Timestamp => toTimestamp(date.getTime())
/** Why: formatting needs a `Date`; nothing else does. */
export const timestampToDate = (value: Timestamp): Date => new Date(value)
/** Why: a single clock call the tests can fake and the rest of the app can trust. */
export const now = (): Timestamp => toTimestamp(Date.now())

/**
 * A calendar day in the user's own time zone, `YYYY-MM-DD`.
 *
 * Why a second time representation: "did you practise today" is a local-calendar
 * question, and epoch milliseconds answer it wrongly across time zones and DST.
 * Streaks, the heatmap and the daily goal key off this; everything else uses
 * `Timestamp`.
 */
export const LocalDateSchema = z.iso.date().brand<'LocalDate'>()
export type LocalDate = z.infer<typeof LocalDateSchema>
/** Why: the one validated place where a plain string becomes a `LocalDate`. */
export const toLocalDate = (value: string): LocalDate => LocalDateSchema.parse(value)

/**
 * The local calendar day an instant falls on, in a named IANA time zone.
 *
 * Why `en-CA`: it is the locale whose short date format is already `YYYY-MM-DD`,
 * so no manual padding is needed.
 */
export function localDateOf(value: Timestamp, timeZone: string): LocalDate {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestampToDate(value))
  return toLocalDate(formatted)
}

/** Elo-style rating, shared by puzzles, the user and engine opponents. */
export const RatingSchema = z.number().int().min(0).max(4000)
export type Rating = z.infer<typeof RatingSchema>

/** A percentage the UI prints with a `%`, 0–100 (accuracy, mastery, popularity). */
export const PercentSchema = z.number().min(0).max(100)
export type Percent = z.infer<typeof PercentSchema>

/** A half-move index into a game, 0-based. */
export const PlySchema = z.number().int().min(0)
export type Ply = z.infer<typeof PlySchema>

/** A non-negative duration in milliseconds. */
export const DurationMsSchema = z.number().int().min(0)
export type DurationMs = z.infer<typeof DurationMsSchema>

/** ECO opening code, `A00`–`E99`. */
export const EcoCodeSchema = z.string().regex(/^[A-E][0-9]{2}$/, { error: 'Not an ECO code' })
export type EcoCode = z.infer<typeof EcoCodeSchema>

/** Wall-clock time of day, `HH:mm`, used by the daily reminder. */
export const ClockTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { error: 'Not a HH:mm time of day' })
export type ClockTime = z.infer<typeof ClockTimeSchema>
