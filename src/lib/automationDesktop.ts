import { invoke, isTauri } from "@tauri-apps/api/core"
import type {
  DetectionTargetId,
  RegressionObservedValues,
} from "../features/automation/storage"

export type DetectionProbeRequest = {
  profileId: string
  targetId: DetectionTargetId
  targetUrl: string
  wsEndpoint: string
}

export type DetectionProbeResult = {
  observed: RegressionObservedValues
  capturedAt: string
  targetUrl: string
}

type DesktopAutomationInvoker = {
  isTauri: () => boolean
  invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>
}

export type DesktopAutomationBridge = {
  isTauri: () => boolean
  runProbe: (request: DetectionProbeRequest) => Promise<DetectionProbeResult>
}

const defaultInvoker: DesktopAutomationInvoker = {
  isTauri,
  invoke: (command, payload) => invoke(command, payload),
}

export function createDesktopAutomationBridge(
  invoker: DesktopAutomationInvoker = defaultInvoker,
): DesktopAutomationBridge {
  return {
    isTauri: invoker.isTauri,
    runProbe: (request) =>
      invoker.invoke<DetectionProbeResult>("run_detection_probe", {
        request,
      }),
  }
}

export const desktopAutomationBridge = createDesktopAutomationBridge()
