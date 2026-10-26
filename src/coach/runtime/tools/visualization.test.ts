import { describe, expect, it } from 'vitest'

import { prepare, revealText } from '@/coach/visualization/questions'
import {
  domainError,
  err,
  ok,
  SageBoardAttachmentSchema,
  VISUALIZATION_EXERCISES,
  VisualizationAttachmentSchema,
  type VisualizationAttachment,
} from '@/domain'
import { emptyVisionRecords } from '@/features/drills/drill-records'

import { boardTools } from './board'
import { callTool, createHarness } from './board-test-support'
import { createVisualizationTools, visualizationTools } from './visualization'

const ITALIAN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

type Facts = Record<string, unknown>

async function start(
  tools: ReturnType<typeof visualizationTools>,
  exercise: string,
  level = 3,
): Promise<Facts> {
  return (await callTool(tools, 'startVisualizationExercise', { exercise, level })) as Facts
}

function lastExercise(emitted: readonly unknown[]): VisualizationAttachment {
  return VisualizationAttachmentSchema.parse(emitted.at(-1))
}

describe('startVisualizationExercise', () => {
  it.each(VISUALIZATION_EXERCISES)(
    'issues a %s card and tells the model the question only',
    async (exercise) => {
      const { env, emitted } = createHarness()
      const tools = visualizationTools(env)
      const out = await start(tools, exercise)
      expect(out).toMatchObject({ exerciseId: 'exercise-1', exercise, level: 3 })
      expect(out).not.toHaveProperty('answer')
      expect(out).not.toHaveProperty('key')

      const card = lastExercise(emitted)
      const key = prepare(card)?.key
      expect(key).toBeDefined()
      if (key !== undefined && key.kind !== 'squares') {
        expect(JSON.stringify(out)).not.toContain(revealText(key))
      }
    },
  )

  it('moves to a fresh line the second time it is asked for the same kind', async () => {
    const { env, emitted } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'follow-line')
    await start(tools, 'follow-line')
    const [first, second] = emitted.map((card) => VisualizationAttachmentSchema.parse(card))
    expect(`${first?.fen}${first?.moves.join()}${first?.target?.square}`).not.toBe(
      `${second?.fen}${second?.moves.join()}${second?.target?.square}`,
    )
  })
})

describe('checkVisualizationAnswer', () => {
  it('marks a right answer and then reveals it', async () => {
    const { env, emitted } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'blind-checks')
    const key = prepare(lastExercise(emitted))?.key
    if (key?.kind !== 'moves') throw new Error('expected a moves key')
    const out = await callTool(tools, 'checkVisualizationAnswer', {
      exerciseId: 'exercise-1',
      answer: key.sans.join(' '),
    })
    expect(out).toMatchObject({ correct: true, answer: revealText(key) })
  })

  it('names the first slip when a followed piece is misplaced', async () => {
    const { env, emitted } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'follow-line')
    const card = lastExercise(emitted)
    const start0 = card.target?.square
    expect(start0).toBeDefined()
    const out = (await callTool(tools, 'checkVisualizationAnswer', {
      exerciseId: 'exercise-1',
      answer: start0 ?? '',
    })) as Facts
    expect(out).toMatchObject({ correct: false })
    expect(out.slip).toMatchObject({ explanation: expect.stringContaining('went from') })
    expect(out.answer).toEqual(expect.any(String))
  })

  it('does not mark an answer it cannot read, and keeps the key hidden', async () => {
    const { env } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'follow-line')
    const out = await callTool(tools, 'checkVisualizationAnswer', {
      exerciseId: 'exercise-1',
      answer: 'somewhere near the middle',
    })
    expect(out).toHaveProperty('error')
    expect(out).not.toHaveProperty('answer')
    expect(await callTool(tools, 'peekPosition', { exerciseId: 'exercise-1' })).toHaveProperty(
      'error',
    )
  })

  it('reads a choice by its label', async () => {
    const { env, emitted } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'is-it-check')
    const prepared = prepare(lastExercise(emitted))
    if (prepared?.key.kind !== 'choice') throw new Error('expected a choice key')
    const out = await callTool(tools, 'checkVisualizationAnswer', {
      exerciseId: 'exercise-1',
      answer: prepared.key.label,
    })
    expect(out).toMatchObject({ correct: true })
  })

  it('refuses an exercise that was never started', async () => {
    const { env } = createHarness()
    expect(
      await callTool(visualizationTools(env), 'checkVisualizationAnswer', {
        exerciseId: 'exercise-9',
        answer: 'e4',
      }),
    ).toMatchObject({ error: expect.stringContaining('startVisualizationExercise') })
  })
})

describe('peekPosition', () => {
  it('refuses to peek before the user has answered, then shows a flash board after', async () => {
    const { env, emitted } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'follow-line')
    const before = emitted.length
    expect(await callTool(tools, 'peekPosition', { exerciseId: 'exercise-1' })).toMatchObject({
      error: expect.stringContaining('not answered'),
    })
    expect(emitted).toHaveLength(before)

    const square = lastExercise(emitted).target?.square ?? ''
    await callTool(tools, 'checkVisualizationAnswer', { exerciseId: 'exercise-1', answer: square })
    const out = await callTool(tools, 'peekPosition', { exerciseId: 'exercise-1', ply: 0 })
    expect(out).toMatchObject({ ply: 0 })
    expect(SageBoardAttachmentSchema.parse(emitted.at(-1))).toMatchObject({ view: 'flash' })
  })
})

describe('narrateLine', () => {
  it('reads a legal line on a frozen board', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const out = (await callTool(visualizationTools(env), 'narrateLine', {
      moves: ['Ng5', 'd5'],
      level: 'full',
    })) as Facts
    expect(out.narration).toEqual(['knight from f3 to g5', 'pawn from d7 to d5'])
    expect(SageBoardAttachmentSchema.parse(emitted.at(-1))).toMatchObject({
      card: 'line',
      view: 'frozen',
    })
  })

  it('drops an illegal line and shows nothing', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const out = await callTool(visualizationTools(env), 'narrateLine', { moves: ['Ng5', 'Qh1'] })
    expect(out).toHaveProperty('error')
    expect(emitted).toHaveLength(0)
  })

  it('reads the line of a started exercise without adding a card', async () => {
    const { env, emitted } = createHarness()
    const tools = visualizationTools(env)
    await start(tools, 'follow-line')
    const before = emitted.length
    const out = (await callTool(tools, 'narrateLine', { exerciseId: 'exercise-1' })) as Facts
    expect(out.narration).toEqual(expect.any(Array))
    expect(emitted).toHaveLength(before)
  })
})

describe('setBoardView', () => {
  it('changes the view of a board opened earlier in the same answer', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    await callTool(boardTools(env), 'openSageBoard', {})
    const out = await callTool(visualizationTools(env), 'setBoardView', {
      boardId: 'board-1',
      view: 'blindfold',
    })
    expect(out).toMatchObject({ view: 'blindfold' })
    expect(SageBoardAttachmentSchema.parse(emitted.at(-1)).view).toBe('blindfold')
  })

  it('refuses a board it never opened', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    expect(
      await callTool(visualizationTools(env), 'setBoardView', {
        boardId: 'board-4',
        view: 'ghost',
      }),
    ).toHaveProperty('error')
    expect(emitted).toHaveLength(0)
  })
})

describe('getVisualizationProfile', () => {
  it('says plainly when nothing is stored yet', async () => {
    const { env } = createHarness()
    const tools = createVisualizationTools({ readVision: async () => ok(emptyVisionRecords()) })(
      env,
    )
    const out = (await callTool(tools, 'getVisualizationProfile', {})) as Facts
    expect(out.summary).toBe('no vision history yet · ladder defaults')
    expect(out.note).toEqual(expect.stringContaining('not stored yet'))
    expect(out.ladderStart).toMatchObject({ plies: 4 })
  })

  it('still answers when the records cannot be read', async () => {
    const { env } = createHarness()
    const tools = createVisualizationTools({
      readVision: async () => err(domainError('io', 'closed')),
    })(env)
    expect(await callTool(tools, 'getVisualizationProfile', {})).toMatchObject({
      visionDrills: null,
    })
  })
})
