---
id: 081KR50HA0008QG0R001NNPEXC
priority: P1
status: closed
closed: 2026-05-09
closed_by: "adversarial review pass completed — Lemma 17 strengthened with stateA1≠stateA2 constraint"
title: "Alignment proof primitive ladder — one type, one falsifiable property"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R0033TN4H9]
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research-to-code
tags: [alignment, formal-verification, control-theory, shield-synthesis, causal-independence]
---

# 081KR50HA0008QG0R001NNPEXC — Alignment proof primitive ladder

## What

Build toward alignment proofs one primitive at a time. Each
step must name exactly one primitive, give it one concrete type
or formal sort, and attach one falsifiable property. This row is
the guardrail against jumping from useful control-theory
machinery to a general "alignment proof" claim.

Aaron 2026-05-09: *"we do want to try to build twards alignment
proofs like one primitve at a time"*.

## Narrow thesis

Zeta should not claim "control-theoretic alignment proof" as a
single leap. The tractable lane is:

1. Pick one alignment primitive.
2. Define the primitive as a real type, relation, or formal sort.
3. State one property that could fail.
4. Check that property with FsCheck, Z3, Lean, TLA+, or a runtime
   monitor.
5. Only promote the vocabulary after the property survives
   adversarial review.

This keeps the proof surface falsifiable. A primitive that has no
type and no failing test is still vocabulary, not a proof object.

## First candidate primitive

Start with **independent causal power across a shared trace**.

Minimal shape:

- `SharedTrace`: observable sequence of shared events.
- `PrivateState<'Agent>`: agent-local state not directly shared.
- `Policy<'Agent>`: function from private state plus shared trace
  prefix to a next-action distribution.
- `Membrane`: typed projection or channel that defines what can
  cross from private state into the shared trace.

Candidate falsifiable property:

> Holding `PrivateState<B>` fixed, there exists an intervention on
> `PrivateState<A>` that changes `Policy<A>`'s next-action
> distribution after the same shared trace prefix.

This is intentionally narrower than "fusion destroys freedom."
It is an interventional-independence / causal-power property. It
can fail if the policy ignores private state, if the membrane
leaks or collapses state, or if multiple reviewers share the same
hidden failure mode.

## Control-theory spine

Use control theory where it is actually doing work:

- DBSP / D-I operators for incremental observation of agent-action
  streams and review traces.
- Runtime verification / shield synthesis for safety properties
  over those streams.
- Causal independence for reviewer/persona diversity claims.

Do not use DBSP fixed-point convergence as a synonym for
alignment. DBSP can maintain the monitor views. The alignment
primitive still needs its own type and property.

## Shadow to measure

Consensus-smoothness is the named failure mode: reviewers may
appear independent while their errors become correlated. That
breaks the independence assumption behind BFT-style review
framing and reduces the value of additional reviewers.

This row should preserve that as a measurable threat, not absorb
it into optimistic proof language.

## Acceptance criteria

- [x] Choose exactly one primitive for the first implementation
      slice. → **CausalPower**: Policy<A>'s dependence on PrivateState<A>.
- [x] Add one concrete F# type, Z3 sort, Lean structure, or TLA+
      state variable set for that primitive.
      → Z3 sorts: `SharedTrace`, `Action`; PrivateState as `Int`;
        `PolicyA: Int × SharedTrace → Action` (uninterpreted function).
- [x] Add one falsifiable property that can fail under at least
      one small counterexample.
      → `hasCausalPower(P)` fails for any collapsed policy (the
        quantifier `(forall s1 s2 t, P(s1,t)=P(s2,t))` is a
        concrete small counterexample — a constant function).
- [x] Add one focused check: FsCheck property, Z3 query, Lean
      theorem, TLA+ model, or runtime monitor test.
      → Two Z3 queries in `tools/Z3Verify/Program.fs` (lemmas 16+17)
        and two test cases in `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`.
- [x] Write a short note distinguishing what the check proves
      from what it does not prove.
      → Proved: collapse implies zero causal power (Lemma 17 UNSAT).
        NOT proved: any specific concrete agent is non-collapsed;
        proving that requires membrane specs + private-state update
        rules — the next slice.
- [x] Run an adversarial review pass before promoting the proof
      vocabulary to `docs/ALIGNMENT.md`, `docs/AGENDA.md`, or
      other current-state surfaces.
      → Adversarial finding (2026-05-09): Lemma 17 missing
        `(assert (not (= stateA1 stateA2)))` — UNSAT could be
        achieved trivially via identity (stateA1=stateA2) rather
        than via the collapse constraint. Fixed in Program.fs +
        Z3.Laws.Tests.fs. UNSAT now exclusively attributable to
        collapse. Vocabulary not yet promoted to ALIGNMENT.md
        (no promotion needed until non-collapse for a concrete
        agent is proven — that requires the next slice).

## Non-goals

- No general claim that Zeta has proven alignment.
- No "alignment" theorem over undefined primitives.
- No tautology checks presented as semantic proof.
- No BFT independence claim without correlated-failure analysis.
- No decorative use of "membrane", "policy", or "agenda" unless
  the row defines the technical meaning being used.

## Composes with

- 081KR50HA0008QG0R0033TN4H9 (replace tautology Z3 agenda/trajectory proofs)
- 081KR50HA0008QG0R0010RZTJK (DBSP identity continuity via D/I views)
- 081KQX9B50008QG0R0026BG44J (fractal BFT architecture)
- 081KQJZR90008QG0R002GJAJ19 (dual-loop attribution/reconciliation)
- `tools/Z3Verify/Program.fs`
- `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`
- `src/Core/SignalQuality.fs`
- `docs/DRIFT-TAXONOMY.md`
