import { toFen, toSan, type CalcNode, type CalculationAttachment } from '@/domain'

/**
 * A hand-written calculation tree (coach-agent.md §9) for the mock UI.
 *
 * The position is the Two Knights after 5...Nxd5, White to move. The evals are
 * illustrative, not engine output; the moves are real and the fixture test replays
 * every line through `@/chess`. Centipawns are from White's point of view.
 */

interface NodeSpec {
  readonly id: string
  readonly parent: string | null
  readonly san: string
  readonly cp: number
  readonly tag: CalcNode['tag']
  readonly branchName?: string
  readonly idea?: string
  readonly stop?: CalcNode['stop']
}

const SPECS: readonly NodeSpec[] = [
  // Engine choice: take the centre while Black is undeveloped.
  {
    id: 'd4',
    parent: null,
    san: 'd4',
    cp: 20,
    tag: 'best',
    branchName: 'Open the centre',
    idea: 'Challenge e5 and keep the knight on g5 supported by tempo, not by a sacrifice.',
  },
  { id: 'd4-exd4', parent: 'd4', san: 'exd4', cp: 15, tag: 'best' },
  { id: 'd4-exd4-oo', parent: 'd4-exd4', san: 'O-O', cp: 20, tag: 'best' },
  { id: 'd4-exd4-oo-be7', parent: 'd4-exd4-oo', san: 'Be7', cp: 15, tag: 'good' },
  {
    id: 'd4-exd4-oo-be7-nf3',
    parent: 'd4-exd4-oo-be7',
    san: 'Nf3',
    cp: 15,
    tag: 'good',
    stop: 'quiet',
  },
  // Close second reply (within 0.5): Black develops instead of grabbing the pawn.
  { id: 'd4-bd6', parent: 'd4', san: 'Bd6', cp: 30, tag: 'good' },
  { id: 'd4-bd6-oo', parent: 'd4-bd6', san: 'O-O', cp: 30, tag: 'best' },
  { id: 'd4-bd6-oo-oo', parent: 'd4-bd6-oo', san: 'O-O', cp: 25, tag: 'good', stop: 'quiet' },

  // Engine choice: develop and trade the strong knight.
  {
    id: 'nc3',
    parent: null,
    san: 'Nc3',
    cp: 5,
    tag: 'good',
    branchName: 'Develop, then retreat',
    idea: 'Hit the d5 knight first; the g5 knight steps back once Black commits.',
  },
  { id: 'nc3-nxc3', parent: 'nc3', san: 'Nxc3', cp: 5, tag: 'best' },
  { id: 'nc3-nxc3-bxc3', parent: 'nc3-nxc3', san: 'bxc3', cp: 0, tag: 'good' },
  { id: 'nc3-nxc3-bxc3-be7', parent: 'nc3-nxc3-bxc3', san: 'Be7', cp: 0, tag: 'best' },
  {
    id: 'nc3-nxc3-bxc3-be7-nf3',
    parent: 'nc3-nxc3-bxc3-be7',
    san: 'Nf3',
    cp: 0,
    tag: 'only-move',
    stop: 'quiet',
  },

  // Engine choice: castle first, keep everything protected.
  {
    id: 'oo',
    parent: null,
    san: 'O-O',
    cp: 0,
    tag: 'good',
    branchName: 'Castle and wait',
    idea: 'Safe king first; the knight returns to f3 and nothing hangs.',
  },
  { id: 'oo-be7', parent: 'oo', san: 'Be7', cp: 0, tag: 'best' },
  { id: 'oo-be7-nf3', parent: 'oo-be7', san: 'Nf3', cp: 0, tag: 'only-move' },
  { id: 'oo-be7-nf3-oo', parent: 'oo-be7-nf3', san: 'O-O', cp: 0, tag: 'best' },
  { id: 'oo-be7-nf3-oo-d4', parent: 'oo-be7-nf3-oo', san: 'd4', cp: 0, tag: 'good', stop: 'quiet' },

  // Tempting: the Fried Liver sacrifice. Looks forcing, but Black keeps the extra piece.
  {
    id: 'nxf7',
    parent: null,
    san: 'Nxf7',
    cp: -170,
    tag: 'tempting',
    branchName: 'Fried Liver sacrifice',
    idea: 'Drag the king out with a knight sacrifice and hope the attack is faster than the defence.',
  },
  { id: 'nxf7-kxf7', parent: 'nxf7', san: 'Kxf7', cp: -170, tag: 'best' },
  { id: 'nxf7-kxf7-qf3', parent: 'nxf7-kxf7', san: 'Qf3+', cp: -160, tag: 'good' },
  { id: 'nxf7-kxf7-qf3-ke6', parent: 'nxf7-kxf7-qf3', san: 'Ke6', cp: -165, tag: 'only-move' },
  {
    id: 'nxf7-kxf7-qf3-ke6-nc3',
    parent: 'nxf7-kxf7-qf3-ke6',
    san: 'Nc3',
    cp: -165,
    tag: 'mistake',
  },
  {
    id: 'nxf7-kxf7-qf3-ke6-nc3-ncb4',
    parent: 'nxf7-kxf7-qf3-ke6-nc3',
    san: 'Ncb4',
    cp: -210,
    tag: 'best',
    stop: 'depth',
  },
]

const NODES: CalcNode[] = SPECS.map((spec) => ({
  id: spec.id,
  parentId: spec.parent,
  san: toSan(spec.san),
  eval: { cp: spec.cp },
  tag: spec.tag,
  ...(spec.branchName === undefined ? {} : { branchName: spec.branchName }),
  ...(spec.idea === undefined ? {} : { idea: spec.idea }),
  ...(spec.stop === undefined ? {} : { stop: spec.stop }),
}))

/** White to move after 5...Nxd5: the knight on g5 is the thing everyone wants to use. */
export const CALCULATION_CARD: CalculationAttachment = {
  kind: 'calculation',
  title: 'Sample tree: what should White play?',
  fen: toFen('r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6'),
  orientation: 'white',
  nodes: NODES,
  takeaway:
    'Three quiet moves hold the balance; the flashy knight sacrifice on f7 only drags the king into the open and loses a piece.',
}
