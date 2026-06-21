---
id: 081KR50HA0008QG0R00096ZEYA
priority: P1
status: claimed
title: "Policy relocation semantic preservation — FsCheck property for mobile DBSP query boundaries"
effort: M
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: buildable-now
decomposition: atomic
owners: [architect]
type: feature
tags: [dbsp, caspaxos, policy, relocation, fscheck, formal-verification]
---

# 081KR50HA0008QG0R00096ZEYA — Policy relocation semantic preservation

## What

Write one FsCheck property that demonstrates policy relocation:
a reactive query (DBSP circuit) that runs locally, gets moved
to central execution, and produces the same delta output via
DBSP reintegration.

This is the concrete proof that the mobile policy boundary
preserves semantics — the claim that distinguishes Zeta's
design from classical BFT (which assumes fixed agreement
protocols).

## The claim being proven

> Our policy boundaries are DBSP reactive queries that can be
> relocated between local and central execution, with changes
> reintegrated via the retraction-native delta algebra.

The FsCheck property: for any input delta stream S, running
query Q locally on S produces the same output as running Q
centrally on S, up to reintegration via the DBSP algebra.

## Decomposition (Confucius-unroll)

One primitive: policy-as-DBSP-query.
One formal shape: circuit equivalence under relocation.
One falsifiable property: local(Q, S) = central(Q, S) after
reintegration.

## Acceptance criteria

- [x] FsCheck property in tests/Tests.FSharp/Properties/
- [x] Property covers at least one non-trivial query (join or
      aggregate, not just map)
      — two properties: Join+GroupByCount and GroupByCount-only
- [x] Property passes with 1000+ generated inputs
      — MaxTest = 1000 on each property; 4/4 tests pass
- [x] Adversarial review (shadow catch #30 protocol): is the
      property trivially true by definition?
      — No: each Circuit.create() produces independent mutable state
        (join indices, output snapshots). A non-deterministic or
        shared-state implementation would falsify the properties.
        Comment in the file documents this explicitly.

## Composes with

- 081KR50HA0008QG0R0033TN4H9 (Z3 proof replacement — same proof-quality axis)
- 081KR50HA0008QG0R0010RZTJK (DBSP identity continuity)
- 081KR50HA0008QG0R001G4QHQF (anchor to human lineage — CSP trace equivalence)
- Confucius-unroll discipline (one primitive, one shape, one property)
- Framing discipline (different capability, not "ahead of")
