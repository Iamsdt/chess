import { describe, expect, it, vi } from 'vitest'

import { BUILTIN_MANIFEST, MANIFEST_FORMAT } from './contract'
import { createDecisionEngine, parseManifest, type DecisionEngine } from './engine'

import type { DecisionClient } from './client'
import type { WorkerDecision } from './decision.worker'

function fakeClient(overrides: Partial<DecisionClient> = {}) {
  const decideSpy = vi.fn((_text: string): Promise<WorkerDecision> =>
    Promise.resolve({
      modelId: 'minilm-l6-prototype@1',
      latencyMs: 4.2,
      probs: { mode: { grandmaster: 0.8, tutor: 0.2 }, needs_engine: 0.9 },
    }),
  )
  const client = {
    disposed: false,
    decideSpy,
    load: (_manifest: unknown, onProgress: (fraction: number) => void) => {
      onProgress(0.5)
      return Promise.resolve({ backend: 'wasm' as const, dim: 384, loadMs: 1200, unavailable: [] })
    },
    embed: () => Promise.resolve([[1, 0]]),
    decide: decideSpy,
    dispose: () => {
      client.disposed = true
    },
    ...overrides,
  }
  return client
}

function make(
  client = fakeClient(),
  extra: { fetchManifest?: (url: string) => Promise<unknown> } = {},
) {
  const engine = createDecisionEngine({ createClient: () => Promise.resolve(client), ...extra })
  return { engine, client }
}

async function ready(engine: DecisionEngine): Promise<void> {
  await engine.enable()
}

describe('status', () => {
  it('starts idle, reports download progress, then ready with the model facts', async () => {
    const { engine } = make()
    const seen: string[] = []
    engine.subscribe(() => {
      const status = engine.getStatus()
      seen.push(
        status.kind === 'downloading' ? `downloading:${String(status.progress)}` : status.kind,
      )
    })
    expect(engine.getStatus()).toEqual({ kind: 'idle' })
    await ready(engine)
    expect(seen).toEqual(['downloading:0', 'downloading:0.5', 'ready'])
    expect(engine.getStatus()).toMatchObject({
      kind: 'ready',
      modelId: BUILTIN_MANIFEST.id,
      source: 'builtin',
      backend: 'wasm',
      loadMs: 1200,
    })
  })

  it('a load that throws becomes an error status, not a rejection', async () => {
    const { engine, client } = make(
      fakeClient({
        load: vi.fn(() => Promise.reject(new Error('network down'))),
      }),
    )
    await expect(engine.enable()).resolves.toBeUndefined()
    expect(engine.getStatus()).toEqual({ kind: 'error', message: 'network down' })
    expect(client.disposed).toBe(true)
    expect(await engine.decide('hello')).toBeNull()
  })

  it('enable is idempotent while loading and once ready', async () => {
    const client = fakeClient()
    const create = vi.fn(() => Promise.resolve(client))
    const engine = createDecisionEngine({ createClient: create })
    await Promise.all([engine.enable(), engine.enable()])
    await engine.enable()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('disable frees the worker and goes idle', async () => {
    const { engine, client } = make()
    await ready(engine)
    engine.disable()
    expect(client.disposed).toBe(true)
    expect(engine.getStatus()).toEqual({ kind: 'idle' })
    expect(await engine.decide('hello')).toBeNull()
  })

  it('a custom manifest is fetched, validated and loaded; a new source replaces the old', async () => {
    const manifest = {
      format: MANIFEST_FORMAT,
      id: 'tuned@2',
      encoder: { model: 'me/tuned' },
      metrics: { accuracy: 0.93 },
    }
    const fetchManifest = vi.fn(() => Promise.resolve(manifest))
    const { engine } = make(fakeClient(), { fetchManifest })
    await engine.enable({ manifestUrl: 'https://example.com/manifest.json' })
    expect(fetchManifest).toHaveBeenCalledWith('https://example.com/manifest.json')
    expect(engine.getStatus()).toMatchObject({
      kind: 'ready',
      modelId: 'tuned@2',
      source: 'custom',
      encoder: 'me/tuned',
      metrics: { accuracy: 0.93 },
    })
    await engine.enable()
    expect(engine.getStatus()).toMatchObject({ kind: 'ready', source: 'builtin' })
  })

  it('an invalid manifest is reported in plain words', async () => {
    const { engine } = make(fakeClient(), {
      fetchManifest: () => Promise.resolve({ format: 'nope' }),
    })
    await engine.enable({ manifestUrl: 'https://example.com/m.json' })
    const status = engine.getStatus()
    expect(status.kind).toBe('error')
    expect(status.kind === 'error' && status.message).toMatch(/not a valid decision-model manifest/)
  })

  it('a fetch failure is an error status', async () => {
    const { engine } = make(fakeClient(), {
      fetchManifest: () =>
        Promise.reject(new Error('The manifest could not be fetched (HTTP 404)')),
    })
    await engine.enable({ manifestUrl: 'https://example.com/m.json' })
    expect(engine.getStatus()).toEqual({
      kind: 'error',
      message: 'The manifest could not be fetched (HTTP 404)',
    })
  })
})

describe('decide', () => {
  it('returns null before the model is ready', async () => {
    const { engine } = make()
    expect(await engine.decide('what should I play?')).toBeNull()
  })

  it('returns a decision with the mode, flags, latency and the trimmed input', async () => {
    const { engine, client } = make()
    await ready(engine)
    const decision = await engine.decide('  what should I play?  ')
    expect(client.decideSpy).toHaveBeenCalledWith('what should I play?')
    expect(decision).toMatchObject({
      modelId: 'minilm-l6-prototype@1',
      latencyMs: 4.2,
      input: 'what should I play?',
      mode: { label: 'grandmaster' },
      flags: { needs_engine: 0.9 },
    })
  })

  it('returns null for empty input without asking the worker', async () => {
    const { engine, client } = make()
    await ready(engine)
    expect(await engine.decide('   ')).toBeNull()
    expect(client.decideSpy).not.toHaveBeenCalled()
  })

  it('gives up after the time budget instead of blocking Sage', async () => {
    vi.useFakeTimers()
    try {
      const { engine } = make(
        fakeClient({ decide: () => new Promise<WorkerDecision>(() => undefined) }),
      )
      await ready(engine)
      const pending = engine.decide('slow', { timeoutMs: 400 })
      await vi.advanceTimersByTimeAsync(401)
      expect(await pending).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns null rather than throwing when the worker fails', async () => {
    const { engine } = make(
      fakeClient({
        decide: () => Promise.reject(new Error('wasm trap')),
      }),
    )
    await ready(engine)
    expect(await engine.decide('hello')).toBeNull()
  })
})

describe('parseManifest', () => {
  it('names the field that is wrong', () => {
    expect(() =>
      parseManifest({
        format: MANIFEST_FORMAT,
        id: 'x',
        encoder: { model: 'm' },
        questions: [
          { key: 'off_topic', kind: 'binary', head: { type: 'prototype', temperature: -1 } },
        ],
      }),
    ).toThrow(/questions/)
  })
})
