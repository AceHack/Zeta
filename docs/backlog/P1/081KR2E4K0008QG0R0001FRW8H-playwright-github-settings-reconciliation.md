---
id: 081KR2E4K0008QG0R0001FRW8H
priority: P1
status: closed
title: "GitHub settings reconciliation — UI snapshot vs expected.json drift detection"
tier: agent-capability-expansion
effort: S
parent: 081KQ8P5D0008QG0R0010FP5SY
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R003RVDX91]
composes_with: [081KQ8P5D0008QG0R0010FP5SY, 081KR2E4K0008QG0R0031QR36N]
tags: [agent-capability, github-ui, playwright, settings, drift-detection, hygiene]
type: friction-reducer
---

# GitHub settings reconciliation

Build `tools/playwright/github-ui/reconcile-settings.ts` —
compares a live UI snapshot (081KR2E4K0008QG0R003RVDX91) of repo/org settings
against the declared expected state in
`tools/hygiene/github-settings.expected.json` and reports
drift.

## Why

The expected-settings file already exists and is maintained
by the `github-surface-triage` skill. Today, drift detection
relies on the REST API — but some GitHub settings are
UI-only (not exposed via API). This tool closes that gap by
reading the UI directly and comparing.

## Scope

- Implement a TS module that:
  1. Calls the snapshot tool (081KR2E4K0008QG0R003RVDX91) on the repo settings
     URL and org settings URL.
  2. Loads `tools/hygiene/github-settings.expected.json`.
  3. Maps UI-extracted toggles/values to the corresponding
     keys in the expected-state JSON.
  4. Outputs a structured diff: `{ match: [...], drift: [...],
     unmapped: [...] }`.
  5. `unmapped` captures UI elements that have no
     corresponding key in expected.json — these are
     candidates for the feature-discovery cadence (081KR2E4K0008QG0R003E09GMM).
- The mapping between UI labels and JSON keys is a small
  lookup table maintained alongside the tool.

## Done-criteria

- [x] `tools/playwright/github-ui/reconcile-settings.ts`
      exists.
- [x] Running it produces a drift report against the live
      Zeta repo settings (exit 0 clean, exit 2 drift).
- [x] At least 3 settings are mapped (branch protection:
      allow-merge-commit/squash/rebase; secret scanning:
      secret-scanning + push-protection + ai-detection;
      dependabot: dependabot-security-updates).

## What this row does NOT do

- Does NOT fix detected drift — that requires mutation
  capability (081KR2E4K0008QG0R000YH9DC6) or API calls.
- Does NOT replace the API-based settings audit — it
  supplements it for UI-only surfaces.
