import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { I18N_STORAGE_KEY, I18nProvider, useI18n } from "./index"

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span>{t("nav.dashboard")}</span>
      <label>
        locale
        <select
          aria-label="locale"
          value={locale}
          onChange={(event) => setLocale(event.target.value as "en" | "zh-CN")}
        >
          <option value="en">English</option>
          <option value="zh-CN">简体中文</option>
        </select>
      </label>
    </div>
  )
}

describe("i18n", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("defaults to english and persists locale changes", async () => {
    const user = userEvent.setup()

    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    )

    expect(screen.getByTestId("locale")).toHaveTextContent("en")
    expect(screen.getByText("Dashboard")).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("locale"), "zh-CN")

    expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN")
    expect(screen.getByText("仪表板")).toBeInTheDocument()
    expect(window.localStorage.getItem(I18N_STORAGE_KEY)).toBe("zh-CN")
  })
})
