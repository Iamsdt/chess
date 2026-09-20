import { CONTENT_PACK_FORMAT_VERSION } from '../content'
import {
  toLessonId,
  toLessonStepId,
  toPackId,
  toRepertoireNodeId,
  toTrackId,
  toUnitId,
} from '../ids'
import { positionKeyFromFen } from '../openings'
import { toFen, toSan, toSquare, toUci } from '../primitives'

import { FIXTURE_NOW, withOverrides } from './base'
import { makePuzzle } from './puzzle'

import type { ContentPack } from '../content'
import type { Lesson, LessonStep } from '../lesson'
import type { RepertoireNode } from '../openings'

/** The royal-fork step the prototype's lesson page shows. */
const FORK_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 6 5'
const CARO_KANN_ADVANCE_FEN = 'rnbqkbnr/pp2pppp/2p5/3pP3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3'

export function makeLessonStep(overrides?: Partial<LessonStep>): LessonStep {
  return withOverrides<LessonStep>(
    {
      id: toLessonStepId('step-royal-fork-3'),
      index: 2,
      kind: 'move',
      fen: toFen(FORK_FEN),
      orientation: 'white',
      prompt: 'Win material with a single knight move.',
      text: 'Both the king and the rook sit on squares a knight can reach at once.',
      expectedMoves: [toSan('Nxf7')],
      alternativeMoves: [toSan('Bxf7+')],
      alternativeText: 'That wins a pawn, but the fork wins the exchange.',
      focusSquares: [toSquare('f7'), toSquare('e8'), toSquare('h8')],
      arrows: [],
      marks: [],
      hints: ['Look for a check.', 'The knight has a square nobody defends.'],
      successText: "That's the royal fork.",
      failureText: 'Close. Good eye for forks.',
      keyIdea: 'A knight on f7 attacks the king and the rook at the same time.',
    },
    overrides,
  )
}

export function makeLesson(overrides?: Partial<Lesson>): Lesson {
  return withOverrides<Lesson>(
    {
      id: toLessonId('lesson-royal-fork'),
      packId: toPackId('chess-king-core'),
      trackId: toTrackId('track-tactics-foundations'),
      unitId: toUnitId('unit-double-attacks'),
      title: 'The royal fork',
      summary: 'A knight that hits the king and a rook wins material on the spot.',
      difficulty: 'beginner',
      estimatedMinutes: 6,
      themes: ['fork', 'knight'],
      prerequisites: [],
      steps: [makeLessonStep()],
      version: 1,
    },
    overrides,
  )
}

export function makeContentPack(overrides?: Partial<ContentPack>): ContentPack {
  return withOverrides<ContentPack>(
    {
      id: toPackId('chess-king-core'),
      formatVersion: CONTENT_PACK_FORMAT_VERSION,
      version: '2.3',
      name: 'Chess King Core',
      kind: 'lessons',
      source: 'builtin',
      description: 'The built-in tutorial course.',
      licence: 'MIT',
      itemCount: 2,
      lessons: [makeLesson()],
      puzzles: [makePuzzle()],
      importedAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    },
    overrides,
  )
}

export function makeRepertoireNode(overrides?: Partial<RepertoireNode>): RepertoireNode {
  return withOverrides<RepertoireNode>(
    {
      id: toRepertoireNodeId('rep-caro-advance-3'),
      parentId: toRepertoireNodeId('rep-caro-root'),
      childIds: [toRepertoireNodeId('rep-caro-advance-3-bf5')],
      color: 'black',
      fen: toFen(CARO_KANN_ADVANCE_FEN),
      positionKey: positionKeyFromFen(CARO_KANN_ADVANCE_FEN),
      san: toSan('e5'),
      uci: toUci('e4e5'),
      ply: 5,
      isYourMove: false,
      isMainLine: true,
      eco: 'B12',
      openingName: 'Caro-Kann Defence',
      variation: 'Advance',
      comment: 'After 3.e5 your move here is …Bf5, out before …e6 locks it in.',
      popularity: 62,
      tags: ['solid', 'pawn chains'],
      createdAt: FIXTURE_NOW,
      updatedAt: FIXTURE_NOW,
    },
    overrides,
  )
}
