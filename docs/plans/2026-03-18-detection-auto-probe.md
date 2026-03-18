# Detection Auto Probe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Detection Lab auto-capture flow that connects to a running profile's `wsEndpoint`, collects core fingerprint observations, and feeds them back into the existing regression workflow.

**Architecture:** Keep the current manual Detection Lab model intact and layer a new desktop automation bridge on top. The React page will detect whether the selected profile has a running instance, expose an "auto capture" action, and write probe results back into the existing observed-value form. The Tauri side will add a small CDP client that connects to the browser WebSocket, opens the selected target page, evaluates a probe script for the supported fields, and returns a normalized payload to the frontend.

**Tech Stack:** React, TypeScript, Vitest, Tauri 2, Rust, tungstenite, serde_json

### Task 1: Define the desktop automation bridge and frontend expectations

**Files:**
- Create: `src/lib/automationDesktop.ts`
- Create: `src/lib/automationDesktop.test.ts`
- Modify: `src/features/automation/AutomationPage.test.tsx`

**Step 1: Write the failing bridge test**

```ts
it("invokes the desktop detection probe command with the expected payload", async () => {
  const invoke = vi.fn().mockResolvedValue({
    observed: { timezone: "Asia/Shanghai" },
    capturedAt: "2026-03-18T00:00:00.000Z",
    targetUrl: "https://example.com",
  })
  const bridge = createDesktopAutomationBridge({
    isTauri: () => true,
    invoke,
  })

  await bridge.runProbe({
    profileId: "profile-a",
    targetId: "creepjs",
    targetUrl: "https://example.com",
    wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
  })

  expect(invoke).toHaveBeenCalledWith("run_detection_probe", {
    request: expect.objectContaining({
      profileId: "profile-a",
      targetId: "creepjs",
      targetUrl: "https://example.com",
    }),
  })
})
```

**Step 2: Write the failing page test**

Add a Detection Lab test that:
- seeds a running runtime instance for the selected profile in `sessionStorage`
- injects a fake automation bridge
- clicks the auto-capture button
- verifies the form fields update from the returned probe payload
- verifies a success hint appears

**Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/automationDesktop.test.ts src/features/automation/AutomationPage.test.tsx`
Expected: FAIL because the bridge and UI action do not exist yet.

### Task 2: Implement the frontend auto-capture flow

**Files:**
- Modify: `src/features/automation/AutomationPage.tsx`
- Modify: `src/features/automation/index.ts`
- Modify: `src/features/i18n/messages.ts`
- Modify: `src/features/runtime/index.ts`

**Step 1: Write minimal implementation**

Add:
- a typed desktop automation bridge import
- runtime-instance lookup for the selected profile
- an auto-capture button that is enabled only when a running instance with `wsEndpoint` exists
- async handling that calls the bridge, fills the observed fields, and surfaces translated feedback
- translated copy for loading, success, error, and "start profile first" states

**Step 2: Run focused frontend tests**

Run: `npm test -- src/lib/automationDesktop.test.ts src/features/automation/AutomationPage.test.tsx`
Expected: PASS

### Task 3: Add the Tauri detection probe command

**Files:**
- Create: `src-tauri/src/automation.rs`
- Create: `src-tauri/src/automation_tests.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Step 1: Write the failing Rust tests**

Add unit tests for:
- parsing a successful `Runtime.evaluate` payload into normalized observed values
- rejecting malformed probe payloads missing required fields

**Step 2: Run Rust tests to verify they fail**

Run: `cd src-tauri && cargo test automation_tests`
Expected: FAIL because the automation module does not exist yet.

**Step 3: Write minimal implementation**

Add:
- a `run_detection_probe` Tauri command
- a small blocking CDP client using `tungstenite`
- target creation / attach / `Runtime.evaluate` flow
- a probe script that captures UA, language, timezone, WebRTC availability, Canvas hash, WebGL summary, Audio summary, and ClientRects summary
- response parsing and normalization into camelCase fields expected by the frontend

**Step 4: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: PASS

### Task 4: Refresh docs and verify the full slice

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/product/mvp-prd.md`

**Step 1: Update docs**

Document:
- that Detection Lab now supports automated capture for running profiles
- that the current implementation uses the live runtime `wsEndpoint`
- that deep site-specific parsing is still future work if not implemented in this slice

**Step 2: Run full verification**

Run: `npm test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `cd src-tauri && cargo test`
Expected: PASS

Run: `npm run tauri:build`
Expected: PASS

### Task 5: Publish through GitHub MCP

**Files:**
- Verify only

**Step 1: Push files to `feat/issue-19-detection-auto-probe`**

Use GitHub MCP `push_files` after local verification passes.

**Step 2: Open a PR**

Create a PR against `main` referencing `Closes #19`.

**Step 3: Merge when clean**

Check PR state, request review if useful, then merge through GitHub MCP.
