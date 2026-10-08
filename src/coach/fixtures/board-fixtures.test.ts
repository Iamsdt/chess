import { describe, expect, it } from 'vitest'

import { applyMove, createGame } from '@/chess'
import type { SageBoardAttachment, SageBoardStep } from '@/domain'

import { buildFrames } from '../sage-board/frames'

import {
  COMPARE_CARD,
  CONTROL_MAP_CARD,
  GM_THINKING,
  HINTS_CARD,
  IDEA_CARD,
  LINE_CARD,
  THREAT_CARD,
  WHAT_IF_CARD,
  YOUR_TURN_CARD,
} from './board-fixtures'

const BOARDS: readonly SageBoardAttachment[] = [
  WHAT_IF_CARD,
  THREAT_CARD,
  IDEA_CARD,
  LINE_CARD,
  COMPARE_CARD,
  CONTROL_MAP_CARD,
  YOUR_TURN_CARD,
  ...GM_THINKING.steps.flatMap((entry) => (entry.board === undefined ? [] : [entry.board])),
]

/** Every line a board can play: the main steps, and the compare card's second candidate. */
const LINES = BOARDS.flatMap((board) => [
  { name: board.title, fen: board.fen, steps: board.steps },
  ...(board.versus === undefined
    ? []
    : [
        {
          name: `${board.title} / ${board.versus.title}`,
          fen: board.fen,
          steps: board.versus.steps,
        },
      ]),
])

describe('Sage board fixtures', () => {
  it.each(LINES)('replays every SAN of "$name" through the rules', ({ fen, steps }) => {
    expect(createGame(fen).ok).toBe(true)
    // `buildFrames` stops at the first illegal move, so a short result means a bad SAN.
    expect(buildFrames(fen, steps)).toHaveLength(steps.length)
  })

  it.each(BOARDS.filter((board) => board.steps.some((step) => step.yourTurn)))(
    'accepts only legal moves on the your-turn step of "$title"',
    (board) => {
      const frames = buildFrames(board.fen, board.steps)
      const turns = frames.filter(
        (frame): frame is (typeof frames)[number] & { step: SageBoardStep } =>
          frame.step.yourTurn !== undefined,
      )
      expect(turns.length).toBeGreaterThan(0)
      for (const frame of turns) {
        for (const accepted of frame.step.yourTurn?.accept ?? []) {
          expect(applyMove(frame.game, accepted).ok, accepted).toBe(true)
        }
      }
    },
  )

  it('keeps the hint arrows legal from the hinted position', () => {
    const game = createGame(HINTS_CARD.fen)
    expect(game.ok).toBe(true)
    const move = HINTS_CARD.levels.at(-1)?.arrows[0]
    expect(move).toBeDefined()
    if (game.ok && move !== undefined) {
      expect(applyMove(game.value, { from: move.from, to: move.to }).ok).toBe(true)
    }
  })

  it('gives the thinking card its three boards', () => {
    const withBoard = GM_THINKING.steps.filter((entry) => entry.board !== undefined)
    expect(withBoard.map((entry) => entry.step)).toEqual(['candidates', 'calculate', 'compare'])
  })
})
