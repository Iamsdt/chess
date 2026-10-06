import { profileRepo } from '@/data'
import {
  createProfile,
  now,
  ok,
  type CoachProvider,
  type DailyGoalMinutes,
  type BoardTheme,
  type Result,
  type SkillLevel,
  type ThemeMode,
} from '@/domain'
import { MODEL_OPTIONS } from '@/features/settings/coach-options'
import { changeSettings, localTimeZone } from '@/features/settings/settings-actions'

export interface OnboardingAnswers {
  readonly displayName: string
  readonly skillLevel: SkillLevel
  readonly goals: readonly string[]
  readonly dailyMinutes: DailyGoalMinutes
  readonly boardTheme: BoardTheme
  readonly themeMode: ThemeMode
  readonly coachProvider: CoachProvider
}

/**
 * Writes everything the four steps asked for, in one go, at the end.
 *
 * Why at the end and not per step: a person who closes the tab at step 2 has not finished
 * setup, so nothing half-made should exist. Why it also works on a replay: the profile row
 * is updated, not replaced, so re-running first-run setup from Settings never resets the
 * ratings the user has earned.
 */
export async function completeOnboarding(answers: OnboardingAnswers): Promise<Result<void>> {
  const name = answers.displayName.trim() === '' ? 'Player' : answers.displayName.trim()
  const existing = await profileRepo.get()

  const profile =
    existing === undefined
      ? await profileRepo.save(
          createProfile({
            displayName: name,
            skillLevel: answers.skillLevel,
            goals: answers.goals,
            timeZone: localTimeZone(),
            onboardingCompleted: true,
          }),
        )
      : await profileRepo.update({
          displayName: name,
          skillLevel: answers.skillLevel,
          goals: [...answers.goals],
          onboardingCompletedAt: existing.onboardingCompletedAt ?? now(),
        })
  if (!profile.ok) return profile

  const settings = await changeSettings((current) => ({
    ...current,
    theme: answers.themeMode,
    dailyGoalMinutes: answers.dailyMinutes,
    board: { ...current.board, theme: answers.boardTheme },
    coach: {
      ...current.coach,
      provider: answers.coachProvider,
      model:
        current.coach.provider === answers.coachProvider
          ? current.coach.model
          : (MODEL_OPTIONS[answers.coachProvider][0]?.id ?? current.coach.model),
    },
  }))
  return settings.ok ? ok(undefined) : settings
}
