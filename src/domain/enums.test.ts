import { describe, expect, it } from 'vitest'

import GLOBALS_CSS from '../styles/globals.css?raw'

import {
  COACH_TONES,
  DAILY_GOAL_MINUTES,
  DailyGoalMinutesSchema,
  HINT_LEVELS,
  MISTAKE_QUALITIES,
  MOVE_QUALITIES,
  MoveQualitySchema,
  PUZZLE_BANDS,
  SRS_STATES,
  oppositeColor,
} from './enums'

describe('MoveQuality', () => {
  /**
   * The design system colours a glyph by `--q-<quality>`. If this list and the
   * tokens in `src/styles/globals.css` ever disagree, badges lose their colour
   * silently — so the stylesheet is parsed rather than mirrored by hand.
   */
  it('matches the --q-* design tokens exactly, and in order', () => {
    // Declarations only: `--color-q-*` are the @theme bridge, and `--q-inaccuracy-ink`
    // is a text colour rather than a verdict, so neither matches `--q-<name>: #`.
    const declared = [...GLOBALS_CSS.matchAll(/^\s*--q-([a-z]+):\s*#/gm)].map(
      ([, quality]) => quality,
    )

    expect(declared).toEqual([...MOVE_QUALITIES])
  })

  it.each(MOVE_QUALITIES)('accepts %s', (quality) => {
    expect(MoveQualitySchema.parse(quality)).toBe(quality)
  })

  it.each(['brilliant!', 'ok', '', 'Blunder'])('rejects %s', (quality) => {
    expect(MoveQualitySchema.safeParse(quality).success).toBe(false)
  })

  it('treats every mistake quality as a move quality', () => {
    for (const quality of MISTAKE_QUALITIES) {
      expect(MOVE_QUALITIES).toContain(quality)
    }
  })
})

describe('curriculum order', () => {
  it('runs from the weakest piece to the strongest, as the bands do', () => {
    expect(PUZZLE_BANDS).toEqual(['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'])
  })

  it('keeps the hint ladder in cost order', () => {
    expect(HINT_LEVELS).toEqual(['nudge', 'square', 'move'])
  })

  it('ends the SRS pipeline at mastered', () => {
    expect(SRS_STATES.at(-1)).toBe('mastered')
  })
})

describe('DailyGoalMinutes', () => {
  it.each(DAILY_GOAL_MINUTES)('accepts %d', (minutes) => {
    expect(DailyGoalMinutesSchema.parse(minutes)).toBe(minutes)
  })

  it.each([0, 10, 20, 60])('rejects %d', (minutes) => {
    expect(DailyGoalMinutesSchema.safeParse(minutes).success).toBe(false)
  })
})

describe('oppositeColor', () => {
  it('flips both ways', () => {
    expect(oppositeColor('white')).toBe('black')
    expect(oppositeColor('black')).toBe('white')
  })
})

describe('CoachTone', () => {
  it('offers the three tones the settings screen shows', () => {
    expect(COACH_TONES).toEqual(['friendly', 'blunt', 'socratic'])
  })
})
