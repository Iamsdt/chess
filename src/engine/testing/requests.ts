import { START_FEN } from '@/domain'

import { type SearchRequest } from '../protocol'

/** A valid, minimal request: the starting position, one line, full strength. */
export const START_REQUEST: SearchRequest = {
  id: 'search-1',
  fen: START_FEN,
  lane: 'interactive',
  multiPv: 1,
  depth: 12,
  strength: { elo: null },
  showWdl: true,
}
