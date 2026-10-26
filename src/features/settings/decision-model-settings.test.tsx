import 'fake-indexeddb/auto'

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { decisionsRepo } from '@/data'
import type { Decision, DecisionEngine, DecisionStatus } from '@/decision'
import type { DecisionSettings } from '@/domain'

import { DecisionModelSettings } from './decision-model-settings'

const READY: DecisionStatus = {
  kind: 'ready',
  modelId: 'minilm-l6-prototype@1',
  source: 'builtin',
  encoder: 'Xenova/all-MiniLM-L6-v2',
  backend: 'wasm',
  loadMs: 2400,
  metrics: undefined,
  unavailable: [],
}

function fakeEngine(initial: DecisionStatus = { kind: 'idle' }) {
  let status = initial
  const listeners = new Set<() => void>()
  const engine = {
    getStatus: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    enable: vi.fn(() => Promise.resolve(undefined)),
    disable: vi.fn(),
    decide: vi.fn((text: string): Promise<Decision> =>
      Promise.resolve({
        modelId: 'minilm-l6-prototype@1',
        latencyMs: 7.5,
        mode: {
          label: 'puzzle-nudger',
          probs: { 'puzzle-nudger': 0.8, grandmaster: 0.1, teacher: 0.1 },
        },
        flags: { wants_solution: 0.93, needs_engine: 0.2 },
        input: text,
      }),
    ),
  } satisfies DecisionEngine
  return {
    engine,
    set: (next: DecisionStatus) => {
      status = next
      act(() => {
        for (const listener of listeners) listener()
      })
    },
  }
}

const OFF: DecisionSettings = { enabled: false, logDecisions: true }
const ON: DecisionSettings = { enabled: true, logDecisions: true }

beforeAll(() => {
  globalThis.ResizeObserver = class implements ResizeObserver {
    observe(): void {
      // Nothing is ever laid out in jsdom.
    }
    unobserve(): void {
      // See above.
    }
    disconnect(): void {
      // See above.
    }
  }
})

beforeEach(async () => {
  await decisionsRepo.clear()
})

function renderSection(
  engine: DecisionEngine,
  decision: DecisionSettings = OFF,
  onChange: (patch: Partial<DecisionSettings>) => void = () => undefined,
) {
  return render(<DecisionModelSettings decision={decision} onChange={onChange} engine={engine} />)
}

describe('DecisionModelSettings', () => {
  it('off: says so, states the download size, and lets you turn it on', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine()
    const onChange = vi.fn()
    renderSection(engine, OFF, onChange)

    expect(screen.getByRole('heading', { name: 'Decision model' })).toBeInTheDocument()
    expect(screen.getByText(/about 23 MB/)).toBeInTheDocument()
    expect(screen.getByLabelText('Try it')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Export training data/ })).toBeEnabled()

    await user.click(screen.getByRole('switch', { name: 'Run the decision model on this device' }))
    expect(onChange).toHaveBeenCalledWith({ enabled: true })
    expect(engine.enable).toHaveBeenCalled()
  })

  it('turning it off frees the engine', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine(READY)
    const onChange = vi.fn()
    renderSection(engine, ON, onChange)
    await user.click(screen.getByRole('switch', { name: 'Run the decision model on this device' }))
    expect(onChange).toHaveBeenCalledWith({ enabled: false })
    expect(engine.disable).toHaveBeenCalled()
  })

  it('downloading: shows a progress bar with the percentage and size', () => {
    const { engine } = fakeEngine({ kind: 'downloading', progress: 0.42 })
    renderSection(engine, ON)
    expect(
      screen.getByRole('progressbar', { name: 'Decision model download progress' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Downloading 42% of about 23 MB')).toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('error: shows the message and a retry', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine({
      kind: 'error',
      message: 'The manifest could not be fetched (HTTP 404)',
    })
    renderSection(engine, ON)
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 404')
    engine.enable.mockClear()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(engine.enable).toHaveBeenCalled()
  })

  it('ready: shows the model, the backend and the load time', () => {
    const { engine } = fakeEngine(READY)
    renderSection(engine, ON)
    const facts = document.querySelector('[data-slot="decision-facts"]')
    expect(facts).toHaveTextContent('minilm-l6-prototype@1')
    expect(facts).toHaveTextContent('Xenova/all-MiniLM-L6-v2')
    expect(facts).toHaveTextContent('CPU (WebAssembly)')
    expect(facts).toHaveTextContent('2.4 s')
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('the playground shows a bar for every answered question and the latency', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine(READY)
    renderSection(engine, ON)
    await user.type(screen.getByLabelText('Try it'), 'just tell me the move')

    expect(await screen.findByText('Decided in 7.5 ms on this device.')).toBeInTheDocument()
    expect(engine.decide).toHaveBeenLastCalledWith('just tell me the move', expect.anything())
    expect(screen.getByRole('meter', { name: 'Puzzle nudger' })).toHaveAttribute(
      'aria-valuenow',
      '80',
    )
    expect(screen.getByRole('meter', { name: 'Wants the answer' })).toHaveAttribute(
      'aria-valuenow',
      '93',
    )
  })

  it('shows what the model could not answer', () => {
    const { engine } = fakeEngine({ ...READY, unavailable: ['about_history'] })
    renderSection(engine, ON)
    expect(screen.getByText('about_history')).toBeInTheDocument()
  })

  it('a custom manifest: validates the URL, loads it, and shows its metrics', async () => {
    const user = userEvent.setup()
    const { engine, set } = fakeEngine(READY)
    const onChange = vi.fn()
    renderSection(engine, ON, onChange)

    await user.click(screen.getByRole('radio', { name: /Custom manifest URL/ }))
    const load = screen.getByRole('button', { name: 'Load' })
    expect(load).toBeDisabled()
    await user.type(screen.getByLabelText('Manifest URL'), 'not a url')
    expect(load).toBeDisabled()

    await user.clear(screen.getByLabelText('Manifest URL'))
    await user.type(screen.getByLabelText('Manifest URL'), 'https://example.com/m.json')
    await user.click(load)
    expect(onChange).toHaveBeenCalledWith({
      manifestUrl: 'https://example.com/m.json',
      enabled: true,
    })
    expect(engine.enable).toHaveBeenCalledWith({ manifestUrl: 'https://example.com/m.json' })

    set({
      ...READY,
      modelId: 'tuned@2',
      source: 'custom',
      metrics: { accuracy: 0.931, n_eval: 400 },
    })
    const metrics = document.querySelector('[data-slot="decision-metrics"]')
    expect(metrics).toHaveTextContent('accuracy')
    expect(metrics).toHaveTextContent('0.931')
    expect(metrics).toHaveTextContent('400')
  })

  it('switching back to built-in clears the manifest URL', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine(READY)
    const onChange = vi.fn()
    renderSection(engine, { ...ON, manifestUrl: 'https://example.com/m.json' }, onChange)
    await user.click(screen.getByRole('radio', { name: /Built-in/ }))
    expect(onChange).toHaveBeenCalledWith({ manifestUrl: undefined, enabled: true })
    expect(engine.enable).toHaveBeenLastCalledWith()
  })

  it('the log toggle saves, and the counts follow the database', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine(READY)
    const onChange = vi.fn()
    await decisionsRepo.add({
      id: 'a',
      text: 'q',
      screen: null,
      modelId: 'm',
      latencyMs: 1,
      probs: { mode: { tutor: 1 } },
    })
    await decisionsRepo.correct('a', { mode: 'planner' })
    renderSection(engine, ON, onChange)
    await waitFor(() => {
      expect(screen.getByText(/logged/).closest('p')).toHaveTextContent('1 logged · 1 corrected')
    })
    await user.click(screen.getByRole('switch', { name: 'Keep a local log of decisions' }))
    expect(onChange).toHaveBeenCalledWith({ logDecisions: false })
  })

  it('exports seed rows and logged rows as JSONL', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine(READY)
    await decisionsRepo.add({
      id: 'a',
      text: 'tell me the move',
      screen: 'puzzle',
      modelId: 'm',
      latencyMs: 1,
      probs: { mode: { 'puzzle-nudger': 0.9 }, wants_solution: 0.9 },
    })
    const saved: { name: string; text: string }[] = []
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((text) => saved.push({ name: 'download', text }))
      return 'blob:x'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    renderSection(engine, ON)
    await user.click(screen.getByRole('button', { name: /Export training data/ }))

    await waitFor(() => {
      expect(screen.getByText(/Exported \d+ rows \(\d+ seed, 1 logged\)\./)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(saved).toHaveLength(1)
    })
    const lines = saved[0]!.text
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as { source: string; text: string })
    expect(lines[0]?.source).toBe('seed')
    expect(lines.at(-1)).toMatchObject({ source: 'predicted', text: 'tell me the move' })
  })

  it('clear log asks first, then empties the log', async () => {
    const user = userEvent.setup()
    const { engine } = fakeEngine(READY)
    await decisionsRepo.add({
      id: 'a',
      text: 'q',
      screen: null,
      modelId: 'm',
      latencyMs: 1,
      probs: { mode: { tutor: 1 } },
    })
    renderSection(engine, ON)
    const clear = await screen.findByRole('button', { name: 'Clear log' })
    await waitFor(() => {
      expect(clear).toBeEnabled()
    })
    await user.click(clear)
    const dialog = await screen.findByRole('dialog', { name: 'Clear the decision log?' })
    expect(await decisionsRepo.count()).toEqual({ total: 1, corrected: 0 })
    await user.click(within(dialog).getByRole('button', { name: 'Clear log' }))
    await waitFor(async () => {
      expect(await decisionsRepo.count()).toEqual({ total: 0, corrected: 0 })
    })
  })

  it('has no accessibility violations when ready', async () => {
    const { engine } = fakeEngine(READY)
    const { container } = renderSection(engine, ON)
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((violation) => violation.id)).toEqual([])
  })
})
