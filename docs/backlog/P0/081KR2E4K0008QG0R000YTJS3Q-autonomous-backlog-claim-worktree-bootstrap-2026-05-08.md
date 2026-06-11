---
id: B-0279
zetaid: 081KR2E4K0008QG0R000YTJS3Q
priority: P0
status: closed
closed: 2026-05-08
closed_by: "tools/backlog/claim-worktree-bootstrap.ts plus focused bootstrap tests"
title: "Autonomous backlog pickup - claim and worktree bootstrap"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0249
depends_on: [B-0278]
classification: blocked-on-B-0278
decomposition: atomic
owners: [architect, codex]
---

# B-0279 - Claim and worktree bootstrap

Create the isolated write surface for a selected backlog row before
any file edits happen.

## Acceptance criteria

- Creates or updates the git-native claim for the selected row.
- Uses a dedicated worktree rooted at current `origin/main`.
- Refuses to write in the contested root checkout.
- Records the selected path set before edits begin.
- Fails closed if another active claim overlaps the path set.
