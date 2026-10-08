import type { ShowcasePrompt } from '../showcase-prompts'

/**
 * The 77 Sage features from docs/sage-features.md, with how to see each one in the mock.
 *
 * Why a registry: the `/dev/sage` page and its test read the same table, so a feature added
 * to the doc without a demo shows up as a failing test rather than a gap nobody notices.
 */

export type SageFeatureStatus = 'mock' | 'waits-learn' | 'waits-friends' | 'later'

export interface SageFeature {
  readonly n: number
  readonly group: string
  readonly name: string
  readonly line: string
  readonly status: SageFeatureStatus
  /** The `SHOWCASE_PROMPTS` key that demos it. */
  readonly prompt?: ShowcasePrompt
  /** For UI-only features: where to click. */
  readonly where?: string
}

export const STATUS_LABEL: Record<SageFeatureStatus, string> = {
  mock: 'In the mock',
  'waits-learn': 'Waits for Learn',
  'waits-friends': 'Waits for Friends',
  later: 'Needs real provider',
}

interface Extra {
  prompt?: ShowcasePrompt
  where?: string
  status?: SageFeatureStatus
}

const G = {
  sees: 'Sees and checks',
  board: 'Shows on its own board',
  teaches: 'Teaches',
  knows: 'Knows you',
  acts: 'Acts in the app',
  modes: 'Modes',
  tree: 'Calculation tree',
  viz: 'Visualization',
  runtime: 'Runtime and safety',
} as const

const row = (n: number, group: string, name: string, line: string, extra: Extra): SageFeature => ({
  n,
  group,
  name,
  line,
  ...extra,
  status: extra.status ?? 'mock',
})

export const SAGE_FEATURES: readonly SageFeature[] = [
  row(
    1,
    G.sees,
    'Board awareness',
    'Knows the position, whose move it is and the moves that led here.',
    { prompt: 'idea' },
  ),
  row(
    2,
    G.sees,
    'Engine-backed claims',
    'Asks Stockfish before saying who is better; every number comes from an engine call.',
    { prompt: 'grandmaster' },
  ),
  row(
    3,
    G.sees,
    'Verified lines',
    'Replays every variation through the rules, so illegal lines never reach the screen.',
    { prompt: 'line' },
  ),
  row(
    4,
    G.sees,
    'Position facts',
    'Reads material, king safety, pawn structure, hanging pieces and open files.',
    { prompt: 'idea' },
  ),
  row(5, G.sees, 'Opening names', 'Names the opening and variation (ECO).', { prompt: 'line' }),

  row(
    6,
    G.board,
    'Board cards',
    'Posts a card with a preview and a title such as "What if Nxe5?"; it opens Sage\'s board in a dialog.',
    { prompt: 'whatIf' },
  ),
  row(
    7,
    G.board,
    'What if',
    "Plays your idea and the opponent's best reply, and marks the danger: the check, the fork, the hanging piece.",
    { prompt: 'whatIf' },
  ),
  row(8, G.board, 'Threats', 'Plays out what your opponent is threatening right now.', {
    prompt: 'threat',
  }),
  row(
    9,
    G.board,
    'Draws on its board',
    'Arrows, circles, highlights and danger squares, with one short caption per step.',
    { prompt: 'idea' },
  ),
  row(
    10,
    G.board,
    'Steps through lines',
    'Plays a variation move by move by itself, with play, pause, back and replay.',
    { prompt: 'line' },
  ),
  row(
    11,
    G.board,
    'Your turn',
    'Hands you the move inside the dialog ("how does Black stop this?") and reacts to it.',
    { prompt: 'yourTurn' },
  ),
  row(
    12,
    G.board,
    'Compare',
    'Shows two candidate moves one after the other, each with its evaluation.',
    { prompt: 'compare' },
  ),
  row(13, G.board, 'Control map', 'Shades the squares each side attacks and defends.', {
    prompt: 'controlMap',
  }),
  row(
    14,
    G.board,
    'Reopen later',
    'Cards stay in the chat; they can also open in the analysis board or go to the Mistake Bank.',
    { prompt: 'mistakeBank' },
  ),

  row(
    15,
    G.teaches,
    'Grandmaster thinking',
    'Walks through assess, candidates, calculate, compare, plan and takeaway on your position.',
    { prompt: 'grandmaster' },
  ),
  row(
    16,
    G.teaches,
    'Explains why',
    'Gives the idea behind a move in plain language, not just the move.',
    { prompt: 'explainWhy' },
  ),
  row(
    17,
    G.teaches,
    'Graded hints',
    'Nudge, then key square, then the move, never more than you asked for.',
    { prompt: 'hint' },
  ),
  row(
    18,
    G.teaches,
    'Adapts its level',
    'Explains to a 900 player differently than to a 1600 player.',
    { prompt: 'simpler' },
  ),
  row(19, G.teaches, 'Your language', 'Answers in the language you write in.', {
    prompt: 'language',
  }),

  row(
    20,
    G.knows,
    'Your history',
    'Reads your rating, weak themes, recent games, mistakes and repertoire.',
    { prompt: 'history' },
  ),
  row(
    21,
    G.knows,
    'Spots your patterns',
    '"This is the fourth time a knight fork got you after castling."',
    { prompt: 'patterns' },
  ),
  row(22, G.knows, 'Compares to your past self', `"You'd have missed this a month ago."`, {
    prompt: 'pastSelf',
  }),
  row(
    23,
    G.knows,
    'Similar positions',
    'Finds positions from your own games that look like this one.',
    { prompt: 'similar' },
  ),
  row(
    24,
    G.knows,
    'Session memory',
    "Doesn't repeat itself and follows up on what you just asked.",
    { prompt: 'hint' },
  ),
  row(
    25,
    G.knows,
    'Long-term memory',
    'Remembers your weaknesses and what it has already taught you, across sessions.',
    {
      status: 'later',
      where: 'Needs a real provider and stored memory; the mock forgets on reload.',
    },
  ),
  row(
    26,
    G.knows,
    'What Sage sees',
    'Shows exactly what was sent to the AI provider, and lets you clear any memory.',
    { where: "Click Details on the 'Sage sees' line under the panel header" },
  ),

  row(27, G.acts, 'Queue puzzles', 'Starts a puzzle set on a theme.', { prompt: 'queuePuzzles' }),
  row(28, G.acts, 'Add to Mistake Bank', 'Saves the current position for spaced review.', {
    prompt: 'mistakeBank',
  }),
  row(29, G.acts, 'Start a drill', 'Opens an endgame or board-vision drill.', { prompt: 'drill' }),
  row(
    30,
    G.acts,
    'Plan your training',
    "Proposes today's path and this week's plan from what is actually weak; you confirm.",
    { prompt: 'planWeek' },
  ),
  row(31, G.acts, 'Save notes', 'Keeps a takeaway in your notes.', { prompt: 'note' }),
  row(32, G.acts, 'Open a lesson', 'Opens a lesson at a step. Waits for the Learn redesign.', {
    prompt: 'lesson',
    status: 'waits-learn',
  }),

  row(
    33,
    G.modes,
    'Companion',
    'Silent during a game against the engine; warns only before you hang material, if you turned that on.',
    { prompt: 'companion' },
  ),
  row(
    34,
    G.modes,
    'Grandmaster',
    '"What should I play?" gets a full think-aloud analysis on the board.',
    { prompt: 'grandmaster' },
  ),
  row(35, G.modes, 'Teacher', 'After a game, tells its story and names the one lesson.', {
    prompt: 'teacher',
  }),
  row(
    36,
    G.modes,
    'Puzzle nudger',
    'Hints only while you solve, in three levels, with no spoilers.',
    { prompt: 'hint' },
  ),
  row(
    37,
    G.modes,
    'Visualization coach',
    'Runs the picture-it ladder: reads lines, hides the board, asks, and finds where your picture slipped.',
    { prompt: 'visualization' },
  ),
  row(38, G.modes, 'Planner', 'On Today and Growth, builds your path and weekly plan.', {
    prompt: 'planWeek',
  }),
  row(39, G.modes, 'Open Q&A', 'Answers any chess question from anywhere in the app.', {
    prompt: 'openQa',
  }),
  row(
    40,
    G.modes,
    'Tutor',
    "Explains a lesson's idea another way, never the answer. Waits for the Learn redesign.",
    {
      status: 'waits-learn',
      where: 'Click the mode chip in the panel header (Tutor is listed, not usable yet)',
    },
  ),
  row(41, G.modes, 'Paused', 'Turned off during a live game against a friend. Waits for Friends.', {
    status: 'waits-friends',
    where: 'Click the mode chip in the panel header to see the Paused state',
  }),

  row(
    42,
    G.tree,
    'Tree builder',
    "Draws the engine's tree of candidate moves and replies for any position, with no key needed.",
    { prompt: 'calculation' },
  ),
  row(
    43,
    G.tree,
    'Tempting moves',
    'Adds the natural-looking move that loses, because its refutation is often the lesson.',
    { prompt: 'calculation' },
  ),
  row(
    44,
    G.tree,
    'Branch narrator',
    'Names each branch and states its idea, from templates, or from the AI when a key is set.',
    { prompt: 'calculation' },
  ),
  row(
    45,
    G.tree,
    'Explore',
    'Opens the tree full screen with a board, move-by-move navigation and a side-by-side eval strip.',
    { prompt: 'calculation', where: 'Then press Open full screen on the tree card' },
  ),
  row(
    46,
    G.tree,
    'Test me',
    'You pick candidates and calculate them first; then the real tree is revealed and scored.',
    { where: 'Analysis → Calculation tree → Test me' },
  ),
  row(
    47,
    G.tree,
    'Visualize mode',
    'Keeps the pieces frozen while you calculate, so you train seeing the moves in your head.',
    { where: 'Analysis → Calculation tree → Test me → Visualize toggle' },
  ),
  row(
    48,
    G.tree,
    'Practise it',
    'Plays the position out against the engine, or saves it to the Mistake Bank.',
    { where: 'Analysis → Calculation tree → Test me → after the reveal' },
  ),
  row(
    49,
    G.tree,
    'Entry points',
    'Opens from the Analysis screen, from a card in the chat, and later from Review.',
    { prompt: 'calculation', where: 'Also Analysis → Calculation tree' },
  ),

  row(
    50,
    G.viz,
    'Board views',
    'Switches the board between normal, ghost, frozen, partial blindfold, blindfold and flash.',
    { prompt: 'visualization' },
  ),
  row(
    51,
    G.viz,
    'Follow the line',
    'Reads a 2–12 move line over a hidden board, then asks where a piece is or what stands on a square.',
    { prompt: 'visualization' },
  ),
  row(
    52,
    G.viz,
    "What's hanging",
    'After a hidden line, you name the pieces left undefended or attacked.',
    { prompt: 'whatsHanging' },
  ),
  row(
    53,
    G.viz,
    'Is it check',
    'After a hidden line, you say whether a named move is legal, and whether it gives check.',
    { prompt: 'isItCheck' },
  ),
  row(
    54,
    G.viz,
    'Flash recall',
    'Shows a position for a few seconds; you rebuild it or answer questions about it.',
    { prompt: 'flashRecall' },
  ),
  row(
    55,
    G.viz,
    'Blind checks and routes',
    'Finds every check, or the shortest knight or bishop route, without seeing the pieces.',
    { prompt: 'blindChecks' },
  ),
  row(
    56,
    G.viz,
    'Count the exchange',
    'Says who wins the trades on a square in a hidden position.',
    { prompt: 'countExchange' },
  ),
  row(
    57,
    G.viz,
    'Pick the picture',
    'Reads a line, then shows three boards; you pick the real one (for beginners).',
    { prompt: 'pickPicture' },
  ),
  row(
    58,
    G.viz,
    'Adaptive ladder',
    'Lengthens lines and removes more of the board as you succeed, and steps back when you miss.',
    { prompt: 'visualization' },
  ),
  row(
    59,
    G.viz,
    'Visualization span',
    "Tracks the longest line you can hold, shows it on Growth and pitches Sage's analysis to it.",
    { where: 'Growth → Visualization span' },
  ),
  row(
    60,
    G.viz,
    'Find the slip',
    'Shows the exact move where your picture left the real position.',
    { prompt: 'visualization' },
  ),
  row(
    61,
    G.viz,
    'Peek and slow replay',
    'Flashes the real position at the slip, replays it in ghost view, then asks again.',
    { prompt: 'visualization' },
  ),
  row(
    62,
    G.viz,
    'Anchor squares',
    'Lights up landmark squares, so you have something to hang the picture on.',
    { prompt: 'pickPicture' },
  ),
  row(
    63,
    G.viz,
    'Hidden answer key',
    "Keeps the answer out of Sage's context until you have answered, so it cannot spoil it.",
    { prompt: 'whatsHanging' },
  ),
  row(
    64,
    G.viz,
    'Picture it from Review',
    'Replays a line you missed in a game over a hidden board.',
    { where: 'Review → Picture it' },
  ),

  row(
    65,
    G.runtime,
    'Bring your own key',
    'Uses your own AI provider key, encrypted in the browser and never put in a prompt or a backup.',
    { status: 'later', where: 'Settings → AI coach (real encryption needs the runtime)' },
  ),
  row(
    66,
    G.runtime,
    'Provider choice',
    'Offers ready-made providers, plus any OpenAI-compatible endpoint.',
    { where: 'Settings → AI coach' },
  ),
  row(
    67,
    G.runtime,
    'Live streaming',
    'Shows text, tool calls and analysis cards as they are produced.',
    { prompt: 'deepAnalysis', status: 'later' },
  ),
  row(68, G.runtime, 'Stop instantly', 'Cancelling an answer stops the engine work too.', {
    prompt: 'deepAnalysis',
    where: 'Press Stop while Sage is writing',
  }),
  row(
    69,
    G.runtime,
    'Cost meter',
    'Shows the token and cost count per answer and per month, under a cap you set.',
    { where: 'Under each Sage answer, and the monthly meter in Sage sees → Details' },
  ),
  row(
    70,
    G.runtime,
    'Tool budget',
    'Limits tool calls and time per answer, so a loop cannot run away.',
    { status: 'later', where: 'Enforced by the real runtime; nothing to see in the mock' },
  ),
  row(
    71,
    G.runtime,
    'Spoiler guard',
    'Gives only hints on puzzles and lessons unless you ask outright for the answer.',
    { prompt: 'hint' },
  ),
  row(
    72,
    G.runtime,
    'Private by design',
    'Talks only to your chosen provider: no browsing and no server of ours.',
    { where: "Click Details on the 'Sage sees' line under the panel header" },
  ),
  row(
    73,
    G.runtime,
    'Asks before acting',
    'Suggests changes to settings or data, and anything destructive needs your confirmation.',
    { prompt: 'planWeek' },
  ),
  row(
    74,
    G.runtime,
    'Your board is yours',
    'Reads your position but has no tool that changes it; every demonstration runs on its own board.',
    { prompt: 'whatIf' },
  ),
  row(
    75,
    G.runtime,
    'Never interrupts',
    'Speaks only when asked, except the optional blunder warning.',
    { prompt: 'companion' },
  ),
  row(
    76,
    G.runtime,
    'Results set your rating',
    "Your rating comes from your results, never from the AI's opinion.",
    { prompt: 'pastSelf' },
  ),
  row(
    77,
    G.runtime,
    'Graceful failure',
    'If the key or provider fails, says what broke while the rest of the app keeps working.',
    { prompt: 'providerError' },
  ),
]
