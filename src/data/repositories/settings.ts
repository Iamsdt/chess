import { now, ok, parseValid, SettingsSchema, type Result, type Settings } from '@/domain'

import { runWrite } from '../internal'
import { SETTINGS_ROW_ID, SettingsRowSchema } from '../schema'

import type { ChessKingDb } from '../db'

/**
 * The one settings row.
 *
 * Why `get` returns `Settings` rather than `Settings | undefined`: every screen
 * reads settings on mount, and a nullable read would make each of them invent
 * its own fallback. The defaults come from the schema itself, so "no row yet"
 * and "a row written by an older build" produce the same complete object.
 *
 * Nothing here ever holds an API key: `CoachSettings` carries `hasKey`, and the
 * key itself lives in the vault under the reserved `vault:` kv namespace, which
 * the backup cannot reach.
 */
export interface SettingsRepository {
  /** Stored settings, or the schema's defaults when nothing has been saved yet. */
  get: () => Promise<Settings>
  /** `undefined` when the user has never saved settings — onboarding asks this. */
  peek: () => Promise<Settings | undefined>
  save: (settings: Settings) => Promise<Result<Settings>>
  /** Read-modify-write, so a panel can change one field without sending the rest. */
  update: (patch: Partial<Settings>) => Promise<Result<Settings>>
  reset: () => Promise<Result<Settings>>
  clear: () => Promise<Result<void>>
}

/** Why: the schema's defaults are the product's defaults; do not restate them. */
export function defaultSettings(): Settings {
  return SettingsSchema.parse({
    board: {},
    sound: {},
    coach: {},
    play: {},
    updatedAt: now(),
  })
}

export function createSettingsRepository(db: ChessKingDb): SettingsRepository {
  async function peek(): Promise<Settings | undefined> {
    const row = await db.settings.get(SETTINGS_ROW_ID)
    if (row === undefined) return undefined
    const parsed = parseValid(SettingsSchema, row.value, 'settings.get')
    return parsed.ok ? parsed.value : undefined
  }

  async function save(settings: Settings): Promise<Result<Settings>> {
    const parsed = parseValid(
      SettingsRowSchema,
      { id: SETTINGS_ROW_ID, value: { ...settings, updatedAt: settings.updatedAt } },
      'settings.save',
    )
    if (!parsed.ok) return parsed
    const written = await runWrite('settings.save', () => db.settings.put(parsed.value))
    return written.ok ? ok(parsed.value.value) : written
  }

  return {
    get: async () => (await peek()) ?? defaultSettings(),

    peek,

    save,

    update: async (patch) => {
      const current = (await peek()) ?? defaultSettings()
      return save({ ...current, ...patch, updatedAt: patch.updatedAt ?? now() })
    },

    reset: () => save(defaultSettings()),

    clear: () =>
      runWrite('settings.clear', async () => {
        await db.settings.clear()
      }),
  }
}
