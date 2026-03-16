import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  createI18nValue,
  I18nContext,
  loadStoredLocale,
  saveStoredLocale,
  type AppLocale,
} from "./core"

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: AppLocale
}) {
  const [locale, setLocaleState] = useState<AppLocale>(
    () => initialLocale ?? loadStoredLocale(),
  )

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale)
    saveStoredLocale(nextLocale)
  }, [])

  const value = useMemo(() => createI18nValue(locale, setLocale), [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
