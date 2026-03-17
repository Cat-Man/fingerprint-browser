import type { MessageKey } from "../i18n"

export const runtimeDefaults = [
  "settings.runtimeDefaults.proxyPolicy",
  "settings.runtimeDefaults.debugPortRange",
  "settings.runtimeDefaults.launchSafetyChecks",
] as const satisfies readonly MessageKey[]

export const runtimeDiagnostics = [
  "settings.diagnostics.structuredLogs",
  "settings.diagnostics.healthChecks",
  "settings.diagnostics.adapterStatus",
] as const satisfies readonly MessageKey[]

export {
  buildFingerprintConfig,
  chromiumRuntimeAdapter,
  resolveRuntimeAdapter,
  type FingerprintConfig,
  type RuntimeAdapter,
  type RuntimeLaunchPlan,
  type RuntimeLaunchRequest,
} from "./adapter"

export {
  RUNTIME_STORAGE_KEY,
  findRuntimeInstance,
  loadRuntimeInstances,
  restartProfileRuntime,
  restartProfileInstance,
  saveRuntimeInstances,
  startProfileRuntime,
  startProfileInstance,
  stopProfileRuntime,
  stopProfileInstance,
  summarizeRuntime,
  type BrowserInstance,
  type RuntimeLogEntry,
} from "./manager"
