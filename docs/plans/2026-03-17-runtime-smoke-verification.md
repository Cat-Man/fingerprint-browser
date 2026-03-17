# Runtime Smoke Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the runtime verification slice so the app exposes native runtime metadata in the UI, provides a repeatable Playwright/CDP smoke command for a running browser endpoint, and updates project docs to match the current implementation state.

**Architecture:** Keep the runtime manager and Tauri launcher contract unchanged, but surface the native `processId` in the Profiles UI and add a small Node smoke utility that connects to a provided CDP websocket through `playwright-core`. Keep the smoke utility testable by exporting a small function from the script, then update README and architecture docs so the repository accurately describes the current desktop/runtime capabilities.

**Tech Stack:** React 19, TypeScript, Vitest, Node ESM, Rust, Tauri 2, Playwright Core

### Task 1: Surface native process metadata in Profiles

**Files:**
- Modify: `src/features/profiles/ProfilesPage.tsx`
- Modify: `src/features/profiles/ProfilesPage.test.tsx`

**Step 1: Write the failing test**

Add a test that starts a profile through a mocked Tauri runtime bridge and asserts the card shows `Process ID: <pid>` after launch.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because the page does not render process ids yet.

**Step 3: Write minimal implementation**

Render the native process id in the runtime details block with a fallback label when unavailable.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

### Task 2: Add a Playwright/CDP runtime smoke utility

**Files:**
- Create: `scripts/runtime_smoke.mjs`
- Create: `scripts/runtime_smoke.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write the failing test**

Add tests for a small exported helper that:
- calls `connectOverCDP()` with the provided websocket endpoint
- reads `browser.version()`
- closes the browser handle
- rejects when no endpoint is provided

**Step 2: Run test to verify it fails**

Run: `npm test -- scripts/runtime_smoke.test.ts`
Expected: FAIL because the smoke module does not exist yet.

**Step 3: Write minimal implementation**

Implement `runRuntimeSmoke()` in `scripts/runtime_smoke.mjs`, wire a CLI entrypoint, and add an npm script like `runtime:smoke`. Install `playwright-core` as a dev dependency.

**Step 4: Run test to verify it passes**

Run: `npm test -- scripts/runtime_smoke.test.ts`
Expected: PASS

### Task 3: Refresh documentation to match reality

**Files:**
- Modify: `README.md`
- Modify: `docs/product/mvp-prd.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/runtime-contract.md`
- Modify: `src-tauri/src/runtime.rs`

**Step 1: Write the failing verification target**

Identify stale claims before editing:
- README is still Vite template text
- architecture docs still say native runtime and true ws endpoints are pending
- Rust runtime emits avoidable warnings during `cargo test` / `tauri build`

**Step 2: Run current verification to confirm the gap**

Run: `cd src-tauri && cargo test`
Expected: PASS with warnings, confirming the docs/runtime cleanup still matters.

**Step 3: Write minimal implementation**

- Replace README with project-specific quickstart and current capability summary
- Update docs to state that Tauri can now launch Chromium-family browsers and expose real ws endpoints
- Remove the current Rust warnings without changing behavior

**Step 4: Run focused verification**

Run: `cd src-tauri && cargo test`
Expected: PASS without the current warnings

### Task 4: Full verification and publication

**Files:**
- Modify: `docs/plans/2026-03-17-runtime-smoke-verification.md`

**Step 1: Run frontend tests**

Run: `npm test`
Expected: PASS

**Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS

**Step 4: Run Rust tests**

Run: `cd src-tauri && cargo test`
Expected: PASS

**Step 5: Run Tauri production build**

Run: `npm run tauri:build`
Expected: PASS and emit the built desktop binary path

**Step 6: Publish**

Create a GitHub branch from `main`, push the runtime verification changes through GitHub MCP, open a PR that references issue `#4` and notes issue `#2` is now fully verified/documented as well.
