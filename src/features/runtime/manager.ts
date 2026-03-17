import type { BrowserProfile } from "../profiles"
import {
  createNativeRuntimeLaunchRequest,
  desktopRuntimeBridge,
  type DesktopRuntimeBridge,
} from "../../lib/runtimeDesktop"
import { resolveRuntimeAdapter } from "./adapter"

export const RUNTIME_STORAGE_KEY = "fingerprint-browser.runtime.v1"
const DEFAULT_DEBUG_PORT = 9222

export type RuntimeStatus = "running" | "stopped"
export type RuntimeLogMessageKey =
  | "runtime.log.started"
  | "runtime.log.restarted"
  | "runtime.log.stopped"

export type RuntimeLogEntry = {
  at: string
  level: "info" | "error"
  message: string
  messageKey?: RuntimeLogMessageKey
  params?: Record<string, string | number>
}

export type BrowserInstance = {
  id: string
  profileId: string
  profileName: string
  status: RuntimeStatus
  debugPort: number
  wsEndpoint: string
  startedAt: string
  updatedAt: string
  processId?: number
  lastError: string | null
  logs: RuntimeLogEntry[]
}

export type RuntimeStorageLike = Pick<Storage, "getItem" | "setItem">

export function loadRuntimeInstances(
  storage: RuntimeStorageLike = window.sessionStorage,
): BrowserInstance[] {
  const raw = storage.getItem(RUNTIME_STORAGE_KEY)

  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRuntimeInstances(
  instances: BrowserInstance[],
  storage: RuntimeStorageLike = window.sessionStorage,
) {
  storage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(instances))
}

export function summarizeRuntime(instances: BrowserInstance[]) {
  return {
    runningCount: instances.filter((instance) => instance.status === "running").length,
    stoppedCount: instances.filter((instance) => instance.status === "stopped").length,
  }
}

export function startProfileInstance(
  instances: BrowserInstance[],
  profile: BrowserProfile,
) {
  const existing = findRuntimeInstance(instances, profile.id)

  if (existing?.status === "running") {
    throw new Error(`Profile ${profile.name} is already running`)
  }

  const debugPort = allocateDebugPort(instances, profile.id)
  const nextInstance = createRunningInstance(profile, debugPort, existing?.logs ?? [])

  return {
    instance: nextInstance,
    instances: upsertInstance(instances, nextInstance),
  }
}

export async function startProfileRuntime(
  instances: BrowserInstance[],
  profile: BrowserProfile,
  runtimeBridge: DesktopRuntimeBridge = desktopRuntimeBridge,
) {
  if (!runtimeBridge.isTauri()) {
    return startProfileInstance(instances, profile)
  }

  const adapter = resolveRuntimeAdapter(profile)

  if (!adapter) {
    throw new Error(`No runtime adapter available for ${profile.browserEngine}`)
  }

  const draft = startProfileInstance(instances, profile)
  const nativeInstance = await runtimeBridge.launch(
    createNativeRuntimeLaunchRequest(
      profile,
      adapter.prepareLaunch({
        profile,
        debugPort: draft.instance.debugPort,
      }),
      draft.instance.debugPort,
    ),
  )
  const nextInstance = mergeRuntimeInstance(nativeInstance, draft.instance)

  return {
    instance: nextInstance,
    instances: upsertInstance(instances, nextInstance),
  }
}

export function stopProfileInstance(instances: BrowserInstance[], profileId: string) {
  const existing = findRuntimeInstance(instances, profileId)

  if (!existing) {
    throw new Error(`Profile ${profileId} does not have a runtime instance`)
  }

  const timestamp = new Date().toISOString()
  const stoppedInstance: BrowserInstance = {
    ...existing,
    status: "stopped",
    wsEndpoint: "",
    updatedAt: timestamp,
    logs: appendLog(existing.logs, timestamp, "runtime.log.stopped"),
  }

  return {
    instance: stoppedInstance,
    instances: upsertInstance(instances, stoppedInstance),
  }
}

export async function stopProfileRuntime(
  instances: BrowserInstance[],
  profileId: string,
  runtimeBridge: DesktopRuntimeBridge = desktopRuntimeBridge,
) {
  if (!runtimeBridge.isTauri()) {
    return stopProfileInstance(instances, profileId)
  }

  const existing = findRuntimeInstance(instances, profileId)

  if (!existing) {
    throw new Error(`Profile ${profileId} does not have a runtime instance`)
  }

  const draft = stopProfileInstance(instances, profileId)
  const nativeInstance = await runtimeBridge.stop({ profileId })
  const nextInstance = mergeRuntimeInstance(nativeInstance, draft.instance)

  return {
    instance: nextInstance,
    instances: upsertInstance(instances, nextInstance),
  }
}

export function restartProfileInstance(
  instances: BrowserInstance[],
  profile: BrowserProfile,
) {
  const existing = findRuntimeInstance(instances, profile.id)

  if (!existing || existing.status === "stopped") {
    return startProfileInstance(instances, profile)
  }

  const timestamp = new Date().toISOString()
  const restartedInstance: BrowserInstance = {
    ...existing,
    profileName: profile.name,
    updatedAt: timestamp,
    wsEndpoint: buildWsEndpoint(existing.debugPort, profile.id),
    logs: appendLog(existing.logs, timestamp, "runtime.log.restarted", {
      port: existing.debugPort,
    }),
  }

  return {
    instance: restartedInstance,
    instances: upsertInstance(instances, restartedInstance),
  }
}

export async function restartProfileRuntime(
  instances: BrowserInstance[],
  profile: BrowserProfile,
  runtimeBridge: DesktopRuntimeBridge = desktopRuntimeBridge,
) {
  if (!runtimeBridge.isTauri()) {
    return restartProfileInstance(instances, profile)
  }

  const existing = findRuntimeInstance(instances, profile.id)
  const adapter = resolveRuntimeAdapter(profile)

  if (!adapter) {
    throw new Error(`No runtime adapter available for ${profile.browserEngine}`)
  }

  if (!existing || existing.status === "stopped") {
    return startProfileRuntime(instances, profile, runtimeBridge)
  }

  const draft = restartProfileInstance(instances, profile)
  const nativeInstance = await runtimeBridge.restart(
    createNativeRuntimeLaunchRequest(
      profile,
      adapter.prepareLaunch({
        profile,
        debugPort: existing.debugPort,
      }),
      existing.debugPort,
    ),
  )
  const nextInstance = mergeRuntimeInstance(nativeInstance, draft.instance)

  return {
    instance: nextInstance,
    instances: upsertInstance(instances, nextInstance),
  }
}

export function findRuntimeInstance(instances: BrowserInstance[], profileId: string) {
  return instances.find((instance) => instance.profileId === profileId)
}

function allocateDebugPort(instances: BrowserInstance[], profileId: string) {
  const occupiedPorts = new Set(
    instances
      .filter(
        (instance) => instance.status === "running" && instance.profileId !== profileId,
      )
      .map((instance) => instance.debugPort),
  )

  let debugPort = DEFAULT_DEBUG_PORT

  while (occupiedPorts.has(debugPort)) {
    debugPort += 1
  }

  return debugPort
}

function createRunningInstance(
  profile: BrowserProfile,
  debugPort: number,
  previousLogs: RuntimeLogEntry[],
): BrowserInstance {
  const timestamp = new Date().toISOString()

  return {
    id: profile.id,
    profileId: profile.id,
    profileName: profile.name,
    status: "running",
    debugPort,
    wsEndpoint: buildWsEndpoint(debugPort, profile.id),
    startedAt: timestamp,
    updatedAt: timestamp,
    lastError: null,
    logs: appendLog(previousLogs, timestamp, "runtime.log.started", {
      port: debugPort,
    }),
  }
}

function mergeRuntimeInstance(
  nextInstance: BrowserInstance,
  fallbackInstance: BrowserInstance,
): BrowserInstance {
  return {
    ...fallbackInstance,
    ...nextInstance,
    logs: nextInstance.logs.length > 0 ? nextInstance.logs : fallbackInstance.logs,
  }
}

function upsertInstance(instances: BrowserInstance[], nextInstance: BrowserInstance) {
  const remaining = instances.filter((instance) => instance.profileId !== nextInstance.profileId)
  return [...remaining, nextInstance]
}

function buildWsEndpoint(debugPort: number, profileId: string) {
  return `ws://127.0.0.1:${debugPort}/devtools/browser/${profileId}`
}

function appendLog(
  logs: RuntimeLogEntry[],
  at: string,
  messageKey: RuntimeLogMessageKey,
  params?: Record<string, string | number>,
): RuntimeLogEntry[] {
  const message =
    messageKey === "runtime.log.started"
      ? `Started instance on port ${params?.port ?? ""}`
      : messageKey === "runtime.log.restarted"
        ? `Restarted instance on port ${params?.port ?? ""}`
        : "Stopped instance and released profile lock"

  return [...logs, { at, level: "info", message, messageKey, params }]
}
