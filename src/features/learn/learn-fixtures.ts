import {
  makeContentPack,
  makeLesson,
  makeLessonStep,
  START_FEN,
  toFen,
  toLessonId,
  toLessonStepId,
  toPackId,
  toSan,
  toTrackId,
  type ContentPack,
  type Lesson,
} from '@/domain'

/** Test-only: a small pack whose lessons can be played end to end on a real board. */
export const TEST_PACK_ID = toPackId('test-pack')

export function playableLesson(id: string, title: string, trackId: string): Lesson {
  const step = (suffix: string, overrides: Parameters<typeof makeLessonStep>[0]) =>
    makeLessonStep({
      id: toLessonStepId(`${id}:${suffix}`),
      orientation: 'white',
      fen: START_FEN,
      ...overrides,
    })
  return makeLesson({
    id: toLessonId(id),
    packId: TEST_PACK_ID,
    trackId: toTrackId(trackId),
    unitId: undefined,
    title,
    summary: `${title}, one step at a time.`,
    difficulty: 'beginner',
    estimatedMinutes: 3,
    steps: [
      step('intro', {
        index: 0,
        kind: 'info',
        prompt: `Welcome to ${title}`,
        text: 'First paragraph.\n\nSecond paragraph.',
        expectedMoves: [],
        alternativeMoves: [],
        hints: [],
      }),
      step('e4', {
        index: 1,
        kind: 'move',
        prompt: 'Take the centre',
        text: 'Open with the king’s pawn.',
        expectedMoves: [toSan('e4')],
        alternativeMoves: [toSan('d4')],
        alternativeText: 'd4 is fine too, but this lesson wants e4.',
        hints: ['Which pawn guards the king’s side?'],
        successText: 'That is the idea.',
        failureText: 'That does not fight for the centre.',
        keyIdea: 'Pawns in the centre give your pieces room.',
        focusSquares: [],
        arrows: [],
      }),
      step('done', {
        index: 2,
        kind: 'info',
        fen: toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
        prompt: 'Lesson complete',
        expectedMoves: [],
        alternativeMoves: [],
        hints: [],
      }),
    ],
  })
}

export function testPack(overrides: Partial<ContentPack> = {}): ContentPack {
  const lessons = [
    playableLesson('lesson-centre', 'Take the centre', 'open'),
    playableLesson('lesson-pins', 'Pins', 'tactics'),
    playableLesson('lesson-forks', 'Forks', 'tactics'),
  ]
  return makeContentPack({
    id: TEST_PACK_ID,
    name: 'Test pack',
    source: 'imported',
    lessons,
    puzzles: [],
    itemCount: lessons.length,
    ...overrides,
  })
}
