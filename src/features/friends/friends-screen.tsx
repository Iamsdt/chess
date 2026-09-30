import { Link } from '@tanstack/react-router'
import {
  Copy,
  HelpCircle,
  Hourglass,
  LayoutGrid,
  Link as LinkIcon,
  MessageSquareText,
  RadioTower,
  ShieldCheck,
  Swords,
  UserPlus,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Board } from '@/board'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
  toast,
} from '@/design'
import { emptyBoardShapes, toFen, toSquare, type BoardShapes, type Fen } from '@/domain'

const HERO_FEN_1: Fen = toFen('rnb1kb1r/1p3ppp/pq1ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R w KQkq - 1 8')
const HERO_FEN_2: Fen = toFen('r4r1k/pp1b2pp/1qnp4/2p1p1N1/2Q1P3/2PP4/PP4PP/R1B1R2K w - - 0 18')
const RAFI_GAME_FEN: Fen = toFen(
  'rnb1kb1r/1p3ppp/pq1ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R w KQkq - 1 8',
)

export interface RecentFriendItem {
  readonly id: string
  readonly name: string
  readonly initials: string
  readonly colorClass: string
  readonly subtitle: string
}

const RECENT_FRIENDS: readonly RecentFriendItem[] = [
  {
    id: 'rafi',
    name: 'Rafi',
    initials: 'RA',
    colorClass: 'bg-[#e9a15a] text-[#3b1d00]',
    subtitle: '6 games · 2 wins, 1 draw, 3 losses',
  },
  {
    id: 'mina',
    name: 'Mina',
    initials: 'MN',
    colorClass: 'bg-sky text-sky-ink',
    subtitle: '2 games · last played 3 weeks ago',
  },
  {
    id: 'tomas',
    name: 'Tomás',
    initials: 'TO',
    colorClass: 'bg-lilac text-lilac-ink',
    subtitle: 'Sent you a puzzle · 5 days ago',
  },
]

/**
 * Friends Hub Screen (`/friends`) — ported from `prototype/friends.html`.
 *
 * Provides:
 * - Direct link-based play (no account barrier)
 * - Active correspondence & live games status
 * - Share links generators (position, challenge, annotated game)
 * - Correspondence explainer & security notes
 * - Recent opponents list with quick rematch invites
 * - Interactive invite modal with time control and side selectors
 */
export function FriendsScreen() {
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteTimeControl, setInviteTimeControl] = useState<'5+3' | '10+5' | '15+10' | 'link'>(
    '10+5',
  )
  const [inviteColor, setInviteColor] = useState<'white' | 'black' | 'random'>('white')
  const [hasActiveInvite, setHasActiveInvite] = useState(true)

  const rafiBoardShapes: BoardShapes = useMemo(
    () => ({
      ...emptyBoardShapes(),
      highlight: [toSquare('d8'), toSquare('b6')],
    }),
    [],
  )

  const handleCopy = (text: string, toastMessage: string) => {
    try {
      void navigator.clipboard.writeText(text)
    } catch {
      // Clipboard write can fail or be unavailable in insecure contexts or jsdom
    }
    toast(toastMessage)
  }

  const handleCancelInvite = () => {
    setHasActiveInvite(false)
    toast('Invite cancelled')
  }

  const handleOpenInvite = () => {
    setIsInviteOpen(true)
  }

  return (
    <div className="page pb-12">
      <header>
        <p className="label">No accounts. Just links.</p>
        <h1 className="page-title mt-1">Friends</h1>
      </header>

      {/* Hero */}
      <section className="card mt-6 overflow-hidden" aria-labelledby="invite-h">
        <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_220px] md:p-8">
          <div>
            <span className="badge border-transparent bg-lilac text-lilac-ink">
              <LinkIcon className="size-3.5" aria-hidden="true" />
              Play anyone, anywhere
            </span>
            <h2
              id="invite-h"
              className="mt-3 text-2xl leading-tight font-bold sm:text-[30px] sm:leading-[1.05]"
            >
              Send a link. Play a friend.
            </h2>
            <p className="mt-2 max-w-[46ch] text-sm text-muted-foreground">
              They open it and you're playing. No sign-up for either of you, and it works across any
              network.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button className="btn-cta min-h-[44px] w-full sm:w-auto" onClick={handleOpenInvite}>
                <UserPlus className="size-[18px]" aria-hidden="true" />
                Invite a friend
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-11 min-h-[44px] w-full text-muted-foreground sm:w-auto"
              >
                <a href="#how">
                  <HelpCircle className="size-4" aria-hidden="true" />
                  How it works
                </a>
              </Button>
            </div>
          </div>
          <div className="relative hidden h-[200px] self-center md:block" aria-hidden="true">
            <div className="absolute top-0 right-2 w-36 rotate-6 overflow-hidden rounded-xl shadow-lg ring-1 ring-border">
              <Board
                fen={HERO_FEN_1}
                coordinates={false}
                movable="none"
                label="Sample game position 1"
              />
            </div>
            <div className="absolute top-12 left-0 w-36 -rotate-3 overflow-hidden rounded-xl shadow-xl ring-1 ring-border">
              <Board
                fen={HERO_FEN_2}
                coordinates={false}
                movable="none"
                label="Sample game position 2"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Active games */}
      <section className="@container mt-8" aria-labelledby="active-h">
        <div className="flex items-baseline justify-between">
          <h2 id="active-h" className="text-xl font-bold">
            Active games
          </h2>
          <span className="text-xs text-muted-foreground">
            {hasActiveInvite ? '2 open' : '1 open'}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-1 md:grid-cols-2 @[760px]:grid-cols-2">
          {/* Ongoing game vs Rafi */}
          <Link
            to="/friends/live"
            className="card card-hover flex items-center gap-3.5 border-cta/30 p-3.5 transition-all sm:gap-4 sm:p-4"
          >
            <div className="w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-border sm:w-20">
              <Board
                fen={RAFI_GAME_FEN}
                coordinates={false}
                movable="none"
                shapes={rafiBoardShapes}
                label="Correspondence game vs Rafi, Black played Qb6"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="avatar size-6 shrink-0 bg-[#e9a15a] text-[10px] font-bold text-[#3b1d00]">
                  RA
                </span>
                <span className="truncate text-sm font-semibold">Your move vs Rafi</span>
                <span className="badge badge-cta ml-auto shrink-0">Your move</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Najdorf, Poisoned Pawn · he played{' '}
                <span className="font-mono font-medium whitespace-nowrap text-foreground">
                  …Qb6
                </span>{' '}
                2h ago
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                Correspondence · move 8{' '}
                <span className="inline-flex items-center gap-1.5 font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  Rafi is online now
                </span>
              </p>
            </div>
          </Link>

          {/* Pending Invite Card */}
          {hasActiveInvite ? (
            <div className="card flex items-center gap-3.5 p-3.5 sm:gap-4 sm:p-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed bg-muted/40 text-muted-foreground sm:size-20">
                <Hourglass className="size-5 sm:size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">Invite waiting</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2 animate-pulse rounded-full bg-reward"
                      aria-hidden="true"
                    />
                    Waiting
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  chessking.app/play/k7x9q
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  10 + 5 · you're White · sent 12 min ago
                </p>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[36px]"
                    onClick={() => {
                      handleCopy('https://chessking.app/play/k7x9q', 'Link copied')
                    }}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-[36px] text-muted-foreground"
                    onClick={handleCancelInvite}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card flex items-center justify-center p-6 text-center text-sm text-muted-foreground sm:p-8">
              No other active invites. Send one below!
            </div>
          )}
        </div>
      </section>

      {/* Share links */}
      <section className="@container mt-8" aria-labelledby="share-h">
        <div className="flex items-baseline justify-between">
          <h2 id="share-h" className="text-xl font-bold">
            Share a link
          </h2>
          <span className="text-xs text-muted-foreground">Everything lives inside the link</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 @[640px]:grid-cols-3">
          {/* A position */}
          <article className="card flex flex-col p-4 sm:p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-sky text-sky-ink">
              <LayoutGrid className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-base font-bold">A position</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              "What would you play here?" From any board, one tap.
            </p>
            <div className="mt-auto pt-4">
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px] w-full sm:w-auto"
                onClick={() => {
                  handleCopy('https://chessking.app/share#pos=sample', 'Position link copied')
                }}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copy last position
              </Button>
            </div>
          </article>

          {/* A challenge */}
          <article className="card flex flex-col bg-reward-soft/60 p-4 sm:p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-reward text-[#5a3f00]">
              <Zap className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-base font-bold">A challenge</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              "Beat my Puzzle Rush: 23." Or send a puzzle you solved.
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px] flex-1 sm:flex-initial"
                onClick={() => {
                  handleCopy(
                    'https://chessking.app/share#rush=23',
                    'Challenge link copied · Puzzle Rush 23',
                  )
                }}
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copy challenge
              </Button>
              <Button asChild size="sm" variant="ghost" className="min-h-[36px]">
                <Link to="/share">Preview</Link>
              </Button>
            </div>
          </article>

          {/* An annotated game */}
          <article className="card flex flex-col p-4 sm:col-span-2 sm:p-5 md:col-span-1">
            <span className="grid size-10 place-items-center rounded-xl bg-lilac text-lilac-ink">
              <MessageSquareText className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-base font-bold">An annotated game</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your game with your notes and Sage's, as a link anyone can step through.
            </p>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="min-h-[36px] flex-1 sm:flex-initial"
              >
                <Link to="/games">Pick a game</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="min-h-[36px]">
                <Link to="/share">Preview</Link>
              </Button>
            </div>
          </article>
        </div>
      </section>

      {/* Explainer + Recent friends */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Correspondence explainer */}
        <section
          id="how"
          className="card scroll-mt-6 bg-accent/50 p-4 sm:p-6"
          aria-labelledby="how-h"
        >
          <h2 id="how-h" className="text-lg font-bold">
            Correspondence, by link
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For friends who can't play at the same time.
          </p>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card font-display text-xs font-bold ring-1 ring-border">
                1
              </span>
              <span>Make your move. Chess King turns the whole game into a link.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card font-display text-xs font-bold ring-1 ring-border">
                2
              </span>
              <span>Send it any way you like: WhatsApp, email, a text.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-card font-display text-xs font-bold ring-1 ring-border">
                3
              </span>
              <span>
                Your friend opens it, plays a move and sends a new link back. Take a day if you
                like.
              </span>
            </li>
          </ol>
          <p className="mt-4 flex gap-2 rounded-xl bg-card p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Live games go through a tiny relay that only passes moves along. Nothing is stored,
              and there's nobody to sign up with.
            </span>
          </p>
        </section>

        {/* Recent friends */}
        <section className="card p-4 sm:p-6" aria-labelledby="rf-h">
          <div className="flex items-center justify-between">
            <h2 id="rf-h" className="text-lg font-bold">
              Recent friends
            </h2>
            <span className="text-xs text-muted-foreground">Saved on this device</span>
          </div>
          <ul className="mt-3 divide-y text-sm">
            {RECENT_FRIENDS.map((friend) => (
              <li key={friend.id} className="flex items-center gap-3 py-2.5">
                <span className={cn('avatar text-xs font-bold', friend.colorClass)}>
                  {friend.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{friend.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {friend.subtitle}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 sm:size-8"
                  aria-label={`Invite ${friend.name}`}
                  onClick={handleOpenInvite}
                >
                  <Swords className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Just names you've played. No contacts, no profiles, no feed.
          </p>
        </section>
      </div>

      {/* Invite Modal Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-h-[92dvh] max-w-[min(560px,calc(100vw-32px))] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Invite a friend</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Send the link. The game starts when they open it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 pt-2 sm:grid-cols-[minmax(0,1fr)_132px]">
            <div className="space-y-4">
              {/* Time control selector */}
              <div className="space-y-1.5">
                <span className="field-label block text-xs font-medium" id="tc-label">
                  Time control
                </span>
                <div className="seg flex-wrap gap-1" role="group" aria-labelledby="tc-label">
                  <button
                    type="button"
                    className={cn(
                      inviteTimeControl === '5+3' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteTimeControl('5+3')
                    }}
                  >
                    5 + 3
                  </button>
                  <button
                    type="button"
                    className={cn(
                      inviteTimeControl === '10+5' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteTimeControl('10+5')
                    }}
                  >
                    10 + 5
                  </button>
                  <button
                    type="button"
                    className={cn(
                      inviteTimeControl === '15+10' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteTimeControl('15+10')
                    }}
                  >
                    15 + 10
                  </button>
                  <button
                    type="button"
                    className={cn(
                      inviteTimeControl === 'link' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteTimeControl('link')
                    }}
                  >
                    By link
                  </button>
                </div>
              </div>

              {/* Side selector */}
              <div className="space-y-1.5">
                <span className="field-label block text-xs font-medium" id="side-label">
                  You play
                </span>
                <div className="seg flex-wrap gap-1" role="group" aria-labelledby="side-label">
                  <button
                    type="button"
                    className={cn(
                      inviteColor === 'white' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteColor('white')
                    }}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    className={cn(
                      inviteColor === 'black' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteColor('black')
                    }}
                  >
                    Black
                  </button>
                  <button
                    type="button"
                    className={cn(
                      inviteColor === 'random' && 'is-active',
                      'min-h-[36px] flex-1 sm:flex-initial',
                    )}
                    onClick={() => {
                      setInviteColor('random')
                    }}
                  >
                    Random
                  </button>
                </div>
              </div>

              {/* Link + Copy */}
              <div className="space-y-1.5">
                <label
                  htmlFor="invite-link-input"
                  className="field-label block text-xs font-medium"
                >
                  Your link
                </label>
                <div className="flex gap-2">
                  <Input
                    id="invite-link-input"
                    className="min-h-[40px] font-mono text-[13px]"
                    value="chessking.app/play/k7x9q"
                    readOnly
                  />
                  <Button
                    type="button"
                    className="min-h-[40px] shrink-0 px-4"
                    onClick={() => {
                      handleCopy(
                        'https://chessking.app/play/k7x9q',
                        'Link copied. Send it to your friend.',
                      )
                    }}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    Copy
                  </Button>
                </div>
              </div>
            </div>

            {/* QR code */}
            <figure className="text-center">
              <svg
                viewBox="0 0 21 21"
                className="mx-auto size-[120px] rounded-lg bg-card p-1.5 ring-1 ring-border sm:size-[132px]"
                shapeRendering="crispEdges"
                role="img"
                aria-label="QR code for the invite link"
              >
                <g fill="currentColor">
                  <path d="M0 0h7v7H0zM1 1v5h5V1zM2 2h3v3H2z" fillRule="evenodd" />
                  <path d="M14 0h7v7h-7zM15 1v5h5V1zM16 2h3v3h-3z" fillRule="evenodd" />
                  <path d="M0 14h7v7H0zM1 15v5h5v-5zM2 16h3v3H2z" fillRule="evenodd" />
                  <path d="M8 0h1v1H8zM10 0h2v1h-2zM9 2h1v2H9zM11 2h1v1h-1zM8 4h1v2H8zM10 5h2v1h-2zM12 4h1v1h-1zM8 8h2v1H8zM11 8h1v2h-1zM13 8h2v1h-2zM16 8h1v1h-1zM18 8h3v1h-3zM0 8h1v2H0zM2 8h3v1H2zM5 9h1v2H5zM1 10h2v1H1zM3 11h1v2H3zM0 12h2v1H0zM6 12h2v1H6zM8 10h1v3H8zM10 10h2v1h-2zM9 12h3v1H9zM13 10h1v2h-1zM15 9h1v3h-1zM17 10h2v1h-2zM20 10h1v2h-1zM12 12h1v1h-1zM16 12h3v1h-3zM8 14h1v2H8zM10 14h1v1h-1zM12 14h2v1h-2zM15 14h1v1h-1zM17 14h2v2h-2zM20 14h1v1h-1zM9 16h2v1H9zM12 16h1v2h-1zM14 16h2v1h-2zM8 18h2v1H8zM11 19h1v2h-1zM13 18h1v1h-1zM15 18h1v3h-1zM17 17h1v1h-1zM19 17h2v1h-2zM18 19h1v1h-1zM20 19h1v2h-1zM9 20h1v1H9zM13 20h1v1h-1zM17 20h1v1h-1z" />
                </g>
              </svg>
              <figcaption className="mt-1.5 text-xs text-muted-foreground">
                Scan to open on a phone
              </figcaption>
            </figure>
          </div>

          <div className="mt-4 flex gap-2 rounded-xl bg-accent/60 p-3 text-xs text-muted-foreground">
            <RadioTower className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Works on any network through a tiny relay. Only moves pass through, nothing is stored.
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
