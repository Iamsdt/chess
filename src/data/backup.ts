import { z } from 'zod'

import {
  ContentPackSchema,
  domainError,
  err,
  MistakeEntrySchema,
  MoveRecordSchema,
  now,
  ok,
  parseValid,
  ProfileSchema,
  PuzzleAttemptSchema,
  RepertoireNodeSchema,
  SettingsSchema,
  SrsCardSchema,
  TimestampSchema,
  type Result,
} from '@/domain'

import { db as appDb } from './db'
import { isBackupSafeKvKey } from './kv-keys'
import { CURRENT_DB_VERSION } from './migrations'
import {
  GameRowSchema,
  KvRowSchema,
  LessonProgressSchema,
  PracticeSessionSchema,
  SETTINGS_ROW_ID,
} from './schema'

import type { ChessKingDb } from './db'

/**
 * JSON backup: the user's own data, versioned, and provably free of key material.
 *
 * Three things keep secrets out, and they are independent on purpose:
 *
 * 1. **A table allow-list.** Only the tables below are read. `jobs` is device-
 *    local transient state and `puzzles` is a 10,000-row CC0 dataset the app
 *    re-imports from `public/quiz/`, so neither belongs in a personal backup.
 * 2. **A schema re-parse per record.** Every row is parsed through its own zod
 *    schema on the way out, and zod strips properties the schema does not name.
 *    A key smuggled onto a settings row by a future build cannot survive that.
 * 3. **A reserved kv namespace.** S21 stores the encrypted BYOK vault under
 *    `vault:`, which `isBackupSafeKvKey` never exports and `kv.putRaw` refuses
 *    to import.
 *
 * `assertNoKeyMaterial` then re-reads the finished object and refuses to hand it
 * over if a suspicious field name appears anywhere in it. That is a backstop,
 * not the mechanism — but it is the one that turns "we were careful" into a test.
 */

export const BACKUP_FORMAT = 'chessking-backup'

/** Bumped only when the file layout changes in a way an older build cannot read. */
export const BACKUP_FORMAT_VERSION = 1

export const BackupDataSchema = z.object({
  games: z.array(GameRowSchema),
  moves: z.array(MoveRecordSchema),
  attempts: z.array(PuzzleAttemptSchema),
  srsCards: z.array(SrsCardSchema),
  mistakes: z.array(MistakeEntrySchema),
  packs: z.array(ContentPackSchema),
  lessonsProgress: z.array(LessonProgressSchema),
  repertoire: z.array(RepertoireNodeSchema),
  sessions: z.array(PracticeSessionSchema),
  kv: z.array(KvRowSchema),
  settings: SettingsSchema.nullable(),
  profile: ProfileSchema.nullable(),
})
export type BackupData = z.infer<typeof BackupDataSchema>

export const BackupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(BACKUP_FORMAT_VERSION),
  /** The Dexie schema version the export came from, for a future format bump. */
  dbVersion: z.number().int().min(1),
  createdAt: TimestampSchema,
  data: BackupDataSchema,
})
export type BackupFile = z.infer<typeof BackupFileSchema>

/** The tables a backup covers, in restore order. */
export const BACKUP_TABLES = [
  'games',
  'moves',
  'attempts',
  'srsCards',
  'mistakes',
  'packs',
  'lessonsProgress',
  'repertoire',
  'sessions',
  'kv',
] as const
export type BackupTable = (typeof BACKUP_TABLES)[number]

export interface BackupReport {
  counts: Record<BackupTable, number>
  hasSettings: boolean
  hasProfile: boolean
  /** Rows that no longer matched their schema and were left out, by table. */
  skipped: string[]
}

export interface RestoreOptions {
  /**
   * `replace` empties the covered tables first — what "restore this backup"
   * means on a new device. `merge` keeps rows the file does not mention.
   */
  mode?: 'replace' | 'merge' | undefined
}

/**
 * Field names that must never appear in a backup.
 *
 * Why a name list and not a value heuristic: ciphertext is indistinguishable
 * from any other base64 string, but nothing in the domain is called `apiKey`.
 */
const FORBIDDEN_FIELD_NAMES = [
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'bearer',
  'ciphertext',
  'cryptokey',
  'passphrase',
  'privatekey',
  'private_key',
  'secret',
  'secretkey',
  'wrappedkey',
  'wrapped_key',
] as const

/** Walks the finished object; returns the paths that must not be there. */
function findKeyMaterial(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findKeyMaterial(item, `${path}[${String(index)}]`))
  }
  if (value === null || typeof value !== 'object') return []
  const found: string[] = []
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase()
    if (FORBIDDEN_FIELD_NAMES.some((name) => normalized === name)) found.push(`${path}.${key}`)
    found.push(...findKeyMaterial(child, `${path}.${key}`))
  }
  return found
}

/**
 * The backstop the "backup has no key" test asserts on.
 *
 * Exported so S21 can call it from its own vault tests without reimplementing
 * the rule.
 */
export function assertNoKeyMaterial(file: unknown): Result<void> {
  const offenders = findKeyMaterial(file)
  const unsafeKv = file !== null && typeof file === 'object' ? unsafeKvKeys(file) : []
  const problems = [...offenders, ...unsafeKv.map((key) => `$.data.kv[${key}]`)]
  if (problems.length === 0) return ok(undefined)
  return err(
    domainError('validation', 'Backup would contain key material', {
      where: 'backup.assertNoKeyMaterial',
      details: problems,
    }),
  )
}

function unsafeKvKeys(file: object): string[] {
  const parsed = BackupFileSchema.safeParse(file)
  if (!parsed.success) return []
  return parsed.data.data.kv.filter((row) => !isBackupSafeKvKey(row.key)).map((row) => row.key)
}

/** Why: a row an older build wrote may no longer validate, and one bad row must
 * not cost the user their whole backup. It is skipped and named instead. */
function stripRows<Schema extends z.ZodType>(
  schema: Schema,
  rows: readonly unknown[],
  table: string,
  skipped: string[],
): z.infer<Schema>[] {
  const kept: z.infer<Schema>[] = []
  for (const [index, row] of rows.entries()) {
    const parsed = schema.safeParse(row)
    if (parsed.success) kept.push(parsed.data)
    else skipped.push(`${table}[${String(index)}]`)
  }
  return kept
}

/** Why: settings and profile are one row each, and a row that no longer
 * validates is treated as absent rather than aborting the export. */
function parseSingleton<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): z.infer<Schema> | null {
  if (value === undefined) return null
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export interface ExportedBackup {
  file: BackupFile
  report: BackupReport
}

/** Reads every covered table and produces a file that is safe to hand to the user. */
export async function exportBackup(target: ChessKingDb = appDb): Promise<Result<ExportedBackup>> {
  const skipped: string[] = []
  try {
    const settingsRow = await target.settings.get(SETTINGS_ROW_ID)
    const profileRow = await target.profile.orderBy('id').first()

    const data: BackupData = {
      games: stripRows(GameRowSchema, await target.games.toArray(), 'games', skipped),
      moves: stripRows(MoveRecordSchema, await target.moves.toArray(), 'moves', skipped),
      attempts: stripRows(
        PuzzleAttemptSchema,
        await target.attempts.toArray(),
        'attempts',
        skipped,
      ),
      srsCards: stripRows(SrsCardSchema, await target.srsCards.toArray(), 'srsCards', skipped),
      mistakes: stripRows(MistakeEntrySchema, await target.mistakes.toArray(), 'mistakes', skipped),
      packs: stripRows(ContentPackSchema, await target.packs.toArray(), 'packs', skipped),
      lessonsProgress: stripRows(
        LessonProgressSchema,
        await target.lessonsProgress.toArray(),
        'lessonsProgress',
        skipped,
      ),
      repertoire: stripRows(
        RepertoireNodeSchema,
        await target.repertoire.toArray(),
        'repertoire',
        skipped,
      ),
      sessions: stripRows(
        PracticeSessionSchema,
        await target.sessions.toArray(),
        'sessions',
        skipped,
      ),
      kv: stripRows(
        KvRowSchema,
        (await target.kv.toArray()).filter((row) => isBackupSafeKvKey(row.key)),
        'kv',
        skipped,
      ),
      settings: parseSingleton(SettingsSchema, settingsRow?.value),
      profile: parseSingleton(ProfileSchema, profileRow),
    }

    const file: BackupFile = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      dbVersion: CURRENT_DB_VERSION,
      createdAt: now(),
      data,
    }

    const clean = assertNoKeyMaterial(file)
    if (!clean.ok) return clean

    return ok({
      file,
      report: {
        counts: {
          games: data.games.length,
          moves: data.moves.length,
          attempts: data.attempts.length,
          srsCards: data.srsCards.length,
          mistakes: data.mistakes.length,
          packs: data.packs.length,
          lessonsProgress: data.lessonsProgress.length,
          repertoire: data.repertoire.length,
          sessions: data.sessions.length,
          kv: data.kv.length,
        },
        hasSettings: data.settings !== null,
        hasProfile: data.profile !== null,
        skipped,
      },
    })
  } catch (error: unknown) {
    return err(
      domainError('io', 'Could not read the database for export', {
        where: 'backup.exportBackup',
        cause: error,
      }),
    )
  }
}

/** Why a helper rather than `JSON.stringify` at the call site: the file is a
 * contract, and pretty-printing it is what makes a diff of two backups readable. */
export function serializeBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2)
}

/** Parses a downloaded file. Everything about it is untrusted until this returns. */
export function parseBackup(raw: unknown): Result<BackupFile> {
  if (typeof raw === 'string') {
    try {
      return parseValid(BackupFileSchema, JSON.parse(raw), 'backup file')
    } catch (error: unknown) {
      return err(
        domainError('validation', 'Backup file is not valid JSON', {
          where: 'backup file',
          cause: error,
        }),
      )
    }
  }
  return parseValid(BackupFileSchema, raw, 'backup file')
}

/** Restores a parsed file. All-or-nothing: one transaction over every table. */
export async function restoreBackup(
  raw: unknown,
  options: RestoreOptions = {},
  target: ChessKingDb = appDb,
): Promise<Result<BackupReport>> {
  const parsed = parseBackup(raw)
  if (!parsed.ok) return parsed

  const reserved = parsed.value.data.kv.filter((row) => !isBackupSafeKvKey(row.key))
  if (reserved.length > 0) {
    return err(
      domainError('validation', 'Backup contains reserved key-material rows', {
        where: 'backup.restoreBackup',
        details: reserved.map((row) => `kv.${row.key}`),
      }),
    )
  }

  const { data } = parsed.value
  const replace = (options.mode ?? 'replace') === 'replace'

  try {
    await target.transaction(
      'rw',
      [
        target.games,
        target.moves,
        target.attempts,
        target.srsCards,
        target.mistakes,
        target.packs,
        target.lessonsProgress,
        target.repertoire,
        target.sessions,
        target.kv,
        target.settings,
        target.profile,
      ],
      async () => {
        if (replace) {
          await Promise.all([
            target.games.clear(),
            target.moves.clear(),
            target.attempts.clear(),
            target.srsCards.clear(),
            target.mistakes.clear(),
            target.packs.clear(),
            target.lessonsProgress.clear(),
            target.repertoire.clear(),
            target.sessions.clear(),
            target.settings.clear(),
            target.profile.clear(),
          ])
          // The vault lives in `kv` too, so clearing the whole table would delete
          // the user's own key on restore. Only the backup-safe rows go.
          await target.kv.filter((row) => isBackupSafeKvKey(row.key)).delete()
        }
        await target.games.bulkPut(data.games)
        await target.moves.bulkPut(data.moves)
        await target.attempts.bulkPut(data.attempts)
        await target.srsCards.bulkPut(data.srsCards)
        await target.mistakes.bulkPut(data.mistakes)
        await target.packs.bulkPut(data.packs)
        await target.lessonsProgress.bulkPut(data.lessonsProgress)
        await target.repertoire.bulkPut(data.repertoire)
        await target.sessions.bulkPut(data.sessions)
        await target.kv.bulkPut(data.kv)
        if (data.settings !== null) {
          await target.settings.put({ id: SETTINGS_ROW_ID, value: data.settings })
        }
        if (data.profile !== null) await target.profile.put(data.profile)
      },
    )
  } catch (error: unknown) {
    return err(
      domainError('io', 'Could not write the restored data', {
        where: 'backup.restoreBackup',
        cause: error,
      }),
    )
  }

  return ok({
    counts: {
      games: data.games.length,
      moves: data.moves.length,
      attempts: data.attempts.length,
      srsCards: data.srsCards.length,
      mistakes: data.mistakes.length,
      packs: data.packs.length,
      lessonsProgress: data.lessonsProgress.length,
      repertoire: data.repertoire.length,
      sessions: data.sessions.length,
      kv: data.kv.length,
    },
    hasSettings: data.settings !== null,
    hasProfile: data.profile !== null,
    skipped: [],
  })
}

/** Why exported: S23's "clear all" is a destructive flow that must not be
 * reimplemented per screen, and it has to leave the vault behind too. */
export async function clearAllData(target: ChessKingDb = appDb): Promise<Result<void>> {
  try {
    await target.transaction('rw', target.tables, async () => {
      await Promise.all(target.tables.map((table) => table.clear()))
    })
    return ok(undefined)
  } catch (error: unknown) {
    return err(
      domainError('io', 'Could not clear the database', {
        where: 'backup.clearAllData',
        cause: error,
      }),
    )
  }
}
