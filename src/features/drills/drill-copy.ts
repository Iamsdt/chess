import { SCORE_UNITS } from './vision-modes'

import type { EndgameRecord, VisionMode, VisionRecords } from './drill-records'
import type { EndgameDrill } from './endgame-drills'

/** Stored-record wording shared by the drill lists and the cards. */

/** The line under a drill's name, built only from what has really been played. */
export function drillStatsText(drill: EndgameDrill, record: EndgameRecord): string {
  if (record.attempts === 0) return `Not tried · par ${String(drill.par)}`
  if (drill.goal === 'draw') {
    return `Held ${String(record.wins)} of ${String(record.attempts)}`
  }
  if (record.bestMoves === null) {
    return `Not won yet · ${String(record.attempts)} ${record.attempts === 1 ? 'try' : 'tries'}`
  }
  return `Best ${String(record.bestMoves)} · par ${String(drill.par)}`
}

/** The line at the bottom of a card, from the stored best. */
export function modeBestText(mode: VisionMode, records: VisionRecords): string {
  const record = records[mode]
  if (record.plays === 0) return 'New · try it'
  return `Best: ${String(record.best)} ${SCORE_UNITS[mode]}`
}
