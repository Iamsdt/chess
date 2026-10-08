import {
  START_FEN,
  toFen,
  toSan,
  toSquare,
  type BoardView,
  type VisualizationAttachment,
  type VisualizationExercise,
} from '@/domain'

/**
 * Visualization exercises (coach-agent.md §10.2). A fixture carries only the question's
 * inputs: fen, line and target. Answers are computed by replaying the line in
 * `@/coach/visualization/questions`, so none is stored here.
 */

interface CardInput {
  readonly exercise: VisualizationExercise
  readonly title: string
  readonly fen?: string
  readonly moves?: string
  readonly view: BoardView
  readonly level: number
  readonly square?: string
  readonly to?: string
  readonly move?: string
}

function card(input: CardInput): VisualizationAttachment {
  const { square, to, move } = input
  const target =
    square === undefined && to === undefined && move === undefined
      ? undefined
      : {
          ...(square === undefined ? {} : { square: toSquare(square) }),
          ...(to === undefined ? {} : { to: toSquare(to) }),
          ...(move === undefined ? {} : { move: toSan(move) }),
        }
  return {
    kind: 'visualization',
    exercise: input.exercise,
    title: input.title,
    fen: input.fen === undefined ? START_FEN : toFen(input.fen),
    orientation: 'white',
    moves: (input.moves ?? '')
      .split(' ')
      .filter((san) => san !== '')
      .map((san) => toSan(san)),
    view: input.view,
    level: input.level,
    ...(target === undefined ? {} : { target }),
  }
}

/** Ruy Lopez after 3...Nc6, with the Spanish bishop on the move. */
const RUY_AFTER_THREE = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'

/** Follow the bishop from f1 through five retreats and castling. */
export const FOLLOW_LINE_CARD = card({
  exercise: 'follow-line',
  title: 'Follow the bishop',
  fen: RUY_AFTER_THREE,
  moves: 'Bb5 a6 Ba4 Nf6 O-O Be7',
  view: 'frozen',
  level: 2,
  square: 'f1',
})

/** Twelve plies of the Ruy Lopez; only the bishop on a4 is attacked and unguarded. */
export const WHATS_HANGING_CARD = card({
  exercise: 'whats-hanging',
  title: "What's hanging?",
  moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5',
  view: 'blindfold',
  level: 3,
})

/** Is Bxc6 legal, and does it give check, after the Ruy Lopez main line? */
export const IS_IT_CHECK_CARD = card({
  exercise: 'is-it-check',
  title: 'Is it check?',
  moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7',
  view: 'partial',
  level: 3,
  move: 'Bxc6',
})

/** An early queen sortie: where did the white queen land? */
export const FLASH_RECALL_CARD = card({
  exercise: 'flash-recall',
  title: 'Flash recall',
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  view: 'flash',
  level: 2,
})

/** The same position hidden: every checking move for White. */
export const BLIND_CHECKS_CARD = card({
  exercise: 'blind-checks',
  title: 'Blind checks',
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  view: 'blindfold',
  level: 4,
})

/** A lone knight on b1 and a target square; the route is found by search, not stored. */
export const BLIND_ROUTE_CARD = card({
  exercise: 'blind-route',
  title: 'Blind route',
  fen: '7k/8/8/8/8/8/8/KN6 b - - 0 1',
  view: 'blindfold',
  level: 3,
  square: 'b1',
  to: 'g6',
})

/** Scotch-style pressure on e5: two attackers, one defender. */
export const COUNT_EXCHANGE_CARD = card({
  exercise: 'count-exchange',
  title: 'Count the exchange',
  moves: 'e4 e5 Nf3 Nc6 d4 Nf6',
  view: 'blindfold',
  level: 5,
  square: 'e5',
})

/** Queen's Gambit Declined, six plies, then three boards. */
export const PICK_PICTURE_CARD = card({
  exercise: 'pick-picture',
  title: 'Pick the picture',
  moves: 'd4 d5 c4 e6 Nc3 Nf6',
  view: 'frozen',
  level: 1,
})

/* ------------------------------------------------------------------ the ladder */

/** Rook ending (Lucena), five pieces: the "few pieces" rung. */
const LUCENA = '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1'
/** Berlin ending after the queens come off: the "some pieces" rung. */
const BERLIN = 'r1bk1b1r/ppp2ppp/2p5/4Pn2/8/5N2/PPP2PPP/RNB2RK1 w - - 0 9'

/** Twelve-ply lines the ladder shortens to the dial. Each tracked piece survives all twelve. */
export const LADDER_FOLLOW_LINES: readonly VisualizationAttachment[] = [
  card({
    exercise: 'follow-line',
    title: 'Follow the rook',
    fen: LUCENA,
    moves: 'Rd1+ Ke7 Rd4 Ra1 Kc7 Rc1+ Kb6 Rb1+ Kc6 Rc1+ Kb5 Rb1+',
    view: 'frozen',
    level: 3,
    square: 'c1',
  }),
  card({
    exercise: 'follow-line',
    title: 'Follow the king',
    fen: LUCENA,
    moves: 'Rd1+ Ke7 Rd4 Ra1 Kc7 Rc1+ Kb6 Rb1+ Kc6 Rc1+ Kb5 Rb1+',
    view: 'frozen',
    level: 3,
    square: 'b8',
  }),
  card({
    exercise: 'follow-line',
    title: 'Follow the knight',
    fen: BERLIN,
    moves: 'Nc3 Ke8 h3 h5 Bf4 Be7 Rad1 Be6 Ng5 Rh6 g3 Rg6',
    view: 'frozen',
    level: 5,
    square: 'f3',
  }),
  card({
    exercise: 'follow-line',
    title: 'Follow the rook',
    fen: BERLIN,
    moves: 'Nc3 Ke8 h3 h5 Bf4 Be7 Rad1 Be6 Ng5 Rh6 g3 Rg6',
    view: 'frozen',
    level: 5,
    square: 'a1',
  }),
  card({
    exercise: 'follow-line',
    title: 'Follow the rook',
    moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5',
    view: 'frozen',
    level: 6,
    square: 'h1',
  }),
  card({
    exercise: 'follow-line',
    title: 'Follow the knight',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5',
    view: 'frozen',
    level: 6,
    square: 'g1',
  }),
  card({
    exercise: 'follow-line',
    title: 'Follow the bishop',
    moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6',
    view: 'frozen',
    level: 6,
    square: 'c1',
  }),
]

/** The other exercises the ladder mixes in; their lines are not shortened. */
export const LADDER_EXTRAS: readonly VisualizationAttachment[] = [
  WHATS_HANGING_CARD,
  card({
    exercise: 'is-it-check',
    title: 'Is it check?',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4',
    view: 'partial',
    level: 4,
    move: 'Bxf7',
  }),
  card({
    exercise: 'whats-hanging',
    title: "What's hanging?",
    moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2',
    view: 'blindfold',
    level: 5,
  }),
  IS_IT_CHECK_CARD,
]

/** A Queen's Gambit position flashed for a few seconds: which squares on the e-file held a piece? */
export const FLASH_FILE_CARD = card({
  exercise: 'flash-recall',
  title: 'Flash recall: the e-file',
  fen: 'rnbq1rk1/ppp1bpp1/4pn1p/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 7',
  view: 'flash',
  level: 4,
  square: 'e1',
})

/** Black's e5 pawn with one attacker and one defender: Black holds. */
export const HOLD_EXCHANGE_CARD = card({
  exercise: 'count-exchange',
  title: 'Count the exchange',
  moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3',
  view: 'blindfold',
  level: 4,
  square: 'e5',
})

/** A bishop route across the board. */
export const BISHOP_ROUTE_CARD = card({
  exercise: 'blind-route',
  title: 'Blind route: bishop',
  fen: '7k/8/8/8/8/8/8/KB6 b - - 0 1',
  view: 'blindfold',
  level: 3,
  square: 'b1',
  to: 'g2',
})

/** "What stands on this square?" version of follow-the-line. */
export const WHAT_STANDS_CARD = card({
  exercise: 'follow-line',
  title: 'What stands there?',
  moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6',
  view: 'frozen',
  level: 3,
  to: 'f6',
})

/** Mock for Review's "Picture it": replay a missed line over a hidden board. */
export const PICTURE_IT_CARD = card({
  exercise: 'follow-line',
  title: 'Picture the line you missed',
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  moves: 'Ng5 d5 exd5 Na5 Bb5 c6 Be2',
  view: 'blindfold',
  level: 4,
  square: 'c4',
})

export const VISUALIZATION_FIXTURES: readonly VisualizationAttachment[] = [
  FOLLOW_LINE_CARD,
  WHATS_HANGING_CARD,
  IS_IT_CHECK_CARD,
  FLASH_RECALL_CARD,
  BLIND_CHECKS_CARD,
  BLIND_ROUTE_CARD,
  COUNT_EXCHANGE_CARD,
  PICK_PICTURE_CARD,
  FLASH_FILE_CARD,
  HOLD_EXCHANGE_CARD,
  BISHOP_ROUTE_CARD,
  WHAT_STANDS_CARD,
  PICTURE_IT_CARD,
  ...LADDER_FOLLOW_LINES,
  ...LADDER_EXTRAS,
]
