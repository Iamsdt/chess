import { z } from 'zod'

import {
  domainError,
  err,
  ok,
  parseValid,
  SanSchema,
  UciSchema,
  type Fen,
  type Result,
  type San,
  type Uci,
} from '@/domain'

/**
 * S19 · the optional Lichess opening explorer.
 *
 * This is the only part of Chess King that talks to a server, so it is written to
 * be switched off and to fail quietly:
 *
 * - **Only the position leaves the device.** The request carries one query
 *   parameter, `fen`, and no headers that identify anyone. Nothing about the
 *   player, the tree or the engine is sent.
 * - **It never blocks the board.** The caller owns an `AbortSignal` and the screen
 *   renders with or without an answer.
 * - **Offline is a normal outcome, not an error page.** A failed lookup returns a
 *   `Result` whose message tells the player they can keep working offline.
 *
 * `fetchImpl` is injectable so the whole thing is testable without a network.
 */

export const LICHESS_MASTERS_URL = 'https://explorer.lichess.ovh/masters'

/** What the app shows about the explorer, in the words that must appear on screen. */
export const EXPLORER_SOURCE_LABEL = 'Lichess masters database'

const CountsSchema = z.object({
  white: z.number().int().min(0),
  draws: z.number().int().min(0),
  black: z.number().int().min(0),
})

const ExplorerMoveSchema = CountsSchema.extend({
  uci: UciSchema,
  san: SanSchema,
})

const ExplorerResponseSchema = CountsSchema.extend({
  moves: z.array(ExplorerMoveSchema),
  opening: z.object({ eco: z.string(), name: z.string() }).nullish(),
})

export interface ExplorerMove {
  readonly uci: Uci
  readonly san: San
  readonly games: number
  /** Percentages of `games`, rounded to whole numbers that add up to 100. */
  readonly whitePercent: number
  readonly drawPercent: number
  readonly blackPercent: number
}

export interface ExplorerReport {
  readonly totalGames: number
  readonly moves: readonly ExplorerMove[]
  readonly openingName: string | null
}

export interface ExplorerOptions {
  readonly fetchImpl?: typeof globalThis.fetch
  readonly signal?: AbortSignal
  /** Overridden only by tests; the real endpoint is the default. */
  readonly url?: string
  /** Injectable so the offline path can be exercised without touching the browser. */
  readonly isOnline?: () => boolean
}

/**
 * Split the three results into whole percentages that still add up to 100.
 *
 * Why bother: the bar in the table is drawn from these three widths, and three
 * independently rounded numbers leave a visible gap at 33/33/33.
 */
function percentages(
  white: number,
  draws: number,
  black: number,
): { white: number; draw: number; black: number } {
  const total = white + draws + black
  if (total === 0) return { white: 0, draw: 0, black: 0 }
  const whitePercent = Math.round((white / total) * 100)
  const drawPercent = Math.round((draws / total) * 100)
  return { white: whitePercent, draw: drawPercent, black: 100 - whitePercent - drawPercent }
}

function defaultIsOnline(): boolean {
  // `navigator.onLine` only ever proves the *absence* of a network, which is all
  // this needs: a `true` still goes through the normal failure path.
  return typeof navigator === 'undefined' || navigator.onLine
}

/**
 * Look the position up in the masters database.
 *
 * Returns a `network` error when the device is offline or the request fails, so
 * the panel can say "offline" rather than "something went wrong".
 */
export async function lookupExplorer(
  fen: Fen,
  options: ExplorerOptions = {},
): Promise<Result<ExplorerReport>> {
  const isOnline = options.isOnline ?? defaultIsOnline
  if (!isOnline()) {
    return err(
      domainError('network', 'You are offline, so the explorer has nothing to look in', {
        where: EXPLORER_SOURCE_LABEL,
      }),
    )
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const url = `${options.url ?? LICHESS_MASTERS_URL}?fen=${encodeURIComponent(fen)}`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Nothing about this request should carry an identity with it.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
  } catch (cause) {
    if (options.signal?.aborted === true) {
      return err(
        domainError('cancelled', 'The lookup was cancelled', { where: EXPLORER_SOURCE_LABEL }),
      )
    }
    return err(
      domainError('network', 'The explorer could not be reached. Analysis works offline.', {
        where: EXPLORER_SOURCE_LABEL,
        cause,
      }),
    )
  }

  if (!response.ok) {
    return err(
      domainError(
        'network',
        `The explorer is not answering right now (${String(response.status)}). Analysis works offline.`,
        { where: EXPLORER_SOURCE_LABEL },
      ),
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (cause) {
    return err(
      domainError('network', 'The explorer sent something that is not JSON', {
        where: EXPLORER_SOURCE_LABEL,
        cause,
      }),
    )
  }

  const parsed = parseValid(ExplorerResponseSchema, payload, EXPLORER_SOURCE_LABEL)
  if (!parsed.ok) return parsed

  const data = parsed.value
  return ok({
    totalGames: data.white + data.draws + data.black,
    openingName: data.opening?.name ?? null,
    moves: data.moves.map((move) => {
      const games = move.white + move.draws + move.black
      const split = percentages(move.white, move.draws, move.black)
      return {
        uci: move.uci,
        san: move.san,
        games,
        whitePercent: split.white,
        drawPercent: split.draw,
        blackPercent: split.black,
      }
    }),
  })
}
