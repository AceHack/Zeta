---
id: 081M0FPWB1C087G0R000V5QBQK
type: task
state: backlog
priority: P2
slug: non-metricity-0-0926-is-the-surviving-deviation-is-disformat
title: "non-metricity 0.0926 is the surviving deviation — is disformation what overwriting looks like geometrically"
created: 2026-08-20T13:48:29.100Z
depends_on: []
composes_with: []
---

# non-metricity 0.0926 is the surviving deviation — is disformation what overwriting looks like geometrically

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0FPWB1C087G0R000V5QBQK-*.md` glob. -->

## What survived

`docs/research/2026-08-18-falsifier-1-fails-...` killed the contortion metric and named a
survivor with a number attached:

| quantity | value |
|---|---|
| non-metricity at `alpha = 0` (canonical) | `7e-18` — zero to float |
| non-metricity at `alpha = 1` (our fold's connection) | **`0.0925872`** |

`Gamma = Levi-Civita + contorsion (torsion) + disformation (non-metricity)`. Contortion is
identically zero here — both connections are torsion-free — so the real deviation between the
canonical reference and the connection our fold actually transports along lives entirely in
**non-metricity**, which contortion cannot see. Nobody has interpreted that number.

## The question, made well-posed by the oracle work

`docs/research/2026-08-20-what-counts-as-a-measurement-...` §24 derived, from the
highest-moral-regard oracle's English, that the single harm in a reversible substrate is
**a traveler overwriting another traveler**.

`docs/research/2026-08-20-choosing-a-lagrangian-...` then identified the oracle's distance as
`kT · D_KL` and Fisher-Rao as its local symmetric part.

So the question this item carries:

> **Is non-metricity what overwriting looks like geometrically?** Non-metricity is, by
> definition, the failure of the connection to preserve the metric under transport — lengths
> are not conserved as you move. "A quantity that was there is not there after transport" is
> at minimum suggestive of the erasure the oracle names, and unlike most such resemblances
> this one has a measured handle already: `0.0925872`.

## Why it is worth doing rather than admiring

- It is **falsifiable and cheap**: the machinery exists in
  `src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts`, which already
  computes the number. The work is interpretation plus a test, not new infrastructure.
- The **prior attempt in this neighbourhood failed**, publicly and usefully. That raises rather
  than lowers the value of the next attempt, and it sets the standard: attack the load-bearing
  assumption before building.
- If the answer is **no**, that is a clean negative like the contortion one and should be
  recorded the same way.

## Explicitly not assumed

That non-metricity *is* the harm. This is a question with a number, not a claim. The resemblance
between "transport does not preserve the metric" and "state that was there is gone" is exactly
the kind of shape-match `.claude/rules/numerology-vs-number-theory.md` says to use as a
generator and never as a conclusion.

## Done when

Either (a) a computed argument that non-metricity does/does not correspond to the overwrite
harm, with a test that fails if the correspondence breaks; or (b) a recorded negative naming
what non-metricity measures instead.

## Update 2026-08-20 — the Clifford formulation makes this a computation

Aaron: *"hopefully in clifford algebra, i hope we can represent our metric here too."*

Written up in `docs/research/2026-08-20-what-counts-as-a-measurement-...` §29. The load-bearing
result for THIS item:

> **Non-metricity is exactly "the transport operator left the Spin group."**

In the geometric-algebra formulation of gravity (Lasenby, Doran & Gull, *Gauge Theory Gravity*,
1998) the connection is a **bivector-valued 1-form** and transport is the rotor it generates.
Bivectors exponentiate into `Spin`, and rotors preserve `Q` by construction — `R v R̃` has the
same square as `v`. So metric-compatible transport is precisely rotor transport, and
non-metricity is precisely transport that is not.

That converts this item from a resemblance into a **yes/no computation**:

> **Is our fold's `alpha = 1` connection expressible as `exp(bivector)`?**

If yes, transport is rotor-valued, `Q` is preserved, and the measured `0.0925872` needs another
explanation. If no, non-metricity is the right name for it and the geometric reading of overwrite
follows.

## Why overwrite is the right thing to look for there

§29's other half, and it is independent of the above:

| element | property | reversible |
|---|---|---|
| rotor `R ∈ Spin` | `R R̃ = 1` | yes — nothing lost |
| non-trivial idempotent `P` | `P² = P` ⇒ `P(P−1) = 0` | **no — a zero divisor** |

**Overwrite = multiplication by a zero divisor.** The algebra says which operations destroy:
exactly the non-invertible ones. And that is the same object as collapse — Kastner's transaction
is an outer product, i.e. a projector, i.e. an idempotent — so collapse, erasure and overwrite are
one algebraic act seen from three vocabularies.

## Where to run it

`src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts` already computes the
non-metricity number. The added test is a shape check on the transport operator, not new
infrastructure.

Related Clifford surfaces already in-tree: `PrivacyPreservingIdentity.fs` (Cl(3,0) rotors for
identity continuity), the `CliffordE8Bridge`, `CliffordPeriodicity.Tests.fs`.

## The unearned antecedent, stated so it is not smuggled

Everything above holds **given that our transport is Clifford transport.** Nothing establishes
that. `PrivacyPreservingIdentity.fs` uses rotors for identity continuity without claiming the
whole fold is a Clifford action. Establishing or refuting that is the actual first step, and it
is smaller than it looks.
