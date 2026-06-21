---
id: 081KT2T2J0008QG0R000S7GHQ8
priority: P1
status: open
title: "Zeta Infer.NET rewrite — F# factor-graph + message-passing inference engine (BP / EP / VMP / Gibbs) on the DBSP nested-circuit + semiring substrate; the seed CE is the model DSL (Aaron 2026-06-02)"
tier: research
effort: XL
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R003VK5GRX]
composes_with: [081KT2T2J0008QG0R003VK5GRX, 081KT2T2J0008QG0R0019YVX8M, 081KT2T2J0008QG0R0026MS6PV, 081KRFA460008QG0R0018SN61J, 081KRMEXM0008QG0R001VGNET5, 081KRMEXM0008QG0R002YSPW1X, 081KRMEXM0008QG0R003YWZC21]
tags: [infer-net, infernet-rewrite, bayesian-inference, factor-graph, message-passing, belief-propagation, expectation-propagation, vmp, gibbs, sum-product, semiring, dbsp, nested-circuit, fixpoint, conjugate-prior, exponential-family, seed-core, seed-ce, model-dsl, incremental-inference, fsharp, research, aaron]
type: research
---

# Zeta Infer.NET rewrite — factor-graph + message-passing inference on the DBSP-semiring substrate

## Why

Aaron 2026-06-02: *"we want to rewrite infer.net completely maybe this is our reason to start"* — said while standing up the seed core in F# (081KT2T2J0008QG0R003VK5GRX). This is **not new scope**: it is the framework's long-stated inference future-state finally getting its starting point. `peer-call-infrastructure` already names it — *"future state is Zeta Infer.NET BP/EP (Belief Propagation / Expectation Propagation) substrate-level inference replacing the external-CLI-license-layer"* — and 081KT2T2J0008QG0R003VK5GRX defined the seed as *"an F# computation-expression DSL over a reduced Bayesian Infer.NET model."* The seed CE **is** the model-building frontend of this engine. Aaron's instinct is right: the seed core is the place to start the rewrite.

## License posture — clean F# reimplementation (MIT)

Infer.NET is **MIT-licensed open-source** ([dotnet/infer](https://github.com/dotnet/infer), open-sourced 2018). "Rewrite completely" = a clean F# reimplementation; the dotnet/infer source may be **studied freely** (MIT, commercial-OK) — this is NOT an Itron/proprietary concept-only constraint. Cite dotnet/infer for any algorithm derived from it; honor-those-that-came-before.

## Clean-room spec from formal-proof papers + formal verification (Aaron 2026-06-02)

Aaron 2026-06-02: *"there are papers for everything in f# with formal proofs we can borrow and use for cleanroom spec."* The **clean-room spec source is the peer-reviewed literature with formal proofs**, not dotnet/infer's code — the *strongest* clean-room posture (spec-from-published-math, implementation-in-F#) AND it adds a **formal-verification dimension**: the algorithms come with *proven* properties, so the implementation gets test obligations + property tests + candidate machine-checked proofs for free.

| Algorithm | Clean-room spec paper (study-and-cite) | The proven property → F# obligation |
|---|---|---|
| Factor graphs / **sum-product BP** | Kschischang, Frey, Loeliger, *"Factor Graphs and the Sum-Product Algorithm"* (IEEE IT 2001) | BP is **exact on trees** → property test: tree-BP marginals = brute-force marginals |
| **Expectation Propagation** | Minka, *"Expectation Propagation for approximate Bayesian inference"* (UAI 2001) + thesis | EP fixed point = **stationary point of the (local) divergence** → fixed-point + moment-match law |
| **Variational Message Passing** | Winn & Bishop, *"Variational Message Passing"* (JMLR 2005) | VMP **monotonically increases the ELBO** → monotonicity property test |
| EP / VMP / BP **unified** | Minka, *"Divergence measures and message passing"* (MSR-TR 2005) | all three = message passing minimizing an α-divergence → one message-op algebra, three projections |
| Exponential-family / conjugacy | std exp-family + conjugate-prior literature (Bishop PRML ch.2/10) | conjugate update = exact message product → conjugate-exactness test vs `BayesianAggregate` |

**Formal-verification routing** (per `formal-verification-expert` / Soraya, BP-16): the proven laws above become (a) **FsCheck property tests** + `LawRunner.fs` law-suites by default; (b) candidate **Lean / Z3** machine-checked proofs for the load-bearing invariants (semiring axioms; BP-exact-on-trees; EP moment-match idempotence; VMP ELBO-monotonicity). The F# compiler is the first asymmetric critic (`fsharp-anchor` — `dotnet build` = sanity); the papers' proofs are the second (the property/proof obligations the impl must satisfy). Spec from papers → referee (081KT2T2J0008QG0R0026XCGQM) against the papers' worked examples, not against dotnet/infer outputs alone.

## What it builds ON (verify-existing-substrate — compose, don't parallel-mint)

The engine sits on rich existing substrate; the rewrite is largely *filling the probabilistic gaps the interfaces already anticipate*:

| Existing substrate | Role in the inference engine |
|---|---|
| **`Semiring.fs` `ISemiring<'W>`** (IntegerRing, IntervalRing; doc names "probabilistic, Gaussian … semirings" as intent) | BP is the **sum-product algorithm over a semiring**; the **message types are the missing probabilistic semirings** (Gaussian / log / tropical-for-MAP) |
| **`Circuit.fs` / `NestedCircuit.fs`** (`Fixedpoint`; DBSP §5-6 recursive-query-to-fixed-point) | message-passing-to-convergence ≡ **iterate a nested circuit to a fixed point** → the inference **scheduler** is already here; inference runs **on DBSP** (→ incremental re-inference on a data delta) |
| **`BayesianAggregate.fs`** (BetaBernoulli / NormalInverseGamma / DirichletMultinomial conjugate updates) | conjugate updates **are the closed-form messages** (the exact exponential-family message products) |
| **`Algebra.fs` / `ZSet` / `GSet` / `Bag`** (weighted structures over semirings) | weighted-support distributions; discrete/categorical messages |
| **`CayleyDickson.fs` / `Vector` / `Wall`** (081KT2T2J0008QG0R003VK5GRX slice 1, #6587) | the geometric/vector substrate; the seed-CE nouns |
| **seed CE** (081KT2T2J0008QG0R003VK5GRX) | the **model DSL** — `seed { let! x = gaussian …; observe …; … }` builds the factor graph |

No factor-graph / BP / EP engine exists yet (greenfield), but the floor under it is substantial.

## Architecture

1. **Message / distribution algebra** — exponential-family distributions (Gaussian, Beta, Gamma, Dirichlet, Bernoulli, Discrete) as **semiring elements** with `product` (combine messages), `divide` + `momentMatch` (EP's projection), `normalize`. Conjugate closed-forms from `BayesianAggregate` are the exact message products.
2. **Factor graph** — variables (nodes) + factors (constraints); the bipartite graph data structure.
3. **Schedulers / inference engines** — message-passing to fixed point as a **DBSP nested circuit**: **sum-product BP**, then **EP** (moment-matching projection), then **VMP**, then **Gibbs** (sampling).
4. **Model DSL** — the **seed CE** builds the factor graph (this is where slice-1 `Vector`/`Wall` + the CE wire in).
5. **Compiler** (later) — compile the CE-built factor graph to a DBSP circuit schedule (Infer.NET's model-compiler analog; AOT-safe, no reflection-emit — the constraint that made `BayesianAggregate` hand-roll conjugates).

## This resolves the seed-CE A/B/C fork (081KT2T2J0008QG0R003VK5GRX)

The fork was: (A) seed CE over conjugate-prior `BayesianAggregate`; (B) fresh finite discrete probability monad; (C) synthesis. **"Rewrite Infer.NET" subsumes all three**: conjugate families = closed-form messages (A); discrete enumeration = sum-product on finite domains (B); unified into one factor-graph + message-passing engine (C generalized) on the DBSP-semiring substrate. A and B are special cases of the real engine.

## Build-most-inevitable-first decomposition (slices)

- **slice 1** (landed, [#6587](https://github.com/Lucent-Financial-Group/Zeta/pull/6587)): `Vector` + `Wall` nouns (081KT2T2J0008QG0R003VK5GRX).
- **slice 2** (recommended next): the **message/distribution algebra** — exponential-family distributions as semirings + `product`/`divide`/`momentMatch`/`normalize`; compose `BayesianAggregate` conjugate math; exact + deterministic + testable; the non-contentious kernel.
- **slice 3**: the **factor** + **factor-graph** data structure.
- **slice 4**: **sum-product BP** as a DBSP nested circuit (iterate-to-fixpoint).
- **slice 5**: **EP** (moment-match projection over the exp-family message algebra).
- **slice 6**: the **seed CE** as the model DSL (wires in slice-1 `Vector`/`Wall`).
- **later**: VMP; Gibbs; the model compiler; the full distribution zoo; benchmarks vs dotnet/infer.

## The differentiator — incremental inference on DBSP

Stock Infer.NET recompiles/re-runs inference on data change. Built on DBSP nested-circuits, Zeta's engine **re-infers on a delta** (incremental view maintenance applied to message-passing) — re-run only the affected sub-graph to a new fixed point. That's the substrate edge (composes the framework's whole DBSP thesis).

## Acceptance (research → build, incremental)

1. **slice 2 lands** — message algebra (exp-family distributions as semirings + product/divide/momentMatch), 0-warning gate, monad/semiring-law + conjugate-exactness tests vs `BayesianAggregate`.
2. **slice 3-4** — factor graph + sum-product BP on a small model (e.g. a chain / a beta-bernoulli model) matches the closed-form conjugate answer.
3. **slice 5** — EP on a model where conjugacy fails (e.g. a probit/logistic factor) matches dotnet/infer's EP within tolerance (referee principle, 081KT2T2J0008QG0R0026XCGQM).
4. **Hold don't-collapse + labeling-confidence** — `[established: BP=sum-product-over-semiring, EP, MIT-Infer.NET]`; `[hypothesized: DBSP-incremental-inference advantage to measure]`; `[XL multi-year: zeta-ships-with-skills — immediate value as slices land, crystallized engine later]`.

## Composes with substrate

- **081KT2T2J0008QG0R003VK5GRX** (seed CE — the model DSL; slice-1 `Vector`/`Wall` #6587) · **081KT2T2J0008QG0R0019YVX8M** (hex-core domains-as-adapters; physics adapter = the Clifford/message geometry) · **081KT2T2J0008QG0R0026MS6PV** (six reservoir walls) · **081KRFA460008QG0R0018SN61J / 081KRMEXM0008QG0R001VGNET5** (F# fork for AI safety / Clifford) · **081KRMEXM0008QG0R002YSPW1X / 081KRMEXM0008QG0R003YWZC21** (Remember-When + Pay-Attention seed → categorical primitives)
- existing F#: `Semiring.fs` (ISemiring), `Circuit.fs`/`NestedCircuit.fs` (fixpoint scheduler), `BayesianAggregate.fs` (conjugate messages), `Algebra.fs`/`ZSet`, `CayleyDickson.fs`
- rules: `verify-existing-substrate-before-authoring` (compose the semiring/DBSP/conjugate substrate), `bcl-interface-boundary-own-your-interfaces-hexagonal` (own the inference interfaces; dotnet/infer is a *reference*, adapt-in not depend-on), `numerical-algebra-shaped-into-the-generic-math-interface` (distributions/semirings → generic-math), `monad-propagation-pattern` (the seed CE Result/Dist monad shape), `zeta-ships-with-skills-immediate-value` (slices ship value; engine crystallizes later), `honor-those-that-came-before` (cite dotnet/infer, MIT), `razor-discipline` + `god-tier-claims-high-signal-high-suspicion-dont-collapse` (incremental-advantage is a hypothesis to measure), `dst-plus-persist-plus-generator-time-plus-feedback...` (DST over the inference)
- `peer-call-infrastructure` rule (the BP/EP future-state this row starts)

## Sources (search-first, 2026-06-02)

- [dotnet/infer (GitHub, MIT)](https://github.com/dotnet/infer) — the framework being rewritten
- [Microsoft Research — Infer.NET goes open source](https://www.microsoft.com/en-us/research/blog/the-microsoft-infer-net-machine-learning-framework-goes-open-source/) (MIT, 2018; EP/VMP/Gibbs)
- [Infer.NET — Wikipedia](https://en.wikipedia.org/wiki/Infer.NET) (factor graphs; message-passing inference)

## Substrate-honest framing

`[labeling-confidence: established core (BP/EP/sum-product/semiring/MIT-Infer.NET); hypothesized DBSP-incremental-inference advantage to measure; XL multi-year per zeta-ships-with-skills]`. This is the framework's long-stated Zeta-Infer.NET-BP/EP future-state (peer-call rule) getting its starting point at the seed core — not new scope. The "rewrite completely" is honest because Infer.NET is MIT (clean reimplementation, not concept-only), and the engine composes substantial existing substrate (semiring + DBSP nested-circuit + conjugate messages) rather than starting from zero. Incremental-inference-on-DBSP is the differentiator to *measure*, held don't-collapse until benchmarked vs dotnet/infer.
