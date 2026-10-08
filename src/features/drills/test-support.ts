import { kvRepo } from '@/data'
import { domainError, err, makeEngineEval, ok, toUci } from '@/domain'

import { createDrillRecordsPort, type DrillRecordsPort } from './drill-records'
import { defaultDrillPorts, type DrillPorts } from './ports'

import type { DrillEnginePort } from './endgame-session'

/**
 * Fakes shared by the drill tests: a scripted engine, an in-memory records store and a
 * ports bundle. Imported by tests only, so it never reaches the app bundle.
 */

export interface ScriptedEngine extends DrillEnginePort {
  /** Every FEN the engine was asked about, in order. */
  readonly asked: readonly string[]
}

/** An engine that answers from a list, then reports it is out of ideas. */
export function scriptedEngine(moves: readonly string[]): ScriptedEngine {
  const asked: string[] = []
  let next = 0
  return {
    asked,
    bestMove: (fen) => {
      asked.push(fen)
      const move = moves[next]
      next += 1
      if (move === undefined) {
        return Promise.resolve(err(domainError('conflict', 'No scripted move', { where: 'test' })))
      }
      return Promise.resolve(
        ok({
          move: toUci(move),
          ponder: null,
          line: null,
          eval: makeEngineEval(),
        }),
      )
    },
  }
}

/** An engine that never answers, to hold a drill in its "thinking" state. */
export const silentEngine: DrillEnginePort = {
  bestMove: () => new Promise(() => undefined),
}

/**
 * Records backed by the real `kv` repository (over fake-indexeddb), or by one whose
 * every call rejects, to reach the error states.
 */
export function realRecords(): DrillRecordsPort {
  return createDrillRecordsPort(kvRepo)
}

export function brokenRecords(): DrillRecordsPort {
  const closed = (): Promise<never> => Promise.reject(new Error('The database is closed'))
  return createDrillRecordsPort({ ...kvRepo, getOr: closed, update: closed })
}

export function testPorts(overrides: Partial<DrillPorts> = {}): DrillPorts {
  return { ...defaultDrillPorts, records: realRecords(), ...overrides }
}

const BOARD_PX = 800

/**
 * jsdom has no pointer model; these are the smallest shims that let `<Board>` take a
 * click. Call once from `beforeAll` in any test that moves a piece.
 */
export function installBoardShims(): void {
  class PointerEventStub extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  }
  globalThis.PointerEvent = PointerEventStub as unknown as typeof PointerEvent
  Element.prototype.setPointerCapture = function setPointerCapture(): void {
    // Capture is meaningless without a real pointer.
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(): void {
    // See above.
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(): boolean {
    return false
  }
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return new DOMRect(0, 0, BOARD_PX, BOARD_PX)
  }
}
