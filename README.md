# fingerprint-browser

Open-source fingerprint browser manager MVP built with Tauri, React, and Rust.

The current app focuses on a local desktop control plane:
- manage isolated browser profiles with independent proxy and fingerprint settings
- launch, stop, and restart Chromium-family browser instances from the desktop host
- expose CDP / Playwright connection metadata for running profiles
- auto-capture and record regression runs for CreepJS and BrowserLeaks
- switch the manager UI between English and Simplified Chinese

## Current status

Implemented today:
- Tauri desktop shell with Rust commands bridged into the React UI
- profile CRUD, grouping, tags, proxy settings, and local persistence
- runtime adapter that turns a profile into a normalized fingerprint and launch plan
- native Chromium-family runtime launcher in Tauri mode with real `wsEndpoint` discovery
- detection lab with running-profile auto capture, manual review, and diff history
- bilingual manager UI (`English` / `简体中文`)

Still planned:
- deeper site-specific parsing for CreepJS / BrowserLeaks result pages
- stronger anti-detect fingerprint injection and verification
- richer runtime health checks and log views

## Quickstart

Requirements:
- Node.js 20+
- Rust / Cargo
- macOS with an installed Chromium-family browser in a standard app path (`Google Chrome`, `Chromium`, `Brave Browser`, or `Microsoft Edge`)

Install dependencies:

```bash
npm install
```

Run the web preview:

```bash
npm run dev
```

Run the Tauri desktop app:

```bash
npm run tauri:dev
```

Build the frontend bundle:

```bash
npm run build
```

Build the desktop app and macOS installer artifacts:

```bash
npm run tauri:build
```

The packaged outputs are written to `src-tauri/target/release/bundle/`. On macOS this now includes:
- `app/fingerprint-browser.app`
- `dmg/fingerprint-browser_0.1.0_aarch64.dmg` or the matching build for your CPU

Because the local build is unsigned, macOS may ask you to confirm the first launch from Finder or System Settings.

## Verification commands

Frontend:

```bash
npm test
npm run lint
npm run build
```

Rust / Tauri:

```bash
cd src-tauri && cargo test
npm run tauri:build
```

## Runtime smoke check

When you already have a running browser endpoint, you can verify Playwright/CDP connectivity with:

```bash
npm run runtime:smoke -- ws://127.0.0.1:9222/devtools/browser/<id>
```

The smoke utility connects through `playwright-core`, prints the browser version, and closes the session.

## Project structure

- `src/App.tsx` - app shell, routing, dashboard, and settings
- `src/features/profiles/` - profile storage and management UI
- `src/features/runtime/` - runtime lifecycle manager and launch adapter
- `src/features/automation/` - detection lab and regression storage
- `src/features/i18n/` - locale state, translations, and formatting helpers
- `src/lib/desktop.ts` - desktop overview bridge
- `src/lib/automationDesktop.ts` - Tauri detection-probe bridge
- `src/lib/runtimeDesktop.ts` - Tauri runtime launch / stop / restart bridge
- `src-tauri/src/runtime.rs` - native Chromium-family launcher and CDP endpoint discovery
- `src-tauri/src/automation.rs` - native CDP probe for Detection Lab auto capture
- `docs/` - PRD, architecture, and implementation plans

## Related docs

- `docs/product/mvp-prd.md`
- `docs/architecture/system-design.md`
- `docs/architecture/runtime-contract.md`
