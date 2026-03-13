import { describe, expect, it } from "vitest"
import {
  PROFILE_STORAGE_KEY,
  createEmptyProfileDraft,
  duplicateProfile,
  loadProfiles,
  saveProfiles,
} from "./storage"

function createMemoryStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(seed))

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    },
  }
}

describe("profile storage", () => {
  it("returns an empty list when storage payload is invalid", () => {
    const storage = createMemoryStorage({
      [PROFILE_STORAGE_KEY]: "{bad json",
    })

    expect(loadProfiles(storage)).toEqual([])
  })

  it("saves, loads, and duplicates profiles with independent ids", () => {
    const storage = createMemoryStorage()
    const original = {
      ...createEmptyProfileDraft(),
      id: "profile-1",
      name: "Shop A",
      group: "Retail",
      tags: ["checkout"],
      proxy: {
        type: "http" as const,
        host: "127.0.0.1",
        port: "8899",
        username: "",
        password: "",
      },
      fingerprint: {
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        userAgent: "",
        webrtcPolicy: "proxy-only" as const,
        geolocationPolicy: "prompt" as const,
        screen: "1920x1080",
        memory: "8",
        hardwareConcurrency: "8",
      },
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z",
    }

    saveProfiles([original], storage)
    const copy = duplicateProfile(original)

    expect(loadProfiles(storage)).toEqual([original])
    expect(copy.id).not.toBe(original.id)
    expect(copy.name).toBe("Shop A (copy)")
    expect(copy.proxy).toEqual(original.proxy)
  })

  it("hydrates legacy profiles with runtime fingerprint defaults", () => {
    const storage = createMemoryStorage({
      [PROFILE_STORAGE_KEY]: JSON.stringify([
        {
          id: "profile-legacy",
          name: "Legacy profile",
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
            geolocationPolicy: "prompt",
            screen: "1920x1080",
            memory: "8",
            hardwareConcurrency: "8",
          },
          createdAt: "2026-03-12T00:00:00.000Z",
          updatedAt: "2026-03-12T00:00:00.000Z",
        },
      ]),
    })

    const loadedFingerprint = loadProfiles(storage)[0].fingerprint as Record<string, string>

    expect(loadedFingerprint.webrtcPolicy).toBe("proxy-only")
    expect(loadedFingerprint.userAgent).toBe("")
  })
})
