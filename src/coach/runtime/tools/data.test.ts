import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { createRepositories, type Repositories } from '@/data'
import { createDb, type ChessKingDb } from '@/data/db'
import {
  FIXTURE_NOW,
  makeCoachContext,
  makeGame,
  makeGameMeta,
  makeMistakeEntry,
  makeMoveRecord,
  makeProfile,
  makePuzzle,
  makePuzzleAttempt,
  toAttemptId,
  toFen,
  toGameId,
  toMistakeId,
  toPuzzleId,
  toTimestamp,
  type CoachAttachment,
  type CoachContext,
} from '@/domain'
import { createEngine } from '@/engine'
import { createFakeEngineFleet } from '@/engine/testing/fake-engine'

import { createDataTools, positionSimilarity } from './data'

import type { CoachToolEnv } from './types'
import type { z } from 'zod'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup(context: CoachContext = makeCoachContext()) {
  counter += 1
  db = createDb(`coach-data-tools-${String(counter)}`)
  const repos: Repositories = createRepositories(db)
  const emitted: CoachAttachment[] = []
  const env: CoachToolEnv = {
    context,
    emit: (attachment) => emitted.push(attachment),
    signal: new AbortController().signal,
    engine: createEngine({ spawn: createFakeEngineFleet().factory }),
  }
  const tools = createDataTools(repos)(env)
  const run = (name: string, input: Record<string, unknown> = {}): Promise<unknown> => {
    const tool = tools[name]
    if (tool?.execute === undefined) throw new Error(`no tool ${name}`)
    // The SDK applies the schema's defaults before `execute`; so does this.
    const parsed: unknown = (tool.inputSchema as z.ZodType).parse(input)
    return Promise.resolve(tool.execute(parsed, { toolCallId: name, messages: [], context: {} }))
  }
  return { repos, run, emitted }
}

const AFTER_E4 = toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')
const AFTER_D4 = toFen('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1')

describe('positionSimilarity', () => {
  it('is 1 for the same position and lower for a different pawn skeleton', () => {
    expect(positionSimilarity(AFTER_E4, AFTER_E4)).toBe(1)
    expect(positionSimilarity(AFTER_E4, AFTER_D4)).toBeLessThan(1)
    expect(positionSimilarity(AFTER_E4, AFTER_D4)).toBeGreaterThan(0.8)
  })

  it('treats a bare endgame as unlike the opening', () => {
    const endgame = toFen('8/5k2/8/8/8/8/4K3/8 w - - 0 1')
    expect(positionSimilarity(AFTER_E4, endgame)).toBeLessThan(0.5)
  })
})

describe('getGameContext', () => {
  it('returns the board from context and prefers the game in progress', async () => {
    const { repos, run } = setup()
    await repos.games.save(
      makeGame({
        meta: makeGameMeta({ id: toGameId('done'), startedAt: toTimestamp(FIXTURE_NOW + 5) }),
      }),
    )
    await repos.games.save(
      makeGame({
        meta: makeGameMeta({
          id: toGameId('live'),
          result: '*',
          startedAt: toTimestamp(FIXTURE_NOW),
        }),
      }),
    )
    const out = (await run('getGameContext')) as {
      game: { id: string; outcome: string }
      screen: string
    }
    expect(out.screen).toBe('/play')
    expect(out.game).toMatchObject({ id: 'live', outcome: 'in progress' })
  })

  it('trims a long PGN to the end of the game', async () => {
    const { run } = setup(makeCoachContext({ pgn: `${'x'.repeat(5_000)}END` }))
    const out = (await run('getGameContext')) as { pgn: string }
    expect(out.pgn).toHaveLength(1_500)
    expect(out.pgn.endsWith('END')).toBe(true)
  })
})

describe('getPlayerProfile', () => {
  it('reports ratings and goals and never anything about keys', async () => {
    const { repos, run } = setup()
    await repos.profile.save(makeProfile())
    const out = await run('getPlayerProfile')
    expect(out).toMatchObject({
      puzzleRating: 1482,
      goals: ['stop hanging pieces', 'play the Caro-Kann'],
    })
    expect(JSON.stringify(out)).not.toMatch(/key|passphrase/i)
  })

  it('copes with a user who has not onboarded', async () => {
    const { run } = setup()
    expect(await run('getPlayerProfile')).toMatchObject({
      summary: 'no profile yet',
      streakDays: 0,
    })
  })
})

describe('getWeakThemes', () => {
  it('ranks the weakest theme first with its evidence', async () => {
    const { repos, run } = setup()
    await repos.puzzles.bulkUpsert([
      makePuzzle({ id: toPuzzleId('pf'), theme: 'fork' }),
      makePuzzle({ id: toPuzzleId('pp'), theme: 'pin' }),
    ])
    const attempt = (id: string, puzzle: string, solved: boolean) =>
      makePuzzleAttempt({
        id: toAttemptId(id),
        puzzleId: toPuzzleId(puzzle),
        solved,
        hintUsed: null,
        endedAt: toTimestamp(FIXTURE_NOW),
      })
    await repos.attempts.addMany([
      attempt('a1', 'pf', false),
      attempt('a2', 'pf', false),
      attempt('a3', 'pf', false),
      attempt('a4', 'pp', true),
      attempt('a5', 'pp', true),
    ])
    await repos.mistakes.add(makeMistakeEntry({ id: toMistakeId('m1'), themes: ['fork'] }))
    const out = (await run('getWeakThemes')) as {
      themes: { theme: string; attempts: number; mistakesInBank: number }[]
    }
    expect(out.themes.map((t) => t.theme)).toEqual(['fork', 'pin'])
    expect(out.themes[0]).toMatchObject({ attempts: 3, mistakesInBank: 1 })
  })

  it('says so when there is no history', async () => {
    const { run } = setup()
    expect(await run('getWeakThemes')).toMatchObject({
      themes: [],
      summary: 'no puzzle history yet',
    })
  })
})

describe('findMyGames', () => {
  it('filters by opening and outcome and caps the list', async () => {
    const { repos, run } = setup()
    for (let index = 0; index < 12; index += 1) {
      await repos.games.save(
        makeGame({
          meta: makeGameMeta({
            id: toGameId(`g${String(index)}`),
            startedAt: toTimestamp(FIXTURE_NOW + index),
            result: index === 0 ? '0-1' : '1-0',
          }),
        }),
      )
    }
    const wins = (await run('findMyGames', { opening: 'italian', outcome: 'win' })) as {
      games: unknown[]
    }
    expect(wins.games).toHaveLength(10)
    const losses = (await run('findMyGames', { outcome: 'loss' })) as { games: { id: string }[] }
    expect(losses.games.map((g) => g.id)).toEqual(['g0'])
    const none = (await run('findMyGames', { opening: 'sicilian' })) as { games: unknown[] }
    expect(none.games).toEqual([])
  })
})

describe('findSimilarPositions', () => {
  it('finds the nearest position per game and ignores unlike ones', async () => {
    const { repos, run } = setup(
      makeCoachContext({ position: { fen: AFTER_E4, orientation: 'white' } }),
    )
    const id = toGameId('g1')
    await repos.games.save(
      makeGame({
        meta: makeGameMeta({ id }),
        moves: [
          makeMoveRecord({ gameId: id, ply: 0, fenAfter: AFTER_D4 }),
          makeMoveRecord({ gameId: id, ply: 1, fenAfter: AFTER_E4 }),
          makeMoveRecord({ gameId: id, ply: 2, fenAfter: toFen('8/5k2/8/8/8/8/4K3/8 w - - 0 1') }),
        ],
      }),
    )
    const out = (await run('findSimilarPositions')) as {
      positions: { ply: number; score: number }[]
    }
    expect(out.positions).toHaveLength(1)
    expect(out.positions[0]).toMatchObject({ ply: 1, score: 1 })
  })

  it('fails clearly with no board and no FEN', async () => {
    const { run } = setup(makeCoachContext({ position: undefined }))
    expect(await run('findSimilarPositions')).toMatchObject({
      error: expect.stringContaining('No position'),
    })
  })
})

describe('getMistakeHistory', () => {
  it('lists recent mistakes newest first with a due flag', async () => {
    const { repos, run } = setup()
    await repos.mistakes.add(
      makeMistakeEntry({
        id: toMistakeId('m1'),
        createdAt: toTimestamp(Date.now() - 2 * 86_400_000),
        srsCardId: undefined,
        themes: ['pin'],
      }),
    )
    const out = (await run('getMistakeHistory', { theme: 'pin' })) as {
      mistakes: { daysAgo: number; best: string; dueForReview: boolean | undefined }[]
    }
    expect(out.mistakes).toHaveLength(1)
    expect(out.mistakes[0]).toMatchObject({ daysAgo: 2, best: 'Nbd2', dueForReview: undefined })
  })
})
