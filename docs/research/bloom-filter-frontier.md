# Bloom-filter-adjacent sketches: the 2023-2026 frontier

Survey of 23 AMQ-adjacent structures, rated for (a) retraction
compatibility — the gating criterion for DBSP — and (b) space/time
vs. our shipped blocked + counting Bloom in `src/Dbsp.Core/BloomFilter.fs`.

## Findings table

| # | Technique | Citation | One-sentence claim | vs. blocked+counting Bloom | Retraction-native? | Space @ 1% FPR (bits/elem) |
|---|---|---|---|---|---|---|
| 1 | Cuckoo filter | Fan et al., CoNEXT 2014 | Fingerprints in cuckoo-hashed buckets; supports native deletes | Better for our use: deletes + smaller | **Yes** (tombstones, no counter saturation) | ~9 bits (vs. Bloom ~10) |
| 2 | Morton filter | Breslow & Jayasena, PVLDB 11(9) 2018 | Sparse compressed cuckoo blocks with per-block metadata | 1.3-2.5× faster cuckoo lookups, supports deletes | **Yes** (same as cuckoo) | ~8-9 bits |
| 3 | Xor filter | Graf & Lemire, JEA 2020 | 3-hash perfect-matching table; 23% over info-theoretic lower bound | Static-only; smaller but no inserts/deletes | **No** (immutable post-build) | ~9.8 bits |
| 4 | **Binary Fuse filter** | Graf & Lemire, JEA 2022 (arXiv 2201.01174) | Improved xor: within 13% of lower bound, 2× faster build | Strictly smaller for static sets | **No** (static) | ~9.1 bits |
| 5 | **Ribbon / BuRR filter** | Dillinger, Hübschle-Schneider, Sanders, Walzer — SEA 2022 (best paper) | Linear-system based retrieval; BuRR < 1% space overhead | Best-in-class space; slower build; static | **No** (static) | ~6.7 bits |
| 6 | Vector Quotient Filter (VQF) | Pandey et al., SIGMOD 2021 | SIMD-parallel Robin-Hood quotient filter; O(1) ops | Faster inserts than Morton; supports deletes | **Yes** (RS-fingerprint removal) | ~9 bits |
| 7 | **Counting Quotient Filter (CQF)** | Pandey, Bender, Johnson, Patro — SIGMOD 2017 | Rank-select variant with native counting | Integrated counting; fixes 4-bit saturation | **Yes** (multiplicity counts = Z-set weights) | ~8-10 bits + log |
| 8 | Adaptive Quotient Filter | Wen, Bender, Conway, Pandey, Singh — arXiv 2405.10253 (2024) | Mutates fingerprints after false positives to self-heal | Orthogonal; mitigates workload-adversarial FPR | Partial (reallocates) | ~10 bits |
| 9 | Deletable Bloom | Rothenberg, Macapuna, Verdi, Magalhães — IEEE Comm. Letters 2010 | Per-region collision markers | Smaller than counting Bloom, weaker correctness | **Partial** (only non-collided bits deletable) | ~11-13 bits |
| 10 | d-left Counting Bloom | Bonomi, Mitzenmacher, Panigrahy, Singh, Varghese — ESA 2006 | d-left hashing + fingerprints, ~half the bits of 4-bit CBF | Strictly smaller than our 4-bit counting Bloom | **Yes** (like CBF) | ~6-7 bits |
| 11 | Learned Bloom (LBF) | Kraska, Beutel, Chi, Dean, Polyzotis — SIGMOD 2018 | Learned classifier + backup Bloom | Only wins on learnable-structure sets | **No** (model retraining cost) | Workload-dependent |
| 12 | Sandwiched LBF | Mitzenmacher — NeurIPS 2018 | Bloom-before + classifier + Bloom-after, provably optimal LBF | Refines LBF; same retraction pain | **No** | ~10-40% smaller than LBF |
| 13 | Partitioned LBF (PLBF) | Vaidya, Knorr, Mitzenmacher, Kraska — ICLR 2021 | Partition by classifier score | Best LBF variant pre-2024 | **No** | 25-40% smaller than Bloom |
| 14 | Fast-PLBF | Sato & Matsui — arXiv 2410.13278 (2024) | O(N²k) → linear DP; up to 233× faster PLBF build | Makes PLBF practical for rebuilds | **No** (still model-bound) | Same as PLBF |
| 15 | Stable Learned Bloom | Liu, Zheng, Shen, Chen — PVLDB 2020 | LBF + stable Bloom for drifting streams, bounded FPR decay | Directly addresses stream drift | **Partial** (probabilistic eviction ≈ soft retract) | ~30% smaller than Bloom |
| 16 | Cascaded LBF | arXiv 2502.03696 (2025) | Optimal model-vs-filter size split with fast-reject | Latest LBF frontier; marginal wins | **No** | ~20% smaller than PLBF |
| 17 | Adversary-Resilient LBF | Bishop & Tirmazi — arXiv 2409.06556 (2024) | PRP/PRF-hardened LBF with provable adaptive security | Orthogonal: security not space | **No** | +ε for crypto |
| 18 | ChainedFilter | Li, Zhao et al. — SIGMOD 2024 | Chain-rule framework to compose filters losslessly | 99.1% smaller than LBF in combined mode | Depends on base | Near lower bound |
| 19 | Breadcrumb Filter | PACMMOD 2025 | Fully-featured filter (count, delete, merge, resize) | Direct superset of counting Bloom | **Yes** | ~8 bits |
| 20 | Maplets (abstraction) | arXiv 2510.05518 (2025) | Unified AMQ abstraction across CQF/cuckoo/etc. | Design-level, not a new filter | n/a | n/a |
| 21 | **Ceramist (verified)** | Tanaka, Murase, Regnier, Lu, Sergey — ITP 2020 / CAV 2021 | Coq proofs of Bloom, counting, quotient, blocked-AMQ | Orthogonal; ours has no proof | **Yes** (counting variant) | Proof of our math |
| 22 | Data-aware hashing | PVLDB 2022 | Exploit key distribution for tighter FPR | Orthogonal; stackable on blocked Bloom | Yes | 10-20% smaller |
| 23 | Bloom-set optimization | PVLDB 2024 | Budget allocation across collection of Bloom filters | Orthogonal; system-level | Yes | Collection-level wins |

## Radar decisions (round 18)

**Adopt.** `Bloom filters (blocked + counting)` — shipped in
`BloomFilter.fs` round 17, hot-path allocations removed round 18.

**Trial.** Counting Quotient Filter (CQF) — fixes our 4-bit
counter saturation (our `CounterSaturated` diagnostic admits
the limit). Variable-width counters grow into adjacent empty
slots. Peer-reviewed 8 years; widely implemented
(SplinterDB, Squeakr). Estimated port: 5-8 days.

**Assess.** d-left Counting Bloom (cheaper counting variant,
~½ memory), Ceramist (formal-verification bridge to Lean),
Binary Fuse / Ribbon-BuRR (static AMQs for frozen
partitions), Vector Quotient Filter (SIMD alternative to
CQF), ChainedFilter composition theory, Stable Learned Bloom
(only learned variant with drift-bounded FPR).

**Hold.**
- **Cuckoo / Morton filter** — deleting a never-inserted item
  produces a false negative, breaking DBSP's tolerance for
  `δ(x)=−1` on unseen `x`.
- **Xor / Binary Fuse filter** for hot path — static; hold for
  cold-tier only.
- **Plain Learned Bloom / Sandwiched / PLBF / Fast-PLBF / Cascaded
  LBF** — classifier retraining per retraction batch breaks
  streaming latency.
- **Deletable Bloom (Rothenberg 2010)** — silent false negatives
  on collisions; violates DBSP differential correctness. Hold
  permanently.

## The single most important upgrade

**Promote CQF from Assess to Trial in round 18.** Our shipped
counting Bloom saturates at 15 (4-bit cells). In Z-set arithmetic,
a bag element can legitimately have weight > 15 (self-joins,
count aggregations pre-projection). The shipped
`CounterSaturated` diagnostic admits this. CQF's variable-width
counters eliminate the failure mode entirely. Backlog has a P1
to port; TECH-RADAR row updated to reflect.

## Sources

- Binary Fuse Filters — arXiv:2201.01174
- BuRR filter — SEA 2022 (arXiv:2109.01892)
- Ribbon filter — arXiv:2103.02515
- Partitioned Learned Bloom — arXiv:2006.03176
- Fast Construction of PLBF — arXiv:2410.13278
- Cascaded Learned Bloom — arXiv:2502.03696
- Morton Filters — PVLDB 2018
- Cuckoo Filter — CoNEXT 2014
- Counting Quotient Filter — SIGMOD 2017
- Adaptive Quotient Filters — arXiv:2405.10253
- Vector Quotient Filter — SIGMOD 2021
- Deletable Bloom Filter — arXiv:1005.0352
- Stable Learned Bloom — PVLDB 2020
- Sandwiching Learned Bloom — arXiv:1803.01474
- Adversary-Resilient Learned Bloom — arXiv:2409.06556
- ChainedFilter — SIGMOD 2024
- Ceramist — github.com/verse-lab/ceramist (ITP 2020 / CAV 2021)
- Breadcrumb Filters — PACMMOD 2025
- Maplets abstraction — arXiv:2510.05518
- Data-aware hash functions for Bloom filters — PVLDB 2022
- Optimizing Collections of Bloom Filters — PVLDB 2024
