# Runtime Health Log Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a diagnosable runtime health workflow so the app can refresh instance health, surface degraded states, and show recent runtime logs in the Profiles page.

**Architecture:** Keep the source of truth in the native runtime when Tauri is available: Rust owns process liveness and CDP reachability checks, and returns an updated runtime handle. Keep the web-preview fallback lightweight in TypeScript so tests remain fast and the UI can still model health transitions without a native host.

**Tech Stack:** React, TypeScript, Vitest, Tauri 2, Rust, serde, tungstenite

### Task 1: Extend runtime models with health metadata

**Files:**
- Modify: `src/features/runtime/manager.ts`
- Modify: `src/features/runtime/manager.test.ts`
- Modify: `src/lib/runtimeDesktop.ts`
- Modify: `src/lib/runtimeDesktop.test.ts`

**Step 1: Write the failing TypeScript tests**

Add assertions that a started instance now carries:
- `health.status`
- `health.checkedAt`
- `health.message`

Add a test that a new `refreshProfileRuntimeHealth()` helper updates an existing running instance from `healthy` to `degraded` without changing its `debugPort` or `logs`.

**Step 2: Run focused tests to verify they fail**

Run: `npm test -- src/features/runtime/manager.test.ts src/lib/runtimeDesktop.test.ts`
Expected: FAIL because the health model and refresh helper do not exist yet.

**Step 3: Write minimal implementation**

Add:
- `RuntimeHealthStatus = "unknown" | "healthy" | "degraded" | "stopped"`
- `RuntimeHealthSnapshot` on `BrowserInstance`
- helper to create default health snapshots for start/stop/restart flows
- `refreshProfileRuntimeHealth()` that uses the desktop bridge in Tauri mode and a local fallback in web mode
- `DesktopRuntimeBridge.refreshHealth()`

**Step 4: Run focused tests**

Run: `npm test -- src/features/runtime/manager.test.ts src/lib/runtimeDesktop.test.ts`
Expected: PASS

### Task 2: Add native runtime health refresh in Rust

**Files:**
- Modify: `src-tauri/src/runtime.rs`
- Modify: `src-tauri/src/runtime_tests.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Write the failing Rust tests**

Add unit tests for:
- deriving a healthy snapshot when the process is alive and CDP endpoint responds
- deriving a degraded snapshot when CDP endpoint is unavailable
- preserving accumulated runtime logs while appending a health-check log entry

**Step 2: Run focused Rust tests to verify they fail**

Run: `cd src-tauri && cargo test runtime_tests`
Expected: FAIL because runtime health types and refresh logic do not exist yet.

**Step 3: Write minimal implementation**

Add:
- `RuntimeHealthSnapshot` to the Rust handle
- `refresh_runtime_health` Tauri command
- helper that checks child process liveness and probes `/json/version` on the current debug port
- degraded messages for process-not-running and cdp-unreachable cases
- a structured log entry for each health refresh result

**Step 4: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: PASS

### Task 3: Render the health section and logs panel in Profiles

**Files:**
- Modify: `src/features/profiles/ProfilesPage.tsx`
- Modify: `src/features/profiles/ProfilesPage.test.tsx`
- Modify: `src/features/i18n/messages.ts`
- Modify: `src/App.css` (only if additional layout styling is needed)

**Step 1: Write the failing page tests**

Add tests that:
- render a running profile with a degraded health snapshot and verify the page shows health status, checked time, and message
- click a new `Refresh health` action and verify updated runtime data is rendered
- verify a recent logs list is shown with more than the latest single line

**Step 2: Run focused tests to verify they fail**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because the health panel, refresh action, and log list do not exist yet.

**Step 3: Write minimal implementation**

Add:
- health badge and summary block in each profile card
- `Refresh health` button for running instances
- rendering of the latest several runtime logs in chronological order
- English and Simplified Chinese copy for health labels, messages, and button text

**Step 4: Run focused tests**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

### Task 4: Refresh docs and verify the slice end-to-end

**Files:**
- Modify: `README.md`
- Modify: `docs/product/mvp-prd.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/runtime-contract.md`

**Step 1: Update docs**

Document:
- runtime handles now include health metadata
- Profiles page can refresh runtime health and show recent logs
- health checks currently validate managed-process liveness plus CDP endpoint reachability

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

Push changed files to a feature branch, open a PR against `main`, request Copilot review, and merge once the branch is clean. Reference `Closes #23` in the PR body.
