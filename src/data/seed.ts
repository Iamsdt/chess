import {
  FIXTURE_NOW,
  FIXTURE_TODAY,
  makeGameMeta,
  makeJob,
  makeLesson,
  makeMistakeEntry,
  makeMoveRecord,
  makeProfile,
  makePuzzle,
  makePuzzleAttempt,
  makeRepertoireNode,
  makeSettings,
  makeSrsCard,
  makeStreakState,
  ok,
  toAttemptId,
  toGameId,
  toJobId,
  toLessonId,
  toMistakeId,
  toPackId,
  toPuzzleId,
  toRepertoireNodeId,
  toSessionId,
  toSrsCardId,
  toTimestamp,
  type ContentPack,
  type GameMeta,
  type Job,
  type MistakeEntry,
  type MoveRecord,
  type Puzzle,
  type PuzzleAttempt,
  type RepertoireNode,
  type Result,
  type SrsCard,
} from '@/domain'

import { db as appDb } from './db'
import { KV_KEYS } from './kv-keys'
import { createRepositories } from './repositories'

import type { ChessKingDb } from './db'
import type { LessonProgress, PracticeSession } from './schema'

/**
 * A believable database, built only from S03's fixture factories.
 *
 * Why it lives in `src/data` rather than in a script: the backup round-trip
 * test, the migration harness and `/dev` all want the same rows, and a seed that
 * only a CLI could produce would drift from the one the tests assert on. It is a
 * plain exported function — nothing calls it on app start.
 */

export interface SeedOptions {
  games?: number | undefined
  puzzles?: number | undefined
  attempts?: number | undefined
  srsCards?: number | undefined
  mistakes?: number | undefined
}

export interface SeedSummary {
  games: number
  moves: number
  puzzles: number
  attempts: number
  srsCards: number
  mistakes: number
  packs: number
  lessonsProgress: number
  repertoire: number
  sessions: number
  jobs: number
}

const DAY_MS = 86_400_000

const PUZZLE_BAND_CYCLE = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const

function seedGames(count: number): { games: GameMeta[]; moves: MoveRecord[] } {
  const games: GameMeta[] = []
  const moves: MoveRecord[] = []
  for (let index = 0; index < count; index += 1) {
    const id = toGameId(`game-seed-${String(index)}`)
    const startedAt = toTimestamp(FIXTURE_NOW - index * DAY_MS)
    games.push(
      makeGameMeta({
        id,
        startedAt,
        createdAt: startedAt,
        updatedAt: startedAt,
        endedAt: toTimestamp(startedAt + 1_200_000),
        result: index % 3 === 0 ? '1-0' : index % 3 === 1 ? '0-1' : '1/2-1/2',
        reviewState: index % 2 === 0 ? 'reviewed' : 'not-reviewed',
        source: index % 4 === 0 ? 'lichess' : 'sparring',
        ...(index % 4 === 0 ? { externalId: `lichess-${String(index)}` } : {}),
      }),
    )
    for (let ply = 0; ply < 4; ply += 1) {
      moves.push(
        makeMoveRecord({
          gameId: id,
          ply,
          moveNumber: Math.floor(ply / 2) + 1,
          color: ply % 2 === 0 ? 'white' : 'black',
          quality: ply === 3 ? 'blunder' : 'best',
        }),
      )
    }
  }
  return { games, moves }
}

function seedPuzzles(count: number): Puzzle[] {
  return Array.from({ length: count }, (_unused, index) => {
    const band = PUZZLE_BAND_CYCLE[index % PUZZLE_BAND_CYCLE.length] ?? 'pawn'
    return makePuzzle({
      id: toPuzzleId(`puzzle-seed-${String(index)}`),
      band,
      subLevel: (index % 10) + 1,
      rating: 900 + index * 17,
      theme: index % 2 === 0 ? 'fork' : 'pin',
      difficulty: index % 3 === 0 ? 'beginner' : index % 3 === 1 ? 'intermediate' : 'advanced',
      active: index % 11 !== 0,
    })
  })
}

function seedAttempts(count: number): PuzzleAttempt[] {
  return Array.from({ length: count }, (_unused, index) =>
    makePuzzleAttempt({
      id: toAttemptId(`attempt-seed-${String(index)}`),
      puzzleId: toPuzzleId(`puzzle-seed-${String(index % 12)}`),
      sessionId: toSessionId('session-seed-0'),
      startedAt: toTimestamp(FIXTURE_NOW - index * 60_000),
      endedAt: toTimestamp(FIXTURE_NOW - index * 60_000 + 24_000),
      solved: index % 4 !== 0,
      firstTry: index % 5 === 0,
      rated: index % 7 !== 0,
    }),
  )
}

function seedSrsCards(count: number): SrsCard[] {
  return Array.from({ length: count }, (_unused, index) =>
    makeSrsCard({
      id: toSrsCardId(`card-seed-${String(index)}`),
      subject:
        index % 2 === 0
          ? { kind: 'mistake', mistakeId: toMistakeId(`mistake-seed-${String(index)}`) }
          : { kind: 'puzzle', puzzleId: toPuzzleId(`puzzle-seed-${String(index)}`) },
      state: index % 3 === 0 ? 'review' : index % 3 === 1 ? 'learning' : 'new',
      due: toTimestamp(FIXTURE_NOW - DAY_MS + index * 3_600_000),
    }),
  )
}

function seedMistakes(count: number): MistakeEntry[] {
  return Array.from({ length: count }, (_unused, index) =>
    makeMistakeEntry({
      id: toMistakeId(`mistake-seed-${String(index)}`),
      gameId: toGameId(`game-seed-${String(index % 3)}`),
      createdAt: toTimestamp(FIXTURE_NOW - index * DAY_MS),
      updatedAt: toTimestamp(FIXTURE_NOW - index * DAY_MS),
      quality: index % 2 === 0 ? 'blunder' : 'mistake',
      themes: index % 2 === 0 ? ['hanging-piece'] : ['fork', 'back-rank'],
      ...(index % 2 === 0 ? { srsCardId: toSrsCardId(`card-seed-${String(index)}`) } : {}),
    }),
  )
}

function seedPack(): ContentPack {
  const packId = toPackId('pack-seed-basics')
  return {
    id: packId,
    formatVersion: 1,
    version: '1.0',
    name: 'Seeded basics',
    kind: 'lessons',
    source: 'builtin',
    licence: 'CC0-1.0',
    itemCount: 1,
    lessons: [makeLesson({ id: toLessonId('lesson-seed-0'), packId })],
    puzzles: [],
    importedAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
  }
}

function seedLessonProgress(): LessonProgress {
  return {
    lessonId: toLessonId('lesson-seed-0'),
    packId: toPackId('pack-seed-basics'),
    status: 'in-progress',
    lessonVersion: 1,
    currentStepIndex: 1,
    completedStepIds: [],
    hintsUsed: 1,
    wrongMoves: 0,
    timeSpentMs: 90_000,
    startedAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    completedAt: null,
  }
}

function seedSessions(): PracticeSession[] {
  return [
    {
      id: toSessionId('session-seed-0'),
      kind: 'adaptive-puzzles',
      state: 'completed',
      day: FIXTURE_TODAY,
      startedAt: FIXTURE_NOW,
      updatedAt: toTimestamp(FIXTURE_NOW + 600_000),
      endedAt: toTimestamp(FIXTURE_NOW + 600_000),
      durationMs: 600_000,
      itemsAttempted: 12,
      itemsCorrect: 9,
      resumeState: {},
    },
    {
      id: toSessionId('session-seed-1'),
      kind: 'mistake-review',
      state: 'active',
      day: FIXTURE_TODAY,
      startedAt: toTimestamp(FIXTURE_NOW + 900_000),
      updatedAt: toTimestamp(FIXTURE_NOW + 900_000),
      endedAt: null,
      durationMs: 0,
      itemsAttempted: 2,
      itemsCorrect: 1,
      resumeState: { queue: ['card-seed-0'] },
    },
  ]
}

function seedRepertoire(): RepertoireNode[] {
  const rootId = toRepertoireNodeId('node-seed-root')
  const childId = toRepertoireNodeId('node-seed-child')
  const root = makeRepertoireNode({ id: rootId, parentId: null, ply: 0, childIds: [childId] })
  const child = makeRepertoireNode({ id: childId, parentId: rootId, ply: 1, childIds: [] })
  return [root, child]
}

function seedJobs(): Job[] {
  return [
    makeJob({ id: toJobId('job-seed-0'), state: 'queued', startedAt: null, lockOwner: null }),
    makeJob({
      id: toJobId('job-seed-1'),
      type: 'rebuild-stats',
      state: 'succeeded',
      progress: 100,
      dedupeKey: 'rebuild-stats',
      finishedAt: FIXTURE_NOW,
    }),
  ]
}

/** Fills a database with fixture data. Safe to run twice: every id is stable. */
export async function seedDatabase(
  target: ChessKingDb = appDb,
  options: SeedOptions = {},
): Promise<Result<SeedSummary>> {
  const repositories = createRepositories(target)
  const { games, moves } = seedGames(options.games ?? 6)
  const puzzles = seedPuzzles(options.puzzles ?? 24)
  const attempts = seedAttempts(options.attempts ?? 18)
  const srsCards = seedSrsCards(options.srsCards ?? 10)
  const mistakes = seedMistakes(options.mistakes ?? 8)
  const sessions = seedSessions()
  const repertoire = seedRepertoire()
  const jobs = seedJobs()

  const steps: Result<unknown>[] = [
    await repositories.profile.save(makeProfile()),
    await repositories.settings.save(makeSettings()),
  ]
  for (const game of games) steps.push(await repositories.games.saveMeta(game))
  steps.push(await repositories.moves.putMany(moves))
  steps.push(await repositories.puzzles.bulkUpsert(puzzles))
  steps.push(await repositories.attempts.addMany(attempts))
  steps.push(await repositories.srsCards.putMany(srsCards))
  steps.push(await repositories.mistakes.addMany(mistakes))
  steps.push(await repositories.packs.install(seedPack()))
  steps.push(await repositories.lessonsProgress.put(seedLessonProgress()))
  steps.push(await repositories.repertoire.putMany(repertoire))
  for (const session of sessions) steps.push(await repositories.sessions.start(session))
  for (const job of jobs) steps.push(await repositories.jobs.add(job))
  steps.push(await repositories.kv.set(KV_KEYS.streak, makeStreakState()))
  steps.push(await repositories.kv.set(KV_KEYS.seededAt, FIXTURE_NOW))

  for (const step of steps) {
    if (!step.ok) return step
  }

  return ok({
    games: games.length,
    moves: moves.length,
    puzzles: puzzles.length,
    attempts: attempts.length,
    srsCards: srsCards.length,
    mistakes: mistakes.length,
    packs: 1,
    lessonsProgress: 1,
    repertoire: repertoire.length,
    sessions: sessions.length,
    jobs: jobs.length,
  })
}
