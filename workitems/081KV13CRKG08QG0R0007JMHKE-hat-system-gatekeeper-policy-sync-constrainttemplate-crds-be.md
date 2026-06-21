---
id: 081KV13CRKG08QG0R0007JMHKE
type: task
state: backlog
priority: P1
slug: hat-system-gatekeeper-policy-sync-constrainttemplate-crds-be
title: "hat-system Gatekeeper policy sync — ConstraintTemplate CRDs before constraints in ArgoCD proofs"
created: 2026-06-13T18:20:04.592Z
depends_on: ["081KSXN940008QG0R000SCP2H1"]
composes_with: ["081KSE6WT0008QG0R00195RG48"]
---

# hat-system Gatekeeper policy sync — ConstraintTemplate CRDs before constraints in ArgoCD proofs

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV13CRKG08QG0R0007JMHKE-*.md` glob. -->

Parent **081KSXN940008QG0R000SCP2H1** included proof **excludes** `full-ai-cluster/k8s/applications/hat-system/policies/**`
on kind because Gatekeeper Constraint kinds are registered **after** ConstraintTemplates
reconcile — ArgoCD sync waves alone are insufficient on a cold cluster.

## Problem

On kind CI, constraints fail with *"could not find constraints.gatekeeper.sh/HatWarmup"*
while ConstraintTemplates are still registering. CRDs + seed hats reconcile; policies do not.

## Target

Re-enable `policies/**` in the hat-system Application for dev/kind without blocking
081KSXN940008QG0R000SCP2H1 proofs. Pick one durable pattern (document in `full-ai-cluster/dev-cluster/SYNC-WAVES.md`):

- PostSync **wait Job** between ConstraintTemplate (wave 1) and Constraint (wave 2) that
  polls for `constraints.gatekeeper.sh/*` CRD establishment, or
- Separate child Application for policies with sync-wave dependency on `open-policy-agent`, or
- Application-level `SkipDryRunOnMissingResource` + automated retry **proven** on cold start
  (not manual `kubectl patch`).

## Acceptance

- [ ] Fresh kind cluster: `hat-system` Application Synced+Healthy with all seven constraints live.
- [ ] Included-scope proof passes with `policies/**` no longer excluded from directory sync.
- [ ] Homelab path documented if kind and homelab diverge (resource budgets, sync timing).

## Composes with

hat-system operator + Gatekeeper substrate (PR #4930 lineage); 081KSE6WT0008QG0R00195RG48 if operator wiring is required.
