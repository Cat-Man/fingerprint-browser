# Runtime Health Polling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic runtime health polling for running profiles so health status, messages, and recent logs stay current without manual refresh.

**Architecture:** Reuse the existing `refreshProfileRuntimeHealth()` flow instead of inventing a second probe path. The React layer owns polling lifecycle in both preview and Tauri modes, while the native runtime remains the source of truth for process liveness and CDP reachability whenever Tauri is available.

**Tech Stack:** React, TypeScript, Vitest, Tauri 2, Rust

### Task 1: Add a polling controller in the runtime manager

**Files:**
- Modify: `src/features/runtime/manager.ts`
- Modify: `src/features/runtime/manager.test.ts`

**Step 1: Write the failing tests**

Add tests that:
- start polling only for `running` instances
- ignore `stopped` instances
- keep the existing `debugPort` and instance identity while updating `health`
- stop polling cleanly when the runtime transitions to `stopped`

**Step 2: Run focused tests to verify they fail**

Run: `npm test -- src/features/runtime/manager.test.ts`
Expected: FAIL because polling helpers do not exist yet.

**Step 3: Write minimal implementation**

Add:
- a small polling scheduler keyed by `profileId`
- a default polling interval constant
- helpers to start and stop runtime health polling
- state update logic that reuses `refreshProfileRuntimeHealth()`

**Step 4: Run focused tests**

Run: `npm test -- src/features/runtime/manager.test.ts`
Expected: PASS

### Task 2: Wire polling into the Profiles page lifecycle

**Files:**
- Modify: `src/features/profiles/ProfilesPage.tsx`
- Modify: `src/features/profiles/ProfilesPage.test.tsx`

**Step 1: Write the failing page tests**

Add tests that:
- automatically refresh a running profile after the polling interval elapses
- do not poll profiles that are not running
- stop polling after a profile becomes `stopped`

**Step 2: Run focused tests to verify they fail**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because the page does not own polling lifecycle yet.

**Step 3: Write minimal implementation**

Add:
- a page-level effect that starts polling for running profile cards
- cleanup on unmount
- logic to avoid duplicate timers when the profile list rerenders

**Step 4: Run focused tests**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

### Task 3: Refresh copy and docs for automatic health checks

**Files:**
- Modify: `src/features/i18n/messages.ts`
- Modify: `README.md`
- Modify: `docs/product/mvp-prd.md`
- Modify: `docs/architecture/system-design.md`

**Step 1: Update copy and docs**

Document:
- runtime health now supports automatic polling for running instances
- manual refresh remains available as an explicit diagnostics action
- auto-recovery and native log streaming are still future work

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

Push changed files to `feat/issue-25-runtime-health-polling`, open a PR against `main`, request Copilot review, and merge once the branch is clean. Reference `Closes #25` in the PR body.
