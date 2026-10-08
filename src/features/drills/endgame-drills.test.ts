import { describe, expect, it } from 'vitest'

import { countMaterial, createGame, legalMoves } from '@/chess'
import type { Color, Fen } from '@/domain'

import {
  ENDGAME_CATEGORIES,
  ENDGAME_DRILLS,
  defenderColor,
  endgameDrillById,
  goalLabel,
} from './endgame-drills'
import { judgeDrill, startSession } from './endgame-session'

function lead(fen: Fen, color: Color): number {
  const count = countMaterial(fen)
  const diff = count.whitePoints - count.blackPoints
  return color === 'white' ? diff : -diff
}

describe('the endgame library', () => {
  it('covers mates, opposition, the square rule, Lucena and Philidor', () => {
    const ids = ENDGAME_DRILLS.map((drill) => drill.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'kq-vs-k',
        'kr-vs-k',
        'two-bishops',
        'opposition',
        'rule-square',
        'lucena',
        'philidor',
      ]),
    )
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('files every drill under a known category and gives it a positive par', () => {
    for (const drill of ENDGAME_DRILLS) {
      expect(ENDGAME_CATEGORIES).toContain(drill.category)
      expect(drill.par).toBeGreaterThan(0)
      expect(drill.technique.steps.length).toBeGreaterThan(0)
    }
  })

  it.each(ENDGAME_DRILLS.map((drill) => [drill.id, drill] as const))(
    '%s starts from a legal, unfinished position with the player to be useful',
    (_id, drill) => {
      const game = createGame(drill.fen)
      expect(game.ok).toBe(true)
      if (!game.ok) return
      expect(game.value.status.kind).toBe('in-progress')
      expect(legalMoves(game.value).length).toBeGreaterThan(0)

      const started = startSession(drill)
      expect(started.ok && started.value.outcome.kind).toBe('playing')
    },
  )

  it.each(ENDGAME_DRILLS.map((drill) => [drill.id, drill] as const))(
    '%s has a start that matches its goal',
    (_id, drill) => {
      const playerLead = lead(drill.fen, drill.userColor)
      if (drill.goal === 'draw') {
        // The defender begins behind; otherwise the drill would already be "held".
        expect(playerLead).toBeLessThan(0)
      } else {
        expect(playerLead).toBeGreaterThan(0)
      }
    },
  )

  it('gives the pawn drills a pawn and the promote goal', () => {
    for (const id of ['opposition', 'rule-square', 'lucena']) {
      const drill = endgameDrillById(id)
      expect(drill?.goal).toBe('promote')
      expect(drill === undefined ? 0 : countMaterial(drill.fen).white.p).toBe(1)
    }
  })

  it('has the engine move first when it is the engine’s turn at the start', () => {
    const opposition = endgameDrillById('opposition')
    const philidor = endgameDrillById('philidor')
    expect(opposition?.fen.split(' ')[1]).toBe('b')
    expect(opposition?.userColor).toBe('white')
    expect(philidor?.userColor).toBe('black')
    expect(philidor?.fen.split(' ')[1]).toBe('w')
  })

  it('makes Philidor the one drill where the player holds', () => {
    const goals = ENDGAME_DRILLS.filter((drill) => drill.goal === 'draw').map((drill) => drill.id)
    expect(goals).toEqual(['philidor'])
    const philidor = endgameDrillById('philidor')
    expect(philidor && defenderColor(philidor)).toBe('white')
  })

  it('labels each goal', () => {
    expect(goalLabel('mate')).toBe('Checkmate')
    expect(goalLabel('promote')).toBe('Promote')
    expect(goalLabel('draw')).toBe('Hold the draw')
  })

  it('judges every starting position as still playing', () => {
    for (const drill of ENDGAME_DRILLS) {
      const game = createGame(drill.fen)
      expect(game.ok && judgeDrill(drill, game.value).kind).toBe('playing')
    }
  })
})
