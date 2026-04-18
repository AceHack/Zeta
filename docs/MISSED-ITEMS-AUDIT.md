# Missed-Items Audit — back-on-the-radar list

Sweep of every earlier-round ask to check nothing got quietly
dropped. Organised by source round. ✅ = shipped. 🔜 = next round
P1. 🔮 = deferred research-grade. ⏭️ = explicitly declined with
reason.

## Round 1-6 (foundation)
- ✅ F# DBSP operator algebra (D, I, z⁻¹, H)
- ✅ Z-set + IndexedZSet + Spine
- ✅ LFP / semi-naïve recursion
- ✅ Higher-order differentials (D², Dⁿ, Aitken)
- ✅ Incremental distinct (O(|Δ|))
- ✅ Deterministic simulation env (ChaosEnvironment)
- ✅ TLA+ + Z3 + FsCheck verification stack
- ✅ HLL + Count-Min sketches
- ✅ Nested circuits + NestedCircuit handle
- ✅ Transactional Z⁻¹ with CAS
- ✅ Checkpoint + CRC32 (initial) → 🔜 CRC32C hardware-accelerated
- ✅ 7 DI seams (IClock/IMetricsSink/IHashStrategy/IConsistentHash/
  IBackingStore/ISink/IAppendSink/IResiduatedLattice/ISerializer/
  IWatermarkStrategy/IDbspLogger)

## Round 7-8 (math + sketches)
- ✅ Tropical semiring
- ✅ KLL quantile, HyperMinHash
- ✅ Haar wavelet window
- ✅ MementoHash consistent hashing
- ✅ CRDTs (G/PN-Counter, OR-Set, LWW)
- ✅ Delta-CRDTs + Dotted Version Vectors
- ✅ Residuated lattice (scaffolding + O(1) max via `ResidualMax`)

## Round 9 (concurrency + verification)
- ✅ OpenTelemetry tracing (ActivitySource)
- ✅ IsAsync discoverability + HasAsyncOps
- ✅ 8 TLA+ specs total (6 now pass TLC)
- ✅ MementoHash + InfoTheoreticSharder
- ✅ `opsCache` scalability fix in NestedCircuit
- ✅ Non-exception `AppendResult` API
- ✅ 13 Pipeline fluent LINQ ops
- ✅ ROADMAP + WATERMARK-RESEARCH + CONSISTENT-HASH-RESEARCH docs
- ✅ Package audit script — `tools/audit-packages.sh`
- ✅ Coverlet bumped 6.0.4 → 10.0.0

## Round 10-11 (research agents + novel math)
- ✅ Thread-safety stress harness (would catch the CAS regression)
- ✅ VirtualTimeScheduler (Rx-style)
- ✅ 4 additional TLA+ specs
- ✅ HardwareCrc (Sse42 + AdvSimd.Crc32.Arm64)
- ✅ FsPickler + TLV + Span + Arrow IPC serializers (4-tier)
- ✅ Dbsp.Core.CSharp shim with variance + C# tests
- ✅ Dbsp.Bayesian with BayesianRateOp used in real operator
- ✅ Content-based hashing research + FastCDC + Merkle
- ✅ Feldera benchmark scaffold (Q1/Q2)
- ✅ REVIEW-AGENTS.md with 15 reviewer prompts
- ✅ Semgrep 7 rules
- ✅ Stryker config + Alloy `.als` + Lean `.lean` stub
- ✅ `tools/install-verifiers.sh` installer
- 🔜 Retraction-native speculative watermark operator (shipped;
  formal proof + property tests P1)
- ✅ SpeculativeWatermark operator

## Round 12 (big feature batch)
- ✅ All upgrade bumps (Meziantou 2→3, Test.Sdk 17→18, BenchmarkDotNet,
  System.Reactive, Apache.Arrow)
- ✅ OperatorLifecycleRace spec fixed + un-skipped
- ✅ InfoTheoreticSharder empirical test (found + fixed 2 bugs)
- ✅ Residuated-lattice ResidualMax operator
- ✅ More Semgrep rules (path-traversal, lock-across-await, public-mutable)
- ✅ CTFP books downloaded (Milewski + Bouderaux) + required-reading guide
- ✅ FoundationDB-DST research doc
- 🔜 Product Manager + Package Auditor agent prompts (skills shipped
  this round under `.claude/skills/`)

## Round 13 (THIS round — just shipped)
- ✅ CTFP `.git` stripped
- ✅ Feldera cloned to `references/upstreams/feldera/`
- ✅ Rust verified (1.94.1 Homebrew, latest available)
- ✅ `docs/INSTALLED.md` dependency ledger
- ✅ 5 reviewer SKILL.md files (`.claude/skills/dbsp-{race-hunter,
  claims-tester, package-auditor, product-manager, harsh-critic}/`)
- ✅ 3 additional TLA+ specs now pass TLC (SpineMerge still fails — real
  modelling bug, roadmap)
- ✅ `AGENTS.md` — greenfield policy, no backcompat, large refactors
  welcome
- ✅ `docs/MISSED-ITEMS-AUDIT.md` — this file
- ✅ Hierarchy.fs — closure-table operator (winner over
  materialised-path / nested-set / ltree after research agent's verdict)
- ✅ Materialized-path / closure-table research doc (agent output —
  will wire into Hierarchy.fs docstrings)
- ✅ Deep-review agent against prior research we imported — 13-item
  prioritised port plan delivered; 3 P0-S items ready to ship next
  round

## 🔜 Next round (concrete P1 items queued)

- **Port 3 P0 items from prior research** to Dbsp.Core (F# translations,
  latest-research rewrites per AGENTS.md policy):
  1. `CommitBoundary` in `DiskSpine.fs` + `ISimulatedFs.FlushToStableStorage`
  2. Frame-first/header-second commit protocol with hardware CRC32C
  3. `DurabilityMode` DU (`StableStorage` / `OsBuffered`)
- **Port the `github-pr-review-hygiene` skill** verbatim from prior
  research (no DBSP equivalent)
- **Fix `SpineMergeInvariants.tla`** — TLC found a real modelling bug
- **Property tests for speculative-watermark mathematical claim** (ACC /
  DISC / RET mode collapse)
- **Content-addressed batches** — wire `MerkleHash` into Spine instead
  of `nextId` counter
- **Remaining 4 TLA+ `.cfg` files** (`ChaosEnvDeterminism`,
  `ConsistentHashRebalance`, `DictionaryStripedCAS`, `AsyncStreamEnumerator`)
- **Stronger InfoTheoretic claim** — implement optimal MI-max partition
  from arXiv:2402.13264 §4
- **3 more `.claude/skills/` reviewer conversions** (SIMD, scalability,
  math-research)

## 🔮 Explicitly deferred (with honest reason)

- **Lean 4 full chain-rule proof with Mathlib** — 2-week project; stub
  compiles, full proof needs Mathlib `Finsupp` wiring
- **ISimulationDriver full unification** — 3-day refactor; design
  captured in `docs/FOUNDATIONDB-DST.md`
- **Autoresearch by Karpathy** — verdict **SKIP as platform** (agent
  round 12): 200-LOC scalar-metric mutator; copy the pattern for the
  `learned cost model for Plan.fs` direction only. Alternative tools
  (Sakana AI Scientist, Agent Laboratory) are right-shape for our
  theorem-prover + semiring-parametric + CAS-DBSP directions.
- **Raft / CAS-Paxos multi-node** — publication target, ~6 engineer-
  months, no user demand yet
- **Full Feldera cargo build + apples-to-apples** — cloned, ~15 min
  first build; gated on Q3/Q7 on our side
- **ML.NET real learned cost model** — design from round-12 agent;
  candidate project `Dbsp.LearnedPlan`, ONNX-runtime-based so AOT stays
  clean for core

## ⏭️ Declined

- **Learned indexes (LIPP / ALEX)** — research stage; no production DB
  ships them
- **GPU OLTP** — not relevant to CPU-first .NET
- **Calvin/FaunaDB-style deterministic sequencer MVCC** — FaunaDB
  shut May 2025; niche
- **io_uring wrappers** — no first-class .NET support; managed group-
  commit is the honest ceiling
- **Preserving SQLite-derived on-disk format** (inherited from prior
  research we imported) — greenfield policy; we build the native
  format from FASTER HybridLog + TigerBeetle grid blocks + SlateDB
  writer-epoch CAS (per AGENTS.md)

## Honest regression-avoidance

When re-reviewing past rounds, check: did any "shipped" item actually
land code + passing test, or only a docstring claim? The
claims-tester skill (`.claude/skills/claims-tester/`) is the
forcing function to keep this honest.
