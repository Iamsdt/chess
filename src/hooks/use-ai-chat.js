import { useCallback } from "react";

import { sendChatMessage, evaluateMove } from "@/lib/ai";
import { sendGoogleChatMessage } from "@/lib/google-ai";

// ── localStorage helpers ──────────────────────────────────────────────────────
export const getProvider = () =>
  localStorage.getItem("chess-ai-provider") || "google";

export const getApiKey = () =>
  localStorage.getItem("chess-coach-api-key") || "";

export const getGoogleApiKey = () =>
  localStorage.getItem("chess-google-api-key") || "";

export const getGoogleModel = () =>
  localStorage.getItem("chess-google-model") || "gemini-2.5-flash";

export const getModel = () =>
  localStorage.getItem("chess-coach-model") || "gpt-4o-mini";

export const getElo = () =>
  Number.parseInt(localStorage.getItem("chess-coach-elo") || "1000", 10);

// ── Format board action as a chat message ────────────────────────────────────
const actionToMessage = (action) => {
  if (action.type === "SET_POSITION") {
    return `\u{1F4CD} *Position set* — ${action.explanation}`;
  }
  if (action.type === "MAKE_MOVE") {
    return `\u{265F} *${action.san}* — ${action.explanation}`;
  }
  if (action.type === "FLIP_BOARD") {
    return `\u{21C4} *Board flipped* to ${action.orientation} perspective.`;
  }
  return "";
};

/**
 * Handles all AI chat interactions:
 * - user chat messages (Google Gemini or OpenAI)
 * - evaluating last move quality
 * - asking AI about threats
 * - deep learning mode
 *
 * `boardActions` is an object with callbacks the AI can trigger:
 * { setPosition(fen), makeMove(san), flipBoard(orientation) }
 */
const useAiChat = ({
  gameRef,
  messages,
  setMessages,
  setIsLoading,
  setMoveQuality,
  setCoachMode,
  boardActions,
}) => {
  // ── Google Gemini path (agentic, with board actions) ────────────────────
  const handleGoogleMessage = useCallback(
    async (userMessageContent, promptOverride) => {
      const apiKey = getGoogleApiKey();
      const elo = getElo();

      if (!apiKey) {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "Please set your Google API key in Settings (gear icon) to start chatting.",
          },
        ]);
        return;
      }

      setIsLoading(true);

      try {
        const allMessages = [
          ...messages,
          { role: "user", content: promptOverride || userMessageContent },
        ].map((m) => ({ role: m.role, content: m.content }));

        const pendingActionMessages = [];

        const { text, actions } = await sendGoogleChatMessage({
          messages: allMessages,
          fen: gameRef.current.fen(),
          elo,
          apiKey,
          model: getGoogleModel(),
          onAction: (action) => {
            // Execute board action immediately
            if (action.type === "SET_POSITION" && boardActions?.setPosition) {
              boardActions.setPosition(action.fen);
            } else if (action.type === "MAKE_MOVE" && boardActions?.makeMove) {
              boardActions.makeMove(action.san);
            } else if (
              action.type === "FLIP_BOARD" &&
              boardActions?.flipBoard
            ) {
              boardActions.flipBoard(action.orientation);
            }
            pendingActionMessages.push({
              role: "assistant",
              content: actionToMessage(action),
              isAction: true,
            });
          },
        });

        // Append action notifications + final text in one update
        setMessages((previous) => [
          ...previous,
          ...pendingActionMessages,
          ...(text ? [{ role: "assistant", content: text }] : []),
        ]);

        // Log for debugging during development
        if (actions.length > 0) {
          console.warn("[Gemini] Board actions taken:", actions);
        }
      } catch (error) {
        setMessages((previous) => [
          ...previous,
          { role: "assistant", content: `Error: ${error.message}` },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [gameRef, messages, setMessages, setIsLoading, boardActions],
  );

  // ── OpenAI path (text only) ───────────────────────────────────────────────
  const handleOpenAIMessage = useCallback(
    async (userMessageContent, promptOverride) => {
      const apiKey = getApiKey();

      if (!apiKey) {
        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "Please set your OpenAI API key in Settings (gear icon) to start chatting.",
          },
        ]);
        return;
      }

      setIsLoading(true);

      try {
        const allMessages = [
          ...messages,
          { role: "user", content: promptOverride || userMessageContent },
        ].map((m) => ({ role: m.role, content: m.content }));

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

  // ── Public: send a user chat message ────────────────────────────────────
  const handleSendMessage = useCallback(
    async (text) => {
      const userMessage = { role: "user", content: text };
      setMessages((previous) => [...previous, userMessage]);

      if (getProvider() === "google") {
        await handleGoogleMessage(text);
      } else {
        await handleOpenAIMessage(text);
      }
    },
    [setMessages, handleGoogleMessage, handleOpenAIMessage],
  );

  // ── Evaluate last move quality (live mode, OpenAI only) ──────────────────
  const evaluateLastMove = useCallback(
    async (lastMove, currentFen) => {
      // Only run with OpenAI for now (fast, cheap)
      const apiKey = getApiKey();
      if (!apiKey) return;
      try {
        const result = await evaluateMove({
          fen: currentFen,
          lastMove,
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
        if (matched) setMoveQuality(matched);
      } catch {
        // silently ignore evaluation errors
      }
    },
    [setMoveQuality],
  );

  // ── Ask AI to explain a tactical threat ─────────────────────────────────
  const handleAskAI = useCallback(
    async (threatCard) => {
      const threatName = threatCard?.primaryThreat?.name || "this threat";
      const moveSan = threatCard?.opponentMoveSan || "the last move";

      setCoachMode("ai");
      const userMessage = {
        role: "user",
        content: `Explain: ${threatName} after ${moveSan}`,
      };
      setMessages((previous) => [...previous, userMessage]);

      const prompt = `My opponent just played ${moveSan}, creating a ${threatName}. Position (FEN): ${gameRef.current.fen()}. Briefly explain this threat and my best defensive options.`;

      if (getProvider() === "google") {
        await handleGoogleMessage(
          `Explain: ${threatName} after ${moveSan}`,
          prompt,
        );
      } else {
        await handleOpenAIMessage(
          `Explain: ${threatName} after ${moveSan}`,
          prompt,
        );
      }
    },
    [
      gameRef,
      setMessages,
      setCoachMode,
      handleGoogleMessage,
      handleOpenAIMessage,
    ],
  );

  // ── Deep learning mode ───────────────────────────────────────────────────
  const handleLearnWithAI = useCallback(
    async (card) => {
      const userElo = getElo();
      const pattern = card.knownPattern;
      const moveSan = card.opponentMoveSan;
      const currentFen = gameRef.current.fen();

      setCoachMode("ai");

      let prompt = "";
      let userLabel = "";

      if (pattern?.type === "opening") {
        userLabel = `\u{1F4DA} Learn: ${pattern.name}`;
        prompt =
          `I'm learning chess (rated ~${userElo}). My opponent just played ${moveSan}, ` +
          `a theoretical move in the ${pattern.name} (ECO ${pattern.eco}). ` +
          `Position FEN: ${currentFen}. ` +
          `Teach me: 1) What is the ${pattern.name} and why is it popular? ` +
          `2) Key ideas for both sides? 3) How should I respond? ` +
          `4) One important trap or pattern to remember.`;
      } else if (pattern?.type === "tactical") {
        userLabel = `\u{1F4DA} Learn: ${pattern.name}`;
        prompt =
          `I'm learning chess (rated ~${userElo}). My opponent played ${moveSan} creating a ${pattern.name}. ` +
          `Position FEN: ${currentFen}. ` +
          `Teach me: 1) What is a ${pattern.name}? 2) What's being attacked here and why is it hard to defend? ` +
          `3) My best options right now? 4) How to spot this pattern in future games?`;
      } else {
        userLabel = `\u{1F4DA} Learn: ${moveSan}`;
        prompt =
          `I'm learning chess (rated ~${userElo}). My opponent played ${moveSan}. ` +
          `Position FEN: ${currentFen}. Explain what happened and what I should focus on next.`;
      }

      setMessages((previous) => [
        ...previous,
        { role: "user", content: userLabel },
      ]);

      if (getProvider() === "google") {
        await handleGoogleMessage(userLabel, prompt);
      } else {
        await handleOpenAIMessage(userLabel, prompt);
      }
    },
    [
      gameRef,
      setMessages,
      setCoachMode,
      handleGoogleMessage,
      handleOpenAIMessage,
    ],
  );

  return {
    handleSendMessage,
    evaluateLastMove,
    handleAskAI,
    handleLearnWithAI,
  };
};

export default useAiChat;
