---
id: B-0322
priority: P1
status: open
title: "Mutation reversibility drain log — inverse-action record for every UI mutation"
tier: agent-capability-expansion
effort: S
parent: B-0064
created: 2026-05-08
last_updated: 2026-05-08
depends_on: [B-0321]
composes_with: [B-0064]
tags: [agent-capability, github-ui, playwright, audit-trail, reversibility, safety]
type: friction-reducer
---

# Mutation reversibility drain log

Build `tools/playwright/github-ui/drain-log.ts` — an
append-only log that records every Playwright UI mutation
along with its documented inverse action, enabling
mechanical undo.

## Why

B-0064 Phase 2 requires every mutation to have a documented
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
     (B-0321), then marks the entry as "reverted".
  4. Exports a `listPending()` function that returns all
     entries with status "applied" (not yet reverted).
- The log file is committed as part of hygiene-history —
  visible to the maintainer in git.

## Done-criteria

- [ ] `tools/playwright/github-ui/drain-log.ts` exists.
- [ ] Log entries are written on every mutation via B-0321.
- [ ] `revert()` function can mechanically undo a logged
      mutation.
- [ ] Log file lives under `docs/hygiene-history/` and is
      committed.

## What this row does NOT do

- Does NOT implement the mutation itself — that is B-0321.
- Does NOT auto-revert on failure — reversion is explicit.
