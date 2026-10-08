/// <reference lib="webworker" />

import { parseLines, type ParsedLines } from './pgn-lines'

/**
 * Parses a repertoire PGN off the main thread.
 *
 * Deliberately thin: the parsing is `parseLines`, which the tests run directly, so this
 * file is only the message loop. Replies are `{ ok, value | message }` because an error
 * object does not survive `postMessage` with its prototype.
 */

export type LinesWorkerReply =
  | { readonly ok: true; readonly value: ParsedLines }
  | { readonly ok: false; readonly message: string }

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const text = event.data
  if (typeof text !== 'string') {
    const reply: LinesWorkerReply = { ok: false, message: 'The worker expects PGN text' }
    self.postMessage(reply)
    return
  }
  const parsed = parseLines(text)
  const reply: LinesWorkerReply = parsed.ok
    ? { ok: true, value: parsed.value }
    : { ok: false, message: parsed.error.message }
  self.postMessage(reply)
})
