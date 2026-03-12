import { useEffect, useState } from "react"
import { HashRouter, NavLink, Route, Routes } from "react-router-dom"
import { automationMilestones } from "./features/automation"
import { ProfilesPage } from "./features/profiles/ProfilesPage"
import { runtimeDefaults, runtimeDiagnostics } from "./features/runtime"
import { loadDesktopOverview, type DesktopOverview } from "./lib/desktop"
import "./App.css"

type OverviewCardProps = {
  title: string
  value: string
  helper: string
}

function OverviewCard({ title, value, helper }: OverviewCardProps) {
  return (
    <article className="overview-card">
      <span className="overview-card__title">{title}</span>
      <strong className="overview-card__value">{value}</strong>
      <p className="overview-card__helper">{helper}</p>
    </article>
  )
}

function DashboardPage({ overview }: { overview: DesktopOverview | null }) {
  const bridgeStatus = overview
    ? overview.source === "tauri"
      ? "Tauri connected"
      : "Web preview fallback"
    : "Loading bridge..."

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">MVP control center</p>
          <h1>Dashboard</h1>
          <p>
            Track the local runtime, launch profiles, and keep your fingerprint
            test workflow in one place.
          </p>
        </div>
        <span className="status-pill">Local-only MVP</span>
      </header>

      <div className="overview-grid">
        <OverviewCard
          title="Desktop bridge"
          value={bridgeStatus}
          helper={`Runtime target: ${overview?.runtime ?? "loading"}`}
        />
        <OverviewCard
          title="Manager app"
          value={overview?.appName ?? "fingerprint-browser"}
          helper="React shell rendered inside the Tauri desktop host."
        />
        <OverviewCard
          title="Running instances"
          value="0"
          helper="Launch browsers with dedicated ports and proxy settings."
        />
        <OverviewCard
          title="Regression checks"
          value={String(automationMilestones.length)}
          helper="Planned: Playwright, CreepJS, and BrowserLeaks validation flows."
        />
      </div>
    </section>
  )
}

function SettingsPage() {
  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">System defaults</p>
          <h1>Settings</h1>
          <p>
            Configure app defaults, runtime behavior, and diagnostics before
            connecting a real browser engine.
          </p>
        </div>
      </header>

      <div className="panel-list">
        <article className="panel-card">
          <h2>Runtime defaults</h2>
          <ul>
            {runtimeDefaults.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="panel-card">
          <h2>Diagnostics</h2>
          <ul>
            {runtimeDiagnostics.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/profiles", label: "Profiles" },
  { to: "/settings", label: "Settings" },
]

function AppLayout() {
  const [overview, setOverview] = useState<DesktopOverview | null>(null)

  useEffect(() => {
    let active = true

    loadDesktopOverview()
      .then((result) => {
        if (active) {
          setOverview(result)
        }
      })
      .catch(() => {
        if (active) {
          setOverview({
            appName: "fingerprint-browser",
            runtime: "browser",
            source: "web-preview",
            profilesReady: false,
          })
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div>
          <p className="eyebrow">fingerprint-browser</p>
          <h2>Desktop manager</h2>
          <p className="sidebar-copy">
            Bootstrap shell for the manager app that will orchestrate profiles,
            runtime adapters, and automation connections.
          </p>
        </div>

        <nav aria-label="Primary navigation" className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link--active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-shell__content">
        <Routes>
          <Route path="/" element={<DashboardPage overview={overview} />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  )
}

export default App
