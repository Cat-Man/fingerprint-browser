import { useEffect, useMemo, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { loadProfiles, type BrowserProfile } from "../profiles"
import { buildFingerprintConfig } from "../runtime"
import {
  REGRESSION_FIELDS,
  createEmptyObservedValues,
  createRegressionRun,
  detectionTargets,
  diffRegressionRuns,
  getDetectionTarget,
  loadRegressionRuns,
  saveRegressionRuns,
  summarizeRegressionRuns,
  type DetectionTargetId,
  type RegressionField,
  type RegressionObservedValues,
  type RegressionRun,
} from "./storage"

type AutomationPageProps = {
  onRunsChanged?: (runs: RegressionRun[]) => void
}

type LabFormState = {
  profileId: string
  targetId: DetectionTargetId
  observed: RegressionObservedValues
  notes: string
}

const FIELD_LABELS: Record<RegressionField, string> = {
  userAgent: "User agent",
  language: "Language",
  timezone: "Timezone",
  webrtc: "WebRTC",
  canvas: "Canvas",
  webgl: "WebGL",
  audio: "Audio",
  clientRects: "ClientRects",
}

function buildObservedDefaults(
  profile?: BrowserProfile,
  previousRun?: RegressionRun,
): RegressionObservedValues {
  if (previousRun) {
    return {
      ...createEmptyObservedValues(),
      ...previousRun.observed,
    }
  }

  if (!profile) {
    return createEmptyObservedValues()
  }

  const fingerprint = buildFingerprintConfig(profile)

  return {
    userAgent: fingerprint.userAgent,
    language: fingerprint.language,
    timezone: fingerprint.timezone,
    webrtc: fingerprint.webrtcPolicy,
    canvas: "",
    webgl: "",
    audio: "",
    clientRects: "",
  }
}

function getLatestRunForSelection(
  runs: RegressionRun[],
  profileId: string,
  targetId: DetectionTargetId,
) {
  return runs
    .filter((run) => run.profileId === profileId && run.targetId === targetId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
}

function createInitialFormState(
  profiles: BrowserProfile[],
  runs: RegressionRun[],
): LabFormState {
  const firstProfile = profiles[0]
  const targetId: DetectionTargetId = "creepjs"
  const latestRun = firstProfile
    ? getLatestRunForSelection(runs, firstProfile.id, targetId)
    : undefined

  return {
    profileId: firstProfile?.id ?? "",
    targetId,
    observed: buildObservedDefaults(firstProfile, latestRun),
    notes: "",
  }
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp))
}

export function AutomationPage({ onRunsChanged }: AutomationPageProps) {
  const [profiles] = useState(() => loadProfiles())
  const [runs, setRuns] = useState(() => loadRegressionRuns())
  const [formState, setFormState] = useState(() => createInitialFormState(profiles, loadRegressionRuns()))
  const [feedback, setFeedback] = useState("")

  useEffect(() => {
    saveRegressionRuns(runs)
    onRunsChanged?.(runs)
  }, [onRunsChanged, runs])

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === formState.profileId),
    [formState.profileId, profiles],
  )
  const selectedTarget = getDetectionTarget(formState.targetId)
  const summary = useMemo(() => summarizeRegressionRuns(runs), [runs])
  const recentRuns = useMemo(
    () =>
      runs
        .filter(
          (run) =>
            run.profileId === formState.profileId && run.targetId === formState.targetId,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [formState.profileId, formState.targetId, runs],
  )
  const latestDiff = useMemo(() => {
    const current = recentRuns[0]
    const previous = recentRuns[1]

    if (!current || !previous) {
      return null
    }

    return {
      previous,
      current,
      diff: diffRegressionRuns(previous, current),
    }
  }, [recentRuns])

  function handleProfileChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextProfile = profiles.find((profile) => profile.id === event.target.value)
    const latestRun = nextProfile
      ? getLatestRunForSelection(runs, nextProfile.id, formState.targetId)
      : undefined

    setFormState((current) => ({
      ...current,
      profileId: event.target.value,
      observed: buildObservedDefaults(nextProfile, latestRun),
    }))
  }

  function handleTargetChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextTargetId = event.target.value as DetectionTargetId
    const latestRun = selectedProfile
      ? getLatestRunForSelection(runs, selectedProfile.id, nextTargetId)
      : undefined

    setFormState((current) => ({
      ...current,
      targetId: nextTargetId,
      observed: buildObservedDefaults(selectedProfile, latestRun),
    }))
  }

  function handleObservedChange(field: RegressionField, value: string) {
    setFormState((current) => ({
      ...current,
      observed: {
        ...current.observed,
        [field]: value,
      },
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProfile || !selectedTarget) {
      return
    }

    const nextRun = createRegressionRun({
      profileId: selectedProfile.id,
      profileName: selectedProfile.name,
      targetId: selectedTarget.id,
      observed: formState.observed,
      notes: formState.notes,
    })
    const nextRuns = [nextRun, ...runs]

    setRuns(nextRuns)
    setFeedback(`Saved regression run for ${selectedProfile.name} on ${selectedTarget.name}.`)
    setFormState((current) => ({
      ...current,
      notes: "",
    }))
  }

  if (profiles.length === 0) {
    return (
      <section className="page-shell">
        <header className="page-shell__header">
          <div>
            <p className="eyebrow">Regression workflow</p>
            <h1>Detection Lab</h1>
            <p>Create a profile first, then record manual checks for CreepJS and BrowserLeaks.</p>
          </div>
        </header>
        <article className="panel-card">
          <p>No profiles available yet. Create a profile before running detection checks.</p>
        </article>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">Regression workflow</p>
          <h1>Detection Lab</h1>
          <p>
            Record manual fingerprint observations for CreepJS and BrowserLeaks,
            then compare them against previous runs for the same profile.
          </p>
        </div>
        <div className="profile-summary">
          <span className="status-pill">{summary.totalRuns} recorded runs</span>
          <span className="status-pill status-pill--muted">
            {summary.profilesCovered} profiles covered
          </span>
        </div>
      </header>

      <div className="lab-layout">
        <article className="panel-card">
          <h2>Record regression run</h2>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Profile</span>
              <select value={formState.profileId} onChange={handleProfileChange}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Target</span>
              <select value={formState.targetId} onChange={handleTargetChange}>
                {detectionTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="lab-fields-grid">
              {REGRESSION_FIELDS.map((field) => (
                <label className="field" key={field}>
                  <span>{FIELD_LABELS[field]}</span>
                  <input
                    aria-label={FIELD_LABELS[field]}
                    value={formState.observed[field]}
                    onChange={(event) => handleObservedChange(field, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea
                value={formState.notes}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>

            <button className="primary-button" type="submit">
              Save regression run
            </button>
            {feedback ? <p>{feedback}</p> : null}
          </form>
        </article>

        <div className="panel-list lab-panel-list">
          <article className="panel-card">
            <h2>{selectedTarget?.name ?? "Detection target"}</h2>
            {selectedTarget ? (
              <>
                <p>{selectedTarget.description}</p>
                <p>
                  URL:{" "}
                  <a href={selectedTarget.url} target="_blank" rel="noreferrer">
                    {selectedTarget.url}
                  </a>
                </p>
                <ol className="lab-checklist">
                  {selectedTarget.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </>
            ) : null}
          </article>

          <article className="panel-card">
            <h2>Latest regression diff</h2>
            {!latestDiff ? (
              <p>Save at least two runs for this profile and target to compare changes.</p>
            ) : latestDiff.diff.changedFields.length === 0 ? (
              <p>No field changes detected between the latest two runs.</p>
            ) : (
              <>
                <p>
                  Changed fields:{" "}
                  {latestDiff.diff.changedFields.map((field) => field.toLowerCase()).join(", ")}
                </p>
                <ul>
                  {latestDiff.diff.changedFields.map((field) => (
                    <li key={field}>
                      {FIELD_LABELS[field]} changed: {latestDiff.previous.observed[field] || "(empty)"} →{" "}
                      {latestDiff.current.observed[field] || "(empty)"}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <article className="panel-card">
            <h2>Recent runs</h2>
            {recentRuns.length === 0 ? (
              <p>No runs recorded yet for this profile and target.</p>
            ) : (
              <ul>
                {recentRuns.slice(0, 5).map((run) => (
                  <li key={run.id}>
                    <strong>{`${run.profileName} · ${run.targetName}`}</strong>
                    <span>{` · ${formatTimestamp(run.createdAt)}`}</span>
                    {run.notes ? <span>{` · ${run.notes}`}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
