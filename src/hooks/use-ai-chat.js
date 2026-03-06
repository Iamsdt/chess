import { useCallback, useEffect, useState } from "react";

import { sendChatMessage, evaluateMove, summarizeConversation } from "@/lib/ai";
import {
  sendGoogleChatMessage,
  summarizeGoogleConversation,
} from "@/lib/google-ai";

const NON_CHAT_MESSAGE_TYPES = new Set([
  "engine",
  "engine-query",
  "my-move-analysis",
  "threat-card",
  "best-move-card",
  "hint-card",
  "gm-thought",
]);

const SUMMARY_REQUEST_PATTERN =
  /\b(summary|summarize|summarise|recap|recapitulate|what have we discussed|catch me up)\b/i;
const DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS = 6000;
const MAX_RECENT_MESSAGES = 8;
const MIN_RECENT_MESSAGES = 4;
const MAX_SUMMARY_CHARACTERS = 1600;

const getConversationHistory = (messages) =>
  messages
    .filter(
      (message) =>
        typeof message?.content === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        !NON_CHAT_MESSAGE_TYPES.has(message.type),
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

const estimateTextTokens = (text) =>
  Math.ceil(String(text || "").trim().length / 4);

const estimateConversationTokens = (messages) =>
  messages.reduce((total, message) => {
    if (typeof message?.content !== "string") return total;
    return total + estimateTextTokens(message.content) + 8;
  }, 0);

const trimText = (text, maxLength = 220) => {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const trimSummary = (summary) => {
  const normalized = String(summary || "").trim();
  if (normalized.length <= MAX_SUMMARY_CHARACTERS) return normalized;
  return `${normalized.slice(0, MAX_SUMMARY_CHARACTERS).trimEnd()}…`;
};

const fallbackSummaryFromMessages = (existingSummary, messages) => {
  const goals = [];
  const ideas = [];
  const questions = [];

  if (existingSummary) {
    ideas.push(trimText(existingSummary, 260));
  }

  for (const message of messages) {
    if (typeof message?.content !== "string") continue;
    const line = trimText(message.content, 180);
    if (!line) continue;

    if (message.role === "user") {
      if (line.includes("?")) questions.push(line);
      else goals.push(line);
    } else {
      ideas.push(line);
    }
  }

  const pick = (items, limit) => [...new Set(items)].slice(-limit);
  const sections = [
    "## Goals",
    ...(pick(goals, 3).length > 0
      ? pick(goals, 3).map((item) => `- ${item}`)
      : ["- Continue helping with the current chess position."]),
    "",
    "## Key Ideas",
    ...(pick(ideas, 4).length > 0
      ? pick(ideas, 4).map((item) => `- ${item}`)
      : ["- No durable ideas captured yet."]),
    "",
    "## Open Questions",
    ...(pick(questions, 3).length > 0
      ? pick(questions, 3).map((item) => `- ${item}`)
      : ["- None."]),
  ];

  return trimSummary(sections.join("\n"));
};

const createTokenStats = () => ({
  activeTokens: 0,
  totalTokens: null,
  targetTokens: DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS,
  isApproximate: true,
  summaryEnabled: false,
});

const buildPositionAwarePrompt = (
  game,
  userMessage,
  { conversationSummary = "", isSummaryRequest = false } = {},
) => {
  const moveHistorySan = game.history();
  const sideToMove = game.turn() === "w" ? "White" : "Black";
  const lastMove = moveHistorySan.at(-1) || "None";
  const status = [];

  if (game.isCheckmate()) {
    status.push("The position is checkmate.");
  } else if (game.isDraw()) {
    status.push("The position is a draw.");
  } else if (game.inCheck()) {
    status.push(`${sideToMove} is in check.`);
  }

  status.push(`${sideToMove} to move.`);

  const promptSections = [];

  if (conversationSummary) {
    promptSections.push(
      "Conversation summary from earlier turns:",
      conversationSummary,
      "If the summary conflicts with the live board state below, trust the live board state.",
      "",
    );
  }

  if (isSummaryRequest) {
    promptSections.push(
      "The user is asking for a recap or summary.",
      "Use the saved conversation summary plus the recent turns to answer directly and concisely.",
      "",
    );
  }

  promptSections.push(
    "Live chess position:",
    `FEN: ${game.fen()}`,
    `Moves so far: ${moveHistorySan.length > 0 ? moveHistorySan.join(" ") : "No moves yet"}`,
    `Last move: ${lastMove}`,
    `Board status: ${status.join(" ")}`,
    "",
    "User request:",
    userMessage,
    "",
    "Use the live chess position above as the source of truth for your answer.",
  );

  return promptSections.join("\n");
};

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
  const [conversationSummary, setConversationSummary] = useState("");
  const [tokenStats, setTokenStats] = useState(createTokenStats);

  useEffect(() => {
    if (messages.length === 0) {
      setConversationSummary("");
      setTokenStats(createTokenStats());
    }
  }, [messages.length]);

  const summarizeForContext = useCallback(
    async (provider, apiKey, model, slice) => {
      if (slice.length === 0) return conversationSummary;

      try {
        const summary =
          provider === "google"
            ? await summarizeGoogleConversation({
              messages: slice,
              existingSummary: conversationSummary,
              apiKey,
              model,
            })
            : await summarizeConversation({
              messages: slice,
              existingSummary: conversationSummary,
              apiKey,
              model,
            });

        return trimSummary(summary);
      } catch {
        return fallbackSummaryFromMessages(conversationSummary, slice);
      }
    },
    [conversationSummary],
  );

  const compactConversation = useCallback(
    async ({ provider, apiKey, model, rawUserMessage }) => {
      const history = getConversationHistory(messages);
      const isSummaryRequest = SUMMARY_REQUEST_PATTERN.test(rawUserMessage);

      let nextSummary = conversationSummary;
      let recentHistory = [...history];

      const buildPromptWithSummary = (summaryText) =>
        buildPositionAwarePrompt(gameRef.current, rawUserMessage, {
          conversationSummary: summaryText,
          isSummaryRequest,
        });

      let prompt = buildPromptWithSummary(nextSummary);
      let estimatedTokens =
        estimateConversationTokens(recentHistory) + estimateTextTokens(prompt);

      const shouldCompact =
        recentHistory.length > MAX_RECENT_MESSAGES ||
        estimatedTokens > DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS;

      if (shouldCompact && recentHistory.length > MIN_RECENT_MESSAGES) {
        const olderSlice = recentHistory.slice(0, -MAX_RECENT_MESSAGES);
        recentHistory = recentHistory.slice(-MAX_RECENT_MESSAGES);

        if (olderSlice.length > 0) {
          nextSummary = await summarizeForContext(
            provider,
            apiKey,
            model,
            olderSlice,
          );
          setConversationSummary(nextSummary);
          prompt = buildPromptWithSummary(nextSummary);
          estimatedTokens =
            estimateConversationTokens(recentHistory) +
            estimateTextTokens(prompt);
        }
      }

      while (
        estimatedTokens > DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS &&
        recentHistory.length > MIN_RECENT_MESSAGES
      ) {
        recentHistory = recentHistory.slice(1);
        prompt = buildPromptWithSummary(nextSummary);
        estimatedTokens =
          estimateConversationTokens(recentHistory) +
          estimateTextTokens(prompt);
      }

      if (
        estimatedTokens > DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS &&
        nextSummary.length > 900
      ) {
        nextSummary = trimSummary(
          nextSummary.slice(0, Math.floor(nextSummary.length * 0.75)),
        );
        setConversationSummary(nextSummary);
        prompt = buildPromptWithSummary(nextSummary);
        estimatedTokens =
          estimateConversationTokens(recentHistory) +
          estimateTextTokens(prompt);
      }

      return {
        recentHistory,
        prompt,
        estimatedTokens,
        summaryEnabled: Boolean(nextSummary),
      };
    },
    [conversationSummary, gameRef, messages, summarizeForContext],
  );

  // ── Google Gemini path (agentic, with board actions) ────────────────────
  const handleGoogleMessage = useCallback(
    async (userMessageContent, promptOverride) => {
      const apiKey = getGoogleApiKey();
      const elo = getElo();
      const rawUserMessage = promptOverride || userMessageContent;

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
        const { recentHistory, prompt, estimatedTokens, summaryEnabled } =
          await compactConversation({
            provider: "google",
            apiKey,
            model: getGoogleModel(),
            rawUserMessage,
          });
        const allMessages = [
          ...recentHistory,
          { role: "user", content: prompt },
        ];

        const pendingActionMessages = [];

        const { text, actions, usageMetadata } = await sendGoogleChatMessage({
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

        setTokenStats({
          activeTokens: usageMetadata?.promptTokenCount || estimatedTokens,
          totalTokens: usageMetadata?.totalTokenCount || null,
          targetTokens: DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS,
          isApproximate: !usageMetadata?.promptTokenCount,
          summaryEnabled,
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
    [boardActions, compactConversation, gameRef, setMessages, setIsLoading],
  );

  // ── OpenAI path (text only) ───────────────────────────────────────────────
  const handleOpenAIMessage = useCallback(
    async (userMessageContent, promptOverride) => {
      const apiKey = getApiKey();
      const rawUserMessage = promptOverride || userMessageContent;

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
        const { recentHistory, prompt, estimatedTokens, summaryEnabled } =
          await compactConversation({
            provider: "openai",
            apiKey,
            model: getModel(),
            rawUserMessage,
          });
        const allMessages = [
          ...recentHistory,
          { role: "user", content: prompt },
        ];

        const reply = await sendChatMessage({
          messages: allMessages,
          fen: gameRef.current.fen(),
          apiKey,
          model: getModel(),
        });

        setTokenStats({
          activeTokens: estimatedTokens,
          totalTokens: estimatedTokens + estimateTextTokens(reply),
          targetTokens: DEFAULT_ACTIVE_CONTEXT_TARGET_TOKENS,
          isApproximate: true,
          summaryEnabled,
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
    [compactConversation, gameRef, setMessages, setIsLoading],
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
    tokenStats,
  };
};

export default useAiChat;
