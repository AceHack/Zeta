# Port lifecycle triad (generate · rotate · teardown) + reconciler flows (desired-state ↔ transition) + time-crystal flows via ACE

**Date:** 2026-06-21 · **Driver:** Aaron · **Status:** synthesis (operational model above the ports) · **Trajectory:** cluster-encryption-credential-substrate

## The ask (Aaron 2026-06-21)

> *"We need the teardown/undo too — blueprint that as well so we can test it over and over. Each
> port/interface gets its own generate, rotate, teardown. Then the flows themselves get
> compositional scripts that compose them into a flow that does the right thing needed for the
> flow based on the current state. This is the bridge between desired state and transitions
> between desired state: detect the delta, plan the adjustment flow, process the flow. Some flows
> are time crystals — pretty locked in stone — that's what ACE distributes over time."*

## Layer 1 — every port implements the lifecycle TRIAD: generate · rotate · teardown

Uniform across **every** port/interface (SecretStore, KeyCustody, CertAuthority, Consent,
Directory, …). Each gets the same three verbs:

- **generate** — create the resource (the `setup-*` side; realizes-if-missing).
- **rotate** — the forced-rotation (Active+Standby overlap-window, Itron `KeyState`; zero downtime).
- **teardown** — undo/wipe (the `teardown.ts` primitive #9000; dry-run-default + `--confirm` +
  biometric; local + repo + 1Password). **Blueprint it** so generate→teardown→regenerate is
  **testable over and over** (the round-trip proves the port + the reconciler).

Triad symmetry = the round-trip test: `generate → … → teardown → generate` must return to a clean
equivalent state. (`generate` and `teardown` are Z-set advance/retract; `rotate` is overlap-swap.)

## Layer 2 — flows are RECONCILERS (desired-state ↔ transition bridge)

Above the per-port triad, **flows are compositional scripts** that **compose** the triad ops into
"the right thing for this flow, given the current state." A flow is the **reconcile loop**:

1. **Detect the delta** — desired state − current state (a **Z-set diff**: what's missing /
   extra / stale). (This is the "realize-deps" instinct generalized — setup-machine realizing a
   missing CA was a one-off reconcile; now it's the pattern.)
2. **Plan the adjustment flow** — compute the sequence of per-port `generate`/`rotate`/`teardown`
   ops that closes the delta (a planned flow over the triad).
3. **Process the flow** — execute it (durable, replayable, biometric-gated where sensitive;
   reversible via Z-set retraction / saga compensation).

This is the Kubernetes/Terraform/ArgoCD **control-loop** shape — *plan the delta, apply the
transition* — but over our ports + Z-set substrate. The flow does the right thing **based on
current state**, so it's idempotent + convergent: run it on a clean machine → full generate; run
it on a partial machine → only the missing/stale ops; run it on a converged machine → no-op.

## Layer 3 — time-crystal flows, distributed over time by ACE

Some flows are **time crystals** — stable, repeating, "locked in stone" canonical processes (a
periodic temporal structure: the same flow, recurring, self-repeating). These don't replan from
scratch each time; they're the **canonical, ratified** flows. **ACE distributes them over time** —
ACE (the package manager / `ace-cli`, ace-package-format) is the distribution mechanism that ships
these locked-in flows across the cluster + schedules their recurrence. So: ad-hoc flows replan
against current state each run; **time-crystal flows are the crystallized, signed, ACE-distributed
recurring ones** (the rotation cadence, the reconcile heartbeat, the canonical onboarding).

## Why it coheres

- **generate/rotate/teardown** are the three faces of a Z-set lifecycle (advance / overlap-swap /
  retract) — the same reversibility (banana-split) everywhere.
- **Reconcile = DBSP** — the delta is a Z-set diff; the plan is incrementally derived; processing
  is forward execution; all replayable (DST).
- **Flows compose ports** (hexagonal) — adapter-agnostic; the DB-as-PKI endgame runs the same flows.
- **Time crystals + ACE** = the canonical/recurring flows get signed, distributed, scheduled —
  the durable-functions runtime executes them; "functions rotate like keys" applies to flows too.

## Build (backlog)

Define the **triad interface** (`generate`/`rotate`/`teardown`) on each port; **blueprint the
teardown** (round-trip test harness); the **reconciler** (detect-delta → plan → process) as the
flow engine over the triad (reuse the workflow-engine + DBSP diff); mark **time-crystal flows** +
wire **ACE** distribution/scheduling for them. Composes with: teardown primitive (#9000),
forced-rotation blueprint, hexagonal ports, identity-directory, Durable-Functions-AS-the-DB, and
the ACE package manager. (New build workitem to follow.)

## Anchors

Kubernetes reconcile / control loop; Terraform plan/apply (detect-delta → plan → apply); ArgoCD
GitOps desired-state. Time crystals (Wilczek 2012 — discrete time-translation order). In-repo:
`teardown.ts` (#9000), the Itron `KeyState` rotation, the workflow-engine, DBSP/Z-set diff, the
ACE package manager (`docs/agendas/ace-package-manager/`, `2026-05-22-ace-package-format-spec-v2`),
the hexagonal + Durable-Functions-AS-the-DB decisions (2026-06-21).
