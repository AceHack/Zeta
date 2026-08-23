# The soft regime — one substrate, many semirings: an accurate map, not an architecture

**Date:** 2026-08-23 · **Register:** `toy` (whole document) · **Shape:** satellite of
[`docs/ZETA-ARCHITECTURE-UNIFIED.md`](../ZETA-ARCHITECTURE-UNIFIED.md)

> **`toy` per [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md).**
> This document proposes a unification. Nothing enforces it. A design doc claiming unification
> that no check can falsify is the vacuity class at architecture scale, so the register is stated
> at the top and every row below carries its own. It sheds `toy` when the joints in §8 are wired
> and a test fails without them — not before.

Aaron's ask (2026-08-22):

> *"the hope is to tie all this together into an overarching soft regime where all the different
> soft parts can work together and understand each other … we should save this as some overall
> soft regime design somewhere … that's a lot of parts to pull together."*

He is right that it is a lot of parts. The value of this document is being an **accurate map plus
one unifying claim** — not an architecture fantasy. Most joints below are *proposed*. Every row
says which.

---

## 0. Where this doc sits (hub / satellite — resolved explicitly)

`docs/ZETA-ARCHITECTURE-UNIFIED.md` already exists and is the **hub**: a 7-layer map from
transport up through substrate verification, audience "Max, Aaron, Addison, and any new
contributor". It is **not stale** — it names live modules (`AdinkraCode.fs`, `udp-lossy-transport.ts`,
`SoftRegimeStability.fs`) and carries corrections dated 2026-08-16.

**Decision: satellite, not extend, not supersede.** Per
[`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md)
§5 — partition by change rate. The unified doc is the stable hub (it changes when a *layer*
changes); the soft regime is a fast-changing satellite (it changes every time a joint is wired or
refuted). Two "unified architecture" documents drifting apart is worse than one map, so this file
takes a **named, narrower scope**: *the weight-carrying / uncertainty-carrying parts and the
algebra that would let them compose.* It claims no authority over transport, gossip, evolution, or
the 17-oracle proof layer, which are the hub's.

The society layer additionally has its own consolidation at
`docs/research/2026-06-15-the-zeta-society-architecture-consolidated-md-interface-isociety-eve-game-self-regeneration.md`;
§6 below defers to it and to `src/Core/Levels.fs` rather than re-deriving.

**Naming collision, stated so nobody trips on it:** `src/Core/SoftRegimeStability.fs` already
uses the words "soft regime" for a *different* object — the orbit-symmetric belief regime of a
3-body Nash game. That module is **not** what this document is about. Same words, different
referent; noted per the anti-Babel discipline rather than renamed.

---

## 1. The unifying claim

> **Every soft part is a weighted set `'K → 'W` at a different key type and weight type. The
> semiring on `'W` is what distinguishes them, and a transfer between two parts is a semiring
> homomorphism.**

**Register: `built` as mathematics, with a checked human anchor — and it is not ours.**

The claim is the **Generalized Distributive Law**: Srinivas M. Aji & Robert J. McEliece,
*"The Generalized Distributive Law"*, IEEE Transactions on Information Theory **46**(2):325–343,
2000. Sum-product (probability), max-product / min-sum (Viterbi, tropical), FFT and DBSP signed
counting are **one algorithm over different commutative semirings**.

It is already written down in-tree, twice, with the anchor attached:

- `src/Core/WSet.fs` header — *"The unifying theorem is the Generalized Distributive Law
  (Aji–McEliece 2000): sum-product, max-product, FFT and friends are ONE algorithm over different
  commutative semirings."*
- `src/Core.TypeScript/algebra/wset.ts` header — the same sentence, with the three ring instances
  named (`LogProbRing`, `TropicalRing`, `IntegerRing`).

**So the frame is not a new discovery and this document does not claim it as one.** What is new
here is the *audit*: which parts actually sit on that substrate, and which only say they do.

**Second anchor, for the cost half:** Daniel J. Lehmann, *"Algebraic structures for transitive
closure"*, Theoretical Computer Science 4(1):59–76, 1977; Dexter Kozen, *"A completeness theorem
for Kleene algebras"*, Information and Computation 110(2), 1994; Mehryar Mohri, *"Semiring
frameworks and algorithms for shortest-distance problems"*, JALC 7(3), 2002; Gondran & Minoux,
*Graphs, Dioids and Semirings*, 2008. All four already cited in `src/Core/TropicalPaths.fs` and
`src/Core/KleeneClosure.fs`.

---

## 2. THE FINDING: the substrate is triplicated, so the parts do **not** understand each other

This is the most load-bearing result in the audit, and it inverts the premise of the ask.

There are **three** structurally-unrelated generic weighted-set types in F#, and **two**
structurally-incompatible `StarRing` interfaces in TypeScript:

| type | file | weight contract | backing | consumers in `src/` |
|---|---|---|---|---|
| `WeightedSet<'K,'W>` | `src/Core/WeightedSet.fs` | `ISemiring<'W>` / `IRing<'W>` instance-passed | `Map<'K,'W>`, canonical (Zero pruned) | **1** — `RayTensor.fs`. (`CayleyDickson.fs:38` and `SoftValueNumeric.fs:16` name it in **comments only**; five test files exercise it.) |
| `WSet<'K,'W>` | `src/Core/WSet.fs` | `*`-ring, caller-supplied `isZero` | unconsolidated `('K*'W) list` | **9+** — `DiskSpine`, `ShapeRender`, `SoftScheduler`, `WSetHeat`, `FrequencyMachZehnder`, `CyclotomicAmplitude`, `BipartiteMachZehnder`, `QuantumObservableDbsp`, `ShapeAcceptance` |
| `ZSetW<'K,'W>` | `src/Core/ZSetW.fs` | `ISemiring` / `IRing`, struct-generic hot path | perf Z-set | **5** — `ZAtom`, `NovelMath`, `MergeKernel`, `TropicalPaths`, `KleeneClosure` |

```
StarRing in TS — two definitions, incompatible:
  src/Core.TypeScript/algebra/wset.ts:16      { zero, one, add, mul, negate? }        // negate OPTIONAL, no conj
  src/Core.TypeScript/algebra/star-ring.ts:28 { zero, one, add, mul, negate, conj }   // both REQUIRED
```

**Register: `built` (measured, by grep over `src/`, at `5d29357d6b`).**

Consequences that must be said plainly:

1. **The type the brief calls "the generic substrate" is the least-used of the three.**
   `WeightedSet.fs` has exactly one consumer. `WSet.fs` carries the amplitude/quantum lane;
   `ZSetW.fs` carries the tropical/DBSP lane. Naming `WeightedSet` as *the* substrate would be a
   claim the reachability graph refuses.
2. **A "transfer function is a semiring homomorphism" cannot be written today** between parts that
   live on different carriers, because there is no shared carrier to be a homomorphism *of*. The
   claim in §1 is true of the mathematics and false of the code.
3. `WSet.fs` carries a recorded dissent (Rodney's Razor 2026-06-11: *"essential as mathematics,
   accidental as code; zero non-test consumers"*), overridden by Aaron. That dissent has since been
   met — it now has nine consumers. The razor was answered by use, which is the right way for it to
   be answered. **The same question is now open against `WeightedSet.fs`, in the other direction.**

Work-items: `081M0QHPRH5087G0R000XN827S` (three F# types), `081M0QHPRJ4087G0R003BCB5V1` (two TS `StarRing`s).

---

## 3. Register table — every part named in the ask

`built` = the file and the behaviour exist and a test exercises them. `proposed` = would have to be
written; the row says what. `coincidence` = shares a word, not an object.

**Tally across §3 and §12 — ~40 `built`, ~11 `proposed`, 3 `coincidence`, 2 `refuted`, 1 dead.**
The high `built` count is not a success story: the parts exist, and §2 is the finding that they do
not sit on a common carrier. **Counting built parts measures inventory, not integration** — which is
precisely the confusion this document exists to remove.

- **`coincidence` (3):** `VisionAttention` as "a `WeightedSet` over a spatial `'K`" · RGBA/CMYK as the
  quaternion rung · "quasi **time crystal** orbits".
- **`refuted` (2), both by the repo before this audit:** `ISociety <: CTM` (counterexample: the gossip
  salon) · the genome→Adinkra/Clifford tie (`genomeToAdinkraByte` → `genomeToParityByte`, 2026-08-16).
- **dead (1):** `sensor-fusion-oracle.ts` — zero importers, superseded, self-labelled.

### 3a. The substrate

| part | path | register | what is actually true |
|---|---|---|---|
| `WeightedSet<'K,'W>` | `src/Core/WeightedSet.fs` | **built**, 1 consumer | ⊕ `add`, ⊗ `scale`, contraction `inner`, `negate` gated behind `IRing`. Canonical (Zero pruned) so `add a (negate a) = empty`. |
| `WSet<'K,'W>` | `src/Core/WSet.fs` | **built**, 9 consumers | The ring-meeting layer; the GDL statement lives in its header. Unconsolidated lists; float rings need a caller-supplied ε. |
| `ZSetW<'K,'W>` | `src/Core/ZSetW.fs` | **built**, 5 consumers | Ring-generic *and* perf: struct-generic `*By` hot path, zero-overhead (081KWFXTHJY). |
| `ZSet` (`Weight = int64`) | `src/Core/Algebra.fs` | **built** | The ℤ workhorse, deliberately kept separate and unchanged. |
| `IRing`/`ISemiring` split | 081KWG9JQ9H | **built** | Asking an inverse-free semiring to retract is a **compile** error, not a runtime throw. This is the mechanism the whole regime rests on. |
| `RationalRing` (ℚ) | `ProbabilitySemiring.RationalRing`, `algebra/exact-weight.ts` | **built** | Exact weights; `ExactWeight` is `bigint` num/den with `serializeExact`. |
| middle-out float | `tri-boolean-float` (4 oracles) + `algebra/exact-weight.ts` | **built** | Byte-locked C#/F#/Rust/TS. |

### 3b. The soft value axis

| part | path | register | what is actually true |
|---|---|---|---|
| `SoftValue` | `src/Core/SoftValue.fs` | **built** — and **not** a `WeightedSet` | `{ Candidates: (DynamicValue * float) list }`. Normalized-by-construction; `build` prunes non-positive and renormalizes. It is the *finite-support distribution (Giry) monad* with `certain`/`bind`, plus `observe`, `combine`, `snap`, `paretoFront`. |
| the docstring gap | `src/Core/SoftValueNumeric.fs:16` | **`proposed`** | Says *"`SoftValue` is effectively a `WeightedSet<DynamicValue, float>` over the probability semiring"*. **Effectively is doing load-bearing work**: normalization is not a semiring operation, so `SoftValue` is a *normalized quotient* of a weighted set, not one. The refactor is unclaimed — see §3f. |
| never-collapse (value) | `SoftValue.resolve` / `snap` | **built** | `resolve t` returns `None` below threshold. `observe` returning `None` on an annihilating likelihood is *honest refusal*, not an error state. |
| widening / retraction | PR **#14218**, branch `feat/softvalue-widening-operator` | **`proposed` — OPEN, not landed** | The brief said "just landed" and named branch `refactor/softvalue-as-weightedset`. Measured: PR #14218 is `state: OPEN`, `mergedAt: null`, head ref `feat/softvalue-widening-operator`. **No branch named `refactor/softvalue-as-weightedset` exists on `origin`.** Coordinate with #14218; the `WeightedSet` refactor is a *different*, unclaimed piece of work. |
| `SoftValueNumeric` | `src/Core/SoftValueNumeric.fs` | **built** | Convolution arithmetic: values apply the leaf op, probabilities multiply, duplicates merge, renormalize. `spread ⊕ spread` widens — uncertainty compounds rather than being averaged away. |

### 3c. Cost and prediction — the load-bearing claim, checked in §5

| part | path | register | what is actually true |
|---|---|---|---|
| `TropicalWeight` / `TropicalSemiring` | `src/Core/NovelMath.fs:29–95` | **built + lawful + tested** | `(ℤ∪{∞}, min, +)`, `Zero = +∞`, `One = 0`. Implements `ISemiring` **and** `IKleeneAlgebra` (`Star`). Every semiring law witnessed in `tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs`. |
| `TropicalPaths` | `src/Core/TropicalPaths.fs` | **built** | A graph **is** `ZSetW<'V*'V, TropicalWeight>`; SSSP is Bellman–Ford as a semi-naive fixpoint of Z-set sums. **This is the change-of-semiring the claim predicts, already demonstrated.** |
| `KleeneClosure` | `src/Core/KleeneClosure.fs` | **built** | Lehmann's matrix star over *any* `IKleeneAlgebra`; tropical ⇒ all-pairs shortest paths, boolean ⇒ transitive closure. One algorithm, instance decides. |
| `ByteCost` | `src/Core.CSharp.ByteCost/ByteCost.cs`, `src/Core.Rust.ByteCost/src/lib.rs` | **built as `(ℕ,+,0)` — a commutative monoid, not a semiring** | `Zero`, `Add` (checked/`const`), `Sum`. **No second operation.** Golden-vector agreed across four oracles. Measures *static context-surface bytes*, not runtime cost. |
| complexity registry | `registry/complexity-registry.yaml` + `src/Core.TypeScript/complexity/complexity-generator.ts` | **built as a dictionary; `proposed` as an algebra** | `("artifact","op") → { time: "O(...)", space: "O(...)", by }` — **hand-declared strings, no composition operator anywhere.** This is exactly the catalogue Aaron described. |
| `Vision.BranchCost` | `src/Core/Vision.fs:155` | **built, additive-only** | `{ SpaceBytes; TimeTicks; BytesPerTick; UncertaintyResolutionBits }`, composed *only* by `sumBranchBytes` (BigInteger accumulate, saturating at `Int64.MaxValue` with a `capped` flag). No ⊕-for-alternatives, no ⊗-for-sequencing, no star-for-loops. |
| `CostVector` / `CostContract` | `src/Core.TypeScript/algebra/cost-counter.ts` | **built as measurement, `proposed` as algebra** | `{time, space}` counted witness from a ring wrapper (an injected §13 effect, not ambient) plus a hand-written `maxCost: (n) => CostVector` contract. Obligation is *witness ≤ contract*. **No composition operator on `CostVector`.** |
| cost envelope proofs | `tools/Z3Verify/consolidate-quadratic-envelope.smt2` + `algebra/cost-envelope.test.ts` | **built + non-vacuity-probed** | Z3-discharged bound; the test was tightened 2026-08-13 (081KZYYKHX1087G0R0036E9RH9) after the old assertion was satisfiable by a tautology. |

### 3d. Fusion, attention, vision

| part | path | register | what is actually true |
|---|---|---|---|
| `sensor-fusion-oracle.ts` | `src/Core.TypeScript/bayesian/sensor-fusion-oracle.ts` | **built but DEAD — and it is *not* a `WeightedSet` ⊕** | Inverse-variance weighted mean of two scalar estimates, plus ρ-gating. A renormalized mean is **not** a semiring ⊕. Measured **zero importers** outside its own test (2665 files / 4896 edges); its one intended consumer `OracleRaceMode.tsx` prints `Ref: sensor-fusion-oracle.ts` on screen and reimplemented `computePlv` locally. Self-labelled `unmetered`, SUPERSEDED. |
| `QuantumFusion.fs` | `src/Bayesian/QuantumFusion.fs:421` | **built + wired** | The live fusion. **Implements `Vision.IBranchForecaster`** — so fusion already feeds the Vision prediction path. This is a *real* joint and the only one of its kind found. |
| `Vision` | `src/Core/Vision.fs` | **built** | `cache = I(stream)`, `vision = I(D(snapshot))`, `subscribe`. **Not a monad in its own right** — its CE is `Dsl.circuit` re-exported under a Vision vocabulary (`VisionComputation.vision = Dsl.circuit`). Calling it "the Vision monad" names the circuit monad, correctly, under another name. |
| Vision prediction | `Vision.predictBranches` / `PredictionReport` / `Budgeted` | **built** | Space bytes *and* time ticks are already predicted and budgeted against a `SoftThrottle.Tank`, with `Admitted / PartiallyAdmitted / RejectedWithBackpressure / CappedAccounting` outcomes and honest `GrowthFeedback` errors for every negative input. **Aaron's "predict future space and time in bytes" is substantially built — it is the *algebra* that is missing, not the plumbing.** |
| `VisionAttention` | `src/Core/VisionAttention.fs` | **`coincidence` as written** | It ranks `Proposal<'S>` into `RankedBranch<'S>` by uncertainty bits and memory-gravity bytes and emits `Vision.FutureBranch`. There is **no spatial `'K`** and no weighted set over regions. It is a *branch ranker*, not attention weights over a spatial key. The brief's row ("attention weights over regions are a `WeightedSet` over a spatial `'K`") does not describe this file. |
| `AttentionRouter` | `src/Bayesian/AttentionRouter.fs` | **built, float-weighted, not a weighted set** | Directed edge weight = `KL(i‖j) · (1 + cos-alignment)/2` over Gaussian natural parameters. Real, tested, and **structurally a dense scoring function**, not a sparse `'K → 'W`. |

### 3e. Kleisli / ISR / scheduler

| part | path | register | what is actually true |
|---|---|---|---|
| `ISR<'A,'B>` | `src/Core/IntrCtx.fs:76` | **built** | `IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>` — explicitly Kleisli, not the free Arrow. `>=>` at `IntrCtx.fs:81`. |
| `IsrLift` | `src/Core/IsrLift.fs` | **built, 33 lines** | Two lifts: `ofPolicy` and `ofPure` (`arr`). Its header records Rodney's cut: the four-corner state flows in the **value** channel as `ISR<FourCornerOwnership<_>, FourCornerOwnership<_>>`; genuine interrupts stay in the **error** channel where short-circuit is correct. Sum/product split, deliberate. |
| `SoftIsr` | `src/Core/SoftIsr.fs` | **built — and this IS the joint** | `SoftValue` in the ISR value channel: `certain`, `ofWeighted`, `observeWith`, `resolveAt` (holding is a **value**, `Choice2Of2`), `mustResolveAt` (honest refusal with the confidence stated). **Uncertainty travels with the promise**, §13 in the message rather than ambient. |
| `ParseSoft` | `src/Core/ParseSoft.fs:48` | **built** | Lowering as the Kleisli descent — a distribution over parses to a distribution over lowered forms. |
| ferry throttler | `src/Core.TypeScript/ferry-throttler/` | **built** | `ferry-throttler`, `drain-scheduler`, `heat-aware-scheduler`, `four-corner-feedback`, `optimal-cadence`, `lane-notifier`. |
| ferry ↔ cost algebra | — | **`proposed`** | Nothing in `ferry-throttler/` consumes `TropicalSemiring`, `ByteCost`, or the complexity registry. The scheduler is heat- and cadence-driven, not cost-predicted. |

### 3f. Amplitude ladder, ensemble, society

> **⚠ Provenance caveat (Soraya audit 2026-08-01) — keep this attached wherever the number appears.** `1/(3√2)` is **NOT** the Tsirelson bound. Tsirelson's bound is `S ≤ 2√2 ≈ 2.828` on the CHSH *correlator* (`src/Core/Tsirelson.fs`). `1/(3√2)` is a **design choice**: the image of `S = 2√2` under the *freely chosen* linear map `ρ = S/12` (pinning `ρ* = 1/3 ↔ S = 4`), which makes the Condorcet ρ-regimes and the Bell S-regimes *homoiconically identical*. Chosen for homoiconicity, not derived — see `docs/research/2026-07-04-rho-t-derivation-attempt-it-is-a-design-choice-chosen-for-homoiconicity.md` and the code peel at `src/Bayesian/YinYangEnsemble.fs`. Legitimate as a design threshold; a physical bound it is not.

| part | path | register | what is actually true |
|---|---|---|---|
| Cayley–Dickson ladder | `src/Core/CayleyDickson.fs`, `AmplitudeEmu.fs`, `HlAmplitudeEmu.fs`, `SoftEmu.fs`, `CyclotomicAmplitude.fs`, `Core.Lean4/ImaginaryStack/` | **built; the plug-in is `built + tested`, with no production consumer** | `CayleyDickson.fs:38` says the doubled algebra is an `ISemiring`, *"so `WeightedSet<'K,'W>` and the rest of the generic semiring substrate carry"* — **and `tests/Tests.FSharp/CayleyWeightedSet.Tests.fs` proves it**: `ImaginaryStack.quaternion :> IRing<Quaternion>` drives quaternion weights through `WeightedSet`, retraction included. So the ladder really does plug in at `'W`. But the *production* amplitude consumers (`CyclotomicAmplitude`, `BipartiteMachZehnder`, `FrequencyMachZehnder`) go through **`WSet`**, not `WeightedSet` — the demonstrated joint and the used joint are on different carriers. §2 again. |
| `YinYangEnsemble.reseedIfCollapsed` | `src/Bayesian/YinYangEnsemble.fs:218` | **built** | `isCollapsed ρ_threshold` → reseed the least-experienced cell (min `AccumulatedIV`). Default threshold = Tsirelson `1/(3√2) ≈ 0.2357`, chosen deliberately *before* the ρ\*=1/3 event horizon. `rhoCount` adds a temporal-spread metric. |
| `N_eff` | `src/Core.TypeScript/society/effective-agent-count.ts:118` | **built** | `deff = 1 + (n−1)ρ`, `nEff = n / deff`, with `iccOneWay`, `phiCoefficient`, `rhoFromUnionCoverage` and a frame-commit discipline. |
| `Ctm.fs` | `src/Core/Ctm.fs` | **`proposed` — DECLARATION ONLY, and the file says so in its first line** | An `ICtm<'view,'gist,'msg>` interface + `Chunk`, `probabilisticMatch`, `tournament`, and **eleven decidable `CtmLaws`**. Anchored to Blum & Blum, PNAS 119(21) e2115934119 (2022), with a clean-room note that the in-tree transcript was **not opened**. **No implementation, no processors, no transport, no state.** |
| `ISociety` / `IMember` | `src/Core/Society.fs`, `src/Core/Levels.fs` | **`proposed` (declaration) + one claim REFUTED** | `Levels.fs` checks `ISociety <: CTM` and **refutes** it with an in-repo counterexample: the gossip salon is a working society with no single-slot competition and no global broadcast. The fixpoint `μX. CTM-over-X` closes — but it is carried by **`IMember`**, not `ISociety`. |
| RGB/CMYK genome | `src/Core.TypeScript/planning/agent-genome.ts`, `society-evolution.ts`, `src/Core/AdinkraViz.fs`, `Optics.fs` | **built** (contra an earlier report that it is absent) | `RGBGenome` + `CMYKExtension`, `mutate`/`crossover`/`mix`/`geneticDistance`, `toHyperparams` mapping to `CalibrationLedger`/`TravelerRankLedger`. |
| "RGBA/CMYK = the quaternion rung" | — | **`coincidence`** | Both are width 4. So are `float4`, ℍ, and a great many other things. `agent-genome.ts` has no multiplication, no conjugation, no norm — none of the invariants that would identify ℍ. Per [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md): *the count is consistent with the quaternion rung*; nothing here identifies it. Recorded as a coincidence, with the register stored beside it, and it is not load-bearing for any change in §8. |

---

## 4. What Aaron actually asked for, and what would deliver it

> *"we were just labeling algos in Zeta with their time and space complexity requirements so we
> could look it up in a dictionary-like fashion. If there is an algebra that can make it less
> ad-hoc and more dynamic then this is amazing."*

**Dictionary versus calculus is the whole point.** A lookup table gives you the cost of the things
you already labelled. A semiring lets you *compose* the cost of things nobody labelled — because
composition is an operation, not an entry.

`registry/complexity-registry.yaml` is the dictionary. `TropicalSemiring` + `KleeneClosure` is the
calculus, and it is already in the tree, lawful and tested. **They have never been introduced to
each other.**

---

## 5. Is cost composition genuinely tropical? — VERIFIED, with two corrections

### 5a. The verdict

**The algebra is right, is built, and is on the shared substrate. Nothing in the cost path uses it.**

What holds:

- Sequential composition adds ⇒ ⊗ = `+`. **Yes.** That is the tropical ⊗ exactly, and it is what
  `ByteCost.Add`, `sumBranchBytes` and `CostVector` all already do.
- Branching takes min or max ⇒ ⊕. **Yes, and this is the operation that is missing everywhere.**
- Loops ⇒ Kleene star. **Yes, and it is built**: `TropicalSemiring` implements `IKleeneAlgebra`,
  and `KleeneClosure.fs` is Lehmann's generic matrix star. Iteration cost is the third operation
  most cost models forget, and this repo has it before it has the second one.
- The tropical semiring is a semiring, lawfully, with every law witnessed —
  `tests/Tests.FSharp/Formal/SemiringRing.Laws.Tests.fs`, `Algebra/TropicalPaths.Tests.fs`,
  `Algebra/KleeneClosure.Tests.fs`, `Sketches/Tropical.Tests.fs`.

So **"fusing prediction into the Vision monad" really would be a change of semiring rather than an
integration project** — `TropicalPaths.fs` already performs exactly that change of semiring on
`ZSetW` and gets incremental shortest paths out of it. The precedent is not hypothetical.

### 5b. Correction 1 — the built tropical is **min**-plus; an admission gate needs **max**-plus

`TropicalWeight.(+) = min`, `Zero = +∞` (`NovelMath.fs:38`). Min-plus answers *"what is the
cheapest route?"* — optimal choice, Viterbi, shortest path.

A scheduler deciding whether a branch fits in a tank asks the **opposite** question: *"what is the
most this could cost?"* That is **max-plus** — the order dual, `Zero = −∞`, `Add = max`. It is
equally a semiring (`a + max(b,c) = max(a+b, a+c)` distributes), and it **does not exist in the
tree**. Reusing min-plus for an upper bound would produce an optimistic estimate wearing a
guarantee's clothes — a silent-failure class.

Work-item `081M0QHPRM2087G0R0036Y8VAB`.

### 5c. Correction 2 — "big-O" and "bytes" are **two different semirings**, not one

Aaron asked to predict *"in big-O notation and bytes"*. These are not the same weight type, and
conflating them would be the mistake:

| register | carrier | ⊕ (branch) | ⊗ (compose) | note |
|---|---|---|---|---|
| **concrete bytes / ticks** | ℕ | `max` (worst case) or `min` (best route) | `+` | max-plus / min-plus. Sequencing and branching are **distinct**. |
| **asymptotic class** | growth functions under eventual-dominance | `max` | pointwise `·` (nesting) | max-times, ≅ max-plus by `log`. **Sequencing collapses into ⊕**: `O(f)` then `O(g)` is `O(f+g) = O(max(f,g))`. |

The second row's degeneracy is real and worth stating: at the asymptotic level, sequencing carries
no information that branching does not, so only *nesting* is a genuine ⊗. That is precisely why
`Star` matters more in the asymptotic register than in the concrete one — a loop is where the
class actually moves.

**This is good news for the unifying claim, not bad.** Two semirings, one substrate, one algorithm
— that is the GDL doing exactly what it says. But they must be two `'W`s, and a design that tries
to make one weight type carry both will be wrong in a way that is hard to see.

### 5d. Where the gap actually is (four representations, none composing)

| representation | carrier | has ⊗ | has ⊕ | has `Star` |
|---|---|---|---|---|
| `ByteCost` (C#, Rust) | `long` / `u64` | `Add` ✓ | ✗ | ✗ |
| `Vision.BranchCost` | 4-field record | `sumBranchBytes` ✓ | ✗ | ✗ |
| `CostVector` (TS) | `{time, space}` | ✗ (counted, not composed) | ✗ | ✗ |
| complexity registry | `string` | ✗ | ✗ | ✗ |
| **`TropicalWeight`** | `int64 ∪ {∞}` | ✓ | ✓ | ✓ |

**`ByteCost` is one operation from being a semiring**, and it already exists in two compiled
oracles with agreed golden vectors — so adding `Max` is a byte-lockable change across the whole
oracle set rather than a redesign. That is the highest-value, lowest-risk row in this document.

Work-items: `081M0QHPRK2087G0R002K5NQG9` (ByteCost), `081M0QHPRN0087G0R0039C2NG7` (BranchCost),
`081M0QHPRNX087G0R002Q1KTH3` (registry → calculus).

### 5e. Why the algebra is not merely elegant — it is what makes lowering possible

Aaron:

> *"the evolutionary algo over some RGBA/CMYK-like structures so they can be GPU accelerated … so
> it can be very parallelizable on GPUs without warp hidden control structures slowing things down.
> **we try to do everything in math and discriminated unions rather than control flow if
> statements**."*

A semiring fold is **branchless by construction**: `min`/`max` and `+` are single instructions with
no warp divergence. A dictionary lookup with special cases is *divergent* — threads in a warp take
different paths and serialise. So the algebraic form is not a preference, it is the admissibility
condition for GPU lowering.

**This is an established repo position, not a new proposal.** It is written down in
`docs/research/2026-06-07-one-algebra-many-target-optimized-instances-branch-free-swap-serial-sharp-parallel-soft-aaron.md`
("one algebra, many target-optimized instances, **branch-free**, swap serial-sharp / parallel-soft"),
`2026-06-08-the-memetic-quantum-observer-categorical-built-gpu-lowerable-honest-registers.md`, and
`2026-08-14-branch-free-visual-encoding-is-the-meaning-junction-*.md`.

**Stated as a constraint of the regime:** *an operator that cannot be expressed without control
flow is not admissible in the substrate, because it cannot be lowered.* `SoftValueNumeric`'s `Sat`
variants are the pattern already following it — total, NaN-propagating, shader-lowerable, beside a
`Result`-typed CPU/correctness variant.

---

## 6. Do the ISR and Vision monads compose today? — NO, in one direction and both

**Register: `built` for `SoftValue` ⇄ ISR. `proposed` for Vision ⇄ ISR.**

What is built:

- `ISR<'A,'B> = IntrCtx -> 'A -> Task<Result<'B, InterruptFeedback>>`, Kleisli, with `>=>`
  (`IntrCtx.fs:76,81`).
- `SoftIsr` puts a held distribution in the **value** channel. This is the piece Aaron described
  from the CHIP-8 work — *"a monadic ISR that used the Kleisli arrow for state capture on the
  interrupts"* — and the state capture is real: the monad carries the distribution the interrupt
  would otherwise drop, and `resolveAt` returns `Choice2Of2 sv` (still holding) as a **value**
  rather than an error.
- The sum/product split is deliberate and documented: held softness in the value channel, genuine
  failure in the error channel. Forcing four-corner state into the error slot was refused by name.

What is **not** built:

- **`Vision` is not in the ISR-carrying set.** Measured: the files mentioning `ISR<` are
  `IntrCtx`, `IsrLift`, `SagaBuilder`, `SchedulerShedHeat`, `SoftScheduler`, `SoftThrottle`,
  `SoftChip8Scheduler`, `SoftIsr`, `TickBoundaryProbe`. `Vision.fs` is not among them, and
  `SoftIsr.fs`/`IsrLift.fs` mention Vision zero times.
- **There is no lift in either direction.** No `Vision.forecast` lifted into `ISR`, no ISR step
  liftable into `CircuitM`. `Vision`'s effect type is `CircuitM` (`VisionComputation.vision =
  Dsl.circuit`); ISR's is `Task<Result<_,InterruptFeedback>>`. Two monads, no natural transformation.
- The one real bridge that exists runs the *other* way: `QuantumFusion.fs:421` implements
  `Vision.IBranchForecaster`, so fusion feeds Vision's prediction. Nothing feeds Vision's
  prediction into an ISR.

**So the honest answer to "does the predictive engine compose with the fold without losing state
at an interrupt?" is: for `SoftValue`, yes and it is tested. For `Vision`'s branch forecast, no —
an interrupt during a forecast has no monad carrying the partial prediction.**

Work-item `081M0QHPRQT087G0R000Y11PK3`.

---

## 7. The three "never-collapse"s — STRUCTURAL in two places, ANALOGY in the third

The tempting sentence is: *never-collapse is one invariant at three scales — value, ensemble,
society.* Three occurrences of the word "collapse" is exactly the shape
[`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) warns about, so
it is triaged rather than asserted.

| scale | mechanism | the quantity | the floor | verdict |
|---|---|---|---|---|
| **value** | `SoftValue.resolve t` returns `None` | max candidate probability | a threshold `t` chosen by the caller | — |
| **ensemble** | `YinYangEnsemble.reseedIfCollapsed` | `rhoProxy` (correlation of posterior means) | Tsirelson `1/(3√2)` | — |
| **society** | `N_eff = n / (1 + (n−1)ρ)` | pairwise ρ | none — it is a *meter*, not a gate | — |

**What is genuinely shared (structural):** the ensemble and society rows are **the same object**.
Both measure a pairwise correlation ρ over a population of estimators, both have the property that
ρ→1 costs you the population, and `rhoProxy` and `effectiveTrialCount`'s ρ are the same statistic
computed two ways. `sensor-fusion-oracle.ts` already gates on `rhoProxy` before fusing for exactly
that reason. Calling these one invariant is defensible.

**What is analogy:** the value row is a **different object**. `SoftValue.resolve` measures the
*concentration of one distribution* (a max, or equivalently its entropy) — there is no population,
no pairwise correlation, and no ρ to compute. A point mass is not "correlated with itself"; it is
simply concentrated. And the two failure modes point opposite ways: a `SoftValue` collapsing to
certainty when the evidence warrants it is **correct and desired** (`snap` is the sanctioned exit);
an ensemble collapsing to ρ→1 is **always** a loss.

**Verdict: two of the three are structurally one thing; the third shares the word.** The honest
one-sentence version of the claim is therefore narrower than the tempting one, and it is worth
having in the narrow form:

> **Decorrelation has a floor at every scale where there is a population.** Where there is only one
> distribution, the discipline is *calibration* (never falsely certain), which is a different
> guarantee that happens to be enforced by a threshold too.

Both are real, both matter, and merging them would hide that `snap` is *supposed* to collapse.

---

## 8. The float boundary — a rule of the regime, not a caveat

Aaron:

> *"we never need to have floating point errors be the cause of cross machine communication
> corruptions, just like we try to be rigorous in UoM in F#."*

> **RULE. Float weights are LOCAL-ONLY. The wire and the shared fold take exact (`ℚ` /
> `ExactWeight`) or middle-out weights. Never IEEE-754 doubles.**

**Why it is load-bearing rather than fastidious:** IEEE-754 addition **is not associative**.
`(a+b)+c ≠ a+(b+c)` for representable doubles. Every guarantee this regime rests on is an
associativity guarantee:

- `WeightedSet.sum` is documented *"order-independent: `add` is commutative + associative"* — false
  for a float `'W`.
- The four-oracle byte-lock requires the same seed to produce byte-identical output in C#, F#,
  Rust and TS. Float reassociation under different JITs and different compiler flags breaks it
  before any logic error does.
- DST replay requires the same interleaving to give the same result. A float fold whose order
  varies gives a different answer for a *correct* reason, which is the worst kind.
- `SoftValue.combine` is claimed as a commutative associative partial monoid. Over `float` that is
  true to within ε and false exactly. It is fine — because `SoftValue` is local.

The tree already has both halves of the escape: `ProbabilitySemiring.RationalRing` over ℚ in F#,
`ExactWeight` (`bigint` num/den, `serializeExact`) in TS, and `tri-boolean-float` middle-out
byte-locked across four oracles. `WSet.fs` states the honest local rule already: *"float-weighted
rings consolidate with an epsilon `isZero` the CALLER supplies — exact cancellation is the ring's
business, not ours."*

**The boundary, concretely:** `SoftValue`'s `float` candidates, `AttentionRouter`'s KL weights, and
`sensor-fusion-oracle`'s IV weights are all fine **as long as they never enter a shared fold or a
frame**. The moment any of them is gossiped, byte-locked, or replayed, it must have crossed into
ℚ or middle-out first. This is
[`local-time-never-enters-the-shared-fold`](../../.claude/rules/local-time-never-enters-the-shared-fold.md)
with the same shape on a different axis — local *precision* is as much a per-node quantity as local
*time*, and leaking either into the shared conclusion makes nodes fold different evidence and diverge.

The Mars Climate Orbiter lesson (lbf vs N) generalised, which is exactly Aaron's UoM comparison.

---

## 9. What is NOT connected — the actionable table

This is the useful half of the document. The unifying claim is the frame; these are the joints.

| # | joint | today | what would have to be written | work-item |
|---|---|---|---|---|
| 1 | one weighted-set substrate | three F# types, structurally unrelated; the named one has 1 consumer | consolidate onto one carrier, **or** write down the split as intentional with the change-rate reason | `081M0QHPRH5087G0R000XN827S` |
| 2 | one `StarRing` in TS | two incompatible interfaces in the same directory | unify (`negate`/`conj` optionality is the whole disagreement), or rename one | `081M0QHPRJ4087G0R003BCB5V1` |
| 3 | `ByteCost` as a semiring | `(ℕ,+,0)` monoid, 4 oracles, golden vectors | add `Max` (and `Min`), an `ISemiring`/`StarRing` instance, and golden vectors for the new op in all four oracles | `081M0QHPRK2087G0R002K5NQG9` |
| 4 | max-plus dual | only min-plus exists | `MaxPlusSemiring : ISemiring<TropicalWeight>` + `IKleeneAlgebra`, laws witnessed in `SemiringRing.Laws.Tests.fs` | `081M0QHPRM2087G0R0036Y8VAB` |
| 5 | `Vision.BranchCost` algebra | additive-only `sumBranchBytes` | ⊕ for exclusive alternatives, ⊗ for sequenced stages, `Star` for loops; then `predictBranches` becomes a semiring fold | `081M0QHPRN0087G0R0039C2NG7` |
| 6 | registry → calculus | strings in YAML | a growth-class carrier with `max`/`·`/`Star`, so unlabelled compositions get a derived cost | `081M0QHPRNX087G0R002Q1KTH3` |
| 7 | `SoftValue` as a weighted set | assoc list; the docstring already claims otherwise | the refactor, coordinated with **open** PR #14218 (`feat/softvalue-widening-operator`), keeping normalization as a *quotient* rather than pretending it is a semiring op | `081M0QHPRPV087G0R0019ZF47A` |
| 8 | Vision ⇄ ISR | no lift either way | a natural transformation `CircuitM ⇝ ISR` or an `IBranchForecaster` lifted into the arrow, so an interrupt mid-forecast keeps the partial prediction | `081M0QHPRQT087G0R000Y11PK3` |
| 9 | N-parent recombination | `crossover`/`mix`/`evoStep` are all 2-parent; `parentIds` is a pair | an N-ary recombination over the 7 channels (per-channel argmax, or a simplex mix over N weights) and a genome type that is not a pair | `081M0QJ2Z91087G0R00061PBQF` |
| 10 | the directed-mutation anchors | MacVector filed twice; **CRISPR and polymerase filed nowhere** | `PRIOR-ART-LIST.md` entries for targeted editing and copy-with-error, checked for entailment rather than cited | `081M0QJ2ZA3087G0R0034KWF15` |

**Not minted, recorded instead** (disposition is Aaron's, not the shadow's):

- `sensor-fusion-oracle.ts` — zero importers, superseded by `QuantumFusion.fs`, already labelled.
  Deletion or revival is a call, not a joint.
- `Ctm.fs` implementation — an interface with eleven decidable laws and no machine. Whether a
  foreign model should be *implemented* here or *adapted* at the boundary is a design question that
  should be answered before either.
- RGBA/CMYK as the quaternion rung — `coincidence`, held as a generator, not promoted.

---

## 10. The falsifier

**What observation would show these are not one substrate?**

> **A soft part whose composition law is not associative, or whose weight type has no semiring
> structure. Such a part is genuinely different, and the map must say so rather than absorb it.**

Two candidates are already visible, and neither is a defect — they are the honest boundary:

1. **Normalization.** `SoftValue.build` renormalizes on every operation. Renormalization is **not**
   a semiring operation: it is not associative with ⊕ and it has no identity. `SoftValue` is
   therefore a *quotient* of a weighted set by scaling, not a weighted set. Joint 7 must preserve
   this distinction, not erase it — a refactor that makes `SoftValue` a literal `WeightedSet`
   without saying where normalization went would have hidden the one thing that made it different.

2. **Inverse-variance fusion.** `sensor-fusion-oracle.ts`'s fused estimate `(w₁x₁ + w₂x₂)/(w₁+w₂)`
   is a renormalized mean. As a fold over three or more sources it is associative only because the
   weights are carried along — the *displayed* mean is not. Gaussian fusion **is** a monoid in
   natural parameters `(η, τ)` (they add), and it is **not** one in `(μ, σ²)`. So the row is
   admissible on the substrate only in the natural parameterisation, and the file uses the other one.

**And the falsifier for the tropical claim specifically:** exhibit a branching cost model in this
repo where the cost of a branch is neither `min` nor `max` of its arms and cannot be expressed as
either — e.g. a *probabilistic* expected cost `p·a + (1−p)·b`. That is the **expectation** semiring
(a different `'W` again, and a legitimate one), and if the scheduler's real question is expected
cost rather than worst-case cost, then joint 3's `Max` is the wrong operation and the map must say
so. **Nothing measured settles this** — it is a question for whoever picks up joint 3, and it must
be answered before the operation is added, not after.

**The falsifier for this document as a whole:** it stays `toy` until at least one joint above is
wired and a test fails when the wiring is removed. Until then this is a map, and a map is not a
mechanism.

---

## 11. If the layering holds — and it partly does

The proposed four layers, checked:

| layer | claim | verdict |
|---|---|---|
| **substrate** — what a soft value *is* | one weighted set, semiring-parameterised | **refuted as code, holds as mathematics** (§2). Three carriers. |
| **operators** — how it moves | `observe` / `combine` / `snap` / retract, never-collapse | **holds** — `observe`/`combine` commute and associate over exact weights, retraction is `Negate` gated behind `IRing`, and inverse-free semirings are refused at compile time. |
| **composition** — how it survives interruption | Kleisli / ISR / Vision | **half holds** (§6). `SoftValue` ⇄ ISR is built; Vision ⇄ ISR is not. |
| **society** — how independent agents compose fairly | `ISociety`, attention router, mutual empowerment | **declarations + one refutation** (§3f). `Society.fs` and `Ctm.fs` are contracts with laws and no machines; `ISociety <: CTM` is *refuted*, and the fixpoint is carried by `IMember`. |

The honest summary sentence is therefore not *"never-collapse runs through all four layers"* — it
is:

> **The soft regime is one algebra (Aji–McEliece) realised on three carriers, with a decorrelation
> floor wherever there is a population, a calibration floor wherever there is a single
> distribution, and an exactness boundary at the wire. Two of its four layers are built, one is
> half-built, and one is a set of contracts.**

That is less exciting than the unification, and it is the claim the evidence supports.

---

## 12. Archaeology — the RGB(A)/CMYK genome, the website, and the orbits

Aaron, 2026-08-23:

> *"we have some RGBA stuff that shipped on the website, not sure where … instead of ACTG for the
> DNA we use RGB(A) and/or CMYK … It's probably connected to MacVector or CRISPR in the docs …
> I've done a lot of work here when I worked at MacVector and this is the ultimate 'directed
> mutation' engine — I think we can have combinations from one or multi parents. I thought we had
> tied this into Clifford algebra too but maybe not."*

He has [a memory index that stores by resonance rather than evidence](../../.claude/rules/numerology-vs-number-theory.md)
and names the over-correction risk himself, so *"I'm sure we have X"* is a hypothesis. Each clause
was checked separately. **Four of five confirm; one is refuted, with a date and a reason.**

### 12a. "RGB(A)/CMYK instead of ACTG" — **built**, and the phrasing is his own, in `VISION.md`

`docs/VISION.md:1394` — the `sim`/`mea`/`cut` verb triad is described as

> *"a MacVector-for-DNA toolset over that sequence; base alphabet **CMYK-solid + RGB-soft**, not ACTG"*

**and that phrasing carries a design decision the colour metaphor alone does not:** CMYK is the
*solid* (subtractive, committed) alphabet and RGB is the *soft* (additive, emissive) one. That maps
onto emit/retract — RGB adds light, CMYK removes it — and onto the hard/soft split this whole
document is about. **Register: `built` as recorded vocabulary; `proposed` as a mechanism** — nothing
in `src/` reads a CMYK channel as "solid" and an RGB channel as "soft". `agent-genome.ts` treats all
seven channels as interchangeable `0–255` integers.

The MacVector anchor is registered: `docs/PRIOR-ART-LIST.md:299` and `:313` both record *"Per Aaron:
used at MacVector for DNA-sequencing + molecular-simulation software"* — attached to Boost (policy/
mechanism separation) and to NIST reference algorithms (numeric golden vectors). **CRISPR and
polymerase are not in `PRIOR-ART-LIST.md`.** They are spoken, not filed. That is a real gap: the
directed-mutation engine's most specific anchor is the one that never got written down.

### 12b. The evolutionary algorithm — **built**, in TypeScript, with one- and two-parent reproduction

Contrary to a report that no RGBA/CMYK structure exists in `src/`, it does:

| piece | path | register |
|---|---|---|
| `RGBGenome` + `CMYKExtension` + `AgentGenome` | `src/Core.TypeScript/planning/agent-genome.ts` | **built** |
| `mutate` (directed, per-channel) · `crossover` (2-parent, `crossoverPoint ∈ [0,7]` over 7 channels) · `mix` (2-parent lerp, MeGA-style; K channel from the dominant parent) · `geneticDistance` (Euclidean in RGB) · `dominantTrait` (R=belief, G=breadth, B=exploration) | same | **built + tested** (`agent-genome.test.ts`) |
| `toHyperparams` — genome → `CalibrationLedger` / `TravelerRankLedger` parameters | same | **built** — this is the part that makes it an engine rather than a picture: the colour *is* the hyperparameter vector |
| `evolve` — select top-k, sexual (crossover+mutate) or asexual (clone+mutate), fitness = calibration | `src/Core.TypeScript/planning/society-evolution.ts` | **built** |
| `drift-genome.ts` | `src/Core.TypeScript/hygiene/` | **built** — the same genome shape applied to drift |
| `SoftEvolution.fs` | `src/Core/` | **built, different object** — observes a `SoftValue`'s own evolution (support / entropy / residual / norm / confidence). Pure observability; it does **not** evolve genomes. Same word, different scale. |

**"Combinations from one or multi parents" — measured: one and two, never three or more.**
`crossover`, `mix`, and `OracleRaceMode`'s `evoStep` all take exactly `(p1, p2)`; `AgentGenome.parentIds`
is a 2-tuple by construction. Asexual (clone + mutate) is the one-parent case and is a supported
`EvolutionParams` mode. **N-parent recombination is `proposed`** and is a genuinely different
operation — with a channel-wise genome it is a natural extension (per-channel argmax, or a simplex
mix over N weights summing to 1), and the type would have to stop being a pair.

### 12c. The website — **found, and it is an evolution toy, not styling**

Both readings exist and must not be conflated:

- **Styling only:** `docs/design/root-site-iris/*.dc.html` — `Dark Hall`, `LLMTV`, `Genesis Concepts`,
  `Hidden Track`, `DORA`, `Zeta Home`, `Vaults`, and the rest. Every `rgba(...)` there is inside a
  `style=` attribute or a `@keyframes` block. **These are CSS colours. There is no genome on the
  design site.** Saying otherwise would be the flattering reading.
- **The real one:** `demo/identity-dla-site/src/components/OracleRaceMode.tsx` —
  - `// Each oracle's seed is its "genome" (encoded as RGB from the seed bits)` (line 61)
  - `EvoAgent { seed, df, fitness, r, g, b, generation }` (line 68)
  - `evoStep`: sort by fitness → top 50% survive → **two-parent per-channel crossover** → ±5% per-channel
    mutation → **new seed reconstructed from the mutated RGB** (`(nr<<16)|(ng<<8)|nb`) (lines 82–110)
  - the UI renders *"Final generation genome colors (RGB from seed bits) … each coloured square = one
    agent's genome. Brighter border = higher fitness."* (lines 1797–1816)
  - and `demo/identity-dla-site/src/components/OracleRGBA.tsx` — **Oracle 17, "RGBA Shader DLA"**, a
    WebGPU/WGSL compute shader where `R = occupancy, G = walk-length, B = distance, A = harmonic
    measure`, N=50,000 in ~160 ms.

**So Aaron's memory is right and better than he claimed.** There are *two* RGBA things on the demo
site: an evolutionary genome visualiser where the colour **is** the seed (mutate the colour, get a
different machine), and a four-channel RGBA GPU shader where each channel carries a distinct physical
quantity. Register: **`built`, `toy`** — `evoStep`'s offspring `df` is interpolated from the parents
plus noise rather than re-measured by running the oracle, so the fitness landscape is *modelled*, not
observed. It is a demonstration, exactly as he guessed.

The RGBA-as-`float4`-on-a-GPU row also supplies the concrete instance of §5e: `OracleRGBA` packs four
independent scalars into one branchless shader texel. That is the lowering argument, shipped.

### 12d. "Tied into Clifford algebra" — **REFUTED, on 2026-08-16, with the reason recorded**

Aaron's own *"maybe not"* is correct, and the repo is more specific than that.

`society-evolution.ts` used to export `genomeToAdinkraByte`. It was **renamed to `genomeToParityByte`**
because the name asserted a structure the bytes do not have. From `docs/ZETA-ARCHITECTURE-UNIFIED.md`
and the file's own header:

> *"It is the single-parity-check **[8,7,2]** — 7 channel MSBs + 1 parity bit, distance 2,
> **detection only**, not self-dual, not doubly-even. Renamed 2026-08-16: the old name asserted a
> structure those bytes do not have, and **sharing the length 8 identifies nothing**."*

The genuine Adinkra [8,4,4] lives in `src/Core/AdinkraCode.fs` with real consumers
(`PrivacyPreservingIdentity`, `YinYangCell`, `BeliefConvergence`, `udp-lossy-transport.ts` as an
erasure code) — **and the genome is not one of them.** The Clifford/E8 layer
(`CliffordE8BladeMask.fs`, `OrbitEquivariance.fs`, `e8-blade-mask-sandwich.ts`) is referenced from
`society-evolution.ts` **in a documentation comment**, and there is no code path between them.

**So: the genome→Clifford tie was attempted, named, checked, found false, and un-named — and the
un-naming is dated and reasoned.** This is the numerology rule working correctly on a live claim,
and it is the strongest evidence in this document that the register discipline is not decoration.

The related coincidence stays a coincidence: RGBA and CMYK are 4-wide, so is ℍ, so is `float4`.
`agent-genome.ts` has no multiplication, no conjugation, no norm — none of the invariants that would
identify the quaternion rung. *The count is consistent with ℍ; nothing here identifies it.*

### 12e. "Unrolling interrupts into quasi time crystal orbits" — **built, and the Beacon peel is already written**

`db/emus/chip8/orbits/` holds five committed `*.orbit.json` files plus a `README.md`, written by
`src/Core/Chip8CrossRunStore.fs` and read by `src/Core.TypeScript/chip9/chip8-cross-run-store.ts`.
Each is keyed by `romSha256 ⊕ seed ⊕ loadAddr ⊕ dialect ⊕ stepMapVersion` — content-derived, no wall
clock, no counter, no path.

**The README already does the Mirror→Beacon peel, and this document defers to it rather than
re-metaphorising:**

> *Aaron's framing is that run 1 "can affect the start of the 2nd run" in a "2nd retrocausal way" —
> the **Mirror** register. The **Beacon** register is **memoization of a deterministic transition
> function over a finite state space**. Nothing propagates backward in time.*

Anchors, checked, in the README: Michie, *"Memo functions and machine learning"*, Nature **218**:19–22
(1968); eventual periodicity of any `f : S → S` on finite `S` (`f^(μ+λ)(s₀) = f^μ(s₀)`, `μ+λ ≤ |S|`);
Brent, BIT **20**:176–184 (1980) §7 for the `(μ, λ)` detector. `verdict ∈ {closed, open-at-bound}`,
never conflated; `terminalKind` distinguishes `awaiting-input` (an `FX0A` stall is a fixed point of
the pure step map) from `halt`.

**"Time crystal" is a `coincidence` row here and `VISION.md` is careful about it too** — a
finite-state map's rho-shaped orbit is periodic because the state space is finite and the map is
deterministic (pigeonhole), which is not a time crystal's defining property (spontaneous breaking of
time-translation symmetry in a ground state). Shared word, different object. The orbits are real and
useful without the physics claim.

**The cheat-engine reading is an analogy with exactly one shared property, and it is the right one:**
both learn a machine's structure **from its behaviour rather than its source**. That property is the
same epistemics as the latent-geometry work and the perturbation paradigm — *measure the system, do
not specify it.* The mechanisms differ (Cheat Engine *searches* live memory for value-shaped patterns;
an orbit file *memoizes* a pure step map), so this is registered as **analogy with a named shared
property**, not as structure.

And the connection to §5e is real: **an orbit is a control-flow-free artifact.** The branches are
already taken, the interrupts already resolved; what remains is a trajectory you can fold. That is
the branchless requirement of §5e arrived at from the opposite direction — one says *make the
operator algebraic so it can be lowered*, the other says *record the trajectory so the control flow
is gone*. Both end at a fold with no `if`.

### 12f. Summary of the archaeology

| Aaron's claim | verdict |
|---|---|
| "RGB(A)/CMYK instead of ACTG" | **confirmed** — his own words in `docs/VISION.md:1394`, with a solid/soft split he had not restated |
| "connected to MacVector" | **confirmed** — `PRIOR-ART-LIST.md:299,313`, twice |
| "or CRISPR … or polymerase" | **not filed anywhere** — spoken, never written. The gap. |
| "evolutionary algo … even in writeups" | **more than writeups** — built and tested in `agent-genome.ts` + `society-evolution.ts` |
| "combinations from one or multi parents" | **one and two built; ≥3 `proposed`** |
| "RGBA … shipped on the website" | **confirmed, and there are two** — `OracleRaceMode.tsx` (genome evolution) and `OracleRGBA.tsx` (Oracle 17 WebGPU shader). The `root-site-iris` `rgba(...)` is CSS only. |
| "tied into Clifford algebra … but maybe not" | **"maybe not" is right** — attempted, checked, **refuted and renamed 2026-08-16** |
| "quasi time crystal orbits" | **the orbits are built**; "time crystal" is a `coincidence` and the README already peels it |

**The one actionable gap:** the directed-mutation engine's most specific prior art — Aaron's own
MacVector work, CRISPR-style targeted edits, polymerase-style copy-with-error — is the anchor he
reaches for every time he describes this and it is **the only one not in `PRIOR-ART-LIST.md`**. Under
[`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md) an unanchored coinage
is a debt, and "directed mutation" is currently carrying one.

Work-items minted for 12b and 12f: `081M0QJ2Z91087G0R00061PBQF` (N-parent recombination),
`081M0QJ2ZA3087G0R0034KWF15` (file the CRISPR / polymerase / MacVector anchors).

---

## Pointers

- Hub: [`docs/ZETA-ARCHITECTURE-UNIFIED.md`](../ZETA-ARCHITECTURE-UNIFIED.md)
- Society consolidation: `docs/research/2026-06-15-the-zeta-society-architecture-consolidated-md-interface-isociety-eve-game-self-regeneration.md`; `src/Core/Levels.fs` (the checked ISociety/CTM verdict)
- Branch-free / GPU-lowerable: `docs/research/2026-06-07-one-algebra-many-target-optimized-instances-branch-free-swap-serial-sharp-parallel-soft-aaron.md`; `2026-06-08-the-memetic-quantum-observer-categorical-built-gpu-lowerable-honest-registers.md`
- Middle-out / exact weights: `docs/research/2026-08-02-alexa-implementation-handoff-analytics-measureds-wrappers-and-middle-out-float-wset-weight.md`; `2026-05-30-tri-boolean-float-v0-spec-middle-out-self-describing-decode-aaron-otto.md`
- Adjacent, same week: `docs/research/2026-08-23-measuring-latent-geometry-survey-falsifiable-clifford-experiment-and-the-gwt-verdict.md`
- In-flight: PR **#14218** `feat/softvalue-widening-operator` (OPEN)
- The archaeology (§12): `docs/VISION.md:1394` (CMYK-solid + RGB-soft, not ACTG) · `docs/PRIOR-ART-LIST.md:299,313` (MacVector) · `src/Core.TypeScript/planning/agent-genome.ts` + `society-evolution.ts` (the engine) · `demo/identity-dla-site/src/components/OracleRaceMode.tsx` + `OracleRGBA.tsx` (the shipped RGBA) · `db/emus/chip8/orbits/README.md` (the orbits, already peeled)
- Rules this doc is written under: [`toy-is-free-metered-must-be-earned`](../../.claude/rules/toy-is-free-metered-must-be-earned.md) · [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md) · [`anchor-to-human-prior-art`](../../.claude/rules/anchor-to-human-prior-art.md) · [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md) · [`dv2-data-split-discipline-activated`](../../.claude/rules/dv2-data-split-discipline-activated.md)

---

*Measured at `origin/main` = `5d29357d6bbf84e49f10dc8297de1f4bb5148fe7`, 2026-08-23. Every "measured"
claim above is a grep or a file read at that SHA and will rot; re-measure before citing.*
