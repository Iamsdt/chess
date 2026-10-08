import 'fake-indexeddb/auto'

import { afterEach, describe, expect, it } from 'vitest'

import { makeRepertoireNode, toRepertoireNodeId } from '@/domain'

import { createDb, type ChessKingDb } from '../db'

import { createRepertoireRepository } from './repertoire'

let counter = 0
let db: ChessKingDb | undefined

afterEach(() => {
  db?.close()
  db = undefined
})

function setup() {
  counter += 1
  db = createDb(`repertoire-test-${String(counter)}`)
  return createRepertoireRepository(db)
}

const node = (id: string, parentId: string | null, ply: number) =>
  makeRepertoireNode({
    id: toRepertoireNodeId(id),
    parentId: parentId === null ? null : toRepertoireNodeId(parentId),
    childIds: [],
    ply,
  })

describe('repertoire applyChange', () => {
  it('writes and deletes in one transaction and returns the number of rows touched', async () => {
    const repo = setup()
    await repo.putMany([node('a', null, 0), node('b', 'a', 1), node('c', 'b', 2)])
    const changed = await repo.applyChange(
      [node('d', 'a', 1)],
      [toRepertoireNodeId('b'), toRepertoireNodeId('c')],
    )
    expect(changed.ok && changed.value).toBe(3)
    const ids = (await repo.listByColor('black')).map((row) => row.id)
    expect(ids.sort()).toEqual(['a', 'd'])
  })

  it('validates before writing, so a bad row leaves storage untouched', async () => {
    const repo = setup()
    await repo.put(node('a', null, 0))
    const bad = { ...node('b', 'a', 1), ply: -1 }
    const changed = await repo.applyChange([bad], [toRepertoireNodeId('a')])
    expect(changed.ok).toBe(false)
    expect(await repo.count()).toBe(1)
  })
})
