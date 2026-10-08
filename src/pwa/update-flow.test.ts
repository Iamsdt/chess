import { describe, expect, it } from 'vitest'

import {
  INITIAL_UPDATE_STATE,
  reduceUpdate,
  type UpdateEvent,
  type UpdateState,
} from './update-flow'

const run = (events: readonly UpdateEvent[], from: UpdateState = INITIAL_UPDATE_STATE) =>
  events.reduce(reduceUpdate, from)

describe('reduceUpdate', () => {
  it('reports a first install as offline-ready, never as an update', () => {
    const state = run([
      { type: 'update-found' },
      { type: 'worker-installed', hadController: false },
      { type: 'controller-changed' },
    ])
    expect(state).toEqual({ phase: 'offline-ready', reload: false })
  })

  it('walks installing, ready, applying, then reloads once', () => {
    const ready = run([{ type: 'update-found' }, { type: 'worker-installed', hadController: true }])
    expect(ready.phase).toBe('ready')
    const applying = reduceUpdate(ready, { type: 'apply' })
    expect(applying).toEqual({ phase: 'applying', reload: false })
    expect(reduceUpdate(applying, { type: 'controller-changed' })).toEqual({
      phase: 'idle',
      reload: true,
    })
  })

  it('does not reload when the controller changes without consent', () => {
    const ready = run([{ type: 'worker-installed', hadController: true }])
    expect(reduceUpdate(ready, { type: 'controller-changed' }).reload).toBe(false)
  })

  it('ignores apply unless an update is ready', () => {
    expect(reduceUpdate(INITIAL_UPDATE_STATE, { type: 'apply' })).toBe(INITIAL_UPDATE_STATE)
  })

  it('keeps ready and applying when the browser re-checks', () => {
    const ready = run([{ type: 'worker-installed', hadController: true }])
    expect(reduceUpdate(ready, { type: 'update-found' })).toBe(ready)
    const applying = reduceUpdate(ready, { type: 'apply' })
    expect(reduceUpdate(applying, { type: 'update-found' })).toBe(applying)
    expect(reduceUpdate(applying, { type: 'worker-installed', hadController: true })).toBe(applying)
  })

  it('dismisses only the offline-ready notice', () => {
    const offline = run([{ type: 'worker-installed', hadController: false }])
    expect(reduceUpdate(offline, { type: 'dismiss' }).phase).toBe('idle')
    const ready = run([{ type: 'worker-installed', hadController: true }])
    expect(reduceUpdate(ready, { type: 'dismiss' })).toBe(ready)
  })

  it('records an unsupported browser', () => {
    expect(run([{ type: 'unsupported' }]).phase).toBe('unsupported')
  })
})
