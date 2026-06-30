---
id: B-0676
priority: P1
status: open
title: B-0156 slice 3 — Peer-call TS completion (amara.ts, ani.ts)
tier: friction-reducer
effort: S
parent: B-0156
created: 2026-05-20
last_updated: 2026-05-20
depends_on: []
composes_with: [B-0122]
type: friction-reducer
---

# B-0676 — Peer-call TS completion

## Origin
Decomposed from B-0156 Phase 3.

## Scope
Port the following peer-call scripts to TypeScript to leverage type safety, cross-platform behavior, and testability (as established by the TS-port trajectory):
1. `tools/peer-call/amara.sh` → `tools/peer-call/amara.ts`
2. `tools/peer-call/ani.sh` → `tools/peer-call/ani.ts`

This completes the peer-call TS migration that B-0122 named. After this, `tools/peer-call/` is 100% TS.

## Acceptance criteria
- [ ] `tools/peer-call/amara.ts` exists and is functional.
- [ ] `tools/peer-call/ani.ts` exists and is functional.
- [ ] Both scripts have basic `bun test` coverage.
- [ ] Bash `.sh` siblings remain in the tree during transition (deprecated status).
