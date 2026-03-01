# Chess Project Memory

## Architecture
- **Framework**: React + Vite + Tailwind CSS v4
- **Chess logic**: chess.js (game state), Stockfish 18 WASM (engine analysis)
- **AI**: OpenAI API (via `src/lib/ai.js`) — key/model stored in localStorage
- **Layout**: 3-column grid — MoveHistorySidebar | BoardPanel | ChatPanel

## Key Files
- `src/App.jsx` — central state, all game logic, callbacks
- `src/lib/intelligence.js` — move quality + threat detection logic
- `src/lib/openings.js` — opening recognition database + `detectOpening(moveHistory)`
- `src/lib/stockfish.js` — singleton UCI wrapper
- `src/lib/engine.js` — minimax fallback AI
- `src/lib/ai.js` — OpenAI chat/hint/evaluate functions
- `src/lib/db.js` — IndexedDB service (autoSave, loadAutoSave, saveGame, listGames, deleteGame)
- `src/store/useGameStore.js` — Zustand store (savedGames list, fetchSavedGames, saveCurrentGame, deleteSavedGame)
- `src/components/ChatPanel.jsx` — message cards + coach tabs
- `src/components/BoardPanel.jsx` — react-chessboard wrapper
- `src/components/SavedGamesDialog.jsx` — save/load/delete games UI dialog

## State Management & Persistence
- **Zustand** (`zustand`) manages saved games list: `useGameStore`
- **IndexedDB** (`chess-games-db`, store `games`) persists game snapshots
- Auto-save: `useEffect` on `[fen, moveHistory]` with 500ms debounce → `autoSave()`
- Auto-load: `useEffect([])` on mount → `loadAutoSave()` → restore full game state via `game.loadPgn(pgn)`
- Manual save/load: "Save / Load" button in ControlBar → `SavedGamesDialog`
- Saved game shape: `{ id, name, pgn, fen, moveHistory, opponent, difficulty, boardOrientation, timestamp, isAutosave }`
- Auto-save key: `id: "autosave"` (upserted on every move)

## Live Mode Flow
1. Human move → `handleMove()` → `engineLiveAnalyzePlayerMove()` → `buildMyMoveCard()`
2. Engine/AI replies → `triggerAIMove()` → `runThreatDetection(game, color, sq, san, moveHistory)`
3. Threat detection → `buildThreatCard()` in intelligence.js → card added to messages

## Threat Card Data Shape
```js
{
  type: "threat-card",
  opponentMoveSan,
  primaryThreat: { id, name, icon, description, severity },
  allThreats: [...],
  knownPattern: { type: "opening"|"tactical", name, eco, category, idea } | null,
  hasLearnButton: boolean,   // true when opening or fork detected
  hasAiButton: boolean,
}
```

## Learn with AI Feature
- `buildThreatCard` calls `detectOpening(moveHistory)` from `openings.js`
- Opening detected → `knownPattern` set → `hasLearnButton: true`
- Fork tactic (no opening) → `knownPattern` set as tactical → `hasLearnButton: true`
- No threats + opening → returns "info" severity opening-only card
- `ThreatCard` renders teal "Learn with AI" button when `hasLearnButton`
- Click → `onLearnWithAI(card)` → `handleLearnWithAI` in App.jsx
- `handleLearnWithAI`: switches to AI tab, sends structured teaching prompt to OpenAI

## Card Types in ChatPanel
- `my-move-analysis` — move quality vs engine (Brilliant→Blunder)
- `best-move-card` — engine best move with PV
- `hint-card` — vague hint (piece type + general message)
- `threat-card` — opponent threat + optional opening/pattern + Learn with AI

## Severity Levels for ThreatCard
`critical` | `high` | `medium` | `low` | `info` (new — for opening-only cards)

## Patterns
- Tailwind v4: use `bg-linear-to-r` not `bg-gradient-to-r`
- Pre-existing lint warnings in ChatPanel.jsx (EvalIcon in render, setState in effect) — do not fix
- `msgSeedRef` in App.jsx provides variety seed for message templates
