/**
 * S05 · Persistence layer — the only code in the app that talks to IndexedDB.
 *
 * What a feature imports from here:
 * - a **repository** per aggregate (`gamesRepo`, `puzzlesRepo`, …) for reads and
 *   writes, and
 * - a **hook** (`useGames`, `useDueCards`, …) when a screen should re-render as
 *   the data changes.
 *
 * The Dexie instance itself is deliberately not exported, and ESLint stops
 * `@/features` and `@/app` importing it by another route.
 *
 * Two conventions run through the whole layer:
 *
 * - **Reads return plain values, writes return `Result`.** A read is what a
 *   `useLiveQuery` hook calls, so it resolves to the data or to `undefined`; a
 *   write can fail on quota, on a conflict or on validation, and a caller has to
 *   be able to see which.
 * - **Every write validates.** A record is parsed through its S03 schema before
 *   it reaches the table, so a row that comes back out can be trusted without
 *   being re-checked. Restores validate the whole file the same way.
 */

/**
 * `DB_NAME` is here for the service worker and the "clear all" flow; the Dexie
 * instance and `createDb` deliberately are not. A feature that needs a query
 * gets a repository, and the migration test harness imports `createDb` from
 * inside this folder.
 */
export { DB_NAME } from './db'
export type { ChessKingDb } from './db'

export { applyMigrations, CURRENT_DB_VERSION, MIGRATIONS, type Migration } from './migrations'

export {
  GameRowSchema,
  KvRowSchema,
  LESSON_PROGRESS_STATUSES,
  LessonProgressSchema,
  LessonProgressStatusSchema,
  PRACTICE_SESSION_STATES,
  PracticeSessionSchema,
  PracticeSessionStateSchema,
  SETTINGS_ROW_ID,
  SettingsRowSchema,
  type GameRow,
  type KvRow,
  type LessonProgress,
  type LessonProgressStatus,
  type PracticeSession,
  type PracticeSessionState,
  type SettingsRow,
} from './schema'

export {
  defineKvKey,
  isBackupSafeKvKey,
  KV_KEYS,
  SECRET_KV_PREFIX,
  VAULT_KV_PREFIX,
  type KvKey,
} from './kv-keys'

export {
  newAttemptId,
  newGameId,
  newJobId,
  newMistakeId,
  newRepertoireNodeId,
  newSessionId,
  newSrsCardId,
} from './internal'

export * from './repositories'
export * from './hooks'

export {
  assertNoKeyMaterial,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLES,
  BackupDataSchema,
  BackupFileSchema,
  clearAllData,
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupData,
  type BackupFile,
  type BackupReport,
  type BackupTable,
  type ExportedBackup,
  type RestoreOptions,
} from './backup'

export {
  estimateStorage,
  QUOTA_CRITICAL_RATIO,
  QUOTA_LEVELS,
  QUOTA_WARN_RATIO,
  quotaLevel,
  requestPersistentStorage,
  type QuotaLevel,
  type StorageEstimateInfo,
} from './storage'

export { seedDatabase, type SeedOptions, type SeedSummary } from './seed'
