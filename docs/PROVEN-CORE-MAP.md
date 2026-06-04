# Proven-core map — the event store proven one organ at a time

> Navigation map (Aaron 2026-06-04: "make sure we have the map saved, we can
> slowly navigate it and build one bit at a time"). The event store is **a theorem
> built one primitive at a time** — identity, time, integrity, merge,
> serialization, metrics, history, curve, curvature. This map tracks the spine,
> the floor primitives beneath it, and the proof status of each, so a human or AI
> can navigate it and prove one bit at a time.

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
| 1 | **Clock / causal order** | `src/Core/Clock.fs` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | math-leg only (total-order instance) |
| 2 | **Identity / keys** (ordered composite key, NOT hash) | `src/Core.*.ZetaId` | ✗ | ✓ | partial | ✗ | ✗ | ✗ | 4-lang validated; math leg open |
| 3 | **Merkle integrity** | `src/Core/Merkle.fs` | ✓ (structural tamper-evidence; crypto premise named) | ? | ✗ | ✗ | ✗ | ✗ | math-leg only |
| 4 | **CRDT merge + idempotency** | `Crdt.fs`, `GSet.fs` | ✓ (ACI+identity+LUB; GCounter over state) | ✗ | ✗ | ✗ | ✗ | ✗ | math-leg only |
| 5 | **Serialization seed** | `byte-cost`, `DynamicValue` | ✓ | ✓ | partial | ✗ | ✗ | ✗ | math + 4-lang byte-locked |
| 6 | **Metric / aggregation algebra** | `byte-cost`, `Bloom`/`CountMin`/`Sketch` | byte-cost ✓ · HLL+Bloom join & CMS monoid merge-laws ✓ (state-level) · error-DIRECTION ✓ (Bloom no-false-neg, CMS no-undercount); probabilistic magnitude bounds ✗ | byte-cost ✓ | ✗ | ✗ | ✗ | ✗ | math-leg (merge + error-direction); magnitude bounds + 4-lang open |

**Nothing on this floor is PROVEN by the full bar yet.** The math leg is started
for clock / CRDT / byte-cost; 4-lang holds for identity / byte-cost / serialization.
The remaining legs (4-ser, Bonsai, Arrow, homeostat-tie) are open across the board.

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
⇒ keys are **238 bits**, **many key types** partition the bit-space, guarded by
**F# units-of-measure** so wrong-key-type code won't compile and a proof scoped to
one key type can't be applied to another (UoM-as-category-tag). ZetaId has 4-lang
byte-lock; per-key-type math legs + the UoM guard are open.
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

## Pointers
- B-1016 (context-window minimization — the program this map serves)
- B-0684 (clock-protocol-negotiation-stack) · B-0683 (deferred-causality / Z-sets)
- B-0907 (Rx temporal joins / bus) · B-0924 (IScheduler DST)
- B-1007 (asserted→proven gap; the formal-coverage ledger)
