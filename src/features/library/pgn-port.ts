import {
  domainError,
  err,
  ok,
  parseValid,
  type DomainError,
  type Game,
  type Result,
} from '@/domain'

import { WorkerResponseSchema, fromWireError } from './worker-protocol'

import type { PgnBatchHandler, PgnParseSummary } from './pgn-import'
import type { PgnImportOptions, PgnWireSource, WorkerRequest } from './worker-protocol'

/**
 * The main-thread half of the PGN worker.
 *
 * Why the import service talks to this and not to `postMessage`: the service owns the
 * interesting logic — dedupe, progress, what to do with a skipped game — and it is far
 * easier to trust when it cannot see a worker at all. Swapping this port for a fake is
 * also the only way to test that logic, since jsdom has no `Worker`.
 */
export interface PgnPort {
  /** Batches are awaited in order, so a slow database throttles the parser. */
  parse: (
    source: PgnWireSource,
    options: PgnImportOptions,
    onBatch: PgnBatchHandler,
    signal?: AbortSignal,
  ) => Promise<Result<PgnParseSummary>>
  serialize: (games: readonly Game[]) => Promise<Result<string>>
  close: () => void
}

/** Injected in tests; in the app it is the one line that names the worker file. */
export type WorkerFactory = () => Worker

/** Why `type: 'module'`: the worker imports `@/chess` and the domain schemas. */
export const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./pgn.worker.ts', import.meta.url), { type: 'module', name: 'pgn' })

type Pending =
  | {
      readonly kind: 'parse'
      readonly onBatch: PgnBatchHandler
      readonly settle: (result: Result<PgnParseSummary>) => void
    }
  | { readonly kind: 'serialize'; readonly settle: (result: Result<string>) => void }

/**
 * A `PgnPort` backed by a dedicated worker.
 *
 * Replies are validated here as well as in the worker, because a message is `unknown`
 * however friendly its sender — and a reply that does not validate fails its request
 * rather than hanging it, which is the difference between an error state and a spinner
 * that never stops.
 */
export function createWorkerPgnPort(createWorker: WorkerFactory = defaultWorkerFactory): PgnPort {
  let worker: Worker | null = null
  let nextRequestId = 1
  const pending = new Map<number, Pending>()
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
        const parsed = parseValid(WorkerResponseSchema, event.data, 'PGN worker reply')
        if (!parsed.ok) {
          failAll(parsed.error)
          return
        }
        const message = parsed.value
        const request = pending.get(message.requestId)

        if (message.kind === 'failed') {
          const failure = fromWireError(message.error)
          if (request === undefined) {
            failAll(failure)
            return
          }
          pending.delete(message.requestId)
          request.settle(err(failure))
          return
        }
        if (request === undefined) return

        if (message.kind === 'serialized') {
          pending.delete(message.requestId)
          if (request.kind === 'serialize') request.settle(ok(message.pgn))
          return
        }
        if (request.kind !== 'parse') return

        if (message.kind === 'done') {
          pending.delete(message.requestId)
          const summary: PgnParseSummary = {
            gamesParsed: message.gamesParsed,
            skippedCount: message.skippedCount,
            bytesRead: message.bytesRead,
          }
          // Settle only once every batch handed over before it has been applied.
          queue = queue.then(() => {
            request.settle(ok(summary))
          })
          return
        }
        const onBatch = request.onBatch
        const requestId = message.requestId
        queue = queue.then(async () => {
          await onBatch({
            games: message.games,
            skipped: message.skipped,
            bytesRead: message.bytesRead,
            totalBytes: message.totalBytes,
            gamesParsed: message.gamesParsed,
          })
          // Only now is the worker allowed to parse further; see `AckRequestSchema`.
          if (worker !== null) send(worker, { kind: 'ack', requestId })
        })
      })
      created.addEventListener('error', (event: ErrorEvent) => {
        failAll(domainError('io', `The PGN worker failed: ${event.message}`))
      })
      worker = created
      return ok(created)
    } catch (cause: unknown) {
      return err(
        domainError('unsupported', 'This browser could not start the PGN worker', { cause }),
      )
    }
  }

  const send = (target: Worker, message: WorkerRequest): void => {
    target.postMessage(message)
  }

  return {
    parse(source, options, onBatch, signal) {
      const started = ensureWorker()
      if (!started.ok) return Promise.resolve(started)
      const target = started.value
      const requestId = nextRequestId
      nextRequestId += 1

      return new Promise<Result<PgnParseSummary>>((resolve) => {
        let settled = false
        const settle = (result: Result<PgnParseSummary>): void => {
          if (settled) return
          settled = true
          resolve(result)
        }
        pending.set(requestId, { kind: 'parse', onBatch, settle })

        if (signal !== undefined) {
          const onAbort = (): void => {
            send(target, { kind: 'cancel', requestId })
            pending.delete(requestId)
            settle(err(domainError('cancelled', 'The import was cancelled')))
          }
          if (signal.aborted) {
            onAbort()
            return
          }
          signal.addEventListener('abort', onAbort, { once: true })
        }

        send(target, { kind: 'parse', requestId, source, options })
      })
    },

    serialize(games) {
      const started = ensureWorker()
      if (!started.ok) return Promise.resolve(started)
      const target = started.value
      const requestId = nextRequestId
      nextRequestId += 1

      return new Promise<Result<string>>((resolve) => {
        let settled = false
        pending.set(requestId, {
          kind: 'serialize',
          settle: (result) => {
            if (settled) return
            settled = true
            resolve(result)
          },
        })
        send(target, { kind: 'serialize', requestId, games: [...games] })
      })
    },

    close() {
      worker?.terminate()
      worker = null
      failAll(domainError('cancelled', 'The PGN worker was closed'))
    },
  }
}
