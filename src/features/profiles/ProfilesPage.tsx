import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
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
  resolveRuntimeAdapter,
  restartProfileInstance,
  saveRuntimeInstances,
  startProfileInstance,
  stopProfileInstance,
  summarizeRuntime,
} from "../runtime"

type ProfileFormState = ProfileDraft & {
  tagsInput: string
}

function createEmptyFormState(): ProfileFormState {
  const draft = createEmptyProfileDraft()

  return {
    ...draft,
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

function formatProxyLabel(draft: ProfileDraft) {
  if (!draft.proxy.host || !draft.proxy.port) {
    return "No proxy configured"
  }

  return `${draft.proxy.type}://${draft.proxy.host}:${draft.proxy.port}`
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState(() => loadProfiles())
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [formState, setFormState] = useState(createEmptyFormState)
  const [instances, setInstances] = useState(() => loadRuntimeInstances())

  useEffect(() => {
    saveProfiles(profiles)
  }, [profiles])

  useEffect(() => {
    saveRuntimeInstances(instances)
  }, [instances])

  const profileCountLabel = useMemo(
    () => `${profiles.length} saved profile${profiles.length === 1 ? "" : "s"}`,
    [profiles],
  )
  const runtimeSummary = useMemo(() => summarizeRuntime(instances), [instances])

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
    setFormState(createEmptyFormState())
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
      setFormState(createEmptyFormState())
    }
  }

  function handleStart(profile: BrowserProfile) {
    const result = startProfileInstance(instances, profile)
    setInstances(result.instances)
  }

  function handleRestart(profile: BrowserProfile) {
    const result = restartProfileInstance(instances, profile)
    setInstances(result.instances)
  }

  function handleStop(profileId: string) {
    const result = stopProfileInstance(instances, profileId)
    setInstances(result.instances)
  }

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">Identity workspace</p>
          <h1>Profiles</h1>
          <p>
            Create, organize, and launch isolated browser profiles with their own
            proxy and fingerprint settings.
          </p>
        </div>
        <div className="profile-summary">
          <span className="status-pill">{profileCountLabel}</span>
          <span className="status-pill status-pill--muted">
            {runtimeSummary.runningCount} running
          </span>
        </div>
      </header>

      <div className="profiles-layout">
        <article className="panel-card">
          <h2>{editingProfileId ? "Edit profile" : "Create profile"}</h2>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Profile name</span>
              <input
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Group</span>
              <input
                value={formState.group}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, group: event.target.value }))
                }
              />
            </label>

            <label className="field">
              <span>Tags</span>
              <input
                value={formState.tagsInput}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, tagsInput: event.target.value }))
                }
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Proxy type</span>
                <select
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
                <span>Proxy host</span>
                <input
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
                <span>Proxy port</span>
                <input
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
              {editingProfileId ? "Save changes" : "Create profile"}
            </button>
          </form>
        </article>

        <div className="profile-list">
          {profiles.map((profile) => {
            const instance = findRuntimeInstance(instances, profile.id)
            const lifecycleStatus = instance?.status ?? "idle"
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
                    <p>{profile.group}</p>
                  </div>
                  <div className="profile-badges">
                    <span className="status-pill status-pill--muted">
                      {formatProxyLabel(profile)}
                    </span>
                    <span className="status-pill status-pill--muted">
                      {lifecycleStatus}
                    </span>
                  </div>
                </div>
                <p>
                  {profile.tags.length > 0 ? profile.tags.join(", ") : "No tags yet"}
                </p>
                <div className="runtime-details">
                  <p>Debug port: {instance?.debugPort ?? "Not allocated"}</p>
                  <p>Playwright endpoint: {instance?.wsEndpoint || "Not connected"}</p>
                  {instance?.logs.at(-1) ? <p>{instance.logs.at(-1)?.message}</p> : null}
                </div>
                {launchPlan ? (
                  <div className="runtime-plan">
                    <p>Adapter: {launchPlan.adapterId}</p>
                    <p>
                      Fingerprint: {launchPlan.fingerprint.language} ·{" "}
                      {launchPlan.fingerprint.timezone} ·{" "}
                      {launchPlan.fingerprint.resolution.width}x
                      {launchPlan.fingerprint.resolution.height}
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
                        aria-label={`Restart ${profile.name}`}
                        onClick={() => handleRestart(profile)}
                      >
                        Restart
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-label={`Stop ${profile.name}`}
                        onClick={() => handleStop(profile.id)}
                      >
                        Stop
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button"
                      type="button"
                      aria-label={`Start ${profile.name}`}
                      onClick={() => handleStart(profile)}
                    >
                      Start
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label={`Edit ${profile.name}`}
                    onClick={() => handleEdit(profile)}
                  >
                    Edit
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label={`Duplicate ${profile.name}`}
                    onClick={() => handleDuplicate(profile)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="secondary-button secondary-button--danger"
                    type="button"
                    aria-label={`Delete ${profile.name}`}
                    onClick={() => handleDelete(profile.id)}
                  >
                    Delete
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
