---
id: 081KTH8RSXS08QG0R0039TF0AF
type: task
state: backlog
priority: P2
slug: proof-out-of-order-events-converge-confluence-content-addres
title: "Proof: out-of-order events converge (confluence) — content-addressed canonical idempotence + join-semilattice merge + de Finetti"
created: 2026-06-07T14:46:11.129Z
depends_on: []
composes_with: ["081KTAH8Q0008QG0R001YHSSA0"]
---

# Proof: out-of-order events converge (confluence) — content-addressed canonical idempotence + join-semilattice merge + de Finetti

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH8RSXS08QG0R0039TF0AF-*.md` glob. -->

## Purpose

Aaron 2026-06-07: the content-addressed-merge property (dedup-across-strangers, ancestry-free) "is going to
come in handy on proof that proves out-of-order events end up with same results." Discharge the **confluence
/ order-independence** theorem for the CommutativeView lane. Full scaffold:
`docs/research/2026-06-07-content-addressing-is-a-confluence-lemma-out-of-order-events-same-result-aaron.md`.

## Claim

`final-state(events in order π1) = final-state(events in order π2)` for any permutations (+ duplicates +
foreign origins), on the commutative lane. Lemmas: (1) join-semilattice merge (commutative+associative+
idempotent — CRDTs + Z-set, mostly proven); (2) content-addressed canonical idempotence (reordered/
duplicate/foreign events dedup to the same nodes); (3) de Finetti exchangeability (BeliefConvergence/081KTAH8Q0008QG0R001YHSSA0).

## Build (math-leg)

- FsCheck: generate event multisets; apply under random permutations, with duplicates, split across "repos";
  assert equal final root/state (over ContentStore/DagFs/Z-set/CRDT).
- Z3/Lean: algebraic confluence (join laws + content-canonical idempotence).
- State the boundary: holds on CommutativeView (monotone/commutative — CALM); SerializedSaga is order-
  dependent by design (no confluence claim there).

## Acceptance

A property test proving permutation-invariance of final state over the commutative substrate; an algebraic
(Z3/Lean) confluence statement; the CommutativeView-vs-SerializedSaga boundary stated.

## Anchors

- confluence-lemma research doc · CRDT laws (Crdt.Laws.Tests/Z3) · ZSetMerkle/ContentStore/DagFs.merge ·
  BeliefConvergence (081KTAH8Q0008QG0R001YHSSA0) · CALM · cells-as-geodes (CommutativeView vs SerializedSaga) · Soraya portfolio.
