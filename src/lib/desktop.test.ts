import { describe, expect, it } from "vitest"
import { loadDesktopOverview } from "./desktop"

describe("loadDesktopOverview", () => {
  it("returns a web preview fallback when Tauri is unavailable", async () => {
    await expect(
      loadDesktopOverview({
        isTauri: () => false,
        invoke: async () => {
          throw new Error("should not invoke")
        },
      }),
    ).resolves.toMatchObject({
      source: "web-preview",
      runtime: "browser",
    })
  })

  it("uses the Rust command bridge when Tauri is available", async () => {
    await expect(
      loadDesktopOverview({
        isTauri: () => true,
        invoke: async (command) => ({
          appName: "fingerprint-browser",
          runtime: command,
          source: "tauri",
          profilesReady: true,
        }),
      }),
    ).resolves.toEqual({
      appName: "fingerprint-browser",
      runtime: "get_app_overview",
      source: "tauri",
      profilesReady: true,
    })
  })
})
