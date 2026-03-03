/**
 * Endgame practice scenarios.
 *
 * Each entry:
 * id          – unique key
 * title       – display name
 * fen         – starting FEN (active color = the side the student plays)
 * description – what the position is and why it matters
 * goal        – "checkmate" | "promote" | "draw" | "technique"
 * goalText    – human-readable goal string for the UI
 * category    – "KQK" | "KRK" | "KPK" | "KBK" | "KRPKR" | "pawn" | "rook" | "queen" | "other"
 * difficulty  – "beginner" | "intermediate" | "advanced"
 */

export const ENDGAMES = [
  // ── Queen endings ─────────────────────────────────────────────────────────
  {
    id: "kqk-1",
    title: "K+Q vs K — Basic Checkmate",
    fen: "8/8/8/8/5k2/6q1/8/7K b - - 0 1",
    description:
      "The most fundamental endgame. White king is in the corner — Black delivers checkmate. Learn the technique: box the king in with the queen, then use your king to close the net.",
    goal: "checkmate",
    goalText: "Checkmate the opponent's king",
    category: "KQK",
    difficulty: "beginner",
  },
  {
    id: "kqk-2",
    title: "K+Q vs K — Drive to Corner",
    fen: "8/8/8/3k4/8/3K4/8/7Q w - - 0 1",
    description:
      "White must use king and queen together to force the black king to a corner. The queen restricts, the king approaches — checkmate follows.",
    goal: "checkmate",
    goalText: "Checkmate the opponent's king",
    category: "KQK",
    difficulty: "beginner",
  },
  {
    id: "kqk-3",
    title: "K+Q vs K+P — Race",
    fen: "8/8/8/1k6/8/8/1p6/4K2Q b - - 0 1",
    description:
      "Black has a pawn racing to promote. White must stop it or win faster. A critical test of king and queen coordination.",
    goal: "checkmate",
    goalText: "Win before Black promotes",
    category: "KQK",
    difficulty: "intermediate",
  },

  // ── Rook endings ─────────────────────────────────────────────────────────
  {
    id: "krk-1",
    title: "K+R vs K — Ladder Mate",
    fen: "8/8/8/8/8/2k5/8/R1K5 w - - 0 1",
    description:
      "The 'ladder' or 'lawnmower' technique: use rook checks to push the king to the edge, then deliver checkmate with your own king cutting off ranks.",
    goal: "checkmate",
    goalText: "Checkmate with K+R",
    category: "KRK",
    difficulty: "beginner",
  },
  {
    id: "krk-2",
    title: "K+R vs K — Back Rank Mate",
    fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
    description:
      "Drive the black king to the edge using the rook, then cut off escape with your own king. The key: always maintain the rook on a rank or file parallel to the enemy king.",
    goal: "checkmate",
    goalText: "Checkmate with K+R",
    category: "KRK",
    difficulty: "beginner",
  },
  {
    id: "lucena",
    title: "Lucena Position",
    fen: "1K1k4/1P6/8/8/8/8/r7/4R3 w - - 0 1",
    description:
      "The most important rook endgame technique: White has a pawn on 7th rank, black rook cuts off the white king. Build a 'bridge' to escort the pawn to promotion.",
    goal: "promote",
    goalText: "Promote the pawn to queen",
    category: "KRPKR",
    difficulty: "advanced",
  },
  {
    id: "philidor",
    title: "Philidor Position — Hold the Draw",
    fen: "4k3/8/8/4PK2/4r3/8/8/4R3 b - - 0 1",
    description:
      "Black must draw with rook vs rook+pawn using the Philidor technique: keep the rook on the 6th rank, then switch to checking from behind. A critical defensive technique.",
    goal: "draw",
    goalText: "Hold the draw with the Philidor Defense",
    category: "KRPKR",
    difficulty: "advanced",
  },

  // ── Pawn endings ──────────────────────────────────────────────────────────
  {
    id: "kpk-1",
    title: "K+P vs K — Opposition",
    fen: "8/8/8/3k4/3P4/3K4/8/8 w - - 0 1",
    description:
      "King opposition is the key to pawn endgames. White must advance the pawn to promotion while keeping the black king at bay. Learn: take the opposition, escort the pawn.",
    goal: "promote",
    goalText: "Promote the pawn",
    category: "KPK",
    difficulty: "beginner",
  },
  {
    id: "kpk-2",
    title: "K+P vs K — Rook Pawn",
    fen: "8/8/8/8/8/k7/p7/K7 b - - 0 1",
    description:
      "A deceptive position: even with an extra pawn, rook pawns draw with the king trapped in the corner by its own pawn. Black must reach the corner before White captures.",
    goal: "draw",
    goalText: "Reach the corner for a draw",
    category: "KPK",
    difficulty: "intermediate",
  },
  {
    id: "kpk-3",
    title: "K+P vs K — Stalemate Trick",
    fen: "7k/8/8/8/8/8/7P/7K w - - 0 1",
    description:
      "White has a rook pawn with the king in the corner. Can White promote or does Black draw? This classic position teaches stalemate avoidance and the correct technique.",
    goal: "promote",
    goalText: "Promote without stalemating",
    category: "KPK",
    difficulty: "intermediate",
  },
  {
    id: "kpk-4",
    title: "Passed Pawn — Key Squares",
    fen: "8/8/4k3/8/3P4/8/8/3K4 w - - 0 1",
    description:
      "White's passed pawn needs its king on a 'key square' to be unstoppable. Identify the key squares (c6/d6/e6) and march your king there while Black tries to stop you.",
    goal: "promote",
    goalText: "Promote the passed pawn",
    category: "pawn",
    difficulty: "intermediate",
  },
  {
    id: "pawn-breakthrough",
    title: "Pawn Breakthrough",
    fen: "8/ppp5/8/PPP5/8/8/8/4K1k1 w - - 0 1",
    description:
      "White can create a passed pawn with a pawn sacrifice breakthrough (a5xb6 or c5xb6). One pawn will race to promotion. A calculation exercise: find the winning sacrifice.",
    goal: "promote",
    goalText: "Create and promote a passed pawn",
    category: "pawn",
    difficulty: "intermediate",
  },
  {
    id: "zugzwang-1",
    title: "Zugzwang — Mutual",
    fen: "8/8/p1k5/8/8/K7/8/8 w - - 0 1",
    description:
      "Both kings eye the pawn — whoever moves first loses the race. The player who is NOT in zugzwang will win. Can White seize the key tempo?",
    goal: "technique",
    goalText: "Win the pawn race",
    category: "pawn",
    difficulty: "intermediate",
  },

  // ── Bishop endings ────────────────────────────────────────────────────────
  {
    id: "kbk-1",
    title: "K+2B vs K — Bishop Checkmate",
    fen: "8/8/8/8/8/8/2K5/k1B1B3 w - - 0 1",
    description:
      "Two bishops are enough to checkmate: drive the king to a corner using the bishops in tandem. The technique requires precise coordination — avoid stalemate!",
    goal: "checkmate",
    goalText: "Checkmate with two bishops",
    category: "KBK",
    difficulty: "intermediate",
  },
  {
    id: "wrong-bishop",
    title: "Wrong Color Bishop",
    fen: "8/8/8/8/8/7k/8/6BK b - - 0 1",
    description:
      "K+B(g1) vs K near h-pawn: if the bishop doesn't control the pawn's queening square, White cannot win. Black simply plays king to h1 and h2. A famous theoretical draw.",
    goal: "draw",
    goalText: "Hold the draw — wrong color bishop",
    category: "KBK",
    difficulty: "intermediate",
  },

  // ── Rook endings ──────────────────────────────────────────────────────────
  {
    id: "rook-cut-off",
    title: "Rook Cutoff — Winning Technique",
    fen: "8/8/8/3k4/8/8/3K4/r2R4 w - - 0 1",
    description:
      "White rook cuts off the black king from the passed pawn's file. Maintain the cutoff and march the king to support the passer. A core rook endgame technique.",
    goal: "technique",
    goalText: "Activate king and win the position",
    category: "rook",
    difficulty: "intermediate",
  },
  {
    id: "rook-active-king",
    title: "Active King in Rook Ending",
    fen: "5r2/8/5k2/8/8/4K3/8/3R4 w - - 0 1",
    description:
      "In rook endings, the active king is decisive. White must activate the king, penetrate, and win material. Rook endings are 80% king activity.",
    goal: "technique",
    goalText: "Activate your king to win",
    category: "rook",
    difficulty: "intermediate",
  },

  // ── Queen vs Pawn ─────────────────────────────────────────────────────────
  {
    id: "qvsp-1",
    title: "Q vs Pawn on 7th — Center Pawn",
    fen: "8/3p4/8/8/8/8/2K5/1k4Q1 w - - 0 1",
    description:
      "Queen wins against a d or e pawn on the 7th rank: approach with checks, force the king in front of the pawn, bring your king in, then win. A famous theoretical technique.",
    goal: "checkmate",
    goalText: "Win with queen vs pawn",
    category: "queen",
    difficulty: "advanced",
  },
  {
    id: "qvsp-2",
    title: "Q vs Rook Pawn — Drawn!",
    fen: "8/7p/8/8/8/8/7K/k4Q2 w - - 0 1",
    description:
      "Queen vs a or h pawn on 7th often draws by stalemate! Black keeps the king near the corner. If White isn't careful, the game ends in stalemate. Know this draw.",
    goal: "draw",
    goalText: "Navigate the stalemate trap — draw",
    category: "queen",
    difficulty: "advanced",
  },

  // ── King Activity ────────────────────────────────────────────────────────
  {
    id: "king-march",
    title: "King March in the Endgame",
    fen: "8/5p2/6k1/8/8/6K1/5P2/8 w - - 0 1",
    description:
      "With symmetrical pawns, the player whose king reaches the opponent's pawn first wins. This race decides the game — advance your king directly and calculate the tempos.",
    goal: "technique",
    goalText: "Win the king race",
    category: "pawn",
    difficulty: "beginner",
  },
  {
    id: "triangulation",
    title: "Triangulation",
    fen: "8/8/3k4/3P4/8/3K4/8/8 b - - 0 1",
    description:
      "Triangulation is a key tempo-gaining technique. White's king takes 3 moves to return to its starting square (via a triangle), losing a tempo and reaching the same position but with Black to move.",
    goal: "technique",
    goalText: "Use triangulation to win",
    category: "pawn",
    difficulty: "advanced",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 *
 */
export const getEndgamesByCategory = (category) =>
  ENDGAMES.filter((e) => e.category === category);

/**
 *
 */
export const getEndgamesByDifficulty = (difficulty) =>
  ENDGAMES.filter((e) => e.difficulty === difficulty);

export const ENDGAME_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "KQK", label: "K+Q vs K" },
  { value: "KRK", label: "K+R vs K" },
  { value: "KPK", label: "K+P vs K" },
  { value: "KBK", label: "K+B vs K" },
  { value: "KRPKR", label: "R+P vs R" },
  { value: "pawn", label: "Pawn Endings" },
  { value: "rook", label: "Rook Endings" },
  { value: "queen", label: "Queen Endings" },
];
