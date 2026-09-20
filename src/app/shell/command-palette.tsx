import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { MessageCircle, Moon, Search, Sun } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useTheme,
} from '@/design'

import { NAV_ITEMS, chordHint } from '../navigation'
import { SCREEN_LIST, screenPath, type Screen, type ScreenId } from '../screens'

import { useChatPanel } from './use-chat-panel'
import { useCommandPalette } from './use-command-palette'

const NAV_SCREEN_IDS = new Set<ScreenId>(NAV_ITEMS.map((item) => item.screen))

const OTHER_SCREENS: readonly Screen[] = SCREEN_LIST.filter(
  (screen) => screen.frame === 'shell' && !NAV_SCREEN_IDS.has(screen.id),
)

const BARE_SCREENS: readonly Screen[] = SCREEN_LIST.filter((screen) => screen.frame === 'bare')

const groupClass =
  'px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase'

const itemClass =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground'

/** ⌘K. A shell-level index of every route plus the handful of things the shell itself can
 *  do, so no screen has to grow its own navigation menu. */
export function CommandPalette() {
  const palette = useCommandPalette()
  const chat = useChatPanel()
  const navigate = useNavigate()
  const { resolvedTheme, toggleTheme } = useTheme()

  const go = (id: ScreenId) => {
    palette.close()
    void navigate({ to: screenPath(id) })
  }

  return (
    <Dialog
      open={palette.isOpen}
      onOpenChange={(open) => {
        if (open) palette.open()
        else palette.close()
      }}
    >
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>Jump to any screen or run a shell action.</DialogDescription>
        </DialogHeader>
        <Command label="Command palette" className="flex flex-col">
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Command.Input
              placeholder="Jump to a screen…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[min(60vh,360px)] overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing matches that. Try a screen name.
            </Command.Empty>

            <Command.Group heading="Go to" className={groupClass}>
              {NAV_ITEMS.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.screen}`}
                  className={itemClass}
                  onSelect={() => {
                    go(item.screen)
                  }}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{item.label}</span>
                  <kbd className="kbd">{chordHint(item)}</kbd>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="More screens" className={groupClass}>
              {OTHER_SCREENS.map((screen) => (
                <Command.Item
                  key={screen.id}
                  value={`${screen.title} ${screen.id} ${screen.path}`}
                  className={itemClass}
                  onSelect={() => {
                    go(screen.id)
                  }}
                >
                  <span className="flex-1 truncate">{screen.title}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {screen.path}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Actions" className={groupClass}>
              <Command.Item
                value="toggle theme dark light appearance"
                className={itemClass}
                onSelect={() => {
                  toggleTheme()
                  palette.close()
                }}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Moon className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="flex-1 truncate">
                  Switch to {resolvedTheme === 'dark' ? 'light' : 'dark'} mode
                </span>
              </Command.Item>
              {chat.isAvailable ? (
                <Command.Item
                  value="sage chat coach panel"
                  className={itemClass}
                  onSelect={() => {
                    chat.toggle()
                    palette.close()
                  }}
                >
                  <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">
                    {chat.isOpen ? 'Close the Sage panel' : 'Open the Sage panel'}
                  </span>
                  <kbd className="kbd">/</kbd>
                </Command.Item>
              ) : null}
              {BARE_SCREENS.map((screen) => (
                <Command.Item
                  key={screen.id}
                  value={`${screen.title} ${screen.id} ${screen.path}`}
                  className={itemClass}
                  onSelect={() => {
                    go(screen.id)
                  }}
                >
                  <span className="flex-1 truncate">{screen.title}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {screen.path}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
