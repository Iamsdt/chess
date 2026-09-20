/**
 * S19 · Analysis board.
 *
 * The route renders `AnalysisScreen`; everything else in this folder is the
 * feature's own business. The pure parts — the variation tree, the position-setup
 * model and the Lichess explorer client — are exported as types so a later sprint
 * can read the saved tree without importing a screen.
 */
export { AnalysisScreen, type AnalysisScreenProps } from './analysis-screen'
export {
  ANALYSIS_BOARD_KEY,
  type AnalysisSettings,
  type AnalysisSnapshot,
  type SearchLimit,
} from './analysis-state'
export type { ExplorerMove, ExplorerReport } from './explorer'
export type { VariationNode, VariationNodeId, VariationTree } from './variation-tree'
