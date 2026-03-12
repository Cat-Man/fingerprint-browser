# Project Skeleton Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the first `fingerprint-browser` desktop skeleton for issue `#2` with a Tauri shell, React manager UI, and a minimal Rust-to-frontend command bridge.

**Architecture:** Keep the app as a single Tauri workspace for the MVP: a React/Vite frontend renders the manager shell while `src-tauri` exposes a tiny typed command that reports app status back to the dashboard. Use small placeholder modules for profiles, runtime, and automation so later issues can extend the structure without reworking the shell.

**Tech Stack:** React 19, React Router, Vite, Vitest, Tauri 2, Rust

### Task 1: Capture the bridge behavior with tests

**Files:**
- Create: `src/lib/desktop.test.ts`
- Create: `src/lib/desktop.ts`
- Test: `src/lib/desktop.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { loadDesktopOverview } from "./desktop"

describe("loadDesktopOverview", () => {
  it("returns a web preview fallback when Tauri is unavailable", async () => {
    await expect(
      loadDesktopOverview({
        isTauri: () => false,
        invoke: async () => {
          throw new Error("should not invoke")
        },
      }),
    ).resolves.toMatchObject({ source: "web-preview" })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/desktop.test.ts`
Expected: FAIL because `loadDesktopOverview` does not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function loadDesktopOverview(deps = defaultDesktopBridge) {
  if (!deps.isTauri()) {
    return { source: "web-preview" }
  }

  return deps.invoke("get_app_overview")
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/desktop.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/desktop.ts src/lib/desktop.test.ts
git commit -m "test: cover desktop bridge fallback"
```

### Task 2: Wire the manager shell to the desktop bridge

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`
- Create: `src/features/profiles/index.ts`
- Create: `src/features/runtime/index.ts`
- Create: `src/features/automation/index.ts`

**Step 1: Write the failing test**

```ts
it("shows the bridge status in the dashboard", async () => {
  render(<App />)
  expect(await screen.findByText(/web preview fallback/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL because the dashboard does not render bridge status yet.

**Step 3: Write minimal implementation**

```ts
const [overview, setOverview] = useState<DesktopOverview | null>(null)

useEffect(() => {
  loadDesktopOverview().then(setOverview)
}, [])
```

Render the returned status in the dashboard and move page bullet lists into `src/features/*` placeholders so the structure is ready for follow-up issues.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/App.css src/App.test.tsx src/features
git commit -m "feat: add dashboard shell bridge status"
```

### Task 3: Clean up Tauri project metadata and command wiring

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Write the failing test**

There is no local Rust toolchain in this workspace, so use configuration assertions instead of a compiled Rust test:

```bash
rg -n 'name = "app"|description = "A Tauri App"|com.tauri.dev|app_lib::run' src-tauri
```

**Step 2: Run the check to verify it fails**

Run: `rg -n 'name = "app"|description = "A Tauri App"|com.tauri.dev|app_lib::run' src-tauri`
Expected: MATCHES are found in the generated scaffold.

**Step 3: Write minimal implementation**

```rs
#[derive(serde::Serialize)]
struct AppOverview {
  app_name: &'static str,
  runtime: &'static str,
  source: &'static str,
}

#[tauri::command]
fn get_app_overview() -> AppOverview { ... }
```

Update crate names, package metadata, bundle identifier, and the window defaults so they match `fingerprint-browser`.

**Step 4: Run verification to ensure the old scaffold markers are gone**

Run: `rg -n 'name = "app"|description = "A Tauri App"|com.tauri.dev|app_lib::run' src-tauri`
Expected: no output

**Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/main.rs src-tauri/tauri.conf.json
git commit -m "feat: align tauri shell metadata"
```

### Task 4: Verify the published skeleton

**Files:**
- Modify: `package.json` (only if scripts need cleanup)
- Modify: `README.md` (only if the branch base requires reconciliation)
- Create: `docs/plans/2026-03-12-project-skeleton.md`

**Step 1: Run focused tests**

Run: `npm test`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build`
Expected: PASS and Vite outputs `dist/`

**Step 3: Record current validation gap**

Run: `cargo --version`
Expected: command not found in this workspace, confirming Rust/Tauri compilation remains unverified locally.

**Step 4: Prepare publish set**

Push the validated frontend files, `src-tauri` sources, lockfile, and this plan document through GitHub MCP on a branch created from `docs/bootstrap-readme` so PR `#7` stays the branch base for the new code work.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: bootstrap fingerprint-browser desktop shell"
```
