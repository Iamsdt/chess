import { describe, expect, it, vi } from 'vitest'

import type { Decision } from '@/decision'
import { makeCoachContext, makeCoachMessage, type CoachContext } from '@/domain'

import { type CoachDelta, type CoachPort } from '../port'

import { toCoachDecision, withDecision } from './with-decision'

function decision(label: Decision['mode']['label'], prob: number): Decision {
  const rest = (1 - prob) / 6
  const probs: Record<string, number> = {}
  for (const name of [
    'grandmaster',
    'teacher',
    'tutor',
    'puzzle-nudger',
    'planner',
    'open-qa',
    'visualization',
  ]) {
    probs[name] = name === label ? prob : rest
  }
  return {
    modelId: 'minilm-l6-prototype@1',
    latencyMs: 14,
    mode: { label, probs },
    flags: { needs_engine: 0.91, wants_solution: 0.1 },
    input: 'what should I play?',
  }
}

function recordingPort(deltas: CoachDelta[] = [{ kind: 'text', text: 'hello' }]) {
  const seen: { context?: CoachContext } = {}
  const port: CoachPort = {
    send(_messages, context) {
      seen.context = context
      return (async function* (): AsyncGenerator<CoachDelta> {
        await Promise.resolve()
        for (const delta of deltas) yield delta
      })()
    },
  }
  return { port, seen }
}

async function collect(port: CoachPort, context: CoachContext, text = 'what should I play?') {
  const out: CoachDelta[] = []
  const messages = [makeCoachMessage({ role: 'user', text })]
  for await (const delta of port.send(messages, context, {
    signal: new AbortController().signal,
  })) {
    out.push(delta)
  }
  return out
}

const analysis = makeCoachContext({ screen: 'analysis' })

describe('withDecision', () => {
  it('yields the decision delta, then the mode delta, then the inner answer', async () => {
    const { port } = recordingPort([
      { kind: 'mode', mode: 'open-qa' },
      { kind: 'text', text: 'hello' },
    ])
    const engine = { decide: vi.fn(() => Promise.resolve(decision('teacher', 0.87))) }
    const deltas = await collect(
      withDecision(port, engine, { log: () => Promise.resolve(undefined) }),
      analysis,
    )

    expect(deltas.map((d) => d.kind)).toEqual(['decision', 'mode', 'text'])
    expect(deltas[0]).toMatchObject({
      kind: 'decision',
      decision: { modelId: 'minilm-l6-prototype@1', mode: { label: 'teacher' } },
    })
    // The inner port's own mode announcement is dropped: the decision already chose.
    expect(deltas[1]).toEqual({ kind: 'mode', mode: 'teacher' })
  })

  it('asks the engine about the last user message, within the 400 ms budget', async () => {
    const { port } = recordingPort()
    const engine = { decide: vi.fn(() => Promise.resolve(null)) }
    await collect(withDecision(port, engine), analysis, 'where is my knight going?')
    expect(engine.decide).toHaveBeenCalledWith('where is my knight going?', {
      screen: 'analysis',
      timeoutMs: 400,
    })
  })

  it('hands the inner port the context with the decision attached', async () => {
    const { port, seen } = recordingPort()
    const engine = { decide: () => Promise.resolve(decision('grandmaster', 0.9)) }
    await collect(withDecision(port, engine, { log: () => Promise.resolve(undefined) }), analysis)
    expect(seen.context?.decision).toMatchObject({
      mode: { label: 'grandmaster' },
      flags: { needs_engine: 0.91 },
    })
    expect(seen.context?.screen).toBe('analysis')
  })

  it('falls back to the screen default when the model is not confident', async () => {
    const { port } = recordingPort()
    const engine = { decide: () => Promise.resolve(decision('tutor', 0.3)) }
    const deltas = await collect(
      withDecision(port, engine, { log: () => Promise.resolve(undefined) }),
      analysis,
    )
    // Analysis opens in Grandmaster; 0.30 is under the 0.45 bar, so the chip stays honest but the mode doesn't move.
    expect(deltas[1]).toEqual({ kind: 'mode', mode: 'grandmaster' })
    expect(deltas[0]).toMatchObject({ decision: { mode: { label: 'tutor' } } })
  })

  it('the 0.45 boundary is inclusive', async () => {
    const { port } = recordingPort()
    const engine = { decide: () => Promise.resolve(decision('tutor', 0.45)) }
    const deltas = await collect(
      withDecision(port, engine, { log: () => Promise.resolve(undefined) }),
      analysis,
    )
    expect(deltas[1]).toEqual({ kind: 'mode', mode: 'tutor' })
  })

  it('never overrides the live-game modes', async () => {
    const { port } = recordingPort()
    const engine = { decide: () => Promise.resolve(decision('grandmaster', 0.95)) }
    const live = await collect(
      withDecision(port, engine, { log: () => Promise.resolve(undefined) }),
      makeCoachContext({ screen: 'live' }),
    )
    expect(live[1]).toEqual({ kind: 'mode', mode: 'paused' })
    const game = await collect(
      withDecision(port, engine, { log: () => Promise.resolve(undefined) }),
      makeCoachContext({ screen: 'play-game' }),
    )
    expect(game[1]).toEqual({ kind: 'mode', mode: 'companion' })
  })

  it('passes straight through when there is no decision', async () => {
    const { port, seen } = recordingPort([
      { kind: 'mode', mode: 'open-qa' },
      { kind: 'text', text: 'hi' },
    ])
    const log = vi.fn(() => Promise.resolve(undefined))
    const deltas = await collect(
      withDecision(port, { decide: () => Promise.resolve(null) }, { log }),
      analysis,
    )
    expect(deltas.map((d) => d.kind)).toEqual(['mode', 'text'])
    expect(seen.context?.decision).toBeUndefined()
    expect(log).not.toHaveBeenCalled()
  })

  it('logs the decision with its probabilities, and tells the chip which row to correct', async () => {
    const { port } = recordingPort()
    const log = vi.fn(() => Promise.resolve(undefined))
    const engine = { decide: () => Promise.resolve(decision('teacher', 0.87)) }
    const deltas = await collect(
      withDecision(port, engine, { log, newId: () => 'dec_fixed' }),
      analysis,
    )
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dec_fixed',
        text: 'what should I play?',
        screen: 'analysis',
        modelId: 'minilm-l6-prototype@1',
        latencyMs: 14,
        probs: expect.objectContaining({ needs_engine: 0.91 }) as unknown,
      }),
    )
    expect(deltas[0]).toMatchObject({ decision: { logId: 'dec_fixed' } })
  })

  it('does not log when logging is off, and the decision carries no log id', async () => {
    const { port } = recordingPort()
    const log = vi.fn(() => Promise.resolve(undefined))
    const engine = { decide: () => Promise.resolve(decision('teacher', 0.87)) }
    const deltas = await collect(
      withDecision(port, engine, { log, shouldLog: () => false }),
      analysis,
    )
    expect(log).not.toHaveBeenCalled()
    expect(deltas[0]).toMatchObject({ kind: 'decision' })
    expect(deltas[0]).not.toHaveProperty('decision.logId')
  })

  it('a failing log never costs the user their answer', async () => {
    const { port } = recordingPort()
    const engine = { decide: () => Promise.resolve(decision('teacher', 0.87)) }
    const deltas = await collect(
      withDecision(port, engine, {
        log: () => Promise.reject(new Error('quota')),
      }),
      analysis,
    )
    expect(deltas.map((d) => d.kind)).toEqual(['decision', 'mode', 'text'])
    expect(deltas[0]).not.toHaveProperty('decision.logId')
  })
})

describe('toCoachDecision', () => {
  it('keeps the compact shape: model, latency, the chosen mode with its probability, the flags', () => {
    const compact = toCoachDecision(decision('teacher', 0.8), 'id1')
    expect(compact).toMatchObject({
      logId: 'id1',
      modelId: 'minilm-l6-prototype@1',
      latencyMs: 14,
      mode: { label: 'teacher', prob: 0.8 },
      flags: { needs_engine: 0.91, wants_solution: 0.1 },
    })
  })
})
