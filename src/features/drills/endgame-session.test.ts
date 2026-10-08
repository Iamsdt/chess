import { describe, expect, it } from 'vitest'

import { createGame } from '@/chess'
import { toFen, toSquare } from '@/domain'

import { endgameDrillById, type EndgameDrill } from './endgame-drills'
import {
  canTakeBack,
  isDefenderTurn,
  isPromotionMove,
  isUserTurn,
  judgeDrill,
  kingSquareOf,
  legalMoveMap,
  moveListText,
  playDefenderMove,
  playUserMove,
  requestDefenderMove,
  startSession,
  starsForMoves,
  takeBack,
  type DrillSession,
} from './endgame-session'
import { scriptedEngine, silentEngine } from './test-support'

function drillById(id: string): EndgameDrill {
  const drill = endgameDrillById(id)
  if (drill === undefined) throw new Error(`No drill ${id}`)
  return drill
}

/** A drill on a custom position, keeping the real drill's goal and colours. */
function withFen(id: string, fen: string, overrides: Partial<EndgameDrill> = {}): EndgameDrill {
  return { ...drillById(id), fen: toFen(fen), ...overrides }
}

function begin(drill: EndgameDrill): DrillSession {
  const started = startSession(drill)
  if (!started.ok) throw new Error(started.error.message)
  return started.value
}

/** Plays a list of UCI moves, handing each to whichever side is to move. */
function playLine(drill: EndgameDrill, moves: readonly string[]): DrillSession {
  let session = begin(drill)
  for (const move of moves) {
    const next = isUserTurn(session) ? playUserMove(session, move) : playDefenderMove(session, move)
    if (!next.ok) throw new Error(`${move}: ${next.error.message}`)
    session = next.value
  }
  return session
}

describe('success and failure detection', () => {
  it('awards three stars for a mate inside par', () => {
    const drill = withFen('kq-vs-k', '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1', { par: 3 })
    const session = playLine(drill, ['g1g7'])
    expect(session.outcome).toEqual({
      kind: 'success',
      how: 'checkmate',
      moves: 1,
      stars: 3,
      overPar: false,
    })
  })

  it('calls a mate over par "technically won" with fewer stars', () => {
    // Qa1+ Kh7 Qg7#: two moves against a par of one.
    const drill = withFen('kq-vs-k', '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1', { par: 1 })
    const session = playLine(drill, ['g1a1', 'h8h7', 'a1g7'])
    expect(session.outcome).toEqual({
      kind: 'success',
      how: 'checkmate',
      moves: 2,
      stars: 2,
      overPar: true,
    })
  })

  it('ranks stars by how far over par the finish is', () => {
    expect(starsForMoves(10, 10)).toEqual({ stars: 3, overPar: false })
    expect(starsForMoves(8, 10)).toEqual({ stars: 3, overPar: false })
    expect(starsForMoves(11, 10)).toEqual({ stars: 2, overPar: true })
    expect(starsForMoves(13, 10)).toEqual({ stars: 2, overPar: true })
    expect(starsForMoves(14, 10)).toEqual({ stars: 1, overPar: true })
    expect(starsForMoves(40, 10)).toEqual({ stars: 1, overPar: true })
  })

  it('fails a win that ends in stalemate', () => {
    const drill = withFen('kq-vs-k', '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1')
    const session = playLine(drill, ['g1g6'])
    expect(session.game.status).toEqual({ kind: 'draw', reason: 'stalemate' })
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'stalemate', moves: 1 })
  })

  it('fails a win that is drawn by three-fold repetition', () => {
    const drill = withFen('kr-vs-k', '7k/8/8/8/8/8/8/R5K1 w - - 0 1', { par: 30 })
    const shuffle = ['a1a2', 'h8h7', 'a2a1', 'h7h8']
    const session = playLine(drill, [...shuffle, ...shuffle])
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'repetition', moves: 4 })
  })

  it('fails a win when the fifty-move clock runs out', () => {
    const drill = withFen('kr-vs-k', '7k/8/8/8/8/8/8/R5K1 w - - 99 80', { par: 30 })
    const session = playLine(drill, ['a1a2'])
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'fifty-move', moves: 1 })
  })

  it('fails a win that turns into insufficient material', () => {
    // The only pawn is lost and the kings cannot mate.
    const drill = withFen('opposition', '8/8/8/8/8/2k5/3P4/K7 b - - 0 1', { par: 10 })
    const session = playLine(drill, ['c3d2'])
    expect(session.outcome.kind).toBe('failed')
  })

  it('fails a win when the key piece is captured', () => {
    // A spare pawn keeps the position mateable, so the loss is judged on material.
    const drill = withFen('kq-vs-k', '8/8/8/8/8/3k4/7P/K1Q5 w - - 0 1')
    const session = playLine(drill, ['c1c3', 'd3c3'])
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'material-lost', moves: 1 })
  })

  it('fails a drill the player has been checkmated in', () => {
    const drill = withFen('kq-vs-k', '6k1/8/8/8/8/8/5PPP/r5K1 w - - 0 1')
    const game = createGame(drill.fen)
    expect(game.ok && judgeDrill(drill, game.value)).toEqual({
      kind: 'failed',
      reason: 'checkmated',
      moves: 0,
    })
  })

  it('does not count a promotion until the defender has replied', () => {
    const drill = drillById('rule-square')
    const afterPromotion = playLine(drill, [
      'd4d5',
      'h3g4',
      'd5d6',
      'g4f5',
      'd6d7',
      'f5e6',
      'd7d8q',
    ])
    expect(afterPromotion.outcome).toEqual({ kind: 'playing' })

    const afterReply = playDefenderMove(afterPromotion, 'e6e5')
    expect(afterReply.ok && afterReply.value.outcome).toEqual({
      kind: 'success',
      how: 'promotion',
      moves: 4,
      stars: 3,
      overPar: false,
    })
  })

  it('fails a promotion whose queen is taken at once', () => {
    const drill = withFen('rule-square', '8/3Pk3/8/8/8/8/P7/K7 w - - 0 1', { par: 9 })
    const session = playLine(drill, ['d7d8q', 'e7d8'])
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'material-lost', moves: 1 })
  })

  it('refuses moves out of turn and after the drill is over', () => {
    const drill = withFen('kq-vs-k', '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1')
    const session = begin(drill)
    expect(playDefenderMove(session, 'h8h7').ok).toBe(false)

    const done = playLine(drill, ['g1g7'])
    expect(isUserTurn(done)).toBe(false)
    expect(isDefenderTurn(done)).toBe(false)
    expect(playUserMove(done, 'f7f6').ok).toBe(false)
    expect(playUserMove(session, 'g1g1').ok).toBe(false)
  })
})

describe('drawing drills (Philidor)', () => {
  const philidor = drillById('philidor')
  const shuffle = ['h2h1', 'a6a7', 'h1h2', 'a7a6']

  it('counts a three-fold repetition as the draw being held', () => {
    const session = playLine(philidor, [...shuffle, ...shuffle])
    expect(session.outcome).toEqual({
      kind: 'success',
      how: 'drawn',
      moves: 4,
      stars: 3,
      overPar: false,
    })
  })

  it('counts surviving to par as holding, for fewer stars', () => {
    const short = { ...philidor, par: 2 }
    const midway = playLine(short, shuffle)
    expect(midway.outcome).toEqual({ kind: 'playing' })

    const held = playLine(short, [...shuffle, 'h2h1'])
    expect(held.outcome).toEqual({
      kind: 'success',
      how: 'held',
      moves: 2,
      stars: 2,
      overPar: false,
    })
  })

  it('succeeds when the defender wins the pawn and material is level', () => {
    const drill = { ...philidor, fen: toFen('4k3/8/8/4P3/8/8/6KR/4r3 b - - 0 1') }
    const session = playLine(drill, ['e1e5'])
    expect(session.outcome).toEqual({
      kind: 'success',
      how: 'drawn',
      moves: 1,
      stars: 3,
      overPar: false,
    })
  })

  it('fails when the attacker wins the defender’s rook', () => {
    const session = playLine(philidor, ['h2h1', 'a6h6', 'h1h6'])
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'material-lost', moves: 1 })
  })

  it('fails when the defender is checkmated', () => {
    const drill = { ...philidor, fen: toFen('7k/8/6K1/8/8/8/2P5/R6r w - - 0 1') }
    const session = playLine(drill, ['a1a8'])
    expect(session.outcome).toEqual({ kind: 'failed', reason: 'checkmated', moves: 0 })
  })
})

describe('the session around the rules', () => {
  it('lets the engine open when it is the engine’s turn', async () => {
    const opposition = begin(drillById('opposition'))
    expect(isDefenderTurn(opposition)).toBe(true)
    expect(isUserTurn(opposition)).toBe(false)

    const engine = scriptedEngine(['e5f5'])
    const next = await requestDefenderMove(opposition, engine)
    expect(next.ok && isUserTurn(next.value)).toBe(true)
    expect(engine.asked).toEqual([opposition.game.fen])
  })

  it('surfaces an engine that has nothing to say', async () => {
    const opposition = begin(drillById('opposition'))
    const result = await requestDefenderMove(opposition, scriptedEngine([]))
    expect(result.ok).toBe(false)
  })

  it('rejects an engine move that is illegal in the position', async () => {
    const opposition = begin(drillById('opposition'))
    const result = await requestDefenderMove(opposition, scriptedEngine(['a1a2']))
    expect(result.ok).toBe(false)
  })

  it('does not call the engine while it is the player’s turn', async () => {
    const session = begin(drillById('kq-vs-k'))
    const engine = scriptedEngine(['d6d7'])
    const result = await requestDefenderMove(session, engine)
    expect(result.ok).toBe(false)
  })

  it('passes full strength on the play lane', () => {
    const calls: unknown[] = []
    const engine = {
      bestMove: (...args: Parameters<typeof silentEngine.bestMove>) => {
        calls.push(args[1])
        return silentEngine.bestMove(...args)
      },
    }
    void requestDefenderMove(begin(drillById('opposition')), engine)
    expect(calls).toEqual([{ lane: 'play', elo: null, movetimeMs: 350 }])
  })

  it('takes back the player’s move and the reply together', () => {
    const drill = drillById('kq-vs-k')
    const start = begin(drill)
    expect(canTakeBack(start)).toBe(false)
    expect(takeBack(start).ok).toBe(false)

    const played = playLine(drill, ['e2e4', 'd6d7'])
    expect(canTakeBack(played)).toBe(true)
    const undone = takeBack(played)
    expect(undone.ok && undone.value.game.fen).toBe(start.game.fen)
  })

  it('keeps the engine’s opening move when taking back the first reply', () => {
    const drill = drillById('opposition')
    const played = playLine(drill, ['e5f5', 'e3d3', 'f5e5'])
    const undone = takeBack(played)
    expect(undone.ok && undone.value.game.history.map((move) => move.uci)).toEqual(['e5f5'])
  })

  it('offers the board exactly the player’s legal moves', () => {
    const session = begin(drillById('kq-vs-k'))
    const map = legalMoveMap(session)
    expect([...map.keys()].sort()).toEqual(['e2', 'f2'])
    expect(map.get(toSquare('e2'))).toContain(toSquare('e8'))

    const engineTurn = begin(drillById('opposition'))
    expect(legalMoveMap(engineTurn).size).toBe(0)
  })

  it('knows when a move promotes', () => {
    const session = begin(withFen('rule-square', '8/3P4/8/8/8/6k1/8/K7 w - - 0 1'))
    expect(isPromotionMove(session, toSquare('d7'), toSquare('d8'))).toBe(true)
  })

  it('prints the move list with Black-first numbering', () => {
    const played = playLine(drillById('opposition'), ['e5f5', 'e3d3', 'f5e5', 'e2e4'])
    expect(moveListText(played.game.history)).toBe('1...Kf5 2.Kd3 Ke5 3.e4')
  })

  it('finds the king for the mate highlight', () => {
    const session = begin(drillById('kq-vs-k'))
    expect(kingSquareOf(session.game.fen, 'white')).toBe('f2')
    expect(kingSquareOf(session.game.fen, 'black')).toBe('d6')
  })
})

describe('every drill, played one exchange against a scripted engine', () => {
  // [drill, the moves in order, starting with whoever moves first]
  const openings: readonly (readonly [string, readonly string[]])[] = [
    ['kq-vs-k', ['e2e4', 'd6d7']],
    ['kr-vs-k', ['e2e3', 'g4f5']],
    ['two-bishops', ['e1d2', 'd6d5']],
    ['opposition', ['e5f5', 'e3d3', 'f5e5']],
    ['rule-square', ['d4d5', 'h3g4']],
    ['lucena', ['e1c1', 'a2a8']],
    ['philidor', ['h2h1', 'a6a7']],
  ]

  it.each(openings)('%s plays through and stays unfinished', async (id, moves) => {
    const drill = drillById(id)
    let session = begin(drill)
    const engineMoves = moves.filter((_, index) => {
      // Alternate from whoever opens: the engine's moves are every other entry.
      const engineOpens = !isUserTurn(begin(drill))
      return engineOpens ? index % 2 === 0 : index % 2 === 1
    })
    const engine = scriptedEngine(engineMoves)

    for (const move of moves) {
      if (isDefenderTurn(session)) {
        const reply = await requestDefenderMove(session, engine)
        expect(reply.ok).toBe(true)
        if (!reply.ok) return
        session = reply.value
      } else {
        const next = playUserMove(session, move)
        expect(next.ok).toBe(true)
        if (!next.ok) return
        session = next.value
      }
    }
    expect(session.outcome.kind).toBe('playing')
    expect(session.game.history.length).toBe(moves.length)
  })
})
