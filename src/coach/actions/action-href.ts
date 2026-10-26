/**
 * S21b · What an action card's `href` carries.
 *
 * Why the destination and its parameters share one string: an `ActionAttachment` has no
 * payload field and is stored in the thread, so whatever the user confirms later has to
 * survive inside the card itself. A query string is the one shape that is both a valid
 * in-app link (the "Open" link after confirming) and a place to put "theme=fork".
 */

/** The screens a confirmed action may land on. Anything else in an href is ignored. */
export const ACTION_PATHS = [
  '/',
  '/puzzles/solve',
  '/drills/endgames',
  '/drills/vision',
  '/mistakes',
] as const
export type ActionPath = (typeof ACTION_PATHS)[number]

export function actionHref(
  path: ActionPath,
  params: Readonly<Record<string, string | number | undefined>> = {},
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const text = query.toString()
  return text === '' ? path : `${path}?${text}`
}

export interface ActionTarget {
  readonly path: ActionPath
  readonly params: URLSearchParams
}

/** `undefined` for a missing href or one that points outside {@link ACTION_PATHS}. */
export function readActionHref(href: string | undefined): ActionTarget | undefined {
  if (href === undefined) return undefined
  const [path = '', query = ''] = href.split('?', 2)
  const known = ACTION_PATHS.find((candidate) => candidate === path)
  return known === undefined ? undefined : { path: known, params: new URLSearchParams(query) }
}
