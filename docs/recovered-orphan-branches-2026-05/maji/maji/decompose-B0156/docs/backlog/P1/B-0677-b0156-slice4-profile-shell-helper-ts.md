---
id: B-0677
priority: P1
status: open
title: B-0156 slice 4 — Profile shell-helper TS port (profile.ts)
tier: friction-reducer
effort: S
parent: B-0156
created: 2026-05-20
last_updated: 2026-05-20
depends_on: []
type: friction-reducer
---

# B-0677 — Profile shell-helper TS port

## Origin
Decomposed from B-0156 Phase 4.

## Scope
Port `tools/profile.sh` to `tools/profile.ts`. This is a standalone utility and part of the broader TypeScript standardization across non-install scripts.

## Acceptance criteria
- [ ] `tools/profile.ts` exists and is functional.
- [ ] Script has basic `bun test` coverage.
- [ ] Original `tools/profile.sh` remains in tree during transition.
