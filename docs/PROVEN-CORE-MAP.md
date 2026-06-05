# Proven-core map — the event store proven one organ at a time

> Navigation map (Aaron 2026-06-04: "make sure we have the map saved, we can
> slowly navigate it and build one bit at a time"). The event store is **a theorem
> built one primitive at a time** — identity, time, integrity, merge,
> serialization, metrics, history, curve, curvature. This map tracks the spine,
> the floor primitives beneath it, and the proof status of each, so a human or AI
> can navigate it and prove one bit at a time.

## Current focus (Aaron 2026-06-04): depth-first lock-down

> "lock down what we got over the next day — hammer ONE primitive through all the
> legs one at a time and connect them in homeostasis." No new concepts; slow.

- **First full vertical = G-Set** (already math∧4-lang; simplest lattice so its
  homeostat-tie/convergence-to-LUB is cleanest; genuinely exercises every leg).
  Leg order: **4-ser → Arrow → Bonsai → homeostat-tie**. Take it to FULL PROVEN,
  then replicate the template to the next primitive.
- **homeostat-tie = "hello world" homeostasis via heartbeats** — ✅ DEMO LANDED
  (`tools/observe/heartbeat-homeostat.ts`, 4 tests). Actors emit heartbeats; the
  homeostat is a CRDT map `actor → max-versionstamp` whose per-actor-max merge
  CONVERGES (runToFixpoint/LUB) to one fleet-liveness view regardless of order or
  duplicates — that convergence IS homeostasis. Connects the proven primitives
  (CRDT merge + clock/versionstamp + actor addresses); rides heartbeat-via-commit.
- **Leg order pivot:** 4-ser is gated on B-1011 (CBOR/YAML/XML serializers not all
  built — G-Set has JSON only), so the ungated **homeostat-tie was done first** as
  the payoff demo. Remaining G-Set legs: ~~4-ser~~ ✅ DONE (29c1ffe4), Arrow, Bonsai.
- **G-Set × 4-ser leg ✅ LANDED (2026-06-04, 29c1ffe4):** B-1011's serializers
  unblocked it — `tests/Tests.FSharp/GSet.FourSer.Tests.fs` proves a G-Set value's
  canonical DynamicValue (ascending Array) round-trips through JSON+CBOR+YAML+XML and
  all four recover the SAME G-Set (FsCheck over GSet<int64> + fixed cases). The CRDT/
  G-Set 4-ser cell flips ✗→✓.
- **G-Set × Arrow leg ✅ LANDED (2026-06-04, 51d2937c):** G-Set → canonical DynamicValue
  → Arrow IPC (`DynamicValueArrow`, shredded node-table) → back → same G-Set (FsCheck +
  fixed cases). CRDT/G-Set Arrow cell flips ✗→✓. **G-Set vertical now: math + 4-lang +
  4-ser + Arrow + homeostat(demoed). ONLY Bonsai-tie remains → then G-Set is the first
  FULL-PROVEN floor primitive (the template the other 5 follow).**
- **4-ser progress (2026-06-04): all four value-tree serializers DONE + 4-language
  BYTE-LOCKED** — JSON + CBOR + YAML + XML. Each produces byte-identical canonical
  output across F#+TS+C#+Rust (golden-vector byte-lock per oracle). YAML is the
  storage of record (canonical encoder + B-1016 never-collapse for empty `{}`/`[]`);
  XML is the typed-element codec (`<null/>`/`<bool>`/…/`<float>`/`<bytes>`/`<obj><e
  k=..>..</e></obj>`, now **TOTAL 8/8** like CBOR — Float=16-hex IEEE-754 f64 bits,
  Bytes=lowercase hex; never-collapse free via distinct element names — 5 distinct
  empties; golden-vectors-xml.json = 47-vector treaty). (Serializer doctrine: B-1011
  — all four legs done + total-or-documented-partial; remaining: Arrow-as-serializer.)
- **Format-agreement matrix (value-tree) PROVEN across all four (2026-06-04):**
  JSON + CBOR + YAML + XML all recover the SAME DynamicValue on the locked shapes
  (commute on the common value) — `DynamicValueYamlBridgeTests` (fixed cases +
  FsCheck matrix LAW); each format also has its own round-trip LAW + injectivity
  property (never-collapse). DynamicValue = μF; codecs = folds, decode strict via a
  fixed-point canonicality check (see `docs/serializer-recursion-schemes.md`).
  DOM-unify decided (option 2: extract DynamicValue as the LCD core); extraction
  refactor is a later phase.
- **Merkle 4-lang** decision (Aaron): **pure-TS XxHash128** (no dep — honors
  zero-dep doctrine; C#=System.IO.Hashing, F#=done, Rust=twox-hash dev-dep).
  Deferred behind the G-Set vertical.

## The spine (dependency order, top is built last)

```
replayable homeostat            (converges to fixpoint — the goal)
  ↑ curvature                   (∂² of the curve — proven)
  ↑ curve                       (∂ over the clock x-axis — proven accurate on lightlike history)
  ↑ Z-set / DBSP deltas         (incremental view maintenance)
  ↑ G-Set history               (grow-only append-only log = the curve's samples)
  ↑ metric / aggregation algebra(counters + sketches = ONE math family: mergeable summaries)
  ↑ meter                       (IMeter / System.Diagnostics.Metrics shape)
  ↑ recursive INumerics         (F-bounded/CRTP generic-math HKT-hack)
  ↑ serialization seed          (golden vectors → 4 lang + 4 formats + Arrow + Rx/Bonsai)
```

## What "PROVEN" means (Aaron's bar — 2026-06-04)

A primitive is **PROVEN** only when ALL legs are green — not when the F# math
leg alone passes. Over-badging the math leg as "proven" is the failure mode
(Amara's blade: prove the smallest scope honestly, badge only that, widen one law
at a time). The legs:

| Leg | What it means |
|-----|---------------|
| **math** | F# Z3 / FsCheck proof of the laws (the math leg only) |
| **4-lang** | TS + F# + C# + Rust agree (byte-lock / cross-verify) |
| **4-ser** | the 4 serializers agree on it |
| **Bonsai** | tied into the Bonsai (animation / reactive) layer |
| **Arrow** | tied into the Arrow (columnar memory) layer |
| **homeostat** | tied to an existing homeostat (proven-from-seed) |

`PROVEN ⟺ math ∧ 4-lang ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat.` Anything less is
named by the legs it has (e.g. "math-leg only", "math + 4-lang").

## The floor (named primitives the spine rests on — prove these first)

| # | Primitive | Where | math | 4-lang | 4-ser | Bonsai | Arrow | homeostat | Verdict |
|---|-----------|-------|:----:|:------:|:-----:|:------:|:-----:|:---------:|---------|
| 1 | **Clock / causal order** (Versionstamp) | `src/Core/Clock.fs` + `Core.{TypeScript,CSharp,Rust}.Clock` | ✓ | ✓ | ✓ (ddac32e9) | ✓ (ddac32e9, max reified) | ✓ (ddac32e9) | ✓ (ddac32e9, max-convergence) | ✅ **FULL PROVEN** — 2nd floor primitive (legs in `Clock.FullVertical.Tests.fs`; Versionstamp=int64 logical clock, merge=max=join) |
| 2 | **Identity / keys** (128-bit ordered composite key, NOT hash) | `src/Core.*.ZetaId` | ✓ (bijection + injectivity + env-invariance + key-embeds-clock ordering; V1 cell) | ✓ | partial | ✗ | ✗ | ✗ | **math + 4-lang** (V1 cell); rolling-monadic encoding + UoM-per-type + per-version/category cells open |
| 3 | **Merkle integrity** | `src/Core/Merkle.fs` | ✓ (structural tamper-evidence; crypto premise named) | ? | ✗ | ✗ | ✗ | ✗ | math-leg only |
| 4 | **CRDT merge + idempotency** (G-Set) | `Crdt.fs`, `GSet.fs` + 4-lang G-Set | ✓ (ACI+identity+LUB) | ✓ (G-Set 4/4) | ✓ (29c1ffe4) | ✓ (658c8e24, reify/apply) | ✓ (51d2937c) | ✓ (658c8e24, convergence-to-LUB) | ✅ **FULL PROVEN** — the FIRST floor primitive to clear the full bar (all G-Set legs in `tests/Tests.FSharp/GSet.FourSer.Tests.fs`) |
| 5 | **Serialization seed** | `byte-cost`, `DynamicValue` | ✓ | ✓ | partial | ✗ | ✗ | ✗ | math + 4-lang byte-locked |
| 6 | **Metric / aggregation algebra** | `byte-cost`, `Bloom`/`CountMin`/`Sketch` | byte-cost ✓ · HLL+Bloom join & CMS monoid merge-laws ✓ (state-level) · error-DIRECTION ✓ (Bloom no-false-neg, CMS no-undercount); probabilistic magnitude bounds ✗ | byte-cost ✓ | ✗ | ✗ | ✗ | ✗ | math-leg (merge + error-direction); magnitude bounds + 4-lang open |

**G-Set (CRDT merge) is the FIRST FULL-PROVEN floor primitive** (2026-06-04,
658c8e24 — all six legs in `GSet.FourSer.Tests.fs`); **Clock/Versionstamp is the
SECOND** (ddac32e9, `Clock.FullVertical.Tests.fs` — both join-semilattices: G-Set
merge=union, Clock merge=max; the reusable `_Support/SerializerLegs.fs` helper backs
the 4-ser+Arrow legs). **2 of 6 floor primitives now FULL PROVEN.** The pattern is the
**template** the other 4 follow (each: bridge the primitive's value/operation to DynamicValue → 4-ser
round-trip + Arrow round-trip + reify-the-operation-as-Bonsai + homeostat-convergence).
The other 4 are NOT yet full: **identity + serialization-seed have math ∧ 4-lang**
(need 4-ser/Arrow/Bonsai/homeostat); **Merkle + metric-aggregation have the math leg**
(4-lang partial). The remaining legs (4-ser, Bonsai, Arrow, homeostat-tie) are the
gap to full PROVEN. The **4-lang column is sourced from `PRIMITIVE-REGISTRY.md`**
(the consensus authority); this map adds the math + remaining legs.

## Identity / keys — ordered composite keys, NOT content-hashes

Keys are not content-hashes (you *can* prove with hashes, but that's a technique,
not the mechanism). A key is a **composite ordered key**:
- **time-ordered crypto-unique bits** — monotonic unique prefix = the
  clock/versionstamp embedded INTO the key (identity embeds the clock).
- **+ recursively-extensible index bits in order** — nested subspaces (FDB
  tuple/subspace; DV2.0 hub→sub-key).
- **optimal bit-encoding** (dense, round-trip bijective), and **bits differ PER
  CATEGORY**.

⇒ lookups are **ordered index range-scans, NOT hash point-lookups** — order is
preserved, which is what makes the time-ordered curve/history range-scannable.
⇒ **proof is a MATRIX: per id-version × per category × per key-type** (each
layout = its own spec: uniqueness, time-ordering, recursive extensibility, optimal
bit-use). Not one monolithic proof.
⇒ keys are **128 bits** (confirmed in `BitLayout.fs`: `TotalBits = 128`, `UInt128`
codec — the V1 layout is `Version(5)|Timestamp(48 ms)|Chromosome(5)|rsvd|
Category(4)|Firefly(1)|Authority(5)|Persona(8)|Momentum(8)|Location(8)|rsvd|
Randomness(32)`). The Timestamp(48) IS the time-ordered prefix = the embedded
clock. **Many key types** partition the bit-space, to be guarded by **F#
units-of-measure** so wrong-key-type code won't compile and a proof scoped to one
key type can't be applied to another (UoM-as-category-tag). (An earlier note
wrongly said "238 bits" — a slip recorded without checking the code; it is 128.)
⇒ **already proven (V1 cell)**: `unpack∘pack = id` (bijection), field injectivity,
env-invariance, and **id order = timestamp order (key embeds the clock)** —
`tests/Tests.FSharp/ZetaId/Canonical.Tests.fs`; plus 4-lang byte-lock. Open:
per-version/category/key-type cells, the UoM guard, the rolling-monadic encoding.
⇒ **AFTER CORE (future)**: key types that carry **error-correction** bits
(self-correcting keys — ECC parity in the unique-bits region); prove on the map
after the core proof chain, not now.
⇒ **bit packing**: the recursive index rolls in **4-bit nibbles**, two absence
schemes (a monad-propagation rule, null-as-value vs null-as-monad):
  - **16+null (monadic) — bit-OPTIMAL.** All 16 codes are payload; null /
    termination is handled by a structure ONCE (out-of-band, amortized), NOT per
    nibble. No recurring waste.
  - **15+1 hole — NOT bit-optimal.** Reserves 1-of-16 as an in-band hole on EVERY
    nibble (~3.9 usable bits/4), so the waste COMPOUNDS with each recursive
    extension. Self-terminating/prefix-free, but pays a code per roll.
  The monadic scheme is what keeps "many small key types" cheap (terminate once,
  not every recursion).

## Time is a family, not one clock (no global causal order)

The clock is an injectable family behind `IScheduler` (B-0684 negotiation stack);
**there is no global causal order — relativistic**: each agent = its own git repo
= its own frame; frames connect only through **bus repos over Rx joins** (B-0907).
- clock TYPES: FDB versionstamp (total, single-shard) · CockroachDB HLC
  (uncertainty interval) · generator-time + retrocausality (three-clocks).
- causal order AND speed are set by a **consensus ladder × trust gradient**:
  local → CRDT-in-shard → CRDT-across-shard → row CAS → Paxos/Raft → BFT.
  speed ∝ 1/consensus-strength; the bus/Rx-join picks the rung by inter-frame trust.
  Rungs 2–3 = the floor's CRDT merge (#4); rung 6 = the 4-oracle BFT work.

## Disciplines that govern the build

- **Prove one primitive at a time, from the seed.** Foundation-first; don't build
  atop unproven ground (verify-stage, not expand-stage).
- **Validated ≠ proven.** 4-oracle consensus is a prompt to prove, not a proof
  (B-1007). Canonical = homeostat proven from the seed.
- **Search-last, not excluded** (Amara's blade): a proof shows code-matches-spec,
  not that the spec was the right intent — so proven code drops to the BOTTOM of
  the suspect list, it does not vanish from it.
- **Lightlike history** makes the curve provably accurate: the past is
  append-only / un-rewritable (Merkle + no-force-push), so the derived
  curve/curvature are trustworthy.

## Known math-leg gaps (Lior review 2026-06-04)

External formal review surfaced 5 gaps; status:
1. **Z3 Int vs machine int64 (overflow blindspot)** — ✅ addressed for clock:
   Z3 models ℤ (logical), impl uses `Checked.(+)` → throws at Int64.Max/Min
   (boundary tested, no silent wrap). Same `Checked` pattern in CRDT/byte-cost;
   full BitVec64 modeling is optional extra rigor.
2. **Scalar-to-map CRDT** — ◑ representative finite pointwise-map Z3 proof added
   (2-key map: pointwise max is ACI + LUB per key); full arbitrary-map induction
   (Lean-tier) still open. G-Counter state-merge also FsCheck-validated.
3. **Sketch dimensionality** — ✅ fixed: Bloom `MergeFrom` now guards both m AND
   k (CMS already guarded depth/width/seed); mismatch throws (tested).
4. **Bayesian BP/EP metric scale-sensitivity** — ✅ routed to B-1007 (Soraya
   cadence): max-abs-diff on natural params is scale-dependent; fix = KL-divergence
   or magnitude-scaled tolerance.
5. **ZetaId ordering caveat** — partially: proven within a version (Version is the
   top field); cross-version is version-first by layout, so time-series range
   scans must partition by Version. Documented in Canonical.Tests.fs.

## Relation to the larger primitives wishlist

[`docs/PRIMITIVE-REGISTRY.md`](PRIMITIVE-REGISTRY.md) (tracked by **B-0959**) is
the full cross-language **wishlist** + the **4-lang-consensus** status view — the
"4-lang" leg of the PROVEN bar. THIS map is the complementary **math / proof-leg**
view over the floor. They connect, not fork: `PROVEN = (4-lang from the registry)
∧ (math from this map) ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat`. Build the wishlist
one primitive at a time, connecting each to these proven floor primitives once
there's a full proof chain (sequencing is the agent's call).

## Pointers
- B-1016 (context-window minimization — the program this map serves)
- `docs/PRIMITIVE-REGISTRY.md` + B-0959 (the larger wishlist / 4-lang status view)
- B-0684 (clock-protocol-negotiation-stack) · B-0683 (deferred-causality / Z-sets)
- B-0907 (Rx temporal joins / bus) · B-0924 (IScheduler DST)
- B-1007 (asserted→proven gap; the formal-coverage ledger)
