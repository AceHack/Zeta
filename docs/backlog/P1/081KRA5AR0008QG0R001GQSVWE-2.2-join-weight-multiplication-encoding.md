---
id: 081KRA5AR0008QG0R001GQSVWE
priority: P1
status: closed
title: "Z-set join weight multiplication as reversible Toffoli encoding (slice of 081KR50HA0008QG0R0002PGV1N)"
effort: S
created: 2026-05-11
last_updated: 2026-06-19
resolved: 2026-06-19
resolved_by: "lior/proof-yaml-locks"
depends_on: [081KR50HA0008QG0R0002PGV1N.1]
parent: 081KR50HA0008QG0R0002PGV1N
classification: buildable-now
decomposition: atomic
owners: [architect]
type: research
tags: [toffoli, zset-join, weight-encoding, reversible]
---

# 081KRA5AR0008QG0R001GQSVWE — Join weight multiplication encoding

## What (bounded slice)

Extend the circuit model with `modelWeightMul : Weight -> Weight -> ToffoliCircuitFragment`

- Encode signed magnitude weights into ancilla wires
- Use Peres-gate chains (Toffoli variant) for multiplication
- Retain all intermediates for exact reversal

No full join(A,B) yet; just the core mul primitive used by join.

## Deliverable

Pure function in F# returning circuit fragment for one multiplication.

## Evidence

- Builds on .2.1 type
- Unblocks .2.3 laws

Smallest encoding step for the join's cartesian product weights.
