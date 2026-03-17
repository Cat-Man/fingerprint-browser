# macOS Bundle Packaging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable `npm run tauri:build` to emit installable macOS bundle artifacts and document where to find them.

**Architecture:** Keep the change minimal by enabling the existing Tauri bundle pipeline, adding one regression test that guards the bundle config, and updating the README to describe the installer outputs. Verification relies on the real `tauri build` output rather than mocks.

**Tech Stack:** Tauri 2, React, Rust, Vitest, Node.js

### Task 1: Guard the bundle configuration with a failing test

**Files:**
- Create: `scripts/tauri_bundle.test.ts`
- Test: `scripts/tauri_bundle.test.ts`

**Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("tauri bundle config", () => {
  it("keeps macOS bundle output enabled", () => {
    const raw = readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8")
    const config = JSON.parse(raw)

    expect(config.bundle.active).toBe(true)
    expect(config.bundle.targets).toEqual(expect.arrayContaining(["app", "dmg"]))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- scripts/tauri_bundle.test.ts`
Expected: FAIL because `bundle.active` is currently `false`

**Step 3: Write minimal implementation**

Change `src-tauri/tauri.conf.json` so `bundle.active` is `true` and `bundle.targets` includes `app` and `dmg`.

**Step 4: Run test to verify it passes**

Run: `npm test -- scripts/tauri_bundle.test.ts`
Expected: PASS

### Task 2: Document the packaged outputs

**Files:**
- Modify: `README.md`

**Step 1: Write the failing documentation expectation**

Use the same test run from Task 1 as the safety net, then manually compare the README against the new packaging behavior.

**Step 2: Write minimal documentation**

Add a short section explaining:
- `npm run tauri:build` now emits macOS bundle artifacts
- where to look for `.app` / `.dmg`
- that local unsigned builds may require macOS confirmation on first open

**Step 3: Verify docs match behavior**

Run: `npm run tauri:build`
Expected: macOS bundle artifacts exist under `src-tauri/target/release/bundle/`

### Task 3: Full verification

**Files:**
- Verify only

**Step 1: Run focused tests**

Run: `npm test -- scripts/tauri_bundle.test.ts`
Expected: PASS

**Step 2: Run broad regression checks**

Run: `npm test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

**Step 3: Run build verification**

Run: `npm run tauri:build`
Expected: PASS and bundle outputs under `src-tauri/target/release/bundle/`
