/**
 * Curated tactical puzzle dataset.
 *
 * Each puzzle:
 * id         – unique string
 * title      – display nameß
 * fen        – starting position (side-to-move must play the tactic)
 * solution   – array of UCI moves (e.g. ["e2e4", "e7e5"])
 * Multi-move: player plays [0], engine responds [1], player plays [2], …
 * theme      – tactical tag: "checkmate" | "fork" | "pin" | "skewer" | "discovered"
 * | "deflection" | "back-rank" | "hanging" | "promotion"
 * difficulty – "easy" | "medium" | "hard"
 * description– short challenge text shown below the board
 */

export const PUZZLES = [
  // ─────────────────────── EASY — Mate in 1 ────────────────────────────────

  {
    id: "e01",
    title: "Fool's Mate",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2",
    solution: ["d8h4"],
    theme: "checkmate",
    difficulty: "easy",
    description: "Black to move — the fastest checkmate in chess!",
  },
  {
    id: "e02",
    title: "Scholar's Mate",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["h5f7"],
    theme: "checkmate",
    difficulty: "easy",
    description: "White to move — deliver Scholar's Mate in one move.",
  },
  {
    id: "e03",
    title: "Back Rank Strike",
    fen: "5r1k/6pp/8/8/8/8/6PP/5R1K w - - 0 1",
    solution: ["f1f8"],
    theme: "back-rank",
    difficulty: "easy",
    description: "White to move — the back rank is fatally weak.",
  },
  {
    id: "e04",
    title: "Smothered King",
    fen: "6rk/5ppp/7N/8/8/8/8/6K1 w - - 0 1",
    solution: ["h6f7"],
    theme: "checkmate",
    difficulty: "easy",
    description: "White to move — the knight delivers a killing blow.",
  },
  {
    id: "e05",
    title: "Queen Strikes Home",
    fen: "r1b1kb1r/pppp1ppp/2n5/4p3/4P3/5Q2/PPPP1PPP/RNB1KB1R w KQkq - 0 5",
    solution: ["f3f7"],
    theme: "checkmate",
    difficulty: "easy",
    description: "White to move — spot the queen's mating move.",
  },
  {
    id: "e06",
    title: "Rook Roller",
    fen: "k7/1R6/1K6/8/8/8/8/8 w - - 0 1",
    solution: ["b7b8"],
    theme: "checkmate",
    difficulty: "easy",
    description: "White to move — one rook move ends the game.",
  },
  {
    id: "e07",
    title: "Bishop + Rook",
    fen: "k7/B1R5/1K6/8/8/8/8/8 w - - 0 1",
    solution: ["c7c8"],
    theme: "checkmate",
    difficulty: "easy",
    description: "White to move — bishop and rook work together to mate.",
  },
  {
    id: "e08",
    title: "Pawn Promotes and Mates",
    fen: "8/P6k/8/8/8/8/8/7K w - - 0 1",
    solution: ["a7a8q"],
    theme: "promotion",
    difficulty: "easy",
    description: "White to move — promote and deliver checkmate.",
  },
  {
    id: "e09",
    title: "The Arabian Mate",
    fen: "7k/5N1R/8/8/8/8/8/7K w - - 0 1",
    solution: ["h7h8"],
    theme: "checkmate",
    difficulty: "easy",
    description:
      "White to move — the knight and rook combine for a classic mate.",
  },
  {
    id: "e10",
    title: "King Side Mating Net",
    fen: "5rk1/5ppp/8/8/8/8/5PPP/5RK1 b - - 0 1",
    solution: ["f8f1"],
    theme: "back-rank",
    difficulty: "easy",
    description: "Black to move — exploit the same weakness White has.",
  },

  // ─────────────────────── EASY — Simple Tactics ────────────────────────────

  {
    id: "e11",
    title: "Royal Fork",
    fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
    solution: ["d5c7"],
    theme: "fork",
    difficulty: "easy",
    description: "White to move — one knight move attacks two pieces at once.",
  },
  {
    id: "e12",
    title: "Hanging Queen",
    fen: "r1bqkbnr/pppp1ppp/8/4p3/3nP3/3Q4/PPPP1PPP/RNB1KBNR w KQkq - 3 4",
    solution: ["d3d4"],
    theme: "hanging",
    difficulty: "easy",
    description: "White to move — win a piece with a simple move.",
  },
  {
    id: "e13",
    title: "Skewer the King",
    fen: "4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1",
    solution: ["e2b5"],
    theme: "skewer",
    difficulty: "easy",
    description: "White to move — skewer the king to win the rook.",
  },
  {
    id: "e14",
    title: "Absolute Pin",
    fen: "r1bqk2r/pppp1ppp/2n5/4p3/1bB1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 5",
    solution: ["c1d2"],
    theme: "pin",
    difficulty: "easy",
    description: "White to move — break the pin and regain material.",
  },

  // ─────────────────────── MEDIUM — Forks & Combos ─────────────────────────

  {
    id: "m01",
    title: "Knight Fork Clinic",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 4",
    solution: ["f3e5"],
    theme: "fork",
    difficulty: "medium",
    description:
      "White to move — the knight can fork two pieces simultaneously.",
  },
  {
    id: "m02",
    title: "Winning the Exchange",
    fen: "r1b1k2r/ppppqppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 7",
    solution: ["f3g5"],
    theme: "fork",
    difficulty: "medium",
    description: "White to move — find the fork that wins material.",
  },
  {
    id: "m03",
    title: "Discovered Attack",
    fen: "r1bqkb1r/pppp1ppp/2n5/3Pp3/8/8/PPP1PPPP/RNBQKBNR w KQkq e6 0 4",
    solution: ["d5e6"],
    theme: "discovered",
    difficulty: "medium",
    description: "White to move — en passant reveals a discovered attack.",
  },
  {
    id: "m04",
    title: "Pin and Win",
    fen: "r2qkb1r/ppp2ppp/2n1pn2/3p4/3P1B2/2NQ4/PPP1PPPP/R3KBNR w KQkq - 0 7",
    solution: ["f4b8"],
    theme: "pin",
    difficulty: "medium",
    description: "White to move — pin a piece to win material.",
  },
  {
    id: "m05",
    title: "Queen Fork",
    fen: "r3k2r/ppp2ppp/2n1p3/3qn3/3P4/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 10",
    solution: ["d1d5"],
    theme: "fork",
    difficulty: "medium",
    description: "White to move — a queen move wins by forking.",
  },
  {
    id: "m06",
    title: "Deflection",
    fen: "r4rk1/ppp2ppp/2n1p3/3qn3/3P4/2NB1N2/PPP2PPP/R2QR1K1 w - - 0 12",
    solution: ["d3h7"],
    theme: "deflection",
    difficulty: "medium",
    description: "White to move — sacrifice to deflect the king's defender.",
  },
  {
    id: "m07",
    title: "Back Rank Combination",
    fen: "r1b2r1k/ppp2ppp/2n5/3q4/8/3B1N2/PPP2PPP/R2QR1K1 w - - 0 14",
    solution: ["e1e8"],
    theme: "back-rank",
    difficulty: "medium",
    description: "White to move — pile on the back rank weakness.",
  },
  {
    id: "m08",
    title: "Zwischenzug",
    fen: "r3r1k1/pp3ppp/2p5/3pb3/3P4/2N2N2/PPQ2PPP/R1B1R1K1 b - - 0 15",
    solution: ["e5f4"],
    theme: "hanging",
    difficulty: "medium",
    description:
      "Black to move — don't recapture yet; find the in-between move.",
  },
  {
    id: "m09",
    title: "Windmill Prelude",
    fen: "r4rk1/1pp2ppp/p1np1q2/4pb2/2B1P3/6PP/PPP1NPB1/R2Q1RK1 w - - 1 14",
    solution: ["c4f7"],
    theme: "deflection",
    difficulty: "medium",
    description:
      "White to move — a bishop sacrifice starts a winning combination.",
  },
  {
    id: "m10",
    title: "Rook + Bishop Teamwork",
    fen: "6k1/5pp1/7p/8/8/2B5/8/R5K1 w - - 0 1",
    solution: ["a1a8"],
    theme: "checkmate",
    difficulty: "medium",
    description: "White to move — coordinate rook and bishop for checkmate.",
  },
  {
    id: "m11",
    title: "Decoy Sacrifice",
    fen: "3r2k1/pp3ppp/4p3/3rP3/8/1B3N2/PP3PPP/3R2K1 w - - 0 18",
    solution: ["b3d5"],
    theme: "deflection",
    difficulty: "medium",
    description: "White to move — lure the rook off a key square.",
  },
  {
    id: "m12",
    title: "Knight Outpost Fork",
    fen: "2rr2k1/5pp1/p3p2p/1p2N3/1Pn5/P1B3P1/5P1P/2RR2K1 w - - 0 25",
    solution: ["e5c6"],
    theme: "fork",
    difficulty: "medium",
    description: "White to move — the knight springs to life.",
  },
  {
    id: "m13",
    title: "Overloaded Defender",
    fen: "2r2rk1/5ppp/1q2p3/pp2P3/3p1PP1/1P1R4/PBQ3PP/5RK1 b - - 0 22",
    solution: ["c8c2"],
    theme: "deflection",
    difficulty: "medium",
    description: "Black to move — the defender has too much to protect.",
  },
  {
    id: "m14",
    title: "Double Attack",
    fen: "r1b2rk1/pp2ppbp/2np2p1/q7/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQ - 3 10",
    solution: ["d4b5"],
    theme: "fork",
    difficulty: "medium",
    description: "White to move — the knight jumps to a powerful square.",
  },
  {
    id: "m15",
    title: "Geometry: Skewer",
    fen: "4k3/8/8/8/8/8/8/R3K3 w Q - 0 1",
    solution: ["a1a8"],
    theme: "checkmate",
    difficulty: "medium",
    description: "White to move — rook on the open file delivers mate.",
  },
  {
    id: "m16",
    title: "Discovered Check Wins",
    fen: "r1bq1rk1/ppp1ppbp/2np1np1/8/3PP3/2N1BP2/PPP1N1PP/R2QKB1R b KQ - 0 8",
    solution: ["d6e4"],
    theme: "discovered",
    difficulty: "medium",
    description: "Black to move — uncover an attack on the queen.",
  },
  {
    id: "m17",
    title: "Rook Skewer",
    fen: "4k3/4r3/4R3/4K3/8/8/8/8 w - - 0 1",
    solution: ["e6e8"],
    theme: "skewer",
    difficulty: "medium",
    description: "White to move — force the king to reveal the rook behind it.",
  },
  {
    id: "m18",
    title: "Promotion Tactic",
    fen: "8/1P6/8/8/8/8/k7/7K w - - 0 1",
    solution: ["b7b8q"],
    theme: "promotion",
    difficulty: "medium",
    description: "White to move — promote to win or force immediate advantage.",
  },
  {
    id: "m19",
    title: "Clearance Sacrifice",
    fen: "r3r1k1/ppqb1pbp/2np1np1/2p1p3/4P3/1PN2NPP/PBPQ1PB1/R4RK1 b - - 0 12",
    solution: ["d6e4"],
    theme: "discovered",
    difficulty: "medium",
    description: "Black to move — sacrifice to clear a line.",
  },
  {
    id: "m20",
    title: "Alekhine's Gun",
    fen: "r5k1/5pp1/2p5/p6p/Pp6/1P3PP1/2R3KP/2R5 w - - 0 32",
    solution: ["c2c7"],
    theme: "back-rank",
    difficulty: "medium",
    description: "White to move — the rooks dominate the 7th rank.",
  },

  // ─────────────────────── HARD — Multi-move combos ─────────────────────────

  {
    id: "h01",
    title: "Greek Gift",
    fen: "r1bqk2r/ppp2ppp/3p1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 7",
    solution: ["c4f7", "e8f7", "f3g5"],
    theme: "deflection",
    difficulty: "hard",
    description:
      "White to move — a famous bishop sacrifice starts a fierce attack.",
  },
  {
    id: "h02",
    title: "Légall's Trap",
    fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 3 4",
    solution: ["g8f6", "f3e5", "c6e5", "d1h5", "f8e7", "h5f7"],
    theme: "fork",
    difficulty: "hard",
    description:
      "Both sides to play — White has a famous trap prepared. Play it out!",
  },
  {
    id: "h03",
    title: "Anastasia's Mate",
    fen: "5r1k/4Rnpp/8/8/8/8/5PPP/6K1 w - - 0 1",
    solution: ["e7h7"],
    theme: "checkmate",
    difficulty: "hard",
    description: "White to move — deliver Anastasia's Mate.",
  },
  {
    id: "h04",
    title: "Smothered Mate",
    fen: "r2q1rk1/ppp2ppp/5n2/4N3/3P4/8/PPP2PPP/R1BQK2R w KQ - 0 12",
    solution: ["e5f7", "f8f7", "d1d8"],
    theme: "checkmate",
    difficulty: "hard",
    description: "White to move — a queen sacrifice sets up a king trap.",
  },
  {
    id: "h05",
    title: "Back Rank + Deflection",
    fen: "3r2k1/5pp1/2p4p/1p2r3/1Pq5/2N3QP/5PP1/3RR1K1 b - - 0 25",
    solution: ["c4c3", "g3c3", "e5e1"],
    theme: "back-rank",
    difficulty: "hard",
    description: "Black to move — sacrifice the queen to expose the back rank.",
  },
  {
    id: "h06",
    title: "Double Bishop Sacrifice",
    fen: "r1bq1rk1/pp3ppp/2n1pn2/2pp4/3P4/1BNQ1N2/PPP2PPP/R1B1K2R w KQ - 0 9",
    solution: ["b3f7", "f8f7", "f3e5", "f6e4", "d3g6"],
    theme: "deflection",
    difficulty: "hard",
    description:
      "White to move — find the violent combination starting with a bishop sacrifice.",
  },
  {
    id: "h07",
    title: "Rook Sacrifice to Open File",
    fen: "2r1r1k1/pp3ppp/2n5/3pPB2/3p4/2NB4/PP3PPP/R3R1K1 w - - 0 17",
    solution: ["f5h7", "g8h7", "e1h1"],
    theme: "deflection",
    difficulty: "hard",
    description: "White to move — sacrifice to expose the king on the h-file.",
  },
  {
    id: "h08",
    title: "Knight vs. Pawn Endgame Trick",
    fen: "8/8/8/3k4/8/3K4/3N4/8 w - - 0 1",
    solution: ["d2b3", "d5e5", "b3c5"],
    theme: "fork",
    difficulty: "hard",
    description:
      "White to move — the knight maneuvers aggressively to gain a decisive edge.",
  },
  {
    id: "h09",
    title: "Queen Sacrifice for Promotion",
    fen: "1Q6/8/8/8/8/8/k1K5/8 w - - 0 1",
    solution: ["b8b1"],
    theme: "checkmate",
    difficulty: "hard",
    description:
      "White to move — find the quiet queen move that forces checkmate.",
  },
  {
    id: "h10",
    title: "Zugzwang in K+P",
    fen: "8/8/8/8/8/4kp2/8/4K3 b - - 0 1",
    solution: ["f3f2", "e1f1", "e3f3"],
    theme: "promotion",
    difficulty: "hard",
    description: "Black to move — precise moves lead to a winning promotion.",
  },
];

// ─── helpers ────────────────────────────────────────────────────────────────

/** Pick random puzzles filtered by difficulty. */
export const getPuzzlesByDifficulty = (difficulty) =>
  PUZZLES.filter((p) => p.difficulty === difficulty);

/** Fisher-Yates shuffle */
export const shufflePuzzles = (array) => {
  const a = [...array];
  for (let index = a.length - 1; index > 0; index--) {
    const index_ = Math.floor(Math.random() * (index + 1));
    [a[index], a[index_]] = [a[index_], a[index]];
  }
  return a;
};

/** Get the set for a session: optional difficulty filter, shuffled */
export const getPuzzleSession = (difficulty = null) => {
  const pool = difficulty ? getPuzzlesByDifficulty(difficulty) : PUZZLES;
  return shufflePuzzles(pool);
};
