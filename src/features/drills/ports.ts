import { createContext, use } from 'react'

import { engine } from '@/engine'

import { defaultDrillRecords, type DrillRecordsPort } from './drill-records'

import type { DrillEnginePort } from './endgame-session'

/**
 * The three things a drill cannot own: the engine, the storage and randomness.
 *
 * Reached through a port with a real default, mirroring the play screens, so a
 * component test swaps a scripted engine or a failing store by wrapping the tree and
 * never by mocking a module.
 */
export interface DrillPorts {
  readonly engine: DrillEnginePort
  readonly records: DrillRecordsPort
  /** Injected so "the third target square" is reproducible in a test. */
  readonly random: () => number
}

export const defaultDrillPorts: DrillPorts = {
  engine: { bestMove: (fen, options) => engine.bestMove(fen, options) },
  records: defaultDrillRecords,
  random: () => Math.random(),
}

export const DrillPortsContext = createContext<DrillPorts>(defaultDrillPorts)

export function useDrillPorts(): DrillPorts {
  return use(DrillPortsContext)
}
