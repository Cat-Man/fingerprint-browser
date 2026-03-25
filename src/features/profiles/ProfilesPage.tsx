import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { useI18n } from "../i18n"
import type { DesktopRuntimeBridge } from "../../lib/runtimeDesktop"
import {
  createEmptyProfileDraft,
  createProfileFromDraft,
  duplicateProfile,
  loadProfiles,
  saveProfiles,
  toProfileDraft,
  updateProfileFromDraft,
  type BrowserProfile,
  type ProfileDraft,
} from "./storage"
import {
  findRuntimeInstance,
  loadRuntimeInstances,
  refreshProfileRuntimeHealth,
  resolveRuntimeAdapter,
  restartProfileRuntime,
  saveRuntimeInstances,
  startProfileRuntime,
  stopProfileRuntime,
  summarizeRuntime,
} from "../runtime"

type ProfileFormState = ProfileDraft & {
  tagsInput: string
}

function createEmptyFormState(defaultGroupLabel: string): ProfileFormState {
  const draft = createEmptyProfileDraft()

  return {
    ...draft,
    group: defaultGroupLabel,
    tagsInput: "",
  }
}

function buildDraft(formState: ProfileFormState): ProfileDraft {
  return {
    ...formState,
    tags: formState.tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

function formatProxyLabel(
  draft: ProfileDraft,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!draft.proxy.host || !draft.proxy.port) {
    return t("profiles.proxy.none")
  }

  return `${draft.proxy.type}://${draft.proxy.host}:${draft.proxy.port}`
}

function formatGroupLabel(
  group: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  return group === "Default" || group === "默认" ? t("profiles.group.default") : group
}

function formatRuntimeStatus(
  status: "running" | "stopped" | "idle",
  t: ReturnType<typeof useI18n>["t"],
) {
  if (status === "running") {
    return t("runtime.status.running")
  }

  if (status === "stopped") {
    return t("runtime.status.stopped")
  }

  return t("runtime.status.idle")
}

function formatRuntimeLog(
  latestLog: ReturnType<typeof findLatestLog>,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (!latestLog) {
    return null
  }

  return latestLog.messageKey ? t(latestLog.messageKey, latestLog.params) : latestLog.message
}

function findLatestLog(instance: ReturnType<typeof findRuntimeInstance>) {
  return instance?.logs.at(-1)
}

function healthStatusMessageKey(status: "healthy" | "degraded" | "stopped" | "unknown") {
  return `profiles.runtime.healthStatus.${status}` as const
}

type ProfilesPageProps = {
  runtimeBridge?: DesktopRuntimeBridge
}

export function ProfilesPage({ runtimeBridge }: ProfilesPageProps) {
  const { t, formatDateTime } = useI18n()
  const defaultGroupLabel = t("profiles.group.default")
  const [profiles, setProfiles] = useState(() => loadProfiles())
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [formState, setFormState] = useState(() => createEmptyFormState(defaultGroupLabel))
  const [instances, setInstances] = useState(() => loadRuntimeInstances())

  useEffect(() => {
    saveProfiles(profiles)
  }, [profiles])

  useEffect(() => {
    saveRuntimeInstances(instances)
  }, [instances])

  const profileCountLabel = useMemo(
    () =>
      t(
        profiles.length === 1
          ? "profiles.summary.saved.one"
          : "profiles.summary.saved.other",
        { count: profiles.length },
      ),
    [profiles.length, t],
  )
  const runtimeSummary = useMemo(() => summarizeRuntime(instances), [instances])
  const displayedGroupValue =
    !editingProfileId && (formState.group === "Default" || formState.group === "默认")
      ? defaultGroupLabel
      : formState.group

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextDraft = buildDraft(formState)
    const nextProfiles = editingProfileId
      ? profiles.map((profile) =>
          profile.id === editingProfileId
            ? updateProfileFromDraft(profile, nextDraft)
            : profile,
        )
      : [...profiles, createProfileFromDraft(nextDraft)]

    setProfiles(nextProfiles)
    setEditingProfileId(null)
    setFormState(createEmptyFormState(defaultGroupLabel))
  }

  function handleEdit(profile: BrowserProfile) {
    setEditingProfileId(profile.id)
    setFormState({
      ...toProfileDraft(profile),
      tagsInput: profile.tags.join(", "),
    })
  }

  function handleDuplicate(profile: BrowserProfile) {
    setProfiles((current) => [...current, duplicateProfile(profile)])
  }

  function handleDelete(profileId: string) {
    setProfiles((current) => current.filter((profile) => profile.id !== profileId))
    setInstances((current) =>
      current.filter((instance) => instance.profileId !== profileId),
    )

    if (editingProfileId === profileId) {
      setEditingProfileId(null)
      setFormState(createEmptyFormState(defaultGroupLabel))
    }
  }

  async function handleStart(profile: BrowserProfile) {
    const result = await startProfileRuntime(instances, profile, runtimeBridge)
    setInstances(result.instances)
  }

  async function handleRestart(profile: BrowserProfile) {
    const result = await restartProfileRuntime(instances, profile, runtimeBridge)
    setInstances(result.instances)
  }

  async function handleStop(profileId: string) {
    const result = await stopProfileRuntime(instances, profileId, runtimeBridge)
    setInstances(result.instances)
  }

  async function handleRefreshHealth(profileId: string) {
    const result = await refreshProfileRuntimeHealth(instances, profileId, runtimeBridge)
    setInstances(result.instances)
  }

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">{t("profiles.eyebrow")}</p>
          <h1>{t("profiles.title")}</h1>
          <p>{t("profiles.description")}</p>
        </div>
        <div className="profile-summary">
          <span className="status-pill">{profileCountLabel}</span>
          <span className="status-pill status-pill--muted">
            {t("profiles.summary.running", { count: runtimeSummary.runningCount })}
          </span>
        </div>
      </header>

      <div className="profiles-layout">
        <article className="panel-card">
          <h2>
            {editingProfileId
              ? t("profiles.form.editTitle")
              : t("profiles.form.createTitle")}
          </h2>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>{t("profiles.form.name")}</span>
              <input
                aria-label={t("profiles.form.name")}
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>{t("profiles.form.group")}</span>
              <input
                aria-label={t("profiles.form.group")}
                value={displayedGroupValue}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, group: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>{t("profiles.form.tags")}</span>
              <input
                aria-label={t("profiles.form.tags")}
                value={formState.tagsInput}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, tagsInput: event.target.value }))
                }
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>{t("profiles.form.proxyType")}</span>
                <select
                  aria-label={t("profiles.form.proxyType")}
                  value={formState.proxy.type}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      proxy: {
                        ...current.proxy,
                        type: event.target.value as ProfileDraft["proxy"]["type"],
                      },
                    }))
                  }
                >
                  <option value="http">HTTP</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </label>

              <label className="field">
                <span>{t("profiles.form.proxyHost")}</span>
                <input
                  aria-label={t("profiles.form.proxyHost")}
                  value={formState.proxy.host}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      proxy: { ...current.proxy, host: event.target.value },
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>{t("profiles.form.proxyPort")}</span>
                <input
                  aria-label={t("profiles.form.proxyPort")}
                  value={formState.proxy.port}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      proxy: { ...current.proxy, port: event.target.value },
                    }))
                  }
                />
              </label>
            </div>

            <button className="primary-button" type="submit">
              {editingProfileId
                ? t("profiles.form.submitSave")
                : t("profiles.form.submitCreate")}
            </button>
          </form>
        </article>

        <div className="profile-list">
          {profiles.map((profile) => {
            const instance = findRuntimeInstance(instances, profile.id)
            const lifecycleStatus = instance?.status ?? "idle"
            const healthStatus =
              instance?.health?.status ?? (instance?.status === "stopped" ? "stopped" : "unknown")
            const runtimeAdapter = resolveRuntimeAdapter(profile)
            const launchPlan = instance
              ? runtimeAdapter?.prepareLaunch({
                  profile,
                  debugPort: instance.debugPort,
                })
              : null

            return (
              <article className="panel-card profile-card" key={profile.id}>
                <div className="profile-card__header">
                  <div>
                    <h2>{profile.name}</h2>
                    <p>{formatGroupLabel(profile.group, t)}</p>
                  </div>
                  <div className="profile-badges">
                    <span className="status-pill status-pill--muted">
                      {formatProxyLabel(profile, t)}
                    </span>
                    <span className="status-pill status-pill--muted">
                      {formatRuntimeStatus(lifecycleStatus, t)}
                    </span>
                  </div>
                </div>
                <p>
                  {profile.tags.length > 0 ? profile.tags.join(", ") : t("profiles.tags.none")}
                </p>
                <div className="runtime-details">
                  <p>
                    {t("profiles.runtime.debugPort", {
                      value: instance?.debugPort ?? t("profiles.runtime.notAllocated"),
                    })}
                  </p>
                  <p>
                    {t("profiles.runtime.processId", {
                      value: instance?.processId ?? t("profiles.runtime.notAvailable"),
                    })}
                  </p>
                  <p>
                    {t("profiles.runtime.endpoint", {
                      value: instance?.wsEndpoint || t("profiles.runtime.notConnected"),
                    })}
                  </p>
                  {instance ? (
                    <p>{formatRuntimeLog(findLatestLog(instance), t)}</p>
                  ) : null}
                  {instance ? (
                    <>
                      <p>
                        {t("profiles.runtime.health", {
                          value: t(healthStatusMessageKey(healthStatus)),
                        })}
                      </p>
                      <p>
                        {t("profiles.runtime.checkedAt", {
                          value: instance.health?.checkedAt
                            ? formatDateTime(instance.health.checkedAt)
                            : t("profiles.runtime.notAvailable"),
                        })}
                      </p>
                      <p>
                        {t("profiles.runtime.healthMessage", {
                          value:
                            instance.health?.message ?? instance.lastError ?? t("profiles.runtime.notAvailable"),
                        })}
                      </p>
                    </>
                  ) : null}
                </div>
                <div className="runtime-logs">
                  <p>{t("profiles.runtime.logsTitle")}</p>
                  {instance && instance.logs.length > 0 ? (
                    <ul className="runtime-logs__list">
                      {instance.logs.slice(-5).map((log) => (
                        <li key={`${log.at}-${log.message}`}>{log.message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{t("profiles.runtime.logsEmpty")}</p>
                  )}
                </div>
                {launchPlan ? (
                  <div className="runtime-plan">
                    <p>{t("profiles.runtime.adapter", { value: launchPlan.adapterId })}</p>
                    <p>
                      {t("profiles.runtime.fingerprint", {
                        language: launchPlan.fingerprint.language,
                        timezone: launchPlan.fingerprint.timezone,
                        width: launchPlan.fingerprint.resolution.width,
                        height: launchPlan.fingerprint.resolution.height,
                      })}
                    </p>
                    <ul className="runtime-plan__args">
                      {launchPlan.launchArgs.map((arg) => (
                        <li key={arg}>{arg}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="profile-card__actions">
                  {instance?.status === "running" ? (
                    <>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-label={t("profiles.aria.refreshHealth", { name: profile.name })}
                        onClick={() => {
                          void handleRefreshHealth(profile.id)
                        }}
                      >
                        {t("profiles.runtime.refreshHealth")}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-label={t("profiles.aria.restart", { name: profile.name })}
                        onClick={() => {
                          void handleRestart(profile)
                        }}
                      >
                        {t("profiles.actions.restart")}
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-label={t("profiles.aria.stop", { name: profile.name })}
                        onClick={() => {
                          void handleStop(profile.id)
                        }}
                      >
                        {t("profiles.actions.stop")}
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button"
                      type="button"
                      aria-label={t("profiles.aria.start", { name: profile.name })}
                      onClick={() => {
                        void handleStart(profile)
                      }}
                    >
                      {t("profiles.actions.start")}
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label={t("profiles.aria.edit", { name: profile.name })}
                    onClick={() => handleEdit(profile)}
                  >
                    {t("profiles.actions.edit")}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label={t("profiles.aria.duplicate", { name: profile.name })}
                    onClick={() => handleDuplicate(profile)}
                  >
                    {t("profiles.actions.duplicate")}
                  </button>
                  <button
                    className="secondary-button secondary-button--danger"
                    type="button"
                    aria-label={t("profiles.aria.delete", { name: profile.name })}
                    onClick={() => handleDelete(profile.id)}
                  >
                    {t("profiles.actions.delete")}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
