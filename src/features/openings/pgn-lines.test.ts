import { describe, expect, it, vi } from 'vitest'

import { parseLines } from './pgn-lines'
import { createLinesPort } from './pgn-lines-port'
import { emptyTree, testContext } from './test-helpers'
import { addBranches, findBySanPath, lineEnds, subtreeOf } from './tree'

const STUDY = `[Event "Caro chapter"]
[Result "*"]

1. e4 c6 2. d4 d5 3. e5 {The bishop gets out first.} Bf5 (3... c5 4. dxc5) 4. Nf3 e6 5. Be2 c5 *

[Event "Second"]
[Result "*"]

1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6 *
`

describe('parseLines', () => {
  it('merges games and keeps variations as siblings of the move they replace', () => {
    const parsed = parseLines(STUDY)
    if (!parsed.ok) throw new Error(parsed.error.message)
    expect(parsed.value.games).toBe(2)
    const e4 = parsed.value.branches[0]
    expect(e4?.san).toBe('e4')
    const d5 = e4?.children[0]?.children[0]?.children[0]
    expect(d5?.san).toBe('d5')
    expect(d5?.children.map((child) => child.san)).toEqual(['e5', 'exd5'])
    const e5 = d5?.children[0]
    expect(e5?.comment).toBe('The bishop gets out first.')
    expect(e5?.children.map((child) => child.san)).toEqual(['Bf5', 'c5'])
  })

  it('imports into a repertoire tree', () => {
    const parsed = parseLines(STUDY)
    if (!parsed.ok) throw new Error(parsed.error.message)
    const ctx = testContext()
    const tree = emptyTree('black', ctx)
    const edit = addBranches(tree, tree.rootId, parsed.value.branches, ctx)
    if (!edit.ok) throw new Error(edit.error.message)
    expect(subtreeOf(edit.value.tree, tree.rootId).length - 1).toBe(edit.value.value)
    expect(findBySanPath(edit.value.tree, ['e4', 'c6', 'd4', 'd5', 'e5'])?.comment).toBe(
      'The bishop gets out first.',
    )
    expect(lineEnds(edit.value.tree).map((node) => node.san)).toEqual(
      expect.arrayContaining(['c5', 'Nc6']),
    )
  })

  it('rejects text with no games and skips games from custom positions', () => {
    expect(parseLines('not a pgn').ok).toBe(false)
    const custom = `[FEN "8/8/8/4k3/8/8/4K3/8 w - - 0 1"]\n[SetUp "1"]\n\n1. Kd2 Kd4 *\n`
    expect(parseLines(custom).ok).toBe(false)
  })
})

describe('createLinesPort', () => {
  it('parses small input inline without a worker', async () => {
    const port = createLinesPort(() => {
      throw new Error('no worker should start')
    })
    const parsed = await port.parse(STUDY)
    expect(parsed.ok).toBe(true)
  })

  it('hands large input to the worker and validates the reply', async () => {
    const listeners = new Map<string, (event: unknown) => void>()
    const posted: unknown[] = []
    const fake = {
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        listeners.set(name, handler)
      },
      postMessage: (message: unknown) => {
        posted.push(message)
        listeners.get('message')?.({
          data: {
            ok: true,
            value: { branches: [{ san: 'e4', children: [] }], games: 1, skipped: 0 },
          },
        })
      },
      terminate: () => undefined,
    }
    vi.stubGlobal('Worker', vi.fn())
    try {
      const port = createLinesPort(() => fake as unknown as Worker, 10)
      const parsed = await port.parse(STUDY)
      expect(posted).toEqual([STUDY])
      expect(parsed.ok && parsed.value.branches[0]?.san).toBe('e4')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('fails the request when the worker replies with nonsense', async () => {
    const listeners = new Map<string, (event: unknown) => void>()
    const fake = {
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        listeners.set(name, handler)
      },
      postMessage: () => {
        listeners.get('message')?.({ data: { nope: true } })
      },
      terminate: () => undefined,
    }
    vi.stubGlobal('Worker', vi.fn())
    try {
      const port = createLinesPort(() => fake as unknown as Worker, 10)
      expect((await port.parse(STUDY)).ok).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
