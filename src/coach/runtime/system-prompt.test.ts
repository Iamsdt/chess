import { describe, expect, it } from 'vitest'

import { makeCoachContext, makeEngineLine, toFen, toPuzzleId, toUci } from '@/domain'

import { buildSystemPrompt, estimateTokens } from './system-prompt'

const BLACK_TO_MOVE = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 b - - 3 7'

describe('buildSystemPrompt', () => {
  it('open Q&A: identity, hard limits, mode, tone and a compact context', () => {
    const prompt = buildSystemPrompt(makeCoachContext({ screen: 'settings', tone: 'friendly' }))
    expect(prompt).toContain('You are Sage')
    expect(prompt).toContain('Never invent an evaluation')
    expect(prompt).toContain('Never claim to move pieces on the learner')
    expect(prompt).toContain('Reply in the language the learner writes in')
    expect(prompt).toContain('Mode: Open Q&A')
    expect(prompt).toContain('Tone: friendly')
    expect(prompt).toContain('Position (FEN): r1bq1rk1/')
    expect(prompt).toContain('Side to move: White')
    expect(prompt).toContain('Puzzle rating 1482, play rating 1180')
    expect(prompt).toContain('Weakest themes: fork, back-rank')
    expect(prompt).toContain("1. depth 20, +0.34 (White's view): b1d2 a7a6 d2f1")
    expect(prompt).not.toContain('Spoiler guard is ON')
  })

  it('puzzle nudger with the guard on: hints only and the puzzle is named', () => {
    const prompt = buildSystemPrompt(
      makeCoachContext({
        screen: 'puzzle',
        tone: 'socratic',
        spoilerGuard: true,
        activePuzzle: { id: toPuzzleId('p1'), theme: 'fork', rating: 1500 },
      }),
    )
    expect(prompt).toContain('Mode: Puzzle nudger')
    expect(prompt).toContain('Tone: Socratic')
    expect(prompt).toContain('Spoiler guard is ON')
    expect(prompt).toContain('theme: fork, rating 1500')
  })

  it('does not apply the guard when it is off or no puzzle is active', () => {
    const base = { screen: 'puzzle' } as const
    expect(buildSystemPrompt(makeCoachContext({ ...base, spoilerGuard: false }))).not.toContain(
      'Spoiler guard is ON',
    )
    expect(buildSystemPrompt(makeCoachContext({ ...base, spoilerGuard: true }))).not.toContain(
      'Spoiler guard is ON',
    )
  })

  it('leaves engine lines out unless allowed, and says what to do without them', () => {
    const prompt = buildSystemPrompt(makeCoachContext({ allowEngineLines: false }))
    expect(prompt).not.toContain('Engine lines (the only source')
    expect(prompt).toContain('If there are no engine lines')
  })

  it("shows engine scores from White's side even when Black is to move", () => {
    const prompt = buildSystemPrompt(
      makeCoachContext({
        position: { fen: toFen(BLACK_TO_MOVE), orientation: 'black' },
        engineLines: [makeEngineLine({ score: { kind: 'cp', value: 50 }, pv: [toUci('a7a6')] })],
      }),
    )
    expect(prompt).toContain('Side to move: Black')
    expect(prompt).toContain("-0.50 (White's view)")
  })

  it('trims the least important context first to fit the token budget', () => {
    const full = buildSystemPrompt(makeCoachContext({ tokenBudget: 100_000 }))
    expect(full).toContain('Recent games:')

    const tight = makeCoachContext({ tokenBudget: Math.ceil(estimateTokens(full) * 0.97) })
    const trimmed = buildSystemPrompt(tight)
    expect(estimateTokens(trimmed)).toBeLessThanOrEqual(tight.tokenBudget)
    expect(trimmed).not.toContain('Recent games:')
    expect(trimmed).toContain('Position (FEN)')
    expect(trimmed).toContain('Never invent an evaluation')
  })

  it('never drops the fixed part, even for a tiny budget', () => {
    const prompt = buildSystemPrompt(makeCoachContext({ tokenBudget: 1 }))
    expect(prompt).toContain('You are Sage')
    expect(prompt).not.toContain('Position (FEN)')
  })
})

describe('buildSystemPrompt · routing from the decision model', () => {
  const decision = (
    flags: Record<string, number>,
    prob = 0.87,
    label = 'grandmaster' as const,
  ) => ({
    modelId: 'minilm-l6-prototype@1',
    latencyMs: 12,
    mode: { label, prob },
    flags,
  })
  const puzzle = {
    screen: 'puzzle',
    spoilerGuard: true,
    activePuzzle: { id: toPuzzleId('p1'), theme: 'fork', rating: 1500 },
  } as const

  it('adds nothing when no decision ran', () => {
    expect(buildSystemPrompt(makeCoachContext(puzzle))).not.toContain(
      'Routing (from the local decision model)',
    )
  })

  it('names the chosen mode and answers in it', () => {
    const prompt = buildSystemPrompt(makeCoachContext({ screen: 'puzzle', decision: decision({}) }))
    expect(prompt).toContain(
      'Routing (from the local decision model): answer in Grandmaster mode (87% sure',
    )
    expect(prompt).toContain('Mode: Grandmaster')
    expect(prompt).not.toContain('Mode: Puzzle nudger')
  })

  it('keeps the screen mode when the model was unsure', () => {
    const prompt = buildSystemPrompt(
      makeCoachContext({ screen: 'puzzle', decision: decision({}, 0.3) }),
    )
    expect(prompt).toContain('Mode: Puzzle nudger')
    expect(prompt).toContain('answer in Puzzle nudger mode')
  })

  it('wants_solution with the guard on and a puzzle: hints only, said explicitly', () => {
    const prompt = buildSystemPrompt(
      makeCoachContext({ ...puzzle, decision: decision({ wants_solution: 0.8 }) }),
    )
    expect(prompt).toContain('Give hints only, and say plainly that you are giving a hint')
  })

  it('wants_solution does nothing without the guard or without a puzzle', () => {
    const off = buildSystemPrompt(
      makeCoachContext({
        ...puzzle,
        spoilerGuard: false,
        decision: decision({ wants_solution: 0.9 }),
      }),
    )
    expect(off).not.toContain('Give hints only')
    const noPuzzle = buildSystemPrompt(
      makeCoachContext({
        screen: 'analysis',
        spoilerGuard: true,
        decision: decision({ wants_solution: 0.9 }),
      }),
    )
    expect(noPuzzle).not.toContain('Give hints only')
  })

  it('needs_engine with no engine lines: say so and do not invent an evaluation', () => {
    const prompt = buildSystemPrompt(
      makeCoachContext({ allowEngineLines: false, decision: decision({ needs_engine: 0.9 }) }),
    )
    expect(prompt).toContain('needs engine analysis and you have none')
    expect(prompt).toContain('do not invent evaluations')
  })

  it('needs_engine is silent when engine lines are present', () => {
    const prompt = buildSystemPrompt(
      makeCoachContext({ decision: decision({ needs_engine: 0.9 }) }),
    )
    expect(prompt).not.toContain('needs engine analysis and you have none')
  })

  it('off_topic at 0.6 steers back to chess, but not at 0.55', () => {
    const on = buildSystemPrompt(makeCoachContext({ decision: decision({ off_topic: 0.6 }) }))
    expect(on).toContain('steer back to chess')
    const below = buildSystemPrompt(makeCoachContext({ decision: decision({ off_topic: 0.55 }) }))
    expect(below).not.toContain('steer back to chess')
  })

  it('deep_answer under 0.3 asks for a short reply', () => {
    const short = buildSystemPrompt(makeCoachContext({ decision: decision({ deep_answer: 0.1 }) }))
    expect(short).toContain('keep it to a sentence or two')
    const long = buildSystemPrompt(makeCoachContext({ decision: decision({ deep_answer: 0.5 }) }))
    expect(long).not.toContain('keep it to a sentence or two')
  })
})
