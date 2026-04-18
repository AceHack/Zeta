# Tech Radar — researched things, status, notes

ThoughtWorks-style radar for the technologies / research / papers
/ projects this repo has evaluated. One row = one research pass.

## Legend
- **Adopt** — in-tree, we depend on it (code or patterns)
- **Trial** — in prototyping; live code path or skill file exists
- **Assess** — researched, worth revisiting
- **Hold** — explicitly declined (with reason)

## Rings

### Techniques

| Technique | Ring | Round | Notes |
|---|---|---|---|
| DBSP operator algebra (D, I, z⁻¹, H) | Adopt | 1 | Core of `Zeta.Core` |
| Retraction via signed Z-weights | Adopt | 1 | Z-sets |
| Semi-naïve LFP evaluation | Adopt | 6 | `Recursive.fs` |
| Higher-order differentials (D², Dⁿ, Aitken) | Adopt | 6 | `HigherOrder.fs` |
| MaxSAT-inspired spine scheduler | Adopt | 5 | `BalancedSpine.fs` |
| HyperLogLog | Adopt | 6 | `Sketch.fs` |
| Count-Min Sketch | Adopt | 10 | `CountMin.fs` |
| KLL + HyperMinHash | Adopt | 11 | `NovelMath.fs` |
| Haar wavelet multi-resolution window | Adopt | 11 | `NovelMath.fs` |
| Tropical semiring | Adopt | 11 | `NovelMath.fs` |
| Residuated lattices | Trial | 12 | `Residuated.fs` — claimed O(1) was actually O(n); fix in progress |
| FastCDC content-defined chunking | Trial | 13 | `FastCdc.fs` — harsh-critic found O(n²) buffer scan; fix P0 |
| Merkle-tree checkpointing | Trial | 13 | `Merkle.fs` — needs domain-separated leaves to avoid second-preimage |
| Closure-table hierarchy | Trial | 14 | `Hierarchy.fs` — research-worthy; ICDT/PODS'26 target |
| Retraction-native speculative watermark | Trial | 13 | `SpeculativeWatermark.fs` |
| Witness-Durable Commit (WDC) | Assess | 15 | `docs/BACKLOG.md` P0; peer-review says major revision needed |
| Delta-CRDTs + Dotted Version Vectors | Adopt | 10 | `DeltaCrdt.fs` |
| Jump / HRW / MementoHash consistent hashing | Adopt | 11 | `ConsistentHash.fs` |
| Info-theoretic shard assignment | Trial | 12 | `NovelMathExt.fs` — greedy 2-approx; optimal variant P1 |
| Profunctor lens | Assess | 12 | `NovelMathExt.fs` stub |
| CRC32C hardware-accelerated | Adopt | 10 | `HardwareCrc.fs` |
| SIMD merge (AVX2/NEON) | Adopt | 1 | `SimdMerge.fs` |
| TensorPrimitives for weightedCount | Trial | 11 | `Simd.fs` |
| Bloom filters (blocked + counting) | Trial | 17 | Shipped in `src/Core/BloomFilter.fs` — blocked + 4-bit counting, XxHash128 Kirsch-Mitzenmacher double-hashing. **Engineering fundamental, not novel research**: Putze 2007 / Fan 1998 / Kirsch-Mitzenmacher 2006 are off the shelf. Promote to Adopt once `bench/Dbsp.Benchmarks/BloomBench.fs` lands with measured FP rate + cache-miss numbers. |
| Counting Quotient Filter (CQF) | Trial | 18 | Fix for 4-bit counter saturation; natively counts multiplicities → direct Z-weight fit. Pandey et al. SIGMOD'17. |
| d-left Counting Bloom | Assess | 18 | Half the memory of 4-bit counting Bloom. Bonomi et al. ESA'06. |
| Cuckoo / Morton filter | Hold | 18 | Deleting a never-inserted item produces a false negative — breaks DBSP retraction-never-seen-item correctness. |
| Xor / Binary Fuse / Ribbon / BuRR filter | Assess | 18 | Static-only; useful for read-only frozen partitions once tiered storage ships. |
| Learned Bloom family (LBF / PLBF / Fast-PLBF) | Hold | 18 | Classifier retraining on every retraction batch breaks streaming latency guarantees. Revisit once a learned-index subsystem exists. |
| Stable Learned Bloom (drift-bounded FPR) | Assess | 18 | Only learned variant with proven drift-bounded FPR. Liu et al. PVLDB'20. |
| Ceramist (Coq-verified AMQs) | Assess | 18 | Coq-verified AMQ library (ITP'20 / CAV'21). Claim of "port to Lean Mathlib" is aspirational — `proofs/lean/` does not yet contain any Ceramist-derived lemma. Revisit when the port is a real PR. |
| Gap-monotone (signed-delta) semi-naïve LFP | Assess | 18 | Research direction — not shown to dominate Feldera VLDB'23 §6.3 `nested_integrate_trace` without a Z-linearity discipline argument. 10-14d impl est. if it proves out. `docs/research/retraction-safe-semi-naive.md`. |
| Counting algorithm for IVM under retract | Adopt | 19 | Gupta-Mumick-Subrahmanian SIGMOD'93. Shipped as `RecursiveCounting` + `CountingClosureTable` in `Recursive.fs` / `Hierarchy.fs`. Z-linearity precondition required on `body`. |
| DRed (Delete and Re-derive) | Hold | 18 | Motik et al. AIJ'19 proves it can regress below current `Recursive` baseline on retract-heavy workloads. |
| LiquidF# refinement types | Assess | 18 | Highest-leverage F#-native proof tool not yet adopted; would catch the off-by-one / bad-index class round after round. |
| Dafny / F* / Isabelle / Stainless / P#  | Assess | 18 | Enumerated in `docs/research/proof-tool-coverage.md`; each catches a different bug class. |
| Category theory as code-contract grammar | Adopt | 12 | `docs/category-theory/` |

### Tools / infra

| Tool | Ring | Round | Notes |
|---|---|---|---|
| FsCheck 3 property tests | Adopt | 1 | In CI |
| TLA+ / TLC model checker | Adopt | 12 | 6 specs validated; 7 more with `.cfg` pending |
| Z3 SMT | Adopt | 1 | Pointwise axioms proved |
| Microsoft Z3 | Adopt | — | `Directory.Packages.props` |
| BenchmarkDotNet | Adopt | — | `bench/` |
| Semgrep | Trial | 12 | 12 rules; runs externally |
| CodeQL | Assess | 9 | SDL practice #9; workflow TBD |
| Stryker.NET | Trial | 10 | Mutation testing config shipped |
| Alloy | Assess | 10 | `tools/alloy/specs/Spine.als` |
| Lean 4 + Mathlib | Assess | 10 | Stub proof `proofs/lean/ChainRule.lean`; full proof 2-week P2 |
| pytm (threats-as-code) | Assess | 15 | P0 in BACKLOG |
| OWASP Threat Dragon | Assess | 15 | Visual fallback |
| Microsoft Threat Modeling Tool | Hold | 15 | Windows-only; parallels-only workflow |
| FsPickler | Adopt | 13 | Canonical F# pickler |
| Apache Arrow IPC | Adopt | 13 | `ArrowSerializer.fs` |

### Upstreams / prior art

| System | Ring | Round | Notes |
|---|---|---|---|
| Feldera (Rust DBSP) | Assess | 11 | Cloned `references/upstreams/feldera/`; apples-to-apples bench P1 |
| Materialize / Differential Dataflow | Assess | 11 | Cite for timely-dataflow multi-dim logical time |
| FASTER HybridLog (MSR) | Assess | 14 | Closest .NET-native prior art for our storage layer |
| TigerBeetle LSM-forest + DST | Assess | 14 | Inspiration for simulation testing |
| Datomic AEVT/AVET indexes | Assess | 14 | Inspiration for closure-table indexes |
| XTDB 2 bitemporal index | Assess | 14 | Temporal-query inspiration |
| Apache Iceberg / Delta Lake | Assess | 15 | Object-store table formats |
| SlateDB | Trial | 15 | CAS-manifest + writer_epoch pattern; borrow patterns; maybe crate dep |
| EventStoreDB / Kurrent | Assess | 11 | Typed outcome API shape inspiration |
| SpacetimeDB | Assess | 11 | WebSocket delta subscription model |
| Reaqtor / IQbservable | Assess | 11 | Bonsai slim-IR inspiration for persistent queries |
| Agent Laboratory | Trial | 15 | Lit-review phase for research threads |
| Sakana AI Scientist | Hold | 12 | RAIL license + GPU-only; workshop-tier output |
| Karpathy autoresearch | Hold | 14 | 200-LOC teaching scaffold; not a research pipeline |
| CockroachDB Parallel Commits | Assess | 15 | Related work for WDC paper |
| Aurora Cell Architecture | Assess | 15 | Related work for WDC paper |

### Hardware intrinsics / platform

| Target | Ring | Round | Notes |
|---|---|---|---|
| `Sse42.Crc32` (x86-v2+) | Adopt | 11 | `HardwareCrc.fs` |
| `AdvSimd.Crc32.Arm64` (Apple Silicon + ARMv8) | Adopt | 11 | `HardwareCrc.fs` |
| `System.Numerics.Vector<T>` auto-SIMD | Adopt | 11 | Merge paths |
| `Sse42.X64.Crc32` 8-byte path | Adopt | 11 | Checkpoint CRC |
| `Vector512` / AVX-512 | Assess | — | JIT-dispatched when available |
| NVMe atomic writes (AWUPF) | Assess | 15 | 512B atomic write = tear-free witness; needs careful barrier story |
| CXL persistent memory | Hold | — | No hardware; post-Optane |
| io_uring | Hold | 11 | No first-class .NET support; P/Invoke only |
| Apple Silicon `F_NOCACHE` | Assess | 15 | For O_DIRECT-equivalent; no managed wrapper |

## Usage

When adding a new technique / tool / upstream: add a row. When
upgrading from Assess → Trial → Adopt, note the round. When moving
to Hold, write the one-line rationale.
