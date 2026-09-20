/** S04 · App shell, routing and the screen registry every feature sprint plugs into. */

export { App } from './App'
export { router } from './router'
export { routeTree } from './routes'

/* The frame and the two pieces of shell state a screen can reach. */
export {
  AppShell,
  SHELL_BREAKPOINTS,
  SHELL_SIZES,
  resolveViewport,
  useChatPanel,
  useCommandPalette,
  useShellViewport,
  useViewportWidth,
  type AppShellProps,
  type ChatPanelState,
  type ChatPanelValue,
  type CommandPaletteValue,
  type ShellViewport,
} from './shell'

/* Route ids and paths, for typed links and for anything that needs a screen's config. */
export {
  NOT_FOUND_SCREEN,
  SCREENS,
  SCREEN_IDS,
  SCREEN_LIST,
  screenByPath,
  screenPath,
  type ChatAvailability,
  type ChatScreen,
  type NavId,
  type Screen,
  type ScreenFrame,
  type ScreenId,
  type ScreenLayout,
  type ScreenPath,
  type ShellScreen,
} from './screens'

/* The navigation model: sidebar groups, the mobile bar and the `g` chords. */
export {
  BOTTOM_NAV_IDS,
  BOTTOM_NAV_ITEMS,
  NAV_CHORDS,
  NAV_GROUPS,
  NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  chordHint,
  type NavBadge,
  type NavGroup,
  type NavItem,
} from './navigation'

export { useCurrentScreen } from './use-current-screen'
export { useDocumentTitle } from './use-document-title'
