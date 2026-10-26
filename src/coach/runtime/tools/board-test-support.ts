import { CoachContextSchema, type CoachAttachment, type EngineLine } from '@/domain'
import { createEngine } from '@/engine'
import { createFakeEngineFleet, type FakeEngineFleet } from '@/engine/testing/fake-engine'

import type { CoachToolEnv } from './types'
import type { ToolSet } from 'ai'

/**
 * Test scaffolding for the board and visualization tools: an env with a collecting `emit`,
 * a scripted engine, and a way to call a tool's `execute` the way the SDK does.
 */

const flush = async (): Promise<void> => {
  for (let index = 0; index < 16; index += 1) await Promise.resolve()
}

export interface ToolHarness {
  readonly env: CoachToolEnv
  readonly emitted: CoachAttachment[]
  readonly fleet: FakeEngineFleet
  /** Run `call`, and when it reaches the engine answer that search with `lines`. */
  withEngine: <T>(call: () => Promise<T>, lines: readonly EngineLine[]) => Promise<T>
}

export function createHarness(fen?: string): ToolHarness {
  const emitted: CoachAttachment[] = []
  const fleet = createFakeEngineFleet()
  const engine = createEngine({
    spawn: fleet.factory,
    environment: {
      hardwareConcurrency: 8,
      deviceMemoryGb: 8,
      hasSharedArrayBuffer: true,
      crossOriginIsolated: true,
    },
    baseUrl: '/',
  })
  const context = CoachContextSchema.parse({
    screen: '/play',
    tone: 'friendly',
    spoilerGuard: false,
    allowEngineLines: true,
    tokenBudget: 2000,
    ...(fen === undefined ? {} : { position: { fen, orientation: 'white' } }),
  })
  return {
    env: {
      context,
      emit: (attachment) => emitted.push(attachment),
      signal: new AbortController().signal,
      engine,
    },
    emitted,
    fleet,
    withEngine: async (call, lines) => {
      const pending = call()
      await flush()
      fleet.clients[0]?.current?.finish({ lines: [...lines] })
      return pending
    },
  }
}

/** Calls a tool's `execute` with the options the SDK would pass. */
export async function callTool(tools: ToolSet, name: string, input: unknown): Promise<unknown> {
  const tool = tools[name]
  if (tool?.execute === undefined) throw new Error(`No executable tool "${name}"`)
  return tool.execute(input, { toolCallId: name, messages: [], context: undefined })
}
