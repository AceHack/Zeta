---
id: 081KT2T2J0008QG0R0038CRFJM
priority: P1
status: open
title: "Conform everything to the minimal HKT-composing vocabulary — INumerics + Rx/Bonsai-over-DBSP + Z-set/GSet/Bag/IndexedZSet (±1 retraction-native); INumerics sparingly; constraint breeds novelty; apply to the Infer.NET engine (factor-graph state/deltas → IndexedZSet + DBSP IVM) (Aaron 2026-06-02 observation)"
tier: research
effort: L
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [081KT2T2J0008QG0R000S7GHQ8]
composes_with: [081KT2T2J0008QG0R000VG204F, 081KT2T2J0008QG0R002R72323, 081KT2T2J0008QG0R00301P27H, 081KRFA460008QG0R0018SN61J, 081KT07NV0008QG0R003BE6MJ2]
tags: [hkt-composition, minimal-vocabulary, inumerics, generic-math, rx, bonsai, reaqtor, dbsp, zset, gset, bag, indexed-zset, retraction-native, constraint-breeds-novelty, generative-constraint, earn-your-keep, structural-sparsity, interfaces-are-the-asset, infer-net, factor-graph, research, aaron]
type: research
---

# Conform everything to the minimal HKT-composing vocabulary

## Why — the generative constraint (Aaron 2026-06-02)

Aaron: *"I'm basically trying to not let myself use anything other than INumerics and Rx Bonsai over DBSP +1/-1 zsets and gset and bags and indexed ones of those — and only leave INumerics if it really really makes sense. I want to conform everything into that and surrounding interfaces for maximum HKT composition."* + *"constraining yourself is what makes novel things pop out of your brain."*

The second line is the **why**: the minimal vocabulary is not restriction-for-its-own-sake — it is a **generative constraint**. Forcing every problem into the same small set of algebras makes novel compositions *pop out* (the Oulipo / poetic-form / design-constraint principle: a tight constraint surfaces solutions an open palette never would). And because everything lands in the *same* algebras, it all composes at the **HKT** level — maximum higher-kinded composition. Constraint → novelty → composition.

## Every noun/node and edge must earn its keep — and the vocabulary *enforces* it

Aaron 2026-06-02: *"every noun/node and edge must earn it's keep."* The structural twin of the vocabulary-minimalism: not just a minimal set of *algebras* but a minimal *structure* — no gratuitous nodes (nouns / variables / identities) or edges (relations / factors); each must be load-bearing (razor at noun/node/edge granularity; `all-complexity-is-accidental-in-greenfield` + `bandwidth-served-falsifier` — if it serves no bandwidth, cut it).

The elegant part: **the Z-set vocabulary enforces this by construction.** A `±1 Z-set` drops any entry whose weight nets to zero (`Bag.ofEntries`: "b nets to 0 → dropped"); `IndexedZSet` keeps only non-zero groups. So once the factor-graph state is conformed to `IndexedZSet` (the engine conformance below), **a node/edge that earns no keep — zero net contribution — is *automatically pruned* by the algebra.** "Earn your keep" isn't a discipline you police; it's a *property of conforming to the vocabulary*. The generative constraint (above) and earn-your-keep (here) are the same move: the algebra makes the non-earning elements vanish, leaving only the structure that pays for itself — which is exactly where the novel composition lives.

## The vocabulary (the only primitives; conform everything into these)

| Primitive | What | Generic-math? |
|---|---|---|
| **INumerics / generic-math** | `IAdditiveIdentity` / `IAdditionOperators` / `IMultiplyOperators` / `INumber<T>` (F# native `Zero`/`One`/`(+)`/`(*)` per `numerical-algebra-into-generic-math`) | the base |
| **±1 Z-set** | retraction-native weighted set (`ZSet`, weight ring ℤ; `+1` add, `−1` retract) | `Zero`/`(+)`/`(-)` |
| **G-set** | grow-only set (`GSet`) | `Zero`/`(+)` (idempotent) |
| **Bag** | multiset (`Bag`) | `Zero`/`(+)` (non-idempotent) |
| **IndexedZSet** | indexed/grouped Z-set (`IndexedZSet<'K,'V>`) — **already** `Zero`/`(+)`/`(-)`/`(~-)` (an additive group AND a Z-set) | yes |
| **DBSP** | the incremental dataflow over those (`Circuit`/`NestedCircuit` fixpoint) | — |
| **Rx + Bonsai** | reactive (`IObservable`, Meijer-dual of `IEnumerable`, merge-monoid + monad) serialized as compact expression-trees (Nuqleon/Reaqtor **Bonsai**, `Bonsai.fs`) over DBSP | — |

**`INumerics` sparingly** — reach for the full generic-math number tower *only if it really makes sense* (the message-group's `(*)`/`(/)` genuinely is multiplicative-group → warranted; don't force `INumber` where the Z-set/DBSP vocabulary already fits).

## Apply to the Infer.NET engine (081KT2T2J0008QG0R000S7GHQ8) — the conformance audit

- **Message families (slice 2)** — ✅ already conforming: `Gaussian`/`Beta`/`Bernoulli` are generic-math (`One`/`(*)`/`(/)`), a commutative **group** (product/divide). (Caveat: a *group*, not a clean `ISemiring` — there is no clean ⊕/mixture at message scope; conform via generic-math group, don't force a ring.)
- **FactorGraph state (slices 3–4)** — ❌ currently ad-hoc `Map<int, Map<int, 'M>>`. **Conform to `IndexedZSet`** keyed by edge `(factorId, varId)`; the per-round message changes become **Z-set deltas**; `passOnce` becomes a **DBSP operator**; `runToFixpoint` becomes the **`NestedCircuit.Iterate()`** fixed-point drive (loops to the LFP cap, polling each op's `Fixedpoint scope` residual test — the actual `src/Core/NestedCircuit.fs` API; `.Fixedpoint` is the per-`CircuitOp` contract, not a member of `NestedCircuit`) — the slice-4b incremental form (re-infer on a delta). This is the conformance that buys incremental inference.
- **Serialization / transport (081KT2T2J0008QG0R000VG204F/081KT2T2J0008QG0R002R72323)** — the codec tower + Eve transport conform too (the value-codec rung over the Z-set/columnar state; Rx/Bonsai expression-trees as the serialized reactive composition).

## Acceptance (research → build)

1. **conformance audit** of the engine surface: list every type/op not in the vocabulary; map each to {generic-math, Z-set/GSet/Bag/IndexedZSet, DBSP, Rx/Bonsai} or justify the exception ("INumerics sparingly").
2. **conform FactorGraph** → `IndexedZSet` state + Z-set deltas + DBSP `passOnce`/`NestedCircuit` fixpoint (slice 4b). Tests preserved (existing BP/EP results unchanged; now incremental).
3. **Rx/Bonsai layer** — the reactive/serializable composition over the DBSP circuit (Bonsai expression-trees per `Bonsai.fs` / 081KT07NV0008QG0R003BE6MJ2).
4. **hold the generative-constraint discipline** for future authoring: new primitives conform to the vocabulary by default; an exception is a documented "really really makes sense" justification.

## Composes with substrate

- **081KT2T2J0008QG0R000S7GHQ8** (Infer.NET engine — the conformance target) · **081KT2T2J0008QG0R000VG204F/081KT2T2J0008QG0R002R72323/081KT2T2J0008QG0R00301P27H** (codec/transport/multi-traveler — conform too) · **081KRFA460008QG0R0018SN61J** (real HKT — the max-HKT-composition this enables) · **081KT07NV0008QG0R003BE6MJ2** (Bonsai expression-tree serializer)
- existing F#: `Algebra.fs`/`ZSet.fs`/`GSet.fs`/`Bag.fs`/`IndexedZSet.fs` (the Z-set family, generic-math-shaped), `Semiring.fs` (the weight algebra), `Circuit.fs`/`NestedCircuit.fs` (DBSP), `Bonsai.fs` (Rx serializer), `Message.fs` (generic-math messages)
- rules: `numerical-algebra-shaped-into-the-generic-math-interface` (this generalizes it to the full vocabulary), `bcl-interface-boundary-own-your-interfaces-hexagonal` (own the surrounding interfaces), `interfaces-are-the-asset` / `code-follows-from-types` (Meijer — the algebras are the asset), `all-complexity-is-accidental-in-greenfield` + `razor-discipline` (the constraint is the razor), `dv2-data-split-discipline-activated` (idempotency/Z-set siblings), `monad-propagation-pattern` (HKT composition), `grep-substrate-anchors-before-razor` + `god-tier-claims-don't-collapse`

## Substrate-honest framing

`[labeling-confidence: established (the Z-set/DBSP/generic-math vocabulary exists + is generic-math-shaped; constraint-breeds-creativity is a well-known principle); hypothesized (the full-engine conformance is a refactor target to measure — does IndexedZSet+DBSP preserve the BP/EP results while buying incrementality?)]`. The discipline is the operator's generative-constraint: a small algebra-set, conformed-into for max HKT composition, novelty *because* of the constraint. The engine's message families already conform; the factor-graph state is the named refactor (slice 4b). "INumerics sparingly" is the escape hatch with a justification bar, not a default.
