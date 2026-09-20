/**
 * S04 · The screen registry — one entry per page in `prototype/`, plus the dev route.
 *
 * Everything the shell needs to frame a screen (which sidebar entry is current, whether
 * the board layout claims the width, what Sage is allowed to see) is data here rather
 * than a prop threaded through every page, so a feature sprint replaces a placeholder
 * component without touching the shell.
 */

/** Sidebar entries. Several screens share one entry, exactly as in the prototype. */
export type NavId =
  | 'home'
  | 'play'
  | 'puzzles'
  | 'learn'
  | 'mistakes'
  | 'games'
  | 'analysis'
  | 'openings'
  | 'friends'
  | 'progress'
  | 'settings'

/** Board screens hand their width to the board, so the nav collapses to the rail sooner. */
export type ScreenLayout = 'page' | 'board'

/** Onboarding and the dev routes render without the shell, as they do in the prototype. */
export type ScreenFrame = 'shell' | 'bare'

/** How the Sage panel starts on a screen. `none` means the screen has no panel at all. */
export type ChatAvailability = 'open' | 'closed' | 'none'

export interface ChatScreen {
  /** The "Sage sees: …" line under the panel header. */
  readonly context?: string
  /** Label of the chip pinned to the composer, e.g. "Current position". */
  readonly attach?: string
  /** Banner explaining why the panel is quiet here (timed modes, live games). */
  readonly note?: string
  /** Quick-reply suggestions above the composer. */
  readonly quick: readonly string[]
  readonly initial: ChatAvailability
}

/** The subset the shell frame needs. The 404 and error screens are this and no more. */
export interface ShellScreen {
  readonly id: string
  /** `<h1>` and the document title. */
  readonly title: string
  readonly nav: NavId | null
  readonly layout: ScreenLayout
  readonly chat: ChatScreen
}

export interface Screen extends ShellScreen {
  readonly id: ScreenId
  readonly path: string
  /** One calm sentence: what the screen is for. Used by the placeholder and the palette. */
  readonly description: string
  readonly frame: ScreenFrame
  /** The prototype page this screen is ported from — the visual source of truth. */
  readonly prototype?: string
  /** The sprint that replaces the placeholder with the real screen. */
  readonly sprint?: string
}

export type ScreenId =
  | 'today'
  | 'play-setup'
  | 'play-game'
  | 'puzzles'
  | 'puzzle'
  | 'puzzle-rush'
  | 'session-summary'
  | 'learn'
  | 'lesson'
  | 'endgames'
  | 'vision'
  | 'mistakes'
  | 'games'
  | 'review'
  | 'analysis'
  | 'openings'
  | 'opening-drill'
  | 'friends'
  | 'live'
  | 'share'
  | 'progress'
  | 'settings'
  | 'onboarding'
  | 'kitchen-sink'

export const SCREENS = {
  today: {
    id: 'today',
    path: '/',
    title: 'Today',
    description: "The day's path: what to practise next and how far along you are.",
    nav: 'home',
    frame: 'shell',
    layout: 'page',
    prototype: 'index.html',
    sprint: 'S24',
    chat: {
      initial: 'open',
      context: "your last 9 games · today's path",
      attach: "Today's plan",
      quick: ['What should I work on?', 'Plan my week', 'Explain simply'],
    },
  },
  'play-setup': {
    id: 'play-setup',
    path: '/play',
    title: 'New game',
    description: 'Pick a level, a personality and a clock before sparring with Stockfish.',
    nav: 'play',
    frame: 'shell',
    layout: 'page',
    prototype: 'play-setup.html',
    sprint: 'S12',
    chat: {
      initial: 'open',
      context: 'your last 10 games vs Stockfish · results by level',
      attach: 'Game setup',
      quick: [
        'Which level should I pick?',
        "What does 'Tricky' play like?",
        'Should I play untimed?',
      ],
    },
  },
  'play-game': {
    id: 'play-game',
    path: '/play/game',
    title: 'Sparring',
    description: 'A game against the engine, with clocks, takeback and the blunder guard.',
    nav: 'play',
    frame: 'shell',
    layout: 'board',
    prototype: 'play.html',
    sprint: 'S12',
    chat: {
      initial: 'open',
      context: "live game · move 7 · you're White · eval hidden",
      attach: 'Current position',
      quick: ["What's the plan here?", 'Is my position OK?', 'What does Black want?'],
    },
  },
  puzzles: {
    id: 'puzzles',
    path: '/puzzles',
    title: 'Puzzles',
    description: 'Your puzzle rating, theme mastery and the next adaptive session.',
    nav: 'puzzles',
    frame: 'shell',
    layout: 'page',
    prototype: 'puzzles.html',
    sprint: 'S14',
    chat: {
      initial: 'open',
      context: 'puzzle rating 1482 · theme mastery · last 30 days',
      attach: 'Puzzle stats',
      quick: ['Why forks today?', "What's my weakest theme?", 'How does adaptive work?'],
    },
  },
  puzzle: {
    id: 'puzzle',
    path: '/puzzles/solve',
    title: 'Puzzle',
    description: 'The solver: one position at a time, with a hint ladder that costs rating.',
    nav: 'puzzles',
    frame: 'shell',
    layout: 'board',
    prototype: 'puzzle.html',
    sprint: 'S14',
    chat: {
      initial: 'open',
      context: 'puzzle 4 of 10 · White to play · answer hidden (No spoilers)',
      attach: 'Puzzle 4 of 10',
      quick: ['Give me a nudge', 'What should I look at first?', 'Explain after I solve it'],
    },
  },
  'puzzle-rush': {
    id: 'puzzle-rush',
    path: '/puzzles/rush',
    title: 'Puzzle Rush',
    description: 'Timed mode: solve as many as you can before the clock or your lives run out.',
    nav: 'puzzles',
    frame: 'shell',
    layout: 'board',
    prototype: 'puzzle-rush.html',
    sprint: 'S14',
    chat: {
      initial: 'closed',
      context: 'Puzzle Rush · 3 min · score 17 · answers hidden',
      attach: 'This rush',
      note: 'Chat is closed during timed modes so you can focus. Sage will recap your misses when the clock stops.',
      quick: ['Recap my misses', 'Why did I lose time?', 'Which theme slowed me down?'],
    },
  },
  'session-summary': {
    id: 'session-summary',
    path: '/puzzles/summary',
    title: 'Session complete',
    description: 'What the session moved, what it cost you and what tomorrow should be.',
    nav: 'puzzles',
    frame: 'shell',
    layout: 'page',
    prototype: 'session-summary.html',
    sprint: 'S24',
    chat: {
      initial: 'open',
      context: 'this session · 10 puzzles + 5 mistake reviews · 4:12',
      attach: 'This session',
      quick: ['What did I get better at?', 'Why did I miss puzzle 3?', 'What should tomorrow be?'],
    },
  },
  learn: {
    id: 'learn',
    path: '/learn',
    title: 'Learn',
    description: 'The course map: tracks, units and where you left off.',
    nav: 'learn',
    frame: 'shell',
    layout: 'page',
    prototype: 'learn.html',
    sprint: 'S16',
    chat: {
      initial: 'open',
      context: 'your course map · 5 tracks · weak spots from your last 9 games',
      attach: 'Course map',
      quick: ['What should I learn next?', 'Why this order?', 'I only have 10 minutes'],
    },
  },
  lesson: {
    id: 'lesson',
    path: '/learn/lesson',
    title: 'Lesson',
    description: 'A lesson you play rather than read, one expected move at a time.',
    nav: 'learn',
    frame: 'shell',
    layout: 'board',
    prototype: 'lesson.html',
    sprint: 'S16',
    chat: {
      initial: 'open',
      context: 'lesson: Royal fork · step 3 of 7 · White to move · no spoilers',
      attach: 'Lesson step 3',
      quick: ['Explain differently', 'Another example', 'Why does this work?'],
    },
  },
  endgames: {
    id: 'endgames',
    path: '/drills/endgames',
    title: 'Endgame drills',
    description: 'Technique against an engine that defends properly, scored against par.',
    nav: 'learn',
    frame: 'shell',
    layout: 'board',
    prototype: 'endgames.html',
    sprint: 'S18',
    chat: {
      initial: 'open',
      context: 'endgame drill · K+R vs K · move 5 of par 16 · Stockfish defends',
      attach: 'Current position',
      quick: [
        'Explain the box again',
        "Why can't I just chase the king?",
        'How do I finish from here?',
      ],
    },
  },
  vision: {
    id: 'vision',
    path: '/drills/vision',
    title: 'Board vision',
    description: 'Square names, checks and knight routes, against a clock.',
    nav: 'puzzles',
    frame: 'shell',
    layout: 'board',
    prototype: 'vision.html',
    sprint: 'S18',
    chat: {
      initial: 'closed',
      context: 'Board vision · Name the square · score 14 · coordinates off',
      note: 'Chat is closed during timed drills. Open it any time; the clock keeps running.',
      quick: [
        'How do I learn squares faster?',
        'Why does this help my games?',
        'Which squares do I miss?',
      ],
    },
  },
  mistakes: {
    id: 'mistakes',
    path: '/mistakes',
    title: 'Mistake Bank',
    description: 'The ideas you missed in your own games, scheduled to come back.',
    nav: 'mistakes',
    frame: 'shell',
    layout: 'page',
    prototype: 'mistakes.html',
    sprint: 'S15',
    chat: {
      initial: 'open',
      context: 'your Mistake Bank · 57 positions from your own games · 7 due',
      attach: 'Mistake Bank',
      quick: [
        'What pattern links these?',
        'Which one should I fix first?',
        'How does the schedule work?',
      ],
    },
  },
  games: {
    id: 'games',
    path: '/games',
    title: 'My games',
    description: 'Every game you have played or imported, filtered and sortable.',
    nav: 'games',
    frame: 'shell',
    layout: 'page',
    prototype: 'games.html',
    sprint: 'S20',
    chat: {
      initial: 'open',
      context: 'your game library · 42 games · last 30 days',
      attach: 'Last 8 games',
      quick: [
        'What patterns do you see?',
        'Which opening should I drop?',
        'Why do I lose to Rafi?',
      ],
    },
  },
  review: {
    id: 'review',
    path: '/games/review',
    title: 'Game review',
    description: 'Accuracy, key moments and plain-language explanations for one game.',
    nav: 'games',
    frame: 'shell',
    layout: 'board',
    prototype: 'review.html',
    sprint: 'S13',
    chat: {
      initial: 'open',
      context: 'full game review · vs Stockfish 1200 · you won in 37 · move 14…Qh4',
      attach: 'This game',
      quick: ['Why was …Qh4 bad?', 'What was my best move?', 'What should I practise?'],
    },
  },
  analysis: {
    id: 'analysis',
    path: '/analysis',
    title: 'Analysis',
    description: 'A free board with engine lines, a variation tree and position setup.',
    nav: 'analysis',
    frame: 'shell',
    layout: 'board',
    prototype: 'analysis.html',
    sprint: 'S19',
    chat: {
      initial: 'open',
      context: 'analysis board · Giuoco Pianissimo · move 7, White to play · engine on',
      attach: 'Current position',
      quick: [
        "What's the plan for each side?",
        'Why is h3 useful?',
        'Where does my knight belong?',
      ],
    },
  },
  openings: {
    id: 'openings',
    path: '/openings',
    title: 'Openings',
    description: 'Your repertoire, how you score in each line and where the gaps are.',
    nav: 'openings',
    frame: 'shell',
    layout: 'page',
    prototype: 'openings.html',
    sprint: 'S17',
    chat: {
      initial: 'open',
      context: 'your repertoire · 4 openings · 34 lines · how you score in each',
      attach: 'My repertoire',
      quick: ['What fits my style?', 'Which line should I fix first?', 'Build me a line vs 1.d4'],
    },
  },
  'opening-drill': {
    id: 'opening-drill',
    path: '/openings/drill',
    title: 'Opening drill',
    description: 'Play your repertoire back from memory, scheduled like everything else.',
    nav: 'openings',
    frame: 'shell',
    layout: 'board',
    prototype: 'opening-drill.html',
    sprint: 'S17',
    chat: {
      initial: 'open',
      context: "repertoire drill · Caro-Kann Advance · line 3 of 8 · you're Black",
      attach: 'Current position',
      quick: ["What's the plan here?", 'Why …Bf5 before …e6?', 'What if White plays 4.g4?'],
    },
  },
  friends: {
    id: 'friends',
    path: '/friends',
    title: 'Friends',
    description: 'Invites, correspondence games and live rooms, all over share links.',
    nav: 'friends',
    frame: 'shell',
    layout: 'page',
    prototype: 'friends.html',
    sprint: 'S28',
    chat: {
      initial: 'open',
      context: 'your games with friends · 1 open invite · 1 correspondence game',
      quick: ['How do links work?', 'Help me prep for Rafi', 'Is the relay private?'],
    },
  },
  live: {
    id: 'live',
    path: '/friends/live',
    title: 'Live game',
    description: 'A real-time game through the relay, with clocks and reconnect.',
    nav: 'friends',
    frame: 'shell',
    layout: 'board',
    prototype: 'live.html',
    sprint: 'S28',
    chat: {
      initial: 'closed',
      context: 'paused · live game vs Rafi',
      note: "Fair play: Sage is paused during live games and reopens after the game. You'll both get it in Review.",
      quick: ['Review this game after', 'What did I learn vs Rafi?', 'Prep for our rematch'],
    },
  },
  share: {
    id: 'share',
    path: '/share',
    title: 'Shared challenge',
    description: 'A position, game or challenge decoded straight out of the link.',
    nav: 'friends',
    frame: 'shell',
    layout: 'page',
    prototype: 'share.html',
    sprint: 'S27',
    chat: {
      initial: 'open',
      context: "Rafi's challenge · White to play and win · no spoilers",
      attach: "Rafi's puzzle",
      quick: ['Give me a nudge', 'What should I look at first?', 'How do share links work?'],
    },
  },
  progress: {
    id: 'progress',
    path: '/progress',
    title: 'Growth',
    description: 'Ratings, skill map and practice log — you against you, never a leaderboard.',
    nav: 'progress',
    frame: 'shell',
    layout: 'page',
    prototype: 'progress.html',
    sprint: 'S22',
    chat: {
      initial: 'open',
      context: 'your last 30 days · ratings · skill map · practice log',
      attach: 'Weekly report',
      quick: ['Why is Endgames low?', 'What changed this month?', 'Plan next week'],
    },
  },
  settings: {
    id: 'settings',
    path: '/settings',
    title: 'Settings',
    description: 'Board, sound, coach key and your data — everything stays in this browser.',
    nav: 'settings',
    frame: 'shell',
    layout: 'page',
    prototype: 'settings.html',
    sprint: 'S23',
    chat: {
      initial: 'open',
      context: 'your settings · Gemini key connected · 184k tokens this month',
      quick: ['Which model should I pick?', 'Is my key safe?', 'Make Sage more direct'],
    },
  },
  onboarding: {
    id: 'onboarding',
    path: '/onboarding',
    title: 'Welcome',
    description: 'Four steps to a first game: level, goals, daily time, optional coach key.',
    nav: null,
    frame: 'bare',
    layout: 'page',
    prototype: 'onboarding.html',
    sprint: 'S25',
    chat: { initial: 'none', quick: [] },
  },
  'kitchen-sink': {
    id: 'kitchen-sink',
    path: '/dev/kitchen-sink',
    title: 'Kitchen sink',
    description: 'Every design-system component in both palettes, for side-by-side review.',
    nav: null,
    frame: 'bare',
    layout: 'page',
    sprint: 'S02',
    chat: { initial: 'none', quick: [] },
  },
} as const satisfies Record<ScreenId, Screen>

/** Every path the router serves. Literal, so `<Link to={…}>` stays type-checked. */
export type ScreenPath = (typeof SCREENS)[ScreenId]['path']

export const SCREEN_IDS = Object.keys(SCREENS) as readonly ScreenId[]

export const SCREEN_LIST: readonly Screen[] = SCREEN_IDS.map((id) => SCREENS[id])

/** Path lookup for code that only has an id — the command palette and the `g` chords. */
export function screenPath<Id extends ScreenId>(id: Id): (typeof SCREENS)[Id]['path'] {
  return SCREENS[id].path
}

const SCREEN_BY_PATH: ReadonlyMap<string, Screen> = new Map(
  SCREEN_LIST.map((screen) => [screen.path, screen]),
)

/** Resolves a location back to its screen. The shell needs this rather than route static
 *  data so the 404 page — which matches no route — can still be framed like a screen. */
export function screenByPath(pathname: string): Screen | undefined {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return SCREEN_BY_PATH.get(trimmed === '' ? '/' : trimmed)
}

/** The shell configuration for a URL that matches nothing. Not a route, so it is not in
 *  `SCREENS`, but the frame still needs a nav state and a Sage panel to render. */
export const NOT_FOUND_SCREEN: ShellScreen = {
  id: 'not-found',
  title: 'Page not found',
  nav: null,
  layout: 'page',
  chat: { initial: 'closed', quick: [] },
}
