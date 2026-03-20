import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { I18nProvider } from "../i18n"
import { createEmptyProfileDraft, createProfileFromDraft, saveProfiles } from "../profiles"
import { saveRuntimeInstances } from "../runtime"
import { AutomationPage } from "./AutomationPage"
import { createRegressionRun, saveRegressionRuns } from "./storage"

describe("AutomationPage", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("records a CreepJS run for a selected profile and shows checklist plus diff summary", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])
    saveRegressionRuns([
      createRegressionRun({
        profileId: profileA.id,
        profileName: profileA.name,
        targetId: "creepjs",
        observed: {
          timezone: "UTC",
          webrtc: "proxy-only",
        },
      }),
    ])

    render(<AutomationPage />)

    expect(screen.getByText(/step 1: launch the selected profile/i)).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/timezone/i))
    await user.type(screen.getByLabelText(/timezone/i), "Asia/Shanghai")
    await user.click(screen.getByRole("button", { name: /save regression run/i }))

    expect(screen.getByText(/timezone changed:/i)).toBeInTheDocument()
    expect(screen.getByText(/saved regression run for profile a on creepjs/i)).toBeInTheDocument()
  })

  it("supports switching profiles and targets before saving a run", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })
    const profileB = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile B",
      fingerprint: {
        ...createEmptyProfileDraft().fingerprint,
        timezone: "Europe/London",
      },
    })

    saveProfiles([profileA, profileB])

    render(<AutomationPage />)

    await user.selectOptions(screen.getByLabelText(/^profile$/i), profileB.id)
    await user.selectOptions(screen.getByLabelText(/^target$/i), "browserleaks")
    await user.click(screen.getByRole("button", { name: /save regression run/i }))

    expect(screen.getByRole("heading", { name: /browserleaks/i })).toBeInTheDocument()
    expect(screen.getByText(/saved regression run for profile b on browserleaks/i)).toBeInTheDocument()
  })

  it("auto-captures observed fields from a running profile", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])
    saveRuntimeInstances([
      {
        id: profileA.id,
        profileId: profileA.id,
        profileName: profileA.name,
        status: "running",
        debugPort: 9222,
        wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
        startedAt: "2026-03-18T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
        processId: 456,
        lastError: null,
        logs: [],
      },
    ])

    const automationBridge = {
      isTauri: () => true,
      runProbe: vi.fn().mockResolvedValue({
        observed: {
          userAgent: "Probe UA",
          language: "zh-CN",
          timezone: "Asia/Shanghai",
          webrtc: "enabled",
          canvas: "canvas-hash",
          webgl: "webgl-hash",
          audio: "audio-sum",
          clientRects: "rects-hash",
        },
        capturedAt: "2026-03-18T00:00:00.000Z",
        targetUrl: "https://example.com",
      }),
    }

    render(<AutomationPage automationBridge={automationBridge} />)

    await user.click(screen.getByRole("button", { name: /auto capture fields/i }))

    expect(automationBridge.runProbe).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText(/timezone/i)).toHaveValue("Asia/Shanghai")
    expect(screen.getByLabelText(/clientrects/i)).toHaveValue("rects-hash")
    expect(screen.getByText(/captured latest values from the running profile/i)).toBeInTheDocument()
  })

  it("renders an auto summary after capture when target artifacts are available", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])
    saveRuntimeInstances([
      {
        id: profileA.id,
        profileId: profileA.id,
        profileName: profileA.name,
        status: "running",
        debugPort: 9222,
        wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
        startedAt: "2026-03-18T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
        processId: 456,
        lastError: null,
        logs: [],
      },
    ])

    const automationBridge = {
      isTauri: () => true,
      runProbe: vi.fn().mockResolvedValue({
        observed: {
          userAgent: "Probe UA",
          language: "zh-CN",
          timezone: "Asia/Shanghai",
          webrtc: "enabled",
          canvas: "canvas-hash",
          webgl: "webgl-hash",
          audio: "audio-sum",
          clientRects: "rects-hash",
        },
        artifacts: [
          {
            id: "javascript",
            url: "https://browserleaks.com/javascript",
            text: ["userAgent\tMozilla/5.0", "language\tzh-CN", "webdriver\ttrue"].join(
              "\n",
            ),
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
        capturedAt: "2026-03-18T00:00:00.000Z",
        targetUrl: "https://browserleaks.com/",
      }),
    }

    render(<AutomationPage automationBridge={automationBridge} />)

    await user.selectOptions(screen.getByLabelText(/^target$/i), "browserleaks")
    await user.click(screen.getByRole("button", { name: /auto capture fields/i }))

    expect(screen.getByRole("heading", { name: /auto summary/i })).toBeInTheDocument()
    expect(screen.getByText("No Local IP Leak · webdriver true")).toBeInTheDocument()
    expect(screen.getByText(/canvas signature/i)).toBeInTheDocument()
    expect(screen.getByText(/ABCDEF/)).toBeInTheDocument()
  })

  it("shows a summary fallback when capture artifacts are unavailable", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])
    saveRuntimeInstances([
      {
        id: profileA.id,
        profileId: profileA.id,
        profileName: profileA.name,
        status: "running",
        debugPort: 9222,
        wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
        startedAt: "2026-03-18T00:00:00.000Z",
        updatedAt: "2026-03-18T00:00:00.000Z",
        processId: 456,
        lastError: null,
        logs: [],
      },
    ])

    const automationBridge = {
      isTauri: () => true,
      runProbe: vi.fn().mockResolvedValue({
        observed: {
          userAgent: "Probe UA",
          language: "zh-CN",
          timezone: "Asia/Shanghai",
          webrtc: "enabled",
          canvas: "canvas-hash",
          webgl: "webgl-hash",
          audio: "audio-sum",
          clientRects: "rects-hash",
        },
        artifacts: [],
        capturedAt: "2026-03-18T00:00:00.000Z",
        targetUrl: "https://example.com",
      }),
    }

    render(<AutomationPage automationBridge={automationBridge} />)

    await user.click(screen.getByRole("button", { name: /auto capture fields/i }))

    expect(screen.getByRole("heading", { name: /auto summary/i })).toBeInTheDocument()
    expect(
      screen.getByText(/auto summary is unavailable for the current target/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/timezone/i)).toHaveValue("Asia/Shanghai")
  })

  it("shows that a profile must be running before auto capture is available", () => {
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])

    render(<AutomationPage />)

    expect(
      screen.getByText(/start the selected profile first to run automated capture/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /auto capture fields/i }),
    ).toBeDisabled()
  })

  it("renders the empty state in chinese when the locale is zh-CN", () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <AutomationPage />
      </I18nProvider>,
    )

    expect(screen.getByRole("heading", { name: "检测实验室" })).toBeInTheDocument()
    expect(
      screen.getByText("暂无可用配置文件。请先创建配置文件，再进行检测记录。"),
    ).toBeInTheDocument()
  })
})
