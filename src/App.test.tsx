import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { createRegressionRun, saveRegressionRuns } from "./features/automation/storage"
import App from "./App"

describe("App shell", () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.location.hash = "#/"
  })

  it("shows regression coverage on the dashboard and switches between the main sections", async () => {
    const user = userEvent.setup()

    saveRegressionRuns([
      createRegressionRun({
        profileId: "profile-a",
        profileName: "Profile A",
        targetId: "creepjs",
      }),
      createRegressionRun({
        profileId: "profile-b",
        profileName: "Profile B",
        targetId: "browserleaks",
      }),
    ])

    render(<App />)

    expect(await screen.findByText(/web preview fallback/i)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /profiles/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /detection lab/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByText(/2 detection runs saved locally/i)).toBeInTheDocument()
    expect(screen.getByText(/2 profiles covered\. creepjs and browserleaks manual regression coverage/i)).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: /profiles/i }))
    expect(screen.getByRole("heading", { name: /profiles/i })).toBeInTheDocument()
    expect(screen.getByText(/create, organize, and launch isolated browser profiles/i)).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: /detection lab/i }))
    expect(screen.getByRole("heading", { name: /detection lab/i })).toBeInTheDocument()
    expect(screen.getByText(/create a profile first/i)).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: /settings/i }))
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByText(/configure app defaults, runtime behavior, and diagnostics/i)).toBeInTheDocument()
  })
})
