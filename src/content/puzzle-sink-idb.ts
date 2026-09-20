import { z } from 'zod'

import { DIFFICULTIES, PUZZLE_BANDS, domainError, err, ok, parseValid, type Result } from '@/domain'

import {
  CONTENT_META_KEY_PATH,
  CONTENT_META_STORE_NAME,
  PUZZLE_IMPORT_STATE_KEY,
  PUZZLE_INDEXES,
  PUZZLE_KEY_PATH,
  PUZZLE_STORE_NAME,
  PuzzleImportStateSchema,
  emptyStats,
  type PuzzleImportState,
  type PuzzleSink,
  type PuzzleStoreStats,
} from './puzzle-sink'

/**
 * A `PuzzleSink` on raw IndexedDB.
 *
 * Why it exists when S05 owns persistence: the importer needs a real store to be
 * tested against — `fake-indexeddb` in unit tests, the browser's own in the `/dev`
 * tools — and writing it here proves the port can be satisfied without Dexie.
 * The app's sink is S05's Dexie adapter; this one never touches the `chessking`
 * database, and the store and index names below are the contract between them.
 */

const DEFAULT_DATABASE_NAME = 'chessking-content'
const DATABASE_VERSION = 1

/** The stored envelope: `contentMeta` rows are `{ key, value }`, whatever the value is. */
const ImportStateRowSchema = z.object({
  key: z.literal(PUZZLE_IMPORT_STATE_KEY),
  value: PuzzleImportStateSchema,
})

/** Why: `IDBRequest` predates promises and every call site would otherwise repeat this. */
function fromRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    }
  })
}

function fromTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    }
  })
}

/** The schema S05's Dexie version must match, spelled out once so both sides agree. */
export function createContentStores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(PUZZLE_STORE_NAME)) {
    const store = database.createObjectStore(PUZZLE_STORE_NAME, { keyPath: PUZZLE_KEY_PATH })
    for (const index of PUZZLE_INDEXES) store.createIndex(index, index, { unique: false })
    // S14 walks the curriculum band by band and sub-level by sub-level.
    store.createIndex('band+subLevel', ['band', 'subLevel'], { unique: false })
  }
  if (!database.objectStoreNames.contains(CONTENT_META_STORE_NAME)) {
    database.createObjectStore(CONTENT_META_STORE_NAME, { keyPath: CONTENT_META_KEY_PATH })
  }
}

export interface OpenPuzzleDatabaseOptions {
  readonly databaseName?: string | undefined
  /** Injected by tests running on `fake-indexeddb`. */
  readonly factory?: IDBFactory | undefined
}

export async function openPuzzleDatabase(
  options: OpenPuzzleDatabaseOptions = {},
): Promise<Result<IDBDatabase>> {
  const factory = options.factory ?? globalThis.indexedDB
  try {
    const request = factory.open(options.databaseName ?? DEFAULT_DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      createContentStores(request.result)
    }
    return ok(await fromRequest(request))
  } catch (cause) {
    // Also the path taken where there is no IndexedDB at all, such as a worker in a
    // private window; there is nothing the caller can do differently either way.
    return err(domainError('io', 'Could not open the content database', { cause }))
  }
}

async function countIndex(database: IDBDatabase, index: string, key: string): Promise<number> {
  const transaction = database.transaction(PUZZLE_STORE_NAME, 'readonly')
  const store = transaction.objectStore(PUZZLE_STORE_NAME)
  return fromRequest(store.index(index).count(IDBKeyRange.only(key)))
}

async function countThemes(database: IDBDatabase): Promise<Record<string, number>> {
  const transaction = database.transaction(PUZZLE_STORE_NAME, 'readonly')
  const store = transaction.objectStore(PUZZLE_STORE_NAME)
  const cursorRequest = store.index('theme').openKeyCursor()
  const byTheme: Record<string, number> = {}
  await new Promise<void>((resolve, reject) => {
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor === null) {
        resolve()
        return
      }
      // Themes index as strings; anything else is not a theme and is not counted.
      const theme = cursor.key
      if (typeof theme === 'string') byTheme[theme] = (byTheme[theme] ?? 0) + 1
      cursor.continue()
    }
    cursorRequest.onerror = () => {
      reject(cursorRequest.error ?? new Error('Could not read the theme index'))
    }
  })
  return byTheme
}

/** Wrap a rejected IndexedDB promise in the `Result` the port promises. */
function ioError(message: string, cause: unknown): Result<never> {
  return err(domainError('io', message, { cause }))
}

export function createIndexedDbPuzzleSink(database: IDBDatabase): PuzzleSink {
  return {
    async putPuzzles(puzzles) {
      if (puzzles.length === 0) return ok({ written: 0 })
      try {
        const transaction = database.transaction(PUZZLE_STORE_NAME, 'readwrite')
        const store = transaction.objectStore(PUZZLE_STORE_NAME)
        // `put` upserts on the key path, which is why a re-import cannot duplicate.
        for (const puzzle of puzzles) store.put(puzzle)
        await fromTransaction(transaction)
        return ok({ written: puzzles.length })
      } catch (cause) {
        return ioError('Could not write puzzles', cause)
      }
    },

    async readImportState() {
      try {
        const transaction = database.transaction(CONTENT_META_STORE_NAME, 'readonly')
        const store = transaction.objectStore(CONTENT_META_STORE_NAME)
        const row: unknown = await fromRequest(store.get(PUZZLE_IMPORT_STATE_KEY))
        if (row === undefined || row === null) return ok(null)
        const parsed = parseValid(ImportStateRowSchema, row, 'puzzle import state')
        if (!parsed.ok) return parsed
        return ok(parsed.value.value)
      } catch (cause) {
        return ioError('Could not read the import state', cause)
      }
    },

    async writeImportState(state: PuzzleImportState) {
      try {
        const transaction = database.transaction(CONTENT_META_STORE_NAME, 'readwrite')
        const store = transaction.objectStore(CONTENT_META_STORE_NAME)
        store.put({ key: PUZZLE_IMPORT_STATE_KEY, value: state })
        await fromTransaction(transaction)
        return ok(undefined)
      } catch (cause) {
        return ioError('Could not write the import state', cause)
      }
    },

    async stats(): Promise<Result<PuzzleStoreStats>> {
      try {
        const counting = database.transaction(PUZZLE_STORE_NAME, 'readonly')
        const total = await fromRequest(counting.objectStore(PUZZLE_STORE_NAME).count())
        const byBand = { ...emptyStats().byBand }
        for (const band of PUZZLE_BANDS) {
          byBand[band] = await countIndex(database, 'band', band)
        }
        const byDifficulty = { ...emptyStats().byDifficulty }
        for (const difficulty of DIFFICULTIES) {
          byDifficulty[difficulty] = await countIndex(database, 'difficulty', difficulty)
        }
        const byTheme = await countThemes(database)
        return ok({ total, byBand, byDifficulty, byTheme })
      } catch (cause) {
        return ioError('Could not read puzzle statistics', cause)
      }
    },
  }
}
