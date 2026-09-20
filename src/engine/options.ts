import { type EngineLine, type EnginePersonality, type EngineScore, MATE_SCORE_CP } from '@/domain'

import {
  type EngineStrength,
  MAX_UCI_ELO,
  MIN_STRENGTH_ELO,
  MIN_UCI_ELO,
  type SearchRequest,
} from './protocol'

/**
 * Everything that turns a request into UCI text, and the one judgement call that
 * is not the engine's: which of several good lines an opponent of a given
 * character should play.
 *
 * Pure on purpose — the worker sends whatever comes out of here, so these are the
 * functions to test rather than the engine.
 */

export interface UciOptionSetting {
  readonly name: string
  /** Already formatted the way UCI wants it: `true`/`false` for checks. */
  readonly value: string
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * Map a target rating onto the two handicaps Stockfish offers.
 *
 * `UCI_Elo` stops at 1320, which is still far above a beginner, so below that we
 * pin the limiter to its floor and add a Skill Level handicap — Skill Level makes
 * the engine sometimes prefer a worse move, which is what "plays like a beginner"
 * actually looks like. The rating-to-skill line is an approximation, not a
 * calibrated scale; treat the numbers as a dial, not a promise.
 */
export function strengthOptions(strength: EngineStrength): UciOptionSetting[] {
  if (strength.elo === null) {
    return [
      { name: 'UCI_LimitStrength', value: 'false' },
      { name: 'Skill Level', value: '20' },
    ]
  }

  const elo = clamp(strength.elo, MIN_STRENGTH_ELO, MAX_UCI_ELO)
  if (elo >= MIN_UCI_ELO) {
    return [
      { name: 'UCI_LimitStrength', value: 'true' },
      { name: 'UCI_Elo', value: String(elo) },
      { name: 'Skill Level', value: '20' },
    ]
  }

  const skill = clamp(Math.round((elo - MIN_STRENGTH_ELO) / 72), 0, 10)
  return [
    { name: 'UCI_LimitStrength', value: 'true' },
    { name: 'UCI_Elo', value: String(MIN_UCI_ELO) },
    { name: 'Skill Level', value: String(skill) },
  ]
}

/** The per-search options: everything that can change between two `go` commands. */
export function searchOptions(request: SearchRequest): UciOptionSetting[] {
  return [
    { name: 'MultiPV', value: String(request.multiPv) },
    { name: 'UCI_ShowWDL', value: request.showWdl ? 'true' : 'false' },
    ...strengthOptions(request.strength),
  ]
}

export function formatSetOption(option: UciOptionSetting): string {
  return `setoption name ${option.name} value ${option.value}`
}

/** `go` with no limit searches until `stop`; the protocol schema forbids that. */
export function formatGoCommand(request: SearchRequest): string {
  const parts = ['go']
  if (request.depth !== undefined) parts.push('depth', String(request.depth))
  if (request.movetimeMs !== undefined) parts.push('movetime', String(request.movetimeMs))
  if (request.nodes !== undefined) parts.push('nodes', String(request.nodes))
  return parts.join(' ')
}

/** One comparable number from the side-to-move's point of view, mates included. */
export function scoreToMoverCentipawns(score: EngineScore): number {
  if (score.kind === 'cp') return score.value
  return score.moves >= 0 ? MATE_SCORE_CP - score.moves : -MATE_SCORE_CP - score.moves
}

/** How far below the best line a candidate may sit before it is simply worse. */
const PERSONALITY_TOLERANCE_CP: Readonly<Record<EnginePersonality, number>> = {
  solid: 0,
  aggressive: 25,
  tricky: 60,
}

/**
 * Choose which MultiPV line an opponent of this character plays.
 *
 * This is a *sampling* rule over lines the engine already considers near-equal,
 * not a different engine: `solid` always takes the top line, `aggressive` takes
 * the one with the highest win permille (the sharpest try), and `tricky` takes the
 * one with the lowest draw permille (the most double-edged). Without WDL — the
 * caller did not ask for it — both fall back to the last near-equal line, which is
 * the least obvious one still sound.
 *
 * Returns `undefined` only for an empty list, which means the game is over.
 */
export function pickLineForPersonality(
  lines: readonly EngineLine[],
  personality: EnginePersonality,
): EngineLine | undefined {
  const ordered = [...lines].sort((a, b) => a.multipv - b.multipv)
  const best = ordered[0]
  if (best === undefined || personality === 'solid') return best

  const bestCp = scoreToMoverCentipawns(best.score)
  const tolerance = PERSONALITY_TOLERANCE_CP[personality]
  const candidates = ordered.filter(
    (line) => bestCp - scoreToMoverCentipawns(line.score) <= tolerance,
  )
  if (candidates.length <= 1) return best

  const withWdl = candidates.filter((line) => line.wdl !== undefined)
  if (withWdl.length === 0) return candidates[candidates.length - 1] ?? best

  return withWdl.reduce((chosen, line) => {
    const chosenWdl = chosen.wdl
    const lineWdl = line.wdl
    if (chosenWdl === undefined) return line
    if (lineWdl === undefined) return chosen
    if (personality === 'aggressive') return lineWdl.win > chosenWdl.win ? line : chosen
    return lineWdl.draw < chosenWdl.draw ? line : chosen
  })
}
