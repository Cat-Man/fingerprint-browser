import { describe, expect, it } from "vitest"
import { createEmptyProfileDraft, createProfileFromDraft } from "../profiles"
import {
  RUNTIME_STORAGE_KEY,
  loadRuntimeInstances,
  refreshProfileRuntimeHealth,
  restartProfileInstance,
  saveRuntimeInstances,
  startProfileInstance,
  stopProfileInstance,
  summarizeRuntime,
} from "./manager"

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

function makeProfile(name: string) {
  return createProfileFromDraft({
    ...createEmptyProfileDraft(),
    name,
  })
}

describe("runtime manager", () => {
  it("allocates incremental ports and rejects duplicate starts for the same profile", () => {
    const profileA = makeProfile("Profile A")
    const profileB = makeProfile("Profile B")
    const first = startProfileInstance([], profileA)
    const second = startProfileInstance(first.instances, profileB)

    expect(first.instance.debugPort).toBe(9222)
    expect(first.instance.health.status).toBe("healthy")
    expect(first.instance.health.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(second.instance.debugPort).toBe(9223)
    expect(() => startProfileInstance(second.instances, profileA)).toThrow(/already running/i)
  })

  it("stops, restarts, summarizes, and persists runtime instances", () => {
    const profileA = makeProfile("Profile A")
    const started = startProfileInstance([], profileA)
    const stopped = stopProfileInstance(started.instances, profileA.id)
    const restarted = restartProfileInstance(stopped.instances, profileA)
    const storage = createMemoryStorage()

    saveRuntimeInstances(restarted.instances, storage)

    expect(stopped.instance.status).toBe("stopped")
    expect(stopped.instance.wsEndpoint).toBe("")
    expect(restarted.instance.status).toBe("running")
    expect(restarted.instance.debugPort).toBe(9222)
    expect(summarizeRuntime(restarted.instances).runningCount).toBe(1)
    expect(loadRuntimeInstances(storage)).toHaveLength(1)
    expect(storage.getItem(RUNTIME_STORAGE_KEY)).toContain("Profile A")
  })

  it("refreshes runtime health without changing the running port or discarding logs", async () => {
    const profileA = makeProfile("Profile A")
    const started = startProfileInstance([], profileA)

    const refreshed = await refreshProfileRuntimeHealth(started.instances, profileA.id, {
      isTauri: () => false,
      launch: async () => {
        throw new Error("not used")
      },
      restart: async () => {
        throw new Error("not used")
      },
      stop: async () => {
        throw new Error("not used")
      },
      refreshHealth: async () => {
        throw new Error("web preview should not call native refresh")
      },
    })

    expect(refreshed.instance.debugPort).toBe(started.instance.debugPort)
    expect(refreshed.instance.logs).toHaveLength(started.instance.logs.length)
    expect(refreshed.instance.health).toMatchObject({
      status: "healthy",
      message: "Web preview runtime does not expose native health probes",
    })
    expect(refreshed.instance.health.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
