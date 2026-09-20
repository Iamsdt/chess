/** S04 · The app shell: layout frame, navigation, Sage panel slot, command palette. */
export { AppShell, type AppShellProps } from './app-shell'
export { SHELL_BREAKPOINTS, SHELL_SIZES } from './breakpoints'
export { initialChatState, shouldPersistChatState } from './chat-state'
export { readStoredChatState, writeStoredChatState, type StoredChatState } from './chat-storage'
export type { ChatPanelState, ChatPanelValue, CommandPaletteValue } from './shell-contexts'
export { useChatPanel } from './use-chat-panel'
export { useCommandPalette } from './use-command-palette'
export {
  CHORD_TIMEOUT_MS,
  useShellShortcuts,
  type ShellShortcutOptions,
} from './use-shell-shortcuts'
export {
  resolveViewport,
  useShellViewport,
  useViewportWidth,
  type ShellViewport,
} from './use-viewport'
