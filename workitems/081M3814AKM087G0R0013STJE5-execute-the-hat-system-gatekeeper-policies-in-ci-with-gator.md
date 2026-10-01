---
id: 081M3814AKM087G0R0013STJE5
type: task
state: backlog
priority: P2
slug: execute-the-hat-system-gatekeeper-policies-in-ci-with-gator
title: "Execute the hat-system Gatekeeper policies in CI with gator verify"
created: 2026-09-23T21:00:46.580Z
depends_on: []
composes_with: []
---

# Execute the hat-system Gatekeeper policies in CI with gator verify

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3814AKM087G0R0013STJE5-*.md` glob. -->

Nothing in CI had ever executed the Rego in
`full-ai-cluster/k8s/applications/hat-system/policies/` (seven ConstraintTemplates,
the only Gatekeeper policies in the tree). Pin `gator` 3.23.1 (= the gatekeeper chart)
in `.mise.full.toml`, write `gator verify` suites with must-violate and must-admit
cases for every policy (`full-ai-cluster/k8s/tests/gator/hat-system/`), run them in a
drift-tier gate job selected by the build graph, and mutation-check the lane.

First execution found four fail-open defects (02/03 unreconciled bindings, 04 omitted
`cosignedBy`, 07 empty Hat inventory); fixed in the same change.
