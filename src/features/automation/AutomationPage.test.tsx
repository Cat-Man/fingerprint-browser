import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { createEmptyProfileDraft, createProfileFromDraft, saveProfiles } from "../profiles"
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
})
