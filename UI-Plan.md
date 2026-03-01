# UI Action Plan — AI Chess Coach

## Tech Stack

| Layer       | Technology                     |
| ----------- | ------------------------------ |
| Framework   | React (JavaScript)             |
| Build Tool  | Vite                           |
| Styling     | TailwindCSS v4                 |
| Components  | shadcn/ui                      |
| Chess Board | react-chessboard + chess.js    |
| AI          | User-provided API key (OpenAI) |

---

## Page Structure

Single-page app with **three zones**:

```
┌──────────────────────────────────────────────┐
│  Top Control Bar                             │
│  [Explain] [Hint] [Live Mode ○] [⚙ Settings]│
├─────────────────────┬────────────────────────┤
│                     │                        │
│   Chess Board       │   AI Coach Chat        │
│   (left, ~55%)      │   (right, ~45%)        │
│                     │                        │
│                     │  ┌──────────────────┐   │
│                     │  │  message list    │   │
│                     │  │  ...             │   │
│                     │  ├──────────────────┤   │
│                     │  │  input + send    │   │
│                     │  └──────────────────┘   │
│                     │                        │
├─────────────────────┴────────────────────────┤
│  Move Quality Badge (below board)            │
└──────────────────────────────────────────────┘
```

---

## Components Breakdown

### 1. `App.jsx` — Root layout & state orchestration
- Holds game state, chat messages, settings
- Renders `ControlBar`, `BoardPanel`, `ChatPanel`, `SettingsDialog`

### 2. `ControlBar.jsx` — Top toolbar
- **Explain** button (shadcn `Button`)
- **Hint** button (shadcn `Button`)
- **Live Mode** toggle (shadcn `Switch`)
- **New Game** button
- **Settings** gear icon → opens API key dialog

### 3. `BoardPanel.jsx` — Left panel
- `react-chessboard` for interactive board
- `chess.js` for move validation & game state
- Move quality badge displayed below the board
- Move history list (compact)

### 4. `ChatPanel.jsx` — Right panel
- Scrollable message list (user + AI messages)
- Text input + send button at bottom
- Auto-scrolls to latest message
- Shows typing indicator while AI responds

### 5. `SettingsDialog.jsx` — Modal dialog
- shadcn `Dialog` component
- API key input (password field)
- Model selector (dropdown)
- Save to localStorage

### 6. `MoveQualityBadge.jsx` — Feedback indicator
- Color-coded badge: Excellent / Good / Inaccuracy / Mistake / Blunder
- Appears after each move when Live Mode is on

---

## State Management

Simple `useState` + `useReducer` at the App level. No external state library needed.

| State             | Type     | Description                     |
| ----------------- | -------- | ------------------------------- |
| `game`            | Chess()  | chess.js game instance          |
| `fen`             | string   | Current board position          |
| `messages`        | array    | Chat history                    |
| `isLiveMode`      | boolean  | Live analysis toggle            |
| `apiKey`          | string   | User's AI API key               |
| `isLoading`       | boolean  | AI response in progress         |
| `moveQuality`     | string   | Last move quality rating        |
| `settingsOpen`    | boolean  | Settings dialog visibility      |

---

## Implementation Order

1. Scaffold project (Vite + React)
2. Install & configure TailwindCSS
3. Set up shadcn/ui
4. Build shell layout (grid: control bar + two panels)
5. Integrate chess board (react-chessboard + chess.js)
6. Build chat panel UI
7. Build control bar with buttons & toggle
8. Build settings dialog with API key input
9. Wire up game state + chat interactions
