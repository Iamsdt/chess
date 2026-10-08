import type { CoachEval } from '@/domain'

const MINUS = '−'

/** "+0.8", "−2.1" or "M3": white-centred, one decimal, as the review board prints it. */
export function formatEval(value: CoachEval): string {
  if (value.mate !== undefined) {
    return `${value.mate < 0 ? MINUS : ''}M${String(Math.abs(value.mate))}`
  }
  const pawns = (value.cp ?? 0) / 100
  if (Math.abs(pawns) < 0.05) return '0.0'
  const text = Math.abs(pawns).toFixed(1)
  return pawns > 0 ? `+${text}` : `${MINUS}${text}`
}

/** SAN with its decoration removed, so "Qh5+" and "Qh5" are the same answer. */
export const bareSan = (san: string): string => san.replace(/[+#!?]/g, '')
