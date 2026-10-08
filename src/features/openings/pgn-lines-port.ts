import { z } from 'zod'

import { domainError, err, ok, type Result } from '@/domain'

import {
  parseLines,
  ParsedLinesSchema,
  WORKER_THRESHOLD_CHARS,
  type ParsedLines,
} from './pgn-lines'

/**
 * The main-thread side of the lines worker.
 *
 * Small pastes are parsed inline because starting a worker costs more than parsing a
 * chapter; anything large goes to a worker so a 5 MB study never blocks input. The worker
 * factory is injected because jsdom has no `Worker`.
 */
export interface LinesPort {
  parse: (text: string) => Promise<Result<ParsedLines>>
}

export type LinesWorkerFactory = () => Worker

const ReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: ParsedLinesSchema }),
  z.object({ ok: z.literal(false), message: z.string() }),
])

export const defaultLinesWorkerFactory: LinesWorkerFactory = () =>
  new Worker(new URL('./pgn-lines.worker.ts', import.meta.url), {
    type: 'module',
    name: 'pgn-lines',
  })

export function createLinesPort(
  createWorker: LinesWorkerFactory = defaultLinesWorkerFactory,
  threshold: number = WORKER_THRESHOLD_CHARS,
): LinesPort {
  return {
    parse(text) {
      if (text.length < threshold || typeof Worker === 'undefined') {
        return Promise.resolve(parseLines(text))
      }
      return new Promise((resolve) => {
        let worker: Worker
        try {
          worker = createWorker()
        } catch {
          resolve(parseLines(text))
          return
        }
        worker.addEventListener('message', (event: MessageEvent<unknown>) => {
          worker.terminate()
          const reply = ReplySchema.safeParse(event.data)
          if (!reply.success) {
            resolve(err(domainError('validation', 'The PGN worker sent an unreadable reply')))
          } else if (reply.data.ok) {
            resolve(ok(reply.data.value))
          } else {
            resolve(err(domainError('validation', reply.data.message, { where: 'PGN' })))
          }
        })
        worker.addEventListener('error', (event: ErrorEvent) => {
          worker.terminate()
          resolve(err(domainError('io', `The PGN worker failed: ${event.message}`)))
        })
        worker.postMessage(text)
      })
    },
  }
}
