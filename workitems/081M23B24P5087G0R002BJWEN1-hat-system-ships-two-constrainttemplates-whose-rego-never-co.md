---
id: 081M23B24P5087G0R002BJWEN1
type: bug
state: backlog
priority: P2
slug: hat-system-ships-two-constrainttemplates-whose-rego-never-co
title: "hat-system ships two ConstraintTemplates whose Rego never compiled, so no hat policy is enforced"
created: 2026-09-09T15:02:26.757Z
depends_on: []
composes_with: []
---

# hat-system ships two ConstraintTemplates whose Rego never compiled, so no hat policy is enforced

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23B24P5087G0R002BJWEN1-*.md` glob. -->

## What was measured

Runs `34323056405` (red) and `34338106811` (GREEN) both show all seven Hat
Constraints `OutOfSync` and the Sync-hook Job
`wait-gatekeeper-hat-constraint-crds` retrying. The Job's `wait-crd-create`
init container reports, in both runs, exactly two names:

    NotFound: customresourcedefinitions "hatconflict.constraints.gatekeeper.sh"
    NotFound: customresourcedefinitions "hatnocycle.constraints.gatekeeper.sh"

The other five constraint CRDs appear. That two-sided split is the
discriminator: compiling all seven Rego modules extracted from
`policies/*.yaml` with `opa check --v0-compatible` (the mode Gatekeeper's
`spec.targets[].rego` uses) passes for five and fails for exactly those two.

    hatconflict:11  rego_compile_error: var conflict_name declared above
    hatnocycle:18   rego_parse_error:  unexpected identifier token   ("or")
    hatnocycle:7    rego_compile_error: var next declared above
    hatnocycle:12   rego_compile_error: var next declared above
    hatnocycle:30   rego_compile_error: var sup  declared above
    hatnocycle:9    rego_recursion_error: rule reachable is recursive

Five defects, two classes: `some X` immediately followed by `X := ...` (a
redeclaration), and a `reachable` helper that calls itself, which Rego forbids
outright -- so `hatnocycle` could never have compiled however the syntax was
spelled. `or` is not a Rego operator; the CREATE/UPDATE disjunction it was
reaching for never applied to UPDATE at all.

## Why nothing caught it

Gatekeeper generates the constraint CRD only after the Rego compiles. No CRD
means the wave-3 Constraints never apply, the Sync hook exhausts
`backoffLimit: 2`, and hat-system's sync fails ("retried 10 times"). The
Application nevertheless reports `health=Healthy`, because Constraints and
ConstraintTemplates carry no ArgoCD health assessment -- and
`isApplicationSynced` accepts `OutOfSync + Healthy`. So the lane named
"included Synced+Healthy proof" passed over a policy engine with zero policies
installed, in the green run as well as the red one.

## Fixed

- `full-ai-cluster/k8s/applications/hat-system/policies/03-conflict-of-interest.yaml` -- drop the redundant `some`.
- `full-ai-cluster/k8s/applications/hat-system/policies/07-no-supervisor-cycles.yaml` -- `{"CREATE","UPDATE"}[op]` for the
  disjunction, `graph.reachable` for transitive reachability, `some` dropped.
  Both re-verified by evaluation, not only by compilation: a cycle violates on
  CREATE and on UPDATE, a non-cycle does not, and a DELETE does not.
- `.github/workflows/k8s-argocd-health-test.yml` -- a step that asks Gatekeeper
  itself whether every ConstraintTemplate compiled (`status.created`,
  `status.byPod[].errors`), and fails when zero templates exist so the loop
  cannot pass trivially.

## Still open

The workflow step is a live-lane falsifier, ~25 minutes from a change to a
verdict. A unit-level `opa check` over every ConstraintTemplate in the repo
would catch the same class in seconds, but needs `opa` added to the pinned
toolchain -- a CI/toolchain decision (three-way parity, one more tool in every
install) rather than a bug fix, so it is not taken here.
