import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import type { BoardMove } from '@/board'
import { createGame } from '@/chess'
import { defaultSettings, settingsRepo } from '@/data'
import { now } from '@/domain'
import type { Settings, Timestamp, Uci } from '@/domain'
import { scoreToMoverCentipawns } from '@/engine'

import { isLowTime } from './clock'
import { isEnginesTurn, isYourTurn, playReducer } from './machine'
import { defaultPlayStorage, loadResumableGame, saveGame } from './persistence'
import { usePlayPorts } from './ports'
import { createSoundPlayer, soundForMove } from './sounds'
import { chooseOpponentMove, planStrength, respondToDrawOffer } from './strength'

import type { PlayEvent, PlayState } from './machine'
import type { PlayStorage } from './persistence'
import type { SoundPlayer } from './sounds'

/**
 * The React half of the game: the reducer plus the four things that happen in
 * time — the engine thinking, the clock running, the autosave and the sounds.
 *
 * Every effect here is keyed on a *value* (the FEN, the ply count, whose turn it
 * is) rather than on the state object, so a clock tick cannot restart a search and
 * an engine reply cannot trigger a second autosave. That is the discipline that
 * keeps the takeback honest: cancel the search, rewind the reducer, and the next
 * render asks for a move from the position that is actually on the board.
 */

/** How deep the guard's background look goes. Deep enough to spot a hanging piece
 *  a move or two out, shallow enough that it is finished before the player is. */
const GUARD_DEPTH = 12
/** MultiPV for the guard: three candidate moves is enough to recognise a sacrifice. */
const GUARD_MULTI_PV = 3
/** The clock only needs to look alive; ten frames a second is plenty. */
const TICK_MS = 100
/** A draw answered instantly reads as a script, not an opponent. */
const DRAW_THINK_MS = 700

export type PlayLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly state: PlayState }

type StoreEvent =
  | PlayEvent
  | { readonly type: 'loaded'; readonly state: PlayState }
  | { readonly type: 'no-game' }
  | { readonly type: 'load-failed'; readonly message: string }

function storeReducer(load: PlayLoadState, event: StoreEvent): PlayLoadState {
  if (event.type === 'loaded') return { status: 'ready', state: event.state }
  if (event.type === 'no-game') return { status: 'empty' }
  if (event.type === 'load-failed') return { status: 'error', message: event.message }
  if (load.status !== 'ready') return load
  const next = playReducer(load.state, event)
  return next === load.state ? load : { status: 'ready', state: next }
}

/** Review bookkeeping, so the game-over dialog can say what happened to the job. */
export type ReviewQueueState =
  | { readonly status: 'idle' }
  | { readonly status: 'queued' }
  | { readonly status: 'failed'; readonly message: string }

export interface PlayGameActions {
  play: (move: BoardMove) => void
  confirmPending: () => void
  dismissPending: () => void
  takeback: () => void
  resign: () => void
  offerDraw: () => void
  claimDraw: () => void
}

export interface PlayGameController {
  readonly load: PlayLoadState
  readonly settings: Settings
  /** Re-rendered on every tick, so clock labels can be computed from it. */
  readonly nowMs: Timestamp
  readonly review: ReviewQueueState
  readonly actions: PlayGameActions
}

export interface UsePlayGameOptions {
  readonly storage?: PlayStorage
}

/** The stored evaluation seen from the engine's side of the board, which is the
 *  only point of view a draw offer can be judged from. */
function engineEvalOf(state: PlayState | null): number | null {
  if (state === null) return null
  const cp = state.evalCp
  if (cp === null) return null
  return state.config.youPlay === 'white' ? -cp : cp
}

export function usePlayGame(options: UsePlayGameOptions = {}): PlayGameController {
  const storage = options.storage ?? defaultPlayStorage
  const ports = usePlayPorts()
  const [load, dispatch] = useReducer(storeReducer, { status: 'loading' })
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [nowMs, setNowMs] = useState<Timestamp>(now)
  const [review, setReview] = useState<ReviewQueueState>({ status: 'idle' })

  const state = load.status === 'ready' ? load.state : null

  /* ---------------------------------------------------------------- settings */

  useEffect(() => {
    const leaving = new AbortController()
    void (async () => {
      try {
        const stored = await settingsRepo.get()
        if (!leaving.signal.aborted) setSettings(stored)
      } catch {
        // Storage that will not open is not a reason to refuse to play; the schema
        // defaults are the product's defaults.
      }
      if (!leaving.signal.aborted) setSettingsLoaded(true)
    })()
    return () => {
      leaving.abort()
    }
  }, [])

  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  /* ------------------------------------------------------------------ sounds */

  const soundsRef = useRef<SoundPlayer | null>(null)
  useEffect(() => {
    const player = createSoundPlayer({ settings: () => settingsRef.current.sound })
    soundsRef.current = player
    return () => {
      soundsRef.current = null
      player.close()
    }
  }, [])

  /* ------------------------------------------------------------------ resume */

  // The resume waits for settings because the three help toggles live there, and a
  // game resumed before they arrive would silently switch the training wheels back
  // on for a player who had turned them off.
  useEffect(() => {
    if (!settingsLoaded) return
    // An `AbortSignal` rather than a boolean: a `let` flag closed over by the
    // cleanup reads as always-false to the type checker, and a stale dispatch after
    // unmount is exactly what this guards against.
    const leaving = new AbortController()
    void (async () => {
      const play = settingsRef.current.play
      try {
        const resumed = await loadResumableGame(
          {
            trainingWheels: play.trainingWheels,
            showEvaluation: play.showEvaluation,
            allowTakebacks: play.allowTakebacks,
          },
          storage,
        )
        if (leaving.signal.aborted) return
        if (!resumed.ok) {
          dispatch({ type: 'load-failed', message: resumed.error.message })
          return
        }
        if (resumed.value === null) dispatch({ type: 'no-game' })
        else dispatch({ type: 'loaded', state: { ...resumed.value, phase: 'playing' } })
      } catch {
        if (leaving.signal.aborted) return
        dispatch({ type: 'load-failed', message: 'Your saved games could not be opened.' })
      }
    })()
    return () => {
      leaving.abort()
    }
    // Settings are read through a ref rather than as a dependency: a later change
    // to them must not restart the resume and throw away moves already made.
  }, [storage, settingsLoaded])

  /* ----------------------------------------------------------- the clock tick */

  const timed = state?.clock.timed ?? false
  const running = state?.phase === 'playing'
  // An untimed game has nothing to tick, so it does not pay for a timer at all.
  useEffect(() => {
    if (!running || !timed) return
    const handle = window.setInterval(() => {
      const at = now()
      setNowMs(at)
      dispatch({ type: 'tick', at })
    }, TICK_MS)
    return () => {
      window.clearInterval(handle)
    }
  }, [running, timed])

  /* -------------------------------------------------------- the engine's turn */

  const fen = state?.game.fen ?? null
  const engineToMove = state !== null && isEnginesTurn(state) && state.pending === null
  const opponentRating = state?.config.opponentRating ?? 0
  const personality = state?.config.personality ?? 'solid'

  useEffect(() => {
    if (!engineToMove || fen === null) return
    const position = createGame(fen)
    if (!position.ok) return
    const controller = new AbortController()
    const plan = planStrength(opponentRating, GUARD_MULTI_PV)
    dispatch({ type: 'engine-thinking', value: true })

    void ports.engine
      .bestMove(fen, {
        lane: 'play',
        movetimeMs: plan.movetimeMs,
        elo: plan.elo,
        personality,
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return
        dispatch({ type: 'engine-thinking', value: false })
        if (!result.ok || result.value.move === null) {
          if (!result.ok) {
            dispatch({ type: 'error', message: 'The engine could not answer that move.' })
          }
          return
        }
        const mover = position.value.turn
        const cp = scoreToMoverCentipawns(result.value.eval.score)
        dispatch({ type: 'engine-eval', evalCp: mover === 'white' ? cp : -cp })
        const choice = chooseOpponentMove(position.value, result.value.move, plan, ports.random)
        dispatch({ type: 'engine-move', uci: choice.uci, at: now() })
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: 'engine-thinking', value: false })
      })

    return () => {
      controller.abort()
    }
  }, [engineToMove, fen, opponentRating, personality, ports])

  /* ---------------------------------------- the guard's background look, lane 2 */

  const guardWanted = state !== null && isYourTurn(state) && state.config.trainingWheels

  useEffect(() => {
    if (!guardWanted || fen === null) return
    const controller = new AbortController()

    void (async () => {
      try {
        const stream = ports.engine.analyse(fen, {
          lane: 'interactive',
          multiPv: GUARD_MULTI_PV,
          depth: GUARD_DEPTH,
          signal: controller.signal,
        })
        for await (const lines of stream) {
          if (controller.signal.aborted) return
          const trusted: Uci[] = []
          for (const line of lines) {
            const first = line.pv[0]
            if (first !== undefined) trusted.push(first)
          }
          dispatch({ type: 'guard-context', trustedMoves: trusted })
          const best = lines[0]
          if (best !== undefined) {
            const cp = scoreToMoverCentipawns(best.score)
            dispatch({ type: 'engine-eval', evalCp: cp })
          }
        }
      } catch {
        // A guard without the engine is still a guard: the static check stands.
      }
    })()

    return () => {
      controller.abort()
    }
  }, [guardWanted, fen, ports])

  /* ------------------------------------------------------- the opponent's reply
   * to a draw offer */

  const drawPending = state?.drawOffer === 'pending'
  const engineEvalCp = engineEvalOf(state)
  const plyCount = state?.game.history.length ?? 0

  useEffect(() => {
    if (!drawPending) return
    const handle = window.setTimeout(() => {
      dispatch({
        type: 'draw-response',
        accepted: respondToDrawOffer(engineEvalCp, plyCount),
        at: now(),
      })
    }, DRAW_THINK_MS)
    return () => {
      window.clearTimeout(handle)
    }
  }, [drawPending, engineEvalCp, plyCount])

  /* ---------------------------------------------------------------- autosave */

  const saveKey =
    state === null
      ? ''
      : [state.gameId, state.game.history.length, state.phase, state.takebacks, state.result].join(
          ':',
        )
  const savedKey = useRef('')

  useEffect(() => {
    if (state === null || saveKey === '' || savedKey.current === saveKey) return
    savedKey.current = saveKey
    void saveGame(state, storage).then(
      (result) => {
        if (!result.ok) {
          dispatch({ type: 'error', message: 'This move could not be saved to your device.' })
        }
      },
      () => {
        dispatch({ type: 'error', message: 'This move could not be saved to your device.' })
      },
    )
  }, [saveKey, state, storage])

  /* ------------------------------------------------------------------ sounds */

  const playedPly = state?.game.history.length ?? 0
  const soundedPly = useRef(0)
  useEffect(() => {
    if (state === null) return
    if (playedPly === soundedPly.current) return
    const rewound = playedPly < soundedPly.current
    soundedPly.current = playedPly
    if (rewound) return
    const move = state.game.history[playedPly - 1]
    if (move !== undefined) soundsRef.current?.play(soundForMove(move))
  }, [playedPly, state])

  const phase = state?.phase ?? null
  useEffect(() => {
    if (phase === 'game-over') soundsRef.current?.play('game-end')
  }, [phase])

  const lowTime =
    state !== null &&
    state.phase === 'playing' &&
    isLowTime(state.clock, state.config.youPlay, nowMs)
  const warnedLowTime = useRef(false)
  useEffect(() => {
    if (!lowTime) {
      warnedLowTime.current = false
      return
    }
    if (warnedLowTime.current) return
    warnedLowTime.current = true
    soundsRef.current?.play('low-time')
  }, [lowTime])

  /* ------------------------------------------------------ queue the review once */

  const finishedGameId = state !== null && state.phase === 'game-over' ? state.gameId : null
  const queuedFor = useRef<string | null>(null)

  useEffect(() => {
    if (finishedGameId === null || queuedFor.current === finishedGameId) return
    queuedFor.current = finishedGameId
    void (async () => {
      const queued = await ports.queue.enqueueGameReview(finishedGameId)
      if (!queued.ok) {
        setReview({ status: 'failed', message: 'The review could not be queued yet.' })
        return
      }
      setReview({ status: 'queued' })
      // The library reads this to show "analysing" beside the game; a failure here
      // costs a label, not the review, so it is not worth telling the player about.
      try {
        await storage.games.setReviewState(finishedGameId, 'queued')
      } catch {
        // See above.
      }
    })().catch(() => {
      setReview({ status: 'failed', message: 'The review could not be queued yet.' })
    })
  }, [finishedGameId, ports, storage])

  /* ----------------------------------------------------------------- actions */

  const actions = useMemo<PlayGameActions>(
    () => ({
      play: (move) => {
        dispatch({
          type: 'user-move',
          move: {
            from: move.from,
            to: move.to,
            ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
          },
          at: now(),
        })
      },
      confirmPending: () => {
        dispatch({ type: 'confirm-pending', at: now() })
      },
      dismissPending: () => {
        dispatch({ type: 'dismiss-pending' })
      },
      takeback: () => {
        dispatch({ type: 'takeback', at: now() })
      },
      resign: () => {
        dispatch({ type: 'resign', at: now() })
      },
      offerDraw: () => {
        dispatch({ type: 'offer-draw' })
      },
      claimDraw: () => {
        dispatch({ type: 'claim-draw', at: now() })
      },
    }),
    [],
  )

  return { load, settings, nowMs, review, actions }
}
