import { Chess } from "chess.js";
import { useRef, useCallback } from "react";

import { getGMThoughtProcess } from "@/lib/ai";
import { analyzeFullGame } from "@/lib/analyzer";
import {
  buildAnalysisMessage,
  buildBestMoveCard,
  buildHintCard,
  buildLiveAnalysisMessage,
  fmtScore,
  pvToSan,
} from "@/lib/chess-helpers";
import { buildMyMoveCard, buildThreatCard } from "@/lib/intelligence";
import { getStockfishEngine } from "@/lib/stockfish";

const toMoveBullet = (move) =>
  `- **${move.move}** (${move.verdict}): ${move.idea}`;

const toLineBullet = (line) => {
  const sequence = (line.sequence || []).join(" ");
  const suffix = line.eval ? ` [${line.eval}]` : "";
  const verdict = line.verdict ? ` - ${line.verdict}` : "";
  return `- ${sequence}${suffix}${verdict}`;
};

const buildGMMarkdownFromAI = (gmData, fen) => {
  const sections = ["# Think Like a GM"];

  if (gmData.positionLabel) {
    sections.push(`**Position:** ${gmData.positionLabel}`);
  }

  sections.push(`**FEN:** \`${fen}\``);

  if (gmData.step1?.points?.length) {
    sections.push(
      "",
      `## ${gmData.step1.title || "What's Happening?"}`,
      ...gmData.step1.points.map((point) => `- ${point}`),
    );
  }

  if (gmData.step2?.moves?.length) {
    sections.push(
      "",
      `## ${gmData.step2.title || "Candidate Moves"}`,
      ...gmData.step2.moves.map(toMoveBullet),
    );
  }

  if (gmData.step3?.lines?.length) {
    sections.push(
      "",
      `## ${gmData.step3.title || "Calculation"}`,
      ...gmData.step3.lines.map(toLineBullet),
    );
  }

  if (gmData.step4) {
    const immediate = gmData.step4.immediate || [];
    const longTerm = gmData.step4.longTerm || [];
    sections.push("", `## ${gmData.step4.title || "The Plan"}`);

    if (immediate.length) {
      sections.push("### Immediate", ...immediate.map((point) => `- ${point}`));
    }

    if (longTerm.length) {
      sections.push(
        "",
        "### Long-term",
        ...longTerm.map((point) => `- ${point}`),
      );
    }
  }

  if (gmData.bestMove) {
    sections.push(
      "",
      `## Best Move: \`${gmData.bestMove}\``,
      gmData.bestMoveReason || "This move best matches the engine's top line.",
    );
  }

  return sections.join("\n");
};

const buildGMMarkdownFromEngine = (fen, moveHistorySan, result) => {
  const position = new Chess(fen);
  const sideToMove = position.turn() === "w" ? "White" : "Black";
  const overallEval = fmtScore(
    result.scoreCp,
    result.isMate,
    result.mateIn,
    position.turn() === "w",
  );
  const lines = result.lines
    .slice(0, 3)
    .map((line, index) => {
      const sanMoves = pvToSan(fen, line.pv || []).slice(0, 6);
      const evalString = line.isMate
        ? `Mate in ${Math.abs(line.mateIn)}`
        : line.scoreCp !== null
          ? `${line.scoreCp >= 0 ? "+" : ""}${(line.scoreCp / 100).toFixed(2)}`
          : "?";

      return {
        label: index === 0 ? "Best line" : `Alternative ${index}`,
        moves: sanMoves,
        evalString,
      };
    })
    .filter((line) => line.moves.length > 0);

  const bestLine = lines[0];
  const bestMove = bestLine?.moves[0] || "No legal move";
  const moveHistoryText =
    moveHistorySan.length > 0 ? moveHistorySan.join(" ") : "No moves yet";
  const bestLineText = bestLine
    ? bestLine.moves.join(" ")
    : "No principal variation available.";
  const runnerUp = lines[1];
  const comparison = runnerUp
    ? `Compared with ${runnerUp.moves[0]}, Stockfish keeps a stronger evaluation in the main line.`
    : `Stockfish's main line is ${bestLineText}.`;

  return [
    "# Think Like a GM",
    `**Moves so far:** ${moveHistoryText}`,
    `**FEN:** \`${fen}\``,
    `**Side to move:** ${sideToMove}`,
    `**Evaluation:** ${overallEval}`,
    "",
    "## Plan",
    `Start by calculating forcing moves for ${sideToMove.toLowerCase()}, then compare them against the engine's top continuation before committing.`,
    comparison,
    "",
    "## Candidate Moves",
    ...lines.map((line) => {
      const [firstMove = "No move"] = line.moves;
      return `- **${firstMove}** (${line.label}, eval ${line.evalString}): ${line.moves.join(" ")}`;
    }),
    "",
    `## Best Move: \`${bestMove}\``,
    `Play ${bestMove} because it leads to Stockfish's top continuation: ${bestLineText}.`,
    "",
    "## Why",
    `- It preserves the strongest engine evaluation in the position.`,
    `- It gives a clear calculation path instead of drifting into a slower plan.`,
    `- It is backed by the deepest principal variation currently available from the engine.`,
  ].join("\n");
};

/**
 * Handles all Stockfish/engine analysis interactions:
 * - eval bar updates
 * - live analysis after moves
 * - manual analyze / best-move / hint requests
 * - post-game full analysis
 */
const useEngineCoach = ({
  gameRef,
  setMessages,
  setEvalScore,
  setIsLoading,
  setBestMoveArrows,
  setIsAnalyzing,
  setAnalysisProgress,
  setGameReport,
  setGameReportOpen,
}) => {
  const messageSeedReference = useRef(0);
  const isAnalyzingReference = useRef(false);

  // ── Apply White-perspective eval score ──────────────────────────────────
  const applyEvalScore = useCallback(
    (result, fen) => {
      if (result.isMate) {
        setEvalScore({ cp: null, mate: result.mate });
      } else if (result.scoreCp !== null) {
        // Stockfish always returns score from side-to-move perspective;
        // convert to white's perspective for the eval bar.
        const isBlackToMove = fen.split(" ")[1] === "b";
        const whiteCp = isBlackToMove ? -result.scoreCp : result.scoreCp;
        setEvalScore({ cp: whiteCp, mate: null });
      }
    },
    [setEvalScore],
  );

  // ── Lightweight eval bar update after every move ──────────────────────
  const updateEvalBar = useCallback(
    (fen) => {
      const sf = getStockfishEngine();
      sf.analyze(fen, 10, 1)
        .then((result) => applyEvalScore(result, fen))
        .catch(() => {
          /* silent */
        });
    },
    [applyEvalScore],
  );

  // ── Intelligence: analyze player's move vs Stockfish best ────────────
  const engineLiveAnalyzePlayerMove = useCallback(
    async (preFen, moveSan, postFen) => {
      const sf = getStockfishEngine();
      const userElo = Number.parseInt(
        localStorage.getItem("chess-coach-elo") || "1000",
        10,
      );
      const seed = messageSeedReference.current++;
      try {
        const preResult = await sf.analyze(preFen, 14, 1);
        const postResult = await sf.analyze(postFen, 10, 1);
        applyEvalScore(postResult, postFen);
        const card = buildMyMoveCard(
          preFen,
          moveSan,
          preResult,
          postResult,
          userElo,
          seed,
        );
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: card, type: "my-move-analysis" },
        ]);
      } catch {
        updateEvalBar(postFen);
      }
    },
    [applyEvalScore, updateEvalBar, setMessages],
  );

  // ── Intelligence: detect threats after opponent's move ────────────────
  const runThreatDetection = useCallback(
    (game, opponentColor, lastMoveTo, moveSan, moveHistorySans) => {
      const seed = messageSeedReference.current++;
      try {
        const card = buildThreatCard(
          game,
          opponentColor,
          lastMoveTo,
          moveSan,
          seed,
          moveHistorySans,
        );
        if (card) {
          setMessages((previous) => [
            ...previous,
            { role: "assistant", content: card, type: "threat-card" },
          ]);
        }
      } catch {
        /* silent */
      }
    },
    [setMessages],
  );

  // ── Manual: Analyze position ─────────────────────────────────────────
  const handleEngineAnalyze = useCallback(async () => {
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "🔍 Analyze position", type: "engine-query" },
    ]);
    setIsLoading(true);
    try {
      const sf = getStockfishEngine();
      const fen = gameRef.current.fen();
      const result = await sf.analyze(fen, 18, 3);
      applyEvalScore(result, fen);
      const content = buildAnalysisMessage(result, fen);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content, type: "engine" },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Engine error: ${error.message}`,
          type: "engine",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [gameRef, applyEvalScore, setMessages, setIsLoading]);

  // ── Manual: Best Move ────────────────────────────────────────────────
  const handleEngineBestMove = useCallback(async () => {
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "💡 Best Move", type: "engine-query" },
    ]);
    setIsLoading(true);
    try {
      const sf = getStockfishEngine();
      const fen = gameRef.current.fen();
      const result = await sf.analyze(fen, 15, 1);
      applyEvalScore(result, fen);
      const seed = messageSeedReference.current++;
      const card = buildBestMoveCard(result, fen, seed);
      if (card) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: card, type: "best-move-card" },
        ]);
        // Draw arrows for best move (green = primary, blue = response)
        const arrows = [];
        if (result.pv?.[0]?.length >= 4) {
          arrows.push({
            startSquare: result.pv[0].slice(0, 2),
            endSquare: result.pv[0].slice(2, 4),
            color: "#22c55e",
          });
        }
        if (result.pv?.[1]?.length >= 4) {
          arrows.push({
            startSquare: result.pv[1].slice(0, 2),
            endSquare: result.pv[1].slice(2, 4),
            color: "#3b82f6",
          });
        }
        setBestMoveArrows(arrows);
      } else {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: "No legal moves in this position.",
            type: "engine",
          },
        ]);
      }
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Engine error: ${error.message}`,
          type: "engine",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [gameRef, applyEvalScore, setBestMoveArrows, setMessages, setIsLoading]);

  // ── Manual: Hint ─────────────────────────────────────────────────────
  const handleEngineHint = useCallback(async () => {
    setMessages((previous) => [
      ...previous,
      { role: "user", content: "🎯 Hint", type: "engine-query" },
    ]);
    setIsLoading(true);
    try {
      const sf = getStockfishEngine();
      const fen = gameRef.current.fen();
      const result = await sf.analyze(fen, 12, 1);
      const seed = messageSeedReference.current++;
      const card = buildHintCard(result, fen, seed);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: card, type: "hint-card" },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Engine error: ${error.message}`,
          type: "engine",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [gameRef, setMessages, setIsLoading]);

  // ── Post-game: Full analysis ───────────────────────────────────────────
  const triggerPostGameAnalysis = useCallback(
    async (history) => {
      if (isAnalyzingReference.current || (history?.length ?? 0) < 4) return;
      isAnalyzingReference.current = true;
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setGameReport(null);
      try {
        const report = await analyzeFullGame(history, 10, (done, total) =>
          setAnalysisProgress(Math.round((done / total) * 100)),
        );
        if (report) {
          setGameReport(report);
          setGameReportOpen(true);
        }
      } catch (error) {
        console.error("Post-game analysis failed:", error);
      } finally {
        setIsAnalyzing(false);
        isAnalyzingReference.current = false;
      }
    },
    [setIsAnalyzing, setAnalysisProgress, setGameReport, setGameReportOpen],
  );

  // ── Live: engine analysis after move (used in live mode) ─────────────
  const engineLiveAnalyze = useCallback(
    (fen, lastMoveSan) => {
      const sf = getStockfishEngine();
      sf.analyze(fen, 12, 1)
        // eslint-disable-next-line promise/always-return
        .then((result) => {
          applyEvalScore(result, fen);
          const content = buildLiveAnalysisMessage(result, fen, lastMoveSan);
          setMessages((previous) => [
            ...previous,
            { role: "assistant", content, type: "engine" },
          ]);
        })
        .catch(() => {
          /* silent */
        });
    },
    [applyEvalScore, setMessages],
  );

  // ── Think Like a GM ─────────────────────────────────────────────────────
  const handleThinkLikeGM = useCallback(
    async (moveHistorySan = []) => {
      setMessages((previous) => [
        ...previous,
        {
          role: "user",
          content: "Think like a GM",
        },
      ]);
      setIsLoading(true);
      try {
        const sf = getStockfishEngine();
        const fen = gameRef.current.fen();

        // Deep MultiPV analysis — 3 lines at depth 18
        const result = await sf.analyze(fen, 18, 3);
        applyEvalScore(result, fen);

        // Enrich each line with SAN moves for the AI prompt
        const enrichedLines = result.lines.map((l) => ({
          ...l,
          sanMoves: pvToSan(fen, l.pv),
        }));

        const apiKey = localStorage.getItem("chess-coach-api-key") || "";
        const model =
          localStorage.getItem("chess-coach-model") || "gpt-4o-mini";
        const elo = Number.parseInt(
          localStorage.getItem("chess-coach-elo") || "1000",
          10,
        );

        let content = buildGMMarkdownFromEngine(fen, moveHistorySan, result);

        if (apiKey) {
          try {
            const gmData = await getGMThoughtProcess({
              fen,
              stockfishLines: enrichedLines,
              moveHistorySan,
              elo,
              apiKey,
              model,
            });

            content = buildGMMarkdownFromAI(gmData, fen);
          } catch {
            // Fall back to engine-authored markdown if the AI formatter fails.
          }
        }

        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content,
          },
        ]);
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: `# Think Like a GM\n\nUnable to calculate the GM plan right now: ${error.message}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [gameRef, applyEvalScore, setMessages, setIsLoading],
  );

  return {
    applyEvalScore,
    updateEvalBar,
    engineLiveAnalyze,
    engineLiveAnalyzePlayerMove,
    runThreatDetection,
    handleEngineAnalyze,
    handleEngineBestMove,
    handleEngineHint,
    handleThinkLikeGM,
    triggerPostGameAnalysis,
    isAnalyzingRef: isAnalyzingReference,
  };
};

export default useEngineCoach;
