/**
 * Opening statistics tracker — persisted in localStorage as a flat JSON map.
 *
 * Schema: localStorage["chess-opening-stats"] = JSON of:
 *   {
 *     [ecoKey: string]: {
 *       eco: string,
 *       name: string,
 *       wins: number,
 *       losses: number,
 *       draws: number,
 *       lastPlayed: number  // timestamp ms
 *     }
 *   }
 *
 * Usage:
 *   recordOpeningResult({ eco, name, result: "w"|"b"|"d", playerColor: "w"|"b" })
 *   getOpeningStats() → array sorted by totalGames desc
 *   clearOpeningStats()
 */

const KEY = "chess-opening-stats";

/**
 *
 */
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};

/**
 *
 */
const save = (data) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage full */
  }
};

/**
 * Record one opening result.
 * @param {object} params
 * @param {string} params.eco       - ECO code (e.g. "C60")
 * @param {string} params.name      - Opening name
 * @param {"w"|"b"|"d"} params.gameResult  - "w"=white wins, "b"=black wins, "d"=draw
 * @param {"w"|"b"} params.playerColor     - which side the human played
 */
export const recordOpeningResult = ({ eco, name, gameResult, playerColor }) => {
  if (!eco || !name) return;
  const data = load();
  const key = eco || name;

  if (!data[key]) {
    data[key] = { eco, name, wins: 0, losses: 0, draws: 0, lastPlayed: 0 };
  }

  const entry = data[key];
  entry.lastPlayed = Date.now();

  if (gameResult === "d") {
    entry.draws += 1;
  } else if (gameResult === playerColor) {
    entry.wins += 1;
  } else {
    entry.losses += 1;
  }

  save(data);
};

/**
 * Returns array of opening stat entries, sorted by total games played descending.
 */
export const getOpeningStats = () => {
  const data = load();
  return Object.values(data)
    .map((e) => ({
      ...e,
      total: e.wins + e.losses + e.draws,
      winPct:
        e.wins + e.losses + e.draws > 0
          ? Math.round((e.wins / (e.wins + e.losses + e.draws)) * 100)
          : 0,
    }))
    .sort((a, b) => b.total - a.total);
};

/** Remove all opening stats. */
export const clearOpeningStats = () => {
  localStorage.removeItem(KEY);
};

/**
 * Detect which opening was played by matching the game's SAN history
 * against the openings database. Returns the best (longest) match.
 * @param {string[]} sanMoves - Array of SAN move strings
 * @param {import("./openings").OpeningEntry[]} openings - Opening database
 * @returns {{ eco, name } | null}
 */
export const detectOpening = (sanMoves, openings) => {
  if (!sanMoves || sanMoves.length === 0) return null;

  let bestMatch = null;
  let bestLength = 0;

  for (const opening of openings) {
    const opMoves = opening.moves.trim().split(/\s+/);
    if (opMoves.length === 0) continue;

    // Check if all opening moves match the beginning of the game
    let matches = true;
    for (let index = 0; index < opMoves.length; index++) {
      if (sanMoves[index] !== opMoves[index]) {
        matches = false;
        break;
      }
    }

    if (matches && opMoves.length > bestLength) {
      bestLength = opMoves.length;
      bestMatch = { eco: opening.eco, name: opening.name };
    }
  }

  return bestMatch;
};
