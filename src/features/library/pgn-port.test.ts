import { describe, expect, it } from 'vitest'

import { makeGame } from '@/domain'
import type { Game } from '@/domain'

import { parsePgnStream, serializeGames, textPgnSource } from './pgn-import'
import { createWorkerPgnPort } from './pgn-port'
import { WorkerRequestSchema } from './worker-protocol'

/**
 * The worker seam, without a worker.
 *
 * jsdom has no `Worker`, and starting a real one would test the bundler rather than the
 * protocol. What matters here is that both halves speak the schema: a reply the main
 * thread cannot validate must fail the request rather than hang it, and every batch must
 * be applied before the request resolves.
 */

const PGN = [
  '[Event "One"]\n[White "a"]\n[Black "b"]\n[Result "1-0"]\n\n1. e4 e5 1-0\n',
  '[Event "Two"]\n[White "c"]\n[Black "d"]\n[Result "0-1"]\n\n1. d4 d5 0-1\n',
].join('\n')

type Listener = (event: MessageEvent<unknown>) => void

/** A `Worker` stand-in that runs the same code the real worker runs. */
class FakeWorker implements Pick<Worker, 'postMessage' | 'terminate'> {
  #listeners: Listener[] = []
  /** The real worker waits for an ack before parsing on; so does this one. */
  #acks: (() => void)[] = []
  acked = 0
  readonly #override: (requestId: number) => unknown[] | null

  constructor(override: (requestId: number) => unknown[] | null = () => null) {
    this.#override = override
  }

  addEventListener(type: string, listener: Listener): void {
    if (type !== 'message') return
    this.#listeners.push(listener)
  }

  postMessage(message: unknown): void {
    const request = WorkerRequestSchema.parse(message)
    if (request.kind === 'ack') {
      this.acked += 1
      this.#acks.shift()?.()
      return
    }
    if (request.kind === 'cancel') {
      for (const resolve of this.#acks) resolve()
      this.#acks = []
      return
    }
    const replies = this.#override(request.requestId)
    if (replies !== null) {
      for (const reply of replies) this.#emit(reply)
      return
    }
    if (request.kind === 'serialize') {
      const text = serializeGames(request.games)
      if (text.ok) this.#emit({ kind: 'serialized', requestId: request.requestId, pgn: text.value })
      return
    }
    const source = request.source
    if (source.kind !== 'text') return
    void parsePgnStream(textPgnSource(source.text, 40), request.options, (batch) => {
      this.#emit({
        kind: 'batch',
        requestId: request.requestId,
        games: batch.games,
        skipped: batch.skipped,
        bytesRead: batch.bytesRead,
        totalBytes: batch.totalBytes,
        gamesParsed: batch.gamesParsed,
      })
    }).then((result) => {
      if (!result.ok) return
      this.#emit({
        kind: 'done',
        requestId: request.requestId,
        gamesParsed: result.value.gamesParsed,
        skippedCount: result.value.skippedCount,
        bytesRead: result.value.bytesRead,
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

/** The port only ever uses the three members `FakeWorker` provides. */
const asWorker = (fake: FakeWorker): Worker => fake as unknown as Worker

describe('the worker-backed PGN port', () => {
  it('hands batches over and resolves with the summary', async () => {
    const port = createWorkerPgnPort(() => asWorker(new FakeWorker()))
    const seen: string[] = []
    const result = await port.parse(
      { kind: 'text', text: PGN },
      { source: 'pgn-import' },
      (batch) => {
        for (const game of batch.games) seen.push(game.meta.white.name)
      },
    )
    port.close()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.gamesParsed).toBe(2)
    expect(seen).toEqual(['a', 'c'])
  })

  it('applies every batch before it resolves, and acknowledges each one', async () => {
    const fake = new FakeWorker()
    const port = createWorkerPgnPort(() => asWorker(fake))
    let applied = 0
    const result = await port.parse(
      { kind: 'text', text: PGN },
      { source: 'pgn-import', batchSize: 1 },
      async () => {
        await Promise.resolve()
        applied += 1
      },
    )
    port.close()
    expect(result.ok).toBe(true)
    expect(applied).toBe(2)
    // One ack per batch: the worker never runs ahead of what has been stored.
    expect(fake.acked).toBe(2)
  })

  it('fails the request when the reply does not validate', async () => {
    const port = createWorkerPgnPort(() =>
      asWorker(new FakeWorker((requestId) => [{ kind: 'done', requestId, gamesParsed: 'lots' }])),
    )
    const result = await port.parse(
      { kind: 'text', text: PGN },
      { source: 'pgn-import' },
      () => undefined,
    )
    port.close()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
  })

  it('turns a worker failure back into a domain error', async () => {
    const port = createWorkerPgnPort(() =>
      asWorker(
        new FakeWorker((requestId) => [
          { kind: 'failed', requestId, error: { code: 'io', message: 'disk went away' } },
        ]),
      ),
    )
    const result = await port.parse(
      { kind: 'text', text: PGN },
      { source: 'pgn-import' },
      () => undefined,
    )
    port.close()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatchObject({ code: 'io', message: 'disk went away' })
  })

  it('settles a cancelled request instead of leaving it hanging', async () => {
    const port = createWorkerPgnPort(() => asWorker(new FakeWorker(() => [])))
    const controller = new AbortController()
    controller.abort()
    const result = await port.parse(
      { kind: 'text', text: PGN },
      { source: 'pgn-import' },
      () => undefined,
      controller.signal,
    )
    port.close()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('cancelled')
  })

  it('serializes through the same worker', async () => {
    const port = createWorkerPgnPort(() => asWorker(new FakeWorker()))
    const game: Game = makeGame({ pgn: '[Event "Kept"]\n\n1. e4 e5 1-0\n' })
    const result = await port.serialize([game])
    port.close()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toContain('[Event "Kept"]')
  })

  it('reports a browser that cannot start a worker', async () => {
    const port = createWorkerPgnPort(() => {
      throw new Error('Worker is not defined')
    })
    const result = await port.parse(
      { kind: 'text', text: PGN },
      { source: 'pgn-import' },
      () => undefined,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unsupported')
  })
})
