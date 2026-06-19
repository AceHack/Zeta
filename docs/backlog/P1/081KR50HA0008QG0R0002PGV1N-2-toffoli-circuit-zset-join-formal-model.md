---
id: B-0366.2
zetaid: 081KR50HA0008QG0R0002PGV1N
priority: P1
status: closed
title: "Toffoli circuit for Z-set join — formal gate-network model"
effort: M
created: 2026-05-09
last_updated: 2026-06-19
resolved: 2026-06-19
resolved_by: "lior/proof-yaml-locks"
depends_on: [081KR50HA0008QG0R0021B5J87]
parent: 081KR50HA0008QG0R003T5MZAC
classification: buildable-now
decomposition: decomposed
children: [081KR50HA0008QG0R0002PGV1N.1, 081KR50HA0008QG0R0002PGV1N.2, 081KR50HA0008QG0R0002PGV1N.3]
owners: [architect]
type: research
tags: [toffoli, reversible-computing, zset, join, circuit-model, landauer]
---

# B-0366.2 — Toffoli circuit model for Z-set join

## What

Model a Z-set join as a Toffoli-gate network. The join is the most common
DBSP operation and the natural comparison target for the FPGA experiment.

A Z-set join of two Z-sets A and B produces:
```
join(A, B) = { (a, b) → w_A(a) × w_B(b) | a ∈ A, b ∈ B }
```

### Gate network design

Each weight multiplication `w_A × w_B` in the traditional (irreversible)
implementation destroys information. In the Toffoli encoding:

- Weights are encoded as binary (sign + magnitude)
- Multiplication uses reversible Toffoli arithmetic (Peres gate chains)
- All intermediate results are retained (no garbage collection)
- The ancilla bits serve as the inverse function — apply the circuit in
  reverse to recover inputs exactly

### Bit budget

For a join over N entries in A × M entries in B:

- **Traditional gate model**: erases log₂(N×M) bits per output entry (weight multiplication)
- **Toffoli model**: erases 0 bits — ancilla bits carry the inverse
- **Landauer saving**: (log₂(N×M)) × kT·ln2 joules per output entry (CONJECTURED at this scale)

### Deliverable

An F# function `modelJoinCircuit : ZSet<'K> -> ZSet<'K> -> ToffoliCircuit` that
returns a circuit description (gate list + wire map) for a symbolic join.
No hardware needed; the circuit is a data structure.

## Pre-start checklist

- **Prior-art search**: Bennett (1973) + Frank (2017) cover reversible arithmetic.
  No existing Toffoli circuit model for Z-set join in repo.
- **Dependency**: requires B-0366.1 (ToffoliGate types) to be landed first.

## Re-decomposition (2026-05-11, Riven background)

Original marked "atomic" but M-effort deliverable spans type model, encoding logic, and law proofs — too broad for one bounded step. Re-decomposed into 3 smallest atomic children per "always re-decompose, assume mistakes" rule:

- B-0366.2.1: ToffoliCircuit type + wire-map (S, buildable-now)
- B-0366.2.2: weight multiplication encoding (S, buildable-now)
- B-0366.2.3: reversibility laws + FsCheck (S, buildable-now)

All F#-first, depend only on landed B-0366.1. One bounded step: this decomp PR. Implementation of children follows in separate claims.

This satisfies "if too broad, decompose before implementation".
