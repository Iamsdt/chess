import 'fake-indexeddb/auto'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { clearAllData, KV_KEYS, kvRepo, profileRepo, sessionsRepo } from '@/data'
import { createProfile, toLocalDate, toSessionId, toTimestamp } from '@/domain'
import { advanceStreak } from '@/features/habit'

import { GardenLevel, GardenSummary, ProfileLabel } from './sidebar-live'

describe('sidebar live data', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('invites a new person to set up instead of naming someone else', async () => {
    render(<ProfileLabel compact={false} />)
    expect(await screen.findByText('Set up your profile')).toBeInTheDocument()
    expect(screen.queryByText('Shudipto')).not.toBeInTheDocument()
  })

  it('shows the stored name and its initials', async () => {
    await profileRepo.save(
      createProfile({ displayName: 'Ada Lovelace', skillLevel: 'club', timeZone: 'UTC' }),
    )
    render(<ProfileLabel compact={false} />)
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('starts the garden as a seed with no streak', async () => {
    render(
      <>
        <GardenSummary />
        <GardenLevel />
      </>,
    )
    expect(await screen.findByText('Seed')).toBeInTheDocument()
    expect(screen.getByText(/3 more days to sprout/)).toBeInTheDocument()
    expect(screen.getByText('Lv 1')).toBeInTheDocument()
  })

  it('grows with practice days and says what the streak and freeze are', async () => {
    const now = Date.now()
    const day = (n: number) => new Date(now - n * 86_400_000).toISOString().slice(0, 10)
    await profileRepo.save(
      createProfile({ displayName: 'Ada', skillLevel: 'club', timeZone: 'UTC' }),
    )
    let streak = undefined
    for (const n of [3, 2, 1, 0]) {
      await sessionsRepo.start({
        id: toSessionId(`s-${String(n)}`),
        kind: 'adaptive-puzzles',
        state: 'completed',
        day: toLocalDate(day(n)),
        startedAt: toTimestamp(now - n * 86_400_000),
        updatedAt: toTimestamp(now),
        endedAt: toTimestamp(now),
        durationMs: 600_000,
        itemsAttempted: 1,
        itemsCorrect: 1,
        resumeState: {},
      })
      streak = advanceStreak(streak, {
        today: toLocalDate(day(n)),
        ms: 600_000,
        goalMs: 900_000,
        at: toTimestamp(now - n * 86_400_000),
      })
    }
    if (streak !== undefined) await kvRepo.set(KV_KEYS.streak, streak)

    render(
      <>
        <GardenSummary />
        <GardenLevel />
      </>,
    )
    expect(await screen.findByText('Sprout · 4-day streak')).toBeInTheDocument()
    expect(screen.getByText(/3 more days to sapling · 1 freeze saved/)).toBeInTheDocument()
    expect(screen.getByText('Lv 2')).toBeInTheDocument()
  })
})
