import { describe, expect, it } from 'vitest'

import { readActionHref } from '@/coach/actions/action-href'
import { makeCoachContext, type ActionAttachment, type CoachAttachment } from '@/domain'
import { createEngine } from '@/engine'
import { createFakeEngineFleet } from '@/engine/testing/fake-engine'

import { actionTools } from './actions'

import type { CoachToolEnv } from './types'
import type { z } from 'zod'

function setup(overrides: Parameters<typeof makeCoachContext>[0] = {}) {
  const emitted: CoachAttachment[] = []
  const env: CoachToolEnv = {
    context: makeCoachContext(overrides),
    emit: (attachment) => emitted.push(attachment),
    signal: new AbortController().signal,
    engine: createEngine({ spawn: createFakeEngineFleet().factory }),
  }
  const tools = actionTools(env)
  const run = (name: string, input: Record<string, unknown> = {}): Promise<unknown> => {
    const tool = tools[name]
    if (tool?.execute === undefined) throw new Error(`no tool ${name}`)
    // The SDK applies the schema's defaults before `execute`; so does this.
    const parsed: unknown = (tool.inputSchema as z.ZodType).parse(input)
    return Promise.resolve(tool.execute(parsed, { toolCallId: name, messages: [], context: {} }))
  }
  const card = (): ActionAttachment => {
    const found = emitted.find((a): a is ActionAttachment => a.kind === 'action')
    if (found === undefined) throw new Error('no card emitted')
    return found
  }
  return { run, emitted, card }
}

describe('action tools propose and never act', () => {
  it('queuePuzzles pins a card carrying the theme and size, and says it is waiting', async () => {
    const { run, card, emitted } = setup()
    const out = await run('queuePuzzles', { theme: 'mateIn2', count: 8 })
    expect(emitted).toHaveLength(1)
    expect(card()).toMatchObject({ action: 'queue-puzzles', title: 'Mate in 2 puzzles' })
    expect(readActionHref(card().href)).toMatchObject({ path: '/puzzles/solve' })
    expect(readActionHref(card().href)?.params.get('goal')).toBe('8')
    expect(out).toMatchObject({
      status: 'proposed',
      note: expect.stringContaining('waiting for the user'),
    })
  })

  it('openLesson is unavailable and tells the model so', async () => {
    const { run, card } = setup()
    const out = await run('openLesson', { topic: 'forks' })
    expect(card().unavailable).toMatch(/coming soon/i)
    expect(out).toMatchObject({
      status: 'unavailable',
      note: expect.stringContaining('coming soon'),
    })
  })

  it('addToMistakeBank uses the position on screen', async () => {
    const { run, card } = setup()
    await run('addToMistakeBank')
    const target = readActionHref(card().href)
    expect(target?.path).toBe('/mistakes')
    expect(target?.params.get('fen')).toBe(makeCoachContext().position?.fen)
    expect(target?.params.get('color')).toBe('white')
  })

  it('addToMistakeBank refuses without a board', async () => {
    const { run, emitted } = setup({ position: undefined })
    expect(await run('addToMistakeBank')).toMatchObject({
      error: expect.stringContaining('No position'),
    })
    expect(emitted).toEqual([])
  })

  it('startDrill and startVisualizationSet point at their drill screens', async () => {
    const drill = setup()
    await drill.run('startDrill', { kind: 'endgame', focus: 'king and pawn' })
    expect(readActionHref(drill.card().href)?.path).toBe('/drills/endgames')
    expect(drill.card().items).toEqual(['king and pawn'])

    const vision = setup()
    await vision.run('startVisualizationSet')
    expect(readActionHref(vision.card().href)?.path).toBe('/drills/vision')
    expect(vision.card().action).toBe('start-drill')
  })

  it('setTodaysPlan lists the steps and rejects duplicates', async () => {
    const { run, card } = setup()
    await run('setTodaysPlan', { steps: ['5 fork puzzles', 'Review 3 mistakes'] })
    expect(card()).toMatchObject({
      action: 'set-plan',
      items: ['5 fork puzzles', 'Review 3 mistakes'],
    })

    const dup = setup()
    expect(await dup.run('setTodaysPlan', { steps: ['A', 'A'] })).toMatchObject({
      error: expect.any(String),
    })
    expect(dup.emitted).toEqual([])
  })
})
