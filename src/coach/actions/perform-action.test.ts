import { describe, expect, it, vi } from 'vitest'

import { domainError, err, ok, START_FEN, type ActionAttachment } from '@/domain'

import { actionHref } from './action-href'
import { performAction, type ActionPorts } from './perform-action'

function ports(overrides: Partial<ActionPorts> = {}): ActionPorts {
  return {
    navigate: vi.fn(),
    startThemePuzzles: vi.fn(() => Promise.resolve(ok(undefined))),
    bankPosition: vi.fn(() => Promise.resolve(ok({ added: true }))),
    savePlan: vi.fn(() => Promise.resolve(ok(undefined))),
    ...overrides,
  }
}

const card = (patch: Partial<ActionAttachment>): ActionAttachment => ({
  kind: 'action',
  action: 'queue-puzzles',
  title: 'Card',
  items: [],
  ...patch,
})

describe('performAction', () => {
  it('queue-puzzles starts a themed session, then opens the solver', async () => {
    const p = ports()
    const result = await performAction(
      card({ href: actionHref('/puzzles/solve', { theme: 'fork', goal: 6 }) }),
      p,
    )
    expect(result.ok).toBe(true)
    expect(p.startThemePuzzles).toHaveBeenCalledWith('fork', 6)
    expect(p.navigate).toHaveBeenCalledWith('/puzzles/solve')
  })

  it('queue-puzzles without a theme or size falls back to ten on any theme', async () => {
    const p = ports()
    await performAction(card({}), p)
    expect(p.startThemePuzzles).toHaveBeenCalledWith(undefined, 10)
  })

  it('does not navigate when the session could not start', async () => {
    const p = ports({
      startThemePuzzles: vi.fn(() => Promise.resolve(err(domainError('io', 'Disk full')))),
    })
    const result = await performAction(card({}), p)
    expect(result.ok).toBe(false)
    expect(p.navigate).not.toHaveBeenCalled()
  })

  it('add-to-mistake-bank banks the position from the href and stays put', async () => {
    const p = ports()
    const result = await performAction(
      card({
        action: 'add-to-mistake-bank',
        href: actionHref('/mistakes', { fen: START_FEN, color: 'black' }),
      }),
      p,
    )
    expect(result).toEqual(ok({}))
    expect(p.bankPosition).toHaveBeenCalledWith({ fen: START_FEN, color: 'black' })
    expect(p.navigate).not.toHaveBeenCalled()
  })

  it('add-to-mistake-bank reports a position that was already saved', async () => {
    const p = ports({ bankPosition: vi.fn(() => Promise.resolve(ok({ added: false }))) })
    const result = await performAction(
      card({ action: 'add-to-mistake-bank', href: actionHref('/mistakes', { fen: START_FEN }) }),
      p,
    )
    expect(result).toEqual(ok({ message: 'Already in the Mistake Bank' }))
  })

  it('add-to-mistake-bank rejects a card with no usable position', async () => {
    const p = ports()
    const result = await performAction(card({ action: 'add-to-mistake-bank' }), p)
    expect(result.ok).toBe(false)
    expect(p.bankPosition).not.toHaveBeenCalled()
  })

  it('start-drill opens only a drill screen', async () => {
    const p = ports()
    await performAction(card({ action: 'start-drill', href: actionHref('/drills/vision') }), p)
    expect(p.navigate).toHaveBeenCalledWith('/drills/vision')

    const elsewhere = ports()
    const refused = await performAction(
      card({ action: 'start-drill', href: actionHref('/mistakes') }),
      elsewhere,
    )
    expect(refused.ok).toBe(false)
    expect(elsewhere.navigate).not.toHaveBeenCalled()
  })

  it('set-plan saves the items and goes to Today', async () => {
    const p = ports()
    await performAction(card({ action: 'set-plan', items: ['A', 'B'] }), p)
    expect(p.savePlan).toHaveBeenCalledWith(['A', 'B'])
    expect(p.navigate).toHaveBeenCalledWith('/')
  })

  it('open-lesson fails with the card’s own reason', async () => {
    const result = await performAction(
      card({ action: 'open-lesson', unavailable: 'Lessons are coming soon' }),
      ports(),
    )
    expect(result.ok ? null : result.error.message).toBe('Lessons are coming soon')
  })
})
