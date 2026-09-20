import { withBaseUrl } from "./base-url.js";

const QUIZ_INDEX_PATH = withBaseUrl("quiz/index.json");

const normalizeUci = (move) =>
  String(move ?? "")
    .trim()
    .toLowerCase();

const normalizeFilePath = (file) => {
  if (typeof file !== "string" || file.trim().length === 0) {
    throw new Error("Quiz entry is missing a file path.");
  }

  return withBaseUrl(file.replace(/^\/+/, ""));
};

const readJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}.`);
  }

  return response.json();
};

const normalizeCatalogItem = (item) => ({
  id: String(item?.id ?? ""),
  kind: String(item?.kind ?? "quiz"),
  title: String(item?.title ?? "Untitled quiz"),
  theme: String(item?.theme ?? "checkmate"),
  difficulty: String(item?.difficulty ?? "easy"),
  description: String(item?.description ?? ""),
  moveCount: Number(item?.moveCount ?? 0),
  turn: item?.turn === "black" ? "black" : "white",
  file: normalizeFilePath(item?.file),
});

export const normalizeQuiz = (quiz) => {
  const solution = Array.isArray(quiz?.solution)
    ? quiz.solution.map(normalizeUci).filter(Boolean)
    : [];

  if (!String(quiz?.fen ?? "").trim()) {
    throw new Error("Quiz is missing a FEN.");
  }

  if (solution.length === 0) {
    throw new Error("Quiz must include at least one solution move.");
  }

  return {
    id: String(quiz?.id ?? ""),
    kind: String(quiz?.kind ?? "quiz"),
    title: String(quiz?.title ?? "Untitled quiz"),
    fen: String(quiz?.fen ?? ""),
    solution,
    theme: String(quiz?.theme ?? "checkmate"),
    difficulty: String(quiz?.difficulty ?? "easy"),
    description: String(quiz?.description ?? ""),
  };
};

export const loadQuizCatalog = async () => {
  const data = await readJson(QUIZ_INDEX_PATH);
  const items = Array.isArray(data?.items)
    ? data.items
        .map(normalizeCatalogItem)
        .filter((item) => item.kind === "quiz")
    : [];

  return {
    version: Number(data?.version ?? 1),
    items,
  };
};

export const loadQuizByFile = async (file) => {
  const data = await readJson(normalizeFilePath(file));
  return normalizeQuiz(data);
};

export const shuffleQuizEntries = (entries) => {
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
};

export { normalizeUci };
