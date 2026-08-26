---
id: 081M0R18878087G0R001XY5A2J
type: task
state: backlog
priority: P2
slug: await-formal-analysis-before-any-clifford-gpu-implementation
title: "Await formal analysis before any Clifford-GPU implementation -- five questions to the math team"
created: 2026-08-23T19:23:40.648Z
depends_on: []
composes_with: ["081KQTPYE0008QG0R002Y7X5KH", "081M0QMDM99087G0R0034D6EQP"]
---

# Await formal analysis before any Clifford-GPU implementation -- five questions to the math team

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R18878087G0R001XY5A2J-*.md` glob. -->

## Why this row exists

`docs/design/2026-08-23-clifford-gpu-theory-brief-geometric-root-metered-clock-and-five-questions-for-the-math-team.md`
is a **theory brief, not a design**. Aaron 2026-08-23: *"the geometric root has zero implementation in
Zeta. we should **route this to math team first**, then we code after they have us some **solid
theoretical formal analysis**."*

This row is the hold. **No Clifford-GPU code, lowering, classifier, or measurement is started until
Q1-Q5 come back.** It exists so the hold is an artifact rather than an intention.

**Architectural primacy is not epistemic primacy.** Aaron's decision to make geometry the root and
the Bayesian/NG4 layer a fast approximation over it is taken -- but NG4 is the `metered` layer
(round-trip max KL 4.0e-8, ten falsifiers) and the geometric root has zero implementation. Placing
it underneath does not transfer confidence downward. That is the reason to route first.

## Acceptance criteria -- the five questions (full statements in the brief, §7)

Each carries a refutation condition in the brief; a question that cannot be answered "no" is not a
question. A **negative** answer to any of these is a **successful** outcome for this row.

- **Q1** -- Is `WeightedSet<'K,'W>` compact closed? Do the snake identities hold, and under which
  extra hypotheses (finite enumerable basis? commutative `Mul`? a field)?
  Bears on `src/Core/WeightedSet.fs`, `src/Core/Semiring.fs`,
  `tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs`.
- **Q2** -- Does dual flatness *entail* the vector-addition Bayesian update, or merely accompany it?
  Bears on whether NG4's headline associativity is a theorem of the geometry or an artifact of
  conjugacy.
- **Q3** -- Can a Normal-Gamma posterior be exhibited as a region in a conceptual space under a
  **named metric**, with a **stated approximation error**? *(The brief puts this one first --
  everything downstream of "the Bayesian layer is an optimization" depends on it.)*
- **Q4** -- Does CGA compose with the in-tree Clifford substrate (`Cl3.fs`, `CliffordPeriodicity.fs`,
  the `CliffordE8*` lineage), or are they distinct algebras sharing a name?
- **Q5** -- Is Gardenfors convexity testable on an embedding we can build -- specifically the RKHS a
  `LinguisticSeed` kernel induces? Any test must carry a disjunctive-category negative control.

## What is NOT blocked by this row

The brief's §2 (survey of SPIR-V / SPIRV-Cross / MLIR / Halide / TVM / Slang and what each commits
you to), §4 (the clock commitment Aaron already settled -- meter the crossing, soft-Sequoia, machine
model keyed by machine identity so firmware drift makes a stale row structurally absent), and §5
(honest CGA-versus-matrix costing) are engineering reconnaissance and stand on their own.

## Q4 DISCHARGED 2026-08-26 -- the hold REMAINS in force for Q1/Q2/Q3/Q5

**Q4 asked:** does CGA compose with the in-tree Clifford substrate, or are they distinct
algebras sharing a name?

**Answer: they are the same tower, one suspension apart.**

> **CGA(3D) = Cl(4,1) ~= M_2(Cl(3,0))**

Both sit at Atiyah-Bott-Shapiro clock position `s = 3`, over ground field **C**, neither
split; and the suspension isomorphism `Cl(p+1,q+1) ~= M_2(Cl(p,q))` holds on every
signature checked. dim_R: 32 = 4 x 8, and M_2(M_2(C)) = M_4(C). **The in-tree `Cl3` is not a
rival to CGA -- it is the entry type of the matrix CGA is built from.** The two extra
generators CGA needs are exactly the null pair `n_0`, `n_inf` of the conformal embedding.

**The one real cost, and it is structural:** the rotor path does NOT inherit.
`Cl^0(4,1) ~= Cl(4,0)` lands on `s = 4`, which is **quaternionic** (M_2(H)), while
`Cl(3,0)`'s own rotors are complex. Conformal rotors are new arithmetic, not a reuse. That
belongs in any implementation estimate.

**Refutation condition addressed:** the answer is wrong if the suspension isomorphism fails
or the ABS transcription is wrong. Both are checked, and the checks are committed:
`src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.{ts,test.ts}` --
20 falsifiers, including a **cross-oracle** check against `CliffordPeriodicity.fs` itself
(golden vector emitted by the F# module, consumed by the TypeScript; zero divergence over
169 signatures) and seven break-red mutations that each turn it red.

**Independent external convergence** (not a substitute for the remaining questions):
*Euclidean, Projective, Conformal: Choosing a Geometric Algebra for Equivariant
Transformers* (arXiv:2311.04744) reaches the same tower choice empirically -- Euclidean GA
*"has a smaller symmetry group and is not as sample-efficient"*, projective *"not
sufficiently expressive"*, conformal and an improved projective *"define powerful,
performant architectures."* Read from the abstract only.

**Still open, and the hold still applies to them:** Q1 (compact closure of
`WeightedSet`), Q2 (does dual flatness entail the vector-addition update), Q3 (Normal-Gamma
posterior as a region under a named metric with a stated error), Q5 (Gardenfors convexity
on a buildable embedding). **Q3 is the one that gates spatial belief in a BNN column** --
without an error budget, embedding a belief as a point is unfalsifiable.

Full derivation: `docs/research/2026-08-26-cga-is-m2-of-the-in-tree-clifford-q4-answered-and-the-lp-ceiling-that-prices-a-reservoir.md`

## Exit condition

The math team returns on Q1-Q5. Each answer lands with its refutation condition addressed. Only then
does an implementation row get filed -- and its shape depends on the answers, which is the point.

