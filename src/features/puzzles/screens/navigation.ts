/** The four routes this feature moves between. S04 owns the route table; this is its shape. */
export type PuzzlePath = '/puzzles' | '/puzzles/solve' | '/puzzles/rush' | '/puzzles/summary'

/**
 * How a screen asks to go somewhere.
 *
 * Why a callback rather than `useNavigate` inside each screen: it keeps the screens
 * renderable — and therefore testable — without a router around them, and it keeps the
 * one import of `@tanstack/react-router` in this feature down to the four thin wrappers
 * in `index.tsx`.
 */
export type NavigateTo = (path: PuzzlePath) => void
