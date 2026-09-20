import { z } from 'zod'

import {
  CONTENT_PACK_FORMAT_VERSION,
  ColorSchema,
  LessonSchema,
  START_FEN,
  SanSchema,
  SquareSchema,
  domainError,
  err,
  ok,
  toLessonId,
  toLessonStepId,
  toPackId,
  toTrackId,
  toValidationIssues,
  type Arrow,
  type ArrowKind,
  type ContentPack,
  type ContentPackSource,
  type Difficulty,
  type Fen,
  type Lesson,
  type LessonStep,
  type Result,
  type Square,
  type Timestamp,
} from '@/domain'

import { loadContentPack, type PackProblem, type PackValidationReport } from './pack-file'
import { createChessJsReplay, type SanReplay } from './san-replay'

/**
 * The 49 shipped tutorials, as a content pack.
 *
 * Why converted at load time rather than checked in as a built pack file: the
 * tutorials in `public/tutorial/` are the source of truth and they are not mine to
 * rewrite, and a conversion that runs (and is tested, and is checked by
 * `npm run content:validate`) can never drift from them the way a generated file
 * would. The conversion is deterministic, so the result is cacheable.
 *
 * Two shape mismatches are resolved here, both deliberately:
 *
 * - A tutorial step is a *move in a line*, either the player's or the opponent's
 *   reply, and carries no position. `LessonStep` needs a FEN, so the line is
 *   replayed and each step keeps the position it starts from.
 * - `LessonStepKind` has no "the opponent replies now" value. An opponent move
 *   becomes an `info` step at the position before it, with the reply drawn as a
 *   `threat` arrow, so its commentary survives and the player is never asked to
 *   play the opponent's move.
 */

export const TUTORIAL_PACK_ID = toPackId('chessking-tutorials')
export const DEFAULT_TUTORIAL_BASE_URL = '/tutorial'

/** The app's own content ships under the app's own licence. */
export const TUTORIAL_PACK_LICENCE = 'MIT'

const TutorialArrowSchema = z.object({
  from: z.string(),
  to: z.string(),
  color: z.string().optional(),
})

const TutorialStepSchema = z.object({
  actor: z.enum(['player', 'opponent']),
  san: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string().min(1),
  coaching: z.string().optional(),
  hint: z.string().optional(),
  arrows: z.array(TutorialArrowSchema).optional(),
  focusSquares: z.array(z.string()).optional(),
})

export const TutorialFileSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('tutorial'),
  slug: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().default(''),
  objectives: z.array(z.string()).default(() => []),
  plans: z.array(z.string()).default(() => []),
  commonMistakes: z.array(z.string()).default(() => []),
  completionTitle: z.string().default(''),
  completionSummary: z.string().default(''),
  defaultOrientation: ColorSchema.default('white'),
  steps: z.array(TutorialStepSchema).min(1),
})
export type TutorialFile = z.infer<typeof TutorialFileSchema>

export const TutorialIndexSchema = z.object({
  version: z.number().int().min(1),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        tags: z.array(z.string()).default(() => []),
        /** Absolute path from the site root, e.g. `/tutorial/back-rank-mate.json`. */
        file: z.string().min(1),
      }),
    )
    .min(1),
})
export type TutorialIndex = z.infer<typeof TutorialIndexSchema>

/**
 * The tutorials use a four-value scale; the domain has three.
 *
 * Why `club` becomes `intermediate`: the band CSVs label the same 1400–1800
 * rating range `Club`, and `Difficulty` calls that range intermediate.
 */
const DIFFICULTY_BY_TUTORIAL_LABEL: Readonly<Record<string, Difficulty>> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  club: 'intermediate',
  advanced: 'advanced',
}

/** The prototype's sky arrow is the move to find; its green one is Sage pointing. */
const ARROW_KIND_BY_COLOUR: Readonly<Record<string, ArrowKind>> = {
  '#22c55e': 'sage',
}

/** Roughly four steps a minute, which is what the 49 tutorials play out at. */
const STEPS_PER_MINUTE = 4

const problem = (path: string, message: string): PackProblem => ({ path, message })

function bulletList(title: string, items: readonly string[]): string {
  if (items.length === 0) return ''
  return [`${title}:`, ...items.map((item) => `• ${item}`)].join('\n')
}

function paragraphs(...parts: readonly string[]): string | undefined {
  const text = parts.filter((part) => part.trim() !== '').join('\n\n')
  return text === '' ? undefined : text
}

function arrowsOf(
  raw: readonly z.infer<typeof TutorialArrowSchema>[] | undefined,
  path: string,
  problems: PackProblem[],
): Arrow[] {
  const arrows: Arrow[] = []
  for (const [index, entry] of (raw ?? []).entries()) {
    const from = SquareSchema.safeParse(entry.from)
    const to = SquareSchema.safeParse(entry.to)
    if (!from.success || !to.success) {
      problems.push(problem(`${path}.arrows[${String(index)}]`, 'Not a pair of board squares'))
      continue
    }
    const kind: ArrowKind = ARROW_KIND_BY_COLOUR[entry.color ?? ''] ?? 'best'
    arrows.push({ from: from.data, to: to.data, kind })
  }
  return arrows
}

function squaresOf(
  raw: readonly string[] | undefined,
  path: string,
  problems: PackProblem[],
): Square[] {
  const squares: Square[] = []
  for (const [index, value] of (raw ?? []).entries()) {
    const parsed = SquareSchema.safeParse(value)
    if (!parsed.success) {
      problems.push(problem(`${path}.focusSquares[${String(index)}]`, `${value} is not a square`))
      continue
    }
    squares.push(parsed.data)
  }
  return squares
}

/**
 * One tutorial becomes one lesson, or a list of problems naming the step.
 *
 * `replay` is the SAN→position port: the tutorials are lines of moves, and this is
 * the only thing in the conversion that needs the rules of chess.
 */
export function tutorialToLesson(
  value: unknown,
  options: {
    readonly where: string
    readonly themes?: readonly string[] | undefined
    readonly replay?: SanReplay | undefined
  },
): Result<Lesson, PackValidationReport> {
  const { where } = options
  const replay = options.replay ?? createChessJsReplay()

  const parsed = TutorialFileSchema.safeParse(value)
  if (!parsed.success) {
    return err({
      where,
      problems: toValidationIssues(parsed.error).map((issue) => problem(issue.path, issue.message)),
    })
  }
  const tutorial = parsed.data
  const problems: PackProblem[] = []

  const orientation = tutorial.defaultOrientation
  const lessonId = toLessonId(tutorial.id)
  const steps: LessonStep[] = []
  const stepId = (suffix: string): LessonStep['id'] => toLessonStepId(`${tutorial.id}:${suffix}`)

  const intro = paragraphs(
    tutorial.description,
    bulletList('What you will learn', tutorial.objectives),
    bulletList('Plans', tutorial.plans),
    bulletList('Watch out for', tutorial.commonMistakes),
  )
  steps.push({
    id: stepId('intro'),
    index: 0,
    kind: 'info',
    fen: START_FEN,
    orientation,
    prompt: tutorial.title,
    ...(intro === undefined ? {} : { text: intro }),
    expectedMoves: [],
    alternativeMoves: [],
    focusSquares: [],
    arrows: [],
    marks: [],
    hints: [],
  })

  let position: Fen = START_FEN
  for (const [index, step] of tutorial.steps.entries()) {
    const path = `steps[${String(index)}]`
    const played = replay(position, step.san)
    if (!played.ok) {
      problems.push(problem(`${path}.san`, played.error.message))
      break
    }

    const san = SanSchema.safeParse(played.value.san)
    if (!san.success) {
      problems.push(
        problem(`${path}.san`, `${played.value.san} is not standard algebraic notation`),
      )
      break
    }

    const text = paragraphs(step.instruction, step.coaching ?? '')
    const isPlayerMove = step.actor === 'player'
    const arrows: Arrow[] = isPlayerMove
      ? arrowsOf(step.arrows, path, problems)
      : // The opponent's reply is shown, not asked for.
        [{ from: played.value.from, to: played.value.to, kind: 'threat' }]

    steps.push({
      id: stepId(String(index)),
      index: steps.length,
      kind: isPlayerMove ? 'move' : 'info',
      fen: position,
      orientation,
      prompt: step.title,
      ...(text === undefined ? {} : { text }),
      expectedMoves: isPlayerMove ? [san.data] : [],
      alternativeMoves: [],
      focusSquares: squaresOf(step.focusSquares, path, problems),
      arrows,
      marks: [],
      hints: step.hint === undefined ? [] : [step.hint],
    })

    position = played.value.fen
  }

  const completion = paragraphs(tutorial.completionSummary)
  steps.push({
    id: stepId('complete'),
    index: steps.length,
    kind: 'info',
    fen: position,
    orientation,
    prompt: tutorial.completionTitle === '' ? 'Lesson complete' : tutorial.completionTitle,
    ...(completion === undefined ? {} : { text: completion }),
    expectedMoves: [],
    alternativeMoves: [],
    focusSquares: [],
    arrows: [],
    marks: [],
    hints: [],
  })

  const difficulty = DIFFICULTY_BY_TUTORIAL_LABEL[tutorial.difficulty]
  if (difficulty === undefined) {
    problems.push(problem('difficulty', `Unknown difficulty ${tutorial.difficulty}`))
  }

  if (problems.length > 0 || difficulty === undefined) return err({ where, problems })

  const themes = [...new Set([tutorial.category, ...(options.themes ?? [])])]
  const lesson: unknown = {
    id: lessonId,
    packId: TUTORIAL_PACK_ID,
    trackId: toTrackId(tutorial.category),
    title: tutorial.title,
    summary: tutorial.summary,
    difficulty,
    estimatedMinutes: Math.max(2, Math.ceil(tutorial.steps.length / STEPS_PER_MINUTE)),
    themes,
    prerequisites: [],
    steps,
    version: 1,
  }

  const validated = LessonSchema.safeParse(lesson)
  if (!validated.success) {
    return err({
      where,
      problems: toValidationIssues(validated.error).map((issue) =>
        problem(issue.path, issue.message),
      ),
    })
  }
  return ok(validated.data)
}

export interface TutorialPackLoad {
  readonly pack: ContentPack
  /**
   * Tutorials that could not be converted, one entry per problem.
   *
   * Why the pack still loads: 19 of the 48 shipped tutorials currently stop
   * replaying part-way through (their lines were authored by hand and drifted),
   * and refusing to load any lessons because of them would take the working 29
   * down with them. `npm run content:validate` treats a non-empty list as a
   * failure, so the defect is loud without being fatal at run time.
   */
  readonly problems: readonly PackProblem[]
  /** The ids left out of the pack. */
  readonly skipped: readonly string[]
}

export interface LoadTutorialPackOptions {
  readonly baseUrl?: string | undefined
  /** Injected so the CLI can read the files from disk and tests from memory. */
  readonly fetchJson?: ((url: string) => Promise<Result<unknown>>) | undefined
  readonly replay?: SanReplay | undefined
  readonly now?: (() => Timestamp) | undefined
  readonly source?: ContentPackSource | undefined
}

const fetchJsonDefault = async (url: string): Promise<Result<unknown>> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return err(
        domainError('io', `Could not read ${url} (HTTP ${String(response.status)})`, {
          where: url,
        }),
      )
    }
    const body: unknown = await response.json()
    return ok(body)
  } catch (cause) {
    return err(domainError('network', `Could not read ${url}`, { where: url, cause }))
  }
}

/**
 * Build the builtin lesson pack from `public/tutorial/`.
 *
 * Fails only when the index itself cannot be read or nothing converts; a single
 * broken tutorial is reported and left out. The caller decides what that means —
 * the CLI validator makes it an error, the app logs it and carries on.
 */
export async function loadTutorialPack(
  options: LoadTutorialPackOptions = {},
): Promise<Result<TutorialPackLoad, PackValidationReport>> {
  const baseUrl = options.baseUrl ?? DEFAULT_TUTORIAL_BASE_URL
  const fetchJson = options.fetchJson ?? fetchJsonDefault
  const replay = options.replay ?? createChessJsReplay()
  const indexUrl = `${baseUrl}/index.json`

  const body = await fetchJson(indexUrl)
  if (!body.ok) {
    return err({ where: indexUrl, problems: [problem('(url)', body.error.message)] })
  }
  const index = TutorialIndexSchema.safeParse(body.value)
  if (!index.success) {
    return err({
      where: indexUrl,
      problems: toValidationIssues(index.error).map((issue) => problem(issue.path, issue.message)),
    })
  }

  const lessons: Lesson[] = []
  const problems: PackProblem[] = []
  const skipped: string[] = []

  for (const item of index.data.items) {
    // The index stores site-absolute paths; only the file name is meaningful when the
    // pack is read from disk by the CLI or from a fixture by a test.
    const fileName = item.file.split('/').pop() ?? item.file
    const url = `${baseUrl}/${fileName}`
    const file = await fetchJson(url)
    if (!file.ok) {
      problems.push(problem(item.id, file.error.message))
      skipped.push(item.id)
      continue
    }
    const lesson = tutorialToLesson(file.value, { where: url, themes: item.tags, replay })
    if (!lesson.ok) {
      problems.push(
        ...lesson.error.problems.map((entry) => problem(`${item.id}.${entry.path}`, entry.message)),
      )
      skipped.push(item.id)
      continue
    }
    lessons.push(lesson.value)
  }

  if (lessons.length === 0) {
    return err({
      where: indexUrl,
      problems: problems.length > 0 ? problems : [problem('items', 'No tutorials converted')],
    })
  }

  const file: unknown = {
    id: TUTORIAL_PACK_ID,
    formatVersion: CONTENT_PACK_FORMAT_VERSION,
    version: String(index.data.version),
    name: 'Chess King tutorials',
    kind: 'lessons',
    description: 'Openings and tactical patterns, played move by move.',
    licence: TUTORIAL_PACK_LICENCE,
    itemCount: lessons.length,
    lessons,
    puzzles: [],
  }

  const pack = loadContentPack(file, {
    where: indexUrl,
    source: options.source ?? 'builtin',
    ...(options.now === undefined ? {} : { now: options.now }),
  })
  if (!pack.ok) return pack
  return ok({ pack: pack.value, problems, skipped })
}
