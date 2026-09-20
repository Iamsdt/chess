/// <reference lib="webworker" />

import { parseValid } from '@/domain'

import { blobPgnSource, parsePgnStream, serializeGames, textPgnSource } from './pgn-import'
import {
  WorkerRequestSchema,
  domainErrorFromUnknown,
  toWireError,
  type WorkerResponse,
} from './worker-protocol'

/**
 * The PGN worker.
 *
 * Deliberately thin: it owns no logic of its own, only the message loop. Parsing,
 * mapping and serializing live in `pgn-import.ts` so they can be tested without a
 * `Worker` — jsdom has none — and so the code this worker runs is the code the tests run.
 */

const cancelled = new Set<number>()
/** One queue of "waiting for the main thread to say it stored the last batch", per request. */
const waiting = new Map<number, (() => void)[]>()

function post(message: WorkerResponse): void {
  self.postMessage(message)
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = parseValid(WorkerRequestSchema, event.data, 'PGN worker message')
  if (!parsed.ok) {
    // `requestId: 0` is the "we could not tell whose message this was" channel; the
    // client fails every in-flight request rather than leaving one hanging forever.
    post({ kind: 'failed', requestId: 0, error: toWireError(parsed.error) })
    return
  }
  const request = parsed.value

  if (request.kind === 'cancel') {
    cancelled.add(request.requestId)
    // Release the parser so it can notice the cancellation rather than wait for an ack.
    for (const resolve of waiting.get(request.requestId) ?? []) resolve()
    waiting.delete(request.requestId)
    return
  }

  if (request.kind === 'ack') {
    waiting.get(request.requestId)?.shift()?.()
    return
  }

  if (request.kind === 'serialize') {
    const text = serializeGames(request.games)
    post(
      text.ok
        ? { kind: 'serialized', requestId: request.requestId, pgn: text.value }
        : { kind: 'failed', requestId: request.requestId, error: toWireError(text.error) },
    )
    return
  }

  const controller = new AbortController()
  const { requestId, source, options } = request
  const stream = source.kind === 'text' ? textPgnSource(source.text) : blobPgnSource(source.blob)

  void parsePgnStream(
    stream,
    options,
    async (batch) => {
      if (cancelled.has(requestId)) {
        controller.abort()
        return
      }
      post({
        kind: 'batch',
        requestId,
        games: [...batch.games],
        skipped: [...batch.skipped],
        bytesRead: batch.bytesRead,
        totalBytes: batch.totalBytes,
        gamesParsed: batch.gamesParsed,
      })
      // Wait to be told the batch landed before parsing the next one.
      await new Promise<void>((resolve) => {
        const queue = waiting.get(requestId) ?? []
        queue.push(resolve)
        waiting.set(requestId, queue)
      })
    },
    controller.signal,
  ).then(
    (result) => {
      cancelled.delete(requestId)
      waiting.delete(requestId)
      post(
        result.ok
          ? {
              kind: 'done',
              requestId,
              gamesParsed: result.value.gamesParsed,
              skippedCount: result.value.skippedCount,
              bytesRead: result.value.bytesRead,
            }
          : { kind: 'failed', requestId, error: toWireError(result.error) },
      )
    },
    (cause: unknown) => {
      cancelled.delete(requestId)
      waiting.delete(requestId)
      post({ kind: 'failed', requestId, error: toWireError(domainErrorFromUnknown(cause)) })
    },
  )
})
