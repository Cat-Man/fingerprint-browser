import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import type { DesktopRuntimeBridge } from "../../lib/runtimeDesktop"
import { I18nProvider } from "../i18n"
import {
  PROFILE_STORAGE_KEY,
  createEmptyProfileDraft,
  createProfileFromDraft,
  saveProfiles,
} from "./storage"
import { ProfilesPage } from "./ProfilesPage"

describe("ProfilesPage", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("creates a profile with independent proxy settings and persists it", async () => {
    const user = userEvent.setup()

    render(<ProfilesPage />)

    await user.type(screen.getByLabelText(/profile name/i), "Shop A")
    await user.clear(screen.getByLabelText(/group/i))
    await user.type(screen.getByLabelText(/group/i), "Retail")
    await user.type(screen.getByLabelText(/tags/i), "checkout, cn")
    await user.type(screen.getByLabelText(/proxy host/i), "127.0.0.1")
    await user.type(screen.getByLabelText(/proxy port/i), "8899")
    await user.click(screen.getByRole("button", { name: /create profile/i }))

    expect(screen.getByText("Shop A")).toBeInTheDocument()
    expect(screen.getByText("Retail")).toBeInTheDocument()
    expect(screen.getByText(/http:\/\/127\.0\.0\.1:8899/i)).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? "[]")).toHaveLength(1)
  })

  it("hydrates persisted profiles and supports edit, duplicate, and delete", async () => {
    const user = userEvent.setup()
    const seededProfile = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Seeded profile",
      group: "Operations",
      proxy: {
        type: "socks5",
        host: "seed.proxy",
        port: "9000",
        username: "bot",
        password: "secret",
      },
      fingerprint: {
        ...createEmptyProfileDraft().fingerprint,
        timezone: "Europe/London",
        locale: "en-GB",
      },
    })

    saveProfiles([seededProfile])

    render(<ProfilesPage />)

    expect(screen.getByText("Seeded profile")).toBeInTheDocument()
    expect(screen.getByText(/socks5:\/\/seed\.proxy:9000/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: /duplicate seeded profile/i }),
    )
    expect(screen.getByText("Seeded profile (copy)")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Edit Seeded profile" }))
    await user.clear(screen.getByLabelText(/proxy host/i))
    await user.type(screen.getByLabelText(/proxy host/i), "proxy.example.com")
    await user.click(screen.getByRole("button", { name: /save changes/i }))

    expect(
      screen.getByText(/socks5:\/\/proxy\.example\.com:9000/i),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: /delete seeded profile \(copy\)/i }),
    )
    expect(screen.queryByText("Seeded profile (copy)")).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? "[]")).toHaveLength(1)
  })

  it("starts a profile and shows runtime status, debug port, and Playwright endpoint", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])

    render(<ProfilesPage />)

    await user.click(screen.getByRole("button", { name: /start profile a/i }))

    expect(screen.getByText(/^running$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Debug port: 9222$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Playwright endpoint: ws:\/\/127\.0\.0\.1:9222/i),
    ).toBeInTheDocument()
  })

  it("shows the runtime adapter preview and remote debugging arg for a running profile", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])

    render(<ProfilesPage />)

    await user.click(screen.getByRole("button", { name: /start profile a/i }))

    expect(screen.getByText(/Adapter: chromium/i)).toBeInTheDocument()
    expect(screen.getByText("--remote-debugging-port=9222")).toBeInTheDocument()
    expect(screen.getByText("--window-size=1920,1080")).toBeInTheDocument()
    expect(
      screen.getByText("--force-webrtc-ip-handling-policy=disable_non_proxied_udp"),
    ).toBeInTheDocument()
  })

  it("shows the native process id when a profile launches through the desktop bridge", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })
    const runtimeBridge: DesktopRuntimeBridge = {
      isTauri: () => true,
      launch: async () => ({
        id: profileA.id,
        profileId: profileA.id,
        profileName: profileA.name,
        status: "running",
        debugPort: 9333,
        wsEndpoint: "ws://127.0.0.1:9333/devtools/browser/native",
        startedAt: "2026-03-17T00:00:00.000Z",
        updatedAt: "2026-03-17T00:00:00.000Z",
        processId: 456,
        lastError: null,
        logs: [],
      }),
      restart: async () => {
        throw new Error("not used")
      },
      stop: async () => {
        throw new Error("not used")
      },
    }

    saveProfiles([profileA])

    render(<ProfilesPage runtimeBridge={runtimeBridge} />)

    await user.click(screen.getByRole("button", { name: /start profile a/i }))

    expect(screen.getByText(/^Debug port: 9333$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Process ID: 456$/i)).toBeInTheDocument()
  })

  it("restarts a running profile and frees the lock after stop", async () => {
    const user = userEvent.setup()
    const profileA = createProfileFromDraft({
      ...createEmptyProfileDraft(),
      name: "Profile A",
    })

    saveProfiles([profileA])

    render(<ProfilesPage />)

    await user.click(screen.getByRole("button", { name: /start profile a/i }))
    await user.click(screen.getByRole("button", { name: /restart profile a/i }))
    await user.click(screen.getByRole("button", { name: /stop profile a/i }))

    expect(screen.getByText(/^stopped$/i)).toBeInTheDocument()
    expect(screen.getByText(/released profile lock/i)).toBeInTheDocument()
  })

  it("renders chinese form copy when the locale is zh-CN", () => {
    render(
      <I18nProvider initialLocale="zh-CN">
        <ProfilesPage />
      </I18nProvider>,
    )

    expect(screen.getByRole("heading", { name: "配置文件" })).toBeInTheDocument()
    expect(screen.getByLabelText("配置名称")).toBeInTheDocument()
    expect(screen.getByLabelText("分组")).toBeInTheDocument()
    expect(screen.getByLabelText("分组")).toHaveValue("默认")
    expect(screen.getByRole("button", { name: "创建配置文件" })).toBeInTheDocument()
  })
})
