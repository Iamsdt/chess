import { describe, expect, it } from 'vitest'

import { parseBandFromSource, textChunkSource } from './puzzle-parser'
import { createWorkerPuzzleParser } from './puzzle-parser-worker'
import { WorkerRequestSchema, toWireSkipped } from './worker-protocol'

/**
 * The worker seam, without a worker.
 *
 * jsdom has no `Worker`, and spinning a real one up would test the bundler rather
 * than the protocol. What matters here is that both halves speak the schema: a
 * reply the main thread cannot validate must fail the request rather than hang it.
 */

const HEADER =
  'id,fen,solution_ucis,category,sub_level,difficulty,title,theme,prompt,rating,rating_label,tags,explanation,active,source,lichess_id,nb_plays,popularity,opening_tags'
const FEN = 'rn2k2r/pQ2nppp/2p5/8/4p1bN/P5P1/P1qP1PBP/R1B1K2R b KQkq - 2 11'
const ROW = `lc_1,${FEN},"{""c2d1""}",pawn,1,beginner,Pawn 1,mateIn1,Black to move.,789,Novice,"{""mate""}",Mate in one.,true,lichess,abc,10,90,{}`
const CSV = `${HEADER}\n${ROW}\n`

type Listener = (event: MessageEvent<unknown>) => void

/** A `Worker` stand-in that runs the same parsing code the real worker runs. */
class FakeWorker implements Pick<Worker, 'postMessage' | 'terminate'> {
  #listeners: Listener[] = []
  readonly #replies: (requestId: number) => unknown[] | null

  constructor(replies: (requestId: number) => unknown[] | null = () => null) {
    this.#replies = replies
  }

  addEventListener(type: string, listener: Listener): void {
    if (type !== 'message') return
    this.#listeners.push(listener)
  }

  postMessage(message: unknown): void {
    const request = WorkerRequestSchema.parse(message)
    if (request.kind !== 'parse-band') return
    const override = this.#replies(request.requestId)
    if (override !== null) {
      for (const reply of override) this.#emit(reply)
      return
    }
    void parseBandFromSource(
      textChunkSource({ [request.url]: CSV }),
      { band: request.band, url: request.url },
      (batch) => {
        this.#emit({
          kind: 'batch',
          requestId: request.requestId,
          band: batch.band,
          puzzles: batch.puzzles,
          rowsRead: batch.rowsRead,
          skipped: toWireSkipped(batch.skipped),
        })
      },
    ).then((result) => {
      if (!result.ok) return
      this.#emit({
        kind: 'done',
        requestId: request.requestId,
        band: result.value.band,
        rowsRead: result.value.rowsRead,
        puzzlesParsed: result.value.puzzlesParsed,
        skipped: toWireSkipped(result.value.skipped),
      })
    })
  }

  terminate(): void {
    this.#listeners = []
  }

  #emit(data: unknown): void {
    for (const listener of this.#listeners) listener(new MessageEvent('message', { data }))
  }
}

/** The client only ever uses the three members `FakeWorker` provides. */
const asWorker = (fake: FakeWorker): Worker => fake as unknown as Worker

describe('the worker-backed parser', () => {
  it('hands batches over and resolves with the summary', async () => {
    const parser = createWorkerPuzzleParser(() => asWorker(new FakeWorker()))
    const seen: string[] = []
    const result = await parser.parseBand({ band: 'pawn', url: '/quiz/band_pawn.csv' }, (batch) => {
      for (const puzzle of batch.puzzles) seen.push(puzzle.id)
    })
    parser.close()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.puzzlesParsed).toBe(1)
    expect(seen).toEqual(['lc_1'])
  })

  it('applies every batch before it resolves', async () => {
    const parser = createWorkerPuzzleParser(() => asWorker(new FakeWorker()))
    let applied = 0
    const result = await parser.parseBand(
      { band: 'pawn', url: '/quiz/band_pawn.csv' },
      async () => {
        await Promise.resolve()
        applied += 1
      },
    )
    parser.close()
    expect(result.ok).toBe(true)
    expect(applied).toBe(1)
  })

  it('fails the request when the reply does not validate', async () => {
    const parser = createWorkerPuzzleParser(() =>
      asWorker(new FakeWorker((requestId) => [{ kind: 'done', requestId, band: 'nowhere' }])),
    )
    const result = await parser.parseBand(
      { band: 'pawn', url: '/quiz/band_pawn.csv' },
      () => undefined,
    )
    parser.close()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
  })

  it('turns a worker-side failure back into a domain error', async () => {
    const parser = createWorkerPuzzleParser(() =>
      asWorker(
        new FakeWorker((requestId) => [
          { kind: 'failed', requestId, error: { code: 'io', message: 'HTTP 404', where: '/quiz' } },
        ]),
      ),
    )
    const result = await parser.parseBand(
      { band: 'pawn', url: '/quiz/band_pawn.csv' },
      () => undefined,
    )
    parser.close()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('io')
    expect(result.error.message).toBe('HTTP 404')
  })

  it('reports a browser that cannot start the worker as a value, not a throw', async () => {
    const parser = createWorkerPuzzleParser(() => {
      throw new Error('Worker is not defined')
    })
    const result = await parser.parseBand(
      { band: 'pawn', url: '/quiz/band_pawn.csv' },
      () => undefined,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unsupported')
  })

  it('cancels an in-flight band', async () => {
    const controller = new AbortController()
    const parser = createWorkerPuzzleParser(() => asWorker(new FakeWorker(() => [])))
    const pending = parser.parseBand(
      { band: 'pawn', url: '/quiz/band_pawn.csv' },
      () => undefined,
      controller.signal,
    )
    controller.abort()
    const result = await pending
    parser.close()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('cancelled')
  })
})
