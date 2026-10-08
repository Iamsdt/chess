import { useEffect } from 'react'

import { useProfile, useSettings, useStreak } from '@/data'
import { localDateOf, now } from '@/domain'

import { msUntilReminder, reminderText, shouldRemind } from './reminder'

/** The browser's permission, or `unsupported` where notifications do not exist. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/**
 * Asks for notification permission. Call it from the click that turns the reminder on:
 * browsers ignore (and users resent) a prompt that no gesture caused.
 */
export async function requestReminderPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** Keeps one timer running for the next reminder; rescheduled whenever its inputs change. */
export function useDailyReminder(): void {
  const settings = useSettings()
  const streak = useStreak()
  const profile = useProfile()
  const { reminderEnabled, reminderTime } = settings
  // The profile's zone is the one the streak is counted in, so the nudge uses it too.
  const profileZone = profile?.timeZone

  useEffect(() => {
    if (!reminderEnabled || notificationPermission() !== 'granted') return
    const timeZone = profileZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    let timer: ReturnType<typeof setTimeout> | undefined

    const arm = (): void => {
      timer = setTimeout(
        () => {
          const at = now()
          if (
            shouldRemind({
              enabled: reminderEnabled,
              permission: notificationPermission(),
              streak,
              at,
              timeZone,
            })
          ) {
            try {
              new Notification('Chess King', {
                body: reminderText(streak, localDateOf(at, timeZone)),
                tag: 'daily-reminder',
              })
            } catch {
              // Some mobile browsers only allow notifications from a service worker.
            }
          }
          arm()
        },
        msUntilReminder(now(), timeZone, reminderTime),
      )
    }
    arm()
    return () => {
      clearTimeout(timer)
    }
  }, [reminderEnabled, reminderTime, streak, profileZone])
}
