import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"

describe("App shell", () => {
  it("shows the three main sections and switches between them", async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /profiles/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument()
    expect(await screen.findByText(/web preview fallback/i)).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: /profiles/i }))
    expect(screen.getByRole("heading", { name: /profiles/i })).toBeInTheDocument()
    expect(screen.getByText(/create, organize, and launch isolated browser profiles/i)).toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: /settings/i }))
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByText(/configure app defaults, runtime behavior, and diagnostics/i)).toBeInTheDocument()
  })
})
