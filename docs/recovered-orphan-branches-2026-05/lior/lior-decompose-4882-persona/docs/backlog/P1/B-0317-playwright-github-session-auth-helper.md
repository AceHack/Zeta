---
id: B-0317
priority: P1
status: open
title: "Playwright GitHub session/auth helper — cookie-based login for agent UI access"
tier: agent-capability-expansion
effort: S
parent: B-0064
created: 2026-05-08
last_updated: 2026-05-08
depends_on: []
composes_with: [B-0064]
tags: [agent-capability, github-ui, playwright, auth, friction-reduction]
type: friction-reducer
---

# Playwright GitHub session/auth helper

Build `tools/playwright/github-ui/auth.ts` — a session helper
that lets the Playwright MCP browser access authenticated GitHub
pages using the maintainer's active session (cookie / device-token
pattern).

## Why this is the first child

Every other B-0064 child needs authenticated GitHub access.
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

- [ ] `tools/playwright/github-ui/auth.ts` exists and exports
      `withGitHubSession`.
- [ ] A smoke test (can be manual via `bun run`) confirms
      authenticated access to the Zeta repo settings page.
- [ ] Cookie/token path is `.gitignore`-protected.

## What this row does NOT do

- Does NOT implement any read or mutation workflow — those
  are downstream children (B-0318, B-0321).
- Does NOT handle OAuth app flows or GitHub App auth —
  this is session-cookie-based for the maintainer's
  existing browser session.
