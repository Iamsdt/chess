# Chess App — Grandmaster's Feature Roadmap

> Perspective: What does a GM need to **teach a student** effectively, and what does a student need to **practice and improve**?
> Each item is tagged with: **[TEACH]** / **[PRACTICE]** / **[BOTH]**, Priority (**P0–P3**), and Effort (**S/M/L/XL**).

---

## THE FUNDAMENTAL PROBLEMS (Fix These First)

### 1. No Move-by-Move Replay · `[BOTH]` · P0 · M

**Why a GM cares:**
"I can't show a student *where* they went wrong. The game is over and I can only look at the final position. Every chess lesson in history starts with 'Let me show you move 15 — here is where you lost the thread.' This app makes that impossible."

**What's missing:**
- Clicking a move in the history sidebar should jump the board to that position
- Forward (▶) / Backward (◀) navigation buttons
- Keyboard arrow key navigation (← →)

**How to build:**
- Store the FEN at each move in `moveHistory` (change from `string[]` to `{ san, fen }[]`)
- `handleJumpToMove(index)` — loads that FEN into a `viewFen` state without mutating `gameRef`
- Disable board interaction while in "review mode"; add an "Exit review" button
- **Files:** `src/App.jsx`, `src/components/MoveHistorySidebar.jsx`

---

### 2. No Arrows / Visual Highlighting on Board · `[BOTH]` · P0 · S

**Why a GM cares:**
"I point at the board and say 'see this diagonal? That's why your bishop is buried.' Every GM uses arrows to show ideas, threats, and plans. Without them, teaching is verbal only — ineffective."

**What's missing:**
- Drawn arrows showing engine's best continuation on board after "Best Move"
- Right-click drag to draw custom arrows/circles (for teaching)
- Highlight the forked/hanging pieces from threat cards directly on the board

**How to build:**
- `react-chessboard` supports `customArrows` prop — array of `[from, to, color]`
- In `buildBestMoveCard`, pass the `pv[0]` move as an arrow (primary) + pv[1] (secondary)
- Threat cards should pass `arrowSquares` to highlight the attacking piece and targets
- **Files:** `src/components/BoardPanel.jsx`, `src/App.jsx`, `src/lib/intelligence.js`

---

### 3. No Post-Game Full Analysis Report · `[BOTH]` · P0 · M · ✅ DONE

**Why a GM cares:**
"When a game ends, my student needs a report card. How many blunders? Where was the critical mistake? What was the best/worst moment? Chess.com gives you this — it's table stakes for any coaching tool."

**What's missing:**
- After checkmate/stalemate/draw, automatically analyze every move vs. engine best
- Show: Accuracy %, Brilliant/Excellent/Good/Inaccuracy/Mistake/Blunder counts
- Highlight the single most critical mistake ("The game changed here: move 18")
- Evaluation graph (chart of eval over all moves)

**How to build:**
- `analyzeFullGame(moveHistory)` — replay PGN, analyze each position at depth 12 with Stockfish
- Results stored in state as `gameReport: { accuracy, moveSummary[], criticalMove }`
- Show in a modal dialog with a small SVG/canvas eval graph
- **Files:** `src/App.jsx`, new `src/components/GameReportDialog.jsx`, new `src/lib/analyzer.js`

---

### 4. No Position / FEN Setup · `[BOTH]` · P0 · S

**Why a GM cares:**
"I want to show my student a famous endgame position or set up a specific tactic. I can't start from the initial position every single time. Setting up positions is fundamental to teaching."

**What's missing:**
- Input a FEN string to load a custom position
- Import a PGN string to replay a game
- "From Position" button opens a text field

**How to build:**
- Add a "Set Position" option in the New Game area (small button + FEN input field)
- `game.load(fen)` for FEN input, `game.loadPgn(pgn)` for PGN input
- Clear move history and reset UI state the same way `handleLoadGame` does
- **Files:** `src/components/ControlBar.jsx` or a new `src/components/PositionSetupDialog.jsx`

---

## TEACHING FEATURES

### 5. Tactical Puzzle Mode · `[BOTH]` · P1 · L

**Why a GM cares:**
"Tactics are 80% of chess improvement at the amateur level. A student who can't solve 10 puzzles a day will plateau. Without puzzles, this app is incomplete as a training tool."

**What's missing:**
- A curated puzzle database (find-the-best-move positions)
- "Puzzle of the Day" — one challenging position per session
- Timed solving with attempts tracked
- Hint: highlight the attacking piece if stuck after 60s
- Correct/wrong feedback with explanation

**How to build:**
- Embed a dataset of ~500 tactical positions (FEN + solution move) — can be static JSON
- `PuzzleMode` component: load FEN, wait for user move, check against solution
- Track streak and success rate in localStorage or IndexedDB
- **Files:** new `src/components/PuzzleMode.jsx`, new `src/data/puzzles.json`

---

### 6. Opening Drill / Quiz Mode · `[BOTH]` · P1 · M

**Why a GM cares:**
"My student needs to know their opening. Not just watch it played — they need to recall it under pressure. A drill that quizzes you on the correct response to each opponent move is how openings are learned."

**What's missing:**
- Pick an opening from the database (e.g., "Ruy Lopez")
- App plays moves from one side; student must play the correct responses from the other
- Wrong move = shown correct move + brief explanation
- Tracks how many moves deep the student knows each opening

**How to build:**
- Extend `openings.js` data with full move trees (not just main line sequence)
- `OpeningDrillMode` — plays opponent moves, validates student's response
- Show mastery percentage per opening
- **Files:** new `src/components/OpeningDrillMode.jsx`, extend `src/lib/openings.js`

---

### 7. Board Annotations (Text Comments on Moves) · `[TEACH]` · P2 · M

**Why a GM cares:**
"When I analyze a game, I write 'This is the losing move!' next to move 22. I want to save annotated games to send to students, or review my own notes. Pure notation without comments is sterile."

**What's missing:**
- Ability to add a text comment to any move in the history
- Comments shown below the move in the sidebar
- Saved with PGN (which supports move comments natively: `{comment}` syntax)
- Export annotated PGN to clipboard

**How to build:**
- In MoveHistorySidebar, add a small note icon per move; click opens a text input
- Store annotations in `{ [moveIndex]: string }` map, saved to IndexedDB with the game
- `game.pgn()` supports comments — `game.setComment(comment)` after each move
- **Files:** `src/components/MoveHistorySidebar.jsx`, `src/lib/db.js`, `src/App.jsx`

---

### 8. Advanced Threat Detection · `[BOTH]` · P1 · M

**Why a GM cares:**
"Right now you only detect forks. But pins, skewers, and discovered attacks are just as important — and happen just as often. A student who doesn't know they're pinned will make fatal moves without understanding why."

**What's missing (in `intelligence.js`):**
- **Pin detection** — piece can't move without exposing a more valuable piece
- **Skewer detection** — valuable piece attacked; when it moves, piece behind is taken
- **Discovered attack** — moving a piece reveals an attack by the piece behind it
- **Back-rank mate threat** — king trapped on back rank by pawns
- **Weak square identification** — squares that can never be defended by pawns

**How to build:**
- Extend `buildThreatCard()` in `intelligence.js` with new detection functions
- Pin: check if attacker ray passes through a less-valuable piece to a more-valuable piece
- Skewer: same ray logic but higher-value piece in front
- Back-rank: check if first/last rank has king + no flight squares
- **Files:** `src/lib/intelligence.js`

---

### 9. Evaluation Graph (Full Game) · `[BOTH]` · P2 · M

**Why a GM cares:**
"The graph tells you instantly where the game was won and lost. One glance shows the turning point. I use this every time I review a student's game — it guides us directly to the critical moments."

**What's missing:**
- A chart showing evaluation after each move (x = move number, y = eval score)
- Colored regions (green = White better, red = Black better)
- Click on any point → jump board to that position
- Overlaid on the move history sidebar or shown in the post-game report

**How to build:**
- After each move, push `{ moveNum, eval }` to an `evalHistory[]` state array
- Render as an SVG line graph in the sidebar or a separate panel
- No external charting library needed — simple SVG path is sufficient
- **Files:** `src/components/MoveHistorySidebar.jsx`, `src/App.jsx`

---

## PRACTICE FEATURES

### 10. Chess Clock / Time Controls · `[PRACTICE]` · P1 · S

**Why a GM cares:**
"Chess is a timed game. Playing without a clock creates lazy habits — students take forever to move and never learn time management. Even Blitz practice (3+2) is essential for pattern recognition speed."

**What's missing:**
- Configurable time controls (Bullet 1+0, Blitz 3+2, Rapid 10+0, Classical 15+10)
- Countdown clock per player shown on the board
- Auto-flag on time-out (game ends)
- Optional increment

**How to build:**
- `useChessClock(timeWhite, timeBlack, increment, currentTurn)` custom hook
- Display clocks above/below board in `BoardPanel.jsx`
- On player's move, pause their clock and start opponent's
- **Files:** new `src/hooks/useChessClock.js`, `src/components/BoardPanel.jsx`, `src/components/ControlBar.jsx`

---

### 11. Blunder Review Mode (Post-Game Error Flashcards) · `[PRACTICE]` · P1 · M · ✅ DONE

**Why a GM cares:**
"After a game, the student should revisit each mistake interactively — not just read a list. Show the position before the blunder, ask 'what would you play?', then reveal the correct move. Spaced repetition of your own mistakes is the fastest way to improve."

**What's missing:**
- After game ends, extract all moves classified as Mistake/Blunder
- Step through each one: show position, ask for user input, reveal best move + explanation
- Option to add these positions to a "Training Set" for future drilling

**How to build:**
- Run post-game analysis to classify all moves (reuses `buildMyMoveCard` logic)
- Filter moves with quality < "Good" into `blunderQueue[]`
- `BlunderReviewMode` — navigate these positions, accept move input, compare
- **Files:** new `src/components/BlunderReviewMode.jsx`, extend `src/lib/analyzer.js`

---

### 12. Premove Support · `[PRACTICE]` · P2 · S

**Why a GM cares:**
"Premove is essential for Blitz and Bullet. If this app is for practice, students need to develop the muscle memory of queuing moves. Without premove, the Blitz mode is practically unplayable."

**What's missing:**
- Ability to make a move while opponent's clock is running
- Move is executed instantly when opponent completes their turn
- Visual indication of queued premove (highlighted square)

**How to build:**
- `premove` state: `{ from, to, promotion } | null`
- In `triggerAIMove`, before executing engine move, check if `premove` is set; execute immediately after
- Highlight premove squares differently (e.g., light blue)
- **Files:** `src/App.jsx`, `src/components/BoardPanel.jsx`

---

### 13. Endgame Practice Scenarios · `[BOTH]` · P2 · M

**Why a GM cares:**
"Endgames are won games that amateurs draw, and drawn games that amateurs lose. K+R vs K, K+P vs K, opposition — these must be drilled to mastery. A student who doesn't know the Lucena position will throw rook endgames forever."

**What's missing:**
- Preset endgame positions (K+Q vs K, K+R vs K, K+P vs K, etc.)
- "Endgame Drill" mode — reach checkmate or correct technique from position
- Evaluation of whether technique is correct (e.g., king opposition in pawn endings)

**How to build:**
- Static JSON of ~30 key endgame positions with FEN, goal, and ideal technique notes
- Load into FEN setup; let Stockfish verify student is making progress
- **Files:** new `src/data/endgames.json`, new `src/components/EndgameMode.jsx`

---

### 14. Opening Statistics Tracker · `[PRACTICE]` · P3 · M

**Why a GM cares:**
"Know your numbers. Are you winning 70% with the Sicilian but only 40% with the French? Data tells you where to focus. Without tracking, practice is blind."

**What's missing:**
- Track W/L/D per opening played (auto-detected via `openings.js`)
- Show stats in a small "My Openings" panel
- Identify which openings need more study

**How to build:**
- On game end, record `{ opening, result, date }` to IndexedDB
- Aggregate stats in a simple table view
- **Files:** extend `src/lib/db.js`, new `src/components/OpeningStatsPanel.jsx`

---

### 15. PGN Export / Share · `[BOTH]` · P2 · S · ✅ DONE

**Why a GM cares:**
"I want to send my student a game to study at home, or import it into Chessbase. Copy PGN to clipboard is a 10-minute feature that makes the app interoperable with every other chess tool."

**What's missing:**
- "Copy PGN" button in the save/move history area
- Optional: "Copy FEN" for current position
- Optional: Link to open position in Lichess analysis board

**How to build:**
- `navigator.clipboard.writeText(game.pgn())` on button click
- Add button to `MoveHistorySidebar.jsx` or `SavedGamesDialog.jsx`
- **Files:** `src/components/MoveHistorySidebar.jsx`, `src/components/SavedGamesDialog.jsx`

---

## QUICK WINS (Do These Immediately — Each < 2 Hours)

| # | Feature | Impact | Effort | File(s) |
|---|---------|--------|--------|---------|
| A | **Coordinates on board** (a-h, 1-8 labels) | Medium | 5 min | `BoardPanel.jsx` — set `showBoardNotation={true}` prop |
| C | **Copy PGN button** in move history | Medium | 20 min | `MoveHistorySidebar.jsx` |
| D | **Pin/Skewer detection** in threat cards | High | 2 hrs | `src/lib/intelligence.js` |
| E | **"Resign" button** to end game cleanly | Low | 10 min | `ControlBar.jsx` or `BoardPanel.jsx` |
| F | **Offer/claim Draw** button | Low | 20 min | `ControlBar.jsx` |
| G | **Highlight all pieces in check threat** (not just badge) | High | 45 min | `BoardPanel.jsx` — pass `customSquareStyles` |

---

## PRIORITY MATRIX

```
                HIGH IMPACT
                    │
    P0: Move Replay ●  ● P0: Post-Game Report
    P0: Arrows      ●  ● P0: FEN Setup
    P1: Puzzle Mode ●  ● P1: Advanced Threats
    P1: Clock       ●  ● P1: Opening Drill
                    │
LOW EFFORT ─────────┼───────── HIGH EFFORT
                    │
    Quick Wins ●●●  │    ● P2: Annotations
                    │    ● P2: Eval Graph
                    │    ● P3: Opening Stats
                    │
                LOW IMPACT
```

---

## IMPLEMENTATION ORDER (Recommended)

### Sprint 1 — Foundation ✅ COMPLETE
1. **Arrows for Best Move** (Quick Win B) — ✅ Done
2. **Move-by-move replay** (Feature 1) — ✅ Done
3. **FEN/PGN import** (Feature 4) — ✅ Done
4. **Pin/Skewer detection** (Quick Win D) — ✅ Done

### Sprint 2 — Analysis ✅ COMPLETE
5. **Post-game full analysis report** (Feature 3) — ✅ Done (accuracy rings, eval graph, quality breakdown, critical moment)
6. **Blunder review mode** (Feature 11) — ✅ Done (interactive board, answer reveal, green arrow)
7. **Copy PGN** (Quick Win C) — ✅ Done (was already complete from Sprint 1)

### Sprint 3 — Training (2 weeks)
8. **Tactical puzzle mode** (Feature 5) — core training loop
9. **Chess clock** (Feature 10) — timed practice
10. **Opening drill mode** (Feature 6) — opening mastery

### Sprint 4 — Polish (1 week)
11. **Endgame scenarios** (Feature 13)
12. **Annotations on moves** (Feature 7)
13. **Opening statistics** (Feature 14)
14. **Premove** (Feature 12)
