import { GoogleGenAI, createPartFromFunctionResponse } from "@google/genai";

// ── System prompt ────────────────────────────────────────────────────────────
const GM_SYSTEM_PROMPT = `You are an elite chess coach at Grandmaster level. You have direct control over the student's chess board and can take actions on it.

Board actions available to you:
- set_board_position: Load any FEN position to set up a teaching scenario or opening
- make_move: Play a move on the board to demonstrate ideas interactively
- flip_board: Change board perspective to white or black side

Teaching guidelines:
- "Think like a GM": Walk through candidate moves → tactical calculation → long-term plan → best move. Show your thinking process, not just the answer.
- Opening teaching: Use make_move to play through lines move by move, explaining the idea behind EACH move before playing it.
- Puzzle generation: Use set_board_position to load a tactical position, then challenge the student to find the winning move.
- Tailor depth and vocabulary to the student's ELO.
- Be concise — 1-3 sentences per idea. Go deep only when the student asks.`;

// ── Chess action tool declarations ───────────────────────────────────────────
const CHESS_TOOLS = [
  {
    name: "set_board_position",
    description:
      "Set the chess board to a specific position using FEN notation. Use this to demonstrate openings, show tactical positions, or set up puzzles and teaching scenarios.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        fen: {
          type: "string",
          description: "Valid FEN string representing the board position",
        },
        explanation: {
          type: "string",
          description:
            "Brief explanation of what position is being set and why",
        },
      },
      required: ["fen", "explanation"],
    },
  },
  {
    name: "make_move",
    description:
      "Play a chess move on the board in Standard Algebraic Notation. Use this to play through opening lines, demonstrate tactics, or show the best move in a position.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        san: {
          type: "string",
          description:
            'Move in Standard Algebraic Notation (e.g. "e4", "Nf3", "O-O", "Bxe5+")',
        },
        explanation: {
          type: "string",
          description: "The idea or purpose behind this move",
        },
      },
      required: ["san", "explanation"],
    },
  },
  {
    name: "flip_board",
    description:
      "Flip the chess board to show a different perspective (white or black side at the bottom)",
    parametersJsonSchema: {
      type: "object",
      properties: {
        orientation: {
          type: "string",
          enum: ["white", "black"],
          description: "Which side to show at the bottom of the board",
        },
      },
      required: ["orientation"],
    },
  },
];

// ── Convert OpenAI-format messages → Google AI format ────────────────────────
const toGoogleContents = (messages) =>
  messages
    .filter(
      (message) =>
        typeof message?.content === "string" &&
        (message.role === "assistant" || message.role === "user"),
    )
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

const getResponseContent = (response) => response.candidates?.[0]?.content;

const getFunctionCalls = (response) =>
  (response.functionCalls || []).filter((call) => call?.name);

const asString = (value, fallback = "") =>
  typeof value === "string" ? value : fallback;

const createGoogleClient = (apiKey) => new GoogleGenAI({ apiKey });

const formatSummarySourceMessages = (messages) =>
  messages
    .filter((message) => typeof message?.content === "string")
    .map((message) => {
      const role = message.role === "assistant" ? "Assistant" : "User";
      return `${role}: ${message.content.trim()}`;
    })
    .join("\n\n");

export const summarizeGoogleConversation = async ({
  messages,
  existingSummary = "",
  apiKey,
  model = "gemini-2.5-flash",
}) => {
  if (!apiKey) {
    throw new Error("Please set your Google API key in Settings.");
  }

  const ai = createGoogleClient(apiKey);
  const sourceMessages = formatSummarySourceMessages(messages);

  const response = await ai.models.generateContent({
    model,
    config: {
      maxOutputTokens: 220,
      temperature: 0.2,
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Compress this chess coaching conversation into a compact running summary.",
              "Preserve only stable context that matters for future turns:",
              "- user goals or questions",
              "- strategic themes and plans discussed",
              "- concrete move ideas or lines worth remembering",
              "- unresolved follow-up questions",
              "Do not preserve transient FEN details because live board state is sent separately every turn.",
              "Return markdown with these headings only:",
              "## Goals",
              "## Key Ideas",
              "## Open Questions",
              "Keep it short and dense.",
              "",
              "Existing summary:",
              existingSummary || "None",
              "",
              "New conversation slice:",
              sourceMessages || "None",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  return response.text?.trim() || existingSummary;
};

/**
 * Send a message to Google Gemini with chess board action tool support.
 *
 * The model can call board action tools mid-conversation.
 * `onAction` is called immediately for each action so the board updates live.
 * @returns {{ text: string, actions: Array, usageMetadata: object | null }} Generated reply text, emitted board actions, and Gemini usage metadata when available.
 */
export const sendGoogleChatMessage = async ({
  messages,
  fen,
  elo = 1000,
  apiKey,
  model = "gemini-2.5-flash",
  onAction,
}) => {
  if (!apiKey) throw new Error("Please set your Google API key in Settings.");

  const ai = createGoogleClient(apiKey);

  const systemInstruction = `${GM_SYSTEM_PROMPT}

Reason from the latest board context provided in every user turn. Treat that live position as the source of truth.
Only use board tools when changing the board will genuinely help the lesson.
If you use a board tool, briefly explain why before or after the action.

Current board position (FEN): ${fen}
Student ELO: ~${elo}`;

  const config = {
    tools: [{ functionDeclarations: CHESS_TOOLS }],
  };

  let contents = toGoogleContents(messages);
  const actions = [];
  let toolTurns = 0;

  // ── Agentic loop: run until no more function calls ────────────────────────
  let response = await ai.models.generateContent({
    model,
    systemInstruction,
    contents,
    config,
  });

  while (toolTurns < 8) {
    const functionCalls = getFunctionCalls(response);
    if (functionCalls.length === 0) break;

    const modelContent = getResponseContent(response);
    if (!modelContent) {
      throw new Error("Gemini returned tool calls without model content.");
    }

    const functionResponseParts = [];

    for (const [index, call] of functionCalls.entries()) {
      const { name, args: functionArguments = {}, id } = call;
      let actionResult = "Action executed.";

      if (name === "set_board_position") {
        const action = {
          type: "SET_POSITION",
          fen: asString(functionArguments.fen),
          explanation: asString(
            functionArguments.explanation,
            "Teaching position loaded.",
          ),
        };
        actions.push(action);
        onAction?.(action);
        actionResult = `Position loaded: ${action.fen}`;
      } else if (name === "make_move") {
        const action = {
          type: "MAKE_MOVE",
          san: asString(functionArguments.san),
          explanation: asString(
            functionArguments.explanation,
            "Demonstration move played.",
          ),
        };
        actions.push(action);
        onAction?.(action);
        actionResult = `Move ${action.san} played on the board.`;
      } else if (name === "flip_board") {
        const action = {
          type: "FLIP_BOARD",
          orientation: asString(functionArguments.orientation, "white"),
        };
        actions.push(action);
        onAction?.(action);
        actionResult = `Board flipped to ${action.orientation} view.`;
      } else {
        actionResult = `Unknown action requested: ${name}`;
      }

      functionResponseParts.push(
        createPartFromFunctionResponse(id || `${name}-${index + 1}`, name, {
          result: actionResult,
          ok: !actionResult.startsWith("Unknown"),
        }),
      );
    }

    // Extend contents with the full model turn to preserve SDK-managed parts.
    contents = [
      ...contents,
      modelContent,
      {
        role: "user",
        parts: functionResponseParts,
      },
    ];

    response = await ai.models.generateContent({
      model,
      systemInstruction,
      contents,
      config,
    });

    toolTurns += 1;
  }

  if (toolTurns === 8 && getFunctionCalls(response).length > 0) {
    throw new Error("Gemini exceeded the board-action limit for one reply.");
  }

  return {
    text: response.text || "",
    actions,
    usageMetadata: response.usageMetadata || null,
  };
};

// ── Available Gemini models ───────────────────────────────────────────────────
export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Most capable — deep reasoning & complex analysis",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description:
      "Best price/performance — fast with strong reasoning (recommended)",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description: "Fastest & cheapest — great for quick hints",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    description:
      "Preview of the upcoming Gemini 3.1 Pro model; highest reasoning capability",
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite Preview",
    description: "Preview of the ultra-fast, lightweight Gemini 3.1 Flash-Lite",
  },
  {
    id: "gemini-3-pro-preview",
    label: "Gemini 3 Pro Preview",
    description:
      "Early access to Gemini 3 Pro with improved general performance",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    description:
      "Preview of the Gemini 3 Flash model offering balance of speed and power",
  },
];
