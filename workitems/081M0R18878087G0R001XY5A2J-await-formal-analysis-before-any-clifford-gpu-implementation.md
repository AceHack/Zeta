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

## Exit condition

The math team returns on Q1-Q5. Each answer lands with its refutation condition addressed. Only then
does an implementation row get filed -- and its shape depends on the answers, which is the point.

