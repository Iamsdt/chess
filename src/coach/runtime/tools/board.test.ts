import { describe, expect, it } from 'vitest'

import { buildFrames } from '@/coach/sage-board/frames'
import {
  makeEngineLine,
  SageBoardAttachmentSchema,
  toUci,
  type SageBoardAttachment,
} from '@/domain'

import { boardTools } from './board'
import { callTool, createHarness } from './board-test-support'

/** Italian game, White to move after 3...Nf6. */
const ITALIAN = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'

const line = (pv: string[], cp = 0, multipv = 1) =>
  makeEngineLine({ multipv, pv: pv.map(toUci), score: { kind: 'cp', value: cp } })

function boards(emitted: readonly unknown[]): SageBoardAttachment[] {
  return emitted.map((card) => SageBoardAttachmentSchema.parse(card))
}

describe('board tools', () => {
  it('opens a Sage board from a copy of the position on screen', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const out = await callTool(boardTools(env), 'openSageBoard', { title: 'Look here' })
    expect(out).toMatchObject({ boardId: 'board-1', summary: 'board opened · Look here' })
    const [card] = boards(emitted)
    expect(card).toMatchObject({ card: 'idea', fen: ITALIAN, title: 'Look here' })
  })

  it('refuses when there is no position to copy', async () => {
    const { env, emitted } = createHarness()
    expect(await callTool(boardTools(env), 'openSageBoard', {})).toHaveProperty('error')
    expect(emitted).toHaveLength(0)
  })

  it('draws, then clears, marks on the board it opened and re-pins the card each time', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const tools = boardTools(env)
    await callTool(tools, 'openSageBoard', {})
    await callTool(tools, 'showOnBoard', {
      boardId: 'board-1',
      arrows: [{ from: 'c4', to: 'f7' }],
      circles: ['f7'],
      danger: ['e5'],
    })
    await callTool(tools, 'showControlMap', { boardId: 'board-1' })
    await callTool(tools, 'clearBoardMarks', { boardId: 'board-1' })

    const [, drawn, mapped, cleared] = boards(emitted)
    expect(drawn?.steps[0]).toMatchObject({
      arrows: [{ from: 'c4', to: 'f7', kind: 'sage' }],
      focus: ['f7'],
      danger: ['e5'],
    })
    expect(mapped?.steps[0]?.controlMap).toBe(true)
    expect(cleared?.steps[0]).toMatchObject({
      arrows: [],
      focus: [],
      danger: [],
      controlMap: false,
    })
  })

  it('reports the control map counts from the rules', async () => {
    const { env } = createHarness(ITALIAN)
    const tools = boardTools(env)
    await callTool(tools, 'openSageBoard', {})
    const out = await callTool(tools, 'showControlMap', { boardId: 'board-1' })
    expect(out).toMatchObject({ boardId: 'board-1' })
    expect((out as { white: number }).white).toBeGreaterThan(0)
  })

  it('only addresses boards Sage opened in this answer', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const tools = boardTools(env)
    for (const name of ['showOnBoard', 'clearBoardMarks', 'showControlMap', 'handOverMove']) {
      const out = await callTool(tools, name, {
        boardId: 'main',
        prompt: 'p',
        praise: 'p',
        retry: 'r',
      })
      expect(out).toHaveProperty('error')
    }
    expect(emitted).toHaveLength(0)
  })

  it('plays a what-if with the engine reply, white-centred eval and a legal line', async () => {
    const { env, emitted, withEngine } = createHarness(ITALIAN)
    const tools = boardTools(env)
    const out = await withEngine(
      () => callTool(tools, 'showWhatIf', { move: 'Ng5' }) as Promise<Record<string, unknown>>,
      [line(['d7d5', 'e4d5'], -20)],
    )
    expect(out).toMatchObject({
      boardId: 'board-1',
      move: 'Ng5',
      reply: 'd5',
      eval: { cp: 20 },
      summary: 'what-if board · Ng5 d5',
    })
    const [card] = boards(emitted)
    expect(card?.card).toBe('what-if')
    expect(buildFrames(card?.fen ?? '', card?.steps ?? [])).toHaveLength(2)
  })

  it('refuses an illegal what-if move and shows nothing', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const out = await callTool(boardTools(env), 'showWhatIf', { move: 'Qh7' })
    expect(out).toMatchObject({ error: expect.stringContaining('not legal') })
    expect(emitted).toHaveLength(0)
  })

  it('drops an engine reply that is not legal rather than showing it', async () => {
    const { env, emitted, withEngine } = createHarness(ITALIAN)
    const out = await withEngine(
      () => callTool(boardTools(env), 'showWhatIf', { move: 'Ng5' }),
      [line(['a1a8'])],
    )
    expect(out).toHaveProperty('error')
    expect(emitted).toHaveLength(0)
  })

  it('marks the piece the engine reply leaves hanging', async () => {
    const { env, emitted, withEngine } = createHarness(ITALIAN)
    await withEngine(
      () => callTool(boardTools(env), 'showWhatIf', { move: 'Ng5' }),
      [line(['f6e4'], 0)],
    )
    const [card] = boards(emitted)
    expect(card?.steps[1]?.danger).toEqual(['g5'])
    expect(card?.steps[1]?.caption).toContain('the knight on g5 hangs')
  })

  it('reads a threat as if the other side were to move, from the flipped position', async () => {
    const { env, emitted, withEngine } = createHarness(ITALIAN)
    const out = await withEngine(
      () => callTool(boardTools(env), 'showThreat', {}) as Promise<Record<string, unknown>>,
      [line(['f6e4', 'f3e5'], 30)],
    )
    expect(out).toMatchObject({ threat: 'Nxe4', line: ['Nxe4', 'Nxe5'], eval: { cp: -30 } })
    const [card] = boards(emitted)
    expect(card?.card).toBe('threat')
    expect(card?.fen).toContain(' b ')
    expect(card?.steps[0]?.san).toBeUndefined()
    expect(card?.steps[1]).toMatchObject({ san: 'Nxe4', danger: ['e4'] })
    expect(buildFrames(card?.fen ?? '', card?.steps ?? [])).toHaveLength(3)
  })

  it('cannot read a threat while the side to move is in check', async () => {
    const { env, emitted } = createHarness('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1')
    expect(await callTool(boardTools(env), 'showThreat', {})).toMatchObject({
      error: expect.stringContaining('in check'),
    })
    expect(emitted).toHaveLength(0)
  })

  it('steps through a legal line with one caption per move', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const out = await callTool(boardTools(env), 'stepThroughLine', {
      steps: [
        { san: 'Ng5', caption: 'Eyes f7.' },
        { san: 'd5', caption: 'Black hits back.' },
      ],
    })
    expect(out).toMatchObject({ line: ['Ng5', 'd5'] })
    const [card] = boards(emitted)
    expect(card?.card).toBe('line')
    expect(card?.steps.map((step) => step.caption)).toEqual(['Eyes f7.', 'Black hits back.'])
  })

  it('refuses a line with an illegal move and shows nothing', async () => {
    const { env, emitted } = createHarness(ITALIAN)
    const out = await callTool(boardTools(env), 'stepThroughLine', {
      steps: [
        { san: 'Ng5', caption: 'a' },
        { san: 'Qh1', caption: 'b' },
      ],
    })
    expect(out).toMatchObject({ error: expect.stringContaining('Move 2') })
    expect(emitted).toHaveLength(0)
  })

  it('hands the move over with an accept list from the engine, which the model is not told', async () => {
    const { env, emitted, withEngine } = createHarness(ITALIAN)
    const tools = boardTools(env)
    await callTool(tools, 'openSageBoard', {})
    const out = await withEngine(
      () =>
        callTool(tools, 'handOverMove', {
          boardId: 'board-1',
          prompt: 'Your move.',
          praise: 'Good.',
          retry: 'Look again.',
        }),
      [line(['f3g5'], 30, 1), line(['d2d3'], 20, 2), line(['a2a3'], -100, 3)],
    )
    expect(out).toMatchObject({ acceptedMoves: 2, waitingFor: 'White' })
    expect(JSON.stringify(out)).not.toContain('Ng5')
    const last = boards(emitted).at(-1)
    expect(last?.steps.at(-1)?.yourTurn).toMatchObject({ accept: ['Ng5', 'd3'] })
  })
})
