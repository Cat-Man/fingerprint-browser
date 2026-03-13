export const automationMilestones = [
  "Playwright connection handshake",
  "CreepJS smoke checks",
  "BrowserLeaks regression coverage",
]

export {
  REGRESSION_FIELDS,
  REGRESSION_STORAGE_KEY,
  createEmptyObservedValues,
  createRegressionRun,
  detectionTargets,
  diffRegressionRuns,
  getDetectionTarget,
  getLatestRegressionDiff,
  loadRegressionRuns,
  saveRegressionRuns,
  summarizeRegressionRuns,
  type DetectionTarget,
  type DetectionTargetId,
  type RegressionDiff,
  type RegressionField,
  type RegressionObservedValues,
  type RegressionRun,
  type RegressionRunDraft,
  type RegressionStatus,
  type RegressionSummary,
} from "./storage"
