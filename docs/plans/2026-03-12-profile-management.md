# Profile Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver the first usable Profile management slice for issue `#3` with create/edit/delete/duplicate actions, per-profile proxy settings, and local persistence across restarts.

**Architecture:** Start with a `localStorage`-backed JSON store behind small `loadProfiles` / `saveProfiles` helpers so the UI is fully testable in Vitest and easy to swap to a Tauri JSON or SQLite backend later. Move the Profiles screen into its own feature component that owns form state, persists profile arrays, and renders a list of profile cards with actions.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, TypeScript

### Task 1: Add the profile data model and storage adapter

**Files:**
- Create: `src/features/profiles/storage.ts`
- Create: `src/features/profiles/storage.test.ts`
- Modify: `src/features/profiles/index.ts`

**Step 1: Write the failing test**

```ts
it("returns an empty list when storage payload is invalid", () => {
  const storage = createMemoryStorage({
    "fingerprint-browser.profiles.v1": "{bad json",
  })

  expect(loadProfiles(storage)).toEqual([])
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/storage.test.ts`
Expected: FAIL because `loadProfiles` is not implemented yet.

**Step 3: Write minimal implementation**

```ts
export function loadProfiles(storage: StorageLike = window.localStorage) {
  const raw = storage.getItem(PROFILE_STORAGE_KEY)
  if (!raw) return []

  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}
```

Add the profile types, defaults, save helper, and duplicate helper used by the page.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/storage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/profiles/index.ts src/features/profiles/storage.ts src/features/profiles/storage.test.ts
git commit -m "feat: add profile storage helpers"
```

### Task 2: Build the interactive Profiles page

**Files:**
- Create: `src/features/profiles/ProfilesPage.tsx`
- Create: `src/features/profiles/ProfilesPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Step 1: Write the failing test**

```ts
it("creates a profile with independent proxy settings and persists it", async () => {
  render(<ProfilesPage />)
  await user.type(screen.getByLabelText(/profile name/i), "Shop A")
  await user.type(screen.getByLabelText(/proxy host/i), "127.0.0.1")
  await user.type(screen.getByLabelText(/proxy port/i), "8899")
  await user.click(screen.getByRole("button", { name: /create profile/i }))

  expect(screen.getByText("Shop A")).toBeInTheDocument()
  expect(screen.getByText(/http:\/\/127.0.0.1:8899/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because the interactive Profiles page does not exist yet.

**Step 3: Write minimal implementation**

```tsx
const [profiles, setProfiles] = useState(() => loadProfiles())
const [draft, setDraft] = useState(createEmptyProfileDraft())

function handleSubmit(event: FormEvent) {
  event.preventDefault()
  const nextProfiles = [...profiles, buildProfile(draft)]
  setProfiles(nextProfiles)
  saveProfiles(nextProfiles)
}
```

Add edit, duplicate, and delete actions plus a persisted list view.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/profiles/ProfilesPage.tsx src/features/profiles/ProfilesPage.test.tsx src/App.tsx src/App.css
git commit -m "feat: add profile management page"
```

### Task 3: Cover persistence, edit, duplicate, and delete behaviors

**Files:**
- Modify: `src/features/profiles/ProfilesPage.test.tsx`
- Modify: `src/features/profiles/ProfilesPage.tsx`

**Step 1: Write the failing test**

```ts
it("hydrates persisted profiles and supports edit, duplicate, and delete", async () => {
  seedProfiles([existingProfile])
  render(<ProfilesPage />)

  expect(screen.getByText(existingProfile.name)).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: /duplicate seeded profile/i }))
  await user.click(screen.getByRole("button", { name: /edit seeded profile/i }))
  await user.clear(screen.getByLabelText(/proxy host/i))
  await user.type(screen.getByLabelText(/proxy host/i), "proxy.example.com")
  await user.click(screen.getByRole("button", { name: /save changes/i }))

  expect(screen.getByText(/proxy.example.com/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: FAIL because not all list actions are implemented yet.

**Step 3: Write minimal implementation**

```tsx
function handleDuplicate(profileId: string) { ... }
function handleEdit(profileId: string) { ... }
function handleDelete(profileId: string) { ... }
```

Keep all mutations funneled through one persistence helper so `localStorage` always matches the rendered list.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/features/profiles/ProfilesPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/profiles/ProfilesPage.tsx src/features/profiles/ProfilesPage.test.tsx
git commit -m "test: cover profile list actions"
```

### Task 4: Verify and publish the issue #3 slice

**Files:**
- Create: `docs/plans/2026-03-12-profile-management.md`
- Modify: `package-lock.json` (only if dependency metadata changes)

**Step 1: Run the profile feature tests**

Run: `npm test -- src/features/profiles/storage.test.ts src/features/profiles/ProfilesPage.test.tsx`
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

Create a new GitHub branch from `feat/issue-2-project-skeleton`, push the changed files with GitHub MCP, open a stacked PR referencing `#3`, and note that persistence currently uses the frontend JSON/localStorage adapter so the next iteration can swap in a Tauri-backed store.
