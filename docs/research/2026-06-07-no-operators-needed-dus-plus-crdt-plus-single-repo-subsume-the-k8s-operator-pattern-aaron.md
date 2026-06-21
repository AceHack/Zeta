# No operators needed — DUs + CRDT + single-repo subsume the k8s operator pattern (Aaron, 2026-06-07)

Sharpens the Ace/declarative-infra thread (#6957–#6963). Aaron:

> *"this is similar to k8s and operators too, but we don't need operators with our CRDT and single-repo-based
> stuff — that's our DUs."*

## The claim

The Ace/declarative pattern is also like **Kubernetes + operators**: an operator is a custom **controller** that
runs a **reconcile loop**, driving a resource's *actual* state toward its *desired* state, encoding the
resource's lifecycle **state machine**. Aaron's claim: **Zeta does not need operators**, because three things
the substrate already has subsume what an operator does:

1. **CRDTs replace the reconcile-conflict job.** An operator exists partly to *resolve* drift/conflict between
   desired and actual. With **CRDTs** (`Crdt.fs`, the Z-set/G-Set/LWW substrate), state **converges
   conflict-free by construction** — no central controller is needed to merge/resolve; convergence is a
   mathematical property, not a control loop.
2. **Single-repo (git-native) replaces the desired-state store + N controllers.** The **one git repo** *is* the
   desired state (GitOps), and git merge / the Z-set fold *is* the reconcile. You don't deploy a controller per
   custom resource; the repo + fold is the single source of truth and the single reconciler.
3. **DUs replace the operator's state machine.** *"That's our DUs."* Where an operator encodes a resource's
   lifecycle as imperative controller logic, Zeta encodes it as a **discriminated union** (the non-idempotent
   workflow/DU wrapper, #6959): `NotStarted | InProgress | Done | Failed | …` — the state machine as **data in
   the repo**, converged by CRDT, not as a running controller process. The DU *is* the operator's logic, made
   declarative and content-addressed.

So: **operator = (reconcile loop) + (conflict resolution) + (resource state machine)** → Zeta supplies these as
**single-repo git-fold** + **CRDT convergence** + **DUs** — no per-resource controllers.

## The honest nuance (what "no operators" does and doesn't mean)

- **Replaced:** the *per-resource controller proliferation* (N operators), the bespoke *conflict-resolution*
  logic (CRDTs do it), and the *imperative state machine* (DUs do it as data). The reconcile *loop* collapses to
  one general loop — the **observe loop** (081KSXN940008QG0R001A4WWX4) folding the single repo — not N operator loops.
- **NOT eliminated:** *effects still have to happen.* An operator also *acts* (calls APIs, provisions). Those
  effectful, **non-idempotent** steps still need execution + compensation — which is exactly the **DU/workflow**
  (#6959): the DU isn't only the state record, it's the saga that drives the effect with an idempotency key +
  compensation. So "no operators" = "no per-resource controllers"; the *effect execution* lives in the DU/
  workflow + the one observe loop, not in many operators.
- **Idempotent reconcile is free** (#6959 `ensure`); only the genuinely non-idempotent transitions need the DU
  saga. Most of an operator's job (converge to desired state) is just idempotent `ensure` + CRDT + git — no
  controller at all.

## Why this is a real simplification

- **One loop, not N controllers.** k8s runs a controller per operator/CRD; Zeta runs **one** observe loop over
  **one** repo, with CRDT convergence and DUs as data. Far less moving infrastructure (Rodney's-razor:
  collapses the operator zoo into fold + CRDT + DU).
- **Declarative + reproducible + DST-able.** The DU state machine is data (DynamicValue/`.ace`, #6962), so it's
  content-addressed, replayable under the `test` seam (#6958), and homoiconic with the CLI — an operator's logic
  is none of these (it's imperative Go in a pod).
- **Still OCI/k8s-compatible (#6961).** Ace emits OCI images that run *on* k8s (#6949) — Zeta uses k8s as a
  runtime but **doesn't need the operator pattern** on top; the DU+CRDT+repo model sits above it.

## Honest scope / peel

- Architectural claim, partly built: CRDTs (`Crdt.fs`) + git-native single-repo + the observe loop (081KSXN940008QG0R001A4WWX4) +
  DUs (#6959) exist or are scoped; "subsumes operators" is the *design thesis*, demonstrated piecewise, not a
  shipped operator-free k8s deployment yet.
- Don't overclaim "no controllers ever" — the observe loop *is* a controller (one, general); effects run via
  DU/workflow sagas. The win is **one general reconciler + data-DUs + CRDT** vs **many bespoke operators**.
- CRDT convergence requires the state to *be* CRDT-shaped (the substrate ensures this); non-CRDT external
  systems still need adapters (seams, #6961) — the convergence guarantee is internal.

## Ties

- **Non-idempotent → DU/workflow (#6959)** — the DU IS the operator's state machine + saga.
- **CRDT substrate (`Crdt.fs`) + Z-set fold** — conflict-free convergence (no reconcile-conflict controller).
- **Single-repo / git-native / GitOps (#6939; ArgoCD/Flux)** — the repo is desired state; git-fold is reconcile.
- **Observe loop (081KSXN940008QG0R001A4WWX4)** — the one general reconcile loop replacing N operators.
- **OCI / k8s (#6961/#6949)** — Zeta runs on k8s but skips the operator pattern.
- **Rodney's razor** — collapses the operator zoo to fold + CRDT + DU.

## Beacon anchors

- **Kubernetes operator pattern** (CoreOS/Red Hat — a custom controller + CRD running a reconcile loop to manage
  a resource's lifecycle; the controller/reconcile model). · **GitOps** (ArgoCD/Flux — git as the single desired
  state; reconcile from the repo). · **CRDTs** (Shapiro, Preguiça, Baquero, Zawirski 2011 — conflict-free
  convergence without coordination). · **Discriminated unions / state machines as data** (the operator logic as
  a DU). · **Reconciliation / desired-state convergence** (control theory; Terraform/k8s). Honest novelty: none
  in the primitives; the contribution is the **claim + mapping** — operator = reconcile-loop + conflict-
  resolution + state-machine, which Zeta supplies as **single-repo git-fold + CRDT convergence + DUs** (one
  observe loop, effects via DU/workflow sagas), so the k8s operator *pattern* is unnecessary on the Zeta
  substrate even while running on k8s.
