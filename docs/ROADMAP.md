# Dbsp.Core Roadmap

## Legend
- **P0** — ship-blocker, next round
- **P1** — within 2 rounds
- **P2** — within 4 rounds
- **P3** — noted, when the time is right
- **Research** — original work; write paper, don't just code

## Shipped (what's in `main` right now)

### Correctness / verification
- Z-set algebra (D, I, z⁻¹, H, Distinct) ✅
- Semi-naïve evaluation ✅
- Higher-order differentials (D², Dⁿ, Aitken Δ²) ✅
- Incremental distinct (O(|Δ|)) ✅
- Feedback loops + nested circuits ✅
- Transactional Z⁻¹ (CAS-based) ✅
- Checkpoint + CRC + magic-tag ✅
- TLA+ specs: `DbspSpec`, `SpineAsyncProtocol`, `CircuitRegistration`, `TwoPCSink`, `SpineMergeInvariants` ✅
- Z3 SMT proofs of pointwise axioms ✅
- FsCheck property-based tests ✅
- Deterministic-simulation env with chaos policies ✅

### Performance
- ArrayPool on every rented workspace ✅
- SIMD merge (AVX2 / ARM NEON) ✅
- ZSet.sum O(n log k) with PriorityQueue ✅
- BalancedSpine MaxSAT-inspired scheduler + ZSet.sum + BitOps.Log2 ✅
- HLL + Count-Min sketches, zero-alloc inner loops ✅
- `weightedCount` 4-way unrolled ✅
- Checked arithmetic on every weight op ✅
- Lock → CAS conversion for Transaction ✅
- NestedCircuit opsCache after Build ✅
- Hash-hoist in ExchangeOp ✅

### APIs / surface
- Circuit / Op / Stream core ✅
- `circuit { }` CE, `Pipeline` module, fluent extensions, `dbspQuery` — three ways to compose ✅
- C# interop via `[<Extension>]` ✅
- `IAsyncEnumerable` adapter ✅
- `IObservable` adapter (System.Reactive) ✅
- Pluggable sinks (`ISink` 2PC, `IAppendSink` EventStore-style) ✅
- DI seams: `IClock`, `IMetricsSink`, `IHashStrategy`, `IConsistentHash`, `IBackingStore`, `ISink`, `IAppendSink` ✅
- Work-stealing runtimes: TPL Dataflow + MailboxProcessor ✅
- Plan / Explain / ToDot ✅

### Math / sketches / novelty
- HyperLogLog ✅
- Count-Min Sketch ✅
- KLL quantile ✅
- HyperMinHash ✅
- Tropical semiring ✅
- Haar wavelet window ✅
- CRDTs: G-Counter, PN-Counter, OR-Set, LWW-Register ✅
- Consistent hashing: Jump, Rendezvous/HRW, MementoHash ✅
- Watermarks: Monotonic, BoundedLateness, Periodic ✅

### Observability
- System.Diagnostics.Metrics ✅
- System.Diagnostics.ActivitySource (OpenTelemetry) ✅
- RecordingMetricsSink for test assertions ✅

## P1 (next round — 2 weeks)

- **Apache Arrow IPC + zstd** checkpoint format (10× faster than JSON on big states)
- **Arrow Flight** as the multi-node wire protocol — bi-directional streaming of Z-set deltas
- **WatermarkStrategy.Statistical via KLL** — `DI seam: IWatermarkStrategy`
- **Frontier<int64>** type (set of per-shard watermarks, à la Timely Dataflow)
- **Expression-tree operator fusion** — IL-emit a fused `StepAsync` per chain of map/filter/map at Build time (2–5× on those workloads)
- **State TTL on BalancedSpine** — retract-on-expiry via `-Δ`, preserves correctness for free
- **Session windows** — `IndexedZSet` + watermark + coalesce gap > T
- **Package audit** — Stryker.NET, CodeQL, Semgrep wired into CI
- **Dbsp.Bayesian project** — Infer.NET F# wrapper, `BayesianAggregate` operator
- **Dbsp.Core.CSharp shim** — declaration-site variance on interfaces (`IBackingStore<out K>` etc)
- **Remaining TLA+ specs** — `TransactionInterleaving`, `ChaosEnvDeterminism`, `ConsistentHashRebalance`
- **TLC-validation test** — run the `.tla` files in a `dotnet test` to prevent drift

## P2 (4 weeks)

- **Raft-based multi-node replicated log** for checkpoint + delta replay (~2500 LOC F#)
- **CAS-Paxos with state-transition-function consensus** — replaces log-based replay; research-grade
- **Broadcast side-input** for small-dim-table joins
- **CEP `match_recognize`** via finite-state-machine operator
- **Delta-CRDTs** anti-entropy for cross-node replication (Almeida et al. 2018)
- **Dotted version vectors** for nested-circuit iteration numbering
- **IQbservable** / Reaqtor-style **Bonsai slim IR** for persistable queries
- **Templatization / CSE** — dedupe identical query shapes at Build
- **Lean 4 kernel** proving `D∘I=id` + chain rule + rewrite-commute
- **Ceph/CRUSH**-style hierarchical failure-domain placer (if distribution lands)
- **Power-of-two-choices** load-aware router atop consistent hashing
- **Learning-based sketch self-calibration** (Cao et al. arXiv:2412.03611)

## P3 (noted)

- **Semiring-parametric ZSet**: extend operator algebra to any commutative semiring (Research-grade paper)
- **Timely Dataflow**-style multi-dimensional logical time
- **Profunctor optics** for composable IVM
- **Randomised incremental SVD** for streaming PCA/anomaly detection
- **Conjugate-prior online Bayes** as a DBSP operator
- **Residuated lattices** for principled min/max inverses
- **Widening operators** for recursive-query convergence on ℚ
- **Kalman/particle filter** operators for noisy aggregates

## Research opportunities (publication targets)

Taken from scout agent:

1. **ILP-relaxed MaxSAT spine scheduling with online warm-start** → VLDB research / SIGMOD industrial, ~4 engineer-months
2. **Retraction-native speculative watermarking** → VLDB / DEBS, ~3 em
3. **Semiring-parametric DBSP (tropical / Boolean / distributive-lattice)** → PODS / ICDT, ~6 em
4. **Verified incremental query optimisation in Lean 4** → PLDI / POPL, ~8 em
5. **CAS-Paxos with state-transition-function consensus for DBSP replay** → NSDI / OSDI, ~6 em
6. **F# type-provider-driven compile-time circuit specialisation** → OOPSLA / PLDI, ~4 em
7. **DBSP retraction ≡ Beam RETRACTING ≡ delta-CRDT merge** foundational clarifier → ICFP / LMCS, ~5 em

## CFPs to target

- **PaPoC 2026** (EuroSys workshop) — gaps 1, 4, 7
- **DEBS 2026** industry track — gaps 1, 2, 6
- **VLDB 2026** research — gaps 1, 2, 5
- **SIGMOD 2026** — gaps 3, 7
- **POPL 2027 / PLDI 2026** — gaps 3, 4, 6, 7
- **OSDI'26 / NSDI'26** — gap 5
- **CIDR 2027** — visionary 4-pager for 2 or 3

## Where we beat Feldera today

- F# record/DU ergonomics + C# interop out of the box (Feldera is Rust-only)
- Zero-alloc hot paths documented per file
- 0 warnings / 0 errors / 0 analyzer findings, enforced
- TLA+ + Z3 + FsCheck formal verification stack
- Sketches (HLL, CM, KLL, HyperMinHash) as first-class operators
- Tropical semiring for shortest-path as a drop-in weight type
- CRDT layer (G/PN/OR-Set/LWW)
- MementoHash (newest-2024 elastic consistent hash)
- IAsyncEnumerable + IObservable adapters
- Deterministic-simulation env with chaos policies
- First-class OpenTelemetry ActivitySource
- Non-exception AppendResult API

## Where Feldera beats us today

- Multi-node distribution (we're single-process)
- SQL compiler (we're F#/C# host-language only)
- Compiled Rust circuits (our LINQ IL-emit is P1)
- Mature production deployment experience

## Continuous workstreams

These don't wait for a single round:

- Grow formal-verification coverage (TLA+ `.cfg` for every `.tla`;
  Lean 4 proofs promoted from `sorry`-stub to real).
- Keep hot-path allocation measured and benchmarked per file.
- Improve public API ergonomics for both F# and C# consumers.
- Keep upstream research tracked in `docs/TECH-RADAR.md` with ring
  transitions dated.
- Keep benchmarks representative — when a shape changes, update
  `docs/BENCHMARKS.md` in the same round.
- Keep `docs/ROUND-HISTORY.md` current for narrative; keep other docs
  on current-state edits.
- Keep reviewer skills aligned with the current bug-class landscape;
  retire ones that stop catching anything, add ones when a new class
  shows up.
- Reject donated-legacy patterns on import. When we bring a shape
  over from another project, we rewrite it against latest research
  (FASTER / TigerBeetle / SlateDB / Arrow), not against the donor's
  code as-is.
- Keep the gap between implementation and spec small; drift is a bug,
  not an eventual cleanup.
