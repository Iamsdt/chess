import { z } from 'zod'

import {
  createGame,
  formatFen,
  isCheck,
  legalMoves,
  parseFen,
  squareControl,
  uciLineToSan,
  type PlayedMove,
} from '@/chess'
import { buildFrames } from '@/coach/sage-board/frames'
import {
  ArrowKindSchema,
  SquareSchema,
  type Color,
  type EngineEval,
  type Fen,
  type SageBoardAttachment,
} from '@/domain'

import {
  boardsFor,
  colorName,
  describeMove,
  evalOf,
  makeStep,
  newDanger,
  otherColor,
  replayLine,
} from './board-cards'
import { isToolFailure, resolveFen, toolFailure, toolSignal } from './shared'
import { defineTool, type CoachToolEnv, type CoachToolGroup, type CoachToolOutput } from './types'

import type { ToolSet } from 'ai'

/**
 * S21b · Sage board (§5, §11): openSageBoard, showOnBoard, showWhatIf, showThreat,
 * stepThroughLine, handOverMove, clearBoardMarks, showControlMap.
 *
 * Why every tool ends in a card and none touches the position on screen: a Sage board is a
 * snapshot, so these tools take a FEN (or default to a copy of the one the user is looking
 * at) and post a board of their own. The model gets facts back; the user gets the board.
 * `openCalculationTree` lives with the engine tools because it needs the tree builder.
 */

/** Deep enough to name the opponent's best reply, short enough to answer inside one turn. */
const REPLY_DEPTH = 14
/** A hand-over accepts any move this close to the best one: "good enough" is not one move. */
const ACCEPT_WITHIN_CP = 40
const HAND_OVER_LINES = 3
const THREAT_PLIES = 3
const MAX_LINE = 16

const SquaresSchema = z.array(SquareSchema).max(24)
const ArrowInputSchema = z.object({
  from: SquareSchema,
  to: SquareSchema,
  kind: ArrowKindSchema.optional().describe('best, threat or sage (default)'),
})

const boardIdSchema = z.string().describe('A board id returned by an earlier board tool')

interface BoardOutput extends CoachToolOutput {
  readonly boardId: string
}

/** Orientation follows the user's own board when there is one, else White at the bottom. */
const orientationOf = (env: CoachToolEnv): Color => env.context.position?.orientation ?? 'white'

function unknownBoard(env: CoachToolEnv, id: string) {
  const open = boardsFor(env).ids()
  return toolFailure(
    open.length === 0
      ? `No board "${id}": none is open yet, call openSageBoard first.`
      : `No board "${id}". Open boards: ${open.join(', ')}.`,
  )
}

/** The side to move flipped and en passant dropped: a null move, to ask what the other side wants. */
function passTurn(fen: Fen): Fen | null {
  const game = createGame(fen)
  const parsed = parseFen(fen)
  if (!game.ok || !parsed.ok || isCheck(game.value)) return null
  const flipped = formatFen({
    ...parsed.value,
    sideToMove: otherColor(parsed.value.sideToMove),
    enPassant: null,
  })
  return flipped.ok && createGame(flipped.value).ok ? flipped.value : null
}

/** The engine's answer for a position; every move and number the tools report comes from here. */
async function engineLine(env: CoachToolEnv, fen: Fen, multiPv = 1) {
  const evaluated = await env.engine.evaluate(fen, {
    lane: 'interactive',
    depth: REPLY_DEPTH,
    multiPv,
    signal: toolSignal(env),
  })
  if (!evaluated.ok) return toolFailure(`The engine could not answer: ${evaluated.error.message}`)
  return evaluated.value.lines.length === 0
    ? toolFailure('The engine returned no move: the game may be over.')
    : evaluated.value
}

/** The final position of a board, replayed from its steps; `undefined` if they do not replay. */
function endOf(card: SageBoardAttachment): { fen: Fen; turn: Color } | undefined {
  const last = buildFrames(card.fen, card.steps).at(-1)
  return last === undefined ? undefined : { fen: last.game.fen, turn: last.game.turn }
}

export const boardTools: CoachToolGroup = (env) => {
  const boards = boardsFor(env)

  return {
    openSageBoard: defineTool({
      description:
        "Post a Sage board card in the chat from a position and return its board id. Defaults to a copy of the user's position; the user's own board is never changed.",
      inputSchema: z.object({
        fen: z.string().optional().describe('Position to copy; default is the position on screen'),
        title: z.string().min(1).max(60).optional(),
        caption: z.string().min(1).max(140).optional().describe('One short line under the board'),
      }),
      execute: ({ fen, title, caption }): BoardOutput | ReturnType<typeof toolFailure> => {
        const resolved = resolveFen(env, fen)
        if (isToolFailure(resolved)) return resolved
        const name = title ?? "Sage's board"
        const boardId = boards.open({
          kind: 'board',
          card: 'idea',
          title: name,
          fen: resolved,
          orientation: orientationOf(env),
          view: 'normal',
          steps: [
            makeStep({ caption: caption ?? 'A copy of the position, for Sage to show you.' }),
          ],
        })
        return { boardId, summary: `board opened · ${name}` }
      },
    }),

    showOnBoard: defineTool({
      description:
        "Draw arrows, circles and warning squares on a Sage board you opened earlier. Marks sit on the board's final step. Call clearBoardMarks to remove them.",
      inputSchema: z.object({
        boardId: boardIdSchema,
        arrows: z.array(ArrowInputSchema).max(12).optional(),
        circles: SquaresSchema.optional().describe('Squares to circle'),
        danger: SquaresSchema.optional().describe('Squares to paint in the warning colour'),
      }),
      execute: ({
        boardId,
        arrows,
        circles,
        danger,
      }): BoardOutput | ReturnType<typeof toolFailure> => {
        const card = boards.draw(boardId, {
          arrows: (arrows ?? []).map((arrow) => ({ ...arrow, kind: arrow.kind ?? 'sage' })),
          focus: circles ?? [],
          danger: danger ?? [],
        })
        if (card === undefined) return unknownBoard(env, boardId)
        const count = (arrows?.length ?? 0) + (circles?.length ?? 0) + (danger?.length ?? 0)
        return { boardId, summary: `${String(count)} marks on ${boardId}` }
      },
    }),

    showWhatIf: defineTool({
      description:
        "Play a move on a new Sage board, then the engine's best reply, and mark the danger the move creates (check, mate, a piece left hanging). The reply and evaluation come from the engine.",
      inputSchema: z.object({
        move: z.string().min(1).describe('The move to try, in SAN'),
        fen: z
          .string()
          .optional()
          .describe('Position to play it from; default is the one on screen'),
      }),
      execute: async ({ move, fen }) => {
        const resolved = resolveFen(env, fen)
        if (isToolFailure(resolved)) return resolved
        const first = replayLine(resolved, [move])
        const played = first.ok ? first.moves[0] : undefined
        if (played === undefined) {
          const game = createGame(resolved)
          const sample = game.ok ? legalMoves(game.value).slice(0, 8) : []
          return toolFailure(
            `"${move}" is not legal there. Some legal moves: ${sample.map((legal) => legal.san).join(', ')}.`,
          )
        }
        const mover = played.color
        const moveDanger = newDanger(played.fenBefore, played.fenAfter, mover)
        let reply: PlayedMove | undefined
        let answered: EngineEval | undefined
        if (!played.isCheckmate) {
          const asked = await engineLine(env, played.fenAfter)
          if (isToolFailure(asked)) return asked
          const best = asked.lines[0]
          const sans =
            best === undefined ? null : uciLineToSan(played.fenAfter, best.pv.slice(0, 1))
          const replayed = sans?.ok === true ? replayLine(played.fenAfter, sans.value) : undefined
          reply = replayed?.ok === true ? replayed.moves[0] : undefined
          if (reply === undefined) {
            return toolFailure('The engine answered with a move that is not legal.')
          }
          answered = asked
        }
        const score = answered === undefined ? undefined : evalOf(answered.score, otherColor(mover))
        const replyDanger =
          reply === undefined ? [] : newDanger(reply.fenBefore, reply.fenAfter, mover)
        const steps = [
          makeStep({
            san: played.san,
            caption: `${colorName(mover)} plays ${played.san}.${describeMove(played, moveDanger, played.fenAfter)}`,
            arrows: [{ from: played.from, to: played.to, kind: 'sage' }],
            danger: moveDanger,
            ...(score === undefined ? {} : { eval: score }),
          }),
          ...(reply === undefined
            ? []
            : [
                makeStep({
                  san: reply.san,
                  caption: `${colorName(reply.color)} answers ${reply.san}.${describeMove(reply, replyDanger, reply.fenAfter)}`,
                  arrows: [{ from: reply.from, to: reply.to, kind: 'threat' }],
                  danger: replyDanger,
                }),
              ]),
        ]
        const title = `What if ${played.san}?`
        const boardId = boards.open({
          kind: 'board',
          card: 'what-if',
          title,
          fen: resolved,
          orientation: orientationOf(env),
          view: 'normal',
          steps,
        })
        return {
          boardId,
          move: played.san,
          ...(reply === undefined || answered === undefined || score === undefined
            ? {}
            : {
                reply: reply.san,
                eval: score,
                depth: answered.depth,
                danger: replyDanger,
                check: reply.isCheck,
              }),
          summary: `what-if board · ${played.san}${reply === undefined ? '' : ` ${reply.san}`}`,
        }
      },
    }),

    showThreat: defineTool({
      description:
        "Play out what the opponent threatens right now on a new Sage board: the engine's best move for the side that is not to move, as if it were their turn. Cannot be used while the side to move is in check.",
      inputSchema: z.object({
        fen: z.string().optional().describe('Position to read; default is the one on screen'),
      }),
      execute: async ({ fen }) => {
        const resolved = resolveFen(env, fen)
        if (isToolFailure(resolved)) return resolved
        const flipped = passTurn(resolved)
        if (flipped === null) {
          return toolFailure(
            'The side to move is in check, so answer the check first: no threat can be read.',
          )
        }
        const answered = await engineLine(env, flipped)
        if (isToolFailure(answered)) return answered
        const best = answered.lines[0]
        const sans =
          best === undefined ? null : uciLineToSan(flipped, best.pv.slice(0, THREAT_PLIES))
        const replayed = sans?.ok === true ? replayLine(flipped, sans.value) : undefined
        if (replayed?.ok !== true)
          return toolFailure('The engine line was not legal, so nothing was shown.')
        const [threat] = replayed.moves
        if (threat === undefined) return toolFailure('There is no threat: the position is over.')
        const attacker = threat.color
        const target = otherColor(attacker)
        const hit = newDanger(threat.fenBefore, threat.fenAfter, target)
        const danger = threat.captured === undefined ? hit : [threat.to, ...hit]
        const score = evalOf(answered.score, attacker)
        const steps = [
          makeStep({
            caption: `If it were ${colorName(attacker)}'s move, this is what they would play.`,
          }),
          makeStep({
            san: threat.san,
            caption: `${colorName(attacker)} threatens ${threat.san}.${describeMove(threat, hit, threat.fenAfter)}`,
            arrows: [{ from: threat.from, to: threat.to, kind: 'threat' }],
            danger,
            eval: score,
          }),
          ...replayed.moves.slice(1).map((follow) =>
            makeStep({
              san: follow.san,
              caption: `${colorName(follow.color)} ${follow.color === attacker ? 'follows with' : 'answers'} ${follow.san}.`,
              arrows: [
                {
                  from: follow.from,
                  to: follow.to,
                  kind: follow.color === attacker ? 'threat' : 'sage',
                },
              ],
            }),
          ),
        ]
        const boardId = boards.open({
          kind: 'board',
          card: 'threat',
          title: `${colorName(attacker)}'s threat`,
          fen: flipped,
          orientation: orientationOf(env),
          view: 'normal',
          steps,
        })
        return {
          boardId,
          threat: threat.san,
          line: replayed.moves.map((move) => move.san),
          eval: score,
          depth: answered.depth,
          danger,
          summary: `threat board · ${threat.san}`,
        }
      },
    }),

    stepThroughLine: defineTool({
      description:
        'Animate a variation on a new Sage board, one caption per move. Every move is replayed through the rules first; an illegal line is refused and nothing is shown.',
      inputSchema: z.object({
        fen: z
          .string()
          .optional()
          .describe('Position the line starts from; default is the one on screen'),
        title: z.string().min(1).max(60).optional(),
        steps: z
          .array(
            z.object({
              san: z.string().min(1),
              caption: z.string().min(1).max(140).describe('One short line for this move'),
            }),
          )
          .min(1)
          .max(MAX_LINE),
      }),
      execute: ({ fen, title, steps }) => {
        const resolved = resolveFen(env, fen)
        if (isToolFailure(resolved)) return resolved
        const replayed = replayLine(
          resolved,
          steps.map((step) => step.san),
        )
        if (!replayed.ok) return toolFailure(replayed.error)
        const name = title ?? 'The line'
        const boardId = boards.open({
          kind: 'board',
          card: 'line',
          title: name,
          fen: resolved,
          orientation: orientationOf(env),
          view: 'normal',
          steps: replayed.moves.map((move, index) =>
            makeStep({
              san: move.san,
              caption: steps[index]?.caption ?? move.san,
              arrows: [{ from: move.from, to: move.to, kind: 'sage' }],
            }),
          ),
        })
        const line = replayed.moves.map((move) => move.san)
        return { boardId, line, summary: `line board · ${line.slice(0, 4).join(' ')}` }
      },
    }),

    handOverMove: defineTool({
      description:
        "Ask the user to play the next move on a Sage board, inside the dialog. The accepted moves are computed from the engine, not by you; you will not be told them. The user's move arrives in their next message.",
      inputSchema: z.object({
        boardId: boardIdSchema,
        prompt: z.string().min(1).max(140).describe('The question, e.g. how does Black stop this?'),
        praise: z.string().min(1).max(100).describe('Shown when the user plays an accepted move'),
        retry: z.string().min(1).max(100).describe('Shown when they play anything else'),
      }),
      execute: async ({ boardId, prompt, praise, retry }) => {
        const card = boards.get(boardId)
        if (card === undefined) return unknownBoard(env, boardId)
        const end = endOf(card)
        if (end === undefined)
          return toolFailure('That board does not replay, so it cannot take a move.')
        const answered = await engineLine(env, end.fen, HAND_OVER_LINES)
        if (isToolFailure(answered)) return answered
        const lines = answered.lines
        const top = lines[0]
        if (top === undefined || top.score.kind !== 'cp') {
          return toolFailure(
            'There is no quiet best move to hand over here (the line is forced or over).',
          )
        }
        const best = top.score.value
        const accept = lines
          .filter((line) => line.score.kind === 'cp' && best - line.score.value <= ACCEPT_WITHIN_CP)
          .flatMap((line) => {
            const san = uciLineToSan(end.fen, line.pv.slice(0, 1))
            return san.ok ? san.value : []
          })
        const [first, ...rest] = accept
        if (first === undefined)
          return toolFailure('The engine moves could not be read, so nothing was handed over.')
        boards.append(
          boardId,
          makeStep({
            caption: prompt,
            yourTurn: { prompt, accept: [first, ...rest], praise, retry },
          }),
        )
        return {
          boardId,
          waitingFor: colorName(end.turn),
          acceptedMoves: accept.length,
          summary: `your turn · ${boardId}`,
        }
      },
    }),

    clearBoardMarks: defineTool({
      description:
        'Remove every arrow, circle, warning square and control map you drew on a Sage board.',
      inputSchema: z.object({ boardId: boardIdSchema }),
      execute: ({ boardId }): BoardOutput | ReturnType<typeof toolFailure> => {
        const card = boards.clear(boardId)
        return card === undefined
          ? unknownBoard(env, boardId)
          : { boardId, summary: `marks cleared · ${boardId}` }
      },
    }),

    showControlMap: defineTool({
      description:
        'Shade the squares each side attacks and defends on a Sage board, at the position the board ends on.',
      inputSchema: z.object({ boardId: boardIdSchema }),
      execute: ({ boardId }) => {
        const card = boards.draw(boardId, { controlMap: true })
        if (card === undefined) return unknownBoard(env, boardId)
        const end = endOf(card)
        const control = end === undefined ? [] : squareControl(end.fen)
        const count = (side: string): number =>
          control.filter((square) => square.side === side).length
        return {
          boardId,
          white: count('white'),
          black: count('black'),
          contested: count('contested'),
          summary: `control map · ${boardId}`,
        }
      },
    }),
  } satisfies ToolSet
}
