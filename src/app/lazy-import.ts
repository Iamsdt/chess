/** Set once before a recovery reload, so a genuinely broken chunk cannot loop forever. */
const RELOAD_FLAG = 'ck-chunk-reload'

function readFlag(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1'
  } catch {
    return true // No session storage: never reload, because we cannot remember that we did.
  }
}

function writeFlag(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(RELOAD_FLAG, '1')
    else sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    // Private mode or blocked storage; the guard above already handles it.
  }
}

/**
 * Reloads once when a screen's chunk has gone missing.
 *
 * The URL of a lazy chunk is baked into the module that imports it. If that file is
 * renamed or rebuilt, an already-loaded page keeps asking for the old URL and the import
 * rejects — "Failed to fetch dynamically imported module". It happens in development when
 * a file is renamed under a running dev server, and in production to anyone holding a tab
 * open across a deploy. Neither is a code fault, and both are fixed by fetching the page
 * again, so do exactly that — once, then give up and let the error boundary show.
 */
export async function importLazy<T>(load: () => Promise<T>): Promise<T> {
  try {
    const module = await load()
    writeFlag(false)
    return module
  } catch (error) {
    if (!readFlag()) {
      writeFlag(true)
      window.location.reload()
      // Block the rejection while the reload is in flight, so no error flashes up first.
      await new Promise(() => undefined)
    }
    throw error
  }
}
