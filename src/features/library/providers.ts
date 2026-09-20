import { z } from 'zod'

import { domainError, err, ok, parseValid, type Result } from '@/domain'

import type { FeedChunk, PgnFeed } from './import-service'

/**
 * Lichess and Chess.com, fetched straight from the browser.
 *
 * Three things govern this file.
 *
 * **No server of ours is involved.** Both providers expose the games a user has already
 * made public, over CORS, without a key. That is the only reason this app can import at
 * all without accounts, and the import panel says so.
 *
 * **A rate limit is a value, not a crash.** Lichess answers a burst with `429` and a
 * one-minute penalty; Chess.com throttles per archive. Both are handled the same way:
 * honour `Retry-After`, wait, try again a bounded number of times, and if the budget runs
 * out return an error that tells the user how long to wait rather than a stack trace.
 *
 * **`fetch` is injected.** Every test here runs against a stub; the network is never
 * touched by the suite, and the same seam is what lets the screen show a believable
 * offline state.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface ProviderDeps {
  readonly fetch: FetchLike
  /** Injected so a rate-limit test does not take a minute to run. */
  readonly sleep?: (ms: number) => Promise<void>
  /** Attempts per request, including the first. */
  readonly maxAttempts?: number
}

/** Lichess documents a one-minute penalty for a 429 with no `Retry-After`. */
export const DEFAULT_RETRY_MS = 60_000
export const DEFAULT_MAX_ATTEMPTS = 3

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** Why a function: TypeScript narrows `signal.aborted` at the first check, and an abort
 *  that happens during the `await` in between would then be invisible. */
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}

function retryDelayMs(response: Response): number {
  const header = response.headers.get('retry-after')
  if (header === null) return DEFAULT_RETRY_MS
  const seconds = Number.parseInt(header, 10)
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_RETRY_MS
}

/**
 * One request, with the retry policy both providers need.
 *
 * Why `no-store`: an import is explicitly asking for what is there now, and a cached
 * archive would silently hide the games the user just played.
 */
async function request(
  url: string,
  accept: string,
  deps: ProviderDeps,
  signal: AbortSignal | undefined,
): Promise<Result<Response>> {
  const sleep = deps.sleep ?? defaultSleep
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  let attempt = 0
  for (;;) {
    attempt += 1
    if (isAborted(signal)) {
      return err(domainError('cancelled', 'The import was cancelled', { where: url }))
    }
    let response: Response
    try {
      response = await deps.fetch(url, {
        headers: { Accept: accept },
        cache: 'no-store',
        ...(signal === undefined ? {} : { signal }),
      })
    } catch (cause: unknown) {
      if (isAborted(signal)) {
        return err(domainError('cancelled', 'The import was cancelled', { where: url }))
      }
      return err(
        domainError('network', 'Could not reach the server. Are you offline?', {
          where: url,
          cause,
        }),
      )
    }
    if (response.ok) return ok(response)
    if (response.status === 404) {
      return err(domainError('not-found', 'No account with that username', { where: url }))
    }
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt >= maxAttempts) {
      const wait = Math.round(retryDelayMs(response) / 1000)
      return err(
        domainError(
          response.status === 429 ? 'network' : 'io',
          response.status === 429
            ? `The server is rate-limiting this import. Try again in about ${String(wait)} seconds.`
            : `The server answered ${String(response.status)}`,
          { where: url },
        ),
      )
    }
    await sleep(retryDelayMs(response))
  }
}

async function requestText(
  url: string,
  accept: string,
  deps: ProviderDeps,
  signal: AbortSignal | undefined,
): Promise<Result<string>> {
  const response = await request(url, accept, deps, signal)
  if (!response.ok) return response
  try {
    return ok(await response.value.text())
  } catch (cause: unknown) {
    return err(domainError('io', 'The download was interrupted', { where: url, cause }))
  }
}

export interface LichessOptions {
  readonly username: string
  /** Newest first; Lichess caps an anonymous export well above anything a library needs. */
  readonly max?: number
  /** Only games started at or after this instant, as epoch milliseconds. */
  readonly since?: number
  readonly rated?: boolean
}

export const LICHESS_ORIGIN = 'https://lichess.org'

/** Why the whole export is one chunk: Lichess streams a single PGN, and the worker
 *  already reads it in pieces, so splitting it here would only add seams. */
export function lichessFeed(options: LichessOptions, deps: ProviderDeps): PgnFeed {
  const params = new URLSearchParams({ clocks: 'true', evals: 'false', opening: 'false' })
  if (options.max !== undefined) params.set('max', String(options.max))
  if (options.since !== undefined) params.set('since', String(options.since))
  if (options.rated !== undefined) params.set('rated', String(options.rated))
  const url = `${LICHESS_ORIGIN}/api/games/user/${encodeURIComponent(options.username)}?${params.toString()}`

  return async function* feed(signal) {
    const text = await requestText(url, 'application/x-chess-pgn', deps, signal)
    if (!text.ok) {
      yield text
      return
    }
    yield ok<FeedChunk>({
      label: `Lichess · ${options.username}`,
      pgn: text.value,
      index: 1,
      total: 1,
    })
  }
}

export const CHESSCOM_ORIGIN = 'https://api.chess.com'

const ArchivesSchema = z.object({ archives: z.array(z.url()) })

export interface ChesscomOptions {
  readonly username: string
  /** How many monthly archives to pull, newest first. A year is the panel's default. */
  readonly months?: number
}

const ARCHIVE_MONTH = /(\d{4})\/(\d{2})\/?$/

/** Why a chunk per month: Chess.com only exposes monthly archives, and one month is
 *  also the unit that makes a progress bar mean something. */
export function chesscomFeed(options: ChesscomOptions, deps: ProviderDeps): PgnFeed {
  const listUrl = `${CHESSCOM_ORIGIN}/pub/player/${encodeURIComponent(options.username.toLowerCase())}/games/archives`

  return async function* feed(signal) {
    const listed = await requestText(listUrl, 'application/json', deps, signal)
    if (!listed.ok) {
      yield listed
      return
    }
    let raw: unknown
    try {
      raw = JSON.parse(listed.value)
    } catch (cause: unknown) {
      yield err(domainError('validation', 'Chess.com sent something unreadable', { cause }))
      return
    }
    const parsed = parseValid(ArchivesSchema, raw, 'Chess.com archive list')
    if (!parsed.ok) {
      yield parsed
      return
    }
    const months = options.months ?? 12
    const archives = parsed.value.archives.slice(-months).reverse()
    for (const [at, archive] of archives.entries()) {
      const month = ARCHIVE_MONTH.exec(archive)
      const label =
        month === null
          ? `Chess.com · ${options.username}`
          : `${month[1] ?? ''}-${month[2] ?? ''} · ${options.username}`
      const text = await requestText(`${archive}/pgn`, 'application/x-chess-pgn', deps, signal)
      if (!text.ok) {
        yield text
        return
      }
      yield ok<FeedChunk>({ label, pgn: text.value, index: at + 1, total: archives.length })
    }
  }
}
