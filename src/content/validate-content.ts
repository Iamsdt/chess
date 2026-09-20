import { PUZZLE_BANDS, ok, type PuzzleBand, type Result, type Timestamp } from '@/domain'

import { bandCsvUrl, parseQuizManifest, quizManifestUrl } from './manifest'
import { parseContentPackText } from './pack-file'
import { createInlinePuzzleParser, type CsvChunkSource } from './puzzle-parser'
import { formatSkippedRow, type SkippedPuzzleRow } from './puzzle-row'
import { DEFAULT_TUTORIAL_BASE_URL, loadTutorialPack } from './tutorial-pack'

import type { PackProblem } from './pack-file'

/**
 * The check `npm run content:validate` runs.
 *
 * Why it lives in `src/content` and not in the script: this is the same parsing,
 * the same schemas and the same conversion the app uses, and a validator that
 * re-implemented any of them would pass while the app failed. The script is a
 * thin shell that gives this function a way to read files and prints what comes
 * back.
 */

export interface ContentValidationOptions {
  /** Read a URL-shaped path as text. The CLI maps it onto `public/`. */
  readonly readText: (url: string) => Promise<Result<string>>
  readonly quizBaseUrl?: string | undefined
  readonly tutorialBaseUrl?: string | undefined
  /** Extra pack files to validate, e.g. one passed on the command line. */
  readonly packPaths?: readonly string[] | undefined
  readonly now?: (() => Timestamp) | undefined
  /** Called with one line per finished step, so the CLI can stream output. */
  readonly onProgress?: ((line: string) => void) | undefined
}

export interface BandValidation {
  readonly band: PuzzleBand
  readonly rowsRead: number
  readonly valid: number
  readonly skipped: readonly SkippedPuzzleRow[]
}

export interface PackValidation {
  readonly where: string
  readonly name: string
  readonly lessons: number
  readonly puzzles: number
  readonly problems: readonly PackProblem[]
}

export interface ContentValidationReport {
  readonly ok: boolean
  readonly bands: readonly BandValidation[]
  readonly rowsRead: number
  readonly puzzlesValid: number
  readonly skipped: readonly SkippedPuzzleRow[]
  /** Ids that appear in more than one row; a duplicate would shadow a puzzle. */
  readonly duplicateIds: readonly string[]
  readonly packs: readonly PackValidation[]
  /** Failures that stopped a check running at all (missing file, bad manifest). */
  readonly errors: readonly string[]
}

const CHUNK_SIZE = 64 * 1024

/** Why chunked rather than one string: it exercises the streaming path the app uses. */
function chunksOf(text: string): string[] {
  const chunks: string[] = []
  for (let index = 0; index < text.length; index += CHUNK_SIZE) {
    chunks.push(text.slice(index, index + CHUNK_SIZE))
  }
  return chunks.length === 0 ? [''] : chunks
}

export async function validateContent(
  options: ContentValidationOptions,
): Promise<ContentValidationReport> {
  const { readText, onProgress } = options
  const quizBaseUrl = options.quizBaseUrl ?? '/quiz'
  const tutorialBaseUrl = options.tutorialBaseUrl ?? DEFAULT_TUTORIAL_BASE_URL

  const errors: string[] = []
  const bands: BandValidation[] = []
  const skipped: SkippedPuzzleRow[] = []
  const packs: PackValidation[] = []
  const seenIds = new Set<string>()
  const duplicateIds = new Set<string>()
  let rowsRead = 0
  let puzzlesValid = 0

  const source: CsvChunkSource = async (url) => {
    const text = await readText(url)
    if (!text.ok) return text
    return ok(chunksOf(text.value))
  }
  const parser = createInlinePuzzleParser(source)

  const manifestUrl = quizManifestUrl(quizBaseUrl)
  const manifestText = await readText(manifestUrl)
  if (!manifestText.ok) {
    errors.push(`${manifestUrl}: ${manifestText.error.message}`)
  } else {
    let manifestBody: unknown
    try {
      manifestBody = JSON.parse(manifestText.value)
    } catch (cause) {
      manifestBody = undefined
      errors.push(
        `${manifestUrl}: not valid JSON (${cause instanceof Error ? cause.message : 'unknown'})`,
      )
    }
    const manifest = parseQuizManifest(manifestBody, manifestUrl)
    if (!manifest.ok) {
      errors.push(`${manifestUrl}: ${manifest.error.message}`)
      for (const detail of manifest.error.details ?? []) errors.push(`  ${detail}`)
    } else {
      onProgress?.(
        `manifest v${String(manifest.value.version)} · ${String(PUZZLE_BANDS.length)} bands`,
      )
    }
  }

  for (const band of PUZZLE_BANDS) {
    const bandSkipped: SkippedPuzzleRow[] = []
    let valid = 0
    const parsed = await parser.parseBand({ band, url: bandCsvUrl(band, quizBaseUrl) }, (batch) => {
      for (const puzzle of batch.puzzles) {
        if (seenIds.has(puzzle.id)) duplicateIds.add(puzzle.id)
        seenIds.add(puzzle.id)
      }
      valid += batch.puzzles.length
    })
    if (!parsed.ok) {
      errors.push(`band_${band}.csv: ${parsed.error.message}`)
      for (const detail of parsed.error.details ?? []) errors.push(`  ${detail}`)
      continue
    }
    bandSkipped.push(...parsed.value.skipped)
    skipped.push(...parsed.value.skipped)
    rowsRead += parsed.value.rowsRead
    puzzlesValid += valid
    bands.push({ band, rowsRead: parsed.value.rowsRead, valid, skipped: bandSkipped })
    onProgress?.(
      `band_${band}.csv · ${String(valid)}/${String(parsed.value.rowsRead)} rows valid` +
        (bandSkipped.length === 0 ? '' : ` · ${String(bandSkipped.length)} skipped`),
    )
  }

  const tutorials = await loadTutorialPack({
    baseUrl: tutorialBaseUrl,
    fetchJson: async (url) => {
      const text = await readText(url)
      if (!text.ok) return text
      const body: unknown = JSON.parse(text.value)
      return ok(body)
    },
    ...(options.now === undefined ? {} : { now: options.now }),
  })
  if (tutorials.ok) {
    const { pack, problems } = tutorials.value
    packs.push({
      where: `${tutorialBaseUrl}/index.json`,
      name: pack.name,
      lessons: pack.lessons.length,
      puzzles: pack.puzzles.length,
      problems,
    })
    onProgress?.(
      `${pack.name} · ${String(pack.lessons.length)} lessons` +
        (problems.length === 0 ? '' : ` · ${String(tutorials.value.skipped.length)} not converted`),
    )
  } else {
    packs.push({
      where: tutorials.error.where,
      name: 'Chess King tutorials',
      lessons: 0,
      puzzles: 0,
      problems: tutorials.error.problems,
    })
  }

  for (const path of options.packPaths ?? []) {
    const text = await readText(path)
    if (!text.ok) {
      packs.push({
        where: path,
        name: path,
        lessons: 0,
        puzzles: 0,
        problems: [{ path: '(file)', message: text.error.message }],
      })
      continue
    }
    const pack = parseContentPackText(text.value, {
      where: path,
      source: 'imported',
      ...(options.now === undefined ? {} : { now: options.now }),
    })
    if (pack.ok) {
      packs.push({
        where: path,
        name: pack.value.name,
        lessons: pack.value.lessons.length,
        puzzles: pack.value.puzzles.length,
        problems: [],
      })
      onProgress?.(`${path} · ${pack.value.name}`)
    } else {
      packs.push({ where: path, name: path, lessons: 0, puzzles: 0, problems: pack.error.problems })
    }
  }

  const valid =
    errors.length === 0 &&
    skipped.length === 0 &&
    duplicateIds.size === 0 &&
    packs.every((pack) => pack.problems.length === 0)

  return {
    ok: valid,
    bands,
    rowsRead,
    puzzlesValid,
    skipped,
    duplicateIds: [...duplicateIds],
    packs,
    errors,
  }
}

/** Why: the CLI and the dev panel print the same failure list. */
export function formatContentFailures(report: ContentValidationReport): string[] {
  const lines: string[] = []
  for (const error of report.errors) lines.push(error)
  for (const row of report.skipped) lines.push(formatSkippedRow(row))
  for (const id of report.duplicateIds) lines.push(`duplicate puzzle id ${id}`)
  for (const pack of report.packs) {
    for (const problem of pack.problems)
      lines.push(`${pack.where}: ${problem.path} — ${problem.message}`)
  }
  return lines
}
