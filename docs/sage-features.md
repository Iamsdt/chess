# Sage: feature list

Sage is the in-app chess coach. It runs entirely in the browser on the user's own API key, and it explains what the engine finds rather than inventing evaluations.

This list gives one line per feature (77 in all). The full design is in [coach-agent.md](coach-agent.md).

## Sees and checks

| #   | Feature              | One line                                                                            |
| --- | -------------------- | ----------------------------------------------------------------------------------- |
| 1   | Board awareness      | Knows the position, whose move it is and the moves that led here.                   |
| 2   | Engine-backed claims | Asks Stockfish before saying who is better; every number comes from an engine call. |
| 3   | Verified lines       | Replays every variation through the rules, so illegal lines never reach the screen. |
| 4   | Position facts       | Reads material, king safety, pawn structure, hanging pieces and open files.         |
| 5   | Opening names        | Names the opening and variation (ECO).                                              |

## Shows on its own board

Sage never changes the board you are playing on. It posts a board card in the chat; opening it shows Sage's own board in a dialog. Close it and your game is untouched.

| #   | Feature             | One line                                                                                                     |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| 6   | Board cards         | Posts a card with a preview and a title such as "What if Nxe5?"; it opens Sage's board in a dialog.          |
| 7   | What if             | Plays your idea and the opponent's best reply, and marks the danger: the check, the fork, the hanging piece. |
| 8   | Threats             | Plays out what your opponent is threatening right now.                                                       |
| 9   | Draws on its board  | Arrows, circles, highlights and danger squares, with one short caption per step.                             |
| 10  | Steps through lines | Plays a variation move by move by itself, with play, pause, back and replay.                                 |
| 11  | Your turn           | Hands you the move inside the dialog ("how does Black stop this?") and reacts to it.                         |
| 12  | Compare             | Shows two candidate moves one after the other, each with its evaluation.                                     |
| 13  | Control map         | Shades the squares each side attacks and defends.                                                            |
| 14  | Reopen later        | Cards stay in the chat; they can also open in the analysis board or go to the Mistake Bank.                  |

## Teaches

| #   | Feature              | One line                                                                                  |
| --- | -------------------- | ----------------------------------------------------------------------------------------- |
| 15  | Grandmaster thinking | Walks through assess, candidates, calculate, compare, plan and takeaway on your position. |
| 16  | Explains why         | Gives the idea behind a move in plain language, not just the move.                        |
| 17  | Graded hints         | Nudge, then key square, then the move, never more than you asked for.                     |
| 18  | Adapts its level     | Explains to a 900 player differently than to a 1600 player.                               |
| 19  | Your language        | Answers in the language you write in.                                                     |

## Knows you

| #   | Feature                    | One line                                                                       |
| --- | -------------------------- | ------------------------------------------------------------------------------ |
| 20  | Your history               | Reads your rating, weak themes, recent games, mistakes and repertoire.         |
| 21  | Spots your patterns        | "This is the fourth time a knight fork got you after castling."                |
| 22  | Compares to your past self | "You'd have missed this a month ago."                                          |
| 23  | Similar positions          | Finds positions from your own games that look like this one.                   |
| 24  | Session memory             | Doesn't repeat itself and follows up on what you just asked.                   |
| 25  | Long-term memory           | Remembers your weaknesses and what it has already taught you, across sessions. |
| 26  | What Sage sees             | Shows exactly what was sent to the AI provider, and lets you clear any memory. |

## Acts in the app

Each action can be undone, and nothing is deleted.

| #   | Feature             | One line                                                                            |
| --- | ------------------- | ----------------------------------------------------------------------------------- |
| 27  | Queue puzzles       | Starts a puzzle set on a theme.                                                     |
| 28  | Add to Mistake Bank | Saves the current position for spaced review.                                       |
| 29  | Start a drill       | Opens an endgame or board-vision drill.                                             |
| 30  | Plan your training  | Proposes today's path and this week's plan from what is actually weak; you confirm. |
| 31  | Save notes          | Keeps a takeaway in your notes.                                                     |
| 32  | Open a lesson       | Opens a lesson at a step. Waits for the Learn redesign.                             |

## Modes

The screen picks the mode, and you can override it.

| #   | Mode                | One line                                                                                              |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| 33  | Companion           | Silent during a game against the engine; warns only before you hang material, if you turned that on.  |
| 34  | Grandmaster         | "What should I play?" gets a full think-aloud analysis on the board.                                  |
| 35  | Teacher             | After a game, tells its story and names the one lesson.                                               |
| 36  | Puzzle nudger       | Hints only while you solve, in three levels, with no spoilers.                                        |
| 37  | Visualization coach | Runs the picture-it ladder: reads lines, hides the board, asks, and finds where your picture slipped. |
| 38  | Planner             | On Today and Growth, builds your path and weekly plan.                                                |
| 39  | Open Q&A            | Answers any chess question from anywhere in the app.                                                  |
| 40  | Tutor               | Explains a lesson's idea another way, never the answer. Waits for the Learn redesign.                 |
| 41  | Paused              | Turned off during a live game against a friend. Waits for Friends.                                    |

## Calculation tree

| #   | Feature         | One line                                                                                        |
| --- | --------------- | ----------------------------------------------------------------------------------------------- |
| 42  | Tree builder    | Draws the engine's tree of candidate moves and replies for any position, with no key needed.    |
| 43  | Tempting moves  | Adds the natural-looking move that loses, because its refutation is often the lesson.           |
| 44  | Branch narrator | Names each branch and states its idea, from templates, or from the AI when a key is set.        |
| 45  | Explore         | Opens the tree full screen with a board, move-by-move navigation and a side-by-side eval strip. |
| 46  | Test me         | You pick candidates and calculate them first; then the real tree is revealed and scored.        |
| 47  | Visualize mode  | Keeps the pieces frozen while you calculate, so you train seeing the moves in your head.        |
| 48  | Practise it     | Plays the position out against the engine, or saves it to the Mistake Bank.                     |
| 49  | Entry points    | Opens from the Analysis screen, from a card in the chat, and later from Review.                 |

## Visualization (seeing the board in your head)

Runs on Sage's board in the dialog, never on yours, and builds on the four Board vision drills. Every question and answer is computed by the rules engine, and the exercises work without a key.

| #   | Feature                 | One line                                                                                           |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------- |
| 50  | Board views             | Switches the board between normal, ghost, frozen, partial blindfold, blindfold and flash.          |
| 51  | Follow the line         | Reads a 2–12 move line over a hidden board, then asks where a piece is or what stands on a square. |
| 52  | What's hanging          | After a hidden line, you name the pieces left undefended or attacked.                              |
| 53  | Is it check             | After a hidden line, you say whether a named move is legal, and whether it gives check.            |
| 54  | Flash recall            | Shows a position for a few seconds; you rebuild it or answer questions about it.                   |
| 55  | Blind checks and routes | Finds every check, or the shortest knight or bishop route, without seeing the pieces.              |
| 56  | Count the exchange      | Says who wins the trades on a square in a hidden position.                                         |
| 57  | Pick the picture        | Reads a line, then shows three boards; you pick the real one (for beginners).                      |
| 58  | Adaptive ladder         | Lengthens lines and removes more of the board as you succeed, and steps back when you miss.        |
| 59  | Visualization span      | Tracks the longest line you can hold, shows it on Growth and pitches Sage's analysis to it.        |
| 60  | Find the slip           | Shows the exact move where your picture left the real position.                                    |
| 61  | Peek and slow replay    | Flashes the real position at the slip, replays it in ghost view, then asks again.                  |
| 62  | Anchor squares          | Lights up landmark squares, so you have something to hang the picture on.                          |
| 63  | Hidden answer key       | Keeps the answer out of Sage's context until you have answered, so it cannot spoil it.             |
| 64  | Picture it from Review  | Replays a line you missed in a game over a hidden board.                                           |

## Runtime and safety

| #   | Feature                 | One line                                                                                        |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| 65  | Bring your own key      | Uses your own AI provider key, encrypted in the browser and never put in a prompt or a backup.  |
| 66  | Provider choice         | Offers ready-made providers, plus any OpenAI-compatible endpoint.                               |
| 67  | Live streaming          | Shows text, tool calls and analysis cards as they are produced.                                 |
| 68  | Stop instantly          | Cancelling an answer stops the engine work too.                                                 |
| 69  | Cost meter              | Shows the token and cost count per answer and per month, under a cap you set.                   |
| 70  | Tool budget             | Limits tool calls and time per answer, so a loop cannot run away.                               |
| 71  | Spoiler guard           | Gives only hints on puzzles and lessons unless you ask outright for the answer.                 |
| 72  | Private by design       | Talks only to your chosen provider: no browsing and no server of ours.                          |
| 73  | Asks before acting      | Suggests changes to settings or data, and anything destructive needs your confirmation.         |
| 74  | Your board is yours     | Reads your position but has no tool that changes it; every demonstration runs on its own board. |
| 75  | Never interrupts        | Speaks only when asked, except the optional blunder warning.                                    |
| 76  | Results set your rating | Your rating comes from your results, never from the AI's opinion.                               |
| 77  | Graceful failure        | If the key or provider fails, says what broke while the rest of the app keeps working.          |
