/**
 * The on-device decision model: a small encoder plus typed "decision heads" that answer
 * questions like "which Sage mode?" or "does this need the engine?" with probabilities, instead
 * of generating text. See contract.ts for the shared contract with the training pipeline.
 *
 * Everything heavy (transformers.js, onnxruntime, the worker) is loaded lazily, on `enable()`.
 */
export {
  BUILTIN_MANIFEST,
  DECISION_FLAG_KEYS,
  DECISION_MODE_LABELS,
  DECISION_QUESTIONS,
  DEFAULT_ENCODER_MODEL,
  DEFAULT_MODEL_SIZE_MB,
  ManifestSchema,
  MANIFEST_FORMAT,
  resolveQuestions,
  SeedsSchema,
  type DatasetRow,
  type Decision,
  type DecisionFlagKey,
  type DecisionModeLabel,
  type DecisionQuestionKey,
  type DecisionQuestionSpec,
  type Manifest,
  type SeedRow,
} from './contract'
export {
  createDecisionEngine,
  DEFAULT_DECIDE_TIMEOUT_MS,
  parseManifest,
  type DecideOptions,
  type DecisionEngine,
  type DecisionEngineDeps,
  type DecisionModelInfo,
  type DecisionSource,
  type DecisionStatus,
  type EnableOptions,
} from './engine'
export { getDecisionEngine } from './singleton'
export { useDecisionStatus } from './use-decision-status'
export {
  buildTrainingExport,
  loadSeeds,
  seedRows,
  toJsonl,
  trainingFileName,
  type TrainingExport,
} from './dataset'
export { MODE_TITLES } from './components/mode-titles'
export { ProbabilityBars, type ProbabilityBarsProps } from './components/probability-bars'
