---
id: 081KR2E4K0008QG0R002N1C3YJ
priority: P1
status: closed
title: "Mutation reversibility drain log — inverse-action record for every UI mutation"
tier: agent-capability-expansion
effort: S
parent: 081KQ8P5D0008QG0R0010FP5SY
created: 2026-05-08
last_updated: 2026-05-10
depends_on: [081KR2E4K0008QG0R000YH9DC6]
composes_with: [081KQ8P5D0008QG0R0010FP5SY]
tags: [agent-capability, github-ui, playwright, audit-trail, reversibility, safety]
type: friction-reducer
---

# Mutation reversibility drain log

Build `tools/playwright/github-ui/drain-log.ts` — an
append-only log that records every Playwright UI mutation
along with its documented inverse action, enabling
mechanical undo.

## Why

081KQ8P5D0008QG0R0010FP5SY Phase 2 requires every mutation to have a documented
inverse. This log is the substrate that makes reversibility
auditable. Without it, the agent's UI mutations are
fire-and-forget — a trust violation.

## Scope

- Implement a TS module that:
  1. Defines a drain-log entry schema:
     ```typescript
     interface MutationLogEntry {
       id: string;           // UUID
       timestamp: string;    // ISO-8601
       surfaceId: string;    // from authorized-surfaces.json
       action: string;       // what was done
       inverseAction: string; // how to undo it
       beforeSnapshot: string; // path to before-snapshot JSON
       afterSnapshot: string;  // path to after-snapshot JSON
       diff: object;         // structured diff
       status: "applied" | "reverted";
     }
     ```
  2. Appends entries to
     `docs/hygiene-history/playwright-mutations/log.jsonl`
     (JSONL format, one entry per line, append-only).
  3. Exports a `revert(entryId)` function that reads the
     inverse action and executes it via the mutation helper
     (081KR2E4K0008QG0R000YH9DC6), then marks the entry as "reverted".
  4. Exports a `listPending()` function that returns all
     entries with status "applied" (not yet reverted).
- The default log path is under hygiene-history, so actual
  mutation entries become visible to the maintainer in git
  when committed.

## Done-criteria

- [x] `tools/playwright/github-ui/drain-log.ts` exists.
- [x] Log entries are written on every mutation via 081KR2E4K0008QG0R000YH9DC6.
- [x] `revert()` function can mechanically undo a logged
      mutation.
- [x] Default log path lives under `docs/hygiene-history/`;
      actual mutation entries are committed when produced.

## Pre-start checklist (081KR2E4K0008QG0R002N1C3YJ prior-art + dependency check)

Prior-art surfaces searched: 081KR2E4K0008QG0R000YH9DC6 PR #2502 (merged 2026-05-10), mutate.ts
drain-log entry shape already prototyped there. No competing implementation
found. Depends-on 081KR2E4K0008QG0R000YH9DC6 is fulfilled. Inverse-action mapping already in
mutate.ts.

## What this row does NOT do

- Does NOT implement the mutation itself — that is 081KR2E4K0008QG0R000YH9DC6.
- Does NOT auto-revert on failure — reversion is explicit.
