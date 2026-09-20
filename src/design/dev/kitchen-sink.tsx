import { BOARD_THEMES, Button, THEME_MODES, ThemeToggle, Toaster, useTheme } from '@/design'

import { Gallery } from './gallery'

/** The S02 acceptance artifact: every component in every meaningful state, shown in both
 *  palettes at once so it can be diffed against the prototype without toggling anything. */
export function KitchenSink() {
  const { theme, resolvedTheme, setTheme, board, setBoard } = useTheme()

  return (
    <main id="gallery-top" className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 p-4">
          <div className="mr-auto">
            <p className="eyebrow">Design system</p>
            <h1 className="font-display text-xl font-bold">Kitchen sink</h1>
          </div>

          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Page theme</legend>
            <span className="label">Theme</span>
            <div className="seg">
              {THEME_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={mode === theme ? 'is-active' : undefined}
                  aria-pressed={mode === theme}
                  onClick={() => {
                    setTheme(mode)
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
            <ThemeToggle />
          </fieldset>

          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Board palette</legend>
            <span className="label">Board</span>
            <div className="seg">
              {BOARD_THEMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={name === board ? 'is-active' : undefined}
                  aria-pressed={name === board}
                  onClick={() => {
                    setBoard(name)
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </fieldset>

          <Button variant="outline" size="sm" asChild>
            <a href="/">Back to app</a>
          </Button>
        </div>
        <p className="mx-auto max-w-[1400px] px-4 pb-3 text-xs text-muted-foreground">
          Page resolves to <b className="font-medium text-foreground">{resolvedTheme}</b>. The two
          columns below are pinned to light and dark regardless, for side-by-side review.
        </p>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-px bg-border lg:grid-cols-2">
        <div className="light bg-background">
          <p className="eyebrow bg-card px-6 py-3">Light</p>
          <Gallery />
        </div>
        <div className="dark bg-background">
          <p className="eyebrow bg-card px-6 py-3">Dark</p>
          <Gallery />
        </div>
      </div>

      <Toaster />
    </main>
  )
}
