/** Shared number and time formatting, so the four screens cannot disagree about a clock. */

/** `2:14`, or `0:07`. Never negative, because a clock at zero is a clock at zero. */
export function formatClock(ms: number): string {
  const total = Math.max(Math.round(ms / 1000), 0)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

/** `4:12` for a session length, `38s` for a single puzzle. */
export function formatDuration(ms: number): string {
  return ms < 60_000 ? `${String(Math.max(Math.round(ms / 1000), 0))}s` : formatClock(ms)
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${String(Math.round(value * 100))}%`
}

/** `+18`, `−4`, `0` — the minus is a real minus sign, not a hyphen. */
export function formatDelta(value: number): string {
  if (value === 0) return '0'
  return `${value > 0 ? '+' : '−'}${String(Math.abs(value))}`
}
