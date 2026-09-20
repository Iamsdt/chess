import { useEffect } from 'react'

const SUFFIX = 'Chess King'

/** Keeps the browser tab honest as the router swaps screens — a single-page app does not
 *  get a new `<title>` for free, and the tab is how a user finds this app among twenty. */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title === undefined ? SUFFIX : `${title} · ${SUFFIX}`
  }, [title])
}
