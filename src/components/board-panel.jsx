import {
  AlertTriangle,
  Trophy,
  Handshake,
  Eye,
  Crown,
  CircleUser,
} from "lucide-react";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";

import { Dropdown } from "./control-bar";

const PLAYER_COLOR_OPTIONS = [
  { value: "white", label: "White", icon: Crown },
  { value: "black", label: "Black", icon: CircleUser },
];

// ── piece value map for captured material calculation ──
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

// ── sounds (Web Audio) ──
/**
 *
 */
const playSound = (type) => {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    gain.gain.value = 0.08;

    if (type === "move") {
      osc.frequency.value = 400;
      osc.type = "sine";
      gain.gain.setTargetAtTime(0, context.currentTime + 0.06, 0.02);
      osc.start();
      osc.stop(context.currentTime + 0.1);
    } else if (type === "capture") {
      osc.frequency.value = 300;
      osc.type = "triangle";
      gain.gain.value = 0.12;
      gain.gain.setTargetAtTime(0, context.currentTime + 0.08, 0.03);
      osc.start();
      osc.stop(context.currentTime + 0.15);
    } else if (type === "check") {
      osc.frequency.value = 600;
      osc.type = "square";
      gain.gain.value = 0.06;
      gain.gain.setTargetAtTime(0, context.currentTime + 0.15, 0.04);
      osc.start();
      osc.stop(context.currentTime + 0.2);
    } else if (type === "end") {
      osc.frequency.value = 250;
      osc.type = "sawtooth";
      gain.gain.value = 0.1;
      gain.gain.setTargetAtTime(0, context.currentTime + 0.4, 0.1);
      osc.start();
      osc.stop(context.currentTime + 0.5);
    }
  } catch {
    // audio not available
  }
};

// ── compute captured pieces from move history of a chess.js game ──
/**
 *
 */
const getCapturedPieces = (game) => {
  const start = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1 },
  };
  const board = game.board();
  const current = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const row of board) {
    for (const sq of row) {
      if (sq) current[sq.color][sq.type]++;
    }
  }
  // captured[color] = pieces of that color that were taken
  // capturedPts[color] = total point value of pieces taken from that side
  const captured = { w: [], b: [] };
  const capturedPts = { w: 0, b: 0 };
  for (const color of ["w", "b"]) {
    for (const piece of ["q", "r", "b", "n", "p"]) {
      const diff = start[color][piece] - current[color][piece];
      for (let index = 0; index < diff; index++) {
        captured[color].push(color + piece);
      }
      capturedPts[color] += (PIECE_VALUES[piece] || 0) * Math.max(0, diff);
    }
  }
  // material advantage: positive = white remaining material > black remaining material
  const whiteTotal = Object.entries(current.w).reduce(
    (s, [p, c]) => s + (PIECE_VALUES[p] || 0) * c,
    0,
  );
  const blackTotal = Object.entries(current.b).reduce(
    (s, [p, c]) => s + (PIECE_VALUES[p] || 0) * c,
    0,
  );
  return { captured, capturedPts, advantage: whiteTotal - blackTotal };
};

// ── Captured piece row — defined outside BoardPanel to avoid React warnings ──
const CapturedRow = ({ totalPts, adv }) => (
  <div className="flex items-center gap-1.5 min-h-[22px]">
    {totalPts > 0 && (
      <span className="text-xs font-medium text-foreground tabular-nums">
        {totalPts} pts
      </span>
    )}
    {adv > 0 && (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold
          bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
      >
        +{adv}
      </span>
    )}
  </div>
);

/**
 *
 */
const BoardPanel = ({
  game,
  onMove,
  lastMoveSquares,
  playerColor,
  onPlayerColorChange,
  isGameInProgress,
  isAIThinking = false,
  boardOrientation = "white",
  arrows = [],
  isReviewMode = false,
  premove = null,
  onCancelPremove = null,
}) => {
  const containerReference = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [optionSquares, setOptionSquares] = useState({});
  // ── Track invalid/blocked square for shake animation ──
  const [invalidSquare, setInvalidSquare] = useState(null);

  // ── Resize board ──
  useEffect(() => {
    /**
     *
     */
    const updateSize = () => {
      if (containerReference.current) {
        const { width, height } =
          containerReference.current.getBoundingClientRect();
        const maxSize = Math.min(width - 48, height - 120);
        setBoardWidth(Math.max(280, Math.floor(maxSize)));
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ── Clear shake animation after it plays ──
  useEffect(() => {
    if (invalidSquare) {
      const t = setTimeout(() => setInvalidSquare(null), 500);
      return () => clearTimeout(t);
    }
  }, [invalidSquare]);

  const fen = game.fen();
  const inCheck = game.inCheck();
  const isCheckmate = game.isCheckmate();
  const isStalemate = game.isStalemate();
  const isDraw = game.isDraw();
  const isGameOver = game.isGameOver();
  const turn = game.turn(); // 'w' or 'b'

  // ── Game status message ──
  const gameStatus = useMemo(() => {
    if (isCheckmate) {
      return { text: "Checkmate!", icon: Trophy, type: "checkmate" };
    }
    if (isStalemate) {
      return { text: "Stalemate", icon: Handshake, type: "draw" };
    }
    if (isDraw) return { text: "Draw", icon: Handshake, type: "draw" };
    if (inCheck) return { text: "Check!", icon: AlertTriangle, type: "check" };
    return null;
  }, [inCheck, isCheckmate, isStalemate, isDraw]);

  // ── Captured pieces ──
  const { capturedPts, advantage } = useMemo(
    () => getCapturedPieces(game),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, fen], // fen ensures re-computation on every move (game is mutable)
  );

  // ── Find king square when in check ──
  const checkSquare = useMemo(() => {
    if (!inCheck) return null;
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = board[r][c];
        if (sq && sq.type === "k" && sq.color === turn) {
          const file = String.fromCharCode(97 + c);
          const rank = 8 - r;
          return `${file}${rank}`;
        }
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, inCheck, turn]); // fen is sufficient — game is mutable object

  // ── Compute legal moves for a square ──
  const getMoveOptions = useCallback(
    (square) => {
      if (isReviewMode) return false;
      const moves = game.moves({ square, verbose: true });
      if (moves.length === 0) {
        setOptionSquares({});
        setSelectedSquare(null);
        return false;
      }

      const newSquares = {};
      // highlight selected square
      newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
      moves.forEach((move) => {
        newSquares[move.to] = {
          background:
            game.get(move.to) &&
            game.get(move.to).color !== game.get(square)?.color
              ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
              : "radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)",
          borderRadius: "50%",
        };
      });
      setOptionSquares(newSquares);
      setSelectedSquare(square);
      return true;
    },
    [game, isReviewMode],
  );

  // ── Handle square click (click-to-move) ──
  /**
   *
   */
  const onSquareClick = ({ square }) => {
    if (isReviewMode) return;
    setRightClickedSquares({});

    // A piece is already selected — try to move or reselect
    if (selectedSquare) {
      // Clicking the same square deselects
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }

      // Is this a valid legal-move target?
      const isValidTarget = Boolean(optionSquares[square]);

      if (isValidTarget) {
        const result = onMove(selectedSquare, square);
        if (result) {
          setSelectedSquare(null);
          setOptionSquares({});
          return;
        }
      }

      // Clicking own piece → reselect it
      const piece = game.get(square);
      if (piece && piece.color === turn) {
        const hasMoves = getMoveOptions(square);
        if (!hasMoves) setInvalidSquare(square); // fully pinned piece
        return;
      }

      // Clicked non-legal enemy/empty square — shake selected piece
      setInvalidSquare(selectedSquare);
      setSelectedSquare(null);
      setOptionSquares({});
      return;
    }

    // No piece selected yet — try to select
    const piece = game.get(square);
    if (piece && piece.color === turn) {
      const hasMoves = getMoveOptions(square);
      if (!hasMoves) {
        // Piece exists but no legal moves (pinned / blocked)
        setInvalidSquare(square);
      }
    } else if (piece) {
      // Wrong color piece — shake it
      setInvalidSquare(square);
    } else {
      setSelectedSquare(null);
      setOptionSquares({});
    }
  };

  // ── Handle piece drag begin ──
  /**
   *
   */
  const onPieceDrag = ({ sourceSquare }) => {
    if (isReviewMode) return;
    getMoveOptions(sourceSquare);
  };

  // ── Handle drop ──
  /**
   *
   */
  const onDrop = (sourceSquare, targetSquare, piece) => {
    if (isReviewMode) return false;
    setSelectedSquare(null);
    setOptionSquares({});
    setRightClickedSquares({});

    const result = onMove(sourceSquare, targetSquare, piece);
    return result !== null;
  };

  // ── Right-click to highlight squares ──
  /**
   *
   */
  const onSquareRightClick = ({ square }) => {
    const color = "rgba(0, 0, 255, 0.4)";
    setRightClickedSquares((previous) => {
      const newSquares = { ...previous };
      if (newSquares[square]?.backgroundColor === color) {
        delete newSquares[square];
      } else {
        newSquares[square] = { backgroundColor: color };
      }
      return newSquares;
    });
  };

  // ── Combine all square styles ──
  const squareStyles = useMemo(() => {
    const styles = {};

    // Last move highlight
    if (lastMoveSquares) {
      if (lastMoveSquares.from) {
        styles[lastMoveSquares.from] = {
          backgroundColor: "rgba(255, 255, 0, 0.25)",
        };
      }
      if (lastMoveSquares.to) {
        styles[lastMoveSquares.to] = {
          backgroundColor: "rgba(255, 255, 0, 0.35)",
        };
      }
    }

    // ── King in check: solid red background with glow ──
    if (checkSquare) {
      styles[checkSquare] = {
        backgroundColor: "#ef4444",
        boxShadow: "0 0 0 3px #ef4444, 0 0 18px 6px rgba(239,68,68,0.6)",
        animation: "check-pulse 1s ease-in-out infinite",
      };
    }

    // ── Blocked/invalid move square: shake animation ──
    if (invalidSquare) {
      styles[invalidSquare] = {
        ...styles[invalidSquare],
        backgroundColor: "rgba(239, 68, 68, 0.35)",
        animation: "shake 0.45s ease-in-out",
      };
    }

    // Legal move dots / selected square
    Object.assign(styles, optionSquares);

    // Right-click highlights
    Object.assign(styles, rightClickedSquares);

    // Premove highlight — cyan/teal
    if (premove) {
      styles[premove.from] = { backgroundColor: "rgba(20, 184, 166, 0.45)" };
      styles[premove.to] = { backgroundColor: "rgba(20, 184, 166, 0.65)" };
    }

    return styles;
  }, [
    lastMoveSquares,
    checkSquare,
    optionSquares,
    rightClickedSquares,
    invalidSquare,
    premove,
  ]);

  return (
    <div
      ref={containerReference}
      className="flex flex-col items-center justify-center gap-2 w-full h-full"
    >
      {/* Game status banner */}
      {gameStatus && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
            gameStatus.type === "checkmate"
              ? "bg-yellow-500/15 text-yellow-400"
              : gameStatus.type === "check"
                ? "bg-red-500/15 text-red-400"
                : "bg-blue-500/15 text-blue-400"
          }`}
        >
          <gameStatus.icon className="h-4 w-4" />
          {gameStatus.text}
          {isCheckmate && (
            <span className="text-xs opacity-70 ml-1">
              {turn === "w" ? "Black" : "White"} wins
            </span>
          )}
        </div>
      )}

      {/* Captured pieces — opponent (top) */}
      <div
        className="w-full flex justify-between items-center px-1"
        style={{ maxWidth: boardWidth }}
      >
        <Dropdown
          label="Play as"
          icon={playerColor === "white" ? Crown : CircleUser}
          options={PLAYER_COLOR_OPTIONS}
          value={playerColor}
          onChange={onPlayerColorChange}
          disabled={isGameInProgress}
        />
        <CapturedRow
          totalPts={
            boardOrientation === "white" ? capturedPts.w : capturedPts.b
          }
          adv={
            boardOrientation === "white"
              ? advantage < 0
                ? -advantage
                : 0
              : advantage > 0
                ? advantage
                : 0
          }
        />
        <div className="flex items-center gap-1">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              (boardOrientation === "white" ? "b" : "w") === turn && !isGameOver
                ? "bg-primary animate-pulse"
                : "bg-muted-foreground/30"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {boardOrientation === "white" ? "Black" : "White"}
          </span>
        </div>
      </div>

      {/* Chess Board */}
      <div
        className="rounded-lg overflow-hidden shadow-lg border border-border relative"
        style={{ width: boardWidth, height: boardWidth }}
      >
        {/* AI thinking overlay */}
        {isAIThinking && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 pointer-events-none">
            <div className="bg-card/90 border border-border rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg text-xs text-primary">
              <span className="animate-spin inline-block">⚙</span>
              AI thinking…
            </div>
          </div>
        )}
        {/* Review mode overlay badge */}
        {isReviewMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-amber-500/90 text-black text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
              <Eye className="h-3 w-3" />
              Review Mode
            </div>
          </div>
        )}
        {/* Premove indicator */}
        {premove && !isReviewMode && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={onCancelPremove}
              className="bg-teal-500/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md hover:bg-teal-600/90 transition-colors"
              title="Click to cancel premove"
            >
              <span className="animate-pulse">⚡</span>
              Premove queued — click to cancel
            </button>
          </div>
        )}
        <Chessboard
          options={{
            id: "main-board",
            position: fen,
            onPieceDrop: ({ sourceSquare, targetSquare, piece }) =>
              onDrop(sourceSquare, targetSquare, piece),
            onSquareClick:
              isAIThinking || isReviewMode ? () => {} : onSquareClick,
            onPieceClick:
              isAIThinking || isReviewMode
                ? () => {}
                : ({ square }) => onSquareClick({ square }),
            onSquareRightClick,
            onPieceDrag,
            boardOrientation,
            animationDurationInMs: 200,
            allowDragging: !isGameOver && !isAIThinking && !isReviewMode,
            canDragPiece: () => !isGameOver && !isAIThinking && !isReviewMode,
            boardStyle: { borderRadius: "0px" },
            darkSquareStyle: { backgroundColor: "#779952" },
            lightSquareStyle: { backgroundColor: "#edeed1" },
            squareStyles,
            dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(0,0,0,.1)" },
            showNotation: true,
            arrows,
            clearArrowsOnPositionChange: false,
            clearArrowsOnClick: false,
          }}
        />
      </div>

      {/* Captured pieces — player (bottom) */}
      <div
        className="w-full flex justify-between items-center px-1"
        style={{ maxWidth: boardWidth }}
      >
        <CapturedRow
          totalPts={
            boardOrientation === "white" ? capturedPts.b : capturedPts.w
          }
          adv={
            boardOrientation === "white"
              ? advantage > 0
                ? advantage
                : 0
              : advantage < 0
                ? -advantage
                : 0
          }
        />
        <div className="flex items-center gap-1">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              (boardOrientation === "white" ? "w" : "b") === turn && !isGameOver
                ? "bg-primary animate-pulse"
                : "bg-muted-foreground/30"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {boardOrientation === "white" ? "White" : "Black"}
          </span>
        </div>
      </div>
    </div>
  );
};

// Export the playSound so App can trigger it on moves
export { playSound };
export default BoardPanel;
