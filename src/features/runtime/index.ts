export const runtimeDefaults = [
  "Default proxy policy",
  "Debug port allocation range",
  "Launch safety checks for each instance",
]

export const runtimeDiagnostics = [
  "Structured logs",
  "Environment health checks",
  "Browser runtime adapter status",
]

export {
  RUNTIME_STORAGE_KEY,
  findRuntimeInstance,
  loadRuntimeInstances,
  restartProfileInstance,
  saveRuntimeInstances,
  startProfileInstance,
  stopProfileInstance,
  summarizeRuntime,
  type BrowserInstance,
  type RuntimeLogEntry,
} from "./manager"
