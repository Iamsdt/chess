import { createGame, detectOpening, playMoves } from '@/chess'
import { ok, type Color, type Fen, type Result } from '@/domain'

import {
  addLine,
  annotate,
  combineChanges,
  findBySanPath,
  type EditContext,
  type RepertoireTree,
  type TreeChange,
  type TreeEdit,
  DEFAULT_CONTEXT,
} from './tree'

/**
 * The catalogue of openings a player can add, and the small starter repertoire.
 *
 * Every entry is a few SAN lines from the start position; the name, ECO code and board
 * position come from the bundled ECO table by replaying the head moves, so the catalogue
 * cannot drift from the names the rest of the app shows. Style, difficulty and
 * popularity are editorial and sit here as data, not in a component.
 */

export type OpeningStyle = 'solid' | 'sharp'
export type OpeningDifficulty = 'Easy' | 'Medium' | 'Hard'

export interface OpeningSpec {
  readonly id: string
  readonly name: string
  readonly color: Color
  readonly style: OpeningStyle
  readonly difficulty: OpeningDifficulty
  /** How often players rated 1200 to 1600 choose it against the same first move, 0-100. */
  readonly popularity: number
  readonly tags: readonly string[]
  /** How many moves from the start the opening is named at. */
  readonly headMoves: number
  /** Full lines from the start; each should end on a move of the player's colour. */
  readonly lines: readonly string[]
  readonly notes?: readonly { readonly moves: string; readonly text: string }[]
}

export function splitMoves(line: string): string[] {
  return line
    .split(/\s+/)
    .map((token) => token.replace(/^\d+\.+/, ''))
    .filter((token) => token !== '')
}

export const OPENING_SPECS: readonly OpeningSpec[] = [
  {
    id: 'italian',
    name: 'Italian Game',
    color: 'white',
    style: 'solid',
    difficulty: 'Easy',
    popularity: 64,
    tags: ['solid', 'classical'],
    headMoves: 5,
    lines: [
      'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5 c3 d6 O-O',
      'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 d4',
      'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4',
    ],
    notes: [{ moves: 'e4 e5 Nf3 Nc6 Bc4', text: 'Aim at f7 and keep the centre flexible.' }],
  },
  {
    id: 'london',
    name: 'London System',
    color: 'white',
    style: 'solid',
    difficulty: 'Easy',
    popularity: 48,
    tags: ['solid', 'system'],
    headMoves: 1,
    lines: [
      'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2',
      'd4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Qb3 c4 Qc2',
      'd4 Nf6 Bf4 e6 e3 d5 Nf3 c5 c3 Nc6 Nbd2',
    ],
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    color: 'white',
    style: 'solid',
    difficulty: 'Hard',
    popularity: 58,
    tags: ['classical', 'strategic'],
    headMoves: 5,
    lines: ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3'],
  },
  {
    id: 'queens-gambit',
    name: "Queen's Gambit",
    color: 'white',
    style: 'solid',
    difficulty: 'Medium',
    popularity: 70,
    tags: ['solid', 'central'],
    headMoves: 3,
    lines: ['d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O'],
  },
  {
    id: 'english',
    name: 'English Opening',
    color: 'white',
    style: 'sharp',
    difficulty: 'Medium',
    popularity: 36,
    tags: ['flexible', 'strategic'],
    headMoves: 1,
    lines: ['c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2'],
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann Defence',
    color: 'black',
    style: 'solid',
    difficulty: 'Easy',
    popularity: 54,
    tags: ['solid', 'pawn chains'],
    headMoves: 2,
    lines: [
      'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5',
      'e4 c6 d4 d5 e5 Bf5 Nc3 e6 g4 Bg6',
      'e4 c6 d4 d5 e5 Bf5 h4 h5',
      'e4 c6 d4 d5 e5 Bf5 Bd3 Bxd3 Qxd3 e6',
      'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6',
      'e4 c6 Nc3 d5 Nf3 Bg4',
    ],
    notes: [
      {
        moves: 'e4 c6 d4 d5 e5 Bf5',
        text: 'The bishop gets out before …e6 locks it in.',
      },
    ],
  },
  {
    id: 'french',
    name: 'French Defence',
    color: 'black',
    style: 'solid',
    difficulty: 'Medium',
    popularity: 62,
    tags: ['solid', 'pawn chains'],
    headMoves: 2,
    lines: ['e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7'],
  },
  {
    id: 'najdorf',
    name: 'Sicilian Najdorf',
    color: 'black',
    style: 'sharp',
    difficulty: 'Hard',
    popularity: 78,
    tags: ['sharp', 'theory heavy'],
    headMoves: 10,
    lines: ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5'],
  },
  {
    id: 'qgd',
    name: "Queen's Gambit Declined",
    color: 'black',
    style: 'solid',
    difficulty: 'Medium',
    popularity: 52,
    tags: ['solid', 'classical'],
    headMoves: 4,
    lines: ['d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 Ne4'],
  },
  {
    id: 'slav',
    name: 'Slav Defence',
    color: 'black',
    style: 'solid',
    difficulty: 'Medium',
    popularity: 41,
    tags: ['solid', 'pawn chains'],
    headMoves: 4,
    lines: ['d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5'],
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian Defence',
    color: 'black',
    style: 'sharp',
    difficulty: 'Easy',
    popularity: 28,
    tags: ['direct', 'low theory'],
    headMoves: 2,
    lines: ['e4 d5 exd5 Qxd5 Nc3 Qa5 d4 c6 Nf3 Nf6'],
  },
  {
    id: 'kings-indian',
    name: "King's Indian Defence",
    color: 'black',
    style: 'sharp',
    difficulty: 'Hard',
    popularity: 44,
    tags: ['sharp', 'attacking'],
    headMoves: 4,
    lines: ['d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5'],
  },
]

/** The few openings offered when the repertoire is empty: one for each colour, plus London. */
export const STARTER_IDS: readonly string[] = ['italian', 'london', 'caro-kann']

export interface CatalogueEntry extends OpeningSpec {
  /** From the ECO table at the head position, e.g. `B10`. */
  readonly eco: string | null
  /** Display text such as `B10 · 1.e4 c6`. */
  readonly codeAndMoves: string
  /** Position at the head, for the board thumbnail. */
  readonly fen: Fen
}

function headMovesText(moves: readonly string[]): string {
  return moves
    .map((san, index) => (index % 2 === 0 ? `${String(index / 2 + 1)}.${san}` : san))
    .join(' ')
}

/** Resolves every spec against the ECO table; a spec whose head is not in it still lists. */
export function buildCatalogue(specs: readonly OpeningSpec[] = OPENING_SPECS): CatalogueEntry[] {
  const entries: CatalogueEntry[] = []
  for (const spec of specs) {
    const head = splitMoves(spec.lines[0] ?? '').slice(0, spec.headMoves)
    const started = createGame()
    if (!started.ok) continue
    const played = playMoves(started.value, head)
    if (!played.ok) continue
    const eco = detectOpening(played.value)?.eco ?? null
    entries.push({
      ...spec,
      eco,
      codeAndMoves: `${eco ?? '—'} · ${headMovesText(head.slice(0, 4))}`,
      fen: played.value.fen,
    })
  }
  return entries
}

/**
 * Writes an opening's lines into a tree and names its head.
 *
 * Why the head is named after the lines exist: the head is a node that has to exist
 * first, and naming it last keeps the whole seed one set of puts.
 */
export function materializeSpec(
  tree: RepertoireTree,
  spec: OpeningSpec,
  ctx: EditContext = DEFAULT_CONTEXT,
): Result<TreeEdit<null>> {
  let current = tree
  const changes: TreeChange[] = []
  for (const line of spec.lines) {
    const added = addLine(current, current.rootId, splitMoves(line), ctx)
    if (!added.ok) return added
    current = added.value.tree
    changes.push(added.value.change)
  }
  const first = splitMoves(spec.lines[0] ?? '')
  const head = findBySanPath(current, first.slice(0, spec.headMoves))
  if (head !== undefined) {
    const named = annotate(current, head.id, { openingName: spec.name, tags: spec.tags }, ctx)
    if (!named.ok) return named
    current = named.value.tree
    changes.push(named.value.change)
  }
  for (const note of spec.notes ?? []) {
    const target = findBySanPath(current, splitMoves(note.moves))
    if (target === undefined) continue
    const noted = annotate(current, target.id, { comment: note.text }, ctx)
    if (!noted.ok) return noted
    current = noted.value.tree
    changes.push(noted.value.change)
  }
  return ok({ tree: current, change: combineChanges(changes), value: null })
}

/** Search text matches the name, the ECO code and the moves, the three ways people recall one. */
export function matchesQuery(entry: CatalogueEntry, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    entry.name.toLowerCase().includes(needle) ||
    (entry.eco ?? '').toLowerCase().includes(needle) ||
    entry.codeAndMoves.toLowerCase().includes(needle) ||
    entry.tags.some((tag) => tag.toLowerCase().includes(needle))
  )
}
