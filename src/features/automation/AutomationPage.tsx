import { useEffect, useMemo, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import {
  desktopAutomationBridge,
  type DesktopAutomationBridge,
} from "../../lib/automationDesktop"
import { useI18n, type MessageKey } from "../i18n"
import { loadProfiles, type BrowserProfile } from "../profiles"
import { buildFingerprintConfig, findRuntimeInstance, loadRuntimeInstances } from "../runtime"
import {
  summarizeDetectionArtifacts,
  type DetectionSiteSummary,
} from "./summary"
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
  automationBridge?: DesktopAutomationBridge
}

type LabFormState = {
  profileId: string
  targetId: DetectionTargetId
  observed: RegressionObservedValues
  notes: string
}

function pluralMessageKey(base: string, count: number) {
  return `${base}.${count === 1 ? "one" : "other"}` as MessageKey
}

function fieldMessageKey(field: RegressionField) {
  return `automation.field.${field}` as MessageKey
}

function targetDescriptionKey(targetId: DetectionTargetId) {
  return `automation.target.${targetId}.description` as MessageKey
}

function targetStepKeys(targetId: DetectionTargetId) {
  return [1, 2, 3, 4].map(
    (step) => `automation.target.${targetId}.step${step}` as MessageKey,
  )
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

export function AutomationPage({
  onRunsChanged,
  automationBridge = desktopAutomationBridge,
}: AutomationPageProps) {
  const { t, formatDateTime } = useI18n()
  const [profiles] = useState(() => loadProfiles())
  const [runs, setRuns] = useState(() => loadRegressionRuns())
  const [instances] = useState(() => loadRuntimeInstances())
  const [formState, setFormState] = useState(() => createInitialFormState(profiles, loadRegressionRuns()))
  const [feedback, setFeedback] = useState("")
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedSummary, setCapturedSummary] = useState<DetectionSiteSummary | null>(null)
  const [hasSummaryAttempt, setHasSummaryAttempt] = useState(false)

  useEffect(() => {
    saveRegressionRuns(runs)
    onRunsChanged?.(runs)
  }, [onRunsChanged, runs])

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === formState.profileId),
    [formState.profileId, profiles],
  )
  const selectedInstance = useMemo(
    () => findRuntimeInstance(instances, formState.profileId),
    [formState.profileId, instances],
  )
  const selectedTarget = getDetectionTarget(formState.targetId)
  const canAutoCapture =
    automationBridge.isTauri() &&
    selectedInstance?.status === "running" &&
    Boolean(selectedInstance.wsEndpoint) &&
    Boolean(selectedTarget)
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

    setCapturedSummary(null)
    setHasSummaryAttempt(false)

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

    setCapturedSummary(null)
    setHasSummaryAttempt(false)

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
    setFeedback(
      t("automation.feedback.saved", {
        profile: selectedProfile.name,
        target: selectedTarget.name,
      }),
    )
    setFormState((current) => ({
      ...current,
      notes: "",
    }))
  }

  async function handleAutoCapture() {
    if (!selectedProfile || !selectedTarget || !selectedInstance?.wsEndpoint) {
      setFeedback(t("automation.feedback.runtimeRequired"))
      return
    }

    setIsCapturing(true)

    try {
      const result = await automationBridge.runProbe({
        profileId: selectedProfile.id,
        targetId: selectedTarget.id,
        targetUrl: selectedTarget.url,
        wsEndpoint: selectedInstance.wsEndpoint,
      })
      const nextSummary = summarizeDetectionArtifacts({
        targetId: selectedTarget.id,
        observed: result.observed,
        artifacts: result.artifacts,
      })

      setFormState((current) => ({
        ...current,
        observed: result.observed,
      }))
      setCapturedSummary(nextSummary)
      setHasSummaryAttempt(true)
      setFeedback(t("automation.feedback.probeCaptured"))
    } catch (error) {
      setFeedback(
        t("automation.feedback.probeFailed", {
          reason: error instanceof Error ? error.message : String(error),
        }),
      )
    } finally {
      setIsCapturing(false)
    }
  }

  if (profiles.length === 0) {
    return (
      <section className="page-shell">
        <header className="page-shell__header">
          <div>
            <p className="eyebrow">{t("automation.eyebrow")}</p>
            <h1>{t("automation.title")}</h1>
            <p>{t("automation.empty.description")}</p>
          </div>
        </header>
        <article className="panel-card">
          <p>{t("automation.empty.notice")}</p>
        </article>
      </section>
    )
  }

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">{t("automation.eyebrow")}</p>
          <h1>{t("automation.title")}</h1>
          <p>{t("automation.description")}</p>
        </div>
        <div className="profile-summary">
          <span className="status-pill">
            {t(pluralMessageKey("automation.summary.runs", summary.totalRuns), {
              count: summary.totalRuns,
            })}
          </span>
          <span className="status-pill status-pill--muted">
            {t(
              pluralMessageKey(
                "automation.summary.profilesCovered",
                summary.profilesCovered,
              ),
              { count: summary.profilesCovered },
            )}
          </span>
        </div>
      </header>

      <div className="lab-layout">
        <article className="panel-card">
          <h2>{t("automation.form.title")}</h2>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>{t("automation.form.profile")}</span>
              <select value={formState.profileId} onChange={handleProfileChange}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("automation.form.target")}</span>
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
                  <span>{t(fieldMessageKey(field))}</span>
                  <input
                    aria-label={t(fieldMessageKey(field))}
                    value={formState.observed[field]}
                    onChange={(event) => handleObservedChange(field, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <label className="field">
              <span>{t("automation.form.notes")}</span>
              <textarea
                aria-label={t("automation.form.notes")}
                value={formState.notes}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>

            <p>
              {canAutoCapture
                ? t("automation.runtime.connected")
                : t("automation.feedback.runtimeRequired")}
            </p>
            <button
              className="secondary-button"
              type="button"
              disabled={!canAutoCapture || isCapturing}
              onClick={() => {
                void handleAutoCapture()
              }}
            >
              {isCapturing ? t("common.loading") : t("automation.form.autoCapture")}
            </button>
            <button className="primary-button" type="submit">
              {t("automation.form.save")}
            </button>
            {feedback ? <p>{feedback}</p> : null}
          </form>
        </article>

        <div className="panel-list lab-panel-list">
          <article className="panel-card">
            <h2>{selectedTarget?.name ?? t("automation.target.placeholder")}</h2>
            {selectedTarget ? (
              <>
                <p>{t(targetDescriptionKey(selectedTarget.id))}</p>
                <p>
                  {t("automation.target.url")}{" "}
                  <a href={selectedTarget.url} target="_blank" rel="noreferrer">
                    {selectedTarget.url}
                  </a>
                </p>
                <ol className="lab-checklist">
                  {targetStepKeys(selectedTarget.id).map((stepKey) => (
                    <li key={stepKey}>{t(stepKey)}</li>
                  ))}
                </ol>
              </>
            ) : null}
          </article>

          <article className="panel-card">
            <h2>{t("automation.summary.title")}</h2>
            {capturedSummary ? (
              <>
                {capturedSummary.headline ? <p>{capturedSummary.headline}</p> : null}
                <ul>
                  {capturedSummary.items.map((item) => (
                    <li key={`${item.label}-${item.value}`}>
                      <strong>{t(item.label as MessageKey)}</strong>
                      {`: ${item.value}`}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                {hasSummaryAttempt
                  ? t("automation.summary.unavailable")
                  : t("automation.summary.idle")}
              </p>
            )}
          </article>

          <article className="panel-card">
            <h2>{t("automation.diff.title")}</h2>
            {!latestDiff ? (
              <p>{t("automation.diff.hint")}</p>
            ) : latestDiff.diff.changedFields.length === 0 ? (
              <p>{t("automation.diff.none")}</p>
            ) : (
              <>
                <p>
                  {t("automation.diff.changedFields", {
                    fields: latestDiff.diff.changedFields
                      .map((field) => t(fieldMessageKey(field)))
                      .join(", "),
                  })}
                </p>
                <ul>
                  {latestDiff.diff.changedFields.map((field) => (
                    <li key={field}>
                      {t("automation.diff.fieldChanged", {
                        field: t(fieldMessageKey(field)),
                        previous:
                          latestDiff.previous.observed[field] ||
                          t("automation.diff.emptyValue"),
                        current:
                          latestDiff.current.observed[field] ||
                          t("automation.diff.emptyValue"),
                      })}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>

          <article className="panel-card">
            <h2>{t("automation.recentRuns.title")}</h2>
            {recentRuns.length === 0 ? (
              <p>{t("automation.recentRuns.empty")}</p>
            ) : (
              <ul>
                {recentRuns.slice(0, 5).map((run) => (
                  <li key={run.id}>
                    <strong>{`${run.profileName} · ${run.targetName}`}</strong>
                    <span>{` · ${formatDateTime(run.createdAt)}`}</span>
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
