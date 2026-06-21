---
id: 081KR2E4K0008QG0R000YTJS3Q
priority: P0
status: closed
closed: 2026-05-08
closed_by: "tools/backlog/claim-worktree-bootstrap.ts plus focused bootstrap tests"
title: "Autonomous backlog pickup - claim and worktree bootstrap"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQZVQW0008QG0R000C35RNY
depends_on: [081KR2E4K0008QG0R001GFXN05]
classification: blocked-on-081KR2E4K0008QG0R001GFXN05
decomposition: atomic
owners: [architect, codex]
---

# 081KR2E4K0008QG0R000YTJS3Q - Claim and worktree bootstrap

Create the isolated write surface for a selected backlog row before
any file edits happen.

## Acceptance criteria

- Creates or updates the git-native claim for the selected row.
- Uses a dedicated worktree rooted at current `origin/main`.
- Refuses to write in the contested root checkout.
- Records the selected path set before edits begin.
- Fails closed if another active claim overlaps the path set.
