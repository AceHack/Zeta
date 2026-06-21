---
id: 081KR2E4K0008QG0R000Q45WMQ
priority: P1
status: open
title: "Org-level billing/usage page reader — extract Actions minutes and costs via UI"
tier: agent-capability-expansion
effort: S
parent: 081KQ8P5D0008QG0R0010FP5SY
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [081KR2E4K0008QG0R003RVDX91]
composes_with: [081KQ8P5D0008QG0R0010FP5SY, 081KR2E4K0008QG0R0001FRW8H]
tags: [agent-capability, github-ui, playwright, billing, cost-parity, read-only]
type: friction-reducer
---

# Org-level billing/usage page reader

Build `tools/playwright/github-ui/billing-reader.ts` — reads
the org-level GitHub Actions usage and billing pages via
Playwright to extract minutes consumed, cost data, and plan
limits that are only visible in the web UI.

## Why

The cost-parity audit (Otto-65 addendum) needed billing data
that was only available via manual paste from the GitHub UI
because the billing API is limited. This tool automates that
read, closing a known data gap.

## Scope

- Implement a TS module that:
  1. Navigates to `github.com/organizations/<org>/settings/billing`
     and related billing sub-pages via 081KR2E4K0008QG0R0031QR36N auth +
     081KR2E4K0008QG0R003RVDX91 snapshot.
  2. Extracts structured data: Actions minutes used/limit,
     storage used/limit, Packages usage, Codespaces usage,
     Copilot seat count (if visible).
  3. Returns a typed JSON result suitable for the
     cost-parity audit tool to consume.
  4. Handles the case where the authenticated user lacks
     billing-admin access — returns a clear
     "insufficient-permissions" error, not a silent empty.
- Read-only: no billing changes, no plan modifications.

## Done-criteria

- [ ] `tools/playwright/github-ui/billing-reader.ts` exists.
- [ ] Running it returns structured billing data for the
      Lucent-Financial-Group org.
- [ ] Output is JSON-serializable and includes at minimum
      Actions minutes used and limit.

## What this row does NOT do

- Does NOT modify billing settings — strictly read-only.
- Does NOT replace the GitHub billing API for data it
  already exposes — supplements it for UI-only fields.
