# Sage — the coach agent (spec)

One agent, running entirely in the browser, on the user's own API key. Built on the Vercel AI SDK (library only, no gateway, no account). The engine is the source of truth; Sage explains, never invents.

Sage never changes the board you are playing or studying on. Everything it shows happens on its own board, in a dialog you open from a card in the chat (§11).

---

## 1. What Sage CAN do

| # | Capability | One line |
|---|---|---|
| 1 | See the board | Knows the current position, whose move it is, and the moves that led here. |
| 2 | Consult the engine | Calls Stockfish before making any claim about who is better. |
| 3 | Verify its own lines | Replays a variation through the rules before showing it to you. |
| 4 | Show it on its own board | Posts a board card in the chat; opening it shows Sage's board in a dialog, with arrows, highlights and captions (§11). |
| 5 | Step you through a line | Plays a variation move by move on its board, one short caption per move. |
| 6 | Teach how a GM thinks | Assess → candidates → calculate → compare → plan → takeaway (see §4). |
| 7 | Answer "why", not just "what" | Explains the idea behind a move in plain language. |
| 8 | Give graded hints | Nudge → key square → the move, never more than you asked for. |
| 9 | Know your history | Reads your rating, weak themes, recent games, mistakes and repertoire. |
| 10 | Spot your patterns | "This is the fourth time a knight fork got you after castling." |
| 11 | Compare to your past self | "You'd have missed this a month ago." |
| 12 | Act inside the app | Queues puzzles, opens a lesson, adds a position to the Mistake Bank, starts a drill. |
| 13 | Plan your training | Builds today's path and this week's plan from what's actually weak. |
| 14 | Adapt its level | Explains to a 900 differently than to a 1600. |
| 15 | Switch modes by screen | Quiet during a live game, talkative in review (see §3). |
| 16 | Remember the session | Doesn't repeat itself, follows up on what you just asked. |
| 17 | Remember you long-term | Carries your weaknesses and what it already taught you across sessions. |
| 18 | Work in your language | Answers in the language you write in. |
| 19 | Stream its thinking | Text, tool calls and analysis cards appear as they're produced. |
| 20 | Stop instantly | Cancel any answer; the engine stops with it. |
| 21 | Show "what if" | Plays your idea and the opponent's best reply on its board, and marks the danger: the check, the fork, the piece left hanging. |
| 22 | Map the calculation | Draws an engine-verified tree of candidates and replies, full screen, and can test you on it (see §9). |
| 23 | Train your visualization | Hides, freezes or flashes the board, reads you a line, and asks what you see; the rules engine marks every answer (see §10). |

## 2. What Sage CANNOT do (by design)

| # | Limit | Why |
|---|---|---|
| 1 | Play your moves for you | You're here to improve; Sage advises, you move. |
| 2 | Help during a live game vs a friend | Fair play. It's paused until the game ends. |
| 3 | Give away puzzle or lesson answers | Spoiler guard: hints only, unless you explicitly ask to be shown. |
| 4 | Claim an evaluation it didn't get from the engine | Every number is traceable to a tool call. |
| 5 | Show a line it hasn't verified | Illegal or unplayable lines are filtered before display. |
| 6 | Reach the internet on its own | Only your chosen provider; no browsing, no third-party calls. |
| 7 | Send your data anywhere else | Context goes to your provider only; nothing to us, we have no server. |
| 8 | See or leak your API key | The key is decrypted for the call and never enters a prompt or a backup. |
| 9 | Change settings or delete data silently | It can suggest; destructive actions need your confirmation. |
| 10 | Run without your key | No key, no coach. Everything else in the app still works. |
| 11 | Spend without warning | Token and cost meter per session and per month, with a cap you set. |
| 12 | Interrupt you | It never speaks unprompted, except a blunder warning you switched on. |
| 13 | Be your rating authority | Ratings come from your results, not from the model's opinion. |
| 14 | Touch your board | It reads your position but has no tool that changes it; demonstrations happen on its own board (§11). |
| 15 | Guarantee correctness of prose | Explanations are model-generated; engine facts are labelled as such. |

---

## 3. Modes

Each mode has its own prompt, tool set and tone. The screen picks the mode; you can override it.

| Mode | When | What it does | Tools it may use |
|---|---|---|---|
| **Companion** | Live game vs engine | Silent by default; warns only if you're about to hang material (if enabled). | evaluateMove, getGameContext |
| **Grandmaster** | You ask "what should I play?" | Full think-aloud analysis on the board (§4). | all analysis + board tools |
| **Teacher** | Post-game review | Tells the story of the game and names the one lesson. | analysis, history, mistake tools |
| **Tutor** | Inside a lesson | Explains the current idea differently, gives another example, never the answer. | legalMoves, showOnBoard, openLesson |
| **Puzzle nudger** | Solving puzzles | Hints only, three levels, no spoilers. | analysePosition (hidden), showOnBoard |
| **Visualization coach** | Board vision, "help me see further", or after you miss a line longer than your span | Runs the picture-it ladder (§10): reads lines, hides the board, asks, and helps you find where your picture slipped. | visualization tools, legalMoves, playLine, showOnBoard |
| **Planner** | Home, Growth | Builds today's path and the weekly plan from your data. | profile, stats, queue tools |
| **Open Q&A** | Anywhere | Chess questions, openings, rules, "why do I keep losing?". | any, read-only |
| **Paused** | Live game vs a friend | Disabled for fair play; resumes at game end. | none |

---

## 4. Grandmaster thinking mode (the headline feature)

You ask "what should I play here?" and get a lesson in thinking, not an answer.

| Step | What Sage produces | Shown as |
|---|---|---|
| 1 · Assess | Material, king safety, structure, piece activity, the one imbalance that matters. | Short card, highlighted squares |
| 2 · Candidates | Three moves worth considering and what each one is *trying* to do. | Three arrows, one card each |
| 3 · Calculate | The concrete line for each candidate, engine-verified, with the refutation of the tempting one. | Step-through on the board, and the full-screen calculation tree (§9) |
| 4 · Compare | Why the best move wins and what the natural-looking move misses. | Side-by-side evals from the engine |
| 5 · Plan | What you're aiming for over the next five moves. | Plan card with target squares |
| 6 · Takeaway | The single habit to carry into your next game. | One sentence, savable to notes |

Everything in the "Shown as" column appears on Sage's own board, in a dialog opened from a card in the chat (§11).

Rules: every evaluation comes from a tool call · every line is replayed through the rules before display · you can interrupt at any step and ask "why not X?" · the depth of explanation follows your rating.

---

## 5. Tools

All tools run locally in the browser. Results are facts the model must use; the model never asserts an engine number it didn't receive.

**Engine**

| Tool | One line |
|---|---|
| `analysePosition` | Top N engine lines for a position, with evaluation and depth. |
| `evaluateMove` | What a specific move does to the evaluation. |
| `compareMoves` | Ranks two or more candidate moves side by side. |
| `findBestPlan` | Longer, deeper search used only for grandmaster mode. |
| `buildCalculationTree` | Builds the pruned candidate/reply tree for a position (§9). |

**Rules and position**

| Tool | One line |
|---|---|
| `legalMoves` | Legal moves in the position, optionally for one square. |
| `playLine` | Replays a sequence and returns the resulting position, or the error if it's illegal. |
| `positionFacts` | Material, king safety, pawn structure, hanging pieces, open files. |
| `identifyOpening` | Names the opening and variation (ECO). |

**Sage board (§11): Sage's own board, never yours**

| Tool | One line |
|---|---|
| `openSageBoard` | Posts a board card in the chat from a position (a copy of yours by default) and returns its board id. |
| `showOnBoard` | Draws arrows, circles and square highlights on a Sage board. |
| `showWhatIf` | Plays a move and the engine's best reply on a Sage board, and marks the danger it creates. |
| `showThreat` | Plays out what the opponent threatens right now. |
| `stepThroughLine` | Animates a variation on a Sage board, one caption per move. |
| `handOverMove` | Asks you to play the next move inside the dialog and returns what you played. |
| `clearBoardMarks` | Removes everything it drew on a Sage board. |
| `openCalculationTree` | Pins a calculation card in the chat that opens the full-screen tree (§9). |
| `showControlMap` | Shades the squares each side attacks and defends on a Sage board. |

**Visualization (§10)**

| Tool | One line |
|---|---|
| `setBoardView` | Switches a Sage board to normal, ghost, frozen, partial blindfold, blindfold or flash view. |
| `narrateLine` | Reads a line move by move at a set pace while the board stays frozen or hidden. |
| `startVisualizationExercise` | Starts an exercise of a given kind and level; the app generates the question and keeps the answer key. |
| `checkVisualizationAnswer` | Marks your answer and returns the first move where your picture left the real position. |
| `peekPosition` | Briefly shows the real position at any move of the line, then hides it again. |
| `getVisualizationProfile` | Your span, level per exercise, and the kind of slips you make most. |

**Your data**

| Tool | One line |
|---|---|
| `getGameContext` | Current game: position, history, colour, clock, opening, result if finished. |
| `getPlayerProfile` | Rating, level, goals, streak, preferred openings. |
| `getWeakThemes` | Ranked weaknesses with evidence counts. |
| `findMyGames` | Searches your games by opening, opponent, result, date, accuracy. |
| `findSimilarPositions` | Finds positions you've had before that look like this one. |
| `getMistakeHistory` | What you got wrong recently, and whether it's due for review. |

**Actions (all reversible, none destructive)**

| Tool | One line |
|---|---|
| `queuePuzzles` | Starts a puzzle set on a theme. |
| `openLesson` | Opens a lesson at a step. |
| `addToMistakeBank` | Saves the current position for spaced review. |
| `startDrill` | Starts an endgame or vision drill. |
| `startVisualizationSet` | Queues a short ladder of visualization exercises at your level. |
| `setTodaysPlan` | Proposes today's path (you confirm). |
| `saveNote` | Saves a takeaway to your notes. |

---

## 6. Memory

| Layer | Holds | Lives in |
|---|---|---|
| Turn | Current position, your last question, tool results from this turn. | Memory |
| Session | This chat, the current game, what's already been explained. | IndexedDB |
| Profile | Rating, weak themes, repertoire, goals, tone preference, visualization span. | IndexedDB |
| Taught | Concepts Sage has already covered and when, so it builds instead of repeating. | IndexedDB |
| Summary | A compact rolling summary of older chats, kept inside the token budget. | IndexedDB |

Rules: the context builder assembles these under a fixed token budget, newest and most relevant first · you can see exactly what was sent ("what Sage sees") · you can clear any layer · nothing leaves the browser except the assembled context sent to your provider.

---

## 7. Guardrails

| Rule | Effect |
|---|---|
| Your board is yours | No tool writes to the board you are playing or studying on; Sage boards start from a snapshot and never write back. |
| Engine truth | Model output claiming an evaluation without a matching tool result is rejected and retried. |
| Line validation | Variations are replayed through the rules; illegal ones never reach the screen. |
| Spoiler guard | During puzzles and lessons, answers are filtered to hints unless you ask outright. |
| Hidden answer key | In visualization exercises the model sees the question but not the answer until you have answered. |
| Rules-made questions | Every visualization question and answer is computed by replaying the line, never by the model. |
| Fair play | Disabled entirely during live games against a friend. |
| Cost ceiling | Monthly cap you set; it warns before a long analysis and shows cost per answer. |
| Tool budget | Maximum tool calls and time per answer, so a loop can't run away. |
| Privacy | Key encrypted in the browser, excluded from backups, never in a prompt. |
| Cancellation | Stopping an answer cancels the engine work too. |
| Graceful failure | If the provider or the key fails, the app keeps working and says exactly what broke. |

---

## 8. Where this lands in the sprint plan

| Sprint | Scope |
|---|---|
| **S09** | Chat UI, mock coach, streaming shape incl. tool-call and analysis-card parts. |
| **S21** | Coach runtime: AI SDK, provider presets + custom OpenAI-compatible entry, BYOK crypto, streaming, tool loop, cost meter. |
| **S21b** | Tools (§5), context builder and memory (§6), engine-truth guardrail (§7). |
| **S21c** | Grandmaster thinking mode (§4): structured analysis, board-linked cards, line stepping. |

The calculation tree (§9) is not scheduled yet. Its engine-only parts (§9.1, §9.3, §9.4) depend only on S07, S08 and S19 and can start any time; the LLM narrator (§9.2) needs S21.

The Sage board (§11) comes before any tool that shows something: the board-control tools in S21b all target it.

The visualization trainer (§10) is not scheduled yet either. Its board views, exercises and ladder (§10.1–§10.3) build on the S18 Board vision drills and need no key; the Sage tools and mode (§10.4, §10.5) need S21.

---

## 9. Calculation tree (visual calculation + "Test me")

Strong players calculate by building a tree in their head: *if I play this, he plays that, then I…*. Sage draws that tree for any position, lets you explore it full screen, and can hide it and test you first, so that over time you learn to build it yourself.

Two modes on one screen: **Explore** (the tree, built and explained) and **Test me** (you calculate first, then the real tree is revealed and compared).

### 9.1 Tree builder (engine only, works without a key)

Pure module `src/calculation/`, no React, no storage.

| Rule | Value |
|---|---|
| Root candidates | Engine top 3 (MultiPV 3) **plus up to 2 tempting moves**: checks or captures that look natural but lose ≥ 1.5 pawns. The refutation of the tempting move is often the lesson. |
| Opponent replies | Best reply, plus a second if within 0.5 pawns of it. |
| Our continuations | Best move only. |
| Stop a branch | Quiet position (no checks or captures, stable eval), mate, or 6 plies. |
| Budget | ~25 nodes, ~6–8 s total, `interactive` lane. |
| Order | Breadth-first and streamed: candidates appear at once, branches fill in. |
| Cancellation | One `AbortSignal` stops every search in flight. |

Each node: `san`, `uci`, `fen` after the move, eval (white-centipawns or mate), change vs parent, tag (`best` · `good` · `tempting` · `mistake` · `blunder` · `only-move` · `forced`, via `@/chess` classify). Each leaf records why it stopped. Storage is a flat id map like `VariationTree`, with a zod schema in `@/domain`, so a tree converts to a `VariationTree` for "Open in analysis board".

### 9.2 Narrator (the AI layer)

A `CalcNarrator` interface with two implementations:

| Narrator | When | Produces |
|---|---|---|
| Template | Always available, no key needed | Labels from tags: "Wins the exchange", "Allows mate in 3", "Only move". |
| LLM | Once S21 exists and a key is set | From the compact tree + your rating, as a structured object: a 2–4 word name per branch, the one-sentence idea of each candidate, the key-moment node per branch, a takeaway. May nominate up to 2 "moves a player at your level would consider"; the engine expands and verifies them before they enter the tree. |

Guardrail: the narrator labels the tree, it never edits it. Any move, eval or node id in its output that the engine didn't produce is dropped (same engine-truth rule as §7).

### 9.3 Explore (full screen)

| Part | Behaviour |
|---|---|
| Container | Full-screen dialog (`@/design` dialog): the Sage board (§11) in its tree layout. |
| Board (left on desktop, top on mobile) | Shows the selected node; animates from its parent; arrows preview the next moves of the branch. Eval bar beside it. |
| Tree (right on desktop, indented list on mobile) | SVG graph: one column per ply, one row per branch. Node chips like `Qxb7 −2.1`, coloured by tag, branch name on the first chip. Layout is a pure function, no new dependency. |
| Navigation | Click a node to jump · hover for ghost arrows · ←/→ along the line · ↑/↓ between siblings · **Play branch** auto-steps. |
| Comparison strip | Final eval of each candidate side by side, best one marked. |
| Exits | "Open in analysis board" (converts to `VariationTree`) · "Ask Sage why" on any node. |

### 9.4 Test me (trainer)

| Step | What you do | What the app does |
|---|---|---|
| 1 · Candidates | Pick up to 3 candidate moves. | Tree hidden. |
| 2 · Calculate | For each candidate, enter the opponent's reply and your follow-up. | **Guided**: pieces move as you go. **Visualize**: pieces stay frozen at the root, only arrows and notation accumulate (the real visualization training). |
| 3 · Verdict | Mark each candidate winning / equal / losing and choose your move. | — |
| 4 · Reveal | — | Shows the real tree with your lines overlaid: the first ply where you left the engine's line, candidates you missed, wrong verdicts, and a score. |
| 5 · Practise | **Play it out** from the root against the engine, or **Save to Mistake Bank** for spaced review. | Attempts are stored (Dexie) so calculation depth and accuracy can be tracked over time. |

Fair play and spoilers: Test me and Explore are unavailable during a live game vs a friend, and inside puzzles and lessons Explore is spoiler-guarded like every other answer (§7).

### 9.5 Entry points

| Where | How |
|---|---|
| Analysis screen | "Calculation tree" button on the current position. |
| Coach chat | New attachment kind `calculation`, rendered as a card with **Open full screen**. "What should I play?" in Grandmaster mode attaches one; the mock coach's grandmaster transcript includes one until S21 lands. |
| Review (later) | "What did you miss here?" on a mistake opens Test me at that position. |

### 9.6 Build order and tests

| Step | Scope | Tests |
|---|---|---|
| 1 | Builder + schema | Fake-engine fixtures: every node legal, budget respected, abort leaves nothing running, pruning rules, tempting-move detection. |
| 2 | Explore + analysis entry | Layout function unit tests, RTL navigation tests. |
| 3 | Test me + attempt storage | Diff and scoring unit tests, RTL flow test. |
| 4 | Coach card + narrator interface | Template narrator snapshots, guardrail test with a doctored narrator output. |
| — | End to end | One Playwright run: open tree, step a branch, Test me, reveal. |


https://huggingface.co/blog/sora-2/laya-ai-model-how-it-works-run-it-locally-and-eval

---

## 10. Visualization trainer (seeing the board in your head)

Calculation stops where your picture of the board stops. Visualization is that picture: keeping the position in your head while moves are played that you cannot see. Sage trains it by gradually taking the board away, asking questions only the picture can answer, and showing exactly where your picture slipped.

The four Board vision drills (name the square, find all checks, knight route, blindfold move) are the first rungs. The trainer adds the rungs above them, and gives Sage tools to run all of them.

Exercises run on a Sage board (§11): one started from the chat opens in the dialog, and your own board is never hidden or changed.

### 10.1 Board views (`setBoardView`)

| View | What you see | Teaches |
|---|---|---|
| Normal | The real position. | The starting point. |
| Ghost | Pieces that are about to move fade at their origin and appear faintly on the squares they move to. | A bridge: you see the change, not just the result. |
| Frozen | Pieces stay at the start position while the moves pile up as notation and, optionally, arrows. | Holding a line on top of a visible position (the same view as Visualize in §9.4). |
| Partial blindfold | Only some pieces are shown: kings only, one side only, or no pawns. | Tracking what you cannot see against what you can. |
| Blindfold | Empty squares, with coordinates optional. | The full skill. |
| Flash | The position shows for a few seconds, then hides. | Taking a snapshot of a whole position. |

### 10.2 Exercises (the app asks, the rules engine marks)

| Exercise | Sage does | You answer |
|---|---|---|
| Follow the line | Reads 2–12 plies over a frozen or hidden board. | Where is a piece now, or what stands on a square. |
| What's hanging | Reads a line, then hides the board. | Which pieces are undefended or attacked. |
| Is it check / legal | Reads a line, then names a move. | Is it legal, and is it check. |
| Flash recall | Shows a position for 5–10 seconds. | Rebuild it piece by piece, or answer questions about it. |
| Blind checks | Hides a position. | Every checking move. |
| Blind routes | Names a piece and two squares. | The shortest knight or bishop route, square by square. |
| Count the exchange | Hides a position and names a square. | Who wins the exchange there. |
| Pick the picture | Reads a line, then shows three boards. | Which board is the real one (multiple choice, for beginners). |
| Line to tree | Hands a position over to §9.4 Test me in Visualize view. | Calculate candidates without moving pieces. |

Answers are given by tapping squares on an empty board, typing a square or move, or choosing from options.

### 10.3 The ladder (adapts to you)

| Dial | Range |
|---|---|
| Line length | 2 plies → 12 plies. |
| View strength | Normal → ghost → frozen → partial → blindfold. |
| Pieces on board | Few (endgames) → full middlegame. |
| Narration | Spoken in full ("knight from g1 to f3") → plain notation (Nf3). |

Three correct answers in a row raise one dial; two misses lower one. **Visualization span** is the longest line you follow at 80% accuracy or better. It is stored, shown on Growth, and used by Sage to pitch §4 and §9 to what you can actually hold.

### 10.4 When you miss (how Sage teaches)

| Move | What happens |
|---|---|
| Find the slip | `checkVisualizationAnswer` returns the first ply where your picture left the real one: "the bishop went back to a4 on move 4; you left it on b5". |
| Peek | Shows the real position at that ply for a moment, then hides it again. |
| Slow replay | Replays the line in ghost view, then hides the board and asks again. |
| Anchors | Lights up two or three landmark squares, such as the king, an open file or the piece that moved most, so you have something to hang the picture on. |
| Step down | Shortens the line or softens the view, and says why. |

### 10.5 Rules

- Questions and answers come from replaying the line with the rules engine; the model only phrases them.
- The answer key stays out of the model's context until you answer, so Sage cannot spoil it.
- Lines Sage proposes are replayed first; illegal lines are dropped (§7).
- The app controls timing and the board view; the model can only request them.
- Every exercise works without a key, using template wording; Sage adds explanations, adaptation and follow-ups.

### 10.6 Entry points

| Where | How |
|---|---|
| Board vision | A "Train with Sage" ladder above the four existing drills. |
| Coach chat | "Help me see further"; also offered when you miss a tactic deeper than your span. |
| Calculation tree | Test me in Visualize view (§9.4). |
| Review | "Picture it" on a mistake replays the line you missed over a hidden board. |
| Today | The Planner adds a short visualization step when span is your limiting skill. |

### 10.7 Build order and tests

| Step | Scope | Tests |
|---|---|---|
| 1 | Board views on the board component, and a pure question generator from (fen, moves) | Every generated answer is checked by an independent replay; view snapshots. |
| 2 | Exercises, answer checker, slip finder, span profile (Dexie) | Unit tests for the slip finder and the ladder rules. |
| 3 | Sage tools and the Visualization coach mode | A guardrail test that the answer key never appears in the prompt. |
| 4 | Entry points (Board vision, Review, Today, Growth span) | RTL flow tests; one Playwright run through a full ladder. |

---

## 11. The Sage board (where Sage shows things)

Sage never changes the board you are playing or studying on. When it wants to show you something, it makes a board of its own: a card appears in the chat, you open it, and a dialog shows the demonstration on Sage's board. Close it and you are back exactly where you were.

### 11.1 How it works

| Step | What happens |
|---|---|
| 1 · Card | Sage posts a board card in the chat: a small preview, a title such as "What if Nxe5?", and **Open**. |
| 2 · Dialog | **Open** shows Sage's board in a dialog (full screen on mobile), starting from a copy of your position. |
| 3 · Demonstration | Sage plays its moves on that board one at a time, with arrows, highlights and one short caption per step: "If you take on e5… Qh5+. Check, and the knight on e5 hangs." |
| 4 · Your turn | Sage can hand you the move inside the dialog: "Now you: how does Black stop this?" You move; Sage reacts. |
| 5 · Close | You are back on your own board, untouched. The card stays in the chat so you can reopen it later. |

### 11.2 The dialog

| Part | Behaviour |
|---|---|
| Board | Sage's own board: arrows, circles and highlights; danger squares in a warning colour; on a check, the checking piece and the king are outlined. |
| Caption strip | One short line per step, never a paragraph. |
| Step controls | Play / pause, back, forward, replay. It plays itself at a calm pace by default. |
| Eval | The engine's evaluation at each step, when the point is who is better. |
| Views | Any §10.1 view: ghost, frozen, partial blindfold, blindfold, flash. |
| Exits | "Back to my game" · "Open in analysis board" · "Save to Mistake Bank". |

### 11.3 Kinds of board card

| Card | What Sage shows |
|---|---|
| What if | A move you (or Sage) name, the opponent's best reply, and the danger it creates: the check, the fork, the hanging piece, the mate threat. |
| Threat | What your opponent is threatening right now, played out. |
| Idea | A plan or pattern in a few moves, with arrows. |
| Line | A variation stepped through with captions. |
| Compare | Two candidates one after the other, each with its evaluation. |
| Calculation tree | The full-screen tree (§9.3). |
| Visualization | An exercise from §10. |

### 11.4 Rules

- Read-only on your board: Sage reads your position (`getGameContext`) but has no tool that writes to it.
- Every Sage board starts from a snapshot; nothing played in the dialog reaches your game, clock or history.
- Every move on a Sage board is replayed through the rules, and "what if" replies come from the engine, not the model (§7).
- Spoiler guard applies: in puzzles and lessons, Sage does not make a card that shows the answer unless you ask outright.
- Fair play: no cards during a live game against a friend.

### 11.5 Build order and tests

| Step | Scope | Tests |
|---|---|---|
| 1 | Board card in the chat, and the dialog with its own board, captions and step controls | RTL: opening, stepping and closing leave the main board's position and history unchanged. |
| 2 | `openSageBoard`, `showOnBoard`, `stepThroughLine`, `clearBoardMarks` | Unit: tools address a board id, and no tool can name the main board. |
| 3 | `showWhatIf`, `showThreat`, danger marking | Engine fixtures: the marked danger (check, fork, hanging piece) matches the position. |
| 4 | `handOverMove` and the views from §10.1 | RTL flow; one Playwright run: card → dialog → demo → your move → close. |
