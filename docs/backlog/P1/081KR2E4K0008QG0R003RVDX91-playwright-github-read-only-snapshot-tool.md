---
id: 081KR2E4K0008QG0R003RVDX91
priority: P1
status: closed
title: "Playwright GitHub read-only page snapshot tool — navigate + snapshot + extract"
tier: agent-capability-expansion
effort: S
parent: 081KQ8P5D0008QG0R0010FP5SY
created: 2026-05-08
last_updated: 2026-05-09
depends_on: [081KR2E4K0008QG0R0031QR36N]
composes_with: [081KQ8P5D0008QG0R0010FP5SY, 081KR2E4K0008QG0R0001FRW8H, 081KR2E4K0008QG0R003E09GMM, 081KR2E4K0008QG0R000Q45WMQ]
tags: [agent-capability, github-ui, playwright, read-only, snapshot]
type: friction-reducer
---

# Playwright GitHub read-only page snapshot tool

Build `tools/playwright/github-ui/snapshot.ts` — navigates to a
GitHub page via the authenticated session (081KR2E4K0008QG0R0031QR36N), takes a DOM
snapshot, and extracts structured data (settings toggles, form
values, feature flags visible on the page).

## Why

This is the foundational read-only capability that Phase 1 of
081KQ8P5D0008QG0R0010FP5SY requires. Every downstream use case — settings
reconciliation (081KR2E4K0008QG0R0001FRW8H), feature-discovery diffing (081KR2E4K0008QG0R003E09GMM),
billing page reading (081KR2E4K0008QG0R000Q45WMQ) — calls this tool.

## Scope

- Implement a TS module that:
  1. Accepts a GitHub URL (repo settings page, org page,
     user settings page, etc.).
  2. Uses `withGitHubSession` from 081KR2E4K0008QG0R0031QR36N to navigate.
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
  081KR2E4K0008QG0R0001FRW8H.
- Does NOT mutate anything — mutations are 081KR2E4K0008QG0R000YH9DC6.
