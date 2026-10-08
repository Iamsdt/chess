import { describe, expect, it } from 'vitest'

import { uciLineToSan } from '@/chess'
import { toSan, type MoveQuality } from '@/domain'

import { reviewGame } from './analyse'
import { explainMove, type ExplainInput } from './explain'
import { RECORDED_GAMES, recordedEngine, recordedGame } from './recorded-engine'

const input = (overrides: Partial<ExplainInput> = {}): ExplainInput => ({
  san: toSan('Nf6'),
  quality: 'blunder',
  bestSan: toSan('Nge7'),
  winBefore: 62,
  winAfter: 31,
  matedAfter: false,
  ...overrides,
})

describe('explainMove templates', () => {
  it('states the change in winning chances, rounded, and names the engine’s choice', () => {
    expect(explainMove(input({ winBefore: 61.6, winAfter: 30.4 }))).toBe(
      "Nf6 was a blunder. Your winning chances went from 62% to 30%. Nge7 was the engine's choice.",
    )
  })

  it('says nothing about a better move when the engine had none to offer', () => {
    const text = explainMove(input({ bestSan: undefined }))
    expect(text).not.toMatch(/engine's choice/)
  })

  it('only mentions a forced mate when the engine found one', () => {
    expect(explainMove(input({ matedAfter: true }))).toContain('It allows a forced mate.')
    expect(explainMove(input({ matedAfter: false }))).not.toContain('mate')
  })

  it('never invents numbers or moves for a move that was not a slip', () => {
    for (const quality of ['brilliant', 'great', 'best', 'excellent', 'good', 'book'] as const) {
      const text = explainMove(input({ quality, bestSan: toSan('Qh5') }))
      expect(text).toContain('Nf6')
      expect(text).not.toMatch(/\d+%/)
      expect(text).not.toContain('Qh5')
    }
  })

  it('has a distinct sentence for every verdict', () => {
    const qualities: readonly MoveQuality[] = [
      'brilliant',
      'great',
      'best',
      'excellent',
      'good',
      'book',
      'inaccuracy',
      'mistake',
      'miss',
      'blunder',
    ]
    const texts = qualities.map((quality) => explainMove(input({ quality })))
    expect(new Set(texts).size).toBe(qualities.length)
  })
})

describe('explanations agree with the engine data', () => {
  describe.each(RECORDED_GAMES)('$id', (recorded) => {
    it('names, in every explanation, only the move and line the engine gave for that position', async () => {
      const game = recordedGame(recorded)
      const engine = recordedEngine(recorded, { withBestMoves: true })
      const review = await reviewGame(game, engine.evaluate)
      if (!review.ok) throw new Error(review.error.message)

      let withEngineMove = 0
      for (const move of review.value.moves) {
        const said = engine.answers.get(move.fenBefore)
        const text = move.explanation ?? ''

        if (move.bestMove === undefined) {
          // Nothing better was recorded, or the engine agreed with the move played.
          expect(text, `ply ${String(move.ply)}`).not.toMatch(/engine's choice/)
          expect(move.bestMoveSan).toBeUndefined()
          expect(move.bestLine).toBeUndefined()
          continue
        }

        // The stored best move is the engine's, and is never the move that was played.
        expect(move.bestMove).toBe(said?.bestMove)
        expect(move.bestMove).not.toBe(move.uci)
        // The line starts with that move and replays legally to the SAN shown to the user.
        expect(move.bestLine?.[0]).toBe(move.bestMove)
        expect(move.bestLine).toEqual(said?.lines[0]?.pv.slice(0, move.bestLine?.length))
        const san = uciLineToSan(move.fenBefore, move.bestLine ?? [])
        expect(san.ok).toBe(true)
        if (san.ok) expect(san.value[0]).toBe(move.bestMoveSan)

        // Where the text names an engine move, it is that one, spelled the same way.
        if (text.includes("engine's choice")) {
          withEngineMove += 1
          expect(text).toContain(`${String(move.bestMoveSan)} was the engine's choice.`)
        }
      }
      // The check above must have had something to check.
      expect(withEngineMove).toBeGreaterThan(0)
    })

    it('quotes the same winning chances the stored evaluations give', async () => {
      const game = recordedGame(recorded)
      const review = await reviewGame(game, recordedEngine(recorded).evaluate)
      if (!review.ok) throw new Error(review.error.message)
      for (const move of review.value.moves) {
        const quoted = /went from (\d+)% to (\d+)%/.exec(move.explanation ?? '')
        if (quoted === null) continue
        expect(Number(quoted[1])).toBeGreaterThan(Number(quoted[2]))
        expect(move.evalBefore).toBeDefined()
        expect(move.evalAfter).toBeDefined()
      }
    })
  })
})
