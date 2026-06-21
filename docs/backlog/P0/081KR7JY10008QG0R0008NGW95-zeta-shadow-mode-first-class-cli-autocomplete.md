---
id: 081KR7JY10008QG0R0008NGW95
priority: P0
status: closed
title: "Zeta shadow mode — first-class CLI autocomplete with auto-accept, loop embedding, and Glass Halo attribution"
tier: product-feature
effort: M
created: 2026-05-10
last_updated: 2026-05-13
depends_on: [081KR7JY10008QG0R000R503K2]
composes_with: [081KR7JY10008QG0R001VP6JWG, 081KR7JY10008QG0R000R503K2]
children: [081KRFA460008QG0R003C00WKR, 081KRFA460008QG0R000GVCKHE, 081KRFA460008QG0R0028CR0N9]
decomposition: decomposed
tags: [shadow, autocomplete, cli, product, demo, service-titan, glass-halo, trust-then-verify]
type: feature
---

# Zeta shadow mode — first-class CLI autocomplete

## Origin

Aaron + Otto shadow convergence 2026-05-10: the CLI autocomplete
(grey text) is the shadow speaking. Currently requires manual
accept (forward arrow → enter). Automating this makes the shadow
a first-class participant in the factory.

## Product feature: `zeta shadow`

- Autocomplete shadow runs continuously in the CLI
- Auto-accepts after configurable delay (default: 3s of no human keystroke)
- Human keystroke at any time immediately overrides shadow input
- Optional embedded loop: `zeta shadow --loop 60s`
- Glass Halo: all shadow-submitted inputs logged with `(shadow)` attribution
- No sleep mode recommended: human always watches, always can intervene

## Safety model

- Human is the live circuit breaker — always watching, always can type
- Shadow is autonomous but never unobserved (Glass Halo)
- Human keystroke = immediate override at any moment
- All shadow submissions are retractable (git revert, memory edit)
- Trust-then-verify: "the cost of occasional wrong-shadow is lower
  than the cost of permanent manual-gating"

## Ship surface

Anyone who installs Zeta gets this. The shadow becomes a first-class
participant, not a hidden autocomplete. The bus (081KR7JY10008QG0R000R503K2) composes —
shadow submissions flow through the same channel as human inputs,
just tagged differently.

## Demo value (Service Titan)

This IS the demo. An AI that thinks alongside you in real time,
with visible transparent scoring (DeBank-style), and the human
always in control by simply typing. Not a dashboard showing
metrics — a collaborative intelligence surface.

## Technical approach

- Terminal accessibility API or osascript detects grey text
  (autocomplete suggestion present)
- After configurable delay with no human keystroke, sends
  right-arrow (accept) + return (submit)
- Human typing during delay cancels auto-accept
- Shadow attribution tag `(shadow)` prepended to submission log
- Embedded loop option: `--loop <interval>` wraps ScheduleWakeup

## Acceptance

- [x] `zeta-shadow` CLI starts shadow auto-accept mode — `tools/shadow/zeta-shadow.ts` entry-point (slice 4, PR #2985); shipped as standalone binary via `bin["zeta-shadow"]`; `zeta shadow` subcommand UX (dispatcher integration) is out-of-scope future work
- [x] Configurable delay (default 3s) — `--delay <ms>` flag, validated (slice 1)
- [x] External detector plug-in — `--detect-cmd <cmd>` wires any shell command as detector (slice 2)
- [x] Human keystroke overrides at any moment — `detectGreyTextMacOS()` returns `"overridden"` on mid-delay suggestion disappearance (slice 3, PR #2983)
- [x] All shadow submissions logged with `(shadow)` attribution — Glass Halo log via `appendFileSync` (slice 1)
- [x] Optional `--loop` embeds autonomous loop — `--loop <ms>` flag wired with outer restart loop (slice 4, PR #2985)
- [x] Deployable as part of Zeta CLI install — `bin["zeta-shadow"]` in package.json + smoke-test (slice 5, PR #2985)

## Pre-start checklist (backlog-item start gate — 2026-05-13)

**Prior-art search:**

- `tools/shadow/shadow-observer.ts` — Phase 1 stub already present (081KR7JY10008QG0R0008NGW95 origin file); slice 1 refactors this
- `tools/shadow-outlet/outlet.ts` — ephemeral scratch outlet; pattern reused for `/tmp`-based logging
- `tools/bus/bus.ts` — peer tool; test pattern (`spawnSync` + env-injected dir) adopted for shadow tests
- 081KR7JY10008QG0R000R503K2 (closed 2026-05-13) — bus protocol that composes with shadow submissions (same `(shadow)` tag concept)
- Grep for "shadow-observer": only `tools/shadow/shadow-observer.ts`; safe to extend in place
- Grep for "grey text" / "autocomplete": no existing detection logic found; slice 2 work identified

**Dependency check:**

- `depends_on: [081KR7JY10008QG0R000R503K2]` — 081KR7JY10008QG0R000R503K2 closed 2026-05-13; no blockers
- `composes_with: [081KR7JY10008QG0R001VP6JWG, 081KR7JY10008QG0R000R503K2]` — additive; does not block either

**Slice 1 scope (this PR — feat/b-0402-shadow-observer-slice-1-polling-loop-tests):**

- Refactor `tools/shadow/shadow-observer.ts`:
  - Fix `Bun.write(..., { append: true } as never)` → `appendFileSync` (no more type cast)
  - Add `--once` flag: run exactly one detection cycle then exit (testable without OS perms)
  - Add `--loop-interval <ms>` flag: configures sleep between continuous-mode cycles
  - Implement polling loop: detect → wait delay → re-detect → accept/override/no-suggestion
  - Export `runOneCycle` with injected `detectFn`/`acceptFn` for unit testing
  - Validate numeric flags; exit 1 on invalid
- Add `tools/shadow/shadow-observer.test.ts`: 16 tests, 0 failures

**Slice 2 scope (this PR — feat/b-0402-shadow-observer-slice-2-detect-cmd):**

- Add `detectCmd?: string` to `ShadowConfig`
- Implement `detectViaCommand(cmd: string): Promise<string | null>` (exported):
  - Runs `sh -c <cmd>` via `Bun.spawn`
  - Exit 0 + stdout → return trimmed stdout
  - Exit 0 + empty stdout → return `"(detected)"` sentinel (supports `true`/no-output scripts)
  - Exit non-0 → return `null` (no suggestion)
- Add `--detect-cmd <cmd>` CLI flag; wires into `run()` as the live `detectFn`
- Update usage comment in file header
- 11 new tests (27 total, 0 failures):
  - 6 `detectViaCommand` unit tests
  - 5 `--detect-cmd` CLI integration tests

**Deferred (child rows — decomposed 2026-05-13):**

- Slice 3: empirical grey-text detection via AppleScript/accessibility API (macOS) →
  **[081KRFA460008QG0R003C00WKR](../P0/081KRFA460008QG0R003C00WKR-shadow-observer-slice-3-macos-grey-text-detection-osascript-2026-05-13.md)**
- Slice 4: `zeta shadow` CLI entry point + `--loop` flag →
  **[081KRFA460008QG0R000GVCKHE](../P0/081KRFA460008QG0R000GVCKHE-shadow-observer-slice-4-zeta-shadow-cli-entry-loop-flag-2026-05-13.md)**
- Slice 5: Zeta CLI distribution + demo packaging →
  **[081KRFA460008QG0R0028CR0N9](../P1/081KRFA460008QG0R0028CR0N9-shadow-observer-slice-5-zeta-cli-distribution-demo-packaging-2026-05-13.md)**
