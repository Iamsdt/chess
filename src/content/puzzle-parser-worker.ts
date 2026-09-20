import { domainError, err, ok, parseValid, type DomainError, type Result } from '@/domain'

import { WorkerResponseSchema, fromWireError, type WorkerRequest } from './worker-protocol'

import type {
  BandParseSummary,
  PuzzleBatchHandler,
  PuzzleParser,
  BandParseRequest,
} from './puzzle-parser'

/**
 * The main-thread half of the CSV worker.
 *
 * Why it exists at all rather than the importer talking to `postMessage` itself:
 * the importer is the piece with the interesting logic (manifest, resume,
 * idempotency) and it is much easier to trust when it cannot see a worker.
 */

/** Injected in tests; in the app it is the one line that names the worker file. */
export type WorkerFactory = () => Worker

/** Why `type: 'module'`: the worker imports the domain schemas it validates rows with. */
export const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./puzzle-csv.worker.ts', import.meta.url), {
    type: 'module',
    name: 'puzzle-csv',
  })

interface PendingRequest {
  readonly onBatch: PuzzleBatchHandler
  readonly settle: (result: Result<BandParseSummary>) => void
}

/**
 * A `PuzzleParser` that does its work in a dedicated worker.
 *
 * Batches arrive already validated by the worker and are validated again here,
 * because a message is `unknown` however friendly its sender. The importer awaits
 * each batch handler before the next batch is applied, so a slow database write
 * cannot be outrun by the parser.
 */
export function createWorkerPuzzleParser(
  createWorker: WorkerFactory = defaultWorkerFactory,
): PuzzleParser {
  let worker: Worker | null = null
  let nextRequestId = 1
  const pending = new Map<number, PendingRequest>()
  /** Batch handlers are async; messages are not. One chain keeps them in order. */
  let queue: Promise<void> = Promise.resolve()

  const failAll = (error: DomainError): void => {
    const requests = [...pending.values()]
    pending.clear()
    for (const request of requests) request.settle(err(error))
  }

  const ensureWorker = (): Result<Worker> => {
    if (worker !== null) return ok(worker)
    try {
      const created = createWorker()
      created.addEventListener('message', (event: MessageEvent<unknown>) => {
        const parsed = parseValid(WorkerResponseSchema, event.data, 'puzzle CSV worker reply')
        if (!parsed.ok) {
          failAll(parsed.error)
          return
        }
        const message = parsed.value
        if (message.kind === 'failed') {
          const failure = fromWireError(message.error)
          const request = pending.get(message.requestId)
          if (request === undefined) {
            failAll(failure)
            return
          }
          pending.delete(message.requestId)
          request.settle(err(failure))
          return
        }
        if (message.kind === 'done') {
          const request = pending.get(message.requestId)
          if (request === undefined) return
          pending.delete(message.requestId)
          const summary = {
            band: message.band,
            rowsRead: message.rowsRead,
            puzzlesParsed: message.puzzlesParsed,
            skipped: message.skipped,
          }
          // Settle only once every batch handed over before it has been applied.
          queue = queue.then(() => {
            request.settle(ok(summary))
          })
          return
        }
        const request = pending.get(message.requestId)
        if (request === undefined) return
        queue = queue.then(async () => {
          await request.onBatch({
            band: message.band,
            puzzles: message.puzzles,
            rowsRead: message.rowsRead,
            skipped: message.skipped,
          })
        })
      })
      created.addEventListener('error', (event: ErrorEvent) => {
        failAll(domainError('io', `Puzzle CSV worker failed: ${event.message}`))
      })
      worker = created
      return ok(created)
    } catch (cause) {
      return err(
        domainError('unsupported', 'This browser could not start the puzzle CSV worker', { cause }),
      )
    }
  }

  const send = (target: Worker, message: WorkerRequest): void => {
    target.postMessage(message)
  }

  return {
    parseBand(request: BandParseRequest, onBatch, signal) {
      const started = ensureWorker()
      if (!started.ok) return Promise.resolve(started)
      const target = started.value
      const requestId = nextRequestId
      nextRequestId += 1

      return new Promise<Result<BandParseSummary>>((resolve) => {
        let settled = false
        const settle = (result: Result<BandParseSummary>): void => {
          if (settled) return
          settled = true
          resolve(result)
        }
        pending.set(requestId, { onBatch, settle })

        if (signal !== undefined) {
          const onAbort = (): void => {
            send(target, { kind: 'cancel', requestId })
            pending.delete(requestId)
            settle(
              err(domainError('cancelled', 'Puzzle import was cancelled', { where: request.url })),
            )
          }
          if (signal.aborted) {
            onAbort()
            return
          }
          signal.addEventListener('abort', onAbort, { once: true })
        }

        send(target, {
          kind: 'parse-band',
          requestId,
          band: request.band,
          url: request.url,
          ...(request.batchSize === undefined ? {} : { batchSize: request.batchSize }),
          ...(request.startRow === undefined ? {} : { startRow: request.startRow }),
        })
      })
    },
    close() {
      worker?.terminate()
      worker = null
      failAll(domainError('cancelled', 'Puzzle CSV worker was closed'))
    },
  }
}
