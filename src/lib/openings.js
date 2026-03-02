/**
 * Chess opening recognition database.
 *
 * Used to identify when opponent moves belong to known opening theory,
 * so we can offer "Learn with AI" educational moments during live games.
 *
 * Each entry has:
 *   eco      – ECO classification code
 *   name     – Full opening name
 *   moves    – Space-separated SAN move sequence (as chess.js produces)
 *   category – "open" | "semi-open" | "closed" | "flank"
 *   idea     – One-line educational description of the key idea
 */

export const OPENINGS = [
  // ── Open Games (1.e4 e5) ──────────────────────────────────────────────────
  {
    eco: "C20",
    name: "King's Pawn Opening",
    moves: "e4 e5",
    category: "open",
    idea: "Both sides seize the center with pawns, leading to open, tactical positions.",
  },
  {
    eco: "C60",
    name: "Ruy Lopez (Spanish Opening)",
    moves: "e4 e5 Nf3 Nc6 Bb5",
    category: "open",
    idea: "White pins the knight defending e5, building long-term positional pressure — one of the oldest and most studied openings.",
  },
  {
    eco: "C67",
    name: "Ruy Lopez — Berlin Defense",
    moves: "e4 e5 Nf3 Nc6 Bb5 Nf6",
    category: "open",
    idea: "Black defends solidly with the knight, often leading to a favorable endgame. Favored by top grandmasters.",
  },
  {
    eco: "C50",
    name: "Italian Game",
    moves: "e4 e5 Nf3 Nc6 Bc4",
    category: "open",
    idea: "White develops the bishop to a strong diagonal targeting f7 and the center. Very common at club level.",
  },
  {
    eco: "C54",
    name: "Giuoco Piano",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3",
    category: "open",
    idea: "White prepares d4 to build a strong pawn center. A classic, solid opening.",
  },
  {
    eco: "C55",
    name: "Two Knights Defense",
    moves: "e4 e5 Nf3 Nc6 Bc4 Nf6",
    category: "open",
    idea: "Black counterattacks with the knight rather than defending, creating sharp tactical complications.",
  },
  {
    eco: "C44",
    name: "Scotch Game",
    moves: "e4 e5 Nf3 Nc6 d4",
    category: "open",
    idea: "White immediately challenges the center with d4, seizing the initiative and opening the position early.",
  },
  {
    eco: "C45",
    name: "Scotch Game — Main Line",
    moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4",
    category: "open",
    idea: "After the central exchange, White's knight is powerfully centralized on d4. Kasparov's favorite weapon.",
  },
  {
    eco: "C40",
    name: "Petrov's Defense",
    moves: "e4 e5 Nf3 Nf6",
    category: "open",
    idea: "Black mirrors White's knight move — a solid, symmetrical defense that avoids most sharp lines.",
  },
  {
    eco: "C30",
    name: "King's Gambit",
    moves: "e4 e5 f4",
    category: "open",
    idea: "White sacrifices a pawn for rapid development and a ferocious kingside attack. A romantic, attacking opening.",
  },
  {
    eco: "C33",
    name: "King's Gambit Accepted",
    moves: "e4 e5 f4 exf4",
    category: "open",
    idea: "Black accepts the pawn sacrifice, forcing White to prove the compensation is sufficient.",
  },
  {
    eco: "C23",
    name: "Bishop's Opening",
    moves: "e4 e5 Bc4",
    category: "open",
    idea: "An early bishop development, less committal than Nf3, keeping flexible transposition options.",
  },
  {
    eco: "C20",
    name: "Vienna Game",
    moves: "e4 e5 Nc3",
    category: "open",
    idea: "White reinforces e4 with the knight, keeping the center flexible and preparing f4.",
  },
  {
    eco: "C25",
    name: "Vienna Gambit",
    moves: "e4 e5 Nc3 Nc6 f4",
    category: "open",
    idea: "White combines the Vienna setup with an aggressive f4 pawn thrust, creating a mini King's Gambit.",
  },
  {
    eco: "C41",
    name: "Philidor Defense",
    moves: "e4 e5 Nf3 d6",
    category: "open",
    idea: "Black solidly defends e5 with a pawn. The position can become passive, but is structurally sound.",
  },

  // ── Sicilian Defense ──────────────────────────────────────────────────────
  {
    eco: "B20",
    name: "Sicilian Defense",
    moves: "e4 c5",
    category: "semi-open",
    idea: "The most popular reply to e4 at every level. Black fights for the center asymmetrically, creating complex positions where both sides have winning chances.",
  },
  {
    eco: "B22",
    name: "Sicilian Alapin",
    moves: "e4 c5 c3",
    category: "semi-open",
    idea: "White prepares d4 next move, sidestepping vast amounts of Sicilian theory. A solid, practical weapon.",
  },
  {
    eco: "B23",
    name: "Closed Sicilian",
    moves: "e4 c5 Nc3",
    category: "semi-open",
    idea: "White avoids the open Sicilian by reinforcing e4, keeping tension and planning a kingside attack.",
  },
  {
    eco: "B21",
    name: "Smith-Morra Gambit",
    moves: "e4 c5 d4 cxd4 c3",
    category: "semi-open",
    idea: "White sacrifices a pawn for rapid development against the Sicilian. A dangerous weapon in club chess.",
  },
  {
    eco: "B60",
    name: "Sicilian Najdorf",
    moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
    category: "semi-open",
    idea: "The most analyzed opening in chess. a6 prevents Bb5 and prepares queenside expansion. Kasparov's and Fischer's signature weapon.",
  },
  {
    eco: "B70",
    name: "Sicilian Dragon",
    moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6",
    category: "semi-open",
    idea: "Black fianchettoes the bishop on g7, creating a powerful 'dragon' diagonal. Sharp and double-edged with opposite-side castling attacks.",
  },
  {
    eco: "B80",
    name: "Sicilian Scheveningen",
    moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6",
    category: "semi-open",
    idea: "A flexible system where Black builds a solid center and waits to react. Rich in strategic ideas.",
  },

  // ── Other Semi-Open Defenses ──────────────────────────────────────────────
  {
    eco: "B01",
    name: "Scandinavian Defense",
    moves: "e4 d5",
    category: "semi-open",
    idea: "Black immediately challenges e4 with d5. After exd5, Black usually recaptures with the queen, leading to unique positions.",
  },
  {
    eco: "B02",
    name: "Scandinavian Defense — Center Variation",
    moves: "e4 d5 exd5 Qxd5",
    category: "semi-open",
    idea: "Black develops the queen early but it can be harassed. The compensation is quick development and a clear center.",
  },
  {
    eco: "B10",
    name: "Caro-Kann Defense",
    moves: "e4 c6",
    category: "semi-open",
    idea: "Black prepares d5 with c6, maintaining a sound pawn structure. Solid and reliable — a favorite of Karpov.",
  },
  {
    eco: "B12",
    name: "Caro-Kann Advance Variation",
    moves: "e4 c6 d4 d5 e5",
    category: "semi-open",
    idea: "White advances and grabs space with e5. Black targets the d4 pawn and seeks queenside counterplay.",
  },
  {
    eco: "B15",
    name: "Caro-Kann — Main Line",
    moves: "e4 c6 d4 d5 Nc3",
    category: "semi-open",
    idea: "The classical main line — White develops naturally while Black prepares to recapture with the c-pawn.",
  },
  {
    eco: "C00",
    name: "French Defense",
    moves: "e4 e6",
    category: "semi-open",
    idea: "Black prepares d5 with e6, creating a solid but potentially cramped position. Rich in strategic ideas on both sides.",
  },
  {
    eco: "C02",
    name: "French Advance Variation",
    moves: "e4 e6 d4 d5 e5",
    category: "semi-open",
    idea: "White claims space with e5. Black attacks the d4 pawn chain and seeks counterplay on the queenside.",
  },
  {
    eco: "C11",
    name: "French Defense — Classical",
    moves: "e4 e6 d4 d5 Nc3 Nf6",
    category: "semi-open",
    idea: "Black develops the knight to f6, attacking White's center directly. A critical theoretical battle.",
  },
  {
    eco: "B07",
    name: "Pirc Defense",
    moves: "e4 d6 d4 Nf6 Nc3 g6",
    category: "semi-open",
    idea: "Black allows White a big center, then counterattacks it with pieces from the flanks. Flexible and hypermodern.",
  },
  {
    eco: "B06",
    name: "Modern Defense",
    moves: "e4 g6",
    category: "semi-open",
    idea: "Black fianchettoes immediately, ceding the center then attacking it later with pieces. Very flexible.",
  },
  {
    eco: "B00",
    name: "Nimzowitsch Defense",
    moves: "e4 Nc6",
    category: "semi-open",
    idea: "Black develops a knight to fight for center control without committing pawns. Unorthodox but playable.",
  },

  // ── Closed Games (1.d4) ───────────────────────────────────────────────────
  {
    eco: "D06",
    name: "Queen's Gambit",
    moves: "d4 d5 c4",
    category: "closed",
    idea: "White offers a pawn to gain central control. The most classical queen's pawn opening, played at the highest levels for centuries.",
  },
  {
    eco: "D30",
    name: "Queen's Gambit Declined",
    moves: "d4 d5 c4 e6",
    category: "closed",
    idea: "Black firmly declines the gambit, maintaining a solid central pawn. Structurally sound but requires patience.",
  },
  {
    eco: "D20",
    name: "Queen's Gambit Accepted",
    moves: "d4 d5 c4 dxc4",
    category: "closed",
    idea: "Black accepts the pawn but will return it for quick development and active counterplay.",
  },
  {
    eco: "D10",
    name: "Slav Defense",
    moves: "d4 d5 c4 c6",
    category: "closed",
    idea: "A solid reply that supports d5 without blocking the c8 bishop — one of Black's most reliable defenses.",
  },
  {
    eco: "D31",
    name: "Semi-Slav Defense",
    moves: "d4 d5 c4 e6 Nc3 c6",
    category: "closed",
    idea: "A hybrid of QGD and Slav — flexible and rich in both strategic and tactical ideas. Highly theoretical.",
  },
  {
    eco: "E60",
    name: "King's Indian Defense",
    moves: "d4 Nf6 c4 g6",
    category: "closed",
    idea: "Black fianchettoes and allows White a big center, then launches a kingside attack with e5. Aggressive and counterattacking — Fischer's favorite.",
  },
  {
    eco: "E20",
    name: "Nimzo-Indian Defense",
    moves: "d4 Nf6 c4 e6 Nc3 Bb4",
    category: "closed",
    idea: "Black pins White's knight with the bishop, disrupting center control. One of the most solid and respected defenses, invented by Nimzowitsch.",
  },
  {
    eco: "A50",
    name: "Queen's Indian Defense",
    moves: "d4 Nf6 c4 e6 Nf3 b6",
    category: "closed",
    idea: "Black fianchettoes the queen's bishop to control the long a8-h1 diagonal. Flexible and strategic.",
  },
  {
    eco: "D80",
    name: "Grünfeld Defense",
    moves: "d4 Nf6 c4 g6 Nc3 d5",
    category: "closed",
    idea: "Black allows White a massive center then attacks it with pieces. Very theoretical and sharp — a favorite of Bobby Fischer.",
  },
  {
    eco: "A00",
    name: "Dutch Defense",
    moves: "d4 f5",
    category: "closed",
    idea: "Black seizes the e4 square immediately with f5, aiming for a kingside attack. Unbalanced and aggressive.",
  },
  {
    eco: "A43",
    name: "London System",
    moves: "d4 d5 Nf3 Nf6 Bf4",
    category: "closed",
    idea: "A solid, flexible system where White develops calmly and avoids theoretical fights. Very popular at club level.",
  },
  {
    eco: "A45",
    name: "Trompowsky Attack",
    moves: "d4 Nf6 Bg5",
    category: "closed",
    idea: "White immediately pins the knight, trying to create imbalances and sidestep main-line theory.",
  },
  {
    eco: "E00",
    name: "Catalan Opening",
    moves: "d4 Nf6 c4 e6 g3",
    category: "closed",
    idea: "White combines Queen's Gambit strategy with a fianchettoed bishop on g2, creating long-term pressure on the queenside.",
  },

  // ── Flank / Irregular Openings ─────────────────────────────────────────────
  {
    eco: "A10",
    name: "English Opening",
    moves: "c4",
    category: "flank",
    idea: "White controls d5 with the c-pawn, often transposing into d4 openings or leading to unique reversed-Sicilian structures.",
  },
  {
    eco: "A20",
    name: "English Opening — King's English",
    moves: "c4 e5",
    category: "flank",
    idea: "Black seizes the center immediately. Leads to rich strategic positions related to the Sicilian from White's side.",
  },
  {
    eco: "A06",
    name: "Réti Opening",
    moves: "Nf3 d5",
    category: "flank",
    idea: "White develops the knight first and plans g3 + Bg2, fighting for the center from a distance in hypermodern style.",
  },
  {
    eco: "A05",
    name: "Réti System",
    moves: "Nf3 Nf6",
    category: "flank",
    idea: "A flexible first move that keeps all options open — typical of hypermodern play developed by Richard Réti.",
  },
  {
    eco: "A07",
    name: "King's Indian Attack",
    moves: "Nf3 d5 g3",
    category: "flank",
    idea: "White builds a King's Indian setup from the White side — solid, versatile, and used by Bobby Fischer against the French.",
  },
  {
    eco: "A00",
    name: "Bird's Opening",
    moves: "f4",
    category: "flank",
    idea: "White controls e5 immediately with f4. Leads to unique positions related to the Dutch Defense from White's perspective.",
  },
  {
    eco: "A00",
    name: "Larsen's Opening",
    moves: "b3",
    category: "flank",
    idea: "White prepares a queenside fianchetto. Hypermodern and rare, but effective — used by Bent Larsen to surprise opponents.",
  },
  {
    eco: "A00",
    name: "Polish Opening",
    moves: "b4",
    category: "flank",
    idea: "An early queenside flank advance, known as the Orangutan Opening. Very rare but disruptive against unprepared opponents.",
  },
];

/**
 * Detect if the current game's move history matches a known opening.
 * Returns the longest (most specific) matching opening, or null.
 * @param {string[]} moveHistory - Array of SAN moves played so far
 * @returns {{ eco, name, category, idea, moves } | null}
 */
export const detectOpening = (moveHistory) => {
  if (!moveHistory || moveHistory.length === 0) return null;

  const gameString = moveHistory.join(" ");
  let best = null;
  let bestLength = 0;

  for (const opening of OPENINGS) {
    const oMoves = opening.moves;
    // Match: game history starts with this opening's exact moves
    if (gameString === oMoves || gameString.startsWith(`${oMoves} `)) {
      const { length } = oMoves.split(" ");
      if (length > bestLength) {
        bestLength = length;
        best = opening;
      }
    }
  }

  return best;
};
