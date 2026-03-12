import type { BrowserProfile } from "../profiles"

export const RUNTIME_STORAGE_KEY = "fingerprint-browser.runtime.v1"
const DEFAULT_DEBUG_PORT = 9222

export type RuntimeStatus = "running" | "stopped"

export type RuntimeLogEntry = {
  at: string
  level: "info" | "error"
  message: string
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
    logs: appendLog(existing.logs, timestamp, "Stopped instance and released profile lock"),
  }

  return {
    instance: stoppedInstance,
    instances: upsertInstance(instances, stoppedInstance),
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
    logs: appendLog(existing.logs, timestamp, `Restarted instance on port ${existing.debugPort}`),
  }

  return {
    instance: restartedInstance,
    instances: upsertInstance(instances, restartedInstance),
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
    logs: appendLog(previousLogs, timestamp, `Started instance on port ${debugPort}`),
  }
}

function upsertInstance(instances: BrowserInstance[], nextInstance: BrowserInstance) {
  const remaining = instances.filter((instance) => instance.profileId !== nextInstance.profileId)
  return [...remaining, nextInstance]
}

function buildWsEndpoint(debugPort: number, profileId: string) {
  return `ws://127.0.0.1:${debugPort}/devtools/browser/${profileId}`
}

function appendLog(logs: RuntimeLogEntry[], at: string, message: string): RuntimeLogEntry[] {
  return [...logs, { at, level: "info", message }]
}
