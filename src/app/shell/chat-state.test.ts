import { beforeEach, describe, expect, it } from 'vitest'

import { initialChatState, shouldPersistChatState } from './chat-state'
import { readStoredChatState, writeStoredChatState } from './chat-storage'

import type { ChatScreen } from '../screens'

const wide: ChatScreen = { initial: 'open', quick: [] }
const startsClosed: ChatScreen = { initial: 'closed', quick: [] }
const noPanel: ChatScreen = { initial: 'none', quick: [] }

describe('chat panel state', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('has no panel at all where the screen declares none', () => {
    expect(initialChatState(noPanel, 1440)).toBe('none')
    expect(initialChatState(noPanel, 390)).toBe('none')
  })

  it('starts closed on any viewport that would overlay the page', () => {
    expect(initialChatState(wide, 1280)).toBe('closed')
    expect(initialChatState(wide, 390)).toBe('closed')
  })

  it('obeys a screen that asks to start closed', () => {
    writeStoredChatState('open')
    expect(initialChatState(startsClosed, 1440)).toBe('closed')
  })

  it('falls back to the saved preference, then to open', () => {
    expect(initialChatState(wide, 1440)).toBe('open')
    writeStoredChatState('closed')
    expect(initialChatState(wide, 1440)).toBe('closed')
  })

  it('only remembers the preference from widths where the panel is docked', () => {
    expect(shouldPersistChatState(1440)).toBe(true)
    expect(shouldPersistChatState(1280)).toBe(false)
  })

  it('ignores a stored value that is not a panel state', () => {
    localStorage.setItem('ck-chat', 'sideways')
    expect(readStoredChatState()).toBeNull()
  })
})
