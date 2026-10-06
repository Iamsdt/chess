# Sage — the coach agent (spec)

One agent, running entirely in the browser, on the user's own API key. Built on the Vercel AI SDK (library only, no gateway, no account). The engine is the source of truth; Sage explains, never invents.

---

## 1. What Sage CAN do

| # | Capability | One line |
|---|---|---|
| 1 | See the board | Knows the current position, whose move it is, and the moves that led here. |
| 2 | Consult the engine | Calls Stockfish before making any claim about who is better. |
| 3 | Verify its own lines | Replays a variation through the rules before showing it to you. |
| 4 | Draw on your board | Puts arrows, circles and highlights on the real board while it talks. |
| 5 | Step you through a line | Plays a variation move by move on the board, with commentary. |
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
| 21 | Map the calculation | Draws an engine-verified tree of candidates and replies, full screen, and can test you on it (see §9). |

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
| 14 | Guarantee correctness of prose | Explanations are model-generated; engine facts are labelled as such. |

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

**Board control (the UI it can drive)**

| Tool | One line |
|---|---|
| `showOnBoard` | Draws arrows, circles and square highlights. |
| `setPosition` | Puts a position on the board (with an undo back to your game). |
| `stepThroughLine` | Animates a variation move by move with captions. |
| `clearBoardMarks` | Removes everything it drew. |
| `openCalculationTree` | Pins a calculation card in the chat that opens the full-screen tree (§9). |

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
| `setTodaysPlan` | Proposes today's path (you confirm). |
| `saveNote` | Saves a takeaway to your notes. |

---

## 6. Memory

| Layer | Holds | Lives in |
|---|---|---|
| Turn | Current position, your last question, tool results from this turn. | Memory |
| Session | This chat, the current game, what's already been explained. | IndexedDB |
| Profile | Rating, weak themes, repertoire, goals, tone preference. | IndexedDB |
| Taught | Concepts Sage has already covered and when, so it builds instead of repeating. | IndexedDB |
| Summary | A compact rolling summary of older chats, kept inside the token budget. | IndexedDB |

Rules: the context builder assembles these under a fixed token budget, newest and most relevant first · you can see exactly what was sent ("what Sage sees") · you can clear any layer · nothing leaves the browser except the assembled context sent to your provider.

---

## 7. Guardrails

| Rule | Effect |
|---|---|
| Engine truth | Model output claiming an evaluation without a matching tool result is rejected and retried. |
| Line validation | Variations are replayed through the rules; illegal ones never reach the screen. |
| Spoiler guard | During puzzles and lessons, answers are filtered to hints unless you ask outright. |
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
| Container | Full-screen dialog (`@/design` dialog). |
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