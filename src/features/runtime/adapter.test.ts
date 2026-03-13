import { describe, expect, it } from "vitest"
import { createEmptyProfileDraft, createProfileFromDraft } from "../profiles"
import { chromiumRuntimeAdapter, resolveRuntimeAdapter } from "./adapter"

function makeProfile() {
  return createProfileFromDraft({
    ...createEmptyProfileDraft(),
    name: "Profile A",
    proxy: {
      type: "http",
      host: "127.0.0.1",
      port: "8899",
      username: "",
      password: "",
    },
    fingerprint: {
      ...createEmptyProfileDraft().fingerprint,
      locale: "en-US",
      timezone: "America/New_York",
      screen: "1440x900",
      memory: "16",
      hardwareConcurrency: "12",
      webrtcPolicy: "proxy-only",
    },
  })
}

describe("chromium runtime adapter", () => {
  it("builds a chromium launch plan from a profile and running port", () => {
    const profile = makeProfile()

    const plan = chromiumRuntimeAdapter.prepareLaunch({
      profile,
      debugPort: 9222,
    })

    expect(plan.adapterId).toBe("chromium")
    expect(plan.browserEngine).toBe("Chromium")
    expect(plan.fingerprint.language).toBe("en-US")
    expect(plan.fingerprint.timezone).toBe("America/New_York")
    expect(plan.fingerprint.resolution).toEqual({ width: 1440, height: 900 })
    expect(plan.fingerprint.memory).toBe(16)
    expect(plan.fingerprint.hardwareConcurrency).toBe(12)
    expect(plan.launchArgs).toContain("--remote-debugging-port=9222")
    expect(plan.launchArgs).toContain("--window-size=1440,900")
    expect(plan.launchArgs).toContain("--lang=en-US")
    expect(plan.launchArgs).toContain("--proxy-server=http://127.0.0.1:8899")
    expect(plan.launchArgs).toContain(
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    )
    expect(plan.metadata.wsPathHint).toBe(`/devtools/browser/${profile.id}`)
  })

  it("uses browserVersion to derive the chromium user agent and preserves authenticated proxy metadata", () => {
    const profile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Beta profile",
      browserVersion: "beta",
      proxy: {
        type: "socks5",
        host: "proxy.example.com",
        port: "1080",
        username: "bot",
        password: "secret",
      },
    })

    const plan = chromiumRuntimeAdapter.prepareLaunch({
      profile,
      debugPort: 9333,
    })

    expect(plan.fingerprint.userAgent).toContain("Chrome/137.0.0.0")
    expect(plan.metadata.proxy).toEqual({
      server: "socks5://proxy.example.com:1080",
      username: "bot",
      password: "secret",
    })
  })

  it("resolves adapters only for supported engines", () => {
    const chromiumProfile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Chromium profile",
      browserEngine: "Chromium",
    })
    const firefoxProfile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Firefox profile",
      browserEngine: "Firefox",
    })

    expect(resolveRuntimeAdapter(chromiumProfile)).toBe(chromiumRuntimeAdapter)
    expect(resolveRuntimeAdapter(firefoxProfile)).toBeNull()
  })
})
