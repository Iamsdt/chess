import type { PieceSet } from '@/design'

import type { PieceCode } from './placement'

/**
 * Where the self-hosted piece artwork lives.
 *
 * Why self-hosted at all: the app has to work offline and inside a service-worker
 * precache, so no board may ever reach a CDN for a knight.
 *
 * Licences: the four sets arrived with the prototype (`prototype/assets/pieces/`)
 * and carry no licence file or SVG metadata of their own. They are recorded, with
 * whatever the upstream projects state, in `docs/licences.md` (S10) — this module
 * deliberately does not assert a licence it cannot see.
 */
export const PIECE_BASE_PATH = '/pieces'

/** Human-readable names, in the order the settings screen offers them. */
export const PIECE_SET_LABELS: Record<PieceSet, string> = {
  california: 'California',
  staunty: 'Staunty',
  maestro: 'Maestro',
  alpha: 'Alpha',
}

/** The SVG for one piece. Codes are spelled like the filenames on purpose. */
export const pieceImageUrl = (set: PieceSet, code: PieceCode): string =>
  `${PIECE_BASE_PATH}/${set}/${code}.svg`
