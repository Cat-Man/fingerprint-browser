# Runtime Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first Browser Runtime Adapter slice for issue `#5` so a profile can be transformed into a stable fingerprint contract and Chromium launch plan without coupling the UI to a concrete browser process.

**Architecture:** Extend the profile fingerprint model with normalized defaults for user agent and WebRTC policy, then add a pure runtime adapter module that converts a profile plus runtime context into a serializable Chromium launch plan. Reuse the current session-backed lifecycle flow and surface the adapter output in the UI so the later Tauri/Rust launcher can swap in behind the same contract.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

### Task 1: Normalize profile fingerprint defaults for runtime adapters

**Files:**
- Modify: `src/features/profiles/storage.ts`
- Modify: `src/features/profiles/storage.test.ts`

**Step 1: Write the failing test**

```ts
it("hydrates legacy stored profiles with runtime fingerprint defaults", () => {
  const storage = createMemoryStorage({
    [PROFILE_STORAGE_KEY]: JSON.stringify([
      {
        id: "profile-1",
        name: "Legacy profile",
        group: "Default",
        tags: [],
        notes: "",
        browserEngine: "Chromium",
        browserVersion: "stable",
        proxy: { type: "http", host: "", port: "", username: "", password: "" },
        fingerprint: {
          timezone: "UTC",
          locale: "en-US",
          geolocationPolicy: "prompt",
          screen: "1920x1080",
          memory: "8",
          hardwareConcurrency: "8",
        },
        createdAt: "2026-03-12T00:00:00.000Z",
        updatedAt: "2026-03-12T00:00:00.000Z",
      },
    ]),
  })

  const [profile] = loadProfiles(storage)

  expect(profile.fingerprint.userAgent).toBe("")
  expect(profile.fingerprint.webrtcPolicy).toBe("proxy-only")
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/storage.test.ts`
Expected: FAIL because the loaded profile fingerprint does not include the new runtime adapter defaults yet.

**Step 3: Write minimal implementation**

```ts
export type WebRtcPolicy = "proxy-only" | "default" | "disabled"

function normalizeFingerprint(fingerprint: Partial<ProfileFingerprint>): ProfileFingerprint {
  return {
    ...createEmptyProfileDraft().fingerprint,
    ...fingerprint,
  }
}
```

Add `userAgent` and `webrtcPolicy` to `ProfileFingerprint`, seed `webrtcPolicy` in `createEmptyProfileDraft()`, keep `userAgent` as an empty override slot, and normalize loaded profiles so old saved data still works. The adapter layer will later resolve the effective Chromium UA when the profile has not set one explicitly.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/profiles/storage.ts src/features/profiles/storage.test.ts
git commit -m "feat: normalize runtime fingerprint defaults"
```

### Task 2: Add the runtime adapter contract and Chromium launch plan builder

**Files:**
- Create: `src/features/runtime/adapter.ts`
- Create: `src/features/runtime/adapter.test.ts`
- Modify: `src/features/runtime/index.ts`

**Step 1: Write the failing test**

```ts
it("builds a chromium launch plan from a profile and running port", () => {
  const profile = makeProfile({
    proxy: { type: "http", host: "127.0.0.1", port: "8899", username: "", password: "" },
    fingerprint: {
      ...createEmptyProfileDraft().fingerprint,
      locale: "en-US",
      timezone: "America/New_York",
      screen: "1440x900",
      webrtcPolicy: "proxy-only",
    },
  })

  const plan = chromiumRuntimeAdapter.prepareLaunch({
    profile,
    debugPort: 9222,
  })

  expect(plan.fingerprint.language).toBe("en-US")
  expect(plan.fingerprint.timezone).toBe("America/New_York")
  expect(plan.launchArgs).toContain("--remote-debugging-port=9222")
  expect(plan.launchArgs).toContain("--window-size=1440,900")
  expect(plan.launchArgs).toContain("--proxy-server=http://127.0.0.1:8899")
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/runtime/adapter.test.ts`
Expected: FAIL because the runtime adapter contract does not exist yet.

**Step 3: Write minimal implementation**

```ts
export type FingerprintConfig = {
  userAgent: string
  language: string
  timezone: string
  resolution: { width: number; height: number }
  webrtcPolicy: WebRtcPolicy
}

export const chromiumRuntimeAdapter: RuntimeAdapter = {
  id: "chromium",
  prepareLaunch({ profile, debugPort }) {
    return {
      adapterId: "chromium",
      fingerprint: buildFingerprintConfig(profile),
      launchArgs: buildChromiumArgs(profile, debugPort),
      metadata: {
        browserVersion: profile.browserVersion,
        proxy: buildProxyMetadata(profile),
      },
    }
  },
}
```

Generate a serializable launch plan with `fingerprint`, `launchArgs`, and lightweight metadata that a later Tauri/Rust runner can execute directly. Also add a resolver so only supported engines receive a Chromium launch plan.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/runtime/adapter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/runtime/adapter.ts src/features/runtime/adapter.test.ts src/features/runtime/index.ts
git commit -m "feat: add chromium runtime adapter"
```

### Task 3: Surface adapter output in the Profiles UI

**Files:**
- Modify: `src/features/profiles/ProfilesPage.tsx`
- Modify: `src/features/profiles/ProfilesPage.test.tsx`
- Modify: `src/App.css`

**Step 1: Write the failing test**

```ts
it("shows the runtime adapter preview and remote debugging arg for a running profile", async () => {
  saveProfiles([profileA])
  render(<ProfilesPage />)

  await user.click(screen.getByRole("button", { name: /start profile a/i }))

  expect(screen.getByText(/Adapter: chromium/i)).toBeInTheDocument()
  expect(screen.getByText(/--remote-debugging-port=9222/i)).toBeInTheDocument()
  expect(screen.getByText(/--window-size=1920,1080/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because the page does not render runtime adapter output yet.

**Step 3: Write minimal implementation**

```tsx
const launchPlan = instance
  ? chromiumRuntimeAdapter.prepareLaunch({
      profile,
      debugPort: instance.debugPort,
    })
  : null
```

Render the adapter name, fingerprint summary, and the full launch argument preview alongside the lifecycle details on each profile card so the WebRTC policy and future adapter flags remain visible.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/profiles/ProfilesPage.tsx src/features/profiles/ProfilesPage.test.tsx src/App.css
git commit -m "feat: preview runtime launch plans"
```

### Task 4: Verify and publish issue #5

**Files:**
- Create: `docs/plans/2026-03-12-runtime-adapter.md`

**Step 1: Run focused adapter tests**

Run: `npm test -- src/features/profiles/storage.test.ts src/features/runtime/adapter.test.ts src/features/profiles/ProfilesPage.test.tsx`
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

Create a GitHub branch from `main`, push the adapter files through GitHub MCP, open a PR referencing `#5`, and note that this slice establishes the serializable launch contract that the future native runtime will execute.
