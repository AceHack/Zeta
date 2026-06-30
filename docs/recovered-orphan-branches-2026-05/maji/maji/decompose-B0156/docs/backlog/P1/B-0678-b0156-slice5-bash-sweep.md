---
id: B-0678
priority: P1
status: open
title: B-0156 slice 5 — Bash sweep (deletion of .sh siblings post-port)
tier: friction-reducer
effort: XS
parent: B-0156
created: 2026-05-20
last_updated: 2026-05-20
depends_on: [B-0503, B-0504]
type: friction-reducer
---

# B-0678 — Bash sweep

## Origin
Decomposed from B-0156 Phase 5.

## Scope
After Phases 1-4 stabilize and TS versions are battle-tested, delete the `.sh` siblings to complete the migration. 
Targets for deletion (if TS siblings exist and are stable):
- `tools/peer-call/amara.sh`
- `tools/peer-call/ani.sh`
- `tools/profile.sh`

## Acceptance criteria
- [ ] Deprecated `.sh` siblings deleted.
- [ ] Any references in `package.json` or other scripts updated to point to the `.ts` versions exclusively.
