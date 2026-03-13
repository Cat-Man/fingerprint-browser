import type { GeolocationPolicy, WebRtcPolicy } from "../profiles/storage"
import type { BrowserProfile } from "../profiles"

const DEFAULT_RESOLUTION = { width: 1920, height: 1080 }
const DEFAULT_MEMORY = 8
const DEFAULT_HARDWARE_CONCURRENCY = 8
const DEFAULT_CHROMIUM_VERSION = "136.0.0.0"
const CHROMIUM_VERSION_BY_CHANNEL: Record<string, string> = {
  stable: "136.0.0.0",
  beta: "137.0.0.0",
  dev: "138.0.0.0",
  canary: "139.0.0.0",
}

export type FingerprintConfig = {
  userAgent: string
  language: string
  timezone: string
  resolution: {
    width: number
    height: number
  }
  memory: number
  hardwareConcurrency: number
  geolocationPolicy: GeolocationPolicy
  webrtcPolicy: WebRtcPolicy
}

export type RuntimeLaunchRequest = {
  profile: BrowserProfile
  debugPort: number
}

export type RuntimeLaunchPlan = {
  adapterId: string
  browserEngine: string
  launchArgs: string[]
  env: Record<string, string>
  fingerprint: FingerprintConfig
  metadata: {
    wsPathHint: string
    browserVersion: string
    proxy?: {
      server: string
      username?: string
      password?: string
    }
  }
}

export interface RuntimeAdapter {
  id: string
  supports(engine: string): boolean
  prepareLaunch(request: RuntimeLaunchRequest): RuntimeLaunchPlan
}

export const chromiumRuntimeAdapter: RuntimeAdapter = {
  id: "chromium",
  supports(engine) {
    return engine.toLowerCase().includes("chromium")
  },
  prepareLaunch({ profile, debugPort }) {
    const fingerprint = buildFingerprintConfig(profile)

    return {
      adapterId: "chromium",
      browserEngine: profile.browserEngine,
      launchArgs: buildChromiumLaunchArgs(profile, fingerprint, debugPort),
      env: {},
      fingerprint,
      metadata: {
        wsPathHint: `/devtools/browser/${profile.id}`,
        browserVersion: profile.browserVersion,
        proxy: buildProxyMetadata(profile),
      },
    }
  },
}

export function resolveRuntimeAdapter(profile: BrowserProfile): RuntimeAdapter | null {
  return chromiumRuntimeAdapter.supports(profile.browserEngine)
    ? chromiumRuntimeAdapter
    : null
}

export function buildFingerprintConfig(profile: BrowserProfile): FingerprintConfig {
  return {
    userAgent: profile.fingerprint.userAgent || buildChromiumUserAgent(profile.browserVersion),
    language: profile.fingerprint.locale,
    timezone: profile.fingerprint.timezone,
    resolution: parseResolution(profile.fingerprint.screen),
    memory: parseNumericValue(profile.fingerprint.memory, DEFAULT_MEMORY),
    hardwareConcurrency: parseNumericValue(
      profile.fingerprint.hardwareConcurrency,
      DEFAULT_HARDWARE_CONCURRENCY,
    ),
    geolocationPolicy: profile.fingerprint.geolocationPolicy,
    webrtcPolicy: profile.fingerprint.webrtcPolicy,
  }
}

function buildChromiumLaunchArgs(
  profile: BrowserProfile,
  fingerprint: FingerprintConfig,
  debugPort: number,
) {
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--window-size=${fingerprint.resolution.width},${fingerprint.resolution.height}`,
    `--lang=${fingerprint.language}`,
    `--user-agent=${fingerprint.userAgent}`,
  ]

  if (profile.proxy.host && profile.proxy.port) {
    args.push(`--proxy-server=${profile.proxy.type}://${profile.proxy.host}:${profile.proxy.port}`)
  }

  if (fingerprint.webrtcPolicy === "proxy-only") {
    args.push("--force-webrtc-ip-handling-policy=disable_non_proxied_udp")
  }

  if (fingerprint.webrtcPolicy === "disabled") {
    args.push("--disable-webrtc")
  }

  return args
}

function buildProxyMetadata(profile: BrowserProfile) {
  if (!profile.proxy.host || !profile.proxy.port) {
    return undefined
  }

  return {
    server: `${profile.proxy.type}://${profile.proxy.host}:${profile.proxy.port}`,
    username: profile.proxy.username || undefined,
    password: profile.proxy.password || undefined,
  }
}

function parseResolution(screen: string) {
  const [widthText, heightText] = screen.split("x")
  const width = Number.parseInt(widthText ?? "", 10)
  const height = Number.parseInt(heightText ?? "", 10)

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return DEFAULT_RESOLUTION
  }

  return { width, height }
}

function parseNumericValue(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildChromiumUserAgent(browserVersion: string) {
  const chromeVersion = resolveChromiumVersion(browserVersion)

  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
}

function resolveChromiumVersion(browserVersion: string) {
  const normalizedVersion = browserVersion.trim().toLowerCase()

  if (CHROMIUM_VERSION_BY_CHANNEL[normalizedVersion]) {
    return CHROMIUM_VERSION_BY_CHANNEL[normalizedVersion]
  }

  if (/^\d+(\.\d+){0,3}$/.test(normalizedVersion)) {
    const segments = normalizedVersion.split(".")
    while (segments.length < 4) {
      segments.push("0")
    }

    return segments.join(".")
  }

  return DEFAULT_CHROMIUM_VERSION
}
