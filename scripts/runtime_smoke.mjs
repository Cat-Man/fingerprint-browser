import { chromium } from "playwright-core"
import { pathToFileURL } from "node:url"

export async function runRuntimeSmoke(runtimeApi, endpoint) {
  if (!endpoint) {
    throw new Error("Runtime endpoint is required")
  }

  const browser = await runtimeApi.connectOverCDP(endpoint)

  try {
    const version = await browser.version()

    return {
      endpoint,
      version,
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const endpoint = process.argv[2]
  const result = await runRuntimeSmoke(chromium, endpoint)

  console.log(`Connected to ${result.version} via ${result.endpoint}`)
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
