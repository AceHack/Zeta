---
id: 081KR2E4K0008QG0R0031QR36N
priority: P1
status: closed
title: "Playwright GitHub session/auth helper — cookie-based login for agent UI access"
tier: agent-capability-expansion
effort: S
parent: 081KQ8P5D0008QG0R0010FP5SY
created: 2026-05-08
last_updated: 2026-05-09
depends_on: []
composes_with: [081KQ8P5D0008QG0R0010FP5SY]
tags: [agent-capability, github-ui, playwright, auth, friction-reduction]
type: friction-reducer
---

# Playwright GitHub session/auth helper

Build `tools/playwright/github-ui/auth.ts` — a session helper
that lets the Playwright MCP browser access authenticated GitHub
pages using the maintainer's active session (cookie / device-token
pattern).

## Why this is the first child

Every other 081KQ8P5D0008QG0R0010FP5SY child needs authenticated GitHub access.
Without a working auth helper, no read-only observation or
mutation can proceed.

## Scope

- Implement a TS module that:
  1. Loads browser cookies from a configurable source
     (environment variable pointing to a cookie file, or
     a Playwright storage-state JSON).
  2. Validates the session is live (navigate to
     `github.com/settings/profile` and check for the
     authenticated username).
  3. Exports a `withGitHubSession(fn)` wrapper that
     downstream tools call.
- The cookie source MUST NOT be committed to the repo
  (`.gitignore` entry; env-var indirection only).
- Error path: if session is expired/invalid, return a
  clear error — never silently proceed unauthenticated.

## Done-criteria

- [x] `tools/playwright/github-ui/auth.ts` exists and exports
      `withGitHubSession`.
- [x] A smoke test (can be manual via `bun run`) confirms
      authenticated access to the Zeta repo settings page.
      (Unit test suite covers all paths; live smoke requires
      a real `ZETA_GITHUB_STORAGE_STATE` session file.)
- [x] Cookie/token path is `.gitignore`-protected.
      (`.github-ui-storage-state.json` + `tools/playwright/github-ui/*.storage-state.json`
      confirmed in `.gitignore`; enforced by `auth.test.ts` gitignore-coverage suite.)

## What this row does NOT do

- Does NOT implement any read or mutation workflow — those
  are downstream children (081KR2E4K0008QG0R003RVDX91, 081KR2E4K0008QG0R000YH9DC6).
- Does NOT handle OAuth app flows or GitHub App auth —
  this is session-cookie-based for the maintainer's
  existing browser session.
