import { describe, expect, it } from 'vitest'

import {
  BLIND_CHECKS_CARD,
  BLIND_ROUTE_CARD,
  COUNT_EXCHANGE_CARD,
  FLASH_RECALL_CARD,
  FOLLOW_LINE_CARD,
  HOLD_EXCHANGE_CARD,
  IS_IT_CHECK_CARD,
  PICK_PICTURE_CARD,
  VISUALIZATION_FIXTURES,
  WHATS_HANGING_CARD,
} from '@/coach/fixtures/visualization-fixtures'
import { toSquare } from '@/domain'

import { checkAnswer, parseTyped, prepare, revealText } from './questions'

const need = (card: Parameters<typeof prepare>[0]) => {
  const prepared = prepare(card)
  if (prepared === null) throw new Error(`${card.title} did not prepare`)
  return prepared
}

describe('fixtures', () => {
  it('every line is legal and every generator returns an answer', () => {
    for (const card of VISUALIZATION_FIXTURES) {
      const prepared = prepare(card)
      expect(prepared, `${card.exercise}: ${card.title}`).not.toBeNull()
      expect(prepared?.question.prompt.length).toBeGreaterThan(0)
      expect(card.level).toBeGreaterThanOrEqual(1)
      expect(card.level).toBeLessThanOrEqual(6)
    }
  })

  it('covers all eight exercises', () => {
    expect(new Set(VISUALIZATION_FIXTURES.map((card) => card.exercise)).size).toBe(8)
  })
})

describe('answer keys', () => {
  it('follows the bishop from f1 to a4 through castling and retreats', () => {
    const prepared = need(FOLLOW_LINE_CARD)
    expect(checkAnswer(prepared.key, { squares: [toSquare('a4')] })).toBe(true)
    expect(checkAnswer(prepared.key, { squares: [toSquare('b5')] })).toBe(false)
  })

  it('finds the one hanging bishop', () => {
    const prepared = need(WHATS_HANGING_CARD)
    expect(revealText(prepared.key)).toBe('a4')
  })

  it('knows Bxc6 is legal without check', () => {
    expect(need(IS_IT_CHECK_CARD).key).toMatchObject({ kind: 'choice', id: 'quiet' })
  })

  it('asks where the white queen was', () => {
    const prepared = need(FLASH_RECALL_CARD)
    expect(prepared.question.prompt).toContain('white queen')
    expect(revealText(prepared.key)).toBe('h5')
  })

  it('lists every checking move', () => {
    expect(need(BLIND_CHECKS_CARD).key).toMatchObject({ sans: ['Bxf7', 'Qxe5', 'Qxf7'] })
  })

  it('accepts any shortest knight route and rejects a longer one', () => {
    const prepared = need(BLIND_ROUTE_CARD)
    if (prepared.key.kind !== 'route') throw new Error('expected a route')
    expect(checkAnswer(prepared.key, { squares: prepared.key.example })).toBe(true)
    expect(
      checkAnswer(prepared.key, {
        squares: [toSquare('a3'), toSquare('b1'), ...prepared.key.example],
      }),
    ).toBe(false)
  })

  it('counts who wins the trades on e5', () => {
    expect(need(COUNT_EXCHANGE_CARD).key).toMatchObject({ id: 'white' })
    expect(need(HOLD_EXCHANGE_CARD).key).toMatchObject({ id: 'black' })
  })

  it('shows the real board among three different ones', () => {
    const prepared = need(PICK_PICTURE_CARD)
    const pictures = prepared.question.pictures ?? []
    expect(new Set(pictures.map((picture) => picture.fen.split(' ')[0])).size).toBe(3)
    const real = pictures.find((picture) => picture.fen === prepared.finalFen)
    expect(real).toBeDefined()
    expect(checkAnswer(prepared.key, { choice: real?.id ?? '' })).toBe(true)
  })

  it('keeps the answer out of the question', () => {
    for (const card of [FOLLOW_LINE_CARD, WHATS_HANGING_CARD, FLASH_RECALL_CARD]) {
      const prepared = need(card)
      const shown = JSON.stringify(prepared.question)
      expect(shown).not.toContain(revealText(prepared.key))
    }
  })
})

describe('typed answers', () => {
  it('reads squares and rejects nonsense', () => {
    expect(parseTyped('squares', 'e4, d5')).toEqual({ squares: ['e4', 'd5'] })
    expect(parseTyped('square', 'zz')).toBeNull()
    expect(parseTyped('moves', 'none')).toEqual({ moves: [] })
  })
})
