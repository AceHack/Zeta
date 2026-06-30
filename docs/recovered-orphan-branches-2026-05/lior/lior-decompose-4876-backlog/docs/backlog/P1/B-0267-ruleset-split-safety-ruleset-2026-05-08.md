---
id: B-0267
priority: P1
status: open
title: "GitHub ruleset split — safety ruleset (deletion + force-push + linear history)"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0155
depends_on: [B-0265]
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# B-0267 — Safety ruleset

Third child of B-0155. Dedicated ruleset for branch safety
(no deletion, no force-push, linear history required).

## Acceptance criteria

- New ruleset "Branch Safety" created
- Deletion + non_fast_forward + linear_history rules migrated
- Legacy branch protection safety rules removed
