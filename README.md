<div align="center">

# ♟️ Chess King

### AI-Powered Chess Coach in Your Browser

Train like a Grandmaster using **Stockfish 18 + AI coaching (Gemini & GPT-4o)**.  
Analyze positions, solve puzzles, study openings, and get **human-like explanations** for every move.

No installation. No servers required. Runs entirely in your browser.

⭐ **If you like this project, please consider starring the repository.**

---

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Stockfish](https://img.shields.io/badge/Stockfish-18-008000?logo=chess&logoColor=white)](https://stockfishchess.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

# ♟️ Chess King

**Chess King** is an AI-powered chess training platform designed to help players understand chess deeply rather than just memorize moves.

Most chess apps show the **best move**.

**Chess King explains *why* it is the best move.**

By combining **Stockfish engine analysis** with **large language models**, the system behaves like a **real chess coach**, helping players improve their thinking process.

The application runs **entirely in the browser**, using WebAssembly for engine analysis and modern AI models for natural explanations.

---

# 🚀 Key Highlights

- ♟ **Stockfish 18 running entirely in-browser (WASM)**
- 🤖 **AI chess coach powered by Gemini + GPT-4o**
- 📊 **Real-time engine evaluation bar**
- 🧠 **Human-like explanations for positions**
- 🎯 **Puzzle, opening, and endgame training**
- 📈 **Full game analysis with move classification**
- ⚡ **No backend required — fully browser based**

---

# 📸 Screenshots

<table>
  <tr>
    <td align="center">
      <img src="pics/s1.png" alt="Live Game with AI Coach" width="100%"/>
      <br/><sub><b>Live Game with AI Coach Panel</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="pics/s2.png" alt="Training Mode" width="100%"/>
      <br/><sub><b>Training Mode — Puzzles, Openings & Endgames</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="pics/s3.png" alt="Engine Analysis Panel" width="100%"/>
      <br/><sub><b>Deep Engine Analysis with Best Move, Hints & Position Analysis</b></sub>
    </td>
  </tr>
</table>

---

# 🤖 AI Coaching Engine

Chess King includes a conversational AI coach designed to guide players through positions like a human trainer.

Features include:

- **Real-time AI explanations**
- **Conversational chess analysis**
- **Skill-level adaptive coaching**
- **Move suggestions with reasoning**

The coach explains:

- Candidate moves
- Tactical ideas
- Strategic plans
- Calculation trees

Instead of simply telling the best move, it teaches **how strong players think**.

---

# ♟️ Stockfish 18 Integration

The project integrates **Stockfish 18 compiled to WebAssembly**, allowing deep engine analysis directly inside the browser.

Capabilities include:

- **Multi-PV analysis**
- **Evaluation bar**
- **Best move suggestions**
- **Threat detection**
- **Position evaluation**

All analysis runs **locally in your browser** without server calls.

---

# 🎓 Training Modules

The platform includes multiple training systems designed to improve chess skills.

### Tactical Puzzles
Improve calculation and pattern recognition.

- 44 curated puzzles
- Tactical motif detection
- Guided hints

### Opening Drill

Practice opening theory.

- 54 opening lines
- Move-by-move explanations
- ECO opening recognition

### Endgame Training

Learn fundamental endgame techniques.

- 21 classic endgame scenarios
- Position-based training
- Engine verification

### Blunder Review Mode

Review mistakes from previous games.

- Blunder detection
- Tactical explanation
- Improvement suggestions

---

# 📊 Game Analysis

Chess King analyzes entire games and provides detailed insights.

Analysis includes:

- Move quality classification
- Accuracy percentage
- Tactical pattern detection
- Opening recognition

Each move is categorized as:

- Excellent
- Good
- Inaccuracy
- Mistake
- Blunder

This helps players understand **where and why mistakes happen**.

---

# 🛠 Board & Gameplay Features

The application includes a full interactive chess board system.

Features include:

- Drag-and-drop move input
- Legal move highlighting
- Arrow annotations
- Move history with PGN
- Position setup via FEN
- Save/load games using IndexedDB
- Board flipping
- Dark mode support

You can also play against a **custom minimax chess engine** with multiple difficulty levels.

---

# ⚙️ Getting Started

## Prerequisites

- Node.js 18+
- npm or yarn

---

## Installation

Clone the repository:

```bash
git clone https://github.com/Iamsdt/chess.git
cd chess
````

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```
http://localhost:5173
```

---

# 🔑 Environment Variables

To enable AI coaching features, create a `.env` file:

```env
VITE_GOOGLE_AI_API_KEY=your_google_gemini_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
```

Note:

The project still works **fully offline for chess analysis and training** without API keys.

---

# 🏗 Build for Production

```bash
npm run build
npm run preview
```

---

# 🧠 Tech Stack

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Frontend         | React 19 + Vite 6            |
| Styling          | Tailwind CSS + Radix UI      |
| Chess Logic      | chess.js                     |
| Chess Board      | react-chessboard             |
| Engine           | Stockfish 18 (WASM)          |
| AI Models        | Gemini + GPT-4o              |
| State Management | Zustand                      |
| Storage          | IndexedDB (idb)              |
| Custom Engine    | Minimax + Alpha-Beta pruning |

---

# 📂 Project Structure

```
src/
├── components/
│   ├── board-panel.jsx
│   ├── chat-panel.jsx
│   ├── training-panel.jsx
│   ├── puzzle-mode.jsx
│   ├── opening-drill-mode.jsx
│   ├── endgame-mode.jsx
│   └── blunder-review-mode.jsx
│
├── hooks/
│   ├── use-engine-coach.js
│   ├── use-ai-chat.js
│   └── use-chess-clock.js
│
├── lib/
│   ├── engine.js
│   ├── stockfish.js
│   ├── intelligence.js
│   ├── analyzer.js
│   └── openings.js
│
├── store/
│   └── use-game-store.js
│
└── data/
    ├── puzzles.js
    └── endgames.js
```

---

# 🗺 Roadmap

Planned improvements:

* Online multiplayer
* Chess database
* Opening explorer
* Game import from Lichess / Chess.com
* ELO rating system
* AI game commentary
* Advanced training modules

---

# 🤝 Contributing

Contributions are welcome!

If you'd like to improve the project:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

Ideas for contributions:

* Add more puzzles
* Expand opening database
* Improve UI/UX
* Add new training modes

---

# 📜 License

MIT License

© Shudipto Trafder

---

<div align="center">

Built with ♟️, AI, and a lot of ☕

**Stop memorizing moves. Start understanding chess.**

</div>
