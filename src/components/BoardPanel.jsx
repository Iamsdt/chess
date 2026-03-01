import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  ArrowDownUp,
  Crown,
  Swords,
  AlertTriangle,
  Trophy,
  Handshake,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── piece value map for captured material calculation ──
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_UNICODE = {
  wp: "♙", wn: "♘", wb: "♗", wr: "♖", wq: "♕",
  bp: "♟", bn: "♞", bb: "♝", br: "♜", bq: "♛",
};

const qualityVariantMap = {
  excellent: "excellent",
  good: "good",
  inaccuracy: "inaccuracy",
  mistake: "mistake",
  blunder: "blunder",
};

// ── sounds (Web Audio) ──
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.08;

    if (type === "move") {
      osc.frequency.value = 400;
      osc.type = "sine";
      gain.gain.setTargetAtTime(0, ctx.currentTime + 0.06, 0.02);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } else if (type === "capture") {
      osc.frequency.value = 300;
      osc.type = "triangle";
      gain.gain.value = 0.12;
      gain.gain.setTargetAtTime(0, ctx.currentTime + 0.08, 0.03);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (type === "check") {
      osc.frequency.value = 600;
      osc.type = "square";
      gain.gain.value = 0.06;
      gain.gain.setTargetAtTime(0, ctx.currentTime + 0.15, 0.04);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    } else if (type === "end") {
      osc.frequency.value = 250;
      osc.type = "sawtooth";
      gain.gain.value = 0.1;
      gain.gain.setTargetAtTime(0, ctx.currentTime + 0.4, 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    }
  } catch {
    // audio not available
  }
}

// ── compute captured pieces from move history of a chess.js game ──
function getCapturedPieces(game) {
  const start = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1 },
  };
  const board = game.board();
  const current = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of board) {
    for (const sq of row) {
      if (sq) current[sq.color][sq.type]++;
    }
  }
  const captured = { w: [], b: [] }; // w = white pieces captured (taken by black)
  for (const color of ["w", "b"]) {
    for (const piece of ["q", "r", "b", "n", "p"]) {
      const diff = start[color][piece] - current[color][piece];
      for (let i = 0; i < diff; i++) {
        captured[color].push(color + piece);
      }
    }
  }
  // material advantage
  const whiteTotal = Object.entries(current.w).reduce((s, [p, c]) => s + (PIECE_VALUES[p] || 0) * c, 0);
  const blackTotal = Object.entries(current.b).reduce((s, [p, c]) => s + (PIECE_VALUES[p] || 0) * c, 0);
  return { captured, advantage: whiteTotal - blackTotal };
}

function BoardPanel({
  game,
  onMove,
  moveQuality,
  moveHistory,
  lastMoveSquares,
  onUndo,
}) {
  const containerRef = useRef(null);
  const [boardWidth, setBoardWidth] = useState(400);
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [optionSquares, setOptionSquares] = useState({});
  const moveHistoryRef = useRef(null);

  // ── Resize board ──
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const maxSize = Math.min(width - 48, height - 160);
        setBoardWidth(Math.max(280, Math.floor(maxSize)));
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ── Scroll move history to end ──
  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollLeft = moveHistoryRef.current.scrollWidth;
    }
  }, [moveHistory]);

  const fen = game.fen();
  const inCheck = game.inCheck();
  const isCheckmate = game.isCheckmate();
  const isStalemate = game.isStalemate();
  const isDraw = game.isDraw();
  const isGameOver = game.isGameOver();
  const turn = game.turn(); // 'w' or 'b'

  // ── Game status message ──
  const gameStatus = useMemo(() => {
    if (isCheckmate) return { text: "Checkmate!", icon: Trophy, type: "checkmate" };
    if (isStalemate) return { text: "Stalemate", icon: Handshake, type: "draw" };
    if (isDraw) return { text: "Draw", icon: Handshake, type: "draw" };
    if (inCheck) return { text: "Check!", icon: AlertTriangle, type: "check" };
    return null;
  }, [inCheck, isCheckmate, isStalemate, isDraw]);

  // ── Captured pieces ──
  const { captured, advantage } = useMemo(() => getCapturedPieces(game), [fen]);

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
  }, [fen, inCheck, turn]);

  // ── Compute legal moves for a square ──
  const getMoveOptions = useCallback(
    (square) => {
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
            game.get(move.to) && game.get(move.to).color !== game.get(square)?.color
              ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
              : "radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)",
          borderRadius: "50%",
        };
      });
      setOptionSquares(newSquares);
      setSelectedSquare(square);
      return true;
    },
    [game]
  );

  // ── Handle square click (click-to-move) ──
  function onSquareClick({ square }) {
    setRightClickedSquares({});

    // If a piece is already selected, try to move
    if (selectedSquare) {
      const result = onMove(selectedSquare, square);
      if (result) {
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }
    }

    // Select the clicked piece (if it belongs to the current turn)
    const piece = game.get(square);
    if (piece && piece.color === turn) {
      getMoveOptions(square);
    } else {
      setSelectedSquare(null);
      setOptionSquares({});
    }
  }

  // ── Handle piece drag begin ──
  function onPieceDrag({ sourceSquare }) {
    getMoveOptions(sourceSquare);
  }

  // ── Handle drop ──
  function onDrop(sourceSquare, targetSquare, piece) {
    setSelectedSquare(null);
    setOptionSquares({});
    setRightClickedSquares({});

    const result = onMove(sourceSquare, targetSquare, piece);
    return result !== null;
  }

  // ── Right-click to highlight squares ──
  function onSquareRightClick({ square }) {
    const color = "rgba(0, 0, 255, 0.4)";
    setRightClickedSquares((prev) => {
      const newSquares = { ...prev };
      if (newSquares[square]?.backgroundColor === color) {
        delete newSquares[square];
      } else {
        newSquares[square] = { backgroundColor: color };
      }
      return newSquares;
    });
  }

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

    // Check highlight (red glow on king)
    if (checkSquare) {
      styles[checkSquare] = {
        background: "radial-gradient(circle, rgba(255, 0, 0, 0.6) 0%, rgba(255, 0, 0, 0.2) 60%, transparent 80%)",
      };
    }

    // Legal move dots / selected square
    Object.assign(styles, optionSquares);

    // Right-click highlights
    Object.assign(styles, rightClickedSquares);

    return styles;
  }, [lastMoveSquares, checkSquare, optionSquares, rightClickedSquares]);

  // ── Move history pairs ──
  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moveHistory[i],
        black: moveHistory[i + 1] || null,
      });
    }
    return pairs;
  }, [moveHistory]);

  // ── Captured piece row ──
  function CapturedRow({ pieces, adv }) {
    if (pieces.length === 0 && !adv) return null;
    return (
      <div className="flex items-center gap-0.5 text-sm leading-none min-h-[20px]">
        {pieces.map((p, i) => (
          <span key={i} className="opacity-70">{PIECE_UNICODE[p]}</span>
        ))}
        {adv > 0 && <span className="text-xs text-muted-foreground ml-1">+{adv}</span>}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center gap-2 w-full h-full">

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
      <div className="w-full flex justify-between items-center px-1" style={{ maxWidth: boardWidth }}>
        <CapturedRow
          pieces={boardOrientation === "white" ? captured.w : captured.b}
          adv={boardOrientation === "white" ? (advantage < 0 ? -advantage : 0) : (advantage > 0 ? advantage : 0)}
        />
        <div className="flex items-center gap-1">
          <div className={`h-2.5 w-2.5 rounded-full ${
            (boardOrientation === "white" ? "b" : "w") === turn && !isGameOver
              ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
          }`} />
          <span className="text-xs text-muted-foreground">
            {boardOrientation === "white" ? "Black" : "White"}
          </span>
        </div>
      </div>

      {/* Chess Board */}
      <div
        className="rounded-lg overflow-hidden shadow-lg border border-border"
        style={{ width: boardWidth, height: boardWidth }}
      >
        <Chessboard
          options={{
            id: "main-board",
            position: fen,
            onPieceDrop: ({ sourceSquare, targetSquare, piece }) =>
              onDrop(sourceSquare, targetSquare, piece),
            onSquareClick,
            onPieceClick: ({ square }) => onSquareClick({ square }),
            onSquareRightClick,
            onPieceDrag,
            boardOrientation,
            animationDurationInMs: 200,
            allowDragging: !isGameOver,
            canDragPiece: () => !isGameOver,
            boardStyle: { borderRadius: "0px" },
            darkSquareStyle: { backgroundColor: "#779952" },
            lightSquareStyle: { backgroundColor: "#edeed1" },
            squareStyles,
            dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(0,0,0,.1)" },
          }}
        />
      </div>

      {/* Captured pieces — player (bottom) */}
      <div className="w-full flex justify-between items-center px-1" style={{ maxWidth: boardWidth }}>
        <CapturedRow
          pieces={boardOrientation === "white" ? captured.b : captured.w}
          adv={boardOrientation === "white" ? (advantage > 0 ? advantage : 0) : (advantage < 0 ? -advantage : 0)}
        />
        <div className="flex items-center gap-1">
          <div className={`h-2.5 w-2.5 rounded-full ${
            (boardOrientation === "white" ? "w" : "b") === turn && !isGameOver
              ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
          }`} />
          <span className="text-xs text-muted-foreground">
            {boardOrientation === "white" ? "White" : "Black"}
          </span>
        </div>
      </div>

      {/* Controls row: flip + quality badge + undo */}
      <div className="flex items-center gap-2" style={{ maxWidth: boardWidth, width: "100%" }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
          title="Flip board"
          className="text-muted-foreground"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
        </Button>

        {moveQuality && (
          <Badge variant={qualityVariantMap[moveQuality.toLowerCase()] || "default"}>
            {moveQuality}
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={moveHistory.length === 0}
          title="Undo last move"
          className="text-muted-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Undo
        </Button>
      </div>

      {/* Move history */}
      {movePairs.length > 0 && (
        <div
          ref={moveHistoryRef}
          className="overflow-x-auto overflow-y-hidden rounded-md bg-secondary/50 px-3 py-2 text-xs font-mono whitespace-nowrap"
          style={{ maxWidth: boardWidth, width: "100%" }}
        >
          <div className="flex gap-x-3">
            {movePairs.map((pair) => (
              <span key={pair.number} className="text-muted-foreground flex-shrink-0">
                <span className="text-foreground/40">{pair.number}.</span>{" "}
                <span className="text-foreground">{pair.white}</span>
                {pair.black && (
                  <span className="text-foreground ml-1">{pair.black}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export the playSound so App can trigger it on moves
export { playSound };
export default BoardPanel;
