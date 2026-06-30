---
id: B-0319
priority: P1
status: open
title: "GitHub settings reconciliation — UI snapshot vs expected.json drift detection"
tier: agent-capability-expansion
effort: S
parent: B-0064
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0318]
composes_with: [B-0064, B-0317]
tags: [agent-capability, github-ui, playwright, settings, drift-detection, hygiene]
type: friction-reducer
---

# GitHub settings reconciliation

Build `tools/playwright/github-ui/reconcile-settings.ts` —
compares a live UI snapshot (B-0318) of repo/org settings
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
  1. Calls the snapshot tool (B-0318) on the repo settings
     URL and org settings URL.
  2. Loads `tools/hygiene/github-settings.expected.json`.
  3. Maps UI-extracted toggles/values to the corresponding
     keys in the expected-state JSON.
  4. Outputs a structured diff: `{ match: [...], drift: [...],
     unmapped: [...] }`.
  5. `unmapped` captures UI elements that have no
     corresponding key in expected.json — these are
     candidates for the feature-discovery cadence (B-0323).
- The mapping between UI labels and JSON keys is a small
  lookup table maintained alongside the tool.

## Done-criteria

- [ ] `tools/playwright/github-ui/reconcile-settings.ts`
      exists.
- [ ] Running it produces a drift report against the live
      Zeta repo settings.
- [ ] At least 3 settings are mapped (branch protection,
      secret scanning, dependabot).

## What this row does NOT do

- Does NOT fix detected drift — that requires mutation
  capability (B-0321) or API calls.
- Does NOT replace the API-based settings audit — it
  supplements it for UI-only surfaces.
