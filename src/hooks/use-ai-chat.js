import { useCallback } from "react";

import {
  sendChatMessage,
  evaluateMove,
} from "@/lib/ai";

// ── Keys from localStorage ────────────────────────────────────────────────────
export const getApiKey = () => localStorage.getItem("chess-coach-api-key") || "";
export const getModel = () =>
  localStorage.getItem("chess-coach-model") || "gpt-4o-mini";
export const getElo = () =>
  Number.parseInt(localStorage.getItem("chess-coach-elo") || "1000", 10);

/**
 * Handles all AI chat interactions:
 * - user chat messages
 * - evaluating last move quality
 * - asking AI about threats
 * - deep learning mode
 */
const useAiChat = ({
  gameRef,
  messages,
  setMessages,
  setIsLoading,
  setMoveQuality,
  setCoachMode,
}) => {
  // ── Send a user chat message to AI ────────────────────────────────────
  const handleSendMessage = useCallback(
    async (text) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        setMessages((previous) => [
          ...previous,
          { role: "user", content: text },
          {
            role: "assistant",
            content:
              "Please set your API key in Settings (gear icon) to start chatting.",
          },
        ]);
        return;
      }

      const userMessage = { role: "user", content: text };
      setMessages((previous) => [...previous, userMessage]);
      setIsLoading(true);

      try {
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const reply = await sendChatMessage({
          messages: allMessages,
          fen: gameRef.current.fen(),
          apiKey,
          model: getModel(),
        });

        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: reply },
        ]);
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [gameRef, messages, setMessages, setIsLoading],
  );

  // ── Evaluate last move quality (live mode) ────────────────────────────
  const evaluateLastMove = useCallback(
    async (lastMove, currentFen, history) => {
      const apiKey = getApiKey();
      if (!apiKey) return;
      try {
        const result = await evaluateMove({
          fen: currentFen,
          lastMove,
          moveHistory: history,
          apiKey,
          model: getModel(),
        });
        const firstLine = result.split("\n")[0].trim();
        const quality = firstLine.replace(/[^A-Za-z]/g, "");
        const validQualities = [
          "Excellent",
          "Good",
          "Inaccuracy",
          "Mistake",
          "Blunder",
        ];
        const matched = validQualities.find(
          (q) => q.toLowerCase() === quality.toLowerCase(),
        );
        if (matched) {
          setMoveQuality(matched);
        }
      } catch {
        // silently ignore evaluation errors
      }
    },
    [setMoveQuality],
  );

  // ── Ask AI to explain a tactical threat ──────────────────────────────
  const handleAskAI = useCallback(
    async (threatCard) => {
      const apiKey = getApiKey();
      const threatName = threatCard?.primaryThreat?.name || "this threat";
      const moveSan = threatCard?.opponentMoveSan || "the last move";

      if (!apiKey) {
        setCoachMode("ai");
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "Please set your API key in Settings (gear icon) to use AI coaching.",
          },
        ]);
        return;
      }

      setCoachMode("ai");
      const prompt = `My opponent just played ${moveSan}, creating a ${threatName}. The current position (FEN): ${gameRef.current.fen()}. Please briefly explain what this threat is and what my best defensive options are.`;
      const userMessage = {
        role: "user",
        content: `Explain: ${threatName} after ${moveSan}`,
      };
      setMessages((previous) => [...previous, userMessage]);
      setIsLoading(true);
      try {
        const reply = await sendChatMessage({
          messages: [{ role: "user", content: prompt }],
          fen: gameRef.current.fen(),
          apiKey,
          model: getModel(),
        });
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: reply },
        ]);
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [gameRef, setMessages, setIsLoading, setCoachMode],
  );

  // ── Deep learning mode ────────────────────────────────────────────────
  const handleLearnWithAI = useCallback(
    async (card) => {
      const apiKey = getApiKey();
      const userElo = getElo();
      const pattern = card.knownPattern;
      const moveSan = card.opponentMoveSan;
      const currentFen = gameRef.current.fen();

      if (!apiKey) {
        setCoachMode("ai");
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "Please set your API key in Settings (gear icon) to use AI coaching.",
          },
        ]);
        return;
      }

      setCoachMode("ai");

      let prompt = "";
      let userLabel = "";

      if (pattern?.type === "opening") {
        userLabel = `📚 Learn: ${pattern.name}`;
        prompt =
          `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan}, a theoretical move ` +
          `in the ${pattern.name} (ECO ${pattern.eco}). ` +
          `Current position FEN: ${currentFen}. ` +
          `Please teach me (concisely, 3-4 paragraphs):\n` +
          `1. What is the ${pattern.name} and why is it so popular?\n` +
          `2. What are the key ideas and plans for both sides?\n` +
          `3. How should I respond as the defending player?\n` +
          `4. One important pattern or trap to remember from this opening.`;
      } else if (pattern?.type === "tactical") {
        userLabel = `📚 Learn: ${pattern.name}`;
        prompt =
          `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan} creating a ${pattern.name}. ` +
          `Current position FEN: ${currentFen}. ` +
          `Please teach me (concisely, 3-4 paragraphs):\n` +
          `1. What exactly is a ${pattern.name} and why is it powerful?\n` +
          `2. In this specific position, what is being attacked and why is it hard to defend?\n` +
          `3. What are my best defensive options right now?\n` +
          `4. How can I learn to spot and avoid this pattern in future games?`;
      } else {
        userLabel = `📚 Learn: ${moveSan}`;
        prompt =
          `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan}. ` +
          `Position FEN: ${currentFen}. ` +
          `Please explain what's happening, what this move accomplishes, and what I should focus on next.`;
      }

      const userMessage = { role: "user", content: userLabel };
      setMessages((previous) => [...previous, userMessage]);
      setIsLoading(true);
      try {
        const reply = await sendChatMessage({
          messages: [{ role: "user", content: prompt }],
          fen: currentFen,
          apiKey,
          model: getModel(),
        });
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: reply },
        ]);
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [gameRef, setMessages, setIsLoading, setCoachMode],
  );

  return {
    handleSendMessage,
    evaluateLastMove,
    handleAskAI,
    handleLearnWithAI,
  };
};

export default useAiChat;
