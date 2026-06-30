---
id: B-0323
priority: P1
status: open
title: "GitHub feature-discovery diff cadence — weekly UI snapshot comparison to spot new features"
tier: agent-capability-expansion
effort: S
parent: B-0064
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0318]
composes_with: [B-0064, B-0319]
tags: [agent-capability, github-ui, playwright, feature-discovery, cadence]
type: friction-reducer
---

# GitHub feature-discovery diff cadence

Build `tools/playwright/github-ui/feature-diff.ts` — a
scheduled tool that snapshots key GitHub settings/UI pages,
diffs against the prior snapshot, and surfaces **new UI
elements** as a signal that GitHub shipped a feature the
agent should investigate.

## Why

This is Phase 3 of B-0064 — the feature-discovery payload.
GitHub ships features continuously; many appear in the UI
before being documented or API-exposed. A weekly diff catches
these early and gives the agent + maintainer first-mover
awareness.

## Scope

- Implement a TS module that:
  1. Defines a list of pages to monitor (repo settings,
     org settings, security settings, Actions settings,
     Copilot settings).
  2. Takes a snapshot of each page via B-0318.
  3. Loads the prior snapshot set from
     `docs/hygiene-history/github-ui-snapshots/`.
  4. Computes a structural diff: new elements, removed
     elements, changed values.
  5. Writes a feature-diff report to
     `docs/research/github-ui-feature-diff-YYYY-MM-DD.md`.
  6. Saves current snapshots as the new baseline.
- The cadence is weekly — can be triggered by a GitHub
  Actions workflow or by the autonomous-loop tick.
- New-element detection: any DOM element / toggle / label
  present in the current snapshot but absent from the prior
  snapshot is flagged as "new feature candidate."

## Done-criteria

- [ ] `tools/playwright/github-ui/feature-diff.ts` exists.
- [ ] At least one feature-diff report is generated
      comparing two snapshot sets.
- [ ] New UI elements are clearly flagged in the report.
- [ ] Cadence mechanism documented (workflow OR tick task).

## What this row does NOT do

- Does NOT act on discovered features — triage is manual
  or via a separate backlog row.
- Does NOT replace the GitHub changelog / API announcement
  channels — it supplements them with UI-level observation.
