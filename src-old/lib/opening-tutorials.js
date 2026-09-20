import { withBaseUrl } from "./base-url.js";

const TUTORIAL_INDEX_PATH = withBaseUrl("tutorial/index.json");

const VALID_ACTORS = new Set(["player", "opponent"]);

const normalizeSan = (san) =>
  String(san ?? "")
    .replace(/[?!+#]+/g, "")
    .trim();

const normalizeFilePath = (file) => {
  if (typeof file !== "string" || file.trim().length === 0) {
    throw new Error("Tutorial entry is missing a file path.");
  }

  return withBaseUrl(file.replace(/^\/+/, ""));
};

const normalizeArrow = (arrow) => ({
  startSquare: arrow?.startSquare ?? arrow?.from ?? "",
  endSquare: arrow?.endSquare ?? arrow?.to ?? "",
  color: arrow?.color ?? "#38bdf8",
});

const normalizeStep = (step, index) => {
  if (!VALID_ACTORS.has(step?.actor)) {
    throw new Error(`Tutorial step ${index + 1} has an invalid actor.`);
  }

  const san = normalizeSan(step?.san);
  if (!san) {
    throw new Error(`Tutorial step ${index + 1} is missing SAN notation.`);
  }

  return {
    actor: step.actor,
    san,
    title: String(step?.title ?? `Step ${index + 1}`),
    instruction: String(step?.instruction ?? ""),
    coaching: String(step?.coaching ?? ""),
    hint: String(step?.hint ?? ""),
    arrows: Array.isArray(step?.arrows)
      ? step.arrows
          .map(normalizeArrow)
          .filter((arrow) => arrow.startSquare && arrow.endSquare)
      : [],
    focusSquares: Array.isArray(step?.focusSquares)
      ? step.focusSquares.filter(
          (square) => typeof square === "string" && square.length === 2,
        )
      : [],
  };
};

const normalizeCatalogItem = (item) => ({
  id: String(item?.id ?? ""),
  kind: String(item?.kind ?? "tutorial"),
  title: String(item?.title ?? "Untitled tutorial"),
  eco: String(item?.eco ?? ""),
  category: String(item?.category ?? "semi-open"),
  side: String(item?.side ?? "white"),
  difficulty: String(item?.difficulty ?? "club"),
  summary: String(item?.summary ?? ""),
  tags: Array.isArray(item?.tags) ? item.tags.map(String) : [],
  stepCount: Number(item?.stepCount ?? 0),
  file: normalizeFilePath(item?.file),
});

const readJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}.`);
  }

  return response.json();
};

export const normalizeTutorial = (tutorial) => {
  const steps = Array.isArray(tutorial?.steps)
    ? tutorial.steps.map((step, index) => normalizeStep(step, index))
    : [];

  if (steps.length === 0) {
    throw new Error("Tutorial must include at least one step.");
  }

  return {
    id: String(tutorial?.id ?? ""),
    kind: String(tutorial?.kind ?? "tutorial"),
    slug: String(tutorial?.slug ?? ""),
    title: String(tutorial?.title ?? "Untitled tutorial"),
    eco: String(tutorial?.eco ?? ""),
    category: String(tutorial?.category ?? "semi-open"),
    side: String(tutorial?.side ?? "white"),
    difficulty: String(tutorial?.difficulty ?? "club"),
    summary: String(tutorial?.summary ?? ""),
    description: String(tutorial?.description ?? ""),
    line: String(tutorial?.line ?? ""),
    objectives: Array.isArray(tutorial?.objectives)
      ? tutorial.objectives.map(String)
      : [],
    plans: Array.isArray(tutorial?.plans) ? tutorial.plans.map(String) : [],
    commonMistakes: Array.isArray(tutorial?.commonMistakes)
      ? tutorial.commonMistakes.map(String)
      : [],
    completionTitle: String(tutorial?.completionTitle ?? "Tutorial complete"),
    completionSummary: String(tutorial?.completionSummary ?? ""),
    defaultOrientation:
      tutorial?.defaultOrientation === "black" ? "black" : "white",
    steps,
  };
};

export const loadTutorialCatalog = async () => {
  const data = await readJson(TUTORIAL_INDEX_PATH);
  const items = Array.isArray(data?.items)
    ? data.items
        .map(normalizeCatalogItem)
        .filter((item) => item.kind === "tutorial")
    : [];

  return {
    version: Number(data?.version ?? 1),
    items,
  };
};

export const loadTutorialByFile = async (file) => {
  const data = await readJson(normalizeFilePath(file));
  return normalizeTutorial(data);
};

export { normalizeSan };
