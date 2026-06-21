---
id: 081KRFA460008QG0R003C00WKR
priority: P0
status: closed
title: "Shadow observer slice 3 — macOS grey-text detection via osascript"
tier: product-feature
effort: S
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KR7JY10008QG0R0008NGW95
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: feature
tags: [shadow, autocomplete, cli, macos, osascript, accessibility, glass-halo]
---

# Shadow observer slice 3 — macOS grey-text detection via osascript

## Origin

081KR7JY10008QG0R0008NGW95 decomposition 2026-05-13. Slices 1 and 2 shipped (PRs #2973, #2975).
`detectGreyText()` in `tools/shadow/shadow-observer.ts` is currently a Phase 1
stub that always returns `null`. This slice replaces it with a real macOS
implementation.

## Technical context

`runOneCycle()` already implements the "detect → delay → re-detect → accept or
override" pattern. The keystroke-override is realised by the re-detect step: if
grey text disappeared during the delay, a human typed something — the cycle
returns `"overridden"`. The stub `detectGreyText()` is the only gap.

`--detect-cmd <cmd>` (slice 2) lets callers supply any shell command as the
detector. This slice adds the built-in macOS implementation that fires when no
`--detect-cmd` is supplied.

## Scope

### What to add

1. **`tools/shadow/detect-grey-text.applescript`** (or inline JXA in a helper) —
   queries the focused terminal emulator's accessibility tree for autocomplete
   suggestion text:
   - Identify the frontmost terminal process (`Terminal.app`, `iTerm2`, `Warp`, etc.)
   - Walk `AXFocusedUIElement` → `AXValue`/`AXSelectedText` chain
   - Return suggestion text if found; empty if not

2. **`detectGreyTextMacOS(terminalApp?: string): Promise<string | null>`** — exported
   from `tools/shadow/shadow-observer.ts`:
   - Runs `osascript detect-grey-text.applescript` via `Bun.spawn`
   - Exit 0 + non-empty stdout → return trimmed text
   - Exit 0 + empty stdout → return `null`
   - Non-macOS guard: if `process.platform !== "darwin"` → log warning + return `null`
   - osascript permission denied (error 1002) → log warning + return `null` (graceful)

3. **Wire into `detectGreyText()`**: replace stub body with call to
   `detectGreyTextMacOS()` so the default detection path uses the real
   implementation.

4. **Exports**: `detectGreyTextMacOS` added to the public export surface of
   `shadow-observer.ts`.

### Tests (12 new, ~39 total, 0 failures)

- 4 unit tests for `detectGreyTextMacOS`:
  - non-darwin returns null + logs warning
  - osascript exit 0 with stdout → returns text
  - osascript exit 0 with empty stdout → returns null
  - osascript non-zero exit → returns null + logs warning
- 4 `--detect-cmd` integration tests for the full detect→delay→re-detect→accept path
  using a mock that simulates "suggestion present on first call, gone on second"
  (verifying the `"overridden"` path)
- 4 `--detect-cmd` integration tests for the full detect→delay→re-detect→accept path
  using a mock that returns suggestion on both calls (verifying the `"accepted"` path)

### Not in scope

- Keystroke interrupt via TTY raw-mode (`Promise.race` on stdin) — the re-detect
  pattern already handles override; raw-mode is a follow-up optimisation if latency
  matters
- Windows / Linux detection — left for later; `--detect-cmd` covers cross-platform
- Automated accessibility permission prompting — user must grant in
  System Preferences → Privacy & Security → Accessibility

## Acceptance

- [x] `detectGreyTextMacOS()` exported from `tools/shadow/shadow-observer.ts`
- [x] Non-macOS guard logs warning and returns `null` without crashing
- [x] `detect-grey-text.applescript` present in `tools/shadow/`
- [x] Built-in `detectGreyText()` calls `detectGreyTextMacOS()` (stub replaced)
- [x] 12 new tests, 0 failures (`bun test tools/shadow/shadow-observer.test.ts`) — 39 total pass
- [x] "Human keystroke overrides at any moment" 081KR7JY10008QG0R0008NGW95 acceptance criterion satisfied
  (the re-detect path returns `"overridden"` when suggestion disappears during delay)

## Shipped

PR #2983 — merged 2026-05-13. All acceptance criteria verified post-merge.

## Pre-start checklist

**Prior-art search:**

- `tools/shadow/shadow-observer.ts` — current stub at `detectGreyText()`:L70-90
- `--detect-cmd` (slice 2, PR #2975) — the injection point this slice plugs into
- No existing `detect-grey-text.applescript` in repo (grep confirms)
- 081KR7JY10008QG0R0008NGW95 acceptance criteria: "Human keystroke overrides at any moment — slice 3
  (requires empirical grey-text detection)"

**Dependency check:**

- `depends_on: []` — slice 1 + 2 already merged; no blockers
- `parent: 081KR7JY10008QG0R0008NGW95` — composes with existing polling loop + `--detect-cmd`
