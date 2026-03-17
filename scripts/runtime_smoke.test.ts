import { describe, expect, it, vi } from "vitest"
import { runRuntimeSmoke } from "./runtime_smoke.mjs"

describe("runRuntimeSmoke", () => {
  it("connects over CDP, reads the browser version, and closes the browser", async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    const version = vi.fn().mockResolvedValue("Chrome/136.0.0.0")
    const connectOverCDP = vi.fn().mockResolvedValue({
      close,
      version,
    })

    const result = await runRuntimeSmoke(
      { connectOverCDP },
      "ws://127.0.0.1:9333/devtools/browser/native",
    )

    expect(connectOverCDP).toHaveBeenCalledWith(
      "ws://127.0.0.1:9333/devtools/browser/native",
    )
    expect(version).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      endpoint: "ws://127.0.0.1:9333/devtools/browser/native",
      version: "Chrome/136.0.0.0",
    })
  })

  it("rejects missing websocket endpoints", async () => {
    await expect(
      runRuntimeSmoke({ connectOverCDP: vi.fn() }, ""),
    ).rejects.toThrow(/endpoint is required/i)
  })
})
