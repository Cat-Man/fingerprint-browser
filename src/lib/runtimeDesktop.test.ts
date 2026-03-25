import { describe, expect, it } from "vitest"
import { createEmptyProfileDraft, createProfileFromDraft } from "../features/profiles"
import {
  refreshProfileRuntimeHealth,
  restartProfileRuntime,
  startProfileRuntime,
  stopProfileRuntime,
} from "../features/runtime"
import { createDesktopRuntimeBridge } from "./runtimeDesktop"

describe("desktop runtime bridge", () => {
  it("launches through the native desktop bridge in tauri mode and falls back to session mode on web preview", async () => {
    const profile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })
    const bridge = createDesktopRuntimeBridge({
      isTauri: () => true,
      invoke: async (_command, payload) => ({
        id: payload?.request?.profileId as string,
        profileId: payload?.request?.profileId as string,
        profileName: payload?.request?.profileName as string,
        status: "running" as const,
        debugPort: 9333,
        wsEndpoint: "ws://127.0.0.1:9333/devtools/browser/native",
        startedAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:00:00.000Z",
        processId: 123,
        lastError: null,
        logs: [],
        health: {
          status: "healthy",
          checkedAt: "2026-03-13T00:00:00.000Z",
          message: "Native runtime is reachable",
        },
      }),
    })

    const nativeResult = await startProfileRuntime([], profile, bridge)
    const fallbackResult = await startProfileRuntime(
      [],
      profile,
      createDesktopRuntimeBridge({
        isTauri: () => false,
        invoke: async () => {
          throw new Error("web preview should not invoke native runtime")
        },
      }),
    )

    expect(nativeResult.instance.debugPort).toBe(9333)
    expect(nativeResult.instance.wsEndpoint).toContain("/devtools/browser/native")
    expect(nativeResult.instance.processId).toBe(123)
    expect(fallbackResult.instance.debugPort).toBe(9222)
  })

  it("restarts and stops through the native desktop bridge in tauri mode", async () => {
    const profile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })
    const bridge = createDesktopRuntimeBridge({
      isTauri: () => true,
      invoke: async (command, payload) => ({
        id: payload?.request?.profileId ?? payload?.request?.profileName ?? profile.id,
        profileId: profile.id,
        profileName: profile.name,
        status: command === "stop_runtime" ? ("stopped" as const) : ("running" as const),
        debugPort: 9444,
        wsEndpoint:
          command === "stop_runtime"
            ? ""
            : "ws://127.0.0.1:9444/devtools/browser/restarted",
        startedAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:05:00.000Z",
        processId: command === "stop_runtime" ? undefined : 456,
        lastError: null,
        logs: [],
        health: {
          status: command === "stop_runtime" ? "stopped" : "healthy",
          checkedAt: "2026-03-13T00:05:00.000Z",
          message:
            command === "stop_runtime"
              ? "Runtime is stopped"
              : "Native runtime is reachable",
        },
      }),
    })

    const started = await startProfileRuntime([], profile, bridge)
    const restarted = await restartProfileRuntime(started.instances, profile, bridge)
    const stopped = await stopProfileRuntime(restarted.instances, profile.id, bridge)

    expect(restarted.instance.debugPort).toBe(9444)
    expect(restarted.instance.processId).toBe(456)
    expect(stopped.instance.status).toBe("stopped")
    expect(stopped.instance.wsEndpoint).toBe("")
  })

  it("refreshes runtime health through the desktop bridge in tauri mode", async () => {
    const profile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })
    const bridge = createDesktopRuntimeBridge({
      isTauri: () => true,
      invoke: async (command, payload) => ({
        id: payload?.request?.profileId ?? profile.id,
        profileId: profile.id,
        profileName: profile.name,
        status: "running" as const,
        debugPort: 9444,
        wsEndpoint: "ws://127.0.0.1:9444/devtools/browser/restarted",
        startedAt: "2026-03-13T00:00:00.000Z",
        updatedAt: "2026-03-13T00:05:00.000Z",
        processId: 456,
        lastError: null,
        logs: [],
        health: {
          status: command === "refresh_runtime_health" ? "degraded" : "healthy",
          checkedAt: "2026-03-13T00:06:00.000Z",
          message:
            command === "refresh_runtime_health"
              ? "CDP endpoint is unreachable"
              : "Native runtime is reachable",
        },
      }),
    })

    const started = await startProfileRuntime([], profile, bridge)
    const refreshed = await refreshProfileRuntimeHealth(
      started.instances,
      profile.id,
      bridge,
    )

    expect(refreshed.instance.health.status).toBe("degraded")
    expect(refreshed.instance.health.message).toMatch(/unreachable/i)
  })
})
