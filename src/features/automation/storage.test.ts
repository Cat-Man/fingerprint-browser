import { describe, expect, it } from "vitest"
import {
  REGRESSION_STORAGE_KEY,
  createRegressionRun,
  diffRegressionRuns,
  getDetectionTarget,
  getLatestRegressionDiff,
  loadRegressionRuns,
  saveRegressionRuns,
  summarizeRegressionRuns,
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

describe("automation storage", () => {
  it("returns an empty list when the stored payload is invalid", () => {
    const storage = createMemoryStorage({
      [REGRESSION_STORAGE_KEY]: "{bad json",
    })

    expect(loadRegressionRuns(storage)).toEqual([])
  })

  it("stores manual regression runs and reports field-level diffs", () => {
    const storage = createMemoryStorage()
    const first = createRegressionRun({
      profileId: "profile-a",
      profileName: "Profile A",
      targetId: "creepjs",
      observed: {
        userAgent: "Chrome 136",
        timezone: "UTC",
        webrtc: "proxy-only",
      },
    })
    const second = createRegressionRun({
      profileId: "profile-a",
      profileName: "Profile A",
      targetId: "creepjs",
      observed: {
        userAgent: "Chrome 136",
        timezone: "Asia/Shanghai",
        webrtc: "disabled",
      },
    })

    saveRegressionRuns([first, second], storage)

    const runs = loadRegressionRuns(storage)
    const diff = diffRegressionRuns(runs[0], runs[1])

    expect(diff.changedFields).toEqual(["timezone", "webrtc"])
    expect(getDetectionTarget("browserleaks")?.name).toMatch(/browserleaks/i)
  })

  it("summarizes stored coverage and exposes the latest diff for a profile/target pair", () => {
    const runs = [
      createRegressionRun({
        profileId: "profile-a",
        profileName: "Profile A",
        targetId: "creepjs",
        observed: { timezone: "UTC" },
      }),
      createRegressionRun({
        profileId: "profile-a",
        profileName: "Profile A",
        targetId: "creepjs",
        observed: { timezone: "Europe/London" },
      }),
      createRegressionRun({
        profileId: "profile-b",
        profileName: "Profile B",
        targetId: "browserleaks",
      }),
    ]

    const summary = summarizeRegressionRuns(runs)
    const latestDiff = getLatestRegressionDiff(runs, "profile-a", "creepjs")

    expect(summary.totalRuns).toBe(3)
    expect(summary.profilesCovered).toBe(2)
    expect(summary.targetsCovered).toBe(2)
    expect(latestDiff?.changedFields).toEqual(["timezone"])
  })
})
