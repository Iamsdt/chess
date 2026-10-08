import {
  toFen,
  toSquare,
  type ActionAttachment,
  type CoachAttachment,
  type CoachMode,
  type CoachToolAttachment,
} from '@/domain'

import {
  COMPARE_CARD,
  CONTROL_MAP_CARD,
  GM_THINKING,
  HINTS_CARD,
  IDEA_CARD,
  LINE_CARD,
  THREAT_CARD,
  WHAT_IF_CARD,
  YOUR_TURN_CARD,
} from './fixtures/board-fixtures'
import { CALCULATION_CARD } from './fixtures/calculation-fixtures'
import {
  BLIND_CHECKS_CARD,
  BLIND_ROUTE_CARD,
  COUNT_EXCHANGE_CARD,
  FLASH_RECALL_CARD,
  FOLLOW_LINE_CARD,
  IS_IT_CHECK_CARD,
  PICK_PICTURE_CARD,
  WHATS_HANGING_CARD,
} from './fixtures/visualization-fixtures'
import { SHOWCASE_PROMPTS, type ShowcasePrompt } from './showcase-prompts'

import type { MockCoachReply } from './mock-coach'

/**
 * One scripted reply per showcase prompt: the mock's default voice.
 *
 * Why matched by the exact string: `/dev/sage` and the quick replies send these prompts
 * verbatim, so each feature can be tried on demand without guessing what to type.
 */

const P = SHOWCASE_PROMPTS

function exact(prompt: string): RegExp {
  return new RegExp(`^${prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
}

function tool(
  name: string,
  summary: string,
  status: CoachToolAttachment['status'] = 'done',
): CoachToolAttachment {
  return { kind: 'tool', name, summary, status }
}

function action(
  fields: Omit<ActionAttachment, 'kind' | 'items'> & { items?: string[] },
): ActionAttachment {
  return { kind: 'action', items: [], ...fields }
}

const FORK_FEN = toFen('r4rk1/pp3ppp/2p5/6n1/3P4/2P5/PP3P1P/R3Q1K1 b - - 0 17')

interface Entry {
  readonly mode: CoachMode
  readonly tools: readonly CoachToolAttachment[]
  readonly text: string
  readonly attachments?: readonly CoachAttachment[]
  readonly quick?: readonly ShowcasePrompt[] | readonly string[]
  readonly failWith?: string
}

function reply(prompt: ShowcasePrompt, entry: Entry): MockCoachReply {
  return {
    match: exact(P[prompt]),
    mode: entry.mode,
    text: entry.text,
    attachments: [...entry.tools, ...(entry.attachments ?? [])],
    quickReplies: (entry.quick ?? []).map((q) => (q in P ? P[q as ShowcasePrompt] : q)),
    ...(entry.failWith === undefined ? {} : { failWith: entry.failWith }),
  }
}

const ENGINE = tool('analysePosition', 'depth 18 · +0.8 · Nf3 best')

export const SHOWCASE_SCRIPT: readonly MockCoachReply[] = [
  reply('whatIf', {
    mode: 'grandmaster',
    tools: [
      tool('playLine', 'Nxe5 Nxe5 · legal'),
      tool('evaluateMove', 'Nxe5 · −2.4 · drops a piece'),
    ],
    text: 'Nxe5 grabs a pawn but **gives up a piece**: after …Nxe5 nothing wins it back. Open the card and step through it.',
    attachments: [WHAT_IF_CARD],
    quick: ['threat', 'compare'],
  }),
  reply('threat', {
    mode: 'grandmaster',
    tools: [tool('positionFacts', 'Nf6 attacks e4, d5 loose')],
    text: 'Black is aiming at **f2**: the bishop on `c5` and the knight on `g4` both hit it. Open the card to see it played out.',
    attachments: [THREAT_CARD],
    quick: ['yourTurn', 'idea'],
  }),
  reply('idea', {
    mode: 'grandmaster',
    tools: [tool('identifyOpening', 'C54 Italian · Giuoco Pianissimo')],
    text: 'The plan is calm: **Bb3** to save the bishop, the knight walks `d2`–`f1`–`g3`, and only then **d4**.',
    attachments: [IDEA_CARD],
    quick: ['line', 'controlMap'],
  }),
  reply('line', {
    mode: 'grandmaster',
    tools: [tool('playLine', '6 moves · all legal')],
    text: 'Here is the main line. It plays itself; pause it whenever you want to think.',
    attachments: [LINE_CARD],
    quick: ['compare', 'explainWhy'],
  }),
  reply('compare', {
    mode: 'grandmaster',
    tools: [tool('compareMoves', 'Bb3 +0.4 · d4 +0.6')],
    text: '`Bb3` keeps the balance. `d4` looks active, but after …exd4 cxd4 Bb4+ Black is a little better. See them side by side.',
    attachments: [COMPARE_CARD],
    quick: ['grandmaster', 'whatIf'],
  }),
  reply('controlMap', {
    mode: 'grandmaster',
    tools: [tool('positionFacts', 'centre: White 5 · Black 4')],
    text: 'White holds the centre by one square. The map shades who attacks what.',
    attachments: [CONTROL_MAP_CARD],
    quick: ['threat', 'idea'],
  }),
  reply('yourTurn', {
    mode: 'grandmaster',
    tools: [tool('positionFacts', 'one defender missing')],
    text: 'Your move this time. Black is hitting `f2`; open the card and find how White defends.',
    attachments: [YOUR_TURN_CARD],
    quick: ['hint', 'threat'],
  }),
  reply('grandmaster', {
    mode: 'grandmaster',
    tools: [
      ENGINE,
      tool('positionFacts', 'king safe · centre open'),
      tool('compareMoves', '3 candidates'),
    ],
    text: "I'll think it through in six steps. Open any of them; the board button shows it.",
    attachments: [GM_THINKING],
    quick: ['calculation', 'explainWhy'],
  }),
  reply('calculation', {
    mode: 'grandmaster',
    tools: [tool('buildCalculationTree', '3 candidates · depth 4')],
    text: "Here's the tree. The tempting branch is **Nxf7**: it looks crushing for two moves, then Black's king walks out and White is short of material.",
    attachments: [CALCULATION_CARD],
    quick: ['grandmaster', 'patterns'],
  }),
  reply('explainWhy', {
    mode: 'open-qa',
    tools: [tool('evaluateMove', 'best · +0.8'), tool('positionFacts', 'develops, controls e5')],
    text: 'It does **three jobs** at once: develops a piece, controls `e5`, and clears the way to castle. Moves that do one job are usually worse.',
    quick: ['simpler', 'idea'],
  }),
  {
    ...reply('hint', {
      mode: 'puzzle-nudger',
      tools: [tool('analysePosition', 'hidden · solution known')],
      text: "Let's go one nudge at a time. I won't say the move. Look at the first hint.",
      attachments: [HINTS_CARD],
      quick: ['explainWhy', 'queuePuzzles'],
    }),
    // Same line either way: the hint card already is the spoiler-safe answer.
    spoilerFreeText:
      "I'll keep the move to myself. Start with the first hint and ask for more only if you need it.",
  },
  reply('simpler', {
    mode: 'open-qa',
    tools: [tool('getPlayerProfile', 'rating ~900 · likes short answers')],
    text: "Think of it like this: **every piece wants to be useful**. This move wakes up a sleepy piece and takes a good square. That's all.",
    quick: ['explainWhy', 'history'],
  }),
  reply('language', {
    mode: 'teacher',
    tools: [tool('getMistakeHistory', 'última partida · 3 errores')],
    text: 'Perdiste por una sola idea: **dejaste la dama a un salto de caballo del rey**. No fue mala suerte, es un patrón que podemos practicar.',
    quick: ['patterns', 'queuePuzzles'],
  }),
  reply('history', {
    mode: 'open-qa',
    tools: [
      tool('getPlayerProfile', 'puzzle 1480'),
      tool('getWeakThemes', 'forks, pins, back rank'),
    ],
    text: 'Three themes cost you the most: **forks**, **pins** and **back-rank checks**. Forks first; they fix the most games.',
    quick: ['patterns', 'planWeek'],
  }),
  reply('patterns', {
    mode: 'teacher',
    tools: [tool('findMyGames', '4 games, same fork'), tool('getMistakeHistory', 'Nf3+ ×4')],
    text: "It's one pattern, and it has shown up **four times**: after you castle, a knight lands on `f3` with check. Seeing it is most of the fix.",
    attachments: [
      {
        kind: 'position',
        fen: FORK_FEN,
        orientation: 'white',
        highlight: [toSquare('g5')],
        focus: [toSquare('f3')],
        arrows: [{ from: toSquare('g5'), to: toSquare('f3'), kind: 'threat' }],
        caption: 'Game 3 of 4',
        href: '/analysis',
      },
    ],
    quick: ['queuePuzzles', 'mistakeBank'],
  }),
  reply('pastSelf', {
    mode: 'planner',
    tools: [
      tool('getPlayerProfile', 'puzzle +96 in 30 days'),
      tool('getMistakeHistory', 'forks −40%'),
    ],
    text: "Yes, and I can show it. A month ago you'd have missed this fork; this week you found it. Back-rank mistakes are the next gap.",
    quick: ['history', 'planWeek'],
  }),
  reply('similar', {
    mode: 'open-qa',
    tools: [tool('findSimilarPositions', '2 close matches')],
    text: 'Twice. Once in your game on Tuesday, and once in March. Both times the plan was the same.',
    attachments: [
      {
        kind: 'position',
        fen: FORK_FEN,
        orientation: 'white',
        highlight: [],
        focus: [],
        arrows: [],
        caption: 'Tuesday, move 17',
        href: '/analysis',
      },
    ],
    quick: ['patterns', 'mistakeBank'],
  }),
  reply('queuePuzzles', {
    mode: 'planner',
    tools: [tool('getWeakThemes', 'fork ranks first')],
    text: "I'd line up **8 fork puzzles**, easiest first. Nothing changes until you confirm.",
    attachments: [
      action({
        action: 'queue-puzzles',
        title: 'Queue 8 fork puzzles',
        detail: 'Added to the front of today’s path.',
        items: ['Royal fork ×3', 'Knight fork ×3', 'Pawn fork ×2'],
        href: '/puzzles',
      }),
    ],
    quick: ['planWeek', 'hint'],
  }),
  reply('mistakeBank', {
    mode: 'teacher',
    tools: [tool('positionFacts', 'knight fork missed')],
    text: 'I can save this one. It will come back in a few days, when you are about to forget it.',
    attachments: [
      action({
        action: 'add-to-mistake-bank',
        title: 'Save to the Mistake Bank',
        detail: 'Move 17 · missed the fork on f3',
        href: '/mistakes',
      }),
    ],
    quick: ['queuePuzzles'],
  }),
  reply('drill', {
    mode: 'planner',
    tools: [tool('getWeakThemes', 'K+R vs K drawn twice')],
    text: 'Two won rook endings were drawn last week. A short **K+R vs K** drill fits.',
    attachments: [
      action({
        action: 'start-drill',
        title: 'Start K+R vs K',
        detail: 'Par 16 moves · Stockfish defends',
        href: '/drills/endgames',
      }),
    ],
    quick: ['visualization', 'planWeek'],
  }),
  reply('planWeek', {
    mode: 'planner',
    tools: [tool('getPlayerProfile', 'goal 1600'), tool('getWeakThemes', 'forks, pins')],
    text: 'Here is a gentle week, about 20 minutes a day. I only set it if you say so.',
    attachments: [
      action({
        action: 'set-plan',
        title: 'This week',
        items: [
          'Mon · Royal fork puzzles',
          'Tue · K+R vs K drill',
          'Wed · Review Tuesday’s game',
          'Thu · Pins and skewers',
          'Fri · One game vs Stockfish',
        ],
      }),
    ],
    quick: ['queuePuzzles', 'pastSelf'],
  }),
  reply('note', {
    mode: 'open-qa',
    tools: [tool('getPlayerProfile', 'notes enabled')],
    text: 'Saving this one: **look at every check and capture first.**',
    attachments: [
      action({
        action: 'save-note',
        title: 'Save to notes',
        items: ['Look at every check and capture first, for both sides.'],
      }),
    ],
    quick: ['history'],
  }),
  reply('lesson', {
    mode: 'tutor',
    tools: [tool('getWeakThemes', 'pins ranked 2nd')],
    text: 'A short lesson on pins would suit you. Lessons are not open yet, so for now I can explain it here.',
    attachments: [
      action({
        action: 'open-lesson',
        title: 'Lesson: Pins',
        unavailable: 'Lessons are coming soon',
      }),
    ],
    quick: ['explainWhy'],
  }),
  reply('teacher', {
    mode: 'teacher',
    tools: [
      tool('analysePosition', '31 moves reviewed'),
      tool('getMistakeHistory', '2 mistakes, 1 blunder'),
    ],
    text: "You played a solid opening and led until move 17. Then one lapse: **the fork on f3**. That's the story, and the one lesson.",
    attachments: [
      {
        kind: 'position',
        fen: FORK_FEN,
        orientation: 'white',
        highlight: [toSquare('g5')],
        focus: [toSquare('f3')],
        arrows: [
          { from: toSquare('g5'), to: toSquare('f3'), kind: 'threat' },
          { from: toSquare('f3'), to: toSquare('g1'), kind: 'sage' },
          { from: toSquare('f3'), to: toSquare('e1'), kind: 'sage' },
        ],
        caption: 'Move 17: `…Nf3+` forks king and queen',
      },
    ],
    quick: ['patterns', 'mistakeBank'],
  }),
  reply('companion', {
    mode: 'companion',
    tools: [],
    text: "I stay quiet while you play. If you turn on **Blunder warning** in the options below, I'll speak up only when a move would hang material.",
    quick: ['openQa'],
  }),
  reply('openQa', {
    mode: 'open-qa',
    tools: [],
    text: '**En passant:** if a pawn moves two squares and lands beside your pawn, you may capture it as if it had moved one. You must do it right away, or the chance is gone.',
    quick: ['simpler', 'history'],
  }),
  reply('visualization', {
    mode: 'visualization',
    tools: [tool('getPlayerProfile', 'span ~3 moves')],
    text: "Let's stretch your picture a little. Read the line, then I'll hide the board.",
    attachments: [FOLLOW_LINE_CARD],
    quick: ['whatsHanging', 'blindChecks'],
  }),
  reply('whatsHanging', {
    mode: 'visualization',
    tools: [tool('positionFacts', 'one piece undefended')],
    text: 'One piece is undefended. Which one?',
    attachments: [WHATS_HANGING_CARD],
    quick: ['isItCheck', 'flashRecall'],
  }),
  reply('isItCheck', {
    mode: 'visualization',
    tools: [tool('legalMoves', 'check by line, not by guess')],
    text: 'Look at the move before you answer. Does it give check?',
    attachments: [IS_IT_CHECK_CARD],
    quick: ['whatsHanging', 'blindRoute'],
  }),
  reply('flashRecall', {
    mode: 'visualization',
    tools: [],
    text: 'You get a few seconds to look, then the pieces vanish and I ask where one of them was.',
    attachments: [FLASH_RECALL_CARD],
    quick: ['blindChecks', 'pickPicture'],
  }),
  reply('blindChecks', {
    mode: 'visualization',
    tools: [tool('legalMoves', 'checks computed')],
    text: 'Board hidden. Name every check White has.',
    attachments: [BLIND_CHECKS_CARD],
    quick: ['blindRoute', 'countExchange'],
  }),
  reply('blindRoute', {
    mode: 'visualization',
    tools: [tool('legalMoves', 'shortest route: 3')],
    text: 'Get the knight from `b1` to `g6` without seeing the board.',
    attachments: [BLIND_ROUTE_CARD],
    quick: ['blindChecks', 'flashRecall'],
  }),
  reply('countExchange', {
    mode: 'visualization',
    tools: [tool('playLine', 'exchange on e5 replayed')],
    text: 'Count attackers and defenders on `e5`. Who comes out ahead?',
    attachments: [COUNT_EXCHANGE_CARD],
    quick: ['pickPicture', 'whatsHanging'],
  }),
  reply('pickPicture', {
    mode: 'visualization',
    tools: [tool('playLine', 'line replayed')],
    text: 'Play the moves in your head. Which picture matches?',
    attachments: [PICK_PICTURE_CARD],
    quick: ['visualization', 'flashRecall'],
  }),
  reply('deepAnalysis', {
    mode: 'grandmaster',
    tools: [tool('analysePosition', 'queued · depth 26')],
    text: 'A deep run uses more of your key than a normal answer. I need a yes first.',
    attachments: [
      action({
        action: 'confirm-spend',
        title: 'Run a deep analysis',
        detail: 'Depth 26 plus a full write-up.',
      }),
    ],
    quick: ['grandmaster'],
  }),
  reply('providerError', {
    mode: 'open-qa',
    tools: [],
    text: '',
    failWith: 'Your provider did not answer. Nothing was lost; try again in a moment.',
  }),
]
