import { invoke, isTauri } from "@tauri-apps/api/core"
import type { BrowserProfile } from "../features/profiles"
import type { RuntimeLaunchPlan } from "../features/runtime/adapter"
import type { BrowserInstance } from "../features/runtime/manager"

export type NativeRuntimeLaunchRequest = {
  profileId: string
  profileName: string
  browserEngine: string
  debugPort: number
  launchPlan: RuntimeLaunchPlan
}

export type NativeRuntimeStopRequest = {
  profileId: string
}

export type NativeRuntimeHealthRequest = {
  profileId: string
}

type DesktopInvoker = {
  isTauri: () => boolean
  invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>
}

export type DesktopRuntimeBridge = {
  isTauri: () => boolean
  launch: (request: NativeRuntimeLaunchRequest) => Promise<BrowserInstance>
  restart: (request: NativeRuntimeLaunchRequest) => Promise<BrowserInstance>
  stop: (request: NativeRuntimeStopRequest) => Promise<BrowserInstance>
  refreshHealth?: (request: NativeRuntimeHealthRequest) => Promise<BrowserInstance>
}

const defaultInvoker: DesktopInvoker = {
  isTauri,
  invoke: (command, payload) => invoke(command, payload),
}

export function createDesktopRuntimeBridge(
  invoker: DesktopInvoker = defaultInvoker,
): DesktopRuntimeBridge {
  return {
    isTauri: invoker.isTauri,
    launch: (request) =>
      invoker.invoke<BrowserInstance>("launch_runtime", {
        request,
      }),
    restart: (request) =>
      invoker.invoke<BrowserInstance>("restart_runtime", {
        request,
      }),
    stop: (request) =>
      invoker.invoke<BrowserInstance>("stop_runtime", {
        request,
      }),
    refreshHealth: (request) =>
      invoker.invoke<BrowserInstance>("refresh_runtime_health", {
        request,
      }),
  }
}

export const desktopRuntimeBridge = createDesktopRuntimeBridge()

export function createNativeRuntimeLaunchRequest(
  profile: BrowserProfile,
  launchPlan: RuntimeLaunchPlan,
  debugPort: number,
): NativeRuntimeLaunchRequest {
  return {
    profileId: profile.id,
    profileName: profile.name,
    browserEngine: profile.browserEngine,
    debugPort,
    launchPlan,
  }
}
