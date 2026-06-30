---
id: B-0679
priority: P1
status: open
title: B-0156 slice 6 — .py policy enforcement lint
tier: friction-reducer
effort: XS
parent: B-0156
created: 2026-05-20
last_updated: 2026-05-20
depends_on: []
type: friction-reducer
---

# B-0679 — .py policy enforcement lint

## Origin
Decomposed from B-0156 Phase 6.

## Scope
Add a CI lint that fails on any new `.py` file outside `references/upstreams/`. This enforces the policy that TypeScript is preferred over Python in our codebase for non-install scripts.

## Acceptance criteria
- [ ] CI lint added (e.g. in `gate.yml` or equivalent pre-commit hook) that runs `find` to catch rogue `.py` files (excluding `references/upstreams/`).
- [ ] Fails correctly if a `.py` file is introduced.
