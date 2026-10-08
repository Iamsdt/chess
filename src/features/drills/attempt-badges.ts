/** One attempt in the "last three" strip. */
export interface AttemptBadge {
  readonly id: number
  readonly text: string
  readonly correct: boolean
}

/** Keeps the newest three, newest first. */
export function pushAttempt(
  badges: readonly AttemptBadge[],
  text: string,
  correct: boolean,
): readonly AttemptBadge[] {
  const id = (badges[0]?.id ?? 0) + 1
  return [{ id, text, correct }, ...badges].slice(0, 3)
}
