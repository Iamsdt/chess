import { Link } from '@tanstack/react-router'
import { ArrowUpDown, Flag, Handshake, Scale, Swords, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import { detectOpening } from '@/chess'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useTheme,
} from '@/design'
import { emptyBoardShapes } from '@/domain'
import type { BoardShapes, Square } from '@/domain'

import { formatTimeControl, remainingAt } from './clock'
import { GameOverDialog } from './components/game-over-dialog'
import { GuardDialog } from './components/guard-dialog'
import { MoveList } from './components/move-list'
import { PlayerStrip } from './components/player-strip'
import {
  buildLegalMoveMap,
  canTakeBack,
  checkedKingSquare,
  claimableDrawOf,
  isYourTurn,
  promotesOn,
} from './machine'
import { usePlayGame } from './use-play-game'

import type { PlayStorage } from './persistence'
import type { ReactNode } from 'react'

/**
 * `/play/game` — the board, ported from `prototype/play.html`.
 *
 * The screen is deliberately thin: whose turn it is, which moves are legal, what
 * the clocks read and whether the game is over are all selectors over the
 * reducer's state. The only decisions made here are about pixels and copy.
 */

export interface PlayGameScreenProps {
  readonly storage?: PlayStorage
}

export function PlayGameScreen({ storage }: PlayGameScreenProps = {}) {
  const controller = usePlayGame(storage === undefined ? {} : { storage })
  const { load, settings, nowMs, review, actions } = controller
  const { pieceSet } = useTheme()
  const [resignOpen, setResignOpen] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)

  const state = load.status === 'ready' ? load.state : null
  const game = state?.game ?? null

  const legalMoves = useMemo(
    () => (game === null ? new Map<Square, readonly Square[]>() : buildLegalMoveMap(game)),
    [game],
  )
  const opening = useMemo(() => (game === null ? null : detectOpening(game)), [game])

  if (load.status === 'loading') {
    return (
      <Frame>
        <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
          Looking for a game in progress…
        </p>
      </Frame>
    )
  }

  if (load.status === 'error') {
    return (
      <Frame>
        <EmptyState
          className="mt-6"
          icon={Swords}
          title="That game could not be opened"
          description={load.message}
          action={
            <Button asChild>
              <Link to="/play">Set up a new game</Link>
            </Button>
          }
        />
      </Frame>
    )
  }

  if (state === null || game === null) {
    return (
      <Frame>
        <EmptyState
          className="mt-6"
          icon={Swords}
          title="No game in progress"
          description="Pick a level, a colour and a clock, and Stockfish will meet you at the board."
          action={
            <Button asChild>
              <Link to="/play">Set up a game</Link>
            </Button>
          }
        />
      </Frame>
    )
  }

  const you = state.config.youPlay
  const opponent = you === 'white' ? 'black' : 'white'
  const orientation = flipped ? opponent : you
  const yourTurn = isYourTurn(state)
  const claimable = claimableDrawOf(state)
  const lastMove = game.history[game.history.length - 1]
  const checkSquare = checkedKingSquare(game)

  /** One strip per colour, so flipping the board swaps who sits on top without
   *  the two strips drifting apart. */
  const strip = (side: typeof you) =>
    side === you ? (
      <PlayerStrip
        name={state.config.yourName}
        subtitle="Your side"
        isEngine={false}
        remainingMs={state.clock.timed ? remainingAt(state.clock, you, nowMs) : null}
        running={state.clock.runningFor === you}
        toMove={yourTurn}
      />
    ) : (
      <PlayerStrip
        name={`Stockfish ${String(state.config.opponentRating)}`}
        subtitle={`${state.config.personality} personality`}
        isEngine
        remainingMs={state.clock.timed ? remainingAt(state.clock, opponent, nowMs) : null}
        running={state.clock.runningFor === opponent}
        toMove={state.phase === 'playing' && !yourTurn}
      />
    )

  const shapes: BoardShapes = {
    ...emptyBoardShapes(),
    highlight:
      lastMove === undefined || !settings.board.highlightLastMove
        ? []
        : [lastMove.from, lastMove.to],
    check: checkSquare,
  }

  const announcement =
    state.phase === 'game-over'
      ? `Game over. ${state.result}.`
      : state.thinking
        ? 'Stockfish is thinking.'
        : lastMove === undefined
          ? ''
          : `${lastMove.color === you ? 'You played' : 'Stockfish played'} ${lastMove.san}.`

  const evalLabel =
    state.config.showEvaluation && state.evalCp !== null
      ? `${state.evalCp > 0 ? '+' : ''}${(state.evalCp / 100).toFixed(1)}`
      : null

  return (
    <Frame
      badges={
        <>
          <Badge variant="outline">{formatTimeControl(state.config.timeControl)}</Badge>
          {state.config.trainingWheels ? <Badge variant="soft">Training wheels</Badge> : null}
          {evalLabel === null ? null : (
            <Badge variant="muted" aria-label={`Evaluation ${evalLabel}`}>
              {evalLabel}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={flipped}
            onClick={() => {
              setFlipped((previous) => !previous)
            }}
          >
            <ArrowUpDown aria-hidden="true" />
            Flip
          </Button>
        </>
      }
      subtitle={`vs Stockfish ${String(state.config.opponentRating)} · ${state.config.personality}`}
    >
      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex justify-center" aria-label="Game board">
          <div className="w-full max-w-[min(100%,70vh)] space-y-2.5">
            {strip(orientation === you ? opponent : you)}
            <div className="overflow-hidden rounded-xl ring-1 ring-border">
              <Board
                fen={game.fen}
                orientation={orientation}
                movable={yourTurn && state.pending === null ? you : 'none'}
                legalMoves={legalMoves}
                isPromotion={(from, to) => promotesOn(game, from, to)}
                onMove={actions.play}
                shapes={shapes}
                coordinates={settings.board.coordinates}
                animationSpeed={settings.board.animation}
                pieceSet={pieceSet}
                label="Sparring board"
                announcement={announcement}
              />
            </div>
            {strip(orientation)}
            {state.error === null ? null : (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </div>
        </section>

        <Card className="flex min-h-0 flex-col overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold">{opening?.name ?? 'Out of book'}</div>
              <div className="text-xs text-muted-foreground">
                {opening?.eco ?? 'Your own game from here'}
              </div>
            </div>
          </div>

          <Tabs defaultValue="moves" className="min-h-0 flex-1">
            <TabsList className="mx-3 mt-2">
              <TabsTrigger value="moves">Moves</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>
            <TabsContent value="moves" className="min-h-0 flex-1 overflow-auto p-2">
              <MoveList moves={game.history} label="Moves played" />
            </TabsContent>
            <TabsContent value="options" className="min-h-0 flex-1 space-y-2 overflow-auto p-4">
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Training wheels, the evaluation and take-backs are set before the game on the setup
                screen, and stay fixed for the game so a decision cannot be changed after seeing the
                position.
              </p>
              <dl className="space-y-1 text-xs">
                <Row term="Training wheels" value={state.config.trainingWheels ? 'On' : 'Off'} />
                <Row term="Evaluation" value={state.config.showEvaluation ? 'Shown' : 'Hidden'} />
                <Row term="Take-backs" value={state.config.allowTakebacks ? 'Allowed' : 'Off'} />
                <Row term="Take-backs used" value={String(state.takebacks)} />
              </dl>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 border-t p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canTakeBack(state)}
                onClick={actions.takeback}
              >
                <Undo2 aria-hidden="true" />
                Take back
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={state.phase !== 'playing' || state.drawOffer === 'pending'}
                onClick={actions.offerDraw}
              >
                <Handshake aria-hidden="true" />
                Offer draw
              </Button>
            </div>
            {claimable === null ? null : (
              <Button variant="outline" size="sm" className="w-full" onClick={actions.claimDraw}>
                <Scale aria-hidden="true" />
                Claim the draw
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              disabled={state.phase !== 'playing'}
              onClick={() => {
                setResignOpen(true)
              }}
            >
              <Flag aria-hidden="true" />
              Resign
            </Button>
            <p aria-live="polite" className="min-h-4 text-center text-xs text-muted-foreground">
              {state.drawOffer === 'pending'
                ? 'Draw offered. Stockfish is considering it.'
                : state.drawOffer === 'declined'
                  ? 'Stockfish would rather play on.'
                  : ''}
            </p>
          </div>
        </Card>
      </div>

      <GuardDialog
        warning={state.pending?.warning ?? null}
        onPlayAnyway={actions.confirmPending}
        onChooseAgain={actions.dismissPending}
      />

      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resign this game?</DialogTitle>
            <DialogDescription>
              At this level most games turn on one move, so playing on is often worth it. The game
              is reviewed either way.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResignOpen(false)
              }}
            >
              Keep playing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setResignOpen(false)
                actions.resign()
              }}
            >
              Resign and review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GameOverDialog
        open={state.phase === 'game-over' && !gameOverDismissed}
        result={state.result}
        termination={state.termination}
        youPlay={you}
        review={review}
        onClose={() => {
          setGameOverDismissed(true)
        }}
      />
    </Frame>
  )
}

function Row({ term, value }: { readonly term: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

/** The screen's one `<h1>`, kept in a single place so every state renders it. */
function Frame({
  children,
  badges,
  subtitle,
}: {
  readonly children: ReactNode
  readonly badges?: ReactNode
  readonly subtitle?: string
}) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      <PageHeader
        eyebrow="Practice game"
        title="Sparring"
        {...(subtitle === undefined ? {} : { description: subtitle })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {badges}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/play">Setup</Link>
            </Button>
          </div>
        }
      />
      {children}
    </div>
  )
}
