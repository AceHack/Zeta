# Substrate-Discovery via Zeta-Native-AOT — Scoping 2026-05-03

Scope: scoping doc for the custom substrate-index the human
maintainer 2026-05-03 named (*"we should use zeta in native
assmly mode for our custom index i think"*) and the architect's
authority-scope decision that Zeta-native-AOT IS the best
long-term solution (rather than TS+sqlite-vec, live-off-the-
land, or hybrid).

Attribution: factory architect; the human maintainer 2026-05-03
provided the directional input + the edge-runner reframe
(*"changing the engine while driving sounds like edge runner
tertitory"*).

Operational status: research-grade

Non-fusion disclaimer: scoping-only. No code lands in this
PR. Deliverables: indexed types, query workloads, operator
mapping, NativeAOT deployment shape, migration plan, risk
register. Implementation lands in subsequent bounded PRs.

---

## Why Zeta-native-AOT (load-bearing decision)

Three reasons override the classical-PM defer-the-dogfooding
default:

1. **The workload IS Z-set algebra by definition.** A
   substrate index consumes a stream of `file-add` /
   `file-remove` / `file-modify` events. That's a Z-set
   delta-stream. Using TS+sqlite or a hand-rolled index
   leaves the strongest match on the table. Zeta's
   `IndexedZSet.fs` + `Incremental.fs` + `Operators.fs` are
   the primitives.

2. **NativeAOT validates a deployment story we already
   need.** Cron / CI / agent-loop ticks all want fast
   startup. Validating NativeAOT on substrate-discovery is
   the cheapest first try (no production-user impact); the
   validated deployment story then becomes available for
   every other tool that needs it.

3. **Pre-v1 dogfooding is HIGHER leverage than deferring.**
   Per the 2026-05-03 math-proofs honest assessment, the core
   algebra is A-grade verified (Lean + Z3 + 5 TLA+ specs). The
   API surface needs real-world exercise, not deferral.
   Edge-runner discipline (the human maintainer 2026-05-03)
   says ship the dogfood.

**Updated 2026-05-03** (post-#1385 merge corrections from
the human maintainer). Two epistemic-discipline corrections
re-grade the original framing:

### Correction 1 — chat is an assertion-channel, not a fact-channel

The maintainer 2026-05-03 verbatim: *"when i speak i'm
making assertions, that's the best way to describe this
chat channel."* Chat-claims (his OR the architect's) are
assertions; they need evidence to be elevated to
architectural fact. The architect's failure mode in #1385:
echoed the maintainer's *"maybe"* on live-off-the-land back
as an architectural fact. Push-back-with-evidence is the
discipline.

### Correction 2 — alternatives are complementary, not exclusive

The maintainer 2026-05-03 verbatim: *"i like hybrid for
verification duckdb is very advanced too and we want a lot
of its features we can verify against it behavior too, we
don't want to copy it's code at all we are very differnt
but it has some awesome feature."* The original "rejected"
framing was too binary.

### Re-graded architecture (with evidence labels)

| Layer | Status | Evidence base |
|---|---|---|
| Zeta-native-AOT canonical index | **Decision (architect, within authority)** | Algebra match (fact: workload IS Z-set); dogfood-leverage (assertion, supported by math-proofs A-grade); deployment story (hypothesis pending Phase 0 PoC) |
| DuckDB as verification oracle | **Assertion (maintainer 2026-05-03), worth pursuing** | DuckDB feature-richness (fact, well-known); cross-check-as-property-test pattern (precedent: Lean cross-checks paper); pattern extends to git per maintainer 2026-05-03 (*"some compabilty testing you do with duck you can do with git to slowly replace that"*) — composes with existing `memory/feedback_git_interface_wasm_bootstrap_zero_requirements_2026_04_24.md` architectural commitment (Zeta IS git client+server; native F# impl; two-UI Frontier+Mode-1-admin+WASM-Mode-2; both zero-install). |
| Live-off-the-land for harness-loaded surfaces | **Hypothesis pending research** | Maintainer said "maybe"; zero observed-behavior evidence; falsifiable via canary test + skill-persona behavioral observation |
| Distribution feasibility (NativeAOT single-binary) | **Make-or-break risk per maintainer assertion** | Need cross-platform empirical test (linux-x64 / osx-arm64 / win-x64); known-unknown |

### Push-back: what would establish the live-off-the-land hypothesis?

The current claim has zero evidence base. The maintainer's
"maybe" is directional input, not data. Concrete falsifiable
tests:

1. **`.claude/rules/` auto-load canary** (fixture exists at
   `.claude/rules/test-canary.md`): does a fresh Claude Code
   session in this repo see the canary string without being
   told to read the file? Pass = harness-native loading
   covers some of the substrate-discovery problem; fail =
   it doesn't, and the live-off-the-land path needs work.

2. **Skill-persona behavioral observation:** Do existing
   skill personas (.claude/skills/<name>/SKILL.md) actually
   succeed at finding what they need with `Skill` router +
   grep + glob alone, or do they regularly fail / reach for
   substrate that isn't router-discoverable? Measurable by
   reading skill execution logs (if they exist) or
   instrumenting one tick to log every `Skill` invocation
   and its outcome.

3. **External-PR-reviewer behavioral observation:** External
   review agents (`/ultrareview`, automated PR reviewers)
   either find what they need or they don't. Observable on
   recent PR review threads; we can sample the last ~50
   review comments and classify "agent had context to
   answer" vs "agent missed context that lived in
   substrate".

Until at least one of these tests produces data, "live-off-
the-land for harness-loaded surfaces" is a hypothesis to be
tested, NOT an architectural decision to be encoded. Phase 0
PoC scope expanded: include ONE of the three tests above as
prerequisite evidence before building the substrate-
discovery layer that would integrate with live-off-the-
land.

### Distribution feasibility — existing AOT core + JIT plugin architecture

**Updated 2026-05-03** (the human maintainer): the dual-mode
framing in this doc was reinventing existing prior art. *"we
already have a AOT core that can load JIT plugins see the
Baseyan."* Verified in repo: `src/Bayesian/Bayesian.fsproj`
line 9 explicit comment — *"Explicitly NOT AOT-enforced —
this is a plugin. Core stays AOT-clean."* — and the project
description *"Opt-in: this project doesn't enforce
PublishAot=true because it may optionally use Infer.NET,
which depends on reflection-emit."*

The actual architecture (already shipping):

- **Zeta.Core** (`src/Core/Core.fsproj`) = AOT-clean library.
  Includes `PluginApi.fs` (`IOperator<'TOut>` plugin-author
  contract, `OutputBuffer`, `StreamHandle`) and
  `PluginHarness.fs` (test harness for plugin operator
  authors). Contains `IndexedZSet.fs`, `Incremental.fs`,
  `Operators.fs` — the substrate-discovery primitives.

- **Plugin projects** (`src/Bayesian/`, future
  `src/SubstrateDiscovery.Plugins.*/`, etc.) = separate
  fsproj files that reference Zeta.Core, implement the
  `IOperator<'TOut>` contract, and are **not** AOT-enforced
  so they can use reflection-heavy libraries (Infer.NET for
  Bayesian, future DuckDB.NET for the verification oracle,
  etc.).

For substrate-discovery, this means:

- The CORE indexing / query engine ships AOT-published as
  `Zeta.SubstrateDiscovery` (small binary, fast startup,
  zero-install for external agents).
- Reflection-heavy or library-dependent extensions (DuckDB
  cross-check oracle, future ML-driven similarity scoring,
  etc.) ship as separate JIT plugin assemblies that the AOT
  core loads on demand.
- The `IOperator<'TOut>` contract is stable across the AOT
  / JIT boundary; plugins compose into the same circuit
  evaluator the AOT core runs.

This means the maintainer's *"zero-install external-agent
delivery"* use case is met by the AOT core alone. Plugins
ship separately when needed. No need to bundle the entire
Zeta + DuckDB.NET stack into a single binary.

The maintainer's epistemic position remains honest: *"i
just don't know whats possiible with distribution that's
what makes or breaks it."* Distribution feasibility is the
load-bearing empirical question. Phase 0 PoC's **primary
deliverables** validate the existing AOT-core-plus-JIT-plugins
architecture extends cleanly to substrate-discovery:

- Build a minimal `Zeta.SubstrateDiscovery` AOT-clean
  library that consumes Zeta.Core; publish AOT on
  linux-x64, osx-arm64, win-x64
- Measure binary size + cold-start latency on each platform
- Run a non-trivial Zeta query end-to-end on each platform
- Optionally: build a sibling `Zeta.SubstrateDiscovery.DuckDB`
  JIT plugin that the AOT core loads on demand for the
  verification-oracle path
- Document any AOT compatibility issues encountered

If the AOT core publishes cleanly on all three platforms,
the zero-install external-agent delivery use-case is met.
If AOT has compatibility issues for some Zeta.Core
dependency, the rethink is *narrow* (which dependency, can
it be moved to a JIT plugin, can the AOT-clean subset be
extracted) — not a wholesale re-architecture, because the
AOT-core-plus-plugins pattern is already shipping in
Zeta.Bayesian.

**This is the load-bearing question.** No substantial
commit beyond Phase 0 PoC until this question has data.

### DST integration — load-bearing, not afterthought

**Updated 2026-05-03** (the human maintainer reminder *"i'm sure
you remember all the DST goodness right?"*). Deterministic
Simulation Testing (Otto-272 DST-everywhere + Otto-273
seed-lock-policy + Otto-281 DST-exempt-is-deferred-bug) is
load-bearing for substrate-discovery, not a follow-on. The
PoC includes DST primitives from day 1 because:

1. **Cold-start replay = warm-state IVM** is the central
   correctness invariant. Rebuilding the index from
   `git ls-files | feed-into-zeta` must produce the
   IDENTICAL Z-set state to the live IVM. This is a DST
   equivalence property — encoded as a CI invariant, not
   just a property test.

2. **File-watcher events are adversarial schedules.** Real-
   world quirks (concurrent file modifications during a
   `git pull`, partial writes during atomic-rename, OS
   file-watcher coalescing) become reproducible test cases
   under DST. Pinned seed → deterministic adversarial
   schedule replay.

3. **Every non-determinism source must be exposed.**
   Dictionary iteration order, hashtable insertion order,
   async-scheduler ordering, plugin-load timing — each is
   either pinned or filed as a deferred bug per Otto-281.
   *"Retries are non-determinism smell"* — if the
   substrate-discovery test suite ever needs a retry, that
   retry IS the bug.

4. **The chain-rule Prop 3.2 Lean proof guarantees algebraic
   determinism.** The implementation must match. Lean proves
   the math; DST proves the implementation matches the
   math. Both are required for an A-grade artifact in the
   sense of #1383's grading.

Concrete DST primitives in Phase 0 PoC:

- Pinned random seeds for all stochastic operations (per
  Otto-273; values containing 69 or 420 if architect picks
  per maintainer whimsy preference)
- A `replay` mode that reads a recorded event sequence +
  seed and reproduces the Z-set state exactly
- A CI job that compares cold-start replay vs warm-state
  IVM at every commit; any divergence fails the build
- Adversarial-schedule fuzz harness that generates
  pathological file-watcher event sequences (out-of-order,
  duplicated, partial)

DST is the discipline that makes substrate-discovery
trustworthy enough to be the canonical answer-source for
agent wake-time inventory queries. Without DST, every
"the index says X" claim is uncertain. With DST, "the
index says X" reduces to "the deterministic algebra over
the deterministic event-sequence produced X."

---

## What we're indexing — substrate types

Five composable substrate-types live under different roots,
each with a distinct lifecycle:

| Substrate type | Root path | Cardinality (today) | Mutation cadence |
|---|---|---|---|
| Memory files | `memory/**.md` + `~/.claude/projects/<slug>/memory/**.md` | ~250+ | every tick possible |
| Skill files | `.claude/skills/<name>/SKILL.md` | ~50+ | rare (skill-creator gated) |
| Agent files | `.claude/agents/<name>.md` | ~30+ | rare |
| Command files | `.claude/commands/<name>.md` | small | rare |
| Rule files | `.claude/rules/*.md` | very small | new surface |
| Doc cross-refs | `docs/**.md` link targets | ~thousands | every doc edit |
| BACKLOG rows | `docs/BACKLOG.md` + `docs/backlog/**.md` | ~200+ | every tick |
| Tick shards | `docs/hygiene-history/ticks/**/*.md` | ~hundreds | every tick |
| Research docs | `docs/research/**.md` | ~hundreds | every doc edit |
| Code symbols | `src/**.fs` (F#) + `tools/**/*.ts` (TS) | thousands | every code edit |

**Indexing scope decision:** Phase 1 covers memory files +
skill files + agent files + rule files + BACKLOG rows. These
are the highest-query-volume surfaces (every wake, every
tick) and have stable schemas. Phase 2 adds doc cross-refs.
Phase 3 adds code symbols (LSP-adjacent, harder to model).

---

## Query workloads — what the index serves

Six core query shapes, each with target latency:

1. **find-by-keyword** (e.g., "memory files containing
   `'goldfish-ontology'`") — target <100ms cold-start, <10ms
   warm.
2. **find-by-link-target** (e.g., "files referencing
   `memory/feedback_otto_341_*.md`") — target <100ms.
3. **find-stale-references** (e.g., "memory pointers to
   files that don't exist") — target <500ms full-scan,
   <50ms incremental.
4. **find-by-tag/role-ref** (e.g., "all files attributed to
   Soraya") — target <100ms.
5. **find-by-cadence-marker** (e.g., "tick shards with
   CADENCE-TRACK markers"; the existing
   `check-no-op-cadence-pattern.ts` workload) — target
   <50ms.
6. **find-by-archive-header-status** (e.g., "research docs
   missing §33 fields") — target <500ms full-scan, <50ms
   incremental.

**Cold-start decision:** queries 1+2+4 are wake-time agent
needs (Skill-router-equivalent inventory). Queries 3+5+6 are
hygiene-cadence needs (existing `tools/hygiene/**` audits).
The index serves both classes.

---

## Operator mapping — Zeta primitives per query

| Query | Zeta operators |
|---|---|
| find-by-keyword | `IndexedZSet` keyed on token; `flatMap` + `distinct` |
| find-by-link-target | `IndexedZSet` keyed on link-target; `join` against existence stream |
| find-stale-references | `outerJoin` (memory-pointers ⨝ existing-files); `filter` on null-right |
| find-by-tag/role-ref | `IndexedZSet` keyed on attribution-tuple |
| find-by-cadence-marker | `IndexedZSet` keyed on shard-date; `filter` on `CADENCE-TRACK` regex |
| find-by-archive-header | `flatMap` over header-fields; `aggregate` per-doc |

**Update semantics:** every file-add / file-remove /
file-modify is an insertion or retraction in Z-set terms.
`Incremental.fs` handles delta propagation; the IVM
guarantee means the index only re-evaluates the affected
join branches, not the full re-scan.

**Determinism contract:** per `tools/tla/specs/DbspSpec.tla`
+ the chain-rule Prop 3.2 verified in Lean, the Z-set
algebra preserves determinism across replays. Rebuilding
the index from scratch via `git ls-files | feed-into-zeta`
must produce the identical Z-set state to the live IVM. This
becomes a CI invariant (cold-start replay vs warm-state).

---

## NativeAOT deployment shape

**Target binary:** `tools/substrate-discovery/Zeta.SubstrateDiscovery`
(F# project under `tools/substrate-discovery/` with
`PublishAot=true`). Single-file binary, zero JIT warmup,
~30-50ms cold-start (TBD — measure when PoC lands).

**Invocation modes:**

1. **CLI**: `substrate-discovery query <type> <args>` →
   structured JSON output (same shape as
   `tools/github/poll-pr-gate.ts` JSON contract).
2. **Watcher daemon**: `substrate-discovery serve` → IVM
   loop with file-watcher input + Unix-socket query
   interface. Long-running; cron-friendly liveness probe.
3. **Library mode** (Phase 2): F# bindings exposed for
   in-process consumption from F# tools.

**Toolchain integration:**

- Build via `tools/setup/install.sh` (mise-pinned dotnet)
- CI build via `gate.yml` job (`dotnet publish -c Release
  -p:PublishAot=true`)
- Distribute via per-platform binaries (linux-x64, osx-arm64,
  win-x64) attached as GitHub release artifacts
- Cron-loop tools (`tools/hygiene/**`) opportunistically
  shell to the binary; fall back to bun/.ts if absent

**NativeAOT compatibility:** F# AOT support has known edge
cases around reflection-heavy code. Risk mitigation: keep
the binary surface narrow (no FSharp.Core reflection;
explicit serializer registrations; AOT-friendly JSON via
`System.Text.Json` source generators).

---

## Migration / parallel-run plan

**Phase 0 (PoC, 2-3 ticks):** F# project skeleton +
NativeAOT publish + smoke-test invocation. Validates
toolchain end-to-end. Index nothing real; just exit-0 on
`--version`.

**Phase 1 (memory-index dogfood, 5-10 ticks):** index
`memory/**.md` only. Re-implement
`audit-memory-references.ts` + `audit-memory-index-duplicates.ts`
as Zeta queries. Run BOTH the .ts and the F# binary in CI;
diff the JSON outputs; alert on divergence. When parity
holds for 5 consecutive merges, retire the .ts versions.

**Phase 2 (skill + agent + rule + BACKLOG, 10-20 ticks):**
add the next 4 substrate types. Add `find-by-keyword` +
`find-by-tag` queries. Wire into wake-time inventory
discipline (per `claude_code_loading_taxonomy_*` memo).

**Phase 3 (doc cross-refs, multi-month):** index all
markdown link-targets across the repo. Subsumes
`tools/hygiene/audit-orphan-role-refs.sh` +
`audit-machine-specific-content.ts` + similar.

**Phase 4 (code symbols, multi-month):** LSP-adjacent
indexing of F# + TS code. Subsumes / complements Serena,
Lean LSP, F# LSP.

**Retirement gates:** at each phase, the equivalent .ts
script is retired only after (a) parity holds for N
consecutive merges, (b) latency budget is met, (c) cold-
start replay matches live IVM.

---

## Risk register

| Risk | Probability | Mitigation |
|---|---|---|
| NativeAOT incompatibility on F# library | Medium | Phase 0 PoC validates before substantial commit |
| Pre-v1 Zeta API churn breaks substrate-discovery | Medium | Pin to specific Zeta commit per phase; bump explicitly |
| IVM cold-start slower than full-scan via grep | Low | Phase 0 measures; if slower, redesign or add caching layer |
| Watcher-daemon liveness drift (hangs / misses events) | Medium | Cron-friendly liveness probe; auto-restart; state checkpointing per Otto-272 DST |
| Per-platform binary distribution friction | Medium | GitHub Actions artifact build; mise-pinned dotnet matrix |
| Cross-platform file-watch primitive differences | Medium | Use .NET `FileSystemWatcher`; fall back to polling if unreliable |
| F# JSON-source-generator AOT edge case | Low | Use simple records; avoid generic dispatch in serializer |

---

## Composes with

- `docs/research/2026-05-03-math-proofs-honest-assessment.md`
  (the algebra is A-grade verified; this dogfoods it)
- `src/Core/IndexedZSet.fs` + `Incremental.fs` + `Operators.fs`
  + `ZSet.fs` (the primitives)
- `src/Core/PluginApi.fs` + `PluginHarness.fs` (the AOT-core
  plugin contract; Zeta.Bayesian is the existing JIT plugin
  precedent)
- `tools/tla/specs/DbspSpec.tla` (determinism contract)
- `tools/lean4/Lean4/DbspChainRule.lean` (proof the IVM
  composes correctly under retraction)
- `memory/feedback_git_interface_wasm_bootstrap_zero_requirements_2026_04_24.md`
  (existing architectural commitment: Zeta IS git client+
  server; native F# impl; two-UI architecture; both modes
  zero-install; substrate-discovery composes with this not
  competes against it)
- `docs/backlog/P2/081KQ0YZ80008QG0R0003GAYYN-operational-resonance-dashboard-frontier-bulk-alignment-ui-with-continuous-ux-research-meta-recursive.md`
  (the Operational Resonance Dashboard within Frontier-UI
  consumes substrate-discovery's index data; Z-set queries
  feed dashboard widgets; live IVM means auto-updating
  without polling; DST means dashboard state is reproducible;
  *"every pixel earns its way via A/B experiments"* is the
  consumer-side discipline)
- `memory/feedback_claude_code_loading_taxonomy_*.md`
  (the wake-time inventory discipline this index serves)
- `.claude/rules/test-canary.md` (the harness-native
  alternative; runs as one of the live-off-the-land
  hypothesis tests, not as the architecture)
- `tools/hygiene/audit-memory-references.ts` +
  `audit-memory-index-duplicates.ts` (Phase-1 dogfood
  targets — re-implement as Zeta queries)
- Otto-272 DST-everywhere + Otto-273 seed-lock-policy +
  Otto-281 DST-exempt-is-deferred-bug (the determinism
  discipline this PoC must integrate from day 1)

---

## Decision points (architect-call within authority)

1. **Yes, Zeta-native-AOT is the best long-term solution.**
   Decided: see "Why Zeta-native-AOT" section above.
2. **Phase 0 PoC is the next concrete work item.** Bounded
   to 2-3 ticks; validates toolchain end-to-end before
   substantial commit.
3. **Parallel-run with .ts retirement gates** preserves the
   existing audit value during transition. No big-bang
   replacement.

---

## Audit trail

- Scoping doc authored: 2026-05-03
- Triggered by: human maintainer 2026-05-03 input *"use zeta
  in native assmly mode for our custom index i think"* +
  edge-runner reframe + math-proofs assessment landing
- Authority decision: architect within scope (per CLAUDE.md
  *"don't ask permission within authority scope — only two
  real gates"*)
- Next concrete work: Phase 0 PoC (separate PR)
