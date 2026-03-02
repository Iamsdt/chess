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
