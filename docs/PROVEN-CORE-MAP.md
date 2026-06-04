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

## The floor (named primitives the spine rests on — prove these first)

| # | Primitive | Where | Status | Anchor |
|---|-----------|-------|--------|--------|
| 1 | **Clock / causal order** | `src/Core/Clock.fs` | **PROVEN** ✓ (Z3 total-order + FsCheck + DST replay) | FoundationDB versionstamp · Lamport 1978 · Rx IScheduler |
| 2 | **Identity / keys** | `src/Core.*.ZetaId` | **VALIDATED** (4-lang byte-lock); formal-proof leg open | content-address / ZetaId |
| 3 | **Hash-chain / Merkle integrity** | `src/Core/Merkle.fs` | present; proof open | Merkle 1987 · git SHA DAG |
| 4 | **Join-semilattice / CRDT merge + idempotency** | `src/Core/Crdt.fs`, `GSet.fs` | **in progress** (this commit) | Shapiro et al. CRDTs |
| 5 | **Serialization seed** | `byte-cost`, `DynamicValue` | **PROVEN/byte-locked** ✓ | golden vectors / seed-first |
| 6 | **Metric / aggregation algebra** | `byte-cost`, `Bloom`/`CountMin`/`Sketch` | byte-cost monoid proven; sketch merge-laws open | OTel · Bloom 1970 · Count-Min 2005 · HLL 2007 |

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
