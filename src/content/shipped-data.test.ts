import { Chess } from 'chess.js'
import { beforeAll, describe, expect, it } from 'vitest'

import { PUZZLE_BANDS, puzzleUserMoves, type Puzzle, type PuzzleBand } from '@/domain'

import { createInlinePuzzleParser, textChunkSource } from './puzzle-parser'
import { formatSkippedRow, type SkippedPuzzleRow } from './puzzle-row'

/**
 * The shipped data, checked against the code that will read it.
 *
 * Why against `public/quiz/` rather than a fixture: the claim this sprint has to
 * defend is that *these ten thousand rows* import, and a fixture cannot defend it.
 *
 * `chess.js` is used directly here on purpose — S06's `@/chess` is being built in
 * parallel, and the legality replay should switch to it at integration.
 */

const bandCsvLoaders = import.meta.glob('../../public/quiz/band_*.csv', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const EXPECTED_ROWS: Readonly<Record<PuzzleBand, number>> = {
  pawn: 200,
  knight: 400,
  bishop: 800,
  rook: 1500,
  queen: 2700,
  king: 4400,
}

interface BandResult {
  readonly puzzles: Puzzle[]
  readonly skipped: SkippedPuzzleRow[]
  readonly rowsRead: number
}

const results = new Map<PuzzleBand, BandResult>()
let parseMs = 0

async function loadBand(band: PuzzleBand): Promise<BandResult> {
  const entry = Object.entries(bandCsvLoaders).find(([file]) => file.endsWith(`band_${band}.csv`))
  if (entry === undefined) throw new Error(`No band file for ${band}`)
  const text = await entry[1]()
  const url = `/quiz/band_${band}.csv`
  const parser = createInlinePuzzleParser(textChunkSource({ [url]: text }))
  const puzzles: Puzzle[] = []
  const skipped: SkippedPuzzleRow[] = []
  const started = performance.now()
  const summary = await parser.parseBand({ band, url }, (batch) => {
    puzzles.push(...batch.puzzles)
    skipped.push(...batch.skipped)
  })
  parseMs += performance.now() - started
  if (!summary.ok) throw new Error(summary.error.message)
  return { puzzles, skipped, rowsRead: summary.value.rowsRead }
}

beforeAll(async () => {
  for (const band of PUZZLE_BANDS) results.set(band, await loadBand(band))
}, 120_000)

const allPuzzles = (): Puzzle[] => PUZZLE_BANDS.flatMap((band) => results.get(band)?.puzzles ?? [])

describe('the shipped band files', () => {
  it.each(PUZZLE_BANDS)('reads every row of band_%s.csv', (band) => {
    const result = results.get(band)
    expect(result?.rowsRead).toBe(EXPECTED_ROWS[band])
  })

  it('validates all 10,000 rows with nothing skipped', () => {
    const skipped = PUZZLE_BANDS.flatMap((band) => results.get(band)?.skipped ?? [])
    // Printed rather than counted so a future data drop says which row broke.
    expect(skipped.map(formatSkippedRow)).toEqual([])
    expect(allPuzzles()).toHaveLength(10_000)
  })

  it('gives every puzzle a unique id', () => {
    const ids = new Set(allPuzzles().map((puzzle) => puzzle.id))
    expect(ids.size).toBe(10_000)
  })

  it('keeps the Lichess attribution on every puzzle', () => {
    const unattributed = allPuzzles().filter(
      (puzzle) => puzzle.source !== 'lichess' || puzzle.lichessId === undefined,
    )
    expect(unattributed.map((puzzle) => puzzle.id)).toEqual([])
  })
})

/** Why a seeded generator: a flaky "random 500" is a test nobody can debug. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample<T>(items: readonly T[], count: number, seed: number): T[] {
  const random = mulberry32(seed)
  const picked = [...items]
  for (let index = picked.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const left = picked[index]
    const right = picked[swap]
    if (left === undefined || right === undefined) continue
    picked[index] = right
    picked[swap] = left
  }
  return picked.slice(0, count)
}

describe('the puzzles are playable', () => {
  it('replays the whole solution of a random 500 as legal moves', () => {
    const failures: string[] = []
    for (const puzzle of sample(allPuzzles(), 500, 0x5eed)) {
      const game = new Chess()
      try {
        game.load(puzzle.fen)
      } catch {
        failures.push(`${puzzle.id}: FEN is not a position`)
        continue
      }
      for (const [index, uci] of puzzle.solution.entries()) {
        const from = uci.slice(0, 2)
        const to = uci.slice(2, 4)
        const promotion = uci.slice(4)
        try {
          game.move(promotion === '' ? { from, to } : { from, to, promotion })
        } catch {
          failures.push(`${puzzle.id}: move ${String(index + 1)} (${uci}) is not legal`)
          break
        }
      }
    }
    expect(failures).toEqual([])
  })

  it('always gives the side to move the first move', () => {
    const wrongTurn = sample(allPuzzles(), 500, 0xc0ffee).filter((puzzle) => {
      const [first] = puzzleUserMoves(puzzle)
      if (first === undefined) return true
      const game = new Chess()
      game.load(puzzle.fen)
      // A legal move for the side to move is, by definition, that side's move.
      return !game
        .moves({ verbose: true })
        .some((move) => move.from === first.slice(0, 2) && move.to === first.slice(2, 4))
    })
    expect(wrongTurn.map((puzzle) => puzzle.id)).toEqual([])
  })

  it('records how long parsing and validating all 10,000 rows took', () => {
    // Not an assertion about the machine this runs on: the budget in the sprint
    // plan is for a browser, and this only guards against an order-of-magnitude
    // regression in the parser itself.
    expect(parseMs).toBeLessThan(20_000)
    console.warn(`parsed + validated 10,000 rows in ${parseMs.toFixed(0)} ms`)
  })
})
