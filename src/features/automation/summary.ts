import type { DetectionProbeArtifact } from "../../lib/automationDesktop"
import type { DetectionTargetId, RegressionObservedValues } from "./storage"

export type DetectionSummaryItem = {
  label: string
  value: string
}

export type DetectionSiteSummary = {
  headline: string
  items: DetectionSummaryItem[]
}

type SummaryInput = {
  targetId: DetectionTargetId
  observed: RegressionObservedValues
  artifacts?: DetectionProbeArtifact[]
}

export function summarizeDetectionArtifacts(
  input: SummaryInput,
): DetectionSiteSummary | null {
  const { targetId, artifacts = [] } = input

  if (artifacts.length === 0) {
    return null
  }

  return targetId === "creepjs"
    ? summarizeCreepJs(artifacts)
    : summarizeBrowserLeaks(artifacts)
}

function summarizeCreepJs(artifacts: DetectionProbeArtifact[]): DetectionSiteSummary | null {
  const text = artifacts[0]?.text ?? ""
  const fpId = matchValue(text, /FP ID:\s*([^\n]+)/)
  const likeHeadless = matchValue(text, /(\d+% like headless):\s*[^\n]+/)
  const headless = matchValue(text, /(\d+% headless):\s*[^\n]+/)
  const stealth = matchValue(text, /(\d+% stealth):\s*[^\n]+/)
  const workerConfidence = matchValue(text, /Worker[\s\S]*?confidence:\s*([^\n]+)/)
  const items = [
    createSummaryItem("automation.summary.creepjs.fpId", fpId),
    createSummaryItem(
      "automation.summary.creepjs.workerConfidence",
      workerConfidence,
    ),
  ].filter((item): item is DetectionSummaryItem => Boolean(item))

  if (items.length === 0) {
    return null
  }

  return {
    headline: [likeHeadless, headless, stealth].filter(Boolean).join(" · "),
    items,
  }
}

function summarizeBrowserLeaks(
  artifacts: DetectionProbeArtifact[],
): DetectionSiteSummary | null {
  const javascript = getArtifactText(artifacts, "javascript")
  const webrtc = getArtifactText(artifacts, "webrtc")
  const canvas = getArtifactText(artifacts, "canvas")
  const webgl = getArtifactText(artifacts, "webgl")
  const rects = getArtifactText(artifacts, "rects")

  const webdriver = matchValue(javascript, /webdriver\t([^\n]+)/)
  const webrtcLeak =
    matchValue(webrtc, /(No Local IP Leak)/) ??
    matchValue(webrtc, /(Local IP Leak)/) ??
    matchValue(webrtc, /(WebRTC IP doesn't match your Remote IP)/)
  const canvasSignature = matchValue(canvas, /Signature\t([^\n]+)/)
  const webglHash = matchValue(webgl, /WebGL Report Hash\t([^\n]+)/)
  const rectsHash = matchValue(rects, /Full Hash\t([^\n]+)/)

  const items = [
    createSummaryItem(
      "automation.summary.browserleaks.webrtcLeak",
      webrtcLeak,
    ),
    createSummaryItem(
      "automation.summary.browserleaks.canvasSignature",
      canvasSignature,
    ),
    createSummaryItem("automation.summary.browserleaks.webglHash", webglHash),
    createSummaryItem("automation.summary.browserleaks.rectsHash", rectsHash),
  ].filter((item): item is DetectionSummaryItem => Boolean(item))

  if (items.length === 0) {
    return null
  }

  return {
    headline: [webrtcLeak, webdriver ? `webdriver ${webdriver}` : ""]
      .filter(Boolean)
      .join(" · "),
    items,
  }
}

function getArtifactText(artifacts: DetectionProbeArtifact[], id: string) {
  return artifacts.find((artifact) => artifact.id === id)?.text ?? ""
}

function createSummaryItem(label: string, value?: string | null) {
  if (!value) {
    return null
  }

  return { label, value }
}

function matchValue(text: string, expression: RegExp) {
  return expression.exec(text)?.[1]?.trim() ?? null
}
