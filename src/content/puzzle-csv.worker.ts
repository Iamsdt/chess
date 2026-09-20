/// <reference lib="webworker" />

import { parseValid } from '@/domain'

import { createFetchChunkSource, parseBandFromSource } from './puzzle-parser'
import {
  WorkerRequestSchema,
  domainErrorFromUnknown,
  toWireError,
  toWireSkipped,
  type WorkerResponse,
} from './worker-protocol'

/**
 * The CSV worker.
 *
 * Deliberately thin: it owns no logic of its own, only the message loop. All the
 * parsing and validation lives in `puzzle-parser.ts` so it can be tested without
 * a `Worker`, and so the CLI can run exactly the code the app runs.
 */

const source = createFetchChunkSource()
const cancelled = new Set<number>()

function post(message: WorkerResponse): void {
  self.postMessage(message)
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = parseValid(WorkerRequestSchema, event.data, 'puzzle CSV worker message')
  if (!parsed.ok) {
    // `requestId: 0` is the "we could not tell whose message this was" channel; the
    // client fails every in-flight request rather than hanging on a lost reply.
    post({ kind: 'failed', requestId: 0, error: toWireError(parsed.error) })
    return
  }
  const request = parsed.value

  if (request.kind === 'cancel') {
    cancelled.add(request.requestId)
    return
  }

  const controller = new AbortController()
  const { requestId, band, url } = request
  void parseBandFromSource(
    source,
    {
      band,
      url,
      batchSize: request.batchSize,
      startRow: request.startRow,
    },
    (batch) => {
      if (cancelled.has(requestId)) {
        controller.abort()
        return
      }
      post({
        kind: 'batch',
        requestId,
        band: batch.band,
        puzzles: [...batch.puzzles],
        rowsRead: batch.rowsRead,
        skipped: toWireSkipped(batch.skipped),
      })
    },
    controller.signal,
  ).then(
    (result) => {
      cancelled.delete(requestId)
      if (result.ok) {
        post({
          kind: 'done',
          requestId,
          band: result.value.band,
          rowsRead: result.value.rowsRead,
          puzzlesParsed: result.value.puzzlesParsed,
          skipped: toWireSkipped(result.value.skipped),
        })
        return
      }
      post({ kind: 'failed', requestId, error: toWireError(result.error) })
    },
    (cause: unknown) => {
      cancelled.delete(requestId)
      post({ kind: 'failed', requestId, error: toWireError(domainErrorFromUnknown(cause)) })
    },
  )
})
