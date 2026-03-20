import { describe, expect, it, vi } from "vitest"
import { createDesktopAutomationBridge } from "./automationDesktop"

describe("automationDesktop", () => {
  it("invokes the desktop detection probe command with the expected payload", async () => {
    const invoke = vi.fn().mockResolvedValue({
      observed: {
        userAgent: "Probe UA",
        language: "en-US",
        timezone: "Asia/Shanghai",
        webrtc: "enabled",
        canvas: "canvas-hash",
        webgl: "webgl-hash",
        audio: "audio-sum",
        clientRects: "rects-hash",
      },
      artifacts: [
        {
          id: "creepjs-main",
          url: "https://example.com",
          text: "FP ID: abc123",
        },
      ],
      capturedAt: "2026-03-18T00:00:00.000Z",
      targetUrl: "https://example.com",
    })
    const bridge = createDesktopAutomationBridge({
      isTauri: () => true,
      invoke,
    })

    const result = await bridge.runProbe({
      profileId: "profile-a",
      targetId: "creepjs",
      targetUrl: "https://example.com",
      wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
    })

    expect(invoke).toHaveBeenCalledWith("run_detection_probe", {
      request: {
        profileId: "profile-a",
        targetId: "creepjs",
        targetUrl: "https://example.com",
        wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
      },
    })
    expect(result.artifacts).toEqual([
      {
        id: "creepjs-main",
        url: "https://example.com",
        text: "FP ID: abc123",
      },
    ])
  })
})
