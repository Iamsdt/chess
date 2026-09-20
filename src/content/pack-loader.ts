import {
  err,
  type ContentPack,
  type ContentPackSource,
  type Result,
  type Timestamp,
} from '@/domain'

import {
  parseContentPackText,
  type PackValidationReport,
  type LoadContentPackOptions,
} from './pack-file'

/**
 * Getting a pack file into the app.
 *
 * Both entry points end in the same validator, so a pack dropped on the import
 * dialog and a pack fetched from a URL fail in exactly the same words.
 */

/** Just enough of `File` to be satisfied by a test double as well as by the DOM. */
export interface PackFileLike {
  readonly name: string
  text: () => Promise<string>
}

export interface ImportPackOptions {
  /** Defaults to `imported`; the builtin packs pass `builtin`. */
  readonly source?: ContentPackSource | undefined
  readonly now?: (() => Timestamp) | undefined
  /** Keeps the original install date when re-importing an update of a pack. */
  readonly importedAt?: Timestamp | undefined
  readonly signal?: AbortSignal | undefined
  readonly fetchImpl?: typeof fetch | undefined
}

function toLoadOptions(where: string, options: ImportPackOptions): LoadContentPackOptions {
  return {
    where,
    source: options.source ?? 'imported',
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.importedAt === undefined ? {} : { importedAt: options.importedAt }),
  }
}

export async function importContentPackFromFile(
  file: PackFileLike,
  options: ImportPackOptions = {},
): Promise<Result<ContentPack, PackValidationReport>> {
  let text: string
  try {
    text = await file.text()
  } catch (cause) {
    return err({
      where: file.name,
      problems: [problemFrom(`Could not read the file`, cause)],
    })
  }
  return parseContentPackText(text, toLoadOptions(file.name, options))
}

export async function importContentPackFromUrl(
  url: string,
  options: ImportPackOptions = {},
): Promise<Result<ContentPack, PackValidationReport>> {
  const fetchImpl = options.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(
      url,
      options.signal === undefined ? {} : { signal: options.signal },
    )
    if (!response.ok) {
      return err({
        where: url,
        problems: [{ path: '(url)', message: `HTTP ${String(response.status)}` }],
      })
    }
    const text = await response.text()
    return parseContentPackText(text, toLoadOptions(url, options))
  } catch (cause) {
    return err({ where: url, problems: [problemFrom('Could not download the pack', cause)] })
  }
}

/** Why: a thrown value is `unknown`; the report needs one readable line from it. */
function problemFrom(prefix: string, cause: unknown): { path: string; message: string } {
  const detail = cause instanceof Error ? cause.message : String(cause)
  return { path: '(file)', message: `${prefix}: ${detail}` }
}
