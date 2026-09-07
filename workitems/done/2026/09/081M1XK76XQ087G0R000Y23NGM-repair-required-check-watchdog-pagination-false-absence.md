---
id: 081M1XK76XQ087G0R000Y23NGM
type: bug
state: done
priority: P2
slug: repair-required-check-watchdog-pagination-false-absence
title: "Repair required-check watchdog pagination false absence"
created: 2026-09-07T09:29:34.903Z
completed: 2026-09-07T09:49:51.562Z
depends_on: []
composes_with: []
---

# Repair required-check watchdog pagination false absence

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M1XK76XQ087G0R000Y23NGM-*.md` glob. -->

A scheduled detector on main a0ffd1bff falsely reports no live gate for PR
#16911 although its exact head has a successful required check. The PR-list
rollup contains only 100 of 103 checks; page two contains the required gate.

Fix negative classification using complete pagination for the observed head,
retain API failures as unmeasured, and preserve genuine absent/queued/terminal
behavior. Retain the live witness and an executable regression. Do not modify,
cancel, rerun or comment on the other actor's PR. Run the appropriate TS and
quick gates, retain independent review, release the claim and verify the merge.

## Completion and retained review

The detector now admits an absent name only after complete PR/head-bound
context pagination. API and completeness failures remain unmeasured. The
[indexed correction](../../../../docs/research/2026-09-07-required-check-pagination-correction.md)
retains the original false alarm, the two-page witness, repaired read-only
output and the root agent's accepted independent source review. All 36 focused
tests (67 assertions), TypeScript checking and all sixteen quick-preflight
checks passed. The only review edit was test-assertion indentation.

No workflow policy, permissions, other actor's PR or scientific source changed.
The claim is released in this PR; final hosted checks and ancestry verification
remain the publication gate.
