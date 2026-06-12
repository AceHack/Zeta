---
name: cross-surface-drift-9-vs-15
description: catalogue of 9 drift instances across the substrate
type: feedback
---

<!--
Eval-set fixture for substrate-claim-checker (B-0170).

Reproduces the cross-surface count-drift pattern surfaced as
verify-then-claim memo instance #19 — the YAML frontmatter
`description:` field carries a count claim that no body table
satisfies. In the historical case, frontmatter + MEMORY.md
index both said "9 drift instances" while the body table
already held 15 rows; the check-cross-surface "any-table"
semantics fire when zero body tables match the claim.

This comment intentionally avoids restating the exact
`<number> <noun>` pair from the frontmatter claim. Restating
it would not affect the check-cross-surface checker (which
only scans the frontmatter `description:` field for claims),
but mirrors the PR #3611 discipline already applied to the
count-drift / existence-drift / path-form-drift fixtures so
the eval-set conventions stay uniform.
-->

# Drift catalogue (cross-surface eval-set fixture)

The body table below records the actual rows; the frontmatter
description above is the drifted surface that the checker
must catch.

| # | Instance | Sub-class |
|---|---|---|
| 1 | row-1 | count |
| 2 | row-2 | count |
| 3 | row-3 | existence |
| 4 | row-4 | path-form |
| 5 | row-5 | cross-surface |
| 6 | row-6 | count |
| 7 | row-7 | convention |
| 8 | row-8 | semantic-equivalence |
| 9 | row-9 | empirical-output |
| 10 | row-10 | self-recursive |
| 11 | row-11 | count |
| 12 | row-12 | existence |
| 13 | row-13 | path-form |
| 14 | row-14 | cross-surface |
| 15 | row-15 | convention |
