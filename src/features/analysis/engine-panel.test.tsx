import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { makeEngineLine, START_FEN, toFen, toUci } from '@/domain'

import { DEFAULT_ANALYSIS_SETTINGS, type AnalysisSettings } from './analysis-state'
import { EnginePanel } from './engine-panel'

import type { EngineAnalysis } from './use-engine-analysis'

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {
      /* nothing is laid out in jsdom */
    }
    unobserve(): void {
      /* nothing is laid out in jsdom */
    }
    disconnect(): void {
      /* nothing is laid out in jsdom */
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub
})

const SEARCHING: EngineAnalysis = {
  status: 'searching',
  depth: 22,
  error: null,
  lines: [
    makeEngineLine({
      multipv: 1,
      score: { kind: 'cp', value: 22 },
      pv: [toUci('e2e4'), toUci('e7e5'), toUci('g1f3')],
    }),
    makeEngineLine({
      multipv: 2,
      score: { kind: 'cp', value: 18 },
      pv: [toUci('d2d4'), toUci('d7d5')],
    }),
  ],
}

/** A PV from a position where Black is to move — the case that gets numbering wrong. */
const BLACK_TO_MOVE: EngineAnalysis = {
  status: 'searching',
  depth: 18,
  error: null,
  lines: [
    makeEngineLine({
      multipv: 1,
      score: { kind: 'cp', value: 15 },
      pv: [toUci('e7e5'), toUci('g1f3')],
    }),
  ],
}

function renderPanel(
  analysis: EngineAnalysis,
  settings: Partial<AnalysisSettings> = {},
  available = true,
  lineStart = { fullmoveNumber: 1, whiteToMove: true },
  fen = START_FEN,
) {
  const onPlayMove = vi.fn()
  const onSettingsChange = vi.fn()
  render(
    <EnginePanel
      analysis={analysis}
      settings={{ ...DEFAULT_ANALYSIS_SETTINGS, ...settings }}
      available={available}
      fen={fen}
      sideToMove="white"
      lineStart={lineStart}
      onSettingsChange={onSettingsChange}
      onPlayMove={onPlayMove}
    />,
  )
  return { onPlayMove, onSettingsChange, user: userEvent.setup() }
}

describe('<EnginePanel>', () => {
  it('shows each line in SAN, with the numbers a player reads', () => {
    renderPanel(SEARCHING)
    expect(screen.getByText('1.e4 e5 2.Nf3')).toBeVisible()
    expect(screen.getByText('1.d4 d5')).toBeVisible()
    expect(screen.getAllByText('+0.22')[0]).toBeVisible()
  })

  it('plays the first move of the line that was clicked', async () => {
    const { user, onPlayMove } = renderPanel(SEARCHING)
    await user.click(screen.getByText('1.d4 d5'))
    expect(onPlayMove).toHaveBeenCalledWith(toUci('d2d4'))
  })

  it('numbers a line from the position the engine was given, not from move one', () => {
    renderPanel(
      BLACK_TO_MOVE,
      {},
      true,
      { fullmoveNumber: 1, whiteToMove: false },
      toFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
    )
    expect(screen.getByText('1…e5 2.Nf3')).toBeVisible()
  })

  it('says it is thinking before the first snapshot lands', () => {
    renderPanel({ status: 'searching', depth: 0, error: null, lines: [] })
    expect(screen.getByRole('status')).toHaveTextContent('Thinking about this position')
  })

  it('shows an engine failure as a message, not an empty panel', () => {
    renderPanel({ status: 'error', depth: 0, error: 'The worker died', lines: [] })
    expect(screen.getByRole('status')).toHaveTextContent('The worker died')
  })

  it('offers nothing to switch on where the engine cannot run', () => {
    renderPanel(SEARCHING, {}, false)
    expect(screen.getByRole('switch', { name: 'Engine' })).toBeDisabled()
    expect(screen.getByText(/cannot run the engine/)).toBeVisible()
  })

  it('leaves the lines out while the engine is switched off', () => {
    renderPanel(SEARCHING, { engineEnabled: false })
    expect(screen.queryByText('1.e4 e5 2.Nf3')).not.toBeInTheDocument()
    expect(screen.getByText(/The engine is off/)).toBeVisible()
  })

  it('turns the engine off through the switch', async () => {
    const { user, onSettingsChange } = renderPanel(SEARCHING)
    await user.click(screen.getByRole('switch', { name: 'Engine' }))
    expect(onSettingsChange).toHaveBeenCalledWith({ engineEnabled: false })
  })
})
