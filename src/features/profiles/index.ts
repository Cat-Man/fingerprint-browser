export const profileModelItems = [
  "Display name and tags",
  "Browser engine and runtime version",
  "Proxy, locale, timezone, and screen presets",
]

export const profileNextStep =
  "Profiles in this MVP persist in local storage today and can later move behind a Tauri-backed JSON or SQLite store."

export {
  PROFILE_STORAGE_KEY,
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
