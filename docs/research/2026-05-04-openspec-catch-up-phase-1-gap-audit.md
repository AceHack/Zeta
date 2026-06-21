# OpenSpec catch-up — Phase 1 gap audit

Scope: read-only baseline survey of `openspec/specs/**` against the
project's actual implementation surface and the doctrine substrate
(CLAUDE.md / GOVERNANCE.md / docs/ALIGNMENT.md). Output is the
recommended catch-up sequence for Phase 2 of 081KQNJ500008QG0R001N94412.

Attribution: authored by the autonomous-loop session 2026-05-04 against
maintainer Aaron's 2026-05-03 verbatim ask preserved in
[`docs/backlog/P1/081KQNJ500008QG0R001N94412-openspec-catch-up-canonical-source-of-truth-aaron-2026-05-03.md`](../backlog/P1/081KQNJ500008QG0R001N94412-openspec-catch-up-canonical-source-of-truth-aaron-2026-05-03.md):
*"openspec which we are way behind on, that's suppsed to be our source
of truth lol, if we were to delete everying other than it"*.

Operational status: research-grade baseline. Names the gaps. Does NOT
author or modify any spec; spec authoring is Phase 2 work, ticketed
per-capability against `openspec-expert` + `spec-zealot`.

Non-fusion disclaimer: this doc is a single-pass audit by one agent
session. Treat the gap table and recommended sequence as a candidate
plan, not a closed contract. The Architect protocol per
`docs/CONFLICT-RESOLUTION.md` governs which capabilities actually get
spec'd in which order.

---

## Headline finding

The "if we deleted everything but OpenSpec, the project would be lost"
test fails today. Concretely:

- **5 capability spec.md files** exist under `openspec/specs/**`
  covering ~1953 lines of spec, ~56 requirements, ~136 scenarios.
- **77 F# source files** ship in `src/Core/` totaling ~12k lines —
  the canonical implementation surface. Only ~7 of those 77 files
  have direct spec coverage in the existing capabilities.
- **34 numbered governance rules** in `GOVERNANCE.md` plus the
  CLAUDE.md cluster of wake-time disciplines (verify-before-deferring,
  future-self-not-bound, never-be-idle, search-first-authority,
  razor-discipline, substrate-or-it-didn't-happen, refresh-before-decide,
  no-directives, BLOCKED-with-green-CI, etc.) carry doctrine that
  has zero corresponding spec coverage.
- **`docs/ALIGNMENT.md`** carries 7 hard constraints (HC-1..HC-7),
  9 soft defaults (SD-1..SD-9), 5 directional commitments (DIR-1..
  DIR-5), and the bidirectional-alignment meta-commitment. Zero of
  these are encoded as OpenSpec capabilities today.

Phase 1 (this doc) names the gaps. Phase 2 (per-capability authoring)
is the catch-up work itself.

---

## 1. OpenSpec inventory (what exists today)

The current `openspec/specs/**` tree:

| Capability | spec.md lines | Requirements | Scenarios | Profiles |
|---|---|---|---|---|
| `circuit-recursion` | 264 | 8 | 16 | (none) |
| `durability-modes` | 189 | 6 | 17 | `fsharp.md` (100 lines) |
| `lsm-spine-family` | 412 | 11 | 29 | `fsharp.md` (213 lines) |
| `operator-algebra` | 678 | 16 | 46 | `fsharp.md` (117 lines) |
| `repo-automation` | 230 | 9 | 13 | `bash.md` (223), `github-actions.md` (161) |
| `retraction-safe-recursion` | 180 | 6 | 15 | `fsharp.md` (100 lines) |
| **Totals** | **1953** | **56** | **136** | 6 profile files |

`openspec/README.md` lists three capabilities as currently spec'd
(operator-algebra, retraction-safe-recursion, durability-modes) and
flags four as "Planned capabilities (not yet spec'd)":

- `storage-spines` — partially supplanted by `lsm-spine-family`
  which DID land between the README's last update and now;
  README is stale on this point.
- `sketches` — HLL, Count-Min, KLL, Bloom (blocked + counting),
  future CQF. Source files exist (`Sketch.fs` 111L, `CountMin.fs`
  163L, `BloomFilter.fs` 533L). Zero spec coverage.
- `feature-flags` — `src/Core/FeatureFlags.fs` ships (143 lines).
  Behavioural spec is partially absorbed into `durability-modes`
  (the feature-flag evaluator section), but the standalone
  capability is not formally factored out.
- `circuit-scheduling` — topo-sort, strict ops, async fast path.
  Partially covered by `operator-algebra`'s "strict operators
  break feedback cycles" + "async-lifecycle declaration and
  fast-path step" requirements. Not factored out.

`circuit-recursion` shipped as a standalone capability after the
README was last updated (it post-dates the README's "Three
capabilities are spec'd today" line and has no `profiles/` dir).

**Stale README finding.** `openspec/README.md` line 84 ("Three
capabilities are spec'd today") undercounts by 3 (the actual count
is 6 today including `circuit-recursion`, `lsm-spine-family`, and
`repo-automation`). Phase 2 work should update the README's count
+ planned-capabilities list as part of any spec-authoring PR that
adds a new capability.

---

## 2. Spec-vs-code alignment check (sample of 4)

I spot-checked 4 of the 5 existing capability specs against the
F# code in `src/Core/` to test whether the existing specs actually
describe shipped behaviour.

### 2.1 `operator-algebra/spec.md` vs `src/Core/ZSet.fs` + `Operators.fs`

- Z-set ascending-sorted invariant per spec line 41-58:
  `src/Core/ZSet.fs:36` declares `entries: ImmutableArray<ZEntry<'K>>`
  with the convention "ascending-sorted-by-key, nonzero-weighted run"
  per the constructor doc-comment at line 38-40. Aligned.
- "Look-up of an absent key returns 0, no exception" scenario
  (spec 27-31): `ZSet.fs:54-70` binary-search returns `0L` if not
  found, no exception. Aligned.
- "Z-set as finitely-supported signed multiset" (spec 15-71) requires
  no zero-weight entries. `ZSet.fs:33-34` doc-comment names the
  invariant. Verification continues into the operator code; not
  exhaustively traced in this audit pass.
- **Status: aligned at the surfaces sampled.** Full drift scan is
  spec-zealot's job per GOVERNANCE.md §28.

### 2.2 `durability-modes/spec.md` vs `src/Core/Durability.fs`

- 4 named modes per spec 15-49: `Durability.fs:23-68` defines
  `DurabilityMode = StableStorage | OsBuffered | InMemoryOnly |
  WitnessDurable`. Aligned.
- "Stable-storage recovery property reflects shipped behaviour"
  (spec 35-41): `Durability.fs:198-202` returns "advertised: ... ;
  shipped: OsBuffered semantics until per-Save fsync path lands".
  Aligned (the spec was authored to track exactly this honesty
  note).
- "Factory refuses witness-durable without the flag" (spec 86-94):
  `Durability.fs:174-183` raises `invalidOp` with message naming
  the WitnessDurable flag and directing to OsBuffered. Aligned.
- **Status: aligned. This capability is the cleanest of the 5 —
  the spec was authored alongside the Round-17 honesty-note rework
  and tracks shipped behaviour exactly.**

### 2.3 `circuit-recursion/spec.md` vs `src/Core/NestedCircuit.fs`

- "Nested circuits expose a parent-owned driver operator" (spec 20-55):
  `NestedCircuit.fs:21-49` defines a `NestedCircuit` type with
  `Inner`, `Parent`, `LastIterationCount`, `Converged`,
  `MaxIterations`. Aligned in shape.
- "Per-outer-tick iteration is bounded by a configurable cap" (spec
  118-141): `NestedCircuit.fs:23` sets `maxIterations = 64`,
  `NestedCircuit.fs:49` exposes `MaxIterations` with `get, set` —
  matches the spec's "cap is configurable without scope teardown"
  scenario. Aligned. Default cap is 64, matching spec 138-141.
- **Missing profile.** No `profiles/fsharp.md` exists for
  `circuit-recursion` despite the F# implementation being live.
  This is the most concrete gap inside the existing-capability
  surface — Phase 2 work should add `profiles/fsharp.md` for
  this capability.

### 2.4 `lsm-spine-family/spec.md` vs `src/Core/Spine.fs` + `SpineAsync.fs` + `BalancedSpine.fs` + `DiskSpine.fs` + `SpineSelector.fs`

- 4 spine variants per spec (cascade / bounded-latency / backing-store
  / async-producer) plus selector (spec 309-339): all 5 source files
  exist in `src/Core/`. Variant-by-variant trace would be a
  full spec-zealot pass — not exhaustively done in this audit.
- "Selector decision matrix" (spec 326-339): `SpineSelector.fs`
  exists (location confirmed via `find`). Detailed trace deferred
  to Phase 2.
- **Status: structurally aligned. Exhaustive scenario-by-scenario
  trace is Phase 2 work.**

### Spec-vs-code alignment summary

The existing capability specs **DO** describe shipped behaviour at
the surfaces sampled. The problem is not drift on the existing
specs — it is **absent specs for everything else the project
ships**. That is the Phase 2 catch-up workload.

---

## 3. Gap table — doctrine and code surfaces with NO spec coverage

This table is the load-bearing output of Phase 1. Each row names
a documented-but-not-spec'd discipline or code surface, the
authoring source, the closest existing spec (if any), and a
catch-up-priority rating.

### 3.1 Code surfaces in `src/Core/` with no behavioural spec

| Source file(s) | Capability candidate | Lines | Priority |
|---|---|---|---|
| `BloomFilter.fs`, `CountMin.fs`, `Sketch.fs` | `sketches` (HLL / Count-Min / Bloom / blocked) | 807 | P1 |
| `Crdt.fs`, `DeltaCrdt.fs` | `crdt-family` (state-CRDT, delta-CRDT) | 274 | P2 |
| `Graph.fs`, `Hierarchy.fs`, `ConsistentHash.fs` | `graph-substrate` (ZSet-backed graph + closure-table + consistent hash) | 1319 | P1 |
| `Window.fs`, `Watermark.fs`, `SpeculativeWatermark.fs`, `TimeSeries.fs`, `TemporalCoordinationDetection.fs` | `streaming-window-and-watermark` | 1163 | P1 |
| `Transaction.fs`, `Upsert.fs` | `transaction-and-upsert-semantics` | 346 | P1 |
| `Sink.fs`, `Tracing.fs`, `Metrics.fs` | `observability-substrate` | 326 | P2 |
| `ChaosEnv.fs`, `MailboxRuntime.fs`, `WorkStealingRuntime.fs`, `Runtime.fs`, `Circuit.fs` | `circuit-runtime` (umbrella for `circuit-recursion`'s missing parent capability — register-lock, scheduler, runtime variants) | 808 | P0 |
| `Plan.fs`, `Query.fs`, `Aggregate.fs`, `LawRunner.fs` | `query-and-plan` (DBSP query construction + algebraic-law verification) | 688 | P1 |
| `Serializer.fs`, `ArrowSerializer.fs`, `Merkle.fs`, `FastCdc.fs`, `HardwareCrc.fs` | `serialization-and-content-addressing` | 784 | P1 |
| `Veridicality.fs`, `SignalQuality.fs`, `RobustStats.fs` | `veridicality-and-signal-quality` (Aurora-adjacent) | 889 | P2 |
| `PluginApi.fs`, `PluginHarness.fs` | `plugin-api` | 300 | P2 |
| `IndexedZSet.fs`, `Pool.fs`, `Shard.fs`, `Primitive.fs` | extensions to `operator-algebra` (indexed Z-set, struct pools, sharding) | 850+ | P1 |
| `HigherOrder.fs`, `Injection.fs`, `InjectionExt.fs`, `Incremental.fs`, `Fusion.fs` | `higher-order-incrementalization` (spec 4-helper chain-rule extension) | 666 | P2 |
| `Simd.fs`, `SimdMerge.fs` | `simd-fastpaths` profile under `operator-algebra` (overlay, not new capability) | 165 | P3 |
| `SplitMix64.fs`, `PhaseExtraction.fs`, `NovelMath.fs`, `NovelMathExt.fs` | `numerical-primitives` | 332 | P3 |
| `FeatureFlags.fs` | factor out as standalone capability (currently absorbed into `durability-modes`) | 143 | P2 |
| `Algebra.fs`, `Dsl.fs`, `FSharpApi.fs`, `Handles.fs`, `Environment.fs`, `Rx.fs`, `Residuated.fs` | umbrella `library-surface-and-dsl` | 720 | P3 |

P0 = blocking-foundation (recursion / circuit / runtime are
preconditions for many other capability specs).
P1 = load-bearing (large surface, existing memos cite, on the
hot path).
P2 = important-but-derivable (could be reconstructed from existing
specs + adjacent files at moderate cost).
P3 = optimization or tooling overlay (not blocking the
disaster-recovery test).

### 3.2 Doctrine surfaces (CLAUDE.md / GOVERNANCE.md / ALIGNMENT.md) with no spec coverage

| Source | Discipline | Closest existing spec | Priority |
|---|---|---|---|
| CLAUDE.md "Refresh-before-decide is the fundamental invariant" | Agent-loop refresh discipline | (none) | P1 |
| CLAUDE.md "Substrate or it didn't happen — Otto-363" | Durability classification (captured / parked / host-durable / preserved / canonical / operational) | (none) | P0 |
| CLAUDE.md "Search-first authority — Otto-364" | Citation hygiene + version-currency | (none) | P1 |
| CLAUDE.md "Razor-discipline — Rodney's Razor" | No metaphysical claims; only operational claims with observable variables | (none) | P1 |
| CLAUDE.md "Verify-before-deferring" | Deferral hygiene — every "next tick" deferral has a discoverable target | (none) | P2 |
| CLAUDE.md "Future-self is not bound by past-self" | Revision discipline with traceable history | (none) | P2 |
| CLAUDE.md "Never be idle — speculative factory work" + action-hierarchy + amortized-speed Superfluid | Action-pick framework | (none) | P1 |
| CLAUDE.md "All complexity is accidental in greenfield" | Default-presumption-revaluable classification | (none) | P3 |
| CLAUDE.md "BLOCKED-with-green-CI means investigate threads first" | PR-gate diagnostic discipline | `repo-automation` (related but not specific) | P2 |
| CLAUDE.md "Don't ask permission within authority scope" | Authority-scope classification (only 2 real gates) | (none) | P2 |
| CLAUDE.md "Largest mechanizable backlog wins in AI age" | Backlog-management inversion | (none) | P3 |
| GOVERNANCE.md §1 Architect-as-integration-authority | Specialist-vs-architect dispatch | (none) | P1 |
| GOVERNANCE.md §2 Docs-read-as-current-state | Doc-history separation | partially in `repo-automation` "Canonical specs stay live" | P2 |
| GOVERNANCE.md §4 Skills via skill-creator only | Skill-authoring contract | (none) | P1 |
| GOVERNANCE.md §11 Debt-intentionality | INTENTIONAL-DEBT.md ledger discipline | (none) | P2 |
| GOVERNANCE.md §15 Reversible-in-one-round | Autonomous-change reversibility contract | (none) | P0 |
| GOVERNANCE.md §18 Memory folder is durable substrate | Memory-class taxonomy + retention | (none) | P1 |
| GOVERNANCE.md §19 Public API changes through public-api-designer | API-change contract | (none) | P1 |
| GOVERNANCE.md §22 `~/.claude/projects/` per-user durability | Per-user vs in-repo memory split | (none) | P2 |
| GOVERNANCE.md §23 Upstream-contribution discipline | OSS-back-flow contract | (none) | P3 |
| GOVERNANCE.md §24 Three-way parity (dev / CI / devcontainer) | Setup-script parity | partially in `repo-automation` "Three-way parity is the single-source contract" | P1 |
| GOVERNANCE.md §25 Upstream temporary-pin expiry | Pin-with-expiry contract | (none) | P2 |
| GOVERNANCE.md §26 Research-doc lifecycle | active / landed / obsolete classification | (none) | P2 |
| GOVERNANCE.md §27 Skills / roles / personas abstraction | Skill-router taxonomy | (none) | P1 |
| GOVERNANCE.md §31 Copilot instructions are factory-managed | Multi-harness instruction parity | (none) | P2 |
| GOVERNANCE.md §32 Alignment contract | Alignment-floor enforcement | (none) | P0 |
| GOVERNANCE.md §33 Archived external-conversation headers | Boundary-header schema | (none) | P1 |
| ALIGNMENT.md HC-1 Consent-first | Consent algebra (consent-as-abelian-group) | retraction-safe-recursion has retraction; consent itself absent | P0 |
| ALIGNMENT.md HC-2 Retraction-native operations | Retraction discipline | partially in `operator-algebra` "retraction-native invariants" | P0 (extend) |
| ALIGNMENT.md HC-3 Data is not directives | BP-11 contract | (none) | P0 |
| ALIGNMENT.md HC-4 No fetching adversarial corpora | Pliny-corpus quarantine | partially in GOVERNANCE.md §5 | P1 |
| ALIGNMENT.md HC-5 Agent register, not clinician | Output-register constraint | (none) | P2 |
| ALIGNMENT.md HC-6 Memory folder is earned, not edited | Memory-write discipline (cf §18) | (none) | P1 |
| ALIGNMENT.md HC-7 Sacred-tier protections | Sacred-tier classification | (none) | P1 |
| ALIGNMENT.md SD-1..SD-9 Soft defaults | Negotiable register defaults | (none) | P3 (P2 if grouped) |
| ALIGNMENT.md DIR-1..DIR-5 Directional commitments | Long-arc gradient commitments | (none) | P2 |
| ALIGNMENT.md "Bidirectional alignment meta-commitment" | The organizing meta-frame for unfiltered-memory + named-agent + BFT-many-masters + no-directives + glass-halo + WWJD | (none) | P0 |
| ALIGNMENT.md "Glass halo (symmetric transparency)" | Transparency contract for what agents and humans expose to each other | (none) | P0 |
| ALIGNMENT.md "Measurability — what we count" framework | Alignment-observability quantifiable axes | (none) | P0 |

### 3.3 Existing-capability completeness gaps

| Capability | Gap |
|---|---|
| `circuit-recursion` | Missing `profiles/fsharp.md` overlay despite F# impl in `NestedCircuit.fs` shipping |
| `operator-algebra` | Should enumerate IndexedZSet, Pool, Sharding extensions in `profiles/fsharp.md` (currently 117 lines — under-documents the actual surface) |
| `lsm-spine-family` | Should add a `profiles/fsharp.md` enumeration of the 5 variant types and `SpineSelector` (current 213 lines covers some of this; spot-check whether complete) |
| `durability-modes` | Spec claims feature-flag evaluator is part of this capability; should be factored out as a standalone `feature-flags` capability |
| `repo-automation` | Should grow profiles for PowerShell + TypeScript when those land per the spec's "Future profiles" line |
| `retraction-safe-recursion` | The `RecursiveSigned.fs` file (`src/Core/RecursiveSigned.fs`) is not enumerated in the spec or profile despite being one of the implementation surfaces |

---

## 4. Recommended catch-up sequence

Phase 2 of 081KQNJ500008QG0R001N94412 spec authoring. Priority dimension is "minimize the
distance between repo-current-state and the OpenSpec disaster-recovery
test" — i.e., which specs land first such that "if we deleted everything
but OpenSpec" recovers the most foundational substrate.

**P0 batch (foundation; required before anything else amortizes):**

1. **`alignment-floor`** — encode HC-1..HC-7 and the bidirectional-
   alignment meta-commitment as a capability spec. The alignment floor
   is the only shape that makes every other capability's HC clauses
   well-defined. Sources: `docs/ALIGNMENT.md`, GOVERNANCE.md §32,
   CLAUDE.md razor-discipline. Reviewer: alignment-auditor.

2. **`substrate-durability-classification`** — encode Otto-363 (captured
   / parked / host-durable / preserved / canonical / operational) as a
   capability spec. Source: CLAUDE.md "Substrate or it didn't happen"
   bullet plus the underlying memory file. Reviewer: spec-zealot.

3. **`circuit-runtime`** — umbrella capability that wraps `Circuit.fs`,
   `Runtime.fs`, `MailboxRuntime.fs`, `WorkStealingRuntime.fs`,
   `ChaosEnv.fs`. Specifies the register-lock, scheduler, and lifecycle
   primitives that `circuit-recursion` and `operator-algebra` already
   refer to but do not own. Reviewer: storage-specialist + algebra-owner.

4. **`reversibility-contract`** — encode GOVERNANCE.md §15 (reversible-
   in-one-round) as a capability spec. This is the safety-rail behind
   autonomous-loop authority. Reviewer: alignment-auditor.

5. **`glass-halo-transparency`** — encode ALIGNMENT.md "symmetric
   transparency" as a capability spec. The commitment shape that makes
   bidirectional-alignment auditable. Reviewer: glass-halo-architect.

**P1 batch (load-bearing; widens the disaster-recovery surface):**

6. **`sketches`** — `BloomFilter.fs` + `CountMin.fs` + `Sketch.fs`.
   Already on `openspec/README.md`'s planned list. Reviewer: storage-
   specialist.

7. **`graph-substrate`** — `Graph.fs` + `Hierarchy.fs` +
   `ConsistentHash.fs`. Aaron 2026-04-24 directive ("graph substrate
   must be tight in all aspects: ZSet-backed, first-class event,
   retractable, columnar storage") names this as load-bearing.
   Reviewer: graph-database-expert.

8. **`streaming-window-and-watermark`** — `Window.fs`, `Watermark.fs`,
   `SpeculativeWatermark.fs`, `TimeSeries.fs`,
   `TemporalCoordinationDetection.fs`. Reviewer: streaming-window-expert.

9. **`agent-loop-refresh-discipline`** — encode CLAUDE.md "refresh-
   before-decide" + `tools/github/poll-pr-gate.ts` BLOCKED-with-green-
   CI rule + every-tick-verify cron-unreliable bullet. Reviewer:
   alignment-auditor.

10. **`memory-folder-discipline`** — encode GOVERNANCE.md §18 (memory
    is durable substrate) + ALIGNMENT.md HC-6 (earned not edited) +
    Otto-363 substrate-or-it-didn't-happen vocabulary. Reviewer:
    documentation-agent + alignment-auditor.

**Top-5 to ship first** (per the task ask): items 1, 2, 3, 7, 9 from
the above sequence.

Rationale for the top-5:

- (1) `alignment-floor` — without this, any other spec's HC clause
  is dangling.
- (2) `substrate-durability-classification` — without this, no other
  spec can honestly claim "this is durable" without ambiguity.
- (3) `circuit-runtime` — `circuit-recursion` + `operator-algebra` +
  `lsm-spine-family` all reference machinery that lives in this layer
  but isn't formalized; specs are leaning on undefined ground.
- (7) `graph-substrate` — Aaron's 2026-04-24 directive names this as
  load-bearing, and it's the closest "downstream consumer" capability
  whose spec exists nowhere despite shipped code.
- (9) `agent-loop-refresh-discipline` — the autonomous-loop cron
  + tick-shard machinery is the most-frequently-used factory surface
  with the highest cost-per-failure, and currently has zero spec
  backing.

---

## 5. What this audit deliberately does NOT do

- Author or modify any spec file. Phase 2 work, separate PRs per
  capability per `openspec-expert` workflow.
- Drift-scan the existing capability specs exhaustively against
  shipped code. That is `spec-zealot`'s job per GOVERNANCE.md §28
  drift-detection clause.
- Update `openspec/README.md` to reflect the 6-capability current
  count. That is a one-line correction that should land in the
  PR that authors capability #7 (whichever one ships first from
  the recommended sequence).
- Decide which P-tier the recommended-catch-up sequence's batches
  end up at. The Architect protocol per `docs/CONFLICT-RESOLUTION.md`
  governs that.

---

## 6. Acceptance criterion check (081KQNJ500008QG0R001N94412 done-criteria item 4)

The acceptance criterion is: *"if we deleted everything but OpenSpec,
the project would be lost"* test PASSES.

Today, after this audit:

- 6 capabilities + 6 profile files + 1 README cover ~1953 lines of
  specs.
- The project ships ~12k lines of F# in `src/Core/` plus governance
  + alignment + agent-loop substrate amounting to thousands of lines
  more across `CLAUDE.md` (~610 lines), `GOVERNANCE.md` (~884 lines),
  `docs/ALIGNMENT.md` (~1103 lines), and supporting docs.
- **Coverage estimate: roughly 15-20% of load-bearing substrate is
  reconstructable from OpenSpec alone.** The disaster-recovery test
  fails.

The 10-capability Phase 2 sequence above (with P0 batch shipping
first) targets bringing coverage to ~60-70% — sufficient to pass the
disaster-recovery test for the foundation layer. Full coverage is
the long arc per Aaron's *"WONT-DO is 99% deferral, not forever — we
will likely do everything eventually"*.

---

## 7. Cross-references

- 081KQNJ500008QG0R001N94412 row: [`docs/backlog/P1/081KQNJ500008QG0R001N94412-openspec-catch-up-canonical-source-of-truth-aaron-2026-05-03.md`](../backlog/P1/081KQNJ500008QG0R001N94412-openspec-catch-up-canonical-source-of-truth-aaron-2026-05-03.md)
- OpenSpec README: [`openspec/README.md`](../../openspec/README.md)
- Modified-OpenSpec workflow lineage (no archive, no change-history): see openspec/README.md lines 52-80
- Spec-zealot (drift detection on existing capabilities): `.claude/skills/spec-zealot/SKILL.md`
- Openspec-expert (authoring discipline for new capabilities): `.claude/skills/openspec-expert/SKILL.md`
- GOVERNANCE.md §28 (OpenSpec is first-class for every committed artefact)
- ALIGNMENT.md (alignment contract — HC / SD / DIR clauses sourced for the gap table)
- CLAUDE.md (wake-time discipline cluster sourced for the gap table)

---

## 8. Phase 2 dispatch shape (suggested)

For each capability in the recommended sequence, a Phase 2 PR
follows this shape:

1. Branch: `openspec/<capability-name>-spec-author-<author>-<date>`
2. Author the `openspec/specs/<capability-name>/spec.md` per the
   skeleton at openspec/README.md lines 112-144.
3. Author the `openspec/specs/<capability-name>/profiles/fsharp.md`
   overlay enumerating the F# surface.
4. Reviewer: spec-zealot for adversarial-pass; the
   capability-specific reviewer named in section 4 above for
   substantive-pass.
5. Update `openspec/README.md` capability inventory line in the
   same PR (one line update; saves a follow-up).
6. Cross-link from any in-tree memo or doc that references this
   capability.

Per `openspec/README.md`, no archive entries; greenfield refactors
are welcome; the spec changes in place when the approach changes.
