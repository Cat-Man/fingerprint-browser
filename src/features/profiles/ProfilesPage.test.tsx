import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
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
})
