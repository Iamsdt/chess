import { toFen, type Color, type Fen } from '@/domain'

/**
 * The endgame drill library, as data.
 *
 * Why plain data and no logic: the runner judges any drill the same way from three
 * facts (where it starts, what "success" means, how many moves is par), so adding an
 * ending is adding one entry here and one FEN test, never a new code path.
 */

export const ENDGAME_CATEGORIES = ['basic', 'pawn', 'rook'] as const
export type EndgameCategory = (typeof ENDGAME_CATEGORIES)[number]

export const ENDGAME_CATEGORY_LABELS: Readonly<Record<EndgameCategory, string>> = {
  basic: 'Basic mates',
  pawn: 'Pawn endgames',
  rook: 'Rook endgames',
}

/**
 * What the player has to achieve.
 *
 * `mate` and `promote` are wins; `draw` is the defender's job (Philidor), where the
 * engine plays the attacker and the player holds.
 */
export type DrillGoal = 'mate' | 'promote' | 'draw'

export interface EndgameTechnique {
  readonly title: string
  readonly text: string
  readonly steps: readonly string[]
}

export interface EndgameDrill {
  readonly id: string
  readonly title: string
  readonly category: EndgameCategory
  readonly fen: Fen
  /** Which side the player moves; the engine takes the other. */
  readonly userColor: Color
  readonly goal: DrillGoal
  /**
   * Win goals: the most player moves that still earns three stars.
   * Draw goals: how many player moves to hold before the draw is secured.
   */
  readonly par: number
  readonly headline: string
  readonly technique: EndgameTechnique
}

/** Why `toFen` here and not in the tests: a typo fails at import, not at first click. */
export const ENDGAME_DRILLS: readonly EndgameDrill[] = [
  {
    id: 'kq-vs-k',
    title: 'K+Q vs K',
    category: 'basic',
    fen: toFen('8/8/3k4/8/8/8/4QK2/8 w - - 0 1'),
    userColor: 'white',
    goal: 'mate',
    par: 10,
    headline: 'Checkmate with K+Q vs K in 10 moves or fewer',
    technique: {
      title: 'The knight step',
      text: 'Keep your queen a knight jump away from the enemy king until it reaches the edge.',
      steps: [
        'Mirror the enemy king a knight jump away.',
        'Trap it on the back rank or file.',
        'Bring your king in for the final checkmate.',
      ],
    },
  },
  {
    id: 'kr-vs-k',
    title: 'K+R vs K',
    category: 'basic',
    fen: toFen('8/8/8/8/6k1/8/4RK2/8 w - - 8 5'),
    userColor: 'white',
    goal: 'mate',
    par: 14,
    headline: 'Checkmate with K+R vs K in 14 moves or fewer',
    technique: {
      title: 'Technique: the box',
      text: "Your rook on e2 is a fence. Black's king is boxed on the f, g and h files. Make the box smaller, one line at a time.",
      steps: [
        "Keep the fence. Don't give it up for a check.",
        'Walk your king up to protect the rook.',
        "Shrink the box whenever it's safe.",
      ],
    },
  },
  {
    id: 'two-bishops',
    title: 'Two bishops',
    category: 'basic',
    fen: toFen('8/8/3k4/8/8/8/4BB2/4K3 w - - 0 1'),
    userColor: 'white',
    goal: 'mate',
    par: 19,
    headline: 'Checkmate with two bishops against a lone king',
    technique: {
      title: 'The bishop wedge',
      text: 'Side-by-side bishops create an impassable barrier that drives the king into a corner.',
      steps: [
        'Keep the bishops adjacent to control diagonals.',
        'Use your king to take away remaining escape squares.',
        'Push the opponent into the corner for mate.',
      ],
    },
  },
  {
    id: 'opposition',
    title: 'Opposition',
    category: 'pawn',
    // Black to move: the engine has to give way first, and the player has to answer
    // each king step by taking the opposition again.
    fen: toFen('8/8/8/4k3/8/4K3/4P3/8 b - - 0 1'),
    userColor: 'white',
    goal: 'promote',
    par: 12,
    headline: 'Promote your pawn using direct king opposition',
    technique: {
      title: 'The direct opposition',
      text: 'Keep an odd number of squares between the kings to control key advance squares.',
      steps: [
        'Take opposition when possible.',
        'Outflank the enemy king when it steps aside.',
        'Escort your pawn safely to the 8th rank.',
      ],
    },
  },
  {
    id: 'rule-square',
    title: 'Rule of the square',
    category: 'pawn',
    fen: toFen('8/8/8/8/3P4/7k/8/K7 w - - 0 1'),
    userColor: 'white',
    goal: 'promote',
    par: 4,
    headline: 'Run the pawn home before the enemy king can catch it',
    technique: {
      title: 'Visualising the square',
      text: 'Count the squares from the pawn to the promotion rank to define the boundary square.',
      steps: [
        "Draw a square whose side is the pawn's distance to the promotion rank.",
        'If the enemy king cannot step into the box, push without hesitation.',
        'Queen before the king can intercept.',
      ],
    },
  },
  {
    id: 'lucena',
    title: 'Lucena',
    category: 'rook',
    fen: toFen('3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 1'),
    userColor: 'white',
    goal: 'promote',
    par: 10,
    headline: 'Win the rook ending by building a bridge with your rook',
    technique: {
      title: 'Building the bridge',
      text: 'Place the rook on the 4th rank to shield your king from checks upon exit.',
      steps: [
        'Cut the enemy king off along a file.',
        'Place your rook on the 4th rank.',
        'Step your king out and use the rook as a shield.',
      ],
    },
  },
  {
    id: 'philidor',
    title: 'Philidor',
    category: 'rook',
    fen: toFen('4k3/8/r7/3KP3/8/8/7R/8 w - - 0 1'),
    userColor: 'black',
    goal: 'draw',
    par: 15,
    headline: 'Hold the draw with the 6th-rank defensive barrier',
    technique: {
      title: 'The 6th-rank shield',
      text: 'Keep the rook on the 6th rank until the pawn pushes, then give checks from behind.',
      steps: [
        'Keep the rook on the 6th rank to prevent the enemy king from advancing.',
        'Once the pawn advances to the 6th rank, retreat your rook to the 1st rank.',
        'Deliver checks from behind the king indefinitely.',
      ],
    },
  },
]

export function endgameDrillById(id: string): EndgameDrill | undefined {
  return ENDGAME_DRILLS.find((drill) => drill.id === id)
}

/** The side the engine plays. */
export function defenderColor(drill: EndgameDrill): Color {
  return drill.userColor === 'white' ? 'black' : 'white'
}

/** One-line statement of the task, for the drill list and the board label. */
export function goalLabel(goal: DrillGoal): string {
  if (goal === 'mate') return 'Checkmate'
  if (goal === 'promote') return 'Promote'
  return 'Hold the draw'
}
