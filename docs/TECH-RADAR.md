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
| Residuated lattices | Adopt | 42 | `src/Core/Residuated.fs` — residuated-lattice IVM for non-invertible aggregates (`max`, `min`, bag-union). Graduated to Adopt in Round 42: the round-12 "O(1) amortised retraction" claim was false under adversarial retract-top workloads and was replaced in Round 17 (harsh-critic finding #3, see `docs/BACKLOG.md:286-289`) with a `SortedSet<'K>` + weight-dictionary representation where every op — Insert, Retract, MaxQuery — is **genuinely O(log k)** with no hidden linear-scan fallback. Implementation at `Residuated.fs:82-111`; regression coverage landed as part of the Round-17 Round17Tests.fs suite (471 tests passing at the time). Round-17 sibling fix (`docs/BACKLOG.md:290-293`) also closed the unbounded-integrated-history space bug. Two P0s closed, two test-pinned invariants, 25-round stability window — graduation on evidence, not aspiration. |
| FastCDC content-defined chunking | Adopt | 42 | `src/Core/FastCdc.fs` — Xia et al. USENIX ATC 2016 content-defined chunker (Gear rolling hash, normalised masking). Graduated to Adopt in Round 42: the round-13 O(n²) buffer-scan bug (harsh-critic finding #7, see `docs/BACKLOG.md:294-296`) was closed in Round 17 via a persistent `scanCursor` + persistent `hash` that Gear-hashes each byte **exactly once** across the chunker's lifetime, and the sibling per-chunk-allocation bug (`docs/BACKLOG.md:297-299`, harsh-critic #8) was closed by replacing `ResizeArray` byte-by-byte `Add` with a raw `byte[]` buffer + `Buffer.BlockCopy` append and chunk-extract. Implementation at `FastCdc.fs:101-204`. Paper throughput target 1-3 GB/s/core (`FastCdc.fs:36-37`); Round-17 Round17Tests.fs coverage pins the algorithmic fix. Two P0s closed, 25-round stability window — graduation on evidence, not aspiration. |
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
| Bloom filters (blocked + counting) | Adopt | 40 | Shipped in `src/Core/BloomFilter.fs` — blocked + 4-bit counting, XxHash128 Kirsch-Mitzenmacher double-hashing. **Engineering fundamental, not novel research**: Putze 2007 / Fan 1998 / Kirsch-Mitzenmacher 2006 are off the shelf. Graduated to Adopt in Round 40 on two measured-evidence halves (see `docs/research/bloom-bench-2026-04.md`): throughput ratio ≤ 1.08 across 10× N with zero managed allocation on every `Blocked*` hot path, and empirical FPR at 0.34× / 0.89× / 0.13× of the `p=0.01` target at N ∈ {10k, 100k, 1M} — well inside the 2× acceptance threshold. The FPR pass required fixing a bucket↔probe correlation in `addPair` / `testPair` (bucket index was drawn from the same low h1 bits that seeded the within-bucket probe sequence); bucket selection now uses `h1 >>> 32`. A disjoint-probe regression gate (`Blocked Bloom measured FPR stays within 2x of target p=0.01`) lives in `tests/Tests.FSharp/Sketches/Bloom.Tests.fs` and asserts the invariant at N=10k / 100k on every test run. |
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
| LiquidF# refinement types | Hold | 35 | Round-35 Day-0 evaluation terminated via stop-rule: tool dormant. No currently-maintained F#-native refinement checker exists; F7 (Microsoft Research ancestor) last shipped 2012. Off-by-one / bad-index coverage remains a gap — deferred to FsCheck + Z3 + Lean stack. See `docs/research/liquidfsharp-findings.md`. |
| F\* extraction to F# | Assess | 35 | Successor path after the LiquidF# Hold. F\* is actively maintained and can extract to F#; a 2-3 week PoC on `FastCdc.fs` is the proposed next move for the off-by-one / bad-index bug class. See `docs/research/liquidfsharp-findings.md` §"Path A". |
| Dafny / F* / Isabelle / Stainless / P#  | Assess | 18 | Enumerated in `docs/research/proof-tool-coverage.md`; each catches a different bug class. |
| Category theory as code-contract grammar | Adopt | 12 | `docs/category-theory/` |
| Semantic hashing | Assess | — | Hinton & Salakhutdinov — maps semantically similar documents to nearby binary-hash addresses. Proposed by Amara 8th ferry (PR #274) as real technical family for the "rainbow table" intuition; not the password kind. Candidate substrate for the provenance-aware-bullshit-detector research doc. See `docs/aurora/2026-04-23-amara-physics-analogies-semantic-indexing-cutting-edge-gaps-8th-ferry.md`. |
| Locality-sensitive hashing (LSH) | Assess | — | Charikar — formal collision framework where similarity drives hash agreement. Sibling to semantic hashing; complementary mechanism. Proposed by Amara 8th ferry for the semantic-canonicalization research doc spine. |
| HNSW (Hierarchical Navigable Small World) | Assess | — | Graph-based approximate nearest-neighbour index with logarithmic scaling + strong empirical performance. Candidate retrieval structure for the provenance-aware-bullshit-detector if a prototype lands. Proposed by Amara 8th ferry; `Trial` promotion contingent on prototype evidence. |
| Product quantization | Assess | — | Compressed vector search at scale; memory-efficient large corpora. Optional compression layer under HNSW / ANN retrieval. Proposed by Amara 8th ferry. |
| Quantum illumination (low-SNR sensing theory) | Assess | — | Lloyd 2008 + Tan et al. Gaussian-state 6 dB error-exponent advantage. Importable as **analogy for low-SNR software detection with retained-reference-path**, NOT as operational quantum-radar capability. 2024 engineering review (Amara 8th ferry) caps microwave QR range at <1 km typical — **Hold for long-range product claims**. Composes with SD-9 carrier-aware framing. See `docs/aurora/2026-04-23-amara-physics-analogies-semantic-indexing-cutting-edge-gaps-8th-ferry.md` §Quantum-radar-analogy-boundaries. |

### Tools / infra

| Tool | Ring | Round | Notes |
|---|---|---|---|
| FsCheck 3 property tests | Adopt | 1 | In CI |
| TLA+ / TLC model checker | Adopt | 12 | 6 specs validated; 7 more with `.cfg` pending |
| Z3 SMT | Adopt | 1 | Pointwise axioms proved |
| Microsoft Z3 | Adopt | — | `Directory.Packages.props` |
| BenchmarkDotNet | Adopt | — | `bench/` |
| Semgrep | Trial | 12 | 12 rules; runs externally |
| CodeQL | Trial | 34 | `.github/workflows/codeql.yml` landed (GitHub-default); tuning drift tracked in codeql-expert skill |
| Stryker.NET | Trial | 10 | Mutation testing config shipped |
| Alloy | Assess | 10 | `tools/alloy/specs/Spine.als` |
| Lean 4 + Mathlib | Assess | 10 | Stub proof `proofs/lean/ChainRule.lean`; full proof 2-week P2 |
| pytm (threats-as-code) | Assess | 15 | P0 in BACKLOG |
| OWASP Threat Dragon | Assess | 15 | Visual fallback |
| Microsoft Threat Modeling Tool | Hold | 15 | Windows-only; parallels-only workflow |
| FsPickler | Adopt | 13 | Canonical F# pickler |
| Apache Arrow IPC | Adopt | 13 | `ArrowSerializer.fs` |
| `.NET Aspire` (AppHost + ServiceDefaults + OpenTelemetry integrations) | Assess | 39 | Aaron 2026-04-20 ask: evaluate as .NET-native runtime-observability spine for the 4GS+RED+USE starting points. Time-budgeted ~3.5d research: feature scan -> Zeta fit (pure-library boundary) -> observability spine fit -> synthesis ADR. Prior art: Aaron's `../AspireApp1` Jan 2024 prototype. Must not leak into `Zeta.Core` public API (Ilyana gate). See `docs/BACKLOG.md` P1 ".NET Aspire evaluation". |
| `../scratch` declarative-bootstrap harness (package manifests per ecosystem, profile/category composition, mise-unified runtimes, docker reproductions of GHA runners) | Assess | 39 | Named ethos-reference in two P1 BACKLOG entries (env-parity + CI meta-loop) without explicit pattern-inheritance contract. Time-budgeted ~1.5d research pass to classify patterns (already-in-Zeta / worth-porting / scratch-specific / flow-other-way) and produce `docs/research/scratch-zeta-parity.md`. See BACKLOG P1 "`../scratch` ↔ `Zeta` declarative-bootstrap parity". |
| Declarative environment-parity stack (Argo CD / Flux / Kustomize / Helm / Pulumi / Crossplane / Tilt / Skaffold / Okteto / KCL / CUE / OPA-Gatekeeper / Kyverno candidates) | Assess | 39 | **Time-budgeted research pass.** Aaron 2026-04-20 ask: same declarative spec valid from dev-inner-loop (kind) through qa/dev/stage/prod, non-bespoke. Budget: 7 days split 1d landscape scan -> 3d shortlist deep-dive -> 2d env-parity finalist evaluation -> 1d synthesis ADR. Individual tools graduate to Trial/Adopt/Hold per finalist evaluation. See `docs/BACKLOG.md` P1 "Declarative parity across dev-inner-loop / qa / dev / stage / prod" for the scope; sibling P1 entry on CI meta-loop + retractable CD. |
| bun + TypeScript (post-setup scripting default) | Trial | 43 | Round-43 adoption for post-`dotnet`-setup scripting. Replaces bash-per-script drift (the round-43 `tally.sh` pivot exposed the cost). First in-tree artefact: `tools/invariant-substrates/tally.ts` (bun Glob + `node:fs/promises`, no third-party runtime deps). Scaffold: `package.json` (pinned `bun@1.3.13`, bun-runtime only — `"type": "module"`, no `tsx`/`ts-node`), `tsconfig.json` cranked-to-11 (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` + `erasableSyntaxOnly` + `isolatedModules` + `noImplicitOverride`), `eslint.config.ts` strict-type-checked + stylistic-type-checked + sonarjs + `reportUnusedDisableDirectives`, `prettier` + `prettier-plugin-toml`, `markdownlint-cli2`. Excludes hardened across `tsconfig.json` / `bunfig.toml` / `eslint.config.ts` / `.prettierignore` to skip `references/upstreams/**` (~13 GB), `tools/lean4/.lake/**` (~7 GB), `tools/alloy/**`, `tools/tla/**`, `**/BenchmarkDotNet.Artifacts/**`, `**/TestResults/**`, `**/artifacts/**`, `**/bin/**`, `**/obj/**` — SQLSharp lesson: missing the upstream allowlist destroyed language-server perf until the `defaultRepoPathIgnorePatterns` helper shape was adopted. Latest-version audit done at ADR time (`docs/DECISIONS/2026-04-20-tools-scripting-language.md` §Latest-version audit). **Watchlist** (rails for the assumptions): (a) bun on Windows-from-source still maturing — Zeta maintainers are macOS/Linux today, re-audit if Windows becomes a CI target; (b) `erasableSyntaxOnly` presumes bun runs `.ts` without JS emit — re-audit if bun ever ships a JS-compilation pass; (c) `@types/bun 1.3.12` lags the `bun@1.3.13` runtime by one patch (DefinitelyTyped lag, not a bug), exception tracked inline in ADR. Graduates to Adopt once (1) a second in-tree `.ts` script lands, (2) no watchlist triggers fire for 5 rounds, (3) tally.ts + at least one other tool are invoked on round-close. |
| Substrait (cross-language serialised relational-algebra plan format) | Assess | — | Answers a real P2 gap named in Amara 8th ferry (PR #274): Zeta's persistable query IR (IQbservable / Reaqtor-style Bonsai slim IR) sits at P2 only; Substrait + DataFusion Substrait-serde already exist. Strategic question — repo-local Bonsai vs Substrait interop target. **Stronger `Assess`** per 8th ferry (not `Trial` yet; 7-day research-pass scope like the declarative-env-parity row). Cross-reference Amara's cutting-edge-gaps catalogue. |

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
| DORA 2025 — State of AI-assisted Software Development + AI Capabilities Model | Assess | 39 | Two companion PDFs at `docs/2025_state_of_ai_assisted_software_development.pdf` + `docs/2025_dora_ai_capabilities_model.pdf`, CC BY-NC-SA 4.0. Seven-capability amplifier frame; Zeta maps strong on 3-4, partial on 2-3, in-flight on platform-engineering (= tonight's P1 CI-meta-loop + env-parity). Nyquist stability citation (any control system must operate at ≥ 2× the speed of the system it controls) is the theoretical anchor for the retractable-CD backlog entry. Gene Kim foreword; 5000 respondents; "trust but verify" (30% dev distrust of AI code) names the mature-adoption stance aligned with Zeta's honesty-protocol architecture. |

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
