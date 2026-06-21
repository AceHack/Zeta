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
- **Leg order pivot:** 4-ser is gated on 081KT5CF90008QG0R001P4CQ09 (CBOR/YAML/XML serializers not all
  built — G-Set has JSON only), so the ungated **homeostat-tie was done first** as
  the payoff demo. Remaining G-Set legs: ~~4-ser~~ ✅ DONE (29c1ffe4), Arrow, Bonsai.
- **G-Set × 4-ser leg ✅ LANDED (2026-06-04, 29c1ffe4):** 081KT5CF90008QG0R001P4CQ09's serializers
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
  storage of record (canonical encoder + 081KT7YW00008QG0R002T1XNWT never-collapse for empty `{}`/`[]`);
  XML is the typed-element codec (`<null/>`/`<bool>`/…/`<float>`/`<bytes>`/`<obj><e
  k=..>..</e></obj>`, now **TOTAL 8/8** like CBOR — Float=16-hex IEEE-754 f64 bits,
  Bytes=lowercase hex; never-collapse free via distinct element names — 5 distinct
  empties; golden-vectors-xml.json = 47-vector treaty). (Serializer doctrine: 081KT5CF90008QG0R001P4CQ09
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
| 2 | **Identity / keys** (128-bit ordered composite key, NOT hash) | `src/Core.*.ZetaId` | ✓ (bijection + injectivity + env-invariance + key-embeds-clock ordering; V1 cell) | ✓ | ✓ (Identity.FullVertical) | ✓ (Identity.FullVertical, resolve reified) | ✓ (Identity.FullVertical) | ✓ (Identity.FullVertical, injectivity + idempotent dedup) | ✅ **FULL PROVEN** (local-handle layer) — 4th floor primitive (legs in `Identity.FullVertical.Tests.fs`; bridge = Object-of-decoded-fields; homeostat = identity-dedup, tied to G-Set). Perspectival belief-map layer = research, NOT in scope |
| 3 | **Merkle integrity** | `src/Core/Merkle.fs` + `src/Core.CSharp.Merkle` + `src/Core.Rust.Merkle` + `src/Core.TypeScript/merkle` | ✓ (structural tamper-evidence; crypto premise named) | ✓ (4/4 byte-locked — F#+C#+Rust+pure-TS XXH3-128, golden vectors) | ✓ (Merkle.FullVertical) | ✓ (Merkle.FullVertical, combine reified) | ✓ (Merkle.FullVertical) | ✓ (Merkle.FullVertical, anti-entropy: verify + minimal-delta) | ✅ **FULL PROVEN** — 5th floor primitive (all 6 legs; 4-lang closed by the pure-TS XXH3-128 port `src/Core.TypeScript/merkle/xxh3.ts`, byte-identical to .NET/Rust) |
| 4 | **CRDT merge + idempotency** (G-Set) | `Crdt.fs`, `GSet.fs` + 4-lang G-Set | ✓ (ACI+identity+LUB) | ✓ (G-Set 4/4) | ✓ (29c1ffe4) | ✓ (658c8e24, reify/apply) | ✓ (51d2937c) | ✓ (658c8e24, convergence-to-LUB) | ✅ **FULL PROVEN** — the FIRST floor primitive to clear the full bar (all G-Set legs in `tests/Tests.FSharp/GSet.FourSer.Tests.fs`) |
| 5 | **Serialization seed** (ByteCost) | `src/Core/ByteCost.fs` + `Core.{TypeScript,CSharp,Rust}.ByteCost` | ✓ (commutative-monoid laws; Z3+FsCheck) | ✓ (golden-vectors byte-lock) | ✓ (SerializationSeed.FullVertical) | ✓ (SerializationSeed.FullVertical, add reified) | ✓ (SerializationSeed.FullVertical) | ✓ (SerializationSeed.FullVertical, order-independent aggregation) | ✅ **FULL PROVEN** — 3rd floor primitive (legs in `SerializationSeed.FullVertical.Tests.fs`; commutative MONOID not semilattice — homeostat-tie = path-independent aggregate, not idempotent LUB) |
| 6 | **Metric / aggregation algebra** | `byte-cost`, `Bloom`/`CountMin`/`Sketch` | byte-cost ✓ · HLL+Bloom join & CMS monoid merge-laws ✓ (state-level) · error-DIRECTION ✓ (Bloom no-false-neg, CMS no-undercount); magnitude bounds: **empirical ✓** (Metric.MagnitudeBounds — deterministic) AND **formal ✓** (Formal/Metric.Bounds — Z3-verified ε/δ derivation [Cormode-Muthukrishnan] + Bloom FP; premise: uniform/pairwise-independent hashing + Markov + row-independence, NAMED — same status as Merkle's crypto premise) | ✓ (4/4 byte-locked — F#+C#+Rust+TS; Bloom XXH3-128 core, CMS SplitMix+fastrange core; `Core.{CSharp,Rust}.Metric` + `Core.TypeScript/metric`. NB: `.NET HashCode.Combine` convenience path is not portable + excluded) | ✓ (Metric.Serializer, via OfState rehydrate) | ✓ (Metric.Serializer, merge reified) | ✓ (Metric.Serializer) | ✓ (Metric.Homeostat — Bloom OR=semilattice, CMS add=monoid; merge-convergence + error-direction preserved) | ✅ **FULL PROVEN** — 6th floor primitive (all six legs; ε/δ bound proven modulo the standard uniform-hashing premise, exactly as Merkle's tamper-evidence is modulo the crypto premise) |

**G-Set (CRDT merge) is the FIRST FULL-PROVEN floor primitive** (2026-06-04,
658c8e24 — all six legs in `GSet.FourSer.Tests.fs`); **Clock/Versionstamp is the
SECOND** (ddac32e9, `Clock.FullVertical.Tests.fs` — both join-semilattices: G-Set
merge=union, Clock merge=max; the reusable `_Support/SerializerLegs.fs` helper backs
the 4-ser+Arrow legs). **Serialization-seed (ByteCost) is the THIRD** (2026-06-04,
`SerializationSeed.FullVertical.Tests.fs` — a commutative MONOID, not a semilattice:
its homeostat-tie is order-independent AGGREGATION (path-independent fileset total),
explicitly NOT idempotent LUB). **Identity (local-handle layer) is the FOURTH** (2026-06-04,
`Identity.FullVertical.Tests.fs` — ZetaId as the absolute injective proven-base handle;
bridge = Object-of-decoded-fields; homeostat-tie = IDENTITY-DEDUP, a fourth class:
injectivity/no-bad-collapse + idempotent dedup, tied to the proven G-Set; the perspectival
belief-map / ε-ball-neighborhood layer is research and explicitly OUT of scope).
**ALL 6 of 6 floor primitives now FULL PROVEN** (G-Set, Clock, Serialization-seed, Identity,
Merkle, Metric — the floor is complete; premise-conditional legs [Merkle crypto, Metric
uniform-hashing] are named, not gaps). The pattern is the
**template** the other 4 follow (each: bridge the primitive's value/operation to DynamicValue → 4-ser
round-trip + Arrow round-trip + reify-the-operation-as-Bonsai + homeostat-convergence).
**Merkle (2026-06-04, `Merkle.FullVertical.Tests.fs`) clears 5 of those 6 legs** and is
the first vertical where the homeostat-tie is NOT convergence-to-LUB: Merkle's `combine`
is deliberately non-commutative (a Merkle tree is a *sequence* witness, not a set), so it
is **not** a join-semilattice. Its homeostat role is **integrity / anti-entropy** — the
root is a deterministic witness of the converged leaf-state (same state → same root), and
`LeafDiff` pinpoints exactly the changed leaves so shipping only the delta drives a replica
to the same root. So the role taxonomy (semilattice→converges; integrity→verifies) is now
demonstrated, not just asserted. Merkle's only remaining leg is the 4-lang port.
**Serialization-seed (ByteCost, 2026-06-04) adds the THIRD operation class:** a
commutative MONOID (`add` is associative + commutative with `Zero` identity but NOT
idempotent — re-adding double-counts), so its homeostat-tie is **order-independent
aggregation** (the fileset total is path-independent — the DORA-aggregate soundness),
distinct from both idempotent LUB-convergence (G-Set/Clock) and integrity-verification
(Merkle). **Identity (local-handle, 2026-06-04) adds the FOURTH operation class:**
IDENTITY-DEDUP — injectivity/no-bad-collapse (distinct observations pack to distinct
keys; a bijection, so two distinct personas never silently merge) + idempotent dedup
(re-observing the same identity is a no-op, a G-Set of packed keys — the GOOD collapse).
All four homeostat-tie classes are now worked end-to-end:
semilattice→converge-to-LUB · integrity→verify-the-converged-state ·
monoid→order-independent-aggregate · identity→dedup (injective + idempotent).
**Merkle reached FULL PROVEN (5th) 2026-06-05** when the 4-lang leg closed: the pure-TS
XXH3-128 port (`src/Core.TypeScript/merkle/xxh3.ts`, zero-dep per Aaron's decision, faithful
port of the xxhash-rust reference for seed 0 across all length classes incl. the long
accumulate/scramble/merge path) is byte-identical to .NET/Rust, verified against golden
vectors generated from F#. So all four oracles (F#/C#/Rust/TS) agree on every Merkle root.
**Metric/aggregation reached FULL PROVEN (6th, 2026-06-05) — the floor is complete.** Its
last leg, the formal ε/δ magnitude bound, is now Z3-verified (`Formal/Metric.Bounds.Tests.fs`):
the Cormode-Muthukrishnan derivation (expectation → Markov → width-condition → row-independence
powering → δ) + the Bloom FP bound, each step a theorem over ℝ (negation unsat). The
probabilistic premises (uniform/pairwise-independent hashing, Markov, row independence) are
NAMED — the bound is proven *modulo* them, exactly as Merkle's tamper-evidence is proven modulo
its crypto premise. metric's other legs: math (merge + error-direction + empirical + formal
magnitude) + 4-ser + Arrow + Bonsai + homeostat + **4-lang** (Bloom + CountMin byte-locked
across F#/C#/Rust/TS, `Core.{CSharp,Rust}.Metric` + `Core.TypeScript/metric`; deterministic
core only — `.NET HashCode.Combine` is not portable). Merkle's 4-lang leg
(the last gap) closed across all four oracles: `src/Core.CSharp.Merkle` shares
`System.IO.Hashing.XxHash128`; `src/Core.Rust.Merkle` is HEXAGONAL (zero-dep core owns the
`Hasher128` port; `xxhash-rust` is a swappable adapter behind the default `xxh3` feature,
exact-pinned `=0.8.10`, core builds `--no-default-features`); `src/Core.TypeScript/merkle` is
a zero-dep **pure-TS XXH3-128** port — all verified byte-identical against golden vectors
generated from F#, after correcting for .NET's XXH128 canonical big-endian output
(`Hi/Lo = swap` of `xxh3_128`'s halves). The **4-lang column is sourced from `PRIMITIVE-REGISTRY.md`**
(the consensus authority); this map adds the math + remaining legs.

## Beyond the floor — landed 2026-06-05 (proven primitives built ON the floor)

> With the 6/6 floor complete, a second layer landed in one push. Full per-item detail (with the §A
> frozen-core ↔ §B conjecture-register split) lives in
> [`FROZEN-CORE-AND-CONJECTURE-REGISTER.md`](FROZEN-CORE-AND-CONJECTURE-REGISTER.md); this is the map index.

**Traveler self-frame over DBSP — Layer 0 COMPLETE** (the relativistic relative-frame, three distinct objects):

- **Consistency / merge — ✅ FULL PROVEN (all six legs)** — `src/Core/TravelerFrame.fs`: the causal-join of
  two travelers' vector clocks is a bounded join-semilattice ⇒ order-independent ⇒ all travelers reach ONE
  common frame. math + 4-lang (F#+C#+TS+Rust: `Core.CSharp/TravelerFrame.cs`, `Core.TypeScript/traveler-frame/`,
  `Core.Rust.TravelerFrame`) + 4-ser + Arrow + homeostat (SEMILATTICE class — convergence-to-LUB, 4-lang) +
  Bonsai. (`TravelerFrame.Tests` / `.Legs.Tests` / `.CrossVerify.Tests`)
- **Clock-with-uncertainty** — `src/Core/UncertainClock.fs`: CockroachDB HLC + uncertainty window; a *partial*
  temporal order (definitelyBefore is a strict partial order; the overlap zone is honestly uncertain — the
  SoftValue tie; ε=0 collapses to exact). math + 4-lang (F#+C#+TS+Rust: `Core.CSharp/UncertainClock.cs`,
  `Core.TypeScript/uncertain-clock/`, `Core.Rust.UncertainClock` — `compareHlc`/`send`/`receive`/
  `definitelyBefore`/`uncertain`, all exact int64 so the FULL surface byte-locks, no float caveat).
  (`UncertainClock.Tests` / `.CrossVerify.Tests`)
- **Event-time watermark — ✅ FULL PROVEN (all six legs)** — `src/Core/Watermark.fs`: the Akidau et al.
  (Dataflow Model, VLDB 2015) watermark — monotone running max with bounded-lateness allowance,
  `combine` = min across sources (can't progress past the slowest input), `isLate` = e ≤ wm. math
  (`Infra/Watermark.Tests`) + 4-lang (F#+C#+TS+Rust: `Core.CSharp/Watermark.cs`,
  `Core.TypeScript/watermark/`, `Core.Rust.Watermark` — exact int64) + 4-ser + Arrow + homeostat
  (SEMILATTICE class — `combine`=min is a bounded MEET-semilattice; convergence-to-GLB, the meet/GLB
  dual of TravelerFrame's join/LUB; identity = Int64.MaxValue) + Bonsai (combine reified). The third
  post-floor primitive at floor-grade rigor, and the first using the *meet*-semilattice homeostat class.
  (`Watermark.CrossVerify.Tests` / `Watermark.Legs.Tests`)
- **Group law — ✅ FULL PROVEN (all six legs)** — `src/Core/FrameDelta.fs`: frame-offsets form an abelian group
  (identity/assoc/comm/inverse) acting on frames by translation — the boost analog, distinct from the merge.
  Honest scope: abelian *translation* group, not the full non-abelian Lorentz group. math + 4-lang
  (`Core.CSharp/FrameDelta.cs`, `Core.TypeScript/frame-delta/`, `Core.Rust.FrameDelta`) + 4-ser + Arrow +
  homeostat (MONOID class — order-independent aggregation, 4-lang) + Bonsai. (`FrameDelta.Tests` /
  `.Legs.Tests` / `.CrossVerify.Tests`)
- **Range metric** — `FrameDelta.distance`: the vector-clock L1 metric (non-neg, zero-iff-coincide [Leibniz],
  symmetric, triangle) — the "Range" measurement axis.
- Action grid (Layer 2) — `src/Core/ActionGrid.fs`: the 4×4 universal action grammar; navigation is a pure
  function of position, never of labels (proven via a discriminating predicate + negative control).

**Measurement axes** (the 6+2 hypothesis — four built; completeness is the open obligation):
When = `Clock` · How-sure = `src/Core/SoftValue.fs` · Rate/curvature = `src/Core/Curve.fs` (DBSP D/I over
the clock; D∘I=I∘D=id; math + 4-lang + 4-ser + Arrow — its honest CEILING: Bonsai/homeostat are N/A for a
derivative operator, which is non-mergeable) · Range = `FrameDelta.distance`. Directional axes
(Bearing/Where-looking) deliberately NOT built — no honest anchor in a causal frame.

> **New-layer FULL-PROVEN primitives (2026-06-05):** `TravelerFrame` (merge / join-semilattice),
> `FrameDelta` (transformation / group), `Watermark` (frontier / meet-semilattice), and `Reconcile`
> (relative-observer 3-way merge over the Merkle ancestor — `a·b/ancestor`; order-independent =
> convergence-to-one-frame) each clear all six legs — post-floor primitives at floor-grade rigor, each
> using the homeostat class that honestly fits its algebra: convergence-to-LUB (join), order-independent
> aggregation (monoid), convergence-to-GLB (meet), order-independent reconciliation (Reconcile). `Curve`
> tops out at four legs (Bonsai/homeostat N/A by kind). The six-leg bar is a bar for *mergeable*
> primitives; the SplitMix64/RendezvousHash/CRC32C/FastCDC/Consensus cluster is math + 4-lang (not
> mergeable — no honest homeostat leg). `ProbabilitySemiring` is math + 4-lang (incl. div + merge3).

**Determinism + integrity substrate (not measurement axes):**

- **SplitMix64 finaliser** — `src/Core/SplitMix64.fs`: Vigna's mixer (arxiv 1410.0530 §3), the deterministic
  mixing step behind Zeta's DST RNG. math (BigCrush-validated upstream; the three golden-ratio/Vigna
  constants documented) + 4-lang (F#+C#+TS+Rust: `Core.CSharp/SplitMix64.cs`, `Core.TypeScript/splitmix64/`,
  `Core.Rust.SplitMix64` — pure wrapping uint64, byte-identical; uint64 carried as decimal strings since it
  exceeds JSON's exact range). The 4-lang leg is load-bearing for DST itself: replays must produce identical
  pseudo-random streams across the language ports, which this proves. (`SplitMix64.CrossVerify.Tests`)
- **Rendezvous (HRW) consistent hash** — `src/Core/ConsistentHash.fs` (`RendezvousHash`): Thaler &
  Ravishankar 1998; scores each bucket by `SplitMix64.mix(key ^ seed_i)` and picks the argmax, with
  `seed(i) = SplitMix64.mix(i)`. math (valid-bucket + near-optimal 1/N rebalance churn, `Runtime/
  ConsistentHash.Tests`) + 4-lang (F#+C#+TS+Rust: `Core.CSharp/RendezvousHash.cs`,
  `Core.TypeScript/consistent-hash/`, `Core.Rust.ConsistentHash` — pure wrapping uint64, builds on the
  4-lang-proven SplitMix64). **Honest scope:** only the pure-integer HRW algorithm is byte-locked;
  `JumpConsistentHash` is deliberately NOT cross-verified because it uses `f64` arithmetic, and floats
  are out of the proof lineage. (`RendezvousHash.CrossVerify.Tests`)
- **CRC32C (Castagnoli) integrity checksum** — `src/Core/HardwareCrc.fs` (`HardwareCrc.Crc32C`): the
  checkpoint-format checksum, hardware-accelerated (SSE4.2 / ARMv8) with a table form computing the
  identical standard value. math (canonical check value `CRC32C("123456789") = 0xE3069283`) + 4-lang
  (F#+C#+TS+Rust: `Core.CSharp/Crc32c.cs`, `Core.TypeScript/crc32c/`, `Core.Rust.Crc32c` — pure integer).
  Notably the F# cross-verify drives the **real hardware path** and matches the table-computed seed, so
  the agreement is hardware-vs-table-vs-three-languages. (`Crc32c.CrossVerify.Tests`)
- **FastCDC content-defined chunking** — `src/Core/FastCdc.fs` (`FastCdcChunker` / `FastCdc.chunkAll`):
  Xia et al. USENIX ATC 2016; the dedup chunker. GEAR table = `SplitMix64.mix(i)` (builds on the
  4-lang-proven SplitMix64), rolling Gear hash `(hash<<1)+GEAR[byte]`, normalized masks 2^15-1 / 2^11-1,
  min-skip + max-force + flush. math (chunk-boundary determinism; `Infra` FastCdc tests) + 4-lang
  (F#+C#+TS+Rust: `Core.CSharp/FastCdc.cs`, `Core.TypeScript/fastcdc/`, `Core.Rust.FastCdc` — pure
  wrapping uint64). The seed stays tiny by having each oracle deterministically regenerate the byte
  stream (`byte[i] = mix(i) & 0xFF`) and cross-verifying the chunk-length sequence; a 200000-byte stream
  exercises genuine content-defined cuts (variable lengths, not only max-forced). (`FastCdc.CrossVerify.Tests`)
- **BFT quorum consensus (decision core)** — `src/Core/Consensus.fs` (`quorumThreshold` / `decide`):
  the classic 2f+1 quorum (`quorumThreshold(n) = 2⌊(n-1)/3⌋+1`) and the vote tally (group by value,
  stable-sort by descending count preserving first-occurrence, commit the top iff support reaches the
  threshold). math (quorum N=4→3 / N=7→5, empty rejects, unanimous commits; existing Consensus suite) +
  4-lang (F#+C#+TS+Rust: `Core.CSharp/Consensus.cs`, `Core.TypeScript/consensus/`, `Core.Rust.Consensus`
  — pure integer). **Honest scope:** only the decision core is byte-locked; the vote state machine
  (`transition`) carries `DateTimeOffset` timestamps and is out of clean byte-lock scope. The tie-break
  (first-occurrence on equal counts) is locked via a deliberate `["b","a","a","b"]` vector across all four
  stable sorts. (`Consensus.CrossVerify.Tests`)

**Adinkra / holographic chain — COMPLETE to the published correspondence** (Lean, sorry-free, axiom-audited):

- `tools/lean4/ImaginaryStack/ToyModel.lean` — bulk-from-boundary reconstruction for a graph-code.
- `tools/lean4/ImaginaryStack/ErasureDistance.lean` — distance ⇒ any-`<d`-erasure correctable; a concrete
  Reed-Solomon `[16,12]` MDS code proven distance-5 / corrects-any-4-erasures.
- `src/Core/AdinkraCode.fs` — the genuine Adinkra generator IDENTIFIED: the `[8,4]` extended Hamming code,
  proven doubly-even (Gates/Iga correspondence). Open: the Cayley-Dickson→this-generator derivation (Vera's).

**Privacy from identity — COMPLETE to the provable limit** (Lean, axiom-FREE):
`tools/lean4/Privacy/IdentityForcesPrivacy.lean` — necessity (`distinctness_forces_private`: under public
convergence, distinct behavior ⇒ distinct private; Leibniz) + dynamics (`commons_converges`,
`private_is_persistent_locus`: consensus can't erase private differentiation). Halting experiment:
`src/Core/Evolution.fs` (081KT7YW00008QG0R001DGZQKM) — the pigeonhole bound PROVEN (finite+deterministic+no-input ⇒ halt-or-cycle,
so growth requires the differentiation engine) + the differentiation-evolves / collapse-halts DST harness.
Open (honest): the universal "halts without privacy" claim is empirical, not a theorem.

**Belief convergence — GENERAL case** — `src/Core/BeliefConvergence.fs`: Bayesian observe (pointwise-multiply
fixed likelihoods) commutes ⇒ order-independent convergence for ANY fixed likelihoods (independence was
sufficient, not the condition); boundary = state-dependent/nonlinear revision (counterexample). Generalizes
the SoftValue independent-evidence proof.

**Mediator subsystem** (hexagonal, source-gen, swappable, polyglot) — `src/Core.CSharp.Mediator` (the
`Zeta.Mediator.*` port over martinothamar/Mediator: Unit, Request/Command/Query/Stream/Notification/Pipeline,
adapter, DI) · `src/Core.FSharp.Mediator` (F# `unit`↔`Zeta.Unit` bridge) · `src/Core.CSharp.Mediator.Handlers`
(four real handlers over proven Core: context-cost query, Merkle root, cost-curve trend, agent-bus notification).
Proven via `tests/Core.CSharp.Mediator.Tests` incl. cross-language F# handler discovery.

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

The clock is an injectable family behind `IScheduler` (081KS3X9Y0008QG0R003MMEAC7 negotiation stack);
**there is no global causal order — relativistic**: each agent = its own git repo
= its own frame; frames connect only through **bus repos over Rx joins** (081KSNY2Z0008QG0R0031EAB6T).

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
  (081KT2T2J0008QG0R000YZ3NMY). Canonical = homeostat proven from the seed.
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
4. **Bayesian BP/EP metric scale-sensitivity** — ✅ routed to 081KT2T2J0008QG0R000YZ3NMY (Soraya
   cadence): max-abs-diff on natural params is scale-dependent; fix = KL-divergence
   or magnitude-scaled tolerance.
5. **ZetaId ordering caveat** — partially: proven within a version (Version is the
   top field); cross-version is version-first by layout, so time-series range
   scans must partition by Version. Documented in Canonical.Tests.fs.

## Relation to the larger primitives wishlist

[`docs/PRIMITIVE-REGISTRY.md`](PRIMITIVE-REGISTRY.md) (tracked by **081KSXN940008QG0R003FCQ7WT**) is
the full cross-language **wishlist** + the **4-lang-consensus** status view — the
"4-lang" leg of the PROVEN bar. THIS map is the complementary **math / proof-leg**
view over the floor. They connect, not fork: `PROVEN = (4-lang from the registry)
∧ (math from this map) ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat`. Build the wishlist
one primitive at a time, connecting each to these proven floor primitives once
there's a full proof chain (sequencing is the agent's call).

## Pointers

- 081KT7YW00008QG0R002T1XNWT (context-window minimization — the program this map serves)
- `docs/PRIMITIVE-REGISTRY.md` + 081KSXN940008QG0R003FCQ7WT (the larger wishlist / 4-lang status view)
- 081KS3X9Y0008QG0R003MMEAC7 (clock-protocol-negotiation-stack) · 081KS3X9Y0008QG0R0006MQXA4 (deferred-causality / Z-sets)
- 081KSNY2Z0008QG0R0031EAB6T (Rx temporal joins / bus) · 081KSNY2Z0008QG0R001HA43GG (IScheduler DST)
- 081KT2T2J0008QG0R000YZ3NMY (asserted→proven gap; the formal-coverage ledger)
