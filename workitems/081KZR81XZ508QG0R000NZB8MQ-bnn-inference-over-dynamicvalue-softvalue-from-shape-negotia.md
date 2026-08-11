---
id: 081KZR81XZ508QG0R000NZB8MQ
type: task
state: backlog
priority: P2
slug: bnn-inference-over-dynamicvalue-softvalue-from-shape-negotia
title: "BNN inference over DynamicValue/SoftValue — from shape negotiation to meta-code and specialized codegen"
created: 2026-08-11T11:06:51.749Z
depends_on: []
composes_with: []
---

# BNN inference over DynamicValue/SoftValue — from shape negotiation to meta-code and specialized codegen

**Source:** Aaron 2026-08-11 — *"we need to mix these two concepts so our BNNs are acting over
DynamicValue/SoftValue for code generation too, not just for shape negotiation, but for meta code and
then specialized code generation using Futamura and our IR."* Confirmed as a **future enhancement**,
not a defect: *"not yet, this is a future enhancement."*

**Suggested owner:** Lumen (mathematical-physics — has the mapping; pairs with Soraya, who proves it).

---

## 0. Current state, checked 2026-08-11 (so nobody re-derives it)

- **The BNNs exist and are disconnected.** `src/Bayesian/MinimalBnn.fs` and
  `src/Bayesian/MultilayerBnn.fs` live in the separate `Zeta.Bayesian` project and contain **no
  reference to `SoftValue`**. The soft regime and the neural regime do not currently meet.
- **`SoftValue` is live** — 8+ callers (`ValueTreeEnvelope`, `BowlingAlley`, `ComputeReceipt`,
  `RomDat`, `SoftChip8Scheduler`, `AdinkraCode`, `RayTensor`, `PredictionInference`) — and is *"a
  normalized distribution over candidate `DynamicValue`s"*.
- **The IR surface exists**: `ZetaIrV1`, `ZetaIrV2`, `ZetaIrCanonicalizer`, `ZetaIrNormalizer`,
  `GrammarIr`, `MixIr`, `GeneratorIrRegistry`.
- **Some of the linguistic work already exists in F# computational expressions** (Aaron).

## 1. What to build, in the order the dependencies actually run

### Slice 1 — BNN inference *over* `SoftValue`, not beside it

Today the BNNs are numeric-tensor shaped and `SoftValue` is a distribution over `DynamicValue`
candidates. The join is the point: a BNN's posterior should be expressible **as** a `SoftValue`, so
that neural inference and Bayesian evidence-folding compose through one type rather than two.

Formally the target is clean, and it is the reason this is Lumen's: **`SoftValue` is a measure on
`μF`** — a distribution over the initial algebra of the `DynamicValue` shape functor. A BNN emitting
`SoftValue` is a BNN whose output space is *structured data*, not a flat vector.

### Slice 2 — inference over *shape*, then over *code*

Aaron's distinction, and it is the whole arc: today the soft regime negotiates **shape**; the target
is that it also produces **meta-code**. Once a BNN's posterior is a distribution over `DynamicValue`,
and code is representable as a `DynamicValue`-shaped IR (see slice 3), the same machinery gives a
*distribution over programs*.

### Slice 3 — specialized codegen via Futamura over our IR

Specialize an interpreter for our IR against a known input to obtain a compiler (Futamura 1),
and so on up the projections. **Note for whoever picks this up:** an earlier finding
(`2026-08-10-how-to-decouple-…` §3) established that Futamura's mix equation is *useless as a
decoupling witness*, because it holds for any correct specializer including the trivial one. That
critique **does not apply here** — specializing an interpreter to obtain a compiler is Futamura's
actual purpose, and this is the legitimate use. Do not let the earlier note be read as a blocker.

### Slice 4 — parser-generator combinators (ANTLR-like grammar support)

Combinator-based parser generation over `GrammarIr`, so grammars are values in the same IR rather
than an external toolchain.

### Slice 5 — a restricted, compilable subset of English

*"a minimal linguistic seed with add-on language packs."* The seed is the irreducible core; packs
extend it. This is the surface where the whole stack becomes usable by a non-programmer, and it is
deliberately **last**, because it needs slices 1–4 underneath it.

## 2. The constraint that must not be discovered late

**`SoftValue.observe` / `combine` are NOT idempotent** — correctly so as Bayes, since two
*independent* observations of the same likelihood should sharpen. The hazard is **delivery**: a
redelivered observation is indistinguishable from a second independent one and sharpens anyway,
manufacturing certainty no evidence supports. That contradicts the module's own promise that *"the
seed never invents certainty it doesn't have"*, whose existing guard covers **contradiction** and not
**duplication**. Pinned in `tests/Tests.FSharp/SoftValue.Tests.fs` (`810e9d461`).

This is not currently reachable — no `SoftValue` caller sits on a transport path. **It becomes
reachable the moment a BNN is fed evidence off a network**, which is exactly what this work-item
proposes. So:

- Land the dedup design **before or with slice 1**:
  `docs/research/2026-08-11-evidence-dedup-for-softvalue-content-address-for-sameness-a-new-category-for-provenance.md`
  — `Category.ContentAddress` (9) as the dedup key (sameness, non-gameable by construction), a new
  `Category.Evidence` (free slot 12) for provenance. **Agreed by Aaron.** Two keys, two questions;
  a producer-assigned key makes dedup discipline-dependent and defeats itself.
- The chaos harness can now express the fault: `NetworkChaosPolicy.DuplicatePackets` (`52ff56db0`).
  **Turn it on in any DST run that feeds a BNN.** Before that flag existed, such a run would have
  gone green while never testing redelivery at all.
- Expect the **forced pair**: a deduped fold is idempotent and therefore cannot retract
  (`a + a = a ⇒ a = e`). Un-observing — a correction, a withdrawn attestation — needs a separate
  invertible delta log, as `TwoTimescaleFold.Delta` is to its join.

## 3. Falsifiers

- **"A BNN posterior is expressible as a `SoftValue`"** — refuted if the posterior is genuinely
  continuous in a way no finite candidate set approximates without losing the calibration property
  `SoftValue` exists to guarantee. That would mean the join needs a different carrier, and finding it
  early is worth more than the slice.
- **"Code is representable in the same shape as data"** — refuted if the IR needs constructs
  `DynamicValue`'s case set cannot carry without a lossy encoding. Bonsai's answer was a *separate*
  slim reflection model (`TypeSlim`), which is evidence the naive identification is too strong.
- **"A restricted English subset is compilable"** — refuted by an ambiguity in the seed grammar that
  no add-on pack can resolve without changing the seed, which would make the seed not minimal.

## 4. Pointers

- `src/Bayesian/MinimalBnn.fs` · `src/Bayesian/MultilayerBnn.fs` — the disconnected side
- `src/Core/SoftValue.fs` · `src/Core/DynamicValue.fs` — the soft/self-describing side
- `src/Core/ZetaIrV2.fs` · `src/Core/GrammarIr.fs` · `src/Core/GeneratorIrRegistry.fs` — the IR
- `docs/research/2026-08-11-rename-as-rolling-migration-content-addressed-code-bonsai-and-the-forced-pair-again.md`
  §1a — the μF/νF framing: `DynamicValue` is a μF, Bonsai is a finite μ description of a ν process,
  and `SoftValue` is a measure on μF. Read this first; it is the map for slices 1–3.
- `docs/research/2026-08-11-evidence-dedup-for-softvalue-content-address-for-sameness-a-new-category-for-provenance.md`
  — the dedup prerequisite
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — slice 5's seed/pack split
  is this rule applied to language
