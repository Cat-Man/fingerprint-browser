export const REGRESSION_STORAGE_KEY = "fingerprint-browser.regressions.v1"

export const REGRESSION_FIELDS = [
  "userAgent",
  "language",
  "timezone",
  "webrtc",
  "canvas",
  "webgl",
  "audio",
  "clientRects",
] as const

export type RegressionField = (typeof REGRESSION_FIELDS)[number]
export type DetectionTargetId = "creepjs" | "browserleaks"
export type RegressionStatus = "pass" | "warn" | "fail"

export type DetectionTarget = {
  id: DetectionTargetId
  name: string
  url: string
  description: string
  steps: string[]
}

export type RegressionObservedValues = Record<RegressionField, string>

export type RegressionRun = {
  id: string
  profileId: string
  profileName: string
  targetId: DetectionTargetId
  targetName: string
  targetUrl: string
  status: RegressionStatus
  observed: RegressionObservedValues
  notes: string
  createdAt: string
}

export type RegressionRunDraft = {
  profileId: string
  profileName: string
  targetId: DetectionTargetId
  observed?: Partial<RegressionObservedValues>
  notes?: string
  status?: RegressionStatus
}

export type RegressionDiff = {
  previousRunId: string
  currentRunId: string
  previous: RegressionRun
  current: RegressionRun
  changedFields: RegressionField[]
  unchangedFields: RegressionField[]
}

export type RegressionSummary = {
  totalRuns: number
  profilesCovered: number
  targetsCovered: number
  latestRunAt?: string
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">

export const detectionTargets: DetectionTarget[] = [
  {
    id: "creepjs",
    name: "CreepJS",
    url: "https://abrahamjuliot.github.io/creepjs/",
    description: "Inspect browser entropy, renderer fingerprints, and high-signal JS surfaces.",
    steps: [
      "Step 1: Launch the selected profile and open CreepJS in a clean tab.",
      "Step 2: Wait for the fingerprint report to stabilize before recording results.",
      "Step 3: Copy the observed values for UA, language, timezone, WebRTC, Canvas, WebGL, Audio, and ClientRects.",
      "Step 4: Save the run and compare it with the previous CreepJS result for the same profile.",
    ],
  },
  {
    id: "browserleaks",
    name: "BrowserLeaks",
    url: "https://browserleaks.com/",
    description: "Cross-check core browser identity surfaces and proxy-related leak vectors.",
    steps: [
      "Step 1: Launch the selected profile and open the BrowserLeaks landing page.",
      "Step 2: Review the relevant sections for WebRTC, canvas, WebGL, audio, and client rect behavior.",
      "Step 3: Record the observed values in the lab form, then mark the run pass/warn/fail.",
      "Step 4: Compare the saved run against the previous BrowserLeaks result for the same profile.",
    ],
  },
]

export const REGRESSION_TARGETS = detectionTargets

export type DetectionFieldKey = RegressionField
export type RegressionObservation = RegressionObservedValues

export function createEmptyObservedValues(): RegressionObservedValues {
  return {
    userAgent: "",
    language: "",
    timezone: "",
    webrtc: "",
    canvas: "",
    webgl: "",
    audio: "",
    clientRects: "",
  }
}

export function getDetectionTarget(targetId: DetectionTargetId) {
  return detectionTargets.find((target) => target.id === targetId)
}

export function createRegressionRun(draft: RegressionRunDraft): RegressionRun {
  const target = getDetectionTarget(draft.targetId)

  if (!target) {
    throw new Error(`Unknown detection target: ${draft.targetId}`)
  }

  return {
    id: createRegressionRunId(),
    profileId: draft.profileId,
    profileName: draft.profileName,
    targetId: draft.targetId,
    targetName: target.name,
    targetUrl: target.url,
    status: draft.status ?? "pass",
    observed: {
      ...createEmptyObservedValues(),
      ...draft.observed,
    },
    notes: draft.notes ?? "",
    createdAt: new Date().toISOString(),
  }
}

export function loadRegressionRuns(
  storage: StorageLike = window.localStorage,
): RegressionRun[] {
  const raw = storage.getItem(REGRESSION_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeRegressionRun) : []
  } catch {
    return []
  }
}

export function saveRegressionRuns(
  runs: RegressionRun[],
  storage: StorageLike = window.localStorage,
) {
  storage.setItem(REGRESSION_STORAGE_KEY, JSON.stringify(runs))
}

export function createEmptyRegressionObservation(): RegressionObservedValues {
  return createEmptyObservedValues()
}

export function diffRegressionRuns(
  previous: RegressionRun,
  current: RegressionRun,
): RegressionDiff {
  const changedFields = REGRESSION_FIELDS.filter(
    (field) => previous.observed[field] !== current.observed[field],
  )

  return {
    previousRunId: previous.id,
    currentRunId: current.id,
    previous,
    current,
    changedFields,
    unchangedFields: REGRESSION_FIELDS.filter(
      (field) => previous.observed[field] === current.observed[field],
    ),
  }
}

export function getLatestRegressionDiff(
  runs: RegressionRun[],
  profileId: string,
  targetId: DetectionTargetId,
): RegressionDiff | null {
  const matchingRuns = runs
    .filter((run) => run.profileId === profileId && run.targetId === targetId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  if (matchingRuns.length < 2) {
    return null
  }

  const previous = matchingRuns.at(-2)
  const current = matchingRuns.at(-1)

  return previous && current ? diffRegressionRuns(previous, current) : null
}

export function summarizeRegressionRuns(runs: RegressionRun[]): RegressionSummary {
  const latestRunAt = runs
    .map((run) => run.createdAt)
    .sort((left, right) => right.localeCompare(left))[0]

  return {
    totalRuns: runs.length,
    profilesCovered: new Set(runs.map((run) => run.profileId)).size,
    targetsCovered: new Set(runs.map((run) => run.targetId)).size,
    latestRunAt,
  }
}

function normalizeRegressionRun(rawRun: RegressionRun): RegressionRun {
  const target = getDetectionTarget(rawRun.targetId)

  return {
    ...rawRun,
    targetName: target?.name ?? rawRun.targetName,
    targetUrl: target?.url ?? rawRun.targetUrl,
    observed: {
      ...createEmptyObservedValues(),
      ...rawRun.observed,
    },
    notes: rawRun.notes ?? "",
    status: rawRun.status ?? "pass",
  }
}

function createRegressionRunId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `run-${Math.random().toString(36).slice(2, 10)}`
}
