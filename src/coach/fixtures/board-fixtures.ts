import {
  toFen,
  toSan,
  toSquare,
  type Arrow,
  type ArrowKind,
  type CoachEval,
  type Fen,
  type HintsAttachment,
  type SageBoardAttachment,
  type SageBoardStep,
  type ThinkingAttachment,
} from '@/domain'

/**
 * Hand-written Sage board demonstrations. There is no engine behind them: the evals are
 * made up, but every SAN is legal from the step before it (a test replays all of them).
 *
 * They share one Italian Game family so the cards feel like one conversation:
 *   X: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d3 Bc5 5.c3 a6, White to play move 6.
 *   Z: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.Nc3 Ng4, White to play move 6.
 */

/** Position X: quiet Giuoco Pianissimo, White to move. */
const FEN_X = toFen('r1bqk2r/1ppp1ppp/p1n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6')
/** Position Z: Black's Bc5 and Ng4 both aim at f2, White to move. */
const FEN_Z = toFen('r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P1n1/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 3 6')
/** Z with Black to move: "if you pass", so Sage can play Black's threat on its own board. */
const FEN_Z_PASS = toFen('r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P1n1/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 3 6')
/** After 1.e4 e5 2.Nf3 Nc6 3.Bc4, Black to move. */
const FEN_ITALIAN = toFen('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3')

const sq = toSquare

const arrow = (from: string, to: string, kind: ArrowKind = 'sage'): Arrow => ({
  from: sq(from),
  to: sq(to),
  kind,
})

interface StepInput {
  readonly caption: string
  readonly san?: string
  readonly arrows?: readonly Arrow[]
  readonly focus?: readonly string[]
  readonly danger?: readonly string[]
  readonly controlMap?: boolean
  readonly eval?: CoachEval
  readonly yourTurn?: {
    readonly prompt: string
    readonly accept: readonly string[]
    readonly praise: string
    readonly retry: string
  }
}

/** Fills the schema defaults, so a fixture only says what a step adds. */
function step(input: StepInput): SageBoardStep {
  return {
    caption: input.caption,
    ...(input.san === undefined ? {} : { san: toSan(input.san) }),
    arrows: [...(input.arrows ?? [])],
    focus: (input.focus ?? []).map(sq),
    danger: (input.danger ?? []).map(sq),
    controlMap: input.controlMap ?? false,
    ...(input.eval === undefined ? {} : { eval: input.eval }),
    ...(input.yourTurn === undefined
      ? {}
      : {
          yourTurn: {
            prompt: input.yourTurn.prompt,
            accept: input.yourTurn.accept.map(toSan),
            praise: input.yourTurn.praise,
            retry: input.yourTurn.retry,
          },
        }),
  }
}

function board(
  card: SageBoardAttachment['card'],
  title: string,
  fen: Fen,
  steps: SageBoardStep[],
  versus?: { title: string; steps: SageBoardStep[] },
): SageBoardAttachment {
  return {
    kind: 'board',
    card,
    title,
    fen,
    orientation: 'white',
    view: 'normal',
    steps,
    ...(versus === undefined ? {} : { versus }),
  }
}

const cp = (value: number): CoachEval => ({ cp: value })

/* ---- What if Nxe5? --------------------------------------------------------------- */

export const WHAT_IF_CARD = board('what-if', 'What if Nxe5?', FEN_X, [
  step({
    caption: 'You are eyeing Nxe5. Let me try it on my board.',
    arrows: [arrow('f3', 'e5')],
    focus: ['e5'],
    eval: cp(25),
  }),
  step({
    san: 'Nxe5',
    caption: 'Nxe5 wins a pawn and eyes f7 and c6.',
    arrows: [arrow('e5', 'f7'), arrow('e5', 'c6')],
    eval: cp(30),
  }),
  step({
    san: 'Nxe5',
    caption: '...Nxe5. Nothing backs the knight up: a piece for a pawn.',
    arrows: [arrow('e5', 'c4', 'threat'), arrow('e5', 'd3', 'threat')],
    danger: ['c4', 'd3'],
    eval: cp(-240),
  }),
  step({
    caption: 'The bishop and d3 are both attacked.',
    arrows: [arrow('e5', 'c4', 'threat'), arrow('e5', 'd3', 'threat')],
    danger: ['c4', 'd3'],
    yourTurn: {
      prompt: 'Your move: how do you limit the damage?',
      accept: ['Bb3', 'd4'],
      praise: 'Fair. The bishop survives, though the knight is still gone.',
      retry: 'The bishop on c4 is still hanging. Try again.',
    },
  }),
])

/* ---- Threat ---------------------------------------------------------------------- */

export const THREAT_CARD = board('threat', 'What Black is threatening', FEN_Z_PASS, [
  step({
    caption: 'If you pass, two Black pieces hit f2.',
    arrows: [arrow('c5', 'f2', 'threat'), arrow('g4', 'f2', 'threat')],
    danger: ['f2'],
    eval: cp(-20),
  }),
  step({
    san: 'Bxf2+',
    caption: '...Bxf2+. The knight guards the bishop, so Kxf2 is illegal.',
    arrows: [arrow('g4', 'f2', 'threat')],
    danger: ['e1'],
    eval: cp(-90),
  }),
  step({
    san: 'Kf1',
    caption: 'The king steps aside. The f-pawn is gone.',
    danger: ['f1'],
    eval: cp(-130),
  }),
  step({
    san: 'Bb6',
    caption: 'Black keeps the pawn, and you cannot castle any more.',
    eval: cp(-180),
  }),
])

/* ---- Idea ------------------------------------------------------------------------ */

export const IDEA_CARD = board('idea', 'The calm plan', FEN_X, [
  step({
    caption: 'Plan: save the bishop, reroute a knight, then play d4.',
    arrows: [arrow('c4', 'b3')],
    focus: ['b3'],
  }),
  step({
    san: 'Bb3',
    caption: 'Bb3 keeps the bishop safe from ...b5.',
    arrows: [arrow('b3', 'f7')],
    eval: cp(25),
  }),
  step({ san: 'd6', caption: 'Black firms up e5.' }),
  step({
    san: 'Nbd2',
    caption: 'Nbd2 heads for f1 and g3.',
    arrows: [arrow('d2', 'f1')],
    eval: cp(25),
  }),
  step({ san: 'O-O', caption: 'Black castles.' }),
  step({
    san: 'Nf1',
    caption: 'Nf1, then Ng3 and d4 when the centre is ready.',
    arrows: [arrow('f1', 'g3'), arrow('d3', 'd4')],
    focus: ['d4'],
    eval: cp(30),
  }),
])

/* ---- Line ------------------------------------------------------------------------ */

export const LINE_CARD = board('line', 'The Giuoco Pianissimo', FEN_ITALIAN, [
  step({ san: 'Nf6', caption: 'Black develops with an eye on e4.', arrows: [arrow('f6', 'e4')] }),
  step({ san: 'd3', caption: 'd3 guards e4 and keeps things calm.', eval: cp(20) }),
  step({ san: 'Bc5', caption: 'Bc5 points at f2.', arrows: [arrow('c5', 'f2')] }),
  step({ san: 'c3', caption: 'c3 prepares d4.', arrows: [arrow('d3', 'd4')], eval: cp(20) }),
  step({ san: 'a6', caption: '...a6 asks the bishop where it is going.', focus: ['c4'] }),
  step({
    san: 'Bb3',
    caption: 'Bb3 keeps the bishop on the diagonal.',
    arrows: [arrow('b3', 'f7')],
  }),
  step({
    san: 'd6',
    caption: 'A solid, level position. Both sides have a long game ahead.',
    eval: cp(25),
  }),
])

/* ---- Compare --------------------------------------------------------------------- */

const D4_STEPS = [
  step({
    san: 'd4',
    caption: 'd4 hits the centre at once.',
    arrows: [arrow('d4', 'e5'), arrow('d4', 'c5')],
    eval: cp(10),
  }),
  step({ san: 'exd4', caption: '...exd4 opens the e-file and the bishop line.', eval: cp(10) }),
  step({ san: 'cxd4', caption: 'cxd4 and the bishop on c5 is attacked.', eval: cp(10) }),
  step({
    san: 'Bb4+',
    caption: '...Bb4+ with a check, and the e4 pawn has lost its guard.',
    arrows: [arrow('f6', 'e4', 'threat')],
    danger: ['e4'],
    eval: cp(-40),
  }),
]

export const COMPARE_CARD = board(
  'compare',
  'Bb3 or d4',
  FEN_X,
  [
    step({
      san: 'Bb3',
      caption: 'Bb3 saves the bishop and keeps everything protected.',
      arrows: [arrow('b3', 'f7')],
      eval: cp(25),
    }),
    step({
      san: 'd6',
      caption: 'A calm reply. White can build up slowly.',
      eval: cp(20),
    }),
  ],
  { title: 'd4', steps: D4_STEPS },
)

/* ---- Control map ----------------------------------------------------------------- */

export const CONTROL_MAP_CARD = board('idea', 'Who controls the centre', FEN_X, [
  step({
    caption: 'Green is White, purple is Black, gold is contested.',
    controlMap: true,
    focus: ['e5', 'd4'],
  }),
  step({
    san: 'Bb3',
    caption: 'Bb3 adds pressure on d5 and f7.',
    controlMap: true,
  }),
  step({
    san: 'd6',
    caption: '...d6 gives Black a second guard on e5.',
    controlMap: true,
    focus: ['e5'],
  }),
])

/* ---- Your turn ------------------------------------------------------------------- */

export const YOUR_TURN_CARD = board('threat', 'Find the defence', FEN_Z, [
  step({
    caption: "Black's bishop and knight both aim at f2.",
    arrows: [arrow('c5', 'f2', 'threat'), arrow('g4', 'f2', 'threat')],
    danger: ['f2'],
    eval: cp(-90),
  }),
  step({
    caption: 'Two attackers, one defender.',
    arrows: [arrow('c5', 'f2', 'threat'), arrow('g4', 'f2', 'threat')],
    danger: ['f2'],
    yourTurn: {
      prompt: 'Your move: add a defender to f2.',
      accept: ['O-O'],
      praise: 'Yes. Castling puts a rook on f1: two attackers, two defenders.',
      retry: 'Not quite. Count the defenders of f2 again.',
    },
  }),
])

/* ---- Grandmaster thinking -------------------------------------------------------- */

export const GM_THINKING: ThinkingAttachment = {
  kind: 'thinking',
  steps: [
    {
      step: 'assess',
      title: 'Assess',
      text: 'Level position. My king is still in the centre and Black eyes f2.',
    },
    {
      step: 'candidates',
      title: 'Candidates',
      text: 'Three moves worth a look: Bb3, d4 and O-O.',
      board: board('idea', 'Three candidates', FEN_X, [
        step({
          caption: 'Bb3, d4 or O-O.',
          arrows: [arrow('c4', 'b3'), arrow('d3', 'd4'), arrow('e1', 'g1')],
        }),
      ]),
    },
    {
      step: 'calculate',
      title: 'Calculate',
      text: 'd4 runs into ...exd4 and ...Bb4+. The e4 pawn drops.',
      board: board('line', 'Calculating d4', FEN_X, D4_STEPS),
    },
    {
      step: 'compare',
      title: 'Compare',
      text: 'Bb3 holds everything. d4 costs a pawn.',
      board: COMPARE_CARD,
    },
    {
      step: 'plan',
      title: 'Plan',
      text: 'Save the bishop, reroute a knight, play d4 when it is ready.',
    },
    {
      step: 'takeaway',
      title: 'Takeaway',
      text: 'Do the quiet useful thing first. Strike when the centre is covered.',
    },
  ],
}

/* ---- Hints ----------------------------------------------------------------------- */

export const HINTS_CARD: HintsAttachment = {
  kind: 'hints',
  fen: FEN_Z,
  orientation: 'white',
  levels: [
    { label: 'Nudge', text: 'Count the attackers and defenders on f2.', focus: [], arrows: [] },
    {
      label: 'Key square',
      text: 'Think about f1: a rook there guards f2.',
      focus: ['f1', 'g1'].map(sq),
      arrows: [],
    },
    {
      label: 'The move',
      text: 'Castle kingside: O-O.',
      focus: [],
      arrows: [arrow('e1', 'g1', 'best')],
    },
  ],
}
