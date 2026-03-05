const SYSTEM_PROMPT = `You are an expert chess coach. You help users understand chess positions, moves, and strategies. Keep responses concise but insightful. When analyzing positions, mention:
- Key tactical ideas
- Strategic themes  
- Piece activity
- Pawn structure when relevant

Always be encouraging and educational. Format your responses clearly.`;

/**
 * Send a chat message to OpenAI and return the assistant's response text.
 */
export const sendChatMessage = async ({
  messages,
  fen,
  apiKey,
  model = "gpt-4o-mini",
}) => {
  if (!apiKey) {
    throw new Error("Please set your API key in Settings first.");
  }

  const systemMessage = {
    role: "system",
    content: `${SYSTEM_PROMPT}\n\nCurrent board position (FEN): ${fen}`,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No response received.";
};

/**
 * Request a position explanation from the AI.
 */
export const explainPosition = async ({ fen, moveHistory, apiKey, model }) => {
  const moveString =
    moveHistory.length > 0 ? moveHistory.join(" ") : "No moves yet";
  return sendChatMessage({
    messages: [
      {
        role: "user",
        content: `Explain the current position. Moves so far: ${moveString}. What are the key ideas for both sides?`,
      },
    ],
    fen,
    apiKey,
    model,
  });
};

/**
 * Request a hint from the AI.
 */
export const getHint = async ({ fen, apiKey, model, hintLevel = 1 }) => {
  const levels = {
    1: "Give me a general hint about what I should focus on in this position. Don't reveal the exact move.",
    2: "Give me a specific directional hint. Which piece should I consider moving and roughly where?",
    3: "What is the best move in this position and why?",
  };

  return sendChatMessage({
    messages: [
      {
        role: "user",
        content: levels[hintLevel] || levels[1],
      },
    ],
    fen,
    apiKey,
    model,
  });
};

/**
 * Evaluate the quality of the last move.
 */
export const evaluateMove = async ({ fen, lastMove, apiKey, model }) =>
  sendChatMessage({
    messages: [
      {
        role: "user",
        content: `Rate the last move "${lastMove}" as one of: Excellent, Good, Inaccuracy, Mistake, or Blunder. Respond with ONLY the rating word on the first line, then a brief explanation on the next line.`,
      },
    ],
    fen,
    apiKey,
    model,
  });

/**
 * Think Like a GM: given a FEN and Stockfish's top 3 lines, ask GPT to
 * simulate a Grandmaster thought process in 4 structured steps.
 * @param {{ fen: string, stockfishLines: Array, moveHistorySan: string[], elo: number, apiKey: string, model: string }} options
 * @returns {Promise<{ positionLabel, step1, step2, step3, step4, bestMove, bestMoveReason }>}
 */
export const getGMThoughtProcess = async ({
  fen,
  stockfishLines,
  moveHistorySan = [],
  elo = 1000,
  apiKey,
  model = "gpt-4o-mini",
}) => {
  if (!apiKey) {
    throw new Error("Please set your OpenAI API key in Settings first.");
  }

  // Format Stockfish lines for the prompt
  const linesText = stockfishLines
    .map((l, index) => {
      const evalString = l.isMate
        ? `M${Math.abs(l.mateIn)}`
        : l.scoreCp !== null
          ? l.scoreCp >= 0
            ? `+${(l.scoreCp / 100).toFixed(2)}`
            : (l.scoreCp / 100).toFixed(2)
          : "?";
      const movesText = l.sanMoves?.slice(0, 5).join(" ") || "";
      return `${index + 1}. ${movesText}  [eval: ${evalString}]`;
    })
    .join("\n");

  const moveCount = Math.ceil(moveHistorySan.length / 2);
  const lastMoveSan = moveHistorySan.at(-1) || "";
  const positionContext =
    moveCount > 0
      ? `Position after move ${moveCount}${lastMoveSan ? ` (${lastMoveSan})` : ""}`
      : "Opening position";

  const prompt = `You are a Grandmaster chess coach. A student (~${elo} ELO) wants to understand how a GM thinks about this position.

Position: ${positionContext}
FEN: ${fen}
Move history: ${moveHistorySan.length > 0 ? moveHistorySan.join(" ") : "No moves yet"}

Stockfish top 3 candidate moves (depth 18):
${linesText}

Walk through the GM thought process in 4 steps. Return ONLY valid JSON (no markdown, no extra text):
{
  "positionLabel": "brief label like 'Italian Game, move 8' or 'Middlegame after 12. Nf3'",
  "step1": {
    "title": "What's Happening?",
    "points": ["observation about material balance", "key tactical threats", "piece activity note"]
  },
  "step2": {
    "title": "Candidate Moves",
    "moves": [
      { "move": "SAN move", "idea": "concise idea + pros/cons", "verdict": "best" },
      { "move": "SAN move", "idea": "concise idea + pros/cons", "verdict": "good" },
      { "move": "SAN move", "idea": "concise idea + pros/cons", "verdict": "risky" }
    ]
  },
  "step3": {
    "title": "Calculation",
    "lines": [
      { "sequence": ["move1", "move2", "move3"], "eval": "+0.8 White", "verdict": "Best line" },
      { "sequence": ["move1", "move2", "move3"], "eval": "+0.3 White", "verdict": "Playable" }
    ]
  },
  "step4": {
    "title": "The Plan",
    "immediate": ["immediate goal 1", "immediate goal 2"],
    "longTerm": ["long-term strategic idea"]
  },
  "bestMove": "SAN of best move",
  "bestMoveReason": "one sentence: why this move is best"
}

Rules:
- Use simple language for a ${elo} ELO student (max 2 short sentences per point)
- step2.moves must use the exact moves from Stockfish lines above
- step3.lines must show actual move sequences from the Stockfish analysis
- bestMove must be the first move of Stockfish line 1
- Return ONLY raw JSON, nothing else`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a Grandmaster chess coach. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("No response from AI.");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }
};
