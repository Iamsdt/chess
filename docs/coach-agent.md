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
| 3 · Calculate | The concrete line for each candidate, engine-verified, with the refutation of the tempting one. | Step-through on the board |
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
