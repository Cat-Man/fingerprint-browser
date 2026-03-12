# Instance Lifecycle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first browser instance lifecycle slice for issue `#4` so a profile can be started, stopped, restarted, and inspected for connection details in the UI.

**Architecture:** Add a pure runtime manager module that owns debug-port allocation, profile locking, Playwright endpoint generation, and log entries. Keep runtime state in a session-backed adapter so the UI stays testable in Vitest today and can later be swapped for a real Tauri/Rust process manager without rewriting the view logic.

**Tech Stack:** React 19, Vitest, Testing Library, TypeScript

### Task 1: Add the runtime manager and storage adapter

**Files:**
- Create: `src/features/runtime/manager.ts`
- Create: `src/features/runtime/manager.test.ts`
- Modify: `src/features/runtime/index.ts`

**Step 1: Write the failing test**

```ts
it("allocates incremental ports and rejects duplicate starts for the same profile", () => {
  const state = createRuntimeState()
  const first = startProfileInstance(state, makeProfile("Profile A"))
  const second = startProfileInstance(first.instances, makeProfile("Profile B"))

  expect(first.instance.debugPort).toBe(9222)
  expect(second.instance.debugPort).toBe(9223)
  expect(() => startProfileInstance(second.instances, makeProfile("Profile A"))).toThrow(
    /already running/i,
  )
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/runtime/manager.test.ts`
Expected: FAIL because the runtime manager does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function startProfileInstance(instances, profile) {
  if (instances.some((instance) => instance.profileId === profile.id && instance.status === "running")) {
    throw new Error(`Profile ${profile.name} is already running`)
  }

  const debugPort = allocateDebugPort(instances)
  return { instances: [...instances, createRunningInstance(profile, debugPort)] }
}
```

Also add stop/restart helpers, session storage load/save, and runtime summary helpers.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/runtime/manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/runtime/index.ts src/features/runtime/manager.ts src/features/runtime/manager.test.ts
git commit -m "feat: add runtime lifecycle manager"
```

### Task 2: Add lifecycle controls to the Profiles page

**Files:**
- Modify: `src/features/profiles/ProfilesPage.tsx`
- Modify: `src/features/profiles/ProfilesPage.test.tsx`
- Modify: `src/App.css`

**Step 1: Write the failing test**

```ts
it("starts a profile and shows runtime status, debug port, and Playwright endpoint", async () => {
  seedProfiles([profileA])
  render(<ProfilesPage />)

  await user.click(screen.getByRole("button", { name: /start profile a/i }))

  expect(screen.getByText(/running/i)).toBeInTheDocument()
  expect(screen.getByText(/9222/)).toBeInTheDocument()
  expect(screen.getByText(/ws:\/\/127.0.0.1:9222/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because the Profiles page does not render runtime controls yet.

**Step 3: Write minimal implementation**

```tsx
const [instances, setInstances] = useState(() => loadRuntimeInstances())

function handleStart(profile: BrowserProfile) {
  const result = startProfileInstance(instances, profile)
  setInstances(result.instances)
}
```

Render lifecycle buttons and a runtime details block on each profile card.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/profiles/ProfilesPage.tsx src/features/profiles/ProfilesPage.test.tsx src/App.css
git commit -m "feat: add lifecycle controls to profiles"
```

### Task 3: Cover stop, restart, and profile lock behavior

**Files:**
- Modify: `src/features/profiles/ProfilesPage.test.tsx`
- Modify: `src/features/runtime/manager.test.ts`
- Modify: `src/features/profiles/ProfilesPage.tsx`

**Step 1: Write the failing test**

```ts
it("restarts a running profile and frees the lock after stop", async () => {
  seedProfiles([profileA])
  render(<ProfilesPage />)

  await user.click(screen.getByRole("button", { name: /start profile a/i }))
  await user.click(screen.getByRole("button", { name: /restart profile a/i }))
  await user.click(screen.getByRole("button", { name: /stop profile a/i }))

  expect(screen.getByText(/stopped/i)).toBeInTheDocument()
  expect(screen.getByText(/lock released/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/runtime/manager.test.ts src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because restart/stop behaviors are incomplete.

**Step 3: Write minimal implementation**

```ts
export function stopProfileInstance(instances, profileId) { ... }
export function restartProfileInstance(instances, profile) { ... }
```

Keep the latest runtime record visible after stop so the UI can show the last port, endpoint status, and recent log messages.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/runtime/manager.test.ts src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/runtime/manager.ts src/features/runtime/manager.test.ts src/features/profiles/ProfilesPage.tsx src/features/profiles/ProfilesPage.test.tsx
git commit -m "test: cover instance lifecycle flows"
```

### Task 4: Verify and publish issue #4

**Files:**
- Create: `docs/plans/2026-03-12-instance-lifecycle.md`

**Step 1: Run focused runtime tests**

Run: `npm test -- src/features/runtime/manager.test.ts src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

**Step 2: Run the full project tests**

Run: `npm test`
Expected: PASS

**Step 3: Run static verification**

Run: `npm run lint`
Expected: PASS

**Step 4: Run the production build**

Run: `npm run build`
Expected: PASS

**Step 5: Publish**

Create a GitHub branch from `main`, push the lifecycle files through GitHub MCP, open a PR referencing `#4`, and note that this slice simulates instance management in the frontend/session adapter until the real Tauri process supervisor arrives.
