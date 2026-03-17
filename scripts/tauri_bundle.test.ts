import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("tauri bundle config", () => {
  it("keeps macOS bundle output enabled", () => {
    const raw = readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8")
    const config = JSON.parse(raw) as {
      bundle: { active: boolean; targets: string[] }
    }

    expect(config.bundle.active).toBe(true)
    expect(config.bundle.targets).toEqual(expect.arrayContaining(["app", "dmg"]))
  })
})
