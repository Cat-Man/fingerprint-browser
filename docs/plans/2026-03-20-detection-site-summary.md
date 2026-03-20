# Detection Site Summary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Detection Lab auto capture so it also collects target-specific page artifacts and renders a readable CreepJS / BrowserLeaks summary in the UI.

**Architecture:** Keep native Tauri/Rust responsible for attaching to the running browser, navigating to the target pages, and collecting compact text artifacts from those pages. Keep target-specific interpretation in the React layer via a dedicated summary parser so we can cover the parsing rules with focused Vitest tests and evolve site heuristics without recompiling the runtime contract every time.

**Tech Stack:** React, TypeScript, Vitest, Tauri 2, Rust, serde, tungstenite

### Task 1: Define site-summary models and parser coverage

**Files:**
- Create: `src/features/automation/summary.ts`
- Create: `src/features/automation/summary.test.ts`
- Modify: `src/lib/automationDesktop.ts`
- Modify: `src/lib/automationDesktop.test.ts`

**Step 1: Write the failing parser tests**

```ts
it("builds a readable CreepJS summary from the captured page text", () => {
  const summary = summarizeDetectionArtifacts({
    targetId: "creepjs",
    observed: createEmptyObservedValues(),
    artifacts: [
      {
        id: "creepjs-main",
        url: "https://abrahamjuliot.github.io/creepjs/",
        text: "FP ID: abc123\nFuzzy: fuzzy456\nHeadless3778dd39\n31% like headless: 7a8c\n33% headless: a427\n0% stealth: 0c01\nWorker074bd9c1\nconfidence: high\ngpu:\nGoogle Inc. (Apple)",
      },
    ],
  })

  expect(summary?.headline).toContain("31% like headless")
  expect(summary?.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: "automation.summary.creepjs.fpId", value: "abc123" }),
      expect.objectContaining({ label: "automation.summary.creepjs.workerConfidence", value: "high" }),
    ]),
  )
})
```

```ts
it("builds a BrowserLeaks summary from multiple target pages", () => {
  const summary = summarizeDetectionArtifacts({
    targetId: "browserleaks",
    observed: createEmptyObservedValues(),
    artifacts: [
      { id: "javascript", url: "https://browserleaks.com/javascript", text: "userAgent\tMozilla/5.0\nlanguage\tzh-CN\nwebdriver\ttrue" },
      { id: "webrtc", url: "https://browserleaks.com/webrtc", text: "WebRTC Leak Test\t✔\nNo Local IP Leak\nPublic IP Address\t134.195.101.220" },
      { id: "canvas", url: "https://browserleaks.com/canvas", text: "Signature\tABCDEF\nUniqueness\t99.96%" },
      { id: "webgl", url: "https://browserleaks.com/webgl", text: "WebGL Report Hash\tHASH123\nUnmasked Renderer\tANGLE Renderer" },
      { id: "rects", url: "https://browserleaks.com/rects", text: "Full Hash\tRECTS123" },
    ],
  })

  expect(summary?.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ label: "automation.summary.browserleaks.webrtcLeak", value: "No Local IP Leak" }),
      expect.objectContaining({ label: "automation.summary.browserleaks.canvasSignature", value: "ABCDEF" }),
    ]),
  )
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/automation/summary.test.ts src/lib/automationDesktop.test.ts`
Expected: FAIL because the summary module and artifact types do not exist yet.

**Step 3: Write minimal parser and bridge types**

Add:
- `DetectionProbeArtifact`
- `DetectionSiteSummary`
- `summarizeDetectionArtifacts()`
- updated bridge types so probe responses can include `artifacts`

**Step 4: Run focused tests**

Run: `npm test -- src/features/automation/summary.test.ts src/lib/automationDesktop.test.ts`
Expected: PASS

### Task 2: Render the summary in Detection Lab

**Files:**
- Modify: `src/features/automation/AutomationPage.tsx`
- Modify: `src/features/automation/AutomationPage.test.tsx`
- Modify: `src/features/i18n/messages.ts`

**Step 1: Write the failing page tests**

Add a test that:
- injects a probe result with BrowserLeaks artifacts
- clicks auto capture
- verifies a new summary panel renders the summary headline and extracted items

Add another test that:
- injects a probe result with no usable artifacts
- verifies the UI falls back to a “summary unavailable” hint without breaking the form

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/automation/AutomationPage.test.tsx`
Expected: FAIL because the summary panel and messages do not exist yet.

**Step 3: Write minimal implementation**

Add:
- local `capturedSummary` state in `AutomationPage`
- summary parsing after `runProbe()` resolves
- a summary panel beside the checklist/diff cards
- translated labels for the panel title, fallback state, and the structured summary fields
- reset logic when profile or target changes so stale summaries are cleared

**Step 4: Run focused tests**

Run: `npm test -- src/features/automation/AutomationPage.test.tsx`
Expected: PASS

### Task 3: Capture target artifacts in the Tauri probe command

**Files:**
- Modify: `src-tauri/src/automation.rs`
- Modify: `src-tauri/src/automation_tests.rs`
- Modify: `src-tauri/src/lib.rs` (only if type exports or wiring change)

**Step 1: Write the failing Rust tests**

Add unit tests for:
- building the BrowserLeaks artifact plan for the selected target
- deserializing a `Runtime.evaluate` payload that contains artifact text into a normalized artifact struct

```rust
#[test]
fn builds_browserleaks_artifact_plan() {
  let artifacts = build_target_artifact_plan("browserleaks", "https://browserleaks.com/")
    .expect("plan should exist");

  assert_eq!(artifacts.len(), 5);
  assert_eq!(artifacts[0].id, "javascript");
  assert_eq!(artifacts[4].url, "https://browserleaks.com/rects");
}
```

**Step 2: Run Rust tests to verify they fail**

Run: `cd src-tauri && cargo test automation_tests`
Expected: FAIL because artifact planning helpers do not exist yet.

**Step 3: Write minimal implementation**

Add:
- `DetectionProbeArtifact` Rust struct
- target artifact plan builder for `creepjs` and `browserleaks`
- `Page.navigate` helper in the CDP client
- compact page text extraction helper (for example `document.body.innerText` truncated to a reasonable size)
- non-fatal summary artifact collection so observed fields still return even if one page fails

**Step 4: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: PASS

### Task 4: Refresh docs and publish issue #21

**Files:**
- Modify: `README.md`
- Modify: `docs/product/mvp-prd.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/runtime-contract.md`

**Step 1: Update docs**

Document:
- Detection Lab now captures both observed fields and target-specific summary artifacts
- BrowserLeaks summary is assembled from multiple page probes
- parsing is heuristic and falls back gracefully when a site layout changes

**Step 2: Run full verification**

Run: `npm test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `cd src-tauri && cargo test`
Expected: PASS

Run: `npm run tauri:build`
Expected: PASS

**Step 3: Publish via GitHub MCP**

Push changed files to `feat/issue-21-detection-site-summary`, open a PR against `main`, request Copilot review, and merge once the branch is clean. Reference `Closes #21` in the PR body.
