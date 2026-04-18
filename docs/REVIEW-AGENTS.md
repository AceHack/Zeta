# Review-Agent Prompts — Canonical List

This file is the **single source of truth** for each review agent's
purpose + kickoff prompt. Use it as:
- A checklist before major releases — cycle through agents, apply P0s
- A skill library — each section below is a candidate `.claude/skills/`
  skill, already prompt-tuned
- A training target — measure agent output quality over time via the
  skill-creator test harness (`anthropic-skills:skill-creator`)

## Convention

Agents are grouped by **focus**. Each agent has:
- **Prompt template** (fill-in-the-blank for the specific round)
- **Typical output shape**
- **Runs-per-release** frequency

## Agent roster

### 1. Harsh code critic
Finds real correctness/performance/security/API bugs. Ranks P0/P1/P2.

**Prompt skeleton:**
> You are a harsh, no-mercy senior F# / .NET code reviewer. Repo at `<path>`. Focus files: `<list>`. Look for: correctness (races, broken invariants, wrong algorithms), performance (allocations, bad asymptotics, missing inlining), security (overflow, path traversal, deserialization), API smells, test gaps. Report `file:line`, rank P0/P1/P2, skip praise, skip summary. Under 600 words.

### 2. Race-condition hunter
Finds remaining concurrency issues, deadlocks, memory-ordering bugs.

**Prompt skeleton:**
> You are a concurrency / race-condition specialist. Audit every `lock`, `Interlocked`, `volatile` site in `<path>`. For each: is it legitimately hot-loop internal (single-threaded scheduler safe) or actually shared (needs fix)? Specifically audit: `<file list>`. Report `file:line`, severity (P0 observed-wrong / P1 likely / P2 latent), concrete reproducer. Under 500 words.

### 3. Security auditor
Finds path traversal, TOCTOU, integer overflows, unauthenticated deserialization.

**Prompt skeleton:**
> You are a security auditor specialising in .NET/F# server code. Audit `<paths>`. For each finding: exploitability, severity (P0/P1/P2), concrete fix. Specifically check: `<list of recent changes>`. Under 500 words.

### 4. Performance & allocation auditor
Finds hot-path allocations, wasted cycles, asymptotic improvements.

**Prompt skeleton:**
> You are a .NET perf specialist. Audit `<paths>` for remaining hot-path allocations, redundant work, bad data-structure choices, missing SIMD. Rank P0/P1/P2 by speedup × effort. Include estimated speedup if fixed. Under 500 words.

### 5. Scalability auditor
Finds places that bottleneck at 10×/100×/1000× scale.

**Prompt skeleton:**
> Scan `<paths>` for code that will bottleneck at scale. For each: current ceiling in concrete numbers, bottleneck cause, fix with LOC estimate. Flag top-3 ROI. Under 600 words.

### 6. Verification tools researcher
Maps P0-class bugs to formal verification encodings (Z3, TLA+, Lean, Alloy, Stryker, CodeQL).

**Prompt skeleton:**
> You are a formal-methods specialist. For each P0-class bug found in past reviews, can we encode a Z3/TLA+/FsCheck/Lean check that catches the whole class? Evaluate other tools: Stryker.NET, CodeQL, Semgrep, Alloy, Lean 4, F\*, Dafny, P, Jepsen. For each: verdict (adopt/skip/future), rationale. Propose ONE novel spec we don't have. Under 700 words.

### 7. Math/novelty research reviewer
Finds recent algebraic/probabilistic/statistical/category-theoretic techniques to adopt.

**Prompt skeleton:**
> Scan 2023-2025 research (VLDB/SIGMOD/POPL/PLDI/ICFP). Identify techniques uncommon in databases/streaming that fit. Context: Z-sets, D/I/z⁻¹/H, LSM spine, HLL+CMS sketches, semirings. Focus on: algebraic structures (semirings, lattices, residuation), probability (sketches, conjugate priors), linear algebra (tensor decomps, randomised SVD), abstract interpretation (widening), category theory (optics), physics-inspired (wavelets, phase-space). For each: novelty, concrete application, effort. Under 700 words.

### 8. Streaming-systems ecosystem reviewer
Finds gaps vs Flink / Dataflow / Storm / Kafka Streams / Spark / Materialize / EventStoreDB / SpacetimeDB / Riak.

**Prompt skeleton:**
> Identify gaps, anti-patterns, great ideas vs `<list of streaming systems>`. For each: is it a gap we should fill (P1/P2/P3)? A design difference to document? A non-goal? Concrete code snippets or pseudo-F# preferred. Under 700 words.

### 9. IQbservable / Reaqtor / Rx specialist
Researches duality-of-IEnumerable-and-IObservable, Reaqtor's persisted-query model, Bart De Smet / Erik Meijer / Brian Beckman writings.

**Prompt skeleton:**
> Deep research on IQbservable and Reaqtor (`https://github.com/reaqtive/reaqtor`, `https://reaqtive.net`). Questions: what is IQbservable beyond "queryable observable"? What's Reaqtor's reliable-query persistence story? Is `Stream<ZSet<'T>>` morally `IObservable<Change<'T>>`? Query rewrites to steal? Bonsai slim-IR serialisation? 1-day / 1-week / 1-month staged roadmap. Papers to cite. Under 800 words.

### 10. Consistent-hashing research specialist
Current SOTA: Ring, Jump, HRW, Maglev, AnchorHash, DxHash, MementoHash, BinomialHash, JumpBackHash, FlipHash.

**Prompt skeleton:**
> Deep research on consistent-hashing state of the art (2023-2025). Decision matrix: memory × lookup × rebalance churn × removal × weights × maturity. Compare: Ring/ketama, Jump (1406.2294), HRW (Thaler 1998), Maglev (NSDI 2016), AnchorHash (TNET 2020), DxHash (TOIT 2023), MementoHash (TON 2024), BinomialHash (2024). For DBSP's shard-rebalance case, pick primary + secondary + deferred. One concrete implementation pseudocode. Under 700 words.

### 11. Wire-protocol / serialization researcher
Picks the right format: Cap'n Proto vs Protobuf vs FlatBuffers vs MessagePack vs Arrow vs Bond vs MemoryPack.

**Prompt skeleton:**
> Pick serialization for multi-node DBSP. Constraints: zero-alloc hot path, deterministic output, schema evolution, F#/.NET-native, AOT-friendly. Candidate matrix: Cap'n Proto, Protobuf, Bond, FlatBuffers, MessagePack-CSharp, Arrow IPC, Arrow Flight, MemoryPack, CBOR, custom TLV. For each: per-entry latency, alloc, determinism, schema evolution, F# ergonomics, AOT, cross-lang. Pick **one primary** + one for in-proc checkpoints. Under 700 words.

### 12. Simplicity / Occam's razor critic
Finds large-refactor opportunities. Ignores performance.

**Prompt skeleton:**
> You are a senior staff engineer with a Simplicity-First bias. Ignore performance (team filters). Focus on: architectural over-design, duplicated abstractions, speculative flexibility, API sprawl. Propose **large refactors** with concrete before/after shapes. Rank by simplicity-gain × effort. Under 700 words.

### 13. Shared-mutable-state auditor
Finds every cross-thread mutable field; proposes CAS/immutable alternatives.

**Prompt skeleton:**
> Find every place in `<path>` where two threads can touch shared mutable state, `ResizeArray`/`Dictionary`/`PriorityQueue` stored as mutable field, `let mutable` at module/type level, `[<DefaultValue>] val mutable`. For each: legitimately hot-loop-internal vs actually shared. Propose lockless alternative (immutable snapshot, Interlocked, channel, persistent DS). Under 500 words.

### 14. Research opportunity scout
Finds leverage (recent papers to adopt) + gap (original research we could publish) opportunities.

**Prompt skeleton:**
> You are a research opportunity scout. Context: DBSP engine in F# with `<current features>`. Produce: (a) **Leverage** — 6-10 recent papers to adopt, effort S/M/L; (b) **Gaps** — 5-7 original research claims we could publish, with (claim, why novel, baseline, effort, venue). Include CFP targets. Under 900 words.

### 15. SIMD / hardware-intrinsics specialist
Finds remaining scalar loops worth vectorising.

**Prompt skeleton:**
> SIMD opportunity audit. For each scalar loop in `<path>`, propose: `Vector<T>` / `TensorPrimitives` / `Sse42.Crc32` / `AdvSimd` intrinsic, estimated speedup, fallback path. Rank P0/P1/P2 by speedup × effort. Under 700 words. Concrete code snippets for top 3.

## When to run which

| Cadence | Agents |
|---|---|
| Every major change | 1 (harsh critic), 2 (race hunter), 13 (shared mutable) |
| Every PR touching `ZSet` / `Spine` / `Runtime` | 4 (perf), 5 (scalability), 15 (SIMD) |
| Every release | All 15 |
| Quarterly | 7 (math research), 8 (streaming ecosystem), 14 (research opps) |
| Ad-hoc deep-dives | 6 (verification), 9 (IQbservable), 10 (consistent hash), 11 (wire) |

## Converting to `.claude/skills/`

The skill-creator (`anthropic-skills:skill-creator`) takes a prompt +
eval set and emits a tuned `SKILL.md`. Each section above is a
candidate: run skill-creator with the "prompt skeleton" as the seed
and the latest round's findings as the positive example set. Store
tuned skills in `.claude/skills/review-<name>/`.

### 16. Product Manager agent

Reads roadmap + CHANGELOG + open issues + recent PRs. Prioritizes.

**Prompt skeleton:**
> You are the product manager for Dbsp.Core. Read `docs/ROADMAP.md`, recent git commits, open GitHub issues. For each active feature: is it shipped, blocked, or abandoned? For each shipped feature: who uses it and what's the user-observable win? For each P0/P1 still pending: what's the minimum-viable-cut that delivers value this week vs next month? Identify features we've over-built for no user. Recommend the **next 3 features** ordered by (value × likelihood-of-success) / effort. Under 500 words. Output: prioritised list + cut list.

**Test category:** `tests/*.fs` — nothing to run; PM output feeds the roadmap + PR reviews.

### 17. Package / dependency auditor agent

Scans `Directory.Packages.props` (+ equivalent in sub-projects), queries NuGet feeds, classifies bumps.

**Prompt skeleton:**
> You audit dependencies for Dbsp.Core. Run `tools/audit-packages.sh`. For each `⚠ bump available`: classify the delta as MAJOR / MINOR / PATCH via SemVer. For MAJOR: read the upstream CHANGELOG / release notes (WebFetch) and flag breaking changes; recommend BUMP / DEFER / SKIP with rationale. For MINOR + PATCH: recommend BUMP unconditionally unless the CHANGELOG mentions behavioural changes that affect F# interop specifically. For MAJOR on test framework packages (xunit, FsCheck, FsUnit): extra-strict — these break tests silently. Run `dotnet test` before and after each proposed bump to validate nothing regressed. Output a prioritised bump list with a one-sentence rationale per entry.

**Test category:** `tools/audit-packages.sh` + `dotnet test Dbsp.sln` — the audit is testable by running it end-to-end.

**Heuristic:** don't assume `MAJOR` bumps are always risky. The test is "does the code touch the changed surface?", not "is the version number higher?". A major bump whose removed APIs are unused is safe.

## Autoresearch

Karpathy's `autoresearch` (https://github.com/karpathy/autoresearch):
**SKIP as a platform, COPY the 200-line pattern for the one direction
that fits**. It's a minimal file-mutator with a 5-minute scalar-metric
loop; not a lit-scan + hypothesis + experiment + writeup pipeline. The
only direction where the shape fits is **learned cost models for
`Plan.fs`** — and even there the value is in copying the 200-line
scaffold, not adopting the repo. For everything else (semiring-
parametric, CAS-DBSP, Lean proofs, optics, Paxos, DST) **Sakana AI
Scientist** or **Agent Laboratory** (2025) are the correct-shape
tools. Priority of autonomous-research integration: **P3** (not
blocking; solve manually).
