import { z } from 'zod'

import { PuzzleBandSchema, parseValid, type PuzzleBand, type Result } from '@/domain'

/**
 * `public/quiz/index.json`: the content manifest.
 *
 * Why a version per band and not only a global one: a content update usually
 * touches one band, and re-importing the other 9,000 puzzles to pick up 200 new
 * ones is minutes of a user's battery for nothing.
 */
export const QuizManifestSchema = z.object({
  /** Bumped when the *set* of bands changes; the per-band numbers drive re-import. */
  version: z.number().int().min(1),
  /**
   * A record keyed by the band enum, which zod requires to be exhaustive — a
   * manifest missing a band is rejected here rather than silently importing
   * five-sixths of the curriculum.
   */
  bands: z.record(PuzzleBandSchema, z.number().int().min(1)),
})
export type QuizManifest = z.infer<typeof QuizManifestSchema>

/** Where the band files live when nothing says otherwise. */
export const DEFAULT_QUIZ_BASE_URL = '/quiz'

export const quizManifestUrl = (baseUrl: string = DEFAULT_QUIZ_BASE_URL): string =>
  `${baseUrl}/index.json`

export const bandCsvUrl = (band: PuzzleBand, baseUrl: string = DEFAULT_QUIZ_BASE_URL): string =>
  `${baseUrl}/band_${band}.csv`

/** Why: `index.json` is fetched, so it is `unknown` until a schema says otherwise. */
export function parseQuizManifest(value: unknown, where: string): Result<QuizManifest> {
  return parseValid(QuizManifestSchema, value, where)
}

/** The version a band must match to count as already imported. */
export function bandVersion(manifest: QuizManifest, band: PuzzleBand): number {
  return manifest.bands[band]
}
