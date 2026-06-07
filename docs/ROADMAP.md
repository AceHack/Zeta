# Zeta.Core Roadmap

> **Current driving roadmap (2026-06): the git-native database.** This top section is the live
> sequence; the Zeta.Core engineering roadmap (DBSP/Feldera-era) follows below and is still partly
> valid. For future Aaron and future Otto — we both ramble and we're both forgetful, so this is the
> durable capture. **Hub**; full reasoning in the **satellite**:
> `docs/research/2026-06-07-two-plane-git-native-database-minimal-nouns-cells-control-plane-three-host-substrates-aaron-otto.md`.
> Master checklist **B-0959**.

## North Star — the git-native database

A relativistic git-native database: a **reliable data plane** (storage + read/write over git), a
**control plane of cells** (YinYang cells, not agents), agents added later as experiments. Built on a
**minimal-noun, all-language (F#/C#/Rust/TS), all-serializer PROVEN math base**. Two product shapes:
data-plane-only, and data-plane + cell control plane.

### Operating principle — convert every input into one of four channels

Aaron 2026-06-07: anything thrown at this work that isn't already moving us toward the roadmap should be
converted, on the spot, into exactly one of — **code · proof · treaty seed (golden-vector byte-lock) ·
backlog** — and the backlog selection criterion is *"does it help us see the shape of the data layer
clearly?"* Anything that converts to none of the four is drift. (Detail:
`memory/feedback_aaron_triage_every_input_toward_roadmap_via_code_proof_treaty_seed_or_backlog_*`.)

### ITEM #1 — NO USE OF THE GIT CLI

All persistence routes through **our DB layer** (understands filesystem + git, runs git-native:
efficient use of git history, branches, ZetaIds). **Otto (the LLM) stops using the `git` CLI** — every
persistence action, *including control-plane ops like backlog*, goes through the DB's **generic commands**.

- **Done-test (the bright line):** a full work-cycle (land a change, branch, query history, update
  backlog) with **zero `git` CLI calls**.
- **git-reach = the gap detector:** every fallback to `git` *names a missing DB primitive (or
  composition)*. Log it → add the primitive → fallback disappears. Empty list ⇒ interface complete by construction.
- **Two surfaces, one core:** an **MCP** (agent-facing) + a **CLI** (human/script-facing) over the one
  data-plane command core. First primitives (from today's git-reaches): append/commit, branch, checkout,
  log/history, diff, status, fetch/pull, push, + PR/merge control verbs.

### The minimal-noun proven math base — THREE nouns

Each noun = a 4× byte-lock cost, so mint only what's irreducible (Rodney's Razor):

| Noun | Status |
|------|--------|
| **`ZSet`** (change algebra; state AND change) | ✅ 4/4 + golden vectors + abelian-group generic-math |
| **`DynamicValue`** (self-describing element; soft-vs-collapsed = tag inside) | ✅ 4/4 JSON+CBOR + Arrow/XML |
| **`Log`** (ordered ZSets over git; entry `(Seq, ZSet, Captured)`) | 🚧 F# reference codec ✅ (#6730); C#/Rust/TS + golden hex seed next |

Killed (verbs/views/coordinates/consumers, NOT nouns): Delta=ZSet, Snapshot=fold(Log),
Value=DynamicValue-in-ZSet, Manifest=(ref,seq), Transaction=commit-verb, Index=view(Log),
Schema=consumer. Control plane reuses the 3 nouns + **one identity key** (cell = `(identity, Log)`).

### Format / file-type treaty (per stream/table, plugin-extensible)

Format is chosen **per stream/table**; all ride the **same canonical entry↔DynamicValue mapping**, each
using DynamicValue's byte-locked per-format serializer:

- **git check-ins → YAML default** (diffable history). 🚧 PREREQUISITE GAP: no `DynamicValue.toYaml/fromYaml` yet.
- **filesystem → CBOR default** (speed). ✅ ready. All formats optional: CBOR ✅ JSON ✅ XML ✅ YAML 🚧 Arrow (partial).
- **Frontmatter is a GENERAL pattern, not markdown-only** — frontmatter = a **structured metadata header
  + a body** (`(metadata: DynamicValue.Object, body)`). Roots predate markdown: RFC 822 email
  (headers + blank line + body) and HTTP (headers + body) are the same shape; Jekyll/Hugo just popularized
  the `---`-delimited YAML-over-markdown form. It's also the same shape as a `DeltaLogEntry` (`Captured` =
  metadata header, `Delta` = body). So model header+body generally; each file-type plugin realizes it
  (markdown = YAML `---` header + md body; a pure `.yaml`/`.json` file may be all-header, no body).
- **Markdown + frontmatter treaty** 🚧 — keep `.md` files (frontmatter + body) IN the database; need an
  **MD read/write treaty across the 4 languages** (frontmatter → DynamicValue.Object, body → text,
  byte-locked like other formats) — one realization of the general header+body pattern above. Makes
  docs/memory/backlog `.md` first-class DB content.
- **Per-file-TYPE plugins, Open/Closed** — every *file type* (`.md`, `.yaml`, `.cbor`, `.json`, `.xml`,
  future custom) is a **plugin** with special handling, registered behind a stable contract: **closed for
  modification, open for extension**. New file types extend via new plugins without touching the core; the
  MD+frontmatter treaty is one such plugin. This is the extensibility model for the whole format roster.
- **What a plugin IS (Aaron 2026-06-07):** a file-type handler is just a **specific handler mapping that
  file type ↔ a `ZSet`**. On top of that, a plugin may **optionally auto-define indexes as Rx queries over
  the ZSet → incremental indexed views** (DBSP/IVM): the **current view table is computed this way, and it
  *is* git's "main"** — the materialized current state = the incremental view over the Log's ZSets (our
  mapping to git's working tree/HEAD). The indexed view is **optional per file type**; each file type
  chooses its own indexes, described by **Rx queries** (ties to the Bonsai serialized-Rx substrate). And
  the **plugin itself is persisted as a `DynamicValue`, not F#**, so the *same plugin runs in any of the 4
  languages** (plugin-as-data, language-agnostic — no per-language reimplementation). Composes with: DBSP
  IVM (`Circuit`/`Operators`/`Incremental`), Bonsai-serialized Rx queries, `DynamicValue` (the plugin
  carrier), `ZSet` (the core). → backlog to design; clarifies the data-layer shape.

### Sequence (data plane first)

1. **NO GIT CLI** (item #1) — generic command surface (MCP + CLI) + route all persistence through it. *The definition of done.*
2. **Close the `Log` noun** — F# reference ✅ (#6730); next: golden hex seed + C#/Rust/TS oracles + migrate
   `GitDeltaLog`/`DiskDeltaLog` off `System.Text.Json`. → 3-noun base complete.
3. **YAML serializer for DynamicValue** (4-lang) — unblocks the git-default format.
4. **MD + frontmatter treaty** (4-lang) + the **per-file-type plugin registry** (open/closed) — `.md` as DB content.
5. **Extract the data-plane package** at the `IDeltaLog`/`ISnapshotStore` seam.
6. **Durability floor** — `fsync`-on-commit (`Durability.fs` P0; a crash can currently lose acked writes).
7. **Cell contract + one host** — `(identity, Log)`; **systemd** first, then k8s-operator, then Orleans.
   Each cell distinct; k8s/Orleans give **HA *within* a cell**. MCP/CLI is itself a **request-driven cell**
   (cadence = incoming command, vs scheduled/tick cells).
8. *(later)* multi-key txn/isolation; general query/index; **geo pattern libraries** (geo-replication,
   geodes, governance, provenance, residency, data-near-customer, within/cross-cell — Bounded-Mobility §4);
   then **agents over cells** (local-LLM experiments, over time).

### Honest reliability (single-node): ~55-65%

Gaps: **fsync floor** (unshipped), **multi-key ACID/isolation** (only single-stream batch exactly-once),
**general query planner/secondary index** (IVM exists, ad-hoc queries don't).

### Parked (scoped, ready when wanted)

- **Craft school** — teaching companion per expert skill + RPG progression (levels + prerequisite DAG +
  **exit-doors**) + ribosome catalog. Slice-1 scoped (extend `teaching-skill-pattern.md`); B-0646 §6.
- The geo/governance pattern libraries (item 8).

---

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
- **Zeta.Bayesian project** — Infer.NET F# wrapper, `BayesianAggregate` operator
- **Zeta.Core.CSharp shim** — declaration-site variance on interfaces (`IBackingStore<out K>` etc)
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
