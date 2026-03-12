import { invoke, isTauri } from "@tauri-apps/api/core"

export type DesktopOverview = {
  appName: string
  runtime: string
  source: "tauri" | "web-preview"
  profilesReady: boolean
}

type DesktopBridge = {
  isTauri: () => boolean
  invoke: (command: string) => Promise<DesktopOverview>
}

const defaultDesktopBridge: DesktopBridge = {
  isTauri,
  invoke: (command) => invoke<DesktopOverview>(command),
}

export async function loadDesktopOverview(
  bridge: DesktopBridge = defaultDesktopBridge,
): Promise<DesktopOverview> {
  if (!bridge.isTauri()) {
    return {
      appName: "fingerprint-browser",
      runtime: "browser",
      source: "web-preview",
      profilesReady: false,
    }
  }

  return bridge.invoke("get_app_overview")
}
