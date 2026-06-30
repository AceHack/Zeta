---
id: B-0318
priority: P1
status: open
title: "Playwright GitHub read-only page snapshot tool — navigate + snapshot + extract"
tier: agent-capability-expansion
effort: S
parent: B-0064
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0317]
composes_with: [B-0064, B-0319, B-0323, B-0324]
tags: [agent-capability, github-ui, playwright, read-only, snapshot]
type: friction-reducer
---

# Playwright GitHub read-only page snapshot tool

Build `tools/playwright/github-ui/snapshot.ts` — navigates to a
GitHub page via the authenticated session (B-0317), takes a DOM
snapshot, and extracts structured data (settings toggles, form
values, feature flags visible on the page).

## Why

This is the foundational read-only capability that Phase 1 of
B-0064 requires. Every downstream use case — settings
reconciliation (B-0319), feature-discovery diffing (B-0323),
billing page reading (B-0324) — calls this tool.

## Scope

- Implement a TS module that:
  1. Accepts a GitHub URL (repo settings page, org page,
     user settings page, etc.).
  2. Uses `withGitHubSession` from B-0317 to navigate.
  3. Takes a Playwright snapshot (DOM accessibility tree
     via `browser_snapshot` MCP tool pattern).
  4. Extracts structured data: toggle states (on/off),
     form field values, visible feature labels.
  5. Returns a typed JSON result with page URL, timestamp,
     extracted data, and raw snapshot reference.
- Read-only: no clicks that change state, no form
  submissions.
- Handles common GitHub page patterns: settings pages
  (toggle grids), security pages, Actions pages.

## Done-criteria

- [ ] `tools/playwright/github-ui/snapshot.ts` exists.
- [ ] Can snapshot `github.com/<org>/<repo>/settings` and
      return structured toggle states.
- [ ] Output is JSON-serializable for downstream diffing.

## What this row does NOT do

- Does NOT reconcile against expected state — that is
  B-0319.
- Does NOT mutate anything — mutations are B-0321.
