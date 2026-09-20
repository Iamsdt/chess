import {
  domainError,
  err,
  ok,
  type ContentPack,
  type Lesson,
  type LessonId,
  type PackId,
  type Puzzle,
  type Result,
} from '@/domain'

/**
 * The registry: which packs are installed, and what they contain.
 *
 * Why in-memory and not a table: S05 owns the `packs` table, and the screens want
 * a single place to ask "which lesson is `lesson-forks`" without knowing whether
 * the pack came from the app bundle, a file or a URL. Persistence loads packs in
 * at startup and registers them here; the registry never writes.
 */
export interface ContentPackRegistry {
  /** Replaces a pack with the same id, which is how a pack update lands. */
  register: (pack: ContentPack) => Result<ContentPack>
  unregister: (id: PackId) => boolean
  get: (id: PackId) => ContentPack | null
  list: () => readonly ContentPack[]
  lessons: () => readonly Lesson[]
  lesson: (id: LessonId) => Lesson | null
  puzzles: () => readonly Puzzle[]
  clear: () => void
}

export function createContentPackRegistry(
  initial: readonly ContentPack[] = [],
): ContentPackRegistry {
  const packs = new Map<PackId, ContentPack>()

  const registry: ContentPackRegistry = {
    register(pack) {
      const clash = [...packs.values()].find(
        (existing) => existing.id !== pack.id && sharesLessonId(existing, pack),
      )
      if (clash !== undefined) {
        return err(
          domainError(
            'conflict',
            `Pack ${pack.name} contains lessons already provided by ${clash.name}`,
            { where: pack.id },
          ),
        )
      }
      packs.set(pack.id, pack)
      return ok(pack)
    },
    unregister: (id) => packs.delete(id),
    get: (id) => packs.get(id) ?? null,
    list: () => [...packs.values()],
    lessons: () => [...packs.values()].flatMap((pack) => pack.lessons),
    lesson(id) {
      for (const pack of packs.values()) {
        const found = pack.lessons.find((lesson) => lesson.id === id)
        if (found !== undefined) return found
      }
      return null
    },
    puzzles: () => [...packs.values()].flatMap((pack) => pack.puzzles),
    clear: () => {
      packs.clear()
    },
  }

  for (const pack of initial) {
    const registered = registry.register(pack)
    if (!registered.ok) throw new Error(registered.error.message)
  }
  return registry
}

/** Why: two packs claiming the same lesson id make progress ambiguous; refuse it. */
function sharesLessonId(left: ContentPack, right: ContentPack): boolean {
  const ids = new Set(left.lessons.map((lesson) => lesson.id))
  return right.lessons.some((lesson) => ids.has(lesson.id))
}
