import { describe, expect, it } from "vitest"
import { createEmptyObservedValues } from "./storage"
import { summarizeDetectionArtifacts } from "./summary"

describe("automation summary", () => {
  it("builds a readable CreepJS summary from the captured page text", () => {
    const summary = summarizeDetectionArtifacts({
      targetId: "creepjs",
      observed: createEmptyObservedValues(),
      artifacts: [
        {
          id: "creepjs-main",
          url: "https://abrahamjuliot.github.io/creepjs/",
          text: [
            "FP ID: abc123",
            "Fuzzy: fuzzy456",
            "Headless3778dd39",
            "31% like headless: 7a8c",
            "33% headless: a427",
            "0% stealth: 0c01",
            "Worker074bd9c1",
            "confidence: high",
            "gpu:",
            "Google Inc. (Apple)",
          ].join("\n"),
        },
      ],
    })

    expect(summary).toMatchObject({
      headline: "31% like headless · 33% headless · 0% stealth",
      items: expect.arrayContaining([
        {
          label: "automation.summary.creepjs.fpId",
          value: "abc123",
        },
        {
          label: "automation.summary.creepjs.workerConfidence",
          value: "high",
        },
      ]),
    })
  })

  it("builds a BrowserLeaks summary from multiple target pages", () => {
    const summary = summarizeDetectionArtifacts({
      targetId: "browserleaks",
      observed: createEmptyObservedValues(),
      artifacts: [
        {
          id: "javascript",
          url: "https://browserleaks.com/javascript",
          text: [
            "userAgent\tMozilla/5.0",
            "language\tzh-CN",
            "webdriver\ttrue",
          ].join("\n"),
        },
        {
          id: "webrtc",
          url: "https://browserleaks.com/webrtc",
          text: [
            "WebRTC Leak Test\t✔",
            "No Local IP Leak",
            "Public IP Address\t134.195.101.220",
          ].join("\n"),
        },
        {
          id: "canvas",
          url: "https://browserleaks.com/canvas",
          text: ["Signature\tABCDEF", "Uniqueness\t99.96%"].join("\n"),
        },
        {
          id: "webgl",
          url: "https://browserleaks.com/webgl",
          text: [
            "WebGL Report Hash\tHASH123",
            "Unmasked Renderer\tANGLE Renderer",
          ].join("\n"),
        },
        {
          id: "rects",
          url: "https://browserleaks.com/rects",
          text: "Full Hash\tRECTS123",
        },
      ],
    })

    expect(summary).toMatchObject({
      headline: "No Local IP Leak · webdriver true",
      items: expect.arrayContaining([
        {
          label: "automation.summary.browserleaks.webrtcLeak",
          value: "No Local IP Leak",
        },
        {
          label: "automation.summary.browserleaks.canvasSignature",
          value: "ABCDEF",
        },
      ]),
    })
  })

  it("returns null when no usable artifacts are available", () => {
    const summary = summarizeDetectionArtifacts({
      targetId: "browserleaks",
      observed: createEmptyObservedValues(),
      artifacts: [],
    })

    expect(summary).toBeNull()
  })
})
