export const PROFILE_STORAGE_KEY = "fingerprint-browser.profiles.v1"

export type ProxyType = "http" | "socks5"
export type GeolocationPolicy = "prompt" | "allow" | "block"
export type WebRtcPolicy = "default" | "proxy-only" | "disabled"

export type ProfileProxy = {
  type: ProxyType
  host: string
  port: string
  username: string
  password: string
}

export type ProfileFingerprint = {
  timezone: string
  locale: string
  userAgent: string
  webrtcPolicy: WebRtcPolicy
  geolocationPolicy: GeolocationPolicy
  screen: string
  memory: string
  hardwareConcurrency: string
}

export type ProfileDraft = {
  name: string
  group: string
  tags: string[]
  notes: string
  browserEngine: string
  browserVersion: string
  proxy: ProfileProxy
  fingerprint: ProfileFingerprint
}

export type BrowserProfile = ProfileDraft & {
  id: string
  createdAt: string
  updatedAt: string
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">

export function createEmptyProfileDraft(): ProfileDraft {
  return {
    name: "",
    group: "Default",
    tags: [],
    notes: "",
    browserEngine: "Chromium",
    browserVersion: "stable",
    proxy: {
      type: "http",
      host: "",
      port: "",
      username: "",
      password: "",
    },
    fingerprint: {
      timezone: "UTC",
      locale: "en-US",
      userAgent: "",
      webrtcPolicy: "proxy-only",
      geolocationPolicy: "prompt",
      screen: "1920x1080",
      memory: "8",
      hardwareConcurrency: "8",
    },
  }
}

export function createProfileFromDraft(draft: ProfileDraft): BrowserProfile {
  const timestamp = new Date().toISOString()

  return {
    ...draft,
    id: createProfileId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function toProfileDraft(profile: BrowserProfile): ProfileDraft {
  return {
    name: profile.name,
    group: profile.group,
    tags: profile.tags,
    notes: profile.notes,
    browserEngine: profile.browserEngine,
    browserVersion: profile.browserVersion,
    proxy: { ...profile.proxy },
    fingerprint: { ...profile.fingerprint },
  }
}

export function updateProfileFromDraft(
  profile: BrowserProfile,
  draft: ProfileDraft,
): BrowserProfile {
  return {
    ...profile,
    ...draft,
    updatedAt: new Date().toISOString(),
  }
}

export function duplicateProfile(profile: BrowserProfile): BrowserProfile {
  const timestamp = new Date().toISOString()

  return {
    ...profile,
    id: createProfileId(),
    name: `${profile.name} (copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function loadProfiles(
  storage: StorageLike = window.localStorage,
): BrowserProfile[] {
  const raw = storage.getItem(PROFILE_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeProfile) : []
  } catch {
    return []
  }
}

export function saveProfiles(
  profiles: BrowserProfile[],
  storage: StorageLike = window.localStorage,
) {
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `profile-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeProfile(rawProfile: BrowserProfile): BrowserProfile {
  return {
    ...rawProfile,
    proxy: {
      ...createEmptyProfileDraft().proxy,
      ...rawProfile.proxy,
    },
    fingerprint: {
      ...createEmptyProfileDraft().fingerprint,
      ...rawProfile.fingerprint,
    },
  }
}
