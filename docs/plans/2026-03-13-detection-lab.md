# Detection Lab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first Detection Lab slice for issue `#6` so operators can run repeatable manual checks against CreepJS and BrowserLeaks, store observations per profile, and review differences between runs.

**Architecture:** Add an automation storage module that persists manual regression runs in `localStorage`, computes diffs between the latest two runs for the same profile/target pair, and exposes target definitions plus checklists for CreepJS and BrowserLeaks. Surface that model in a dedicated React page wired into the app shell so users can select a profile, record observed fingerprint results, and inspect regression history without depending on a real native launcher yet.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

### Task 1: Add detection-lab storage, target definitions, and diff helpers

**Files:**
- Create: `src/features/automation/storage.ts`
- Create: `src/features/automation/storage.test.ts`
- Modify: `src/features/automation/index.ts`

**Step 1: Write the failing test**

```ts
it("stores manual regression runs and reports field-level diffs", () => {
  const storage = createMemoryStorage()
  const first = createRegressionRun({
    profileId: "profile-a",
    profileName: "Profile A",
    targetId: "creepjs",
    observed: {
      userAgent: "Chrome 136",
      timezone: "UTC",
      webrtc: "proxy-only",
    },
  })
  const second = createRegressionRun({
    profileId: "profile-a",
    profileName: "Profile A",
    targetId: "creepjs",
    observed: {
      userAgent: "Chrome 136",
      timezone: "Asia/Shanghai",
      webrtc: "disabled",
    },
  })

  saveRegressionRuns([first, second], storage)

  const runs = loadRegressionRuns(storage)
  const diff = diffRegressionRuns(runs[0], runs[1])

  expect(diff.changedFields).toEqual(["timezone", "webrtc"])
  expect(getDetectionTarget("browserleaks")?.name).toMatch(/browserleaks/i)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/automation/storage.test.ts`
Expected: FAIL because the automation storage module does not exist yet.

**Step 3: Write minimal implementation**

```ts
export type DetectionTargetId = "creepjs" | "browserleaks"

export function diffRegressionRuns(previous: RegressionRun, current: RegressionRun) {
  const changedFields = REGRESSION_FIELDS.filter(
    (field) => previous.observed[field] !== current.observed[field],
  )

  return { changedFields }
}
```

Define serializable target metadata, manual checklist steps, storage adapters, run factories, and helpers for latest-history lookup and field-level diffing.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/automation/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/automation/storage.ts src/features/automation/storage.test.ts src/features/automation/index.ts
git commit -m "feat: add detection lab storage"
```

### Task 2: Build the Detection Lab page for recording runs and reviewing regressions

**Files:**
- Create: `src/features/automation/AutomationPage.tsx`
- Create: `src/features/automation/AutomationPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

**Step 1: Write the failing test**

```ts
it("records a CreepJS run for a selected profile and shows checklist plus diff summary", async () => {
  saveProfiles([profileA])
  saveRegressionRuns([
    createRegressionRun({
      profileId: profileA.id,
      profileName: profileA.name,
      targetId: "creepjs",
      observed: { timezone: "UTC", webrtc: "proxy-only" },
    }),
  ])

  render(<AutomationPage />)

  await user.selectOptions(screen.getByLabelText(/profile/i), profileA.id)
  await user.selectOptions(screen.getByLabelText(/target/i), "creepjs")
  await user.clear(screen.getByLabelText(/timezone/i))
  await user.type(screen.getByLabelText(/timezone/i), "Asia/Shanghai")
  await user.click(screen.getByRole("button", { name: /save regression run/i }))

  expect(screen.getByText(/step 1/i)).toBeInTheDocument()
  expect(screen.getByText(/timezone changed/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/automation/AutomationPage.test.tsx src/App.test.tsx`
Expected: FAIL because the page and app routing do not exist yet.

**Step 3: Write minimal implementation**

```tsx
const [runs, setRuns] = useState(() => loadRegressionRuns())
const selectedTarget = getDetectionTarget(formState.targetId)
const latestDiff = getLatestRegressionDiff(runs, formState.profileId, formState.targetId)
```

Add a dedicated page and nav entry that lets users:
- choose a profile and target site
- review the target checklist and URL
- enter observed values for the required fingerprint fields
- save the run into local storage
- inspect recent history and the latest diff summary for that profile/target pair

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/automation/AutomationPage.test.tsx src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/automation/AutomationPage.tsx src/features/automation/AutomationPage.test.tsx src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: add detection lab page"
```

### Task 3: Add dashboard/reporting hooks and document the manual regression workflow

**Files:**
- Modify: `src/App.tsx`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/product/mvp-prd.md`
- Modify: `docs/plans/2026-03-13-detection-lab.md`

**Step 1: Write the failing test**

```ts
it("shows recorded regression coverage on the dashboard", async () => {
  saveRegressionRuns([
    createRegressionRun({ profileId: "profile-a", profileName: "Profile A", targetId: "creepjs" }),
    createRegressionRun({ profileId: "profile-b", profileName: "Profile B", targetId: "browserleaks" }),
  ])

  render(<App />)

  expect(await screen.findByText(/^2$/)).toBeInTheDocument()
  expect(screen.getByText(/profiles covered/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL because the dashboard does not yet summarize detection-lab coverage.

**Step 3: Write minimal implementation**

```tsx
const regressionSummary = summarizeRegressionRuns(loadRegressionRuns())
```

Show recorded regression coverage on the dashboard and update the architecture / PRD text so the documented current state matches the shipped code after issue `#6` lands.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/App.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx docs/architecture/system-design.md docs/product/mvp-prd.md docs/plans/2026-03-13-detection-lab.md
git commit -m "docs: capture detection lab workflow"
```

### Task 4: Verify and publish issue #6

**Files:**
- Create: `docs/plans/2026-03-13-detection-lab.md`

**Step 1: Run focused automation tests**

Run: `npm test -- src/features/automation/storage.test.ts src/features/automation/AutomationPage.test.tsx src/App.test.tsx`
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

Create a GitHub branch from `main`, push the detection-lab files through GitHub MCP, open a PR referencing `#6`, and note that this slice establishes the manual regression workflow while the native runtime and automated probes are still upcoming.
