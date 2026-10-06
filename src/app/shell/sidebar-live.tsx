import { useMemo, useState } from 'react'

import { useAllAttempts, useAllSessions, useProfile, useStreak } from '@/data'
import { localDateOf, toTimestamp } from '@/domain'
import { viewStreak } from '@/features/habit'
import { GARDEN_STAGES, gardenFor, practiceMsByDay } from '@/features/progress/progress-stats'

/**
 * The two parts of the sidebar that read stored data.
 *
 * They live in their own module because the sidebar is in the first download and the data
 * layer is not: `Sidebar` loads this on demand and draws a neutral placeholder meanwhile,
 * so the §5 budget keeps measuring what a first paint needs.
 */

/** "Sapling · 12-day streak" and the line under it. */
export function GardenSummary() {
  const profile = useProfile()
  const streak = useStreak()
  const sessions = useAllSessions()
  const attempts = useAllAttempts()
  const [now] = useState(() => Date.now())

  const facts = useMemo(() => {
    const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const byDay = practiceMsByDay(sessions ?? [], attempts ?? [], timeZone)
    const garden = gardenFor([...byDay.values()].filter((ms) => ms > 0).length)
    const view = viewStreak(streak, localDateOf(toTimestamp(now), timeZone))
    return { garden, view }
  }, [profile, streak, sessions, attempts, now])

  const { garden, view } = facts
  const stage = GARDEN_STAGES[garden.stageIndex]
  return (
    <>
      <p className="text-sm font-medium">
        {stage?.label ?? 'Seed'}
        {view.current > 0 ? ` · ${String(view.current)}-day streak` : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        {garden.next === undefined
          ? 'Fully grown'
          : `${String(garden.daysToNext)} more ${garden.daysToNext === 1 ? 'day' : 'days'} to ${garden.next.label.toLowerCase()}`}
        {view.freezeAvailable ? ' · 1 freeze saved' : ''}
      </p>
    </>
  )
}

/** The "Lv N" badge beside the garden's title. */
export function GardenLevel() {
  const sessions = useAllSessions()
  const attempts = useAllAttempts()
  const profile = useProfile()
  const level = useMemo(() => {
    const timeZone = profile?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const byDay = practiceMsByDay(sessions ?? [], attempts ?? [], timeZone)
    return gardenFor([...byDay.values()].filter((ms) => ms > 0).length).level
  }, [sessions, attempts, profile])
  return <>Lv {level}</>
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]?.slice(0, 2)]
  return letters
    .map((part) => part?.charAt(0) ?? '')
    .join('')
    .toUpperCase()
}

/** Avatar and name from the stored profile; "Local profile" until there is one. */
export function ProfileLabel({ compact }: { readonly compact: boolean }) {
  const profile = useProfile()
  const name = profile?.displayName
  return (
    <>
      <span className="avatar size-8 bg-primary text-primary-foreground">
        {name === undefined ? '?' : initialsOf(name)}
      </span>
      <span className={compact ? 'sr-only' : 'min-w-0 leading-tight'}>
        <span className="block truncate text-sm font-medium">{name ?? 'Set up your profile'}</span>
        <span className="block text-xs text-muted-foreground">Local profile</span>
      </span>
    </>
  )
}
