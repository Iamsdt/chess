/**
 * The small amount of randomness the puzzle loop needs, made reproducible.
 *
 * Why not `Math.random()` at the call sites: three of the four things chance touches here
 * have to be replayable — a property test that cannot name the seed that broke it is a
 * flake, the daily puzzle must be the same puzzle on every device, and a session that is
 * resumed after a reload must not silently reshuffle its queue. So randomness is a value
 * that gets passed in, and the only place `Math.random` appears is the default below.
 */

/** A source of numbers in [0, 1). Injected everywhere, so tests can pin it. */
export type Rng = () => number

/**
 * mulberry32: 32 bits of state, good enough for shuffling a hundred puzzles.
 *
 * It is the same generator `src/chess/playouts.test.ts` uses, deliberately — one house
 * generator means a seed quoted in one failure means the same thing in another.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** The app's default source, for everything that genuinely wants to differ each time. */
export const systemRng: Rng = () => Math.random()

/**
 * FNV-1a over a string, as a seed.
 *
 * Why FNV: the daily puzzle is "hash the date, index into a stable order", and that needs
 * a hash whose output is stable across devices, browsers and releases. FNV-1a is four
 * lines and has no implementation-defined corners.
 */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Fisher–Yates, returning a new array so a caller's queue is never mutated under it. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    const left = copy[index]
    const right = copy[swap]
    // Indexes are in range by construction; the guard is `noUncheckedIndexedAccess`'s.
    if (left === undefined || right === undefined) continue
    copy[index] = right
    copy[swap] = left
  }
  return copy
}

/**
 * Draw `count` distinct items, each item's chance proportional to its weight.
 *
 * Why weighted rather than "take the best N": the top of a scored list is the same ten
 * puzzles every session, and a user who sees the same ten puzzles stops trusting the
 * word "adaptive". Weighting keeps the selection honest about what it is optimising for
 * while still showing something new each time.
 */
export function weightedSample<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
  rng: Rng,
): T[] {
  const pool = items.map((item) => ({ item, weight: Math.max(weightOf(item), 0) }))
  const picked: T[] = []
  let total = pool.reduce((sum, entry) => sum + entry.weight, 0)

  while (picked.length < count && pool.length > 0) {
    if (total <= 0) {
      // Every remaining candidate scored zero: fall back to an unbiased draw rather than
      // returning a short list, because a short session is a worse answer than a flat one.
      const index = Math.floor(rng() * pool.length)
      const entry = pool.splice(index, 1)[0]
      if (entry === undefined) break
      picked.push(entry.item)
      continue
    }
    let target = rng() * total
    let index = 0
    for (; index < pool.length - 1; index += 1) {
      target -= pool[index]?.weight ?? 0
      if (target <= 0) break
    }
    const entry = pool.splice(index, 1)[0]
    if (entry === undefined) break
    total -= entry.weight
    picked.push(entry.item)
  }

  return picked
}
