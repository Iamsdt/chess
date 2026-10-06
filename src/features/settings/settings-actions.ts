import {
  clearAllData,
  exportBackup,
  kvRepo,
  KV_KEYS,
  parseBackup,
  profileRepo,
  restoreBackup,
  serializeBackup,
  settingsRepo,
} from '@/data'
import {
  createProfile,
  domainError,
  err,
  now,
  ok,
  type Result,
  type Settings,
  type SkillLevel,
} from '@/domain'

/** Browser keys the app keeps outside IndexedDB; "clear all" has to take them too, or the
 *  old look and the old chat panel state would survive a wipe. */
const LOCAL_KEY_PREFIX = 'ck-'

/** Tail of the write queue; see `changeSettings`. */
let settingsQueue: Promise<unknown> = Promise.resolve()

/**
 * Read-modify-write on the one settings row.
 *
 * Why the change is a function and why writes queue: nested groups (`board`, `sound`, …)
 * have to merge into what is stored *now*, and two quick toggles must not both read the
 * old row and then overwrite each other. Each change waits for the previous one to land.
 */
export function changeSettings(change: (current: Settings) => Settings): Promise<Result<Settings>> {
  const run = settingsQueue.then(async () => {
    const current = await settingsRepo.get()
    return settingsRepo.save({ ...change(current), updatedAt: now() })
  })
  settingsQueue = run.catch(() => undefined)
  return run
}

/** The browser's own zone, because streaks and the heatmap are calendar questions. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Writes name and/or level, creating the local profile first when onboarding was skipped. */
export async function changeProfile(patch: {
  displayName?: string
  skillLevel?: SkillLevel
}): Promise<Result<void>> {
  const existing = await profileRepo.get()
  if (existing === undefined) {
    const created = await profileRepo.save(
      createProfile({
        displayName: patch.displayName ?? 'Player',
        skillLevel: patch.skillLevel ?? 'club',
        timeZone: localTimeZone(),
      }),
    )
    return created.ok ? ok(undefined) : created
  }
  const updated = await profileRepo.update(patch)
  return updated.ok ? ok(undefined) : updated
}

/** `chess-king-2026-09-19.json` — a date in the name so two exports never collide. */
export function backupFileName(): string {
  return `chess-king-${new Date().toISOString().slice(0, 10)}.json`
}

/** Hands text to the browser as a file download. */
export function saveTextFile(fileName: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export interface BackupExported {
  readonly fileName: string
  readonly rows: number
}

/** Everything except key material, downloaded as JSON. */
export async function downloadBackup(): Promise<Result<BackupExported>> {
  const exported = await exportBackup()
  if (!exported.ok) return exported
  const fileName = backupFileName()
  saveTextFile(fileName, serializeBackup(exported.value.file), 'application/json')
  await kvRepo.set(KV_KEYS.lastBackupAt, now())
  const rows = Object.values(exported.value.report.counts).reduce((sum, count) => sum + count, 0)
  return ok({ fileName, rows })
}

/** Merges a backup file into what is already here; nothing is deleted. */
export async function importBackupFile(file: File): Promise<Result<number>> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return err(domainError('validation', 'That file is not valid JSON', { where: file.name }))
  }
  const parsed = parseBackup(raw)
  if (!parsed.ok) return parsed
  const restored = await restoreBackup(parsed.value, { mode: 'merge' })
  if (!restored.ok) return restored
  return ok(Object.values(restored.value.counts).reduce((sum, count) => sum + count, 0))
}

/** The destructive flow: database first, then the keys the app keeps in the browser. */
export async function wipeEverything(): Promise<Result<void>> {
  const cleared = await clearAllData()
  if (!cleared.ok) return cleared
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(LOCAL_KEY_PREFIX)) localStorage.removeItem(key)
  }
  return ok(undefined)
}
