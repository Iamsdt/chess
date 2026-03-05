import { GoogleGenAI } from "@google/genai";

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
  messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

/**
 * Send a message to Google Gemini with chess board action tool support.
 *
 * The model can call board action tools mid-conversation.
 * `onAction` is called immediately for each action so the board updates live.
 * @returns {{ text: string, actions: Array }}
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

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `${GM_SYSTEM_PROMPT}\n\nCurrent board position (FEN): ${fen}\nStudent ELO: ~${elo}`;

  const config = {
    tools: [{ functionDeclarations: CHESS_TOOLS }],
  };

  let contents = toGoogleContents(messages);
  const actions = [];

  // ── Agentic loop: run until no more function calls ────────────────────────
  let response = await ai.models.generateContent({
    model,
    systemInstruction,
    contents,
    config,
  });

  while (response.functionCalls && response.functionCalls.length > 0) {
    const functionResponses = [];

    for (const call of response.functionCalls) {
      const { name, args } = call;
      let actionResult = "Action executed.";

      if (name === "set_board_position") {
        const action = {
          type: "SET_POSITION",
          fen: args.fen,
          explanation: args.explanation,
        };
        actions.push(action);
        onAction?.(action);
        actionResult = `Position loaded: ${args.fen}`;
      } else if (name === "make_move") {
        const action = {
          type: "MAKE_MOVE",
          san: args.san,
          explanation: args.explanation,
        };
        actions.push(action);
        onAction?.(action);
        actionResult = `Move ${args.san} played on the board.`;
      } else if (name === "flip_board") {
        const action = {
          type: "FLIP_BOARD",
          orientation: args.orientation,
        };
        actions.push(action);
        onAction?.(action);
        actionResult = `Board flipped to ${args.orientation} view.`;
      }

      functionResponses.push({ name, response: { result: actionResult } });
    }

    // Extend contents: model's tool calls + our results
    contents = [
      ...contents,
      {
        role: "model",
        parts: response.functionCalls.map((fc) => ({ functionCall: fc })),
      },
      {
        role: "user",
        parts: functionResponses.map((fr) => ({ functionResponse: fr })),
      },
    ];

    response = await ai.models.generateContent({
      model,
      systemInstruction,
      contents,
      config,
    });
  }

  return { text: response.text || "", actions };
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
