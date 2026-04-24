# DST Compliance Criteria — DST-held + FoundationDB-grade

**Status:** research-grade proposal (pre-v1). Origin: Amara
19th courier ferry, Part 2 correction #6. Author: architect
review. Scope: locks acceptance criteria for "DST-held"
(minimum bar) and "FoundationDB-grade DST candidate"
(aspirational bar) so future graduations have an
unambiguous target. Research-grade until promoted to
`docs/DST-COMPLIANCE.md` as part of PR 1 of the 19th-
ferry revised roadmap.

## 1. Why this doc

The factory has shipped plenty of DST philosophy: the
`.claude/skills` DST guide, the ChaosEnvironment
implementation, the VirtualTimeScheduler in tests, the
retraction-native-by-design discipline. What it has NOT
had is a hard bar — "we are DST-held" is a claim without
a predicate. Amara's 19th-ferry correction #6 fills the
gap with two criteria blocks:

1. **DST-held** — minimum acceptable practice. Every Zeta
   graduation that claims DST-compliance must clear all
   six items. Sub-bar compliance is explicitly not "DST-
   held."
2. **FoundationDB-grade DST candidate** — aspirational
   bar matching FDB's Simulation / TigerBeetle's Swarm /
   Antithesis's state-space exploration. Clearing this is
   the multi-quarter target; no single graduation lands
   it. The item list is the roadmap.

Writing both bars now lets future PRs self-assess against
the committed criteria rather than re-negotiating the
definition.

## 2. DST-held — minimum bar

A graduation is DST-held when all six items are true:

1. **All PR-gating stochastic tests use explicit seeds.**
   Any test with RNG surface in the PR-gate workflow must
   commit the seed. Implicit / ambient seeds are a
   violation.
2. **Every failing stochastic test emits seed +
   scenario parameters.** A red test whose reproduction
   requires seed-guessing is not DST-held. The seed and
   parameter values must be in the failure output.
3. **Same seed produces same result locally and in CI.**
   Bit-for-bit reproducibility across execution
   environments. If a test passes on macOS-14 and fails
   on ubuntu-22.04 with the same seed, the divergence is
   a DST bug to investigate, not an acceptable flake.
4. **Broad sweeps run nightly, not as flaky PR gates.**
   Statistical smoke tests (category 3 per
   `docs/research/test-classification.md`) do not block
   PRs. They run on a scheduled workflow and report
   observed distributions without gating merges.
5. **Main-path code has zero unreviewed entropy-source
   hits.** Of the 12 known .NET entropy sources
   (DateTime, Stopwatch, TickCount, Guid.NewGuid,
   Random.Shared, RandomNumberGenerator, Task.Run,
   Task.Delay / Thread.Sleep, File.*, Socket.*,
   Parallel.*, [ThreadStatic] / AsyncLocal), any
   occurrence in `src/Core/` or `src/Core.CSharp/`
   must be either: (a) routed through the simulation
   API (ChaosEnv / VirtualTimeScheduler / ISimulationFs
   / ISimulationDriver / etc.), or (b) explicitly listed
   in `docs/DST-ACCEPTED-BOUNDARIES.md` with a rationale.
6. **File / network / time / random / task-scheduling
   boundaries are either simulated or explicitly marked
   as accepted external boundaries.** The same rule as
   (5) extended to integration surfaces. `tools/` and
   `samples/` scripts are boundary-zoned by default;
   an entry in the accepted-boundaries registry names
   each exception with its rationale.

The six items are independent. A graduation that clears
five and fails one is not DST-held; "partial
compliance" is not a claim the factory makes.

## 3. FoundationDB-grade DST candidate — aspirational bar

Beyond DST-held, the FoundationDB-grade target requires
all eight surfaces exist and integrate:

1. **Simulated filesystem.** `ISimulationFs` implemented
   + wired into every file-I/O call site (notably
   `DiskBackingStore`). Supports seed-driven fault
   injection (read failures, write failures, corruption,
   latency spikes).
2. **Simulated network.** `ISimulationNetwork`
   implemented + wired into every socket / HTTP call site
   (multi-node future scope). Supports partition, packet
   drop, packet reorder, latency injection.
3. **Deterministic task scheduler.** `ISimulationDriver`
   with `RunAsync` replacing ambient `Task.Run` /
   `ThreadPool` on main paths. Virtual-time scheduling
   across threads; scheduler interleaving determined by
   seed.
4. **Fault injection / buggify surface.** ChaosPolicy
   extended with FDB-style `BUGGIFY()` macros: "at N%
   probability under seed S, inject failure X at this
   code site." Called at strategic points in core logic;
   inactive unless simulation driver enables it.
5. **Swarm runner.** A harness that runs N parallel
   scenarios under M seeds each (e.g. `100 scenarios ×
   1000 seeds = 100,000 runs per sweep`). Either local-
   invocation or GitHub Actions matrix. Emits per-seed
   results for failure-minimization analysis.
6. **Replay artifact storage.** Seed + scenario +
   failing-output persisted under
   `artifacts/dst/failing-seeds/seed-<N>/` with enough
   information to re-run the exact failure locally.
   Artifacts retained for at least 30 days per
   replay-feasibility requirement.
7. **Failure minimization / shrinking.** When a seed
   reveals a failure, shrink the scenario to the
   minimum reproducing configuration (fewer nodes,
   fewer events, shorter sequence) and persist the
   minimized case as a permanent regression fixture.
   FsCheck's shrink machinery can be repurposed; FDB
   uses its own shrinking layer.
8. **Reproducible end-to-end scenario from one seed.**
   Given a seed and a scenario name, a single command
   produces the exact same byte-for-byte state
   transitions the CI produced. No environment
   dependencies, no flaky replay.

Clearing all eight is the "defense-in-depth DST" claim
matching FoundationDB's Simulation, TigerBeetle's
VOPR, and Antithesis's production offering. Zeta does
not make that claim today.

## 4. Per-area grade (Amara 19th-ferry, preserved)

Amara's internal assessment of Zeta's current DST posture,
preserved as context:

| Area                          | Grade | Reason                                                                |
|-------------------------------|-------|-----------------------------------------------------------------------|
| DST philosophy / docs         | A-    | Rule is clear, aligned with FoundationDB / TigerBeetle style          |
| Seeded core environment       | B     | `ChaosEnvironment` exists; not all surfaces route through it          |
| Virtual time                  | B-    | Exists but still test-side, not unified core driver                   |
| Filesystem simulation         | D     | Known blocker: real disk path not intercepted                         |
| Network simulation            | D/NA  | Future multi-node work, not yet present                               |
| Deterministic task scheduling | C-    | `RunAsync` abstraction is needed; ambient ThreadPool remains a risk   |
| CI seed artifacts             | C     | Good plan, not fully landed                                           |
| Cartel-Lab DST readiness      | C+    | Toy seed discipline exists; calibration artifacts missing             |
| KSK/Aurora DST readiness      | C     | Advisory-only is correct; replayable policy inputs still need design  |

Overall grade: **B-**. Factory reports this as "Amara's
assessment," not a self-certified claim.

## 5. Mapping the bar to shipped + queued work

### Shipped toward DST-held

- **Test classification** (`docs/research/test-
  classification.md`, PR #339) — 5-category taxonomy
  directly supports items 1 + 2 + 4.
- **PR #323 cartel toy** — seeds committed at fixed
  constants; supports items 1 + 3 (within its narrow
  scope).
- **ChaosEnvironment** (`src/Core/ChaosEnv.fs`) — the
  substrate item (5) routes onto.
- **`docs/research/calibration-harness-stage2-design.md`**
  (PR #342) — artifact schema supports item 2.

### Shipped toward FoundationDB-grade

- **ChaosEnvironment** — partial coverage of item 3
  (random + clock) but not task scheduler yet.
- **VirtualTimeScheduler** (test-side only) — precursor
  to item 3; needs core promotion.

### Gaps — queued graduations

All 6 items of the 19th-ferry revised roadmap map to gaps:

| Revised-roadmap PR | Which criteria item |
|--------------------|---------------------|
| PR 1 entropy-scanner + accepted-boundary registry | DST-held #5 + #6 enforcement |
| PR 2 seed protocol + CI artifacts | DST-held #1 + #2 |
| PR 3 sharder reproduction | DST-held #3 + #4 |
| PR 4 ISimulationDriver + VTS to core | FDB #3 + foundation for #1, #2, #4 |
| PR 5 simulated filesystem | FDB #1 |
| PR 6 Cartel-Lab DST calibration | DST-held #1 + #2 + FDB #5 partial |

Plus:

- Simulated network: FDB #2 (multi-node future).
- Buggify / fault injection: FDB #4 (follow-up to PR 4).
- Swarm runner: FDB #5 (follow-up to PR 2 + PR 4).
- Failure minimization: FDB #7 (follow-up to PR 2).

## 6. Promotion path

Research-grade today. Promotes to factory discipline via
the following sequence:

1. This doc lands under `docs/research/` as design
   reference (this PR).
2. PR 1 of the 19th-ferry revised roadmap (DST scanner +
   accepted-boundary registry) lands; includes an ADR
   promoting the DST-held bar as a factory gate for the
   `src/Core/` surface.
3. The promoted bar migrates to `docs/DST-COMPLIANCE.md`
   (top-level) with a pointer at this research doc kept
   as historical context.
4. FoundationDB-grade remains aspirational in research-
   doc form until the corresponding PRs land (4, 5, and
   later-stage fault injection / swarm / shrinking work).

No graduation claims DST-held until step 2 promotes the
bar. Until then, graduations reference this research doc
as their acceptance target but do not self-certify.

## 7. What this doc does NOT do

- Does **not** promote either bar to factory
  discipline. Promotion requires ADR.
- Does **not** classify any existing test. Migration is
  per-test as the test-classification taxonomy + this
  criteria doc land together.
- Does **not** authorize any workflow changes. That is
  PR 1 of the 19th-ferry revised roadmap, not this doc.
- Does **not** grade individual PRs. Per-area grading is
  Amara's internal assessment of overall posture, not
  the factory's per-PR evaluation gate.
- Does **not** revise Amara's grade. Amara reports B-;
  this doc preserves without re-assessment.

## 8. Cross-references

- Amara 19th ferry — `docs/aurora/2026-04-24-amara-dst-
  audit-deep-research-plus-5-5-corrections-19th-ferry.md`
  (PR #344, source of this doc's criteria).
- `docs/research/test-classification.md` (PR #339) — the
  5-category taxonomy that supports items 1 + 2 + 4.
- `docs/research/calibration-harness-stage2-design.md`
  (PR #342) — Stage-2 harness design; artifact schema
  supports item 2.
- `.claude/skills` DST guide — the authoritative
  rulebook cited throughout Part 1 of the ferry.
- `src/Core/ChaosEnv.fs` — the in-substrate seeded
  environment item #5 routes onto.
- `tests/ConcurrencyHarness.fs` — the test-side
  VirtualTimeScheduler queued for core promotion (PR 4
  of revised roadmap).
- `docs/FACTORY-HYGIENE.md` row #51 — cross-platform
  parity; orthogonal to DST but both on the CI-hygiene
  axis.
- Amara 18th ferry (PR #337) — Part 1 §C test
  classification precursor; Part 2 #10 sharder
  "measure-before-widen" directive.
- PR #323 cartel toy detector — Stage 1; seed
  discipline reference.
