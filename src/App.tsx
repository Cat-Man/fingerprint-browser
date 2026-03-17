import { useCallback, useEffect, useState } from "react"
import { HashRouter, NavLink, Route, Routes } from "react-router-dom"
import { AutomationPage } from "./features/automation/AutomationPage"
import { loadRegressionRuns, summarizeRegressionRuns } from "./features/automation/storage"
import { I18nProvider, useI18n, type AppLocale, type MessageKey } from "./features/i18n"
import { ProfilesPage } from "./features/profiles/ProfilesPage"
import {
  loadRuntimeInstances,
  runtimeDefaults,
  runtimeDiagnostics,
  summarizeRuntime,
} from "./features/runtime"
import { loadDesktopOverview, type DesktopOverview } from "./lib/desktop"
import "./App.css"

type OverviewCardProps = {
  title: string
  value: string
  helper: string
}

function pluralMessageKey(base: string, count: number) {
  return `${base}.${count === 1 ? "one" : "other"}` as MessageKey
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

function DashboardPage({
  overview,
  regressionSummary,
}: {
  overview: DesktopOverview | null
  regressionSummary: ReturnType<typeof summarizeRegressionRuns>
}) {
  const { t } = useI18n()
  const bridgeStatus = overview
    ? overview.source === "tauri"
      ? t("dashboard.bridge.connected")
      : t("dashboard.bridge.fallback")
    : t("dashboard.bridge.loading")
  const runtimeSummary = summarizeRuntime(loadRuntimeInstances())
  const runtimeTarget =
    overview?.runtime === "browser"
      ? t("common.runtime.browser")
      : overview?.runtime ?? t("common.loading")

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">{t("dashboard.eyebrow")}</p>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.description")}</p>
        </div>
        <span className="status-pill">{t("dashboard.status.localOnly")}</span>
      </header>

      <div className="overview-grid">
        <OverviewCard
          title={t("dashboard.bridge.title")}
          value={bridgeStatus}
          helper={t("dashboard.bridge.helper", { target: runtimeTarget })}
        />
        <OverviewCard
          title={t("dashboard.manager.title")}
          value={overview?.appName ?? "fingerprint-browser"}
          helper={t("dashboard.manager.helper")}
        />
        <OverviewCard
          title={t("dashboard.instances.title")}
          value={String(runtimeSummary.runningCount)}
          helper={t("dashboard.instances.helper")}
        />
        <OverviewCard
          title={t("dashboard.regressions.title")}
          value={t(
            pluralMessageKey("dashboard.regressions.value", regressionSummary.totalRuns),
            { count: regressionSummary.totalRuns },
          )}
          helper={t(
            pluralMessageKey(
              "dashboard.regressions.helper",
              regressionSummary.profilesCovered,
            ),
            { count: regressionSummary.profilesCovered },
          )}
        />
      </div>
    </section>
  )
}

function SettingsPage() {
  const { locale, setLocale, t } = useI18n()

  return (
    <section className="page-shell">
      <header className="page-shell__header">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.description")}</p>
        </div>
      </header>

      <div className="panel-list">
        <article className="panel-card">
          <h2>{t("settings.language.title")}</h2>
          <label className="field">
            <span>{t("settings.language.label")}</span>
            <select
              aria-label={t("settings.language.label")}
              value={locale}
              onChange={(event) => setLocale(event.target.value as AppLocale)}
            >
              <option value="en">{t("settings.language.option.en")}</option>
              <option value="zh-CN">{t("settings.language.option.zh-CN")}</option>
            </select>
          </label>
          <p>{t("settings.language.help")}</p>
        </article>
        <article className="panel-card">
          <h2>{t("settings.runtimeDefaults.title")}</h2>
          <ul>
            {runtimeDefaults.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </article>
        <article className="panel-card">
          <h2>{t("settings.diagnostics.title")}</h2>
          <ul>
            {runtimeDiagnostics.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

function AppLayout() {
  const { t } = useI18n()
  const [overview, setOverview] = useState<DesktopOverview | null>(null)
  const [regressionSummary, setRegressionSummary] = useState(() =>
    summarizeRegressionRuns(loadRegressionRuns()),
  )

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

  const handleRunsChanged = useCallback((runs: ReturnType<typeof loadRegressionRuns>) => {
    setRegressionSummary(summarizeRegressionRuns(runs))
  }, [])

  const navItems = [
    { to: "/", label: t("nav.dashboard") },
    { to: "/profiles", label: t("nav.profiles") },
    { to: "/automation", label: t("nav.automation") },
    { to: "/settings", label: t("nav.settings") },
  ]

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div>
          <p className="eyebrow">fingerprint-browser</p>
          <h2>{t("sidebar.title")}</h2>
          <p className="sidebar-copy">{t("sidebar.description")}</p>
        </div>

        <nav aria-label={t("aria.primaryNavigation")} className="nav-list">
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
          <Route
            path="/"
            element={<DashboardPage overview={overview} regressionSummary={regressionSummary} />}
          />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route
            path="/automation"
            element={<AutomationPage onRunsChanged={handleRunsChanged} />}
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <AppLayout />
      </HashRouter>
    </I18nProvider>
  )
}

export default App
