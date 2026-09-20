import { type z } from 'zod'

import {
  CONTENT_PACK_FORMAT_VERSION,
  ContentPackSchema,
  contentPackItemCountMatches,
  err,
  now as nowTimestamp,
  ok,
  toValidationIssues,
  type ContentPack,
  type ContentPackSource,
  type Result,
  type Timestamp,
} from '@/domain'

/**
 * The pack *file* format, and the readable report a bad one produces.
 *
 * Why the file is not simply a `ContentPack`: `source`, `importedAt` and
 * `updatedAt` describe this installation's copy of a pack, not the pack, and a
 * file that claimed them would let an author backdate their own import.
 */
export const ContentPackFileSchema = ContentPackSchema.omit({
  source: true,
  importedAt: true,
  updatedAt: true,
})
export type ContentPackFile = z.infer<typeof ContentPackFileSchema>

/** One problem, in the words the import dialog shows. */
export interface PackProblem {
  /** Dotted field path, e.g. `lessons[2].steps[0].fen`. */
  readonly path: string
  readonly message: string
}

export interface PackValidationReport {
  /** The file name or URL, so the dialog can say which pack failed. */
  readonly where: string
  readonly problems: readonly PackProblem[]
}

/** Why: the dialog, the CLI and the console all print the same report. */
export function formatPackReport(report: PackValidationReport): string {
  const count =
    report.problems.length === 1 ? '1 problem' : `${String(report.problems.length)} problems`
  const lines = report.problems.map((problem) => `  • ${problem.path} — ${problem.message}`)
  return [`${report.where}: ${count}`, ...lines].join('\n')
}

const problem = (path: string, message: string): PackProblem => ({ path, message })

export interface LoadContentPackOptions {
  /** File name or URL; appears at the top of the report. */
  readonly where: string
  /** How this copy arrived. `builtin` for the packs that ship with the app. */
  readonly source: ContentPackSource
  readonly now?: (() => Timestamp) | undefined
  /** Preserved across a re-import so "imported on" does not reset on every update. */
  readonly importedAt?: Timestamp | undefined
}

/**
 * Validate a parsed pack file and stamp it as installed.
 *
 * Checks the schema cannot express are made here rather than in S03's schema,
 * because they are about a *file* being coherent, not about a `ContentPack` being
 * well-typed: a format version from the future, an `itemCount` that lies, and
 * duplicate ids inside the pack.
 */
export function loadContentPack(
  value: unknown,
  options: LoadContentPackOptions,
): Result<ContentPack, PackValidationReport> {
  const { where, source, now = nowTimestamp } = options

  const parsed = ContentPackFileSchema.safeParse(value)
  if (!parsed.success) {
    return err({
      where,
      problems: toValidationIssues(parsed.error).map((issue) => problem(issue.path, issue.message)),
    })
  }

  const file = parsed.data
  const problems: PackProblem[] = []

  if (file.formatVersion > CONTENT_PACK_FORMAT_VERSION) {
    problems.push(
      problem(
        'formatVersion',
        `This pack needs a newer version of Chess King (pack format ${String(file.formatVersion)}, this app reads ${String(CONTENT_PACK_FORMAT_VERSION)})`,
      ),
    )
  }

  const lessonIds = new Set<string>()
  for (const [index, lesson] of file.lessons.entries()) {
    if (lessonIds.has(lesson.id)) {
      problems.push(problem(`lessons[${String(index)}].id`, `Duplicate lesson id ${lesson.id}`))
    }
    lessonIds.add(lesson.id)
    for (const [stepIndex, step] of lesson.steps.entries()) {
      if (step.index !== stepIndex) {
        problems.push(
          problem(
            `lessons[${String(index)}].steps[${String(stepIndex)}].index`,
            `Step index ${String(step.index)} is out of order; expected ${String(stepIndex)}`,
          ),
        )
      }
    }
  }

  const puzzleIds = new Set<string>()
  for (const [index, puzzle] of file.puzzles.entries()) {
    if (puzzleIds.has(puzzle.id)) {
      problems.push(problem(`puzzles[${String(index)}].id`, `Duplicate puzzle id ${puzzle.id}`))
    }
    puzzleIds.add(puzzle.id)
  }

  const timestamp = now()
  const pack: ContentPack = {
    ...file,
    source,
    // A pack's puzzles belong to it; stamping here is what lets "remove pack"
    // find them again later.
    puzzles: file.puzzles.map((puzzle) => ({ ...puzzle, packId: file.id })),
    importedAt: options.importedAt ?? timestamp,
    updatedAt: timestamp,
  }

  if (!contentPackItemCountMatches(pack)) {
    problems.push(
      problem(
        'itemCount',
        `Says ${String(file.itemCount)} items but carries ${String(file.lessons.length + file.puzzles.length)}`,
      ),
    )
  }

  if (problems.length > 0) return err({ where, problems })
  return ok(pack)
}

/** Why: every entry point ends up with text, and JSON failures need the same report. */
export function parseContentPackText(
  text: string,
  options: LoadContentPackOptions,
): Result<ContentPack, PackValidationReport> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (cause) {
    return err({
      where: options.where,
      problems: [
        problem('(file)', `Not valid JSON: ${cause instanceof Error ? cause.message : 'unknown'}`),
      ],
    })
  }
  return loadContentPack(value, options)
}
