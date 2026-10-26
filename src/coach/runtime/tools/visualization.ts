import { z } from 'zod'

import { VISUALIZATION_FIXTURES } from '@/coach/fixtures/visualization-fixtures'
import { bandOf, initialLadder, narrationOf, plies, viewOf } from '@/coach/visualization/ladder'
import { narrate, type NarrationLevel } from '@/coach/visualization/narrate'
import {
  checkAnswer,
  parseTyped,
  prepare,
  revealText,
  type Answer,
  type Prepared,
} from '@/coach/visualization/questions'
import { findSlip, type Slip } from '@/coach/visualization/slip'
import {
  BoardViewSchema,
  VisualizationExerciseSchema,
  type VisualizationAttachment,
} from '@/domain'
import { defaultDrillRecords, type DrillRecordsPort } from '@/features/drills/drill-records'

import { boardsFor, makeStep, replayLine } from './board-cards'
import { isToolFailure, resolveFen, toolFailure } from './shared'
import { defineTool, type CoachToolGroup } from './types'

import type { ToolSet } from 'ai'

/**
 * S21b · Visualization (§5, §10): setBoardView, narrateLine, startVisualizationExercise,
 * checkVisualizationAnswer, peekPosition, getVisualizationProfile.
 *
 * Why the answer key never leaves this closure: the model phrases and encourages, but the
 * question, the key and the marking all come from replaying the line with the rules
 * (§10.5). What the model is handed on start is the question only; the key is released by
 * `checkVisualizationAnswer`, after the user has answered (§7 "Hidden answer key").
 */

const MAX_LINE = 16
const NARRATION = ['full', 'piece', 'san'] as const satisfies readonly NarrationLevel[]

/** One issued exercise: the card the user sees, and what only the rules may read. */
interface Issued {
  readonly card: VisualizationAttachment
  readonly prepared: Prepared
  answered: boolean
  slip: Slip | null
}

/** Pitches a narration to the level: spoken in full for beginners, plain notation at the top. */
const narrationFor = (level: number): NarrationLevel =>
  level <= 3 ? 'full' : level <= 5 ? 'piece' : 'san'

const fixtureKey = (card: VisualizationAttachment): string =>
  `${card.exercise}|${card.fen}|${card.moves.join(' ')}|${JSON.stringify(card.target ?? {})}`

export function createVisualizationTools(
  records: Pick<DrillRecordsPort, 'readVision'> = defaultDrillRecords,
): CoachToolGroup {
  return (env) => {
    const boards = boardsFor(env)
    const issued = new Map<string, Issued>()
    const used = new Set<string>()

    const unknownExercise = (id: string) =>
      toolFailure(
        issued.size === 0
          ? `No exercise "${id}": none has been started, call startVisualizationExercise first.`
          : `No exercise "${id}". Started: ${[...issued.keys()].join(', ')}.`,
      )

    return {
      setBoardView: defineTool({
        description:
          'Switch a Sage board to normal, ghost, frozen, partial, blindfold or flash view. The app controls the timing; you only request the view.',
        inputSchema: z.object({
          boardId: z.string().describe('A board id returned by an earlier board tool'),
          view: BoardViewSchema,
        }),
        execute: ({ boardId, view }) => {
          const card = boards.setView(boardId, view)
          if (card === undefined) {
            return toolFailure(`No board "${boardId}". Open one with openSageBoard first.`)
          }
          return { boardId, view, summary: `${view} view · ${boardId}` }
        },
      }),

      narrateLine: defineTool({
        description:
          'Read a line aloud move by move while the board stays frozen or hidden. Pass an exerciseId to read the line of an exercise you started (no card is added), or a fen and moves to read your own line on a new Sage board. Every move is replayed through the rules first; an illegal line is refused.',
        inputSchema: z.object({
          exerciseId: z.string().optional(),
          fen: z.string().optional().describe('Start position; default is the one on screen'),
          moves: z.array(z.string().min(1)).min(1).max(MAX_LINE).optional(),
          level: z
            .enum(NARRATION)
            .optional()
            .describe('full, piece or san; default fits the exercise'),
          view: BoardViewSchema.optional().describe('Default frozen'),
        }),
        execute: ({ exerciseId, fen, moves, level, view }) => {
          if (exerciseId !== undefined) {
            const exercise = issued.get(exerciseId)
            if (exercise === undefined) return unknownExercise(exerciseId)
            const spoken = level ?? narrationFor(exercise.card.level)
            const narration = exercise.prepared.history.map((move) =>
              narrate(move.san, move.fenBefore, spoken),
            )
            return { exerciseId, narration, summary: `narrated ${String(narration.length)} plies` }
          }
          if (moves === undefined) {
            return toolFailure('Pass an exerciseId, or the moves of a line to read.')
          }
          const start = resolveFen(env, fen)
          if (isToolFailure(start)) return start
          const replayed = replayLine(start, moves)
          if (!replayed.ok) return toolFailure(replayed.error)
          const spoken = level ?? 'piece'
          const narration = replayed.moves.map((move) => narrate(move.san, move.fenBefore, spoken))
          const boardId = boards.open({
            kind: 'board',
            card: 'line',
            title: 'Reading the line',
            fen: start,
            orientation: env.context.position?.orientation ?? 'white',
            view: view ?? 'frozen',
            steps: replayed.moves.map((move, index) =>
              makeStep({ san: move.san, caption: narration[index] ?? move.san }),
            ),
          })
          return {
            boardId,
            narration,
            summary: `narrated ${String(narration.length)} plies · ${view ?? 'frozen'}`,
          }
        },
      }),

      startVisualizationExercise: defineTool({
        description:
          'Start a visualization exercise of a kind and level (1-10). The app builds the question from a vetted line and keeps the answer key; you get the question only, never the answer.',
        inputSchema: z.object({
          exercise: VisualizationExerciseSchema,
          level: z.number().int().min(1).max(10),
          view: BoardViewSchema.optional().describe("Override the exercise's board view"),
        }),
        execute: ({ exercise, level, view }) => {
          const candidates = VISUALIZATION_FIXTURES.filter((card) => card.exercise === exercise)
            .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
            .map((fixture) => ({ ...fixture, level, view: view ?? fixture.view }))
            .flatMap((card) => {
              const prepared = prepare(card)
              return prepared === null ? [] : [{ card, prepared }]
            })
          const fresh = candidates.filter(({ card }) => !used.has(fixtureKey(card)))
          const picked = (fresh.length > 0 ? fresh : candidates)[0]
          if (picked === undefined) return toolFailure(`No ${exercise} exercise is available.`)
          used.add(fixtureKey(picked.card))
          const exerciseId = `exercise-${String(issued.size + 1)}`
          issued.set(exerciseId, { ...picked, answered: false, slip: null })
          env.emit(picked.card)
          const { prompt, input, hint, options } = picked.prepared.question
          return {
            exerciseId,
            exercise,
            level,
            view: picked.card.view,
            plies: picked.card.moves.length,
            question: {
              prompt,
              input,
              ...(hint === undefined ? {} : { hint }),
              ...(options === undefined ? {} : { options: options.map((option) => option.label) }),
            },
            summary: `${exercise} · level ${String(level)}`,
          }
        },
      }),

      checkVisualizationAnswer: defineTool({
        description:
          "Mark the user's answer to an exercise you started. Pass what they typed or chose, verbatim. Returns whether it was right, the answer, and for a missed follow-the-piece question the first move where their picture left the real position.",
        inputSchema: z.object({
          exerciseId: z.string(),
          answer: z.string().min(1).describe("The user's answer, as they gave it"),
        }),
        execute: ({ exerciseId, answer }) => {
          const exercise = issued.get(exerciseId)
          if (exercise === undefined) return unknownExercise(exerciseId)
          const { question, key } = exercise.prepared
          let said: Answer | null
          if (question.input === 'choice' || question.input === 'picture') {
            const wanted = answer.trim().toLowerCase()
            const chosen =
              question.options?.find(
                (option) =>
                  option.id.toLowerCase() === wanted || option.label.toLowerCase() === wanted,
              )?.id ?? question.pictures?.find((picture) => picture.id.toLowerCase() === wanted)?.id
            said = chosen === undefined ? null : { choice: chosen }
          } else {
            said = parseTyped(question.input, answer)
          }
          if (said === null) {
            return toolFailure(
              `Could not read "${answer}" as an answer to this question. ${question.hint ?? 'Ask the user to choose one of the options.'}`,
            )
          }
          const correct = checkAnswer(key, said)
          exercise.answered = true
          const start = exercise.card.target?.square
          const guess = said.squares?.[0]
          if (
            !correct &&
            key.kind === 'squares' &&
            start !== undefined &&
            exercise.card.exercise === 'follow-line'
          ) {
            exercise.slip = findSlip({
              fen: exercise.card.fen,
              moves: exercise.card.moves,
              start,
              answer: guess ?? null,
            })
          }
          const { slip } = exercise
          return {
            exerciseId,
            correct,
            answer: revealText(key),
            ...(slip === null
              ? {}
              : { slip: { move: `${slip.label} ${slip.san}`, explanation: slip.explanation } }),
            summary: correct
              ? `${exercise.card.exercise} · correct`
              : `${exercise.card.exercise} · missed${slip === null ? '' : ` at ${slip.label}${slip.san}`}`,
          }
        },
      }),

      peekPosition: defineTool({
        description:
          'Briefly show the real position at a move of an exercise line on a new Sage board, then hide it again. Only after the user has answered. Without a ply it shows the position after their first slip, else the end of the line.',
        inputSchema: z.object({
          exerciseId: z.string(),
          ply: z.number().int().min(0).max(MAX_LINE).optional().describe('0 is the start position'),
        }),
        execute: ({ exerciseId, ply }) => {
          const exercise = issued.get(exerciseId)
          if (exercise === undefined) return unknownExercise(exerciseId)
          if (!exercise.answered) {
            return toolFailure('The user has not answered yet; a peek would give the answer away.')
          }
          const { positions, history } = exercise.prepared
          const at = Math.min(
            ply ?? (exercise.slip === null ? history.length : exercise.slip.ply + 1),
            history.length,
          )
          const fen = positions[at]
          if (fen === undefined) return toolFailure('That ply is outside the line.')
          const moved = history[at - 1]
          const boardId = boards.open({
            kind: 'board',
            card: 'idea',
            title: 'Peek',
            fen,
            orientation: exercise.card.orientation,
            view: 'flash',
            steps: [
              makeStep({
                caption:
                  at === 0 ? 'The start position.' : `The real position after ply ${String(at)}.`,
                focus: moved === undefined ? [] : [moved.from, moved.to],
              }),
            ],
          })
          return { boardId, ply: at, summary: `peek · ply ${String(at)}` }
        },
      }),

      getVisualizationProfile: defineTool({
        description:
          "The user's visualization history: Board vision drill scores, where a new ladder run starts, and how this conversation's exercises went.",
        inputSchema: z.object({}),
        execute: async () => {
          const stored = await records.readVision()
          const vision = stored.ok ? stored.value : undefined
          const played =
            vision === undefined
              ? 0
              : Object.values(vision).reduce((sum, row) => sum + row.plays, 0)
          const dials = initialLadder().dials
          const answered = [...issued.values()].filter((exercise) => exercise.answered)
          return {
            visionDrills: vision ?? null,
            ladderStart: {
              plies: plies(dials),
              view: viewOf(dials),
              pieces: bandOf(dials),
              narration: narrationOf(dials),
            },
            thisConversation: {
              exercises: answered.length,
              slips: answered.filter((e) => e.slip !== null).length,
            },
            note: 'Span, level per exercise and slip history are not stored yet, so these are the ladder defaults, not measurements.',
            summary:
              played === 0
                ? 'no vision history yet · ladder defaults'
                : `${String(played)} vision drills played · ladder defaults for span`,
          }
        },
      }),
    } satisfies ToolSet
  }
}

export const visualizationTools = createVisualizationTools()
