import { createContext } from "react"
import { messages, type AppLocale, type MessageKey } from "./messages"

export const I18N_STORAGE_KEY = "fingerprint-browser.locale.v1"

export type TranslationParams = Record<string, string | number>

export type I18nValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: MessageKey, params?: TranslationParams) => string
  formatDateTime: (timestamp: string) => string
}

type StorageLike = Pick<Storage, "getItem" | "setItem">

const defaultLocale: AppLocale = "en"

function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "zh-CN"
}

function toIntlLocale(locale: AppLocale) {
  return locale === "zh-CN" ? "zh-CN" : "en-US"
}

export function translateMessage(
  locale: AppLocale,
  key: MessageKey,
  params?: TranslationParams,
) {
  const template = messages[locale][key] ?? messages.en[key]

  if (!params) {
    return template
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token) => String(params[token] ?? ""))
}

export function loadStoredLocale(
  storage: StorageLike = window.localStorage,
  browserLocale = typeof navigator === "undefined" ? "" : navigator.language,
): AppLocale {
  const stored = storage.getItem(I18N_STORAGE_KEY)

  if (isSupportedLocale(stored)) {
    return stored
  }

  if (browserLocale.toLowerCase().startsWith("zh")) {
    return "zh-CN"
  }

  return defaultLocale
}

export function saveStoredLocale(
  locale: AppLocale,
  storage: StorageLike = window.localStorage,
) {
  storage.setItem(I18N_STORAGE_KEY, locale)
}

export function createI18nValue(
  locale: AppLocale,
  setLocale: (locale: AppLocale) => void,
): I18nValue {
  return {
    locale,
    setLocale,
    t: (key, params) => translateMessage(locale, key, params),
    formatDateTime: (timestamp) =>
      new Intl.DateTimeFormat(toIntlLocale(locale), {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(timestamp)),
  }
}

export const defaultContextValue = createI18nValue(defaultLocale, () => undefined)

export const I18nContext = createContext<I18nValue>(defaultContextValue)

export type { AppLocale, MessageKey }
