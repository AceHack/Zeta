---
id: 081M0QFQYEQ087G0R003SW6VD8
type: task
state: backlog
priority: P2
slug: qec-m3-q-stabilizer-simulation-cross-check-of-the-16-6-4-syn
title: "QEC M3: Q# stabilizer-simulation cross-check of the [[16,6,4]] syndrome-extraction circuit (BP-16 second tool)"
created: 2026-08-23T14:17:40.567Z
depends_on: []
composes_with: []
---

# QEC M3: Q# stabilizer-simulation cross-check of the [[16,6,4]] syndrome-extraction circuit (BP-16 second tool)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QFQYEQ087G0R003SW6VD8-*.md` glob. -->

**Depends on:** 081M0QFQYDK087G0R0028FQSM2 (M2).
**Routing:** Q# + stabiliser simulation. Gottesman-Knill gives exact poly-time simulation of
Clifford circuits, so this layer is cheap and certain. See `docs/research/2026-08-23-qec-stack-routing-the-adinkra-bridge-closes-at-n8-and-reopens-at-n16-soraya.md` §5 L6.

## Why this milestone is not optional

M1 and M2 are ONE instrument (enumeration) wearing two hats. **BP-16: single-tool P0 evidence
is insufficient.** Q# is the independent second instrument, and it is the only layer of the
stack that is genuinely quantum rather than classical F_2 linear algebra.

## What lands

The syndrome-extraction circuit for [[16,6,4]] in Q#, stabiliser-simulated, cross-checked
against M2's enumerated syndrome table.

## Premise correction this milestone carries

There is **no** adinkra ECC in Q# today, and no QEC of any kind. `src/Core.QSharp.ReferenceOracle/`
is a byte-lock parity oracle for the finite-resolution qubit model — its README's "CSS" is
Cascading Style Sheets, and its five adinkra/ECC grep hits are all comments. Aaron's premise
was wrong about what Q# holds today and right about where the quantum layer belongs.

Also note: every in-tree occurrence of "stabilizer" outside this milestone is the
GROUP-THEORETIC stabiliser (`ClaimLane.fs`, `aut-budget.ts`), a different object sharing a
word. `Cl3.fs:11` already flags the collision.
