/**
 * S16 · Learn — the course map and the lesson player.
 *
 * Both are driven by installed content packs and the player's own progress: the shipped
 * tutorials arrive as the builtin pack on first use, and an imported pack joins the map.
 */
export { LearnScreen } from './learn-screen'
export { LessonScreen } from './lesson-screen'
export { buildCourse, trackTitle, type Course, type LessonRow, type TrackSummary } from './course'
export { ensureBuiltinLessons } from './lesson-store'
