/**
 * S18 · Endgame Drills & Vision Drills.
 * Ported from `prototype/endgames.html` and `prototype/vision.html`.
 *
 * The rules of each drill are pure modules (`endgame-drills`, `endgame-session`,
 * `knight-route`, `find-checks`, `blindfold`); the screens only draw them.
 */
export { EndgamesScreen } from './endgames-screen'
export { VisionScreen } from './vision-screen'
export {
  createDrillRecordsPort,
  type DrillRecordsPort,
  type EndgameRecord,
  type EndgameRecords,
  type VisionMode,
  type VisionRecords,
} from './drill-records'
export { DrillPortsContext, type DrillPorts } from './ports'
