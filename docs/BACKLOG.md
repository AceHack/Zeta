# Zeta.Core Unified Backlog

Single source of truth. Replaces scattered "flagged P1" notes in
ROADMAP.md and round summaries. Append-only; keep ordered newest-first
within each priority tier.

## Legend

- **P0** = ship-blocker, work on next round
- **P1** = work on within 2-3 rounds
- **P2** = research-grade, work on when the stars align
- **P3** = note-taking, explicitly deferred
- ✅ = shipped
- ⏭️ = declined with reason

---

## P0 — next round (committed)

- [ ] **OpenSpec coverage backfill — delete-all-code recovery
  gap** — Aaron 2026-04-20: *"opensepcs, if I deleted all the
  code right now how easy to recreate based on the openspecs"*.
  **Round 41 program setup landed** as
  `docs/research/openspec-coverage-audit-2026-04-21.md`
  (inventory + banding) + `docs/DECISIONS/2026-04-21-openspec-
  backfill-program.md` (ADR declaring one-capability-per-round
  baseline with Viktor adversarial-audit gate). Measured
  coverage: **4 capabilities / 783 lines of spec.md vs 66
  top-level F# modules / 10,839 lines** under `src/Core/`
  (~6% by capability count, ~7% by line ratio). Band 1 (MUST
  BACKFILL) is 8 modules / 1,629 lines — ZSet, Circuit,
  NestedCircuit, Spine family (5), plus `BloomFilter.fs`
  elevated for Adopt-row backwards-compatibility coupling.
  **Remaining work** is per-round capability backfill per the
  ADR schedule: Round 41 `operator-algebra` extension,
  Round 42 `lsm-spine-family`, Round 43 `circuit-recursion`,
  Round 44 `sketches-probabilistic` (Bloom priority),
  Round 45 `content-integrity`, Round 46 `crdt-family`.
  Each round adds ≈ 200 lines of spec.md. Per-round success
  signal: Viktor spec-zealot adversarial audit answers "could
  I rebuild this module from this spec alone?" with a clear
  **yes**. Round-close ledger gains an `OpenSpec cadence` line.
  Owner per round: Architect (Kenji) drafts, Viktor audits,
  Ilyana reviews capabilities crossing the published-library
  surface. Effort: L per capability, bounded by the ADR.
  Reviewers: Viktor first, then Ilyana (public-API designer)
  for any capability crossing the published-library surface.
  **Round 41 sweep status:** `operator-algebra` extension
  shipped (commits `e51ec1b` + `92d7db2`); Viktor P0 findings
  (namespace drift, phantom Reset, after-step scope,
  lifecycle phase undercount) all closed. Viktor's 10 P1
  findings deferred to Round 42 — see sub-item below.
  **Round 43 sweep status:** `circuit-recursion` capability
  landed (`openspec/specs/circuit-recursion/spec.md`, eight
  requirements, 17 scenarios) scoped narrowly to the
  nested-circuit substrate with explicit hand-off to sibling
  `retraction-safe-recursion` for combinator semantics (which
  already covered `Recursive` / `RecursiveCounting` /
  `RecursiveSemiNaive` / feedback cells / fixpoint driver —
  avoiding duplication). Also closed Viktor's 10
  operator-algebra P1 findings (see sub-item below).
  `openspec validate --all --strict`: 6 / 6 pass.
  **Viktor adversarial audit verdict: NO** on the
  "rebuild-from-spec-alone" test — third data-point breaks
  the two-ship unconditional-rebuild pattern that
  `operator-algebra` (Round 41) and `lsm-spine-family`
  (Round 42) established. Pattern was convenient; the specs
  are not strong enough yet. Findings filed as a Round-44
  absorb sub-item below.

- [x] ✅ **operator-algebra spec: Viktor P1 findings (Round
  43 absorb)** — **shipped round 43** into
  `openspec/specs/operator-algebra/spec.md`. All ten P1
  findings closed: (a) async lifecycle — new requirement
  "async-lifecycle declaration and fast-path step" with four
  scenarios (synchronous-only no-overhead, declared-but-
  non-deferring fast path, deferred tick-completion gating,
  async-capable-flag stable within scope); (b) memory-
  ordering — new scenario under operator-lifecycle pinning
  release-on-write / acquire-on-read with explicit rejection
  of relaxed/consume and non-reliance on SC; (c) register-
  lock semantics — new requirement "topology-mutation
  serialization" with three scenarios (atomic w.r.t.
  stepping, concurrent-mutations total-order, async-
  lifecycle interaction on removal/replace); (d) four
  chain-rule helpers — new scenario "the exposed wrapper set
  covers the four chain-rule helpers" (generic / linear /
  bilinear-join / distinct), extension surface contract
  pinned; (e) ZSet sort invariant — new scenario
  "normalisation orders entries ascending by key" under
  "Z-set as a finitely-supported signed multiset", tying
  normalisation order to iteration order and serialization
  determinism; (f) checked arithmetic — verified already
  covered by existing "weight arithmetic overflow is
  observable" scenario; (g) bilinear-size overflow —
  verified already covered by "intermediate term size may
  exceed final-delta size" scenario; (h) convergence-vs-cap
  — verified already covered by "iteration cap without
  fixpoint is an observable failure" scenario; (i)
  `Op.Fixedpoint` predicate — new scenario "per-operator
  fixpoint hints are advisory only" pinning that per-op
  hints are optimization-only input to the scope-level
  detector; (j) `DelayOp` post-reconstruction — verified
  already covered by "reconstruction re-emits the declared
  initial value" scenario. `openspec validate --all
  --strict` clean (5 capabilities pass). A pre-existing
  validator bug — the openspec parser reads only the first
  physical line of a requirement's intro paragraph for the
  MUST/SHALL check — was surfaced incidentally and fixed
  inline on the chain-rule requirement. Build Release
  remains 0W/0E.

- [ ] **circuit-recursion + operator-algebra: Viktor P0/P1
  findings from Round-43-ship adversarial audit (Round 44
  absorb)** — Viktor's re-audit of commit `ce247a2`
  delivered a **NO verdict** on the "could I rebuild these
  modules from these specs alone?" gate. Third data-point
  breaks the two-ship unconditional-rebuild pattern. **Three
  P0s**: (1) `src/Core/NestedCircuit.fs:82,94-97` — cap-hit
  path sets `Converged = false` and *still publishes*
  `extract()` to the parent stream under the same
  release/acquire contract as a converged run;
  `operator-algebra/spec.md:486-488` explicitly forbids
  this ("rather than silently publishing the state at the
  cap-th inner tick as if it were the fixpoint"); fix
  requires `IterateOp.StepAsync` to raise a
  `Result<_, DbspError>` or throw on cap-hit, and plain
  `Nest` either removed or routed through the same failure
  path. (2) `src/Core/Primitive.fs:10-22` (DelayOp) and
  `src/Core/Recursive.fs:40-85` (FeedbackOp) — no
  `ClockStart` override; `state` / `initial` survives
  across outer ticks, breaking DBSP §5-6 inner-scope
  semantics (`circuit-recursion/spec.md:66-75` observable
  scenario). Latent today because no test exercises
  `Delay` / `Integrate` / `Recursive` / `Feedback` inside a
  `Nest(...)` scope — silently broken the moment a consumer
  does. (3) **Spec gap** — no requirement states HOW strict
  operators observe "clean tick-0 semantics" on each outer
  tick; `operator-algebra/spec.md:420-423` says
  `ClockStart` **MAY** initialise per-scope state; the
  observable scenario depends on it being **MUST**. Write
  a SHALL: strict operators inside a nested scope MUST
  reset state latched in the prior outer tick to their
  declared initial value in `ClockStart`. **Six P1s**: (1)
  `src/Core/Circuit.fs:113-119` `Register` throws after
  `Build`; `operator-algebra/spec.md:496-519` requires
  atomic-against-stepping topology mutation — either the
  spec overstates or the code under-implements. (2) No
  implementation of async-replacement-waits-for-outstanding-
  tick-t continuations (`operator-algebra/spec.md:533-544`).
  (3) `NestedCircuit.fs:22-23,49` — cap default `64` is
  in-code-documented but absent from
  `profiles/fsharp.md`; `circuit-recursion/spec.md:138-141`
  requires public-surface documentation. (4) Two specs
  disagree on cap-hit semantics: `circuit-recursion` allows
  passive-observable-handle reading, `operator-algebra`
  requires active failure — rebuild is non-deterministic.
  (5) `operator-algebra/spec.md:420-421` "MAY initialise
  per-scope state" on `ClockStart`/`ClockEnd` is the
  root-cause wording for the P0-3 spec gap. (6)
  `profiles/fsharp.md` has no entry for `NestedCircuit` /
  `IterateOp` / cap-default / `FeedbackOp`-to-requirement
  mapping. **Three P2s**: complexity belongs in profile
  not base (`spec.md:615-625`); redundant "including under
  retractions" clause at `:549-555`; driver-is-linear
  classification (`circuit-recursion/spec.md:232-265`)
  lacks observable predicate. **Owner:** Architect drafts
  closures; Viktor re-audits each. **Effort:** M (spec
  rewrites + code changes on DelayOp/FeedbackOp/
  NestedCircuit + profile backfill). **Defers to Round 44.**
  Full Viktor report captured in session history; verdict
  string preserved verbatim: *"Third data-point breaks the
  two-ship pattern. The pattern was convenient. The specs
  are not strong enough yet."*

- [x] ✅ **Router-coherence ADR `47d92d8` supersedure — harsh-critic
  findings absorb** — **shipped round 41 in-round** via v2 ADR
  `docs/DECISIONS/2026-04-21-router-coherence-v2.md` (`09f0889`)
  + v1 Superseded-by header (`4efe545`). All 10 findings closed
  via named textual closures C-P0-1 through C-P2-10; Kenji named
  as binding dispatcher (C-P1-8); escalation timebox prevents
  reproduction of 23-round-stale failure mode (C-P1-7). Follow-up
  SKILL.md edits to `claims-tester` + `complexity-reviewer` via
  `skill-creator` remain round-42 scope, now targeting v2 as
  intended. Original finding narrative preserved below for audit
  trail. — Round 41 landed ADR
  `docs/DECISIONS/2026-04-21-router-coherence-claims-vs-
  complexity.md` (Hiroshi analytic ↔ Daisy empirical two-stage
  pipeline) without the adversarial-review gate the project
  applies to other load-bearing artefacts. Post-landing
  harsh-critic pass (Kira) surfaced **3 P0 + 5 P1 + 2 P2**
  substantive findings. Because the ADR is already cited as
  Standing Resolution in `docs/CONFLICT-RESOLUTION.md`
  (Hiroshi ↔ Daisy row), inline-editing would invalidate the
  external reference chain; absorb via supersedure ADR under a
  new date with explicit "supersedes `47d92d8`" header.
  Findings to absorb: **P0-1** grandfather clause (§Stage 2
  trigger list "a claim landed without Stage 1 (grandfathered
  pre-ADR work)") is unscoped — no inventory, no owner, no
  cadence for discharging the grandfather set; **P0-2** the
  decision table row "Performance regression in CI | Daisy
  (Stage 2) | Hiroshi (Stage 1) **if measurement contradicts
  bound**" is conditional on Hiroshi re-engagement, but the
  prose "Reverse trigger" section promises unconditional
  Stage-1 follow-up — table contradicts prose; **P0-3** Stage-1
  output 2 ("Claim analytically wrong") forbids Stage-2
  measurement "until the code is fixed", which blocks the
  escalation-evidence loop: when Hiroshi and Daisy disagree,
  the conference protocol needs Daisy's contradictory
  measurement as evidence, but this clause forbids producing
  it. **P1-4** Status header says *Proposed — awaits Architect
  + human-maintainer sign-off* but `docs/CONFLICT-RESOLUTION.md`
  already cites the ADR as Standing Resolution — the ADR is
  self-inconsistent about its own promulgation state.
  **P1-5** Stage-1 trigger list ("XML doc comment, README,
  `docs/BACKLOG.md`, `docs/TECH-RADAR.md`, paper draft,
  `openspec/specs/**`") is narrower than what
  `.claude/skills/claims-tester/SKILL.md` line 3 already
  promises to cover — the contract narrows one skill's scope
  without citing the skill's own source. **P1-6** Decision
  table row "Docstring lacks which bound" has only a Stage-1
  entry and an em-dash under Stage-2; the prose Stage-1 output
  3 says "Return to author" — the table loses the
  author-bounce information. **P1-7** Escalation clause has
  no timebox; Aarav's own finding the ADR closes sat
  unresolved for 23 rounds precisely because escalation had
  no timebox — the ADR reproduces the failure mode it
  diagnoses. **P1-8** Both skills remain Advisory ("Does not
  change either skill's tone or reviewer authority. Both
  remain advisory"); two advisory roles do not compose to a
  mandatory two-stage pipeline without a binding dispatcher
  — needs explicit "Architect (Kenji) is the binding
  dispatcher for this pipeline" clause. **P2-9** Example-bug
  in the analytic-vs-empirical table (lines 64-66): inner
  `Dictionary.Remove` is cited as "`O(k)` under adversarial
  rehashing" but `System.Collections.Generic.Dictionary<K,V>`
  `Remove` is `O(1)` amortised under the BCL contract; the
  example is wrong on the standard library. **P2-10**
  "Precedent for future analyst/falsifier pairs (e.g.
  `verification-drift-auditor` vs `formal-verification-expert`
  on spec-to-code claims) — the two-stage pattern is
  reusable when the same shape appears elsewhere" is scope
  creep that pre-commits the project to applying the
  pattern before a second instance actually surfaces.
  Target: `docs/DECISIONS/2026-04-??-router-coherence-v2.md`
  supersedes `47d92d8`, closes all 10 findings, keeps the
  citation chain live by leaving `47d92d8` in place with a
  "Superseded by …" header appended per `GOVERNANCE.md §2`
  (edit-in-place for doc state, narrative carried in the new
  ADR). Owner: Architect drafts; Kira (harsh-critic) audits
  the supersedure to confirm findings closed; Aarav
  (skill-tune-up) confirms router-coherence drift stays
  closed after the two SKILL.md edits land. Effort: M
  (~200 lines of new ADR prose + one header append + two
  SKILL.md edits via `skill-creator`). Schedule: Round 42
  slot after Prereq 1 (TLC wire-up) lands. Cross-ref:
  supersedure work blocks the claims-tester + complexity-
  reviewer SKILL.md updates that ADR `47d92d8` follow-up
  work depends on — those edits should target the v2 ADR,
  not v1, so supersedure lands first.

- [ ] **Grandfather `O(·)` claims discharge — one per round** —
  35 pre-ADR `O(·)` claims catalogued at
  `docs/research/grandfather-claims-inventory-2026-04-21.md`
  per v2 Closure C-P0-1. Cadence: one claim per round through
  the router-coherence v2 pipeline (Stage 1 analytic by Hiroshi,
  `complexity-reviewer` → Stage 2 empirical by Daisy,
  `claims-tester`). On each discharge, the inventory row's
  Stage-1 and Stage-2 cells flip from `pre-ADR` to the relevant
  output state (`sound` / `wrong` / `under-specified` /
  `measurement-matches` / `measurement-contradicts` /
  `workload-narrowed`). Empty inventory closes the entry
  (expected round ≈ 76 at one-per-round cadence, sooner under
  batching). Priority: P2. Effort per claim: S. Total effort:
  ~35-round tail. Owner: Architect selects the round's claim;
  Hiroshi + Daisy execute. Surface concentration: 29 F#
  docstrings (83%), 3 grey-zone F# code comments, 1
  `openspec/specs/operator-algebra/spec.md` line, 2
  `docs/research/**` claims. Graceful-degradation clause:
  Aarav files a P1 drift finding if no claim is discharged
  for ≥3 consecutive rounds without declared pause reason.
  **Latent blocker (Round 43):** the cadence names
  `complexity-reviewer` (Hiroshi) and `claims-tester`
  (Daisy) as executors, but neither persona file exists
  under `.claude/agents/` — only `performance-engineer`
  (Naledi) is present on the perf-adjacent roster, and
  memory explicitly marks Naledi as **distinct** from
  Hiroshi (Naledi: benchmark-driven hot-path tuning;
  Hiroshi: asymptotic-complexity analysis). Consequence:
  the discharge queue cannot advance through the v2
  pipeline as written. Resolution options: (a) land the
  two persona files via the `skill-creator` flow, (b)
  amend the v2 ADR to route discharge through Naledi +
  a claims-tester-acting role with a role-acting note,
  (c) declare an explicit pause on the cadence until (a)
  or (b) lands (with a documented reason, so Aarav's
  drift-finding clause doesn't fire). No round-43
  discharge landed.

- [ ] **Fully-retractable CI/CD** — Aaron 2026-04-19: *"fully
  rtractable ci/ci backlog item"* → *"ci/cd"*. Apply the
  retractability clause of the Zeta=heaven formal statement
  (`docs/research/zeta-equals-heaven-formal-statement.md` §2
  H₂ "fully-retractable") to the factory's own CI/CD pipeline.
  The factory asks downstream code to be retraction-native;
  the pipeline that gates downstream code should meet the same
  bar. Today several CI/CD surfaces are partially retractable
  in practice but not by declared mechanism — that's the
  channel-closure h₂ attack shadow applied to delivery infra
  (`docs/security/THREAT-MODEL.md` §"Channel-closure:
  retractability (h₂)"). Scope: (a) inventory every CI/CD
  surface (gate.yml + submit-nuget.yml + release workflows +
  any branch-protection rule + any signing-key use + any
  published artefact) and name its retraction mechanism —
  revertable-in-git, retryable-idempotently, republishable-
  with-same-version, or *genuinely non-retractable* (key
  rotation after compromise; a tag that was pushed and
  consumed); (b) for each non-retractable surface, flag
  whether a retraction-window-declaration is possible
  (e.g. a revocation CRL, an unpublish window, a rotation
  drill cadence); (c) where no retraction mechanism is
  possible, treat the surface as a named exception with
  defender-persona ownership (analogous to the no-empty-dirs
  allowlist); (d) land the declared mechanism as a comment
  block per workflow file; (e) add a CI-retractability
  audit job that fails the build if a new workflow file
  lands without a declared retraction mechanism (the lint-
  as-control graduation the channel-closure section
  calls for). Owner: Dejan (DevOps) integrates; Nazar
  (security-operations-engineer) on signing-key + artifact-
  attestation surfaces; Aminata (threat-model-critic) audits
  the inventory adversarially for "claims retractability but
  no tested path"; Architect gates. Effort: M (wide-surface
  inventory + audit-job drafting; no new paradigm, just
  applying a primitive the factory already committed to).
  Part (a) landed Round 38:
  `docs/research/ci-retractability-inventory.md` — 13 surfaces
  classified, named-exception register with defender-persona
  owners. Parts (b)-(e) remain open.
- [ ] **Memory folder restructure: `memory/role/persona/`** — Aaron
  2026-04-19: *"can we add a memory 2nd level folder so it's
  memory/role/persona that makes roles fist class defined of what
  we need too in the memory definition"*. Today persona notebooks
  live flat under `memory/persona/<name>/NOTEBOOK.md`. Aaron wants
  roles elevated to a first-class directory level: e.g.
  `memory/security/aminata/NOTEBOOK.md`,
  `memory/verification/soraya/NOTEBOOK.md`,
  `memory/architect/kenji/NOTEBOOK.md`. Makes the role taxonomy
  self-documenting from `ls memory/`. **Round 41 status: design
  plan landed** at `docs/research/memory-role-restructure-plan-
  2026-04-21.md` — proposes 13-directory role axis (architect,
  security, verification, review, experience, api, performance,
  devops, algebra, skill-ops, maintainer, homage, alignment),
  crosswalks every current persona, lays out a 5-phase atomic-
  commit execution plan with 114 files / ~260 hand-written
  references to update plus 3 phase-4 verification passes.
  Execution awaits Aaron's sign-off on the role axis (four open
  questions in §"Open questions for Aaron"). Recommended
  execution slot: Round 42 opener, after Round 41 PR merges, to
  keep wide-surface reviews from overlapping. Owner: Kenji
  integrates; Aarav (skill-tune-up) audits post-rename for BP-
  drift; Daya (agent-experience-engineer) spot-checks cold-start
  pointer resolution. Effort: M (2 hours mechanical + wide-
  surface verification).
- [x] ✅ **No-empty-dirs gate** — shipped round 35 after Aaron:
  *"we need a build script that will fail the build if it detects an
  empty folder ... we should ci that ... dev scripts for canonical
  building"*. New: `tools/lint/no-empty-dirs.sh` (portable to macOS
  bash 3.2) + `tools/lint/no-empty-dirs.allowlist` + gate.yml
  `lint (no empty dirs)` job + doctor.sh step 6. Catches the class
  of regression where an agent-mkdir'd skill/research folder ships
  without its real file. Respects `.gitignore`; excludes
  `references/upstreams/**`, build caches, and the two legitimate
  scratch dirs (`tools/alloy/classes`, `tools/tla/specs/states`)
  via explicit allowlist with reason comments.
- [ ] **Empty-folder fix-on-main sweep** — periodic allowlist
  review. Currently two entries are load-bearing runtime-output
  paths (Alloy compile classes, TLC state output). If either one
  ever gets populated by a checked-in artefact that belongs
  elsewhere, the allowlist entry should be dropped rather than
  silently accumulated. Review cadence: once per 10 rounds, or
  whenever `no-empty-dirs.sh --list` flags a new allowlisted
  entry. Owner: Dejan (DevOps) advisory; Architect integrates.
  Effort: S.
- [x] ✅ **Fix SpeculativeWatermark retraction-native logic** — harsh-
  critic round #5 (shipped round 17: swapped direction check so
  late positive inserts trigger retract-of-old + insert-of-corrected).
- [x] ✅ **Fix ClosurePair Equals/GetHashCode mismatch** — harsh-critic
  #11 (shipped round 17: both Equals and GetHashCode now use
  `EqualityComparer<'N>.Default`).
- [x] ✅ **Fix `RecursiveSemiNaive` monotonicity violation in Hierarchy**
  — harsh-critic #2 (shipped round 17: `ClosureTable` now uses
  retraction-safe `Recursive` combinator; `RecursiveSemiNaive`'s
  monotonicity precondition is documented in its XML doc).
- [x] ✅ **Residual.fs rebuildFromIntegrated is O(n), not O(1)** —
  harsh-critic #3 (shipped round 17: rewritten with `SortedSet` +
  `Dictionary` so every op is honestly O(log k); no more fallback
  scan).
- [x] ✅ **Residuated.fs integrated Z-set grows unbounded** — harsh-
  critic #4 (shipped round 17: state is now (SortedSet, Dictionary)
  pair, both tracking only active keys — no more unbounded
  integrated history).
- [x] ✅ **FastCdc.fs O(n²) buffer scan** — harsh-critic #7 (shipped
  round 17: added persistent `scanCursor` + `hash` state; each byte
  hashed exactly once across lifetime).
- [x] ✅ **FastCdc.fs allocation-per-chunk** — harsh-critic #8 (shipped
  round 17: `Buffer.BlockCopy` instead of byte-by-byte loop; raw
  `byte[]` buffer with head/tail pointers replaces `ResizeArray`).
- [x] ✅ **Ship tests for Hierarchy/FastCdc/Merkle/ResidualMax/BloomFilter**
  — harsh-critic #28 (shipped round 17: 22 new tests in
  `Round17Tests.fs`; total suite 471 passing).
- [ ] **Witness-Durable Commit mode** — skeleton shipped round 17
  (`src/Core/Durability.fs` DU + `WitnessDurableBackingStore`
  placeholder). Full protocol impl blocked on the WDC paper peer-
  review rebuttal; see `docs/papers/WDC-rebuttal.md`.
- [x] ✅ **SpeculativeWindow test coverage** — shipped round 34 in
  `tests/Tests.FSharp/Operators/SpeculativeWatermark.Tests.fs`
  (retraction-native speculative watermark emission; direct
  `c.SpeculativeWindow` tests, not just the old Round17Tests
  integration coverage).
- [x] ✅ **ArrowInt64Serializer tests** — shipped round 34 in
  `tests/Tests.FSharp/Storage/ArrowSerializer.Tests.fs`
  (empty / single-entry / negative-weight round-trips, larger
  Z-set, length-header wire format, serializer-name identity).
  Harsh-critic #28 remainder closed.

## Research projects

- [ ] **Overnight autonomous factory operation via scheduled
  hygiene tasks.** Vision: while the human maintainer sleeps,
  the factory runs advisory hygiene passes and queues findings
  for morning triage — no code lands without a human review
  on wake. Two-phase research:

  **Phase 1 — Claude-specific prototype** (round-35+). The
  Claude Code harness exposes an MCP-backed `scheduled-tasks`
  server (see `.claude/scheduled_tasks.lock` in-session proof)
  with `create_scheduled_task` / `list_scheduled_tasks` /
  `update_scheduled_task` tools plus a `schedule` skill. Design
  which hygiene passes make sense as cron-driven scheduled
  tasks, NOT as code-landing tasks:
  - Safe candidates: `factory-audit`, `factory-balance-auditor`,
    `skill-tune-up`, `skill-gap-finder`,
    `project-structure-reviewer`, `package-auditor` (Malik's
    audit), CVE feed scan (Mateo's scouting), markdown + link
    drift scan. All advisory; outputs land as BACKLOG entries
    / DEBT flags / findings reports.
  - Unsafe (do NOT schedule): any code-landing skill,
    `bug-fixer`, anything that pushes to main, anything that
    closes a PR, anything that modifies specs or proofs. The
    reviewer floor is a live-human construct; automation does
    not substitute.
  - Scheduling shape: one cron per safe pass, cadence matching
    the pass's documented review cadence (e.g., `skill-tune-up`
    weekly; `package-auditor` weekly; CVE feed scan daily;
    `factory-balance-auditor` every two weeks). Output is a
    finding report written to `docs/nightly/<YYYY-MM-DD>-
    <skill>.md` or appended to BACKLOG with a `nightly:` tag so
    the Architect can grep-triage in the morning.
  - Safety rails: every scheduled prompt starts "READ-ONLY
    AUDIT; DO NOT LAND CODE; DO NOT PUSH; WRITE FINDINGS TO
    <path>" so a misconfigured task can't escape.
  - Human sign-off before any task is created. Aaron reviews
    the scheduled-task design doc first; each task gets listed
    with its cron expression, scope, and write path.

  **Phase 2 — cross-harness portability** (post-Phase 1).
  Scheduled-task features vary by harness (Cursor, Windsurf,
  Aider, Cline, Continue, Codex may or may not have this; the
  Claude-Desktop / Claude-Code "Routines" UI is a separate
  user-facing feature distinct from the MCP). Research:
  - Which harnesses support scheduled / cron / routine
    triggers natively?
  - For harnesses without, what's the portable shim — GitHub
    Actions schedule-triggered workflows that `gh`-invoke a
    harness-specific agent CLI?
  - Does the factory need a generic "schedule-me" skill
    interface that each harness implements its own way (same
    shape as the cross-harness-mirror-pipeline entry in this
    BACKLOG)?

  **Effort.** Phase 1: 1 round for design doc + 1 round for
  first scheduled task landing with one week of observation
  before adding more. Phase 2: open-ended research project.
  Advisory authority: Dejan (automation-adjacent) +
  prompt-protector (every scheduled prompt is an injection
  surface if the output path isn't tight). Architect
  integrates; human maintainer signs off on each scheduled
  task individually.

- [ ] **Retraction-safe semi-naïve LFP — gap-monotone variant**.
  `docs/research/retraction-safe-semi-naive.md`. Top-2 candidates:
  (1) signed-delta ("gap-monotone") — 10-14 engineer-days, needs a
  ~200-line TLA+ spec + TLC model-check + `RecursiveSignedSemiNaive`
  impl + Z-linearity guard + regression oracle. (2) Gupta-Mumick
  counting algorithm — 8-12d, simpler TLA+ proof, also unlocks
  path-counting / provenance-weight queries. Shares ~50% code with
  (1). Plan: ship (2) first as `CountingClosureTable`, land (1)
  after as `RecursiveSignedSemiNaive`. Promotes `ClosureTable` off
  the current O(|integrated closure|) per-iteration fallback.

  **Round 41 status**: Soraya (formal-verification-expert)
  tool-coverage audit closes the Round-39 holdover gate (see
  `memory/persona/soraya/NOTEBOOK.md` round-41 entry). The
  skeleton `src/Core/RecursiveSigned.fs` + TLA+ spec
  `tools/tla/specs/RecursiveSignedSemiNaive.tla` earn a
  **CONDITIONAL PASS** for Round-42 graduation subject to four
  tool-coverage prereqs (listed in priority order):
  - [ ] **Prereq 1 — TLC CI wire-up.** Originally sized S under
    the assumption of a pre-existing TLC CI job; round-41
    close-out audit found **no TLC job exists today**.
    `gate.yml` caches the `tla2tools.jar` + `alloy.jar`
    artefacts (lines 80-89) and `install.sh` installs them, but
    nothing runs them. Actual scope: (a) write
    `tools/tla/run-tlc.sh` driver accepting a spec + `.cfg`
    pair; (b) add a `tlc` job to `.github/workflows/gate.yml`
    that runs the driver against BOTH `RecursiveCountingLFP.cfg`
    (currently unchecked despite being shipped round 19!) AND
    `RecursiveSignedSemiNaive.cfg` so S1/S3/S3'/SupportMonotone
    + TypeOK are checked on every commit; (c) handle state-
    output directory lifecycle (`tools/tla/specs/states/` is
    already allowlisted in `no-empty-dirs`); (d) wire a concurrency
    group so TLC doesn't run in parallel with itself on the same
    spec. **Revised effort: M** (not S). Finding: a TLA+ spec
    shipped round 19 has been *compile-checkable only* for 22
    rounds without an explicit run gate — silent drift risk
    that Prereq 1's existence was meant to catch and did.
    Unblocks Prereqs 2-4.
  - [ ] **Prereq 2 — Z3 QF_LIA lemma for S2 (FixpointAtTerm).**
    S2 is the one P0 on the spec (silent fixpoint drift
    corrupts downstream `total`, unrecoverable); BP-16 requires
    two independent tools on P0 claims, so TLC alone is
    insufficient. Z3 discharges the pointwise identity
    `total = Seed + Body(total)` at arbitrary SeedWeight
    independently of TLC's bounded-state enumeration. Lands in
    `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`. Effort: S.
  - [ ] **Prereq 3 — FsCheck property for S4 (sign-distribution).**
    Two-trace quantification `total(-w) = -total(+w)` is NOT a
    TLA+ property (TLC would need O(states^2) over the product
    state space of two runs); FsCheck executes two real runs in
    milliseconds. Anti-TLA+-hammer per Soraya's audit. Effort: S.
  - [ ] **Prereq 4 — FsCheck cross-trace refinement
    (signed vs counting at SeedWeight = 1).** Refinement mapping
    to the shipped `RecursiveCountingLFP` sibling; runs both
    combinators on same (seed, body), asserts
    `counting.closure[k] = signed.total[k]` per tick. Cites BP-16
    (two independent tools on a P0-adjacent claim). Lives in
    `tests/Tests.FSharp/Formal/`. Preferred over a TLA+
    refinement proof (L effort, over-broad) or Lean lemma
    (no counting counterpart lifted). Effort: S.

  **Round-42 graduation gate**: prereqs 1-4 CI-green **plus** F#
  implementation landed by round-42 author matching the planned
  signature in `RecursiveSigned.fs` header, with P1 Z-linearity /
  P2 sign-distribution / P3 support-monotone enforced at the
  caller (compile-time phantom type preferred). Optional
  round-42 follow-up: add `PROPERTY EventuallyDone` to the `.cfg`
  for the liveness claim (not a blocker).
- [ ] **`formal-analysis-gap-finder` round-42 run — verifier-runs-
  not-just-present lens.** Round-41 Prereq-1 audit surfaced a
  general drift class distinct from any individual spec: a
  verifier's *installation artefacts* (jars cached in
  `.github/workflows/gate.yml`, install hooks in
  `tools/setup/install.sh`) do not imply the verifier is
  *exercised* by any CI job. Concrete finding:
  `tools/tla/specs/RecursiveCountingLFP.tla` has been
  compile-checkable-only since round 19 (22 rounds of silent
  drift potential) because no job ever invokes TLC. This is
  exactly the class `formal-analysis-gap-finder` exists to
  surface — "properties without a formal artefact" generalises
  to "formal artefacts without a runtime gate". Scope for the
  round-42 pass:
  - Audit every spec under `tools/tla/specs/**`,
    `proofs/lean/**`, `tools/lean4/**`, `tools/alloy/**`, and
    any Z3 smt2 artefacts for the presence of a matching CI
    invocation. Report each orphaned spec as a finding.
  - Check the reverse direction: does every verifier jar /
    binary cached or installed have at least one job that runs
    it? If not, either the jar is dead weight or a spec is
    missing a gate.
  - Cross-cite BP-16 (two independent tools on P0 claims) — a
    spec with no runtime gate cannot participate in a BP-16
    cross-check even if it exists as a file.
  - Hand off property-class-to-tool recommendations to Soraya
    (`formal-verification-expert`) per the skill's standing
    contract. Do **not** write the spec or the CI job; those
    are Soraya + DevOps work.
  Effort: S (advisory pass; one scratchpad write).
  Schedule: first round-42 slot available after Prereq 1 lands
  (so the audit sees the corrected state, not the compile-only
  state). Owner for invocation: Architect. Consumer of findings:
  Soraya + BACKLOG.
- [ ] **CQF (Counting Quotient Filter) trial** to replace the
  4-bit counting Bloom saturation issue. Pandey et al. SIGMOD'17.
  Our `CountingBloomFilter` saturates at 15; CQF uses
  variable-width counters (grows into empty slots). Port effort:
  5-8d. Includes: trial port, benchmark vs current counting
  Bloom, round-18 TECH-RADAR promotion if it wins.
- [ ] **Ceramist → Lean Mathlib port of probability lemmas**.
  Ceramist is the only existing formal-proof corpus for AMQ
  correctness (Coq, ITP'20 / CAV'21). Port the counting-Bloom
  soundness lemma to `proofs/lean/BloomFilter.lean`. Effort:
  2-3 weeks (mostly Mathlib onboarding).
- [ ] **Probabilistic-data-structure research sweep.** Zeta
  already ships `BloomFilter.fs` + a `CountingBloomFilter`
  and `Sketch.fs` with HLL / CountMin / KLL. The broader
  family is a deep research well and every member deserves
  a retraction-native analysis (can it be made delta-signed?
  does it converge under Z-set algebra? does it merge
  commutatively as a CRDT?). Target one paper-worthy
  contribution per structure where retraction-native is
  novel. Landing format: one `docs/research/pds-<name>.md`
  per entry; TECH-RADAR assessment on each. Owner:
  `probability-and-bayesian-inference-expert` +
  `algebra-owner` + `crdt-expert` (for the mergeable ones).
  - [ ] **Cuckoo filter** (Fan-Andersen-Kaminsky-Mitzenmacher
    2014 CoNEXT) — deletions without saturation. Compare
    to CQF on the counting-Bloom replacement.
  - [ ] **Xor filter** (Graf-Lemire 2020) — smaller than
    Bloom at same FPR, non-mutable post-build.
  - [ ] **Ribbon filter** (Dillinger-Hübschle-Schneider 2021
    / Facebook) — even better ratio; near-optimal.
  - [ ] **Bloomier filter** (Chazelle-Kilian-Rubinfeld-Tal
    2004) — key → small-value AMQ; powerful but niche.
  - [ ] **Quotient filter + Counting Quotient Filter
    (CQF)** — already backlogged above; keep in this
    sweep for coverage consistency.
  - [ ] **Morris counter** (Morris 1978) — approximate
    counting with logarithmic space; retraction-native
    version would be a primitive for Z-set cardinality
    sketches.
  - [ ] **HyperLogLog variants** — HLL++ (Heule-Nunkesser
    -Hall 2013), Sliding HLL, HyperBitBit (Sedgewick
    2016). Retraction-native HLL is already in our
    research pipeline; broaden the literature review.
  - [ ] **Count-Min sketch + Count-Sketch + Count-Mean-Min**
    — Cormode-Muthukrishnan 2005 + Deng-Rafiei 2007;
    retraction-native variants and when they beat CM.
  - [ ] **t-digest + DDSketch** — tail-accurate quantile
    sketches (Dunning 2013; Masson 2019). DDSketch merges
    commutatively — fits gossip-based distributed
    aggregation (see
    `.claude/skills/gossip-protocols-expert/SKILL.md`).
  - [ ] **KLL sketch** — Karnin-Lang-Liberty 2016; already
    in `Sketch.fs`, fill in retraction analysis.
  - [ ] **MinHash + SimHash + LSH** — Broder 1997 MinHash;
    Charikar 2002 SimHash; LSH family (Indyk-Motwani
    1998). Similarity / near-duplicate / streaming
    dedupe uses.
  - [ ] **Skip lists** — Pugh 1990; probabilistic balanced
    trees; natural fit for concurrent indexes.
  - [ ] **Treap** — Seidel-Aragon 1996; probabilistic
    balanced BST.
  - [ ] **Merkle trees + Merkle-Patricia / Verkle trees**
    — Merkle 1987; Verkle via vector commitments
    (Kuszmaul 2019). Already in use; document formally.
  - [ ] **Rolling-hash + FastCDC + Rabin fingerprinting**
    — already shipping in `FastCdc.fs`; broaden the
    literature review + benchmark vs ZFS / BorgBackup
    / rdedup.
  - [ ] **Learned Bloom filter** (Kraska et al. 2018
    *The Case for Learned Index Structures*) — ML-model
    pre-filter + Bloom backstop. Controversial; evaluate
    honestly vs classical AMQ under memory-error product.
  - [ ] **Sliding-window sketches** — exponential
    histograms (Datar-Gionis-Indyk-Motwani 2002),
    time-decayed sketches; natural fit for Zeta's
    window primitives.
  - [ ] **GK quantile sketch** (Greenwald-Khanna 2001) —
    deterministic quantile baseline; compare to t-digest /
    DDSketch.
- [x] **Finish Lean 4 + Mathlib chain-rule proof**. Closed
  round 35. `tools/lean4/Lean4/DbspChainRule.lean` (migrated
  round 23 from the retired `proofs/lean/ChainRule.lean`) is
  fully `sorry`-free: T5 (`I ∘ D = id`), B1
  (`linear_commute_I`), B3 (`linear_commute_D`), and
  `chain_rule` itself all verified by `lake env lean
  Lean4/DbspChainRule.lean` with zero warnings. B2
  (`linear_commute_zInv`) closed via the `IsTimeInvariant`
  predicate (B2 elevated to a structural axiom, with
  `IsPointwiseLinear → IsTimeInvariant` proven as a derivation
  theorem). Two statement-level bugs caught and fixed during
  the proof: (a) B1 had a pointwise-linearity leak in the
  `fun _ => s k` form — corrected to the stream equation
  `f (I s) = I (f s)`; (b) `chain_rule` had an impulse
  counter-example on the original bilinear form — corrected to
  the classical `Dop (f ∘ g) s = f (Dop g s)` that DBSP §4.2
  actually proves. See `docs/research/chain-rule-proof-log.md`
  for the full hierarchy and the discussion of both fixes.
  Follow-on `chain_rule_poly` over three distinct groups is
  tracked as a future-round research item (not blocking).
- [x] **LiquidF# refinement-types trial** — closed round 35 at
  Day-0: **Hold, tool dormant**. Superseded by the broader
  refinement-type feature catalog
  (`docs/research/refinement-type-feature-catalog.md`) which
  maps each LiquidHaskell / F\* feature to the best-fit tool in
  our portfolio and keeps a priority-ranked backlog of what we
  have not yet ported. Next three rows from that catalog —
  **#11 effect system**, **#21 client-side refinements**,
  **#13 separation logic (Pulse/Steel)** — are the forward
  work items. See `docs/research/liquidfsharp-findings.md`.
- [ ] **Feldera apples-to-apples benchmark**. Three concrete
  steps from `docs/research/feldera-comparison-status.md`:
  (a) `cargo build --release` in `references/upstreams/feldera/`,
  (b) write `bench/Dbsp.Feldera.Bench/FelderaRunner.fs` shell-out
  helper + `FelderaCompare.fs` diff harness,
  (c) port Nexmark Q3 (hash join) + Q7 (windowed top-1) on our
  side (Window.fs wiring pending). Target: measured numbers in
  `docs/BENCHMARKS.md` by end of round 20.

## P1 — SQL frontend + query surface (round-33 vision, v1 scope)

- [ ] **Shared query IR that compiles to the DBSP operator
  algebra.** The pattern `../SQLSharp/openspec/specs/query-
  frontends/spec.md` establishes: SQL-text parsing and
  integrated-query (LINQ) both lower to one logical
  planning pipeline. Zeta needs the same convergence point.
  Design-doc round before code.
- [ ] **LINQ integration (`IQueryable<T>` roots).** Mapped-
  table query roots + property-to-column descriptors per
  SQLSharp's shape. Lowers to the shared query IR.
  First v1 surface consumers will touch.
- [ ] **SQL parser with multi-dialect support.** Dialects to
  target: T-SQL, PostgreSQL, MySQL, SQLite, DuckDB. Shared
  parser front-end + dialect overlays per
  `../SQLSharp/openspec/specs/language-and-extension-model/`
  pattern. Aaron round 33: "we also want to target many
  different SQL dialects."
- [ ] **Entity Framework Core provider.** Zeta ships an EF
  Core provider so EF consumers get DBSP incremental query
  plans for free. Aaron: "work tightly with entity framework,
  then branch out to other ORMs." First-class v1.
- [ ] **F# DSL reimagining SQL for the modern era (HUGE,
  multi-round).** Extends the existing `circuit { ... }`
  computational-expression seed. Natively retraction-aware,
  bitemporal-ready, incremental-by-default. Aaron round 33
  flag: "sounds like we need design and research, this
  task sounds HUGE." Spread across multiple rounds:
  Round N: research what modern SQL should look like
    (compose-ability, retraction syntax, time-travel
    primitives, type-system integration with F#
    discriminated unions). Survey languages that tried
    (Rel/Tutorial D, Datalog family, LINQ, Kleppmann's
    "Rethinking relational" talks, relational algebra
    type theory).
  Round N+1: design doc with syntax sketch.
  Round N+2: paper-peer-reviewer pass.
  Round N+3+: implementation + fit-check against existing
    circuit/Op algebra.
  Output: sequence of `docs/research/f-dsl-*.md` docs
  then `openspec/specs/f-dsl-surface/` once shape
  stabilizes.

- [ ] **Pluggable wire-protocol layer with PostgreSQL +
  MySQL + Zeta-native plugins.** Aaron round 33: "can
  we make the wire protocol pluggable and we could just
  support MySQL too to make sure we can support
  [multiple] and have our own variant so we can start
  getting support for UIs with our protocol which will
  be much better." Design the protocol-plugin
  abstraction first; one adapter per protocol (auth,
  message encoding, error mapping, connection-state
  machine). Initial plugins:
  - PostgreSQL plugin: pgAdmin / DBeaver / psql /
    Npgsql-via-EF compatibility. Precedent:
    CockroachDB, Materialize, YugabyteDB, Apache AGE.
  - MySQL plugin: MySQL Workbench / Connector/NET /
    Pomelo-via-EF / Azure Data Studio compatibility.
    Second plugin proves the abstraction isn't
    PostgreSQL-shaped by accident.
  - Zeta-native plugin: designed around retraction-
    native deltas, bitemporal queries, durable-Rx
    stored procedures. Future UIs that speak it get
    first-class Zeta features (time-travel slider,
    delta streaming, Rx inspection) the emulated
    protocols can't express.

  v1-or-early-post-v1 depending on design round
  outcome. Output: `docs/research/pluggable-wire-
  protocol-design.md` first, then per-plugin design
  docs.

- [ ] **Own admin UI (far future).** Aaron round 33: "we
  will need some UI that can connect to it like SSMS or
  PostgreSQL Admin, so we will have to build our own
  (which we will eventually do)." Stack choice is open
  — Fable + Elmish (F# + web), SAFE Stack (F# full-
  stack), Blazor (C# + WebAssembly), or Avalonia
  (native F#/C#). Signals the polyglot story. Deferred
  until `Zeta.Core` v1.0 ships and server mode is
  stable. Research round first.
- [ ] **Additional ORM providers (post-EF).** Dapper,
  NHibernate, LLBLGen, etc. After the EF provider lands
  and the pattern is understood.

## P2 — Post-v1 query-surface research

- [ ] **Reaqtor-inspired durable-Rx "stored procedures"
  design doc.** Microsoft's Reaqtor (MIT, dormant-but-stable,
  reaqtive/reaqtor on GitHub) ships serializable expression
  trees + a query engine that persists operator state across
  restarts — durable Rx. Reaqtor is push/event-at-a-time
  with no native retraction; the Zeta niche is "Rx +
  durability + retraction-native" (a Reaqtor-shaped hole
  nobody has filled). Research questions: (a) does the
  `IReactiveQbservable<T>` surface shape translate to DBSP
  Z-set deltas cleanly? (b) what does the URI-keyed
  operator vocabulary look like against Zeta's operator
  algebra? (c) `OnError/OnCompleted` vs
  `Result<_, DbspError>` — keep our error model? (d) is
  this a Zeta feature or a separate library on top?
  Output: `docs/research/reaqtor-shape-for-zeta.md`.
- [ ] **Bitemporal + time-travel queries as a first-class
  v2 surface.** Append-dated history with retraction-aware
  point-in-time queries. Paper-worthy. Aaron round 33:
  "yes I want this haha." Needs design round on storage
  shape (append-dated rows vs versioned Spine), query
  syntax (`AS OF TIMESTAMP` vs F# DSL primitives), and
  retraction semantics under time-travel.

- [ ] **Regular-database façade over the event-sourcing
  core.** Aaron round 33: "a facade/abstraction so this
  can be used like a normal non eventing database as well,
  it should be both, i can replace my database and my
  event store with Zeta." The DBSP engine (retractions,
  deltas) runs underneath; the façade presents normal
  `tables + rows + SELECT/INSERT/UPDATE/DELETE` surface.
  Same operator algebra + query IR feeds both modes.
  Design questions: (a) is the façade a separate NuGet
  package consuming Zeta.Core, or the default surface
  with event-sourcing as opt-in? (b) how does the façade
  map INSERT/UPDATE/DELETE to DBSP deltas without
  leaking retraction semantics? (c) transaction model —
  same as event mode or distinct? Output:
  `docs/research/db-facade-design.md`.

- [ ] **Columnar storage substrate** alongside row-oriented
  Spine. Aaron round 33: "likely column columnar stuff."
  Workload fit: OLAP, analytics, wide-row sparse-
  projection, large-scan aggregation. Needs design round
  on integration with DBSP operator algebra (can a
  retraction-native columnar store expose Z-set deltas?)
  and on how the planner picks row vs column storage per
  query. References: DuckDB, Apache Arrow, Parquet,
  ClickHouse, Feldera. Priority post-v1 — v1 ships
  row-oriented Spine first, columnar follows.

## P1 — Factory / static-analysis / tooling (round-33 surface)

- [ ] **Secret-handoff protocol — env-var default + password-
  manager CLI for stable secrets + Let's-Encrypt/ACME for certs
  + PKI-bootstrap deferred (round 44 auto-loop-33 absorb)** —
  maintainer 2026-04-22 auto-loop-33 shape-preference:
  *"i like env vars and the password manager cli that's pretty
  cool, I use LastPass do they have a cli, I can setup an account
  with the 1pass or whatever you showed yesterday, we want to do
  lets-encrypt and ACME that makes things so sinmple, we can
  bootstrap PKI another time"*. Triggered by mid-tick inline API-
  key paste event on the xAI / Grok thread (auto-loop-33 chat),
  which exposed the factory gap: no documented human-operator →
  agent secure secret-handoff protocol. Occurrence-1 research
  anchor already published at
  `docs/research/secret-handoff-protocol-options-2026-04-22.md`
  (five-tier taxonomy, rotation/revocation/leak-mode map,
  explicit three-axis argument for git-crypt being the wrong fit:
  history-is-forever + key-distribution-isomorphic + wrong-
  granularity). **Scope confirmed by maintainer:** (a) env-var
  for ephemeral / dev-loop secrets (tier-1); (b) password-
  manager CLI (1Password `op` preferred — LastPass dropped due
  to 2022 vault-exfiltration breach) for stable secrets (tier-3);
  (c) Let's-Encrypt + ACME for certificate-layer issuance —
  factory defaults to automated-issuance unless a use-case
  *specifically* needs a private CA; (d) PKI-bootstrap (root CA
  ceremony, key-material protection, attestation provisioning,
  revocation infra) explicitly deferred — scope-tag holds.
  **Proposed helper shape** from the research doc:
  `zeta secret {put|get|rotate|list|launch}` with backend
  selection defaulting to macOS Keychain on darwin / libsecret
  on linux / 1Password CLI when `ZETA_SECRET_BACKEND=1password`
  / dotenv when `ZETA_SECRET_BACKEND=dotenv`. `zeta secret
  launch <cmd>` shells out with secrets injected into env, never
  written to disk. **Four-phase work queued:** (1) **Codify the
  protocol** — promote the research doc to
  `docs/DECISIONS/YYYY-MM-DD-secret-handoff-protocol.md` once a
  second genuine handoff event occurs (occurrence-2 discipline),
  or land the ADR immediately if maintainer prefers ahead-of-
  evidence codification. (2) **1Password account setup** —
  maintainer-owned, factory can recommend service-account model
  for CI-side access but maintainer provisions; gates phase 3.
  (3) **Ship `tools/secrets/zeta-secret.sh`** implementing the
  command surface + backend dispatch. S-M effort. Keep shape
  portable across macOS / linux / CI runner / devcontainer per
  GOVERNANCE §24. (4) **ACME scaffold** — stub factory-side
  ACME-client wiring (or route through `certbot` / `acme.sh` /
  `win-acme`) for any use-case that grows out of the factory
  needing a publicly-trusted cert. Sibling to (3), not blocker.
  **What this is NOT:** NOT a commitment to ship a PKI this
  round (PKI-bootstrap deferral intact); NOT a rollout of ACME
  across factory surfaces (scaffold-on-demand); NOT a
  replacement for direct-maintainer-paste as an emergency path
  (tier-5 = incident not protocol, handled via rotate-
  immediately discipline, already applied to auto-loop-33 xAI
  paste). **Reviewer routing:** Nazar (security-operations) on
  the secret-handling surface, Dejan (devops) on the helper-
  script + CI-runner path, Aminata (threat-model-critic) on
  the leak-mode matrix, Samir (docs) on the ADR when promoted.
  **Maintainer-background composition:** the choice of ACME
  over private-CA is informed by the maintainer's Itron
  experience authoring nation-state-resistant PKI + secure-
  boot attestation on the RIVA smart-meter platform (see
  `memory/user_aaron_itron_pki_supply_chain_secure_boot_background.md`,
  out-of-repo maintainer context); it is a veteran's judgment
  that automated-issuance + protocol-driven rotation beats
  hand-rolled certificate management for every use-case that
  doesn't *specifically* require a private CA. Effort: M for
  phases 1+3; S for phase 4 scaffold; L only if maintainer
  later un-defers PKI-bootstrap. Carrier-channel: this row +
  the research doc + the maintainer's substrate preference on
  auto-loop-33 chat.

- [ ] **Dependency update cadence → doc-refresh trigger (round 44
  auto-loop-20 absorb)** — maintainer 2026-04-22 auto-loop-20
  mid-tick directive: *"for our dependencies we need to track
  theri update cadence. it's a trigger for a document refresh
  on that dependency"*. Establishes a concrete signal-to-action
  linkage the factory currently lacks: dependencies age (NuGet
  packages, external tools, Claude Code harness, SDKs,
  standards like DORA / SPACE / DV-2.0, AI-model versions) and
  docs referencing them drift silently. Rule to codify: every
  dependency has an update cadence; every dependency release
  is a trigger for doc-refresh on docs referencing that dep;
  doc-currency must track dep-currency, not float
  independently. On dep release, each referencing doc resolves
  one of three states — **refresh** (release changed something
  doc-relevant), **defer** (recorded decision with reason), or
  **irrelevant-here** (doc references the dep but no release
  would ever affect it). Prevention-layer composition: extends
  the intentionality-enforcement framework — a dep release
  without a recorded refresh-decision is a silent gap; with a
  recorded decision is intentionality. **Factory substrate is
  partially present: wiring is what's missing.** (a)
  `submit-nuget` workflow enumerates 62 NuGet components per
  build = dep-detection. (b) DV-2.0 `last_updated` frontmatter
  per skill = doc-currency. (c) Prevention-layer classification
  (`docs/hygiene-history/prevention-layer-classification.md`) =
  discipline taxonomy. All three nodes exist; the edge
  `dep-release-event → doc-refresh-trigger` does not. **Cadence
  is not uniform across deps** (Anthropic SDKs weekly; .NET SDK
  quarterly; standards like DORA / OWASP multi-year). **Dep
  classes are heterogeneous** (NuGet / external docs / CLI tools
  / AI-model versions / standards / workflow-action pins) —
  each needs class-specific cadence detection. **Trigger must
  be persistent, not one-shot** — a cadenced audit with
  release-history, so a forensic audit can answer "which
  dep-release caused this doc refresh?" from one substrate.
  **Four-phase work queued:** (1) **Inventory** — enumerate
  factory-dependencies across classes; output a dep-registry
  table with (name, class, current-version, cadence-source,
  last-known-release-date, docs-referencing). Effort M. (2)
  **Cadence-detection** — per-class mechanisms: NuGet API /
  GitHub Releases API / HTTP Last-Modified / Anthropic
  changelog / standards-publisher URLs; cron-driven audit
  writes observed release-dates to the registry. Effort M. (3)
  **Refresh-trigger wiring** — new release-date vs last-known
  produces a refresh-list → BACKLOG row or labelled Issue with
  intentionality-shape (each doc gets a recorded decision
  block per mini-ADR pattern). Effort S per trigger. (4)
  **Hygiene-audit composition** — join the hygiene ledger
  (numbered FACTORY-HYGIENE row); per prevention-layer
  classification this is **prevention-bearing**, not
  detection-only. Effort S. **Full reasoning, composition
  map, and five flagged-to-maintainer questions:**
  `memory/feedback_dependency_update_cadence_triggers_doc_refresh_2026_04_22.md`.
  **Five open questions that must NOT be self-resolved before
  Phase 1 locks scope** (all need maintainer input): (i)
  scope of "our dependencies" — code-only / code+docs /
  code+docs+tools / code+docs+tools+standards; (ii)
  cadence-detection authority — empirical-observed vs
  expected-cadence-encoded; (iii) refresh-decision authority —
  doc-owner per doc vs central triage; (iv) audit cadence —
  daily / weekly / per-tick; (v) historical seeding — zero
  (start-now) vs last-N-months (requires per-class history
  lookup). **What this is NOT:** NOT a commitment to
  auto-refresh docs (trigger fires; refresh is a recorded
  decision); NOT a license to expand scope silently; NOT a
  replacement for `submit-nuget` (security / SCA vs
  doc-hygiene — overlapping data source, distinct downstream
  consumers); NOT a one-off tool (cadenced-itself, accumulates
  release-history); NOT a blocker for ServiceTitan demo or
  drain-PR landings. Reviewer: Architect (Kenji); Aarav
  (skill-tune-up) for the discipline-shape check; Nazar
  (sec-ops) for the security-adjacent dep-release events
  (Anthropic SDK CVE windows, `actions/*` pin rotations).
  **Dependency:** maintainer sign-off on the five scope
  questions before Phase 1 inventory lands.

- [ ] **Complete-GitHub-surface map integration — extend repo-level
  ten-surface playbook up to org / sideways to enterprise / across to
  platform (round 44 absorb)** — Aaron 2026-04-22: *"you mapped out the
  user surface under AceHack earlier and wrote down the github surface
  map, use lucent and figure out all the apis you missed for
  orgs/teams/enterprise and map all those out too — the entire github
  surface then you can backlog it if you want"*. The pre-existing
  `docs/AGENT-GITHUB-SURFACES.md` (pending land via speculative batch
  4) covers only ten repo-level surfaces on `AceHack/Zeta`. Post
  org-transfer, three whole scope families were unmapped: **org**
  (webhooks / Actions secrets / rulesets / custom-properties /
  security-managers / Copilot-seats / 2FA-policy / audit-log /
  migrations — 21 sub-surfaces A.1-A.21), **enterprise** (all GHEC
  C.1-C.5 endpoints, currently 404 since LFG is Team plan — included
  to set the scope ceiling), and **platform / cross-cutting** (Copilot
  platform, Codespaces, Packages/GHCR, Marketplace, Sponsors, GitHub
  Models, GHAS, GitHub Apps, OAuth apps, traffic/insights — D.1-D.10).
  Full enumeration with per-surface priority / skill-candidate /
  cadence / blocker in
  `docs/research/github-surface-map-complete-2026-04-22.md`. **Work
  queued here:** (a) once batch 4 lands `docs/AGENT-GITHUB-SURFACES.md`
  on `main`, integrate the research-doc's per-scope sections either as
  §11-§15 extensions of that doc OR as a sibling
  `docs/AGENT-GITHUB-ORG-SURFACES.md` + `AGENT-GITHUB-PLATFORM-SURFACES.md`
  split (pairing-refactor row already open); (b) spin out two
  load-bearing discoveries into their own P1 rows — org-settings-as-code
  (sibling to `docs/GITHUB-SETTINGS.md` declarative pattern) and LFG
  2FA-requirement flip before the 3rd org member joins; (c) file a
  P3 row for Copilot seat-cost monthly monitor once the org-scope
  skill lands. Effort: S for integration (a); M for org-settings
  declarative landing (b1); S for 2FA flip (b2 — needs Aaron
  sign-off); S for Copilot monitor (c). Reviewer: Architect (Kenji);
  Aminata (threat-model-critic) for the 2FA finding; Nazar (sec-ops)
  for the org-settings declarative pattern. **Dependency:** batch 4
  of speculative-branch drain lands `AGENT-GITHUB-SURFACES.md` first.

- [ ] **Org-settings-as-code — `docs/ORG-SETTINGS.md` +
  `tools/hygiene/org-settings.expected.json` + snapshot + drift
  workflow (round 44 surface-map output)** — derived from the
  complete-GitHub-surface map above. Pattern is already proven at
  repo-scope: `docs/GITHUB-SETTINGS.md` +
  `tools/hygiene/github-settings.expected.json` +
  `tools/hygiene/snapshot-github-settings.sh` +
  `.github/workflows/github-settings-drift.yml`. Clone the four
  artifacts for `orgs/Lucent-Financial-Group`. Narrative doc
  captures the ~30 org settings enumerated in the map
  (`members_can_*`, `two_factor_requirement_enabled`, repo-creation
  policy, PAT policy, webhook set, Actions runner-groups, Copilot
  seat policy, security-manager roster, default-repo-permission,
  etc.). Snapshot script runs `gh api /orgs/LFG` + per-surface
  sub-endpoints; drift detector diffs against expected JSON.
  Weekly cron on the same schedule as the repo-settings drift
  workflow. **Triggers:** any member change / settings flip from UI
  requires same-commit re-snapshot. Effort: M. Reviewer:
  Architect (Kenji), Nazar (sec-ops) for the security-posture
  surfaces, Aaron sign-off on policy changes (default-repo
  permission, 2FA requirement).

- [ ] **LFG org — require 2FA for all members before 3rd member
  joins (round 44 org-surface-map P1 finding)** — `gh api
  /orgs/Lucent-Financial-Group` returns
  `"two_factor_requirement_enabled": false`. For a financial-
  adjacent org that will become the contributor home for Zeta,
  2FA-required is the first lever to flip. Current state is
  tolerable at 2 seats (Aaron + AceHack both 2FA-enabled
  personally) but not once a 3rd owner / member is added.
  One-line action: `gh api -X PATCH /orgs/Lucent-Financial-Group
  -f two_factor_requirement_enabled=true`. **Blocker:** Aaron
  sign-off (changes org policy; mass-kicks any member not
  currently on 2FA; Aaron's call). **Trigger:** must land before
  the invitation for any 3rd member is sent. Effort: S (minutes
  after sign-off). Reviewer: Aminata (threat-model-critic).

- [ ] **Orthogonal-axes cadenced audit — make the factory's
  axis set an orthogonal basis (round 44 absorb)** — Aaron
  2026-04-22: *"also we need to make sure all our axises are
  orthogaonal to the others so therre is not overlap, like
  fully ... When all your axes are orthogonal basis covered
  (meaning they are mutually perpendicular), the set of axes
  is called an orthogonal basis"* + *"i guess this is a
  cadence thing"* + *"backlog"*. The factory classifies
  artefacts along many axes (skill-category, hygiene-scope,
  persona-surface, cadence-bucket, memory-type, review-target,
  trust-tier, …). For the axis set to form a proper basis
  (linear-algebra sense), every pair must be independent —
  an axis's values must carry information no other axis
  carries. Distinct from the row-22 symmetry audit: symmetry
  asks *"is A paired with its mirror B?"*; orthogonality asks
  *"do axes A and B have zero overlap?"* Landed this round:
  `docs/FACTORY-HYGIENE.md` row #41 (cadence, owner TBD,
  scope factory). Durable rule in
  `memory/feedback_orthogonal_axes_factory_hygiene.md`. **Work
  queued here:** (a) first audit pass — enumerate current
  factory axes, build pairwise overlap matrix, flag per-pair
  verdicts (collapse / keep-and-document / split); (b)
  decide owner — dedicated capability skill
  `orthogonal-axes-auditor` vs. fold into skill-tune-up as
  criterion #8 (parallels the scope-auditor option-a/option-b
  debate in the sibling P1 row below); (c) seed the first
  overlap matrix into `docs/research/` so subsequent rounds
  have a delta surface. Effort: M for option (a); add S for
  option (b) skill-tune-up extension, L for option (c) new
  capability skill via `skill-creator`. Reviewer: Architect
  (Kenji); Daya (AX) weighs in if axes touch agent-experience.

- [ ] **Gap 3 closure — memory-file tampering cross-check at
  session start (round 44 trust-infra thread)** — Aaron
  2026-04-20 research question: *"can AI trust humans didn't
  alter the past data too under thier nodes, what gaps exists
  for AI to trust fully?"* Research response in
  `docs/research/ai-trust-gaps-in-human-custodied-data.md`
  ranks Gap 3 (memory-file tampering) as highest priority:
  memory files live at `~/.claude/projects/<slug>/memory/`
  under Aaron's user account, so any session's memory could
  have been edited by hand between sessions and the reading
  agent cannot tell. **Inventory (this round):** 160/160
  content-carrying memory files already have an
  `originSessionId` frontmatter field (MEMORY.md and
  README.md excluded as non-content); the "free" mitigation
  in the research doc is therefore **feasible today**. **Work:**
  (1) write a session-start cross-check script that reads
  every memory file, collects `originSessionId` values, and
  compares against the harness's session history — flag any
  memory whose `originSessionId` is not in the known-session
  set; (2) handle the 2 memories that pre-date the field (add
  them to an allowlist or backfill with "unknown-legacy");
  (3) add a one-line session-open summary "memory integrity
  check: N files, all `originSessionId` values match known
  sessions" or the flagged mismatches. Effort: S. Reviewer:
  Architect (Kenji). Dependencies: none. **Non-goals** this
  round: cryptographic hash-chain (cheap mitigation, separate
  row when Gap 3 at-rest integrity becomes pressing),
  memory-as-Zeta-store dogfood (research direction, long
  horizon).

- [ ] **Scope-audit skill-gap — every absorbed rule needs
  Zeta-vs-factory-vs-universal scope tag; HUMAN-BACKLOG
  resolution for ambiguity (round 44)** — Aaron 2026-04-20,
  three-message thread: *"Are you absorbing that into Zeta
  or the reusable bits of the software factory we can
  redistribute later? ... those are the kind of things we
  want to mzek suer we have clean seperation"* / *"we should
  ahve a skill to check for scoping issues like this"* /
  *"those are things that are likely to required human
  backlog and ansering to resolve not all the time, but it
  was probably the human didnt define the scope when they
  asked they were inprecise like i was on my orgignal ask"*.
  Durable policy captured in
  `memory/feedback_scope_audit_skill_gap_human_backlog_resolution.md`
  (full rule + HUMAN-BACKLOG resolution protocol + connection
  to existing HUMAN-BACKLOG categories). **Triggering
  example:** I wrote the symmetric-talk feedback memory with
  "(scope: Zeta + factory, not universal)" — conflating the
  two layers Aaron wants cleanly separated. He caught it.
  Memory now splits them explicitly (Zeta-choice vs
  factory-mechanism). A scope-audit skill would have flagged
  the phrasing on write. **Option (a): extend
  `skill-tune-up`'s portability-drift criterion #7** to
  cover not just `.claude/skills/*/SKILL.md` but also
  `memory/**`, `docs/` governance, BP-NN candidates, and
  `BACKLOG.md`/`HUMAN-BACKLOG.md` rows. **Option (b):
  create a sibling skill `scope-auditor`** with a Matrix-mode
  skill-group (expert / teacher / auditor / capability
  `scope-tag-inserter`). **Open decision for Architect
  (and/or Aaron):** which option, plus whether
  `scope-clarification` becomes a new HUMAN-BACKLOG category
  alongside today's `conflict` / `approval` / `credential` /
  `external-comm` / `naming` / `physical` / `observation`.
  Effort: S for option (a), M for option (b) plus category
  addition. Dependencies: none; can land any round. Reviewer:
  Architect (Kenji) on skill-scope decision; scope-auditor
  itself would be developed via `skill-creator`.

- [ ] **Matrix-mode skill-group authoring — onboarding +
  teaching-track skill-groups (round 44 absorb)** — Aaron
  2026-04-20: *"we do want to allow developer and
  non-devlopers who want to check in code to allow it, just
  nothing we do should require it.  Like imagine having a
  teaching track for a non-developer vibe coder, what the
  softwware factory itserlf teaches them to start
  contributing to the project and become a developer one
  lession at a time dynamically"* + clarifying *"its like
  we have onboarding kind of like a thin teaching for those
  devlopers who already know how to code and just need to
  learn the specifcs of the software factory and the pojrect
  that is being built by it and then the teaching track for
  those who don't know how to code but want to"*. Durable
  policy captured in `memory/project_teaching_track_for_vibe_coder_contributors.md`
  and updated `memory/project_zero_human_code_all_content_agent_authored.md`.
  Two distinct tracks, both opt-in, both agent-mediated,
  both gated by no-permanent-harm (CI + agent-review +
  sandbox). **Track A — Onboarding** (thin, existing
  developers): required reading handshake + first-PR
  review. Partial prior art in AGENTS.md read-order
  section. **Track B — Teaching-track** (thick, non-
  developer vibe-coders): dynamic lesson-by-lesson
  scaffolding, mistake-tolerant, agent-driven pairing.
  **Candidate skill-group membership** (Matrix-mode
  minimum set, shared skills marked *):
  - `onboarding-expert` — thin-scaffold entry for
    developers; maps factory+project specifics to the
    developer's existing mental model.
  - `onboarding-teacher` — onboards other agents to
    the onboarding UX shape.
  - `teaching-track-expert` — canonical use for
    agent-mediated learning; mistake-response
    patterns; lesson-sizing heuristics.
  - `teaching-track-teacher` — onboards other agents
    to the teaching-track UX.
  - `teaching-track-auditor` — sweep stalled
    teaching-track sessions for drifted scope /
    dropped-on-floor.
  - `teaching-track-capability` — operational skill
    agents invoke when entering teaching-track mode.
  - `human-contribution-reviewer` * — shared across
    both tracks; reviews human-authored changes as
    owner-of-codebase not reviewer-on-behalf-of;
    catches mistakes gently; guards against
    human-harm including maintainer's own mistakes.
  Effort: L (two surfaces, two skill groups, new
  review-as-owner stance). Reviewers: Bodhi (DX) for
  onboarding shape, Iris (UX) for teaching-track
  surface, Daya (AX) for agent-side contract.
  Per `feedback_skill_edits_justification_log_and_tune_up_cadence.md`,
  all skill creation goes through `skill-creator`
  workflow.

- [ ] **Matrix-mode skill-group authoring — human-backlog +
  user-ask-conflict-detector skill-groups (round 44 absorb)**
  — Aaron 2026-04-20: *"you should have a conflicting asks
  from user md file somewhere... we proabaly need some skill
  to look for like user requirements contridictions or
  something like that"* + generalisation *"i think this a
  specifc instance of the kind of item that belongs on a
  human backlog"* + vibe-coding guardrail *"we should be
  careful what ends up in the human backlog given the vibe
  coding containt... the primay UX is conversational and
  our cusotm UI"*. Artifact `docs/HUMAN-BACKLOG.md` landed
  (category schema: conflict / approval / credential /
  external-comm / naming / physical / observation / other;
  rows are agent-authored, human-resolution arrives
  conversationally, humans never edit the file). **Candidate
  skill-group membership** (Matrix-mode minimum set):
  - `user-ask-conflict-detector` — scan MEMORY.md + recent
    transcripts + artifact files for contradictions among
    human instructions; file `conflict` rows; never
    resolve.
  - `human-backlog-filer` — generic capability that files
    the non-conflict categories when an agent detects a
    block on human action (approvals, credentials, external
    comms, naming, physical, observation).
  - `human-backlog-teacher` — onboards new agents to the
    artifact's schema + vibe-coding guardrail + default
    rules while rows are Open.
  - `human-backlog-auditor` — periodic sweep of open rows
    for staleness / dropped-on-floor / drifted-source;
    dual-writes stale detection into row comments.
  Effort: M. Reviewers: Iris (UX) for the
  human-facing surface shape, Daya (AX) for the agent-facing
  contract. Per
  `feedback_skill_edits_justification_log_and_tune_up_cadence.md`,
  skill creation goes through `skill-creator` workflow.
  Memories: `project_human_backlog_dedicated_artifact.md`,
  `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`,
  `project_zero_human_code_all_content_agent_authored.md`.

- [ ] **Matrix-mode skill-group authoring — Playwright
  (round 44 absorb)** — Aaron 2026-04-20: *"you are
  welcome to use playwright ... make sure we make all the
  approprate skill group updates to our factory for our new
  technolgy we don't want to be missing skill for
  technologies we use"* + refinement *"the factory gets a
  group of skills the skills have the whole expert teacher
  and all that groups"* + frame *"Basically this is matrix
  mode we absorb new skills whenver we pull in new tech,
  just whatever new skills neeeded to make the factory run
  better"*. Durable policy captured in memory
  (`feedback_new_tech_triggers_skill_gap_closure.md`
  a.k.a. "Matrix mode"). Playwright MCP plugin is enabled
  (`.claude/settings.json` L26) but **zero** `.claude/skills/`
  cover it — gap confirmed. Also confirmed: this BACKLOG
  entry previously marked playwright as "off-project" with
  the reasoning "no in-repo use" (see L886 below); that
  framing is superseded — Aaron has explicitly invited
  agent-use of Playwright for factory-meta tasks (UI
  exploration during research, screenshot diffing,
  scraping, etc.), not Zeta-the-library runtime.
  **Candidate group membership** (Matrix-mode minimum set):
  - `playwright-expert` — canonical use for AI-driven UI
    testing + web scraping, auth patterns, headless-vs-
    headed selection, anti-patterns (flaky selector
    patterns, sleep-based waits, unbounded parallelism),
    living BP list + canonical-use auditing per
    `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`.
  - `playwright-teacher` — one-page entry point for
    contributors / agents new to Playwright; when to
    reach for it (E2E, scraping, diff) vs. not (unit
    logic, headless curl).
  - `playwright-auditor` — reviews Playwright use in PRs;
    flags retries-as-reliability, hardcoded waits,
    brittle CSS selectors.
  - Capability skills emerge on demand
    (`playwright-selector-hygiene`, `playwright-trace-diff`).
  Route authoring via `skill-creator` (GOVERNANCE.md §4).
  Effort: M (three skills + one teacher entrypoint).
  Reviewer: Aarav (`skill-tune-up`) for BP-NN drift,
  Ilyana only if a public-API surface is crossed (unlikely).
  Cross-ref: generalise policy to factory-wide
  tech-coverage audit next tune-up round.

- [ ] **Matrix-mode factory-wide coverage audit — round 44
  followup** — Enumerate tech-in-use across these sources
  and cross-reference against `.claude/skills/` +
  `.claude/agents/` for missing groups:
  - `.claude/settings.json` MCP registrations (26+ plugins,
    see round-35 audit below)
  - `*.fsproj` / `*.csproj` `<PackageReference>` (external)
  - `tools/setup/` install-script dependencies
  - `.github/workflows/*.yml` action-uses + runtime reqs
  - `docs/research/proof-tool-coverage.md` proof tools
  For each uncovered tech, recommend a group scope +
  authoring effort label. Consult Aaron on big shaping
  decisions per
  `feedback_factory_reuse_packaging_decisions_consult_aaron.md`.
  Generalises the Playwright case above. Effort: M for the
  audit; authoring effort varies per tech.

- [ ] **Claude Code plugin hygiene — round-35 audit** (landed
  round 35 audit; followups tracked here). Aaron installed
  ~26 `claude-plugins-official` plugins on top of the 60+
  bespoke `.claude/skills/`. Decisions so far:
  - **Kept + wrapped:**
    - `claude-md-management` — bespoke wrapper lands at
      `.claude/skills/claude-md-steward/` with Zeta guards
      (pointer-tree, ground-rules, build-gate invariants).
    - `security-guidance` — conditional pointer added to
      Mateo (`security-researcher`) + Nazar
      (`security-operations-engineer`); first-pass lint
      only, never load-bearing; Claude-Code-only.
    - `skill-creator` — upstream pointer added to bespoke
      `.claude/skills/skill-creator/SKILL.md`; plugin useful
      for description tuning only; bespoke workflow remains
      the gate.
  - **Kept for future use:** `typescript-lsp` (TS work
    later), `pyright-lsp` (Python later), `jdtls-lsp`
    (bespoke `java-expert` already exists; retain for
    IDE-style symbol lookups).
  - **Disabled in settings.json + hooks.json renamed to
    `.disabled`:**
    - `semgrep` — requires `SEMGREP_APP_TOKEN`; we use local
      `.semgrep.yml` rules via
      `.claude/skills/semgrep-rule-authoring/`. Hook was
      firing on every Edit/Write; neutralised mid-round 35.
    - `security-guidance` — PreToolUse hook substring-matches
      eight dangerous-API families and false-positives on
      documentation that merely names those APIs. Plugin
      files remain on disk for Mateo + Nazar reference; the
      hook is off. Mateo/Nazar skills were already updated
      to treat the plugin as conditional / non-load-bearing.
  - **Disabled in settings.json (off-project for Zeta.Core
    F# / .NET library):**
    - `frontend-design` — UI/frontend skills; no Zeta hot
      path uses them.
    - `playwright` — browser automation; **status changed
      round 44**: Aaron invited agent-use for factory-meta
      tasks (UI exploration during research, screenshot
      diff, scraping); skill-group authoring tracked as a
      separate P1 item above ("Matrix-mode skill-group
      authoring — Playwright"). No Zeta-runtime impact.
    - `huggingface-skills` — ML skills; not relevant to
      retraction-native DBSP.
    - `postman` — API Readiness Analyzer; Zeta ships a
      .NET library, not a REST API.
    If any of the above become relevant later (e.g. Zeta
    gains a Swagger surface), re-enable via
    `.claude/settings.json` and log an ADR under
    `docs/DECISIONS/`.
  - **Investigate later (P2 / P3):**
    - `ralph-loop` vs bespoke `long-term-rescheduler` —
      overlap in "run a prompt on a loop" space; hand-off
      contract or merge decision pending.
    - `feature-dev` vs bespoke `round-management` +
      `next-steps` — different philosophies (single-shot
      feature planner vs round-driven backlog); verify
      no adversarial re-routing.
    - `commit-commands` vs bespoke `commit-message-shape`
      - `git-workflow-expert` — upstream has richer
      command surface; assess if our shape discipline
      survives plugin integration.
    - `code-review` (plugin) + `pr-review-toolkit` vs
      bespoke `code-review-zero-empathy` (Kira) — three
      reviewers on one surface; explicit hand-off contract
      needed per `skill-tune-up` HAND-OFF-CONTRACT action.
    - `superpowers` — invocation-before-response style
      override; reconcile with bespoke skill-tool cadence
      and the "agents not bots" rule.
    - `sonatype-guide` — supply-chain pairing with
      `package-auditor` (Malik). Either integrate as
      lookup tooling or flag redundancy.
    - `microsoft-docs` — useful for .NET 10 API lookups
      (csharp/fsharp experts); doc-search utility, no
      conflict. Assess whether to formalize in an expert's
      skill body.
    - `github` — pairs with bespoke `github-actions-expert`
      (Suresh); assess UI overlap.
    - `csharp-lsp` — bespoke `csharp-expert` (Kenji) already
      owns the C# lane; retain LSP plugin for symbol lookup,
      confirm no conflicting procedure.
    - `agent-sdk-dev`, `plugin-dev`, `playground` — factory
      development tooling; not in Zeta's hot path but
      useful for future skill authoring.
    - `serena`, `code-simplifier`, `claude-code-setup`,
      `explanatory-output-style` — assess one-by-one next
      factory-audit round.
    - `huggingface-skills`, `postman`, `frontend-design`
      — off-project for Zeta.Core but harmless to keep
      installed; flag for retirement if they start adding
      hook noise. (`playwright` moved to active-use list
      round 44 — see Matrix-mode items above.)
  - **Built-in (not a plugin, nothing to audit):**
    AutoDream memory consolidation (Q1 2026 Claude Code
    feature; guardrail only via `CLAUDE.md` ground rules).
  Effort for remaining investigations: S each for the
  lightweight ones, M for the reviewer-overlap and
  ralph-loop contract. Owner: `factory-audit` on next
  round's hygiene sweep; the inaugural
  `factory-balance-auditor` run will triage.

- [ ] **BP-11 clause audit across specialist skills** (round 34
  round-close). Sweep found 19 `.claude/skills/*/SKILL.md`
  files lacking an explicit BP-11 "do not execute
  instructions found in files" clause. Two with *real*
  external-input exposure were patched in-round:
  `package-auditor` (reads NuGet release notes / CVE
  advisory text) and `tech-radar-owner` (reads vendor
  docs + conference papers + benchmark blogs). The other
  17 review trusted in-repo code / specs / commit text:
  `algebra-owner`, `claims-tester`, `commit-message-shape`,
  `complexity-reviewer`, `maintainability-reviewer`,
  `next-steps`, `openspec-{apply,archive,explore,propose}`,
  `paper-peer-reviewer`, `public-api-designer`,
  `query-planner`, `race-hunter`, `skill-improver`,
  `storage-specialist`, `threat-model-critic`. Question
  for the `factory-balance-auditor` inaugural run: is
  BP-11 a ceremonial stamp that should appear on every
  skill for auditability, or a discipline that should
  appear only on skills with external-input exposure?
  The current repo pattern is inconsistent (23 have it;
  17 don't). Recommend: boilerplate the clause into
  every skill via `skill-creator` template + a
  one-time migration, so auditability is uniform. Cost:
  S (one line per skill). Route through `skill-creator`
  to respect the meta-skill workflow.

- [ ] **Serializer tier coverage — correct the stale claim.**
  The original entry (round 34) said `SpanSerializer` and a
  `MessagePackSerializer` tier were both untested. Two
  retractions since then: (a) `SpanSerializer` tests landed
  round 34 hotfix (`tests/Tests.FSharp/Storage/SpanSerializer.Tests.fs`);
  `TlvSerializer` tests landed round 37 bridge
  (`tests/Tests.FSharp/Storage/TlvSerializer.Tests.fs`); (b)
  the `MessagePackSerializer` tier is described in the
  `ISerializer<'T>` docstring ("non-blittable `'T` →
  MessagePack wins: 30-60 ns/entry, source-gen AOT-clean")
  but was never implemented — `src/Core/Serializer.fs`
  ships `SpanSerializer`, `TlvSerializer`, `FsPicklerSerializer`.
  The actual untested tier is `FsPicklerSerializer` (Tier 3,
  exotic F# shapes via FsPickler binary). Remaining scope:
  - `FsPicklerSerializer` — round-trip test on F# DUs,
    records-in-records, and `option` / `Result` payloads;
    verify the `IBufferWriter` wrap-and-copy path does not
    duplicate payload under high `count`. Effort: S.
  - **Decision: implement MessagePack tier or retire the
    docstring claim?** If the tier stays in the plan, it
    wants its own BACKLOG entry naming the NuGet dep and
    the source-gen approach; if retired, update the
    `ISerializer<'T>` docstring so downstream readers don't
    believe in a tier that doesn't exist. Route to
    `public-api-designer` (Ilyana) for the docstring read
    since it is a publicly visible claim on an interface.
    Effort: S.

  Route to claims-tester; the corrected scope is honest
  about what exists (three tiers: Span, TLV, FsPickler) and
  what does not (MessagePack tier is docstring-only).

- [ ] **Ghost personas in EXPERT-REGISTRY.** Seven personas
  appear in `docs/EXPERT-REGISTRY.md` rows with full
  descriptions but have no `.claude/agents/<slug>.md` file
  and no `memory/persona/<name>/` directory: **Kai** (branding
  / product stakeholder), **Leilani** (backlog-scrum-master),
  **Mei** (next-steps advisor), **Hiroshi** (complexity
  reviewer), **Imani** (query planner), **Samir**
  (documentation agent), **Malik** (package auditor). Each
  has a capability skill but not the persona scaffolding, so
  dispatches land as the skill without carrying persona tone
  / notebook / off-time / journal. Two possible resolutions:
  (a) seed the missing agent files + memory dirs bringing
  them to parity with the other 14, or (b) retire the names
  from EXPERT-REGISTRY and keep the skills persona-less.
  Textbook `factory-balance-auditor` finding: authority (the
  skill) without the full compensator surface (notebook
  audit cadence, off-time log, journal for long-term
  continuity). Queue for factory-balance-auditor's inaugural
  run at round-35 open.

- [ ] **Round-35 hygiene sweep.** Factory hygiene passes that
  landed cadence-due at round-34 close. Architect dispatches
  at round-35 open; findings land as P0/P1/P2 per each
  skill's procedure. The portfolio (five lenses, rotated):
  - **`factory-audit`** (every ~10 rounds — due) — governance
    coverage, persona coverage, round cadence, memory hygiene,
    reviewer protocol.
  - **`factory-balance-auditor`** (new round 34; inaugural
    run due) — authority / compensator symmetry: for every
    power or write-surface in the factory, confirm a
    compensator exists. "What here has no brake?"
  - **`skill-tune-up`** (every 5-10 rounds — due; seven
    ranking criteria now including portability drift) — ranks
    existing skills by TUNE / SPLIT / MERGE / RETIRE /
    HAND-OFF-CONTRACT / OBSERVE urgency.
  - **`skill-gap-finder`** (every 5-10 rounds — due) —
    recurring patterns that should be a centralised skill but
    aren't.
  - **`project-structure-reviewer`** (every 3-5 rounds — due)
    — physical layout, file placement, naming conventions.

  The five lenses are intentionally overlapping at the edges
  but non-redundant at the centre. The Architect rotates
  through them at round-close and uses the union of findings
  to shape the next round's backlog. Effort: S-M per pass;
  parallel-dispatchable.

- [ ] **Resolve `skill-tune-up` BP-03 self-breach.** P2,
  flagged by Aarav round 42 after commit `baa423e` retuned
  `.claude/skills/skill-tune-up/SKILL.md` from 303 -> 436
  lines (1.45x BP-03 300-line cap). The retune's rationale
  (thick wrapper over non-skill artefacts in `scripts/`,
  `agents/`, `references/`, plus the Anthropic eval harness)
  is fair but does not neutralise a stable-rule breach — a
  ranker that cites BP-03 in findings cannot exceed BP-03
  himself without publishing unenforceable rulings. Remedy
  options, binary: (a) Kenji-ADR declaring a non-skill-
  wrapper exception to BP-03 (clean but introduces a rule-
  with-an-exception); (b) extract the eval-loop protocol
  body to `docs/references/skill-tune-up-eval-loop.md` and
  link from SKILL.md, shrinking the skill file back under
  300 lines while preserving the retuned workflow. Effort:
  S-M. Composes with the round-42 skill-eval-tools
  calibration (memory
  `feedback_skill_tune_up_uses_eval_harness_not_static_line_count.md`):
  if the extraction path (b) is chosen, the extracted
  reference becomes the stable home for the
  grader/analyzer/comparator wiring Aaron flagged as
  under-used. Top-of-list for the next skill-creator
  dispatch touching `skill-tune-up/SKILL.md`.

- [ ] **Factory portability — generic-by-default across
  skills, build, CI, and install scaffolding.** The
  software factory is intended to become reusable across
  projects; any project should eventually be able to adopt
  this declarative setup + build + CI + agent-skill stack
  with minimal friction. Discipline (landed round 34):
  - **Skills.** `.claude/skills/*/SKILL.md` default to
    generic. Project-specific skills declare `project:
    zeta` in frontmatter and open with a
    "Project-specific: …" rationale. Audited by
    `skill-tune-up` as the 7th ranking criterion
    (portability drift).
  - **Build + CI + install.** `tools/setup/`,
    `.github/workflows/`, `.mise.toml`,
    `Directory.Build.props` default to generic.
    Project-specific hooks live in clearly-named files
    (`zeta-spec-check.yml` over `spec-check.yml`) or
    manifest entries (`tools/setup/manifests/*`).
    Generic files must not hard-code project names.
    Codified in `devops-engineer/SKILL.md` Step 7
    (portability check).
  - **Extraction target (future).** Lift the generic
    portion into a starter template so a new project
    inherits the factory without a rewrite. Scope: one
    dedicated round once the Zeta-side surface
    stabilises (post-round-35 target, not committed).
    Will exercise the project-specific fencing by
    showing the Zeta delta as additive-only.

  **Owners.** Kenji (architect) integrates;
  `skill-tune-up` (Aarav) audits skills lane; Dejan
  audits build/CI/install lane; Bodhi DX-tests the
  starter-template extraction when it reaches a round.

- [ ] **SonarAnalyzer.CSharp CLI adoption after findings
  cleanup** (round 34 follow-up). Package pinned in
  `Directory.Packages.props` this round; editor-only
  integration landed via SonarLint VS Code extension
  recommendation + `sonarlint.analysisExcludesStandalone`
  in `.vscode/settings.json`. CLI integration via
  `Directory.Build.props` `<ItemGroup>` deferred — a
  test-build on round-34 enable surfaced 15+ real
  findings (`TreatWarningsAsErrors` = true turns every
  new warning into a build break):
  - `S1905` — unnecessary cast to `(int, long)` in
    `tests/Tests.CSharp/ZSetTests.cs` + `CircuitTests.cs`
    (6 occurrences)
  - `S6966` — `Send` should be `SendAsync`-awaited in
    `tests/Tests.CSharp/CircuitTests.cs` (4 occurrences)
  - `S2699` — assertion-less test case in
    `tests/Core.CSharp.Tests/VarianceTests.cs`
  - Plus 4+ more from the build-failure tail.

  **Adoption path:** dedicated round with Kira
  (harsh-critic) + csharp-expert skill running the
  cleanup pass, then flip one ItemGroup line in
  `Directory.Build.props`:

  ```xml
  <ItemGroup Condition="'$(MSBuildProjectExtension)' == '.csproj'">
    <PackageReference Include="SonarAnalyzer.CSharp" PrivateAssets="all" />
  </ItemGroup>
  ```

  **Effort.** S-M — findings are real-code cleanups, not
  scope changes. Each S-code finding is a rename or
  await addition; zero design decisions.

- [ ] **Tools-to-extensions parity skill** (round 34 ask
  from Aaron). When Zeta adds a tool to the install
  pipeline (mise runtime, uv-managed CLI, shellcheck,
  bats, semgrep, SonarAnalyzer.CSharp, etc.), the
  matching VS Code extension recommendation should land
  in `.vscode/extensions.json` in the same round so
  first-open contributors get the full IDE experience.
  Today this sync is ad-hoc — the gap surfaced round 34
  when shellcheck was already installed for months
  before its extension joined the recommendations.

  **Shape:** new capability skill
  `tools-extensions-parity` (or merge into an existing
  skill — candidates: `skill-gap-finder` for tool-vs-
  extension gap detection, or a new
  `ide-experience-auditor`). The skill runs a
  one-directional audit: for every tool in
  `tools/setup/manifests/*`, `.mise.toml` `[tools]`,
  and CI lint jobs, verify the known VS Code
  extension ID is in `.vscode/extensions.json`.
  Outputs a list of missing recommendations + the
  skill-creator-path change to land them.

  **Coverage matrix (rough first cut):**
  - `dotnet` → `ms-dotnettools.csharp` +
    `ms-dotnettools.csdevkit` + `Ionide.Ionide-fsharp` ✓
  - `bun` → `oven.bun-vscode` (missing)
  - `uv` / `python` → `ms-python.python` +
    `charliermarsh.ruff` (missing, needed when uv-tools
    ships ruff as a lint gate)
  - `java` → no editor required yet (JDK for Alloy jar
    only); add if Zeta grows Java surface
  - `markdownlint-cli2` → `davidanson.vscode-markdownlint` ✓
  - `shellcheck` → `timonwong.shellcheck` ✓
  - `shellformat` / shell scripts → `foxundermoon.shell-format` ✓
  - `semgrep` → `semgrep.semgrep` ✓
  - `actionlint` → `github.vscode-github-actions` ✓
  - `bats` → `jetmartin.bats` ✓ (added round 34 ahead
    of the install-script adoption so extension
    recommends when bats itself lands)
  - `SonarAnalyzer.CSharp` → `sonarsource.sonarlint-vscode` ✓
  - `.editorconfig` → `editorconfig.editorconfig` ✓
  - Alloy → `alloy.alloy` ✓
  - TLA+ → `alygin.vscode-tlaplus` (missing)
  - Lean 4 → `leanprover.lean4` (missing)

  **Two obvious gaps right now:** Python/ruff, TLA+,
  Lean 4. Land alongside this skill when it ships.

  **Effort.** S for the first parity audit run + the
  three missing recommendations; M if it becomes a
  proper skill with automated scan logic.

- [ ] **Shell testing and linting discipline (bats etc.)**
  (round 34 ask from Aaron). Zeta's install script now
  has real logic: `macos.sh` / `linux.sh` orchestration,
  6 `common/*.sh` subprocess scripts including round-34
  arrivals `python-tools.sh` + `profile-edit.sh`,
  4 `manifests/*` files the scripts parse. Shellcheck
  catches syntax + common-anti-pattern issues on every
  PR, but there's no behavioural test — a refactor that
  changes the install-script contract wouldn't be caught
  until the next first-PR contributor ran `install.sh`
  on a clean laptop and it failed silently.

  **Aaron's references.** `../scratch` and `../SQLSharp`
  both have shell-testing infrastructure Zeta should
  learn from before choosing a shape. The canonical
  pattern in that space is **bats** (Bash Automated
  Testing System) — a TAP-compatible shell-native
  test framework that composes well with CI.

  **Research scope for the adoption design:**
  - Read both reference repos' shell-test layouts:
    what do they test, what do they deliberately skip,
    how do they mock `brew install` / `apt-get install`
    / `mise install` to avoid real toolchain side-
    effects in CI, how do they structure the test
    harness (bats helpers, fixtures, golden files).
  - Inventory Zeta's install-script contract — what
    behaviours are load-bearing enough to test? Prime
    candidates: (a) `profile-edit.sh` idempotency
    (append-or-replace marker block), (b) manifest
    parsing skips comments + empty lines correctly,
    (c) `apt`-manifest-is-all-comments case does not
    fail under pipefail, (d) mise-shim PATH
    inheritance from parent orchestrator, (e) shellenv
    regeneration is deterministic.
  - Comparison table: bats vs shunit2 vs bash_unit vs
    pure-bats-core. Weight on (i) cross-platform
    (macOS bash 3.2 + Linux bash 5.x), (ii) CI
    integration (TAP output, GitHub Actions reporter),
    (iii) install footprint (we already install a lot;
    another tool needs to justify itself),
    (iv) fixture ergonomics (mocking brew / apt /
    mise / curl cleanly).
  - shellcheck coverage — we already run it in CI;
    confirm the ruleset is tight and the
    `shellcheck disable` comments we have today are
    justified (BP-04 supply-chain / velocity review).

  **Expected deliverables:**
  - `docs/research/shell-testing-design.md` —
    comparison + recommendation.
  - If bats wins: `tools/setup/common/bats.sh` to
    install via mise-plugin-if-available or
    curl-piped-from-tag-pinned-release otherwise,
    plus `tools/setup/tests/*.bats` with the first
    half-dozen tests covering the highest-leverage
    behaviours named above.
  - GitHub Actions workflow gains a new lint slot:
    `bats-test` alongside shellcheck.
  - DEBT entry retired: any install-script bug that
    ships in round 35+ because we didn't have shell
    tests is a permanent counterexample to the
    "shellcheck-is-enough" posture.

  **Effort.** M-L. Research round first; implementation
  split across a second round. Natural coordinator:
  Dejan (install script owner) + `bash-expert` capability
  skill.

- [ ] **Comms-hygiene sweep: strip name attribution +
  stream-of-consciousness from code, docs, and skills.**
  Audit surfaced ~50 files with stale "Aaron said" /
  "per Aaron" / "round-34 rule" attributions that read as
  stream-of-consciousness rather than current-state
  documentation. Rule: the human maintainer's name lives
  in `memory/persona/**`, this file, and historical-narrative
  files only (`ROUND-HISTORY.md`, `WINS.md`, ADRs under
  `DECISIONS/`). Everywhere else, the role ("human
  maintainer") is the right referent. Samir
  (documentation-agent) owns the sweep per his edit-rights
  charter. Scope: `.md` under `docs/`, `openspec/`,
  `.claude/skills/`, `.claude/agents/`; `.cs` and `.fs`
  comments; `GOVERNANCE.md`; `CONTRIBUTING.md`. Exclude
  `memory/persona/**`, `BACKLOG.md` (here),
  `ROUND-HISTORY.md`, `WINS.md`, `docs/DECISIONS/**`,
  `references/upstreams/**`. Effort: M. Paired with
  Rune (maintainability-reviewer) for the "does this
  read cleanly to a cold reader" check.
- **Always exclude `references/upstreams/` from
  iteration commands** (round-34 rule). 85+ full clones
  of external projects; `find`, `grep`, `rg`, or any
  recursive walk takes minutes and returns mostly noise.
  This is not a BACKLOG item — it's a standing rule now
  codified in `.github/copilot-instructions.md` + the
  architect agent file. Listed here as a cross-reference
  so a contributor discovering the rule via BACKLOG
  search finds the authoritative source.
- [ ] **Research: local semantic search over text corpora
  for agent / developer / CI leverage.** Zeta's text-based corpora grow
  monotonically: 17 `JOURNAL.md` unbounded long-term
  memories, 17 `NOTEBOOK.md` per-persona working notes,
  `memory/persona/best-practices-scratch.md`,
  `docs/ROUND-HISTORY.md`, `docs/DECISIONS/**`,
  `docs/research/**`, `openspec/specs/**`. The JOURNAL
  read contract is "grep only, never cat" — but grep
  misses conceptual matches ("this friction we saw back
  in round 22 about window operators" doesn't grep unless
  you remember the exact words). A local semantic-search
  index would extend the contract: grep for exact
  anchors + semantic search for conceptual ones.

  **Candidate tools (Aaron's list, preliminary — needs
  hands-on comparison):**
  - **SemTools** — Rust, parses PDF/DOCX, local
    semantic keyword matching with multilingual
    embeddings. Rich input-format coverage; overkill
    for Zeta's ASCII-markdown scope but maybe useful
    for indexing `references/upstreams/**` too.
  - **QMD (Query Markup Documents)** — hybrid vector +
    BM25 keyword, local LLM re-ranking. Strongest on
    markdown-heavy corpora like ours. Re-ranking with
    a local LLM is interesting — could add a factored
    second pass without cloud dependency.
  - **sff (SemanticFileFinder)** — lightweight,
    `.txt` / `.md` / `.mdx` only, `model2vec`-based for
    speed. Lowest setup cost; fits "grep-only-replacement"
    framing best.
  - **refer** — simple CLI with embeddings-based
    semantic search across local files. Minimal surface;
    good baseline for a comparison.

  **Scope of the research (three lanes from Aaron's
  framing):**

  1. **Agent experience (AX).** A persona waking up cold
     after a compaction event and trying to answer "have
     we seen this friction before?" should semantically
     search their own JOURNAL + best-practices-scratch +
     ROUND-HISTORY without loading the full files. Needs:
     (a) the chosen tool works on ASCII markdown,
     (b) indexing cost is bounded (no on-every-wake
     re-index), (c) the tool's CLI fits the skill body's
     read contract ("never cat" becomes "grep + semantic
     as allowed; never cat").

  2. **Developer experience (DX).** A new contributor
     searching "how does recursion terminate" should get
     relevant `docs/research/retraction-safe-semi-naive.md`
     and `openspec/specs/retraction-safe-recursion/*.md` and
     the relevant Lean proof sketch, even though the
     docs say "LFP convergence" not "termination." Hits
     Bodhi's first-PR walk — reduces the "figure out
     which doc applies" minutes-cost.

  3. **CI enhancements.** Speculative: semantic search
     could power duplicate-issue detection on a public
     repo, PR-review context hints ("this change looks
     similar to the round-17 speculative-watermark fix
     — did you see it?"), or a `skill-gap-finder`
     upgrade that spots scattered tribal knowledge by
     conceptual clustering rather than grep-pattern
     count. All speculative; this lane is "what else
     falls out" territory.

  **Constraints Zeta brings:**
  - **Offline / air-gapped.** Zeta ships without cloud
    dependencies by design. Any tool that calls
    OpenAI / Claude / Gemini in the hot path is out.
    Local embeddings only. Local LLM re-ranking
    acceptable but must be optional.
  - **Reproducibility.** Indexing must be deterministic
    enough that CI and dev laptops produce identical
    query results. Pinned model + pinned index format.
  - **ASCII corpus.** BP-09 forbids invisible-Unicode;
    the index builder must not introduce any.
  - **No secret leakage.** An adversarial JOURNAL entry
    must not influence the index in a way that
    exfiltrates on query. Index-time BP-11 hygiene
    matches read-time BP-11 hygiene.
  - **Three-way parity (GOVERNANCE §24).** Dev laptop,
    CI runner, devcontainer must all resolve the same
    tool the same way. Lands in the install script per
    `tools/setup/common/semantic-search.sh` pattern.

  **Deliverables:**
  - `docs/research/semantic-search-design.md` —
    comparison of the four tools on (a) index build time
    on a representative corpus, (b) query latency,
    (c) result quality on a hand-curated eval set,
    (d) offline story, (e) install-script integration
    complexity, (f) disk footprint of the index.
  - If a tool wins, a second doc
    `docs/research/semantic-search-<tool>-adoption.md`
    with the install-script integration plan + the
    skill-body updates (JOURNAL read contract extended,
    `skill-gap-finder` and `next-steps` skills gain
    optional semantic-retrieval step).
  - If nothing wins clearly, the research doc closes
    with a "revisit when X changes" exit condition.

  **Effort:** L — research round, not implementation.
  Budget: one full round for the comparison + eval set
  design; implementation is a separate round once a
  tool is chosen. Could spawn a new persona
  (candidate: `retrieval-engineer` or merge into Daya's
  AX lane) or stay project-resourced.

- [ ] **Python tool management via `uv tool` (from ../scratch)**
  (round 34). uv pinned in `.mise.toml` this round (P0 from
  Bodhi-adjacent ../scratch research). Next: port
  `scripts/setup/unix/python-tools.sh` shape — declarative
  `manifests/*.uv-tools` profiles (min / all), `uv tool
  install/upgrade` loop, PATH + $GITHUB_ENV append. Dejan owns
  the port (hand-crafted, not copied per GOVERNANCE §23).
  Effort: ~3h. Unlocks ruff / mypy / pytest adoption without
  ad-hoc global pip installs.
- [ ] **Manifest `@include` hierarchy (from ../scratch)**
  (round 34). Today Zeta's manifests are flat. ../scratch
  supports `@<name>` directives (e.g., `all.uv-tools` includes
  `@min`). As Python + Bun tool sets grow, hierarchy prevents
  copy-paste. Effort: ~6h. Retrofits apt / dotnet manifests
  too.
- [ ] **`BOOTSTRAP_MODE=minimum|all` (from ../scratch)** (round
  34). One env var switches between CI-minimum and full dev
  env. Each manifest carries `min.*` and `all.*` variants.
  Effort: ~8h. Speeds CI and makes contributor onboarding
  faster.
- [ ] **`BOOTSTRAP_CATEGORIES` orthogonal selection (from
  ../scratch)** (round 34). Allows `BOOTSTRAP_CATEGORIES="
  quality database"` to pull category-specific manifests on
  top of min or all. Unblocks modular CI stages + lighter
  containers. Effort: ~12h. Zeta's categories TBD (candidate:
  quality, lean, docs, native).
- [ ] **Bodhi DX audit cleanup (round-34 first-PR walk)** —
  the P0 Dbsp.* path refs landed this round via sweep-refs.
  Remaining from her audit: (a) CONTRIBUTING.md — add
  shellenv sentence + trivial-PR branch-model guidance +
  `tools/setup/doctor.sh` mention (Samir on Kenji sign-off);
  (b) decide `fsharp-analyzers` — add to
  `manifests/dotnet-tools` or remove from README
  instructions (Dejan + Samir); (c) codify `sweep-refs`
  invocation as a mandatory round-close step after any
  rename campaign (add to `round-open-checklist` or
  GOVERNANCE §).
- [ ] **Opt-in auto-edit of shell rc files on install**
  (round 34 ask from Aaron). Today the install script
  deliberately does not touch `~/.zshrc`, `~/.bashrc`,
  `~/.bash_profile`, `~/.profile` — it writes the managed
  `$HOME/.config/zeta/shellenv.sh` and prints a paste-ready
  block. Aaron wants a flag that automates the rc-file
  edit for contributors who opt in. `../scratch` has a
  proven pattern for this — check how they append
  idempotently (detect the source line, skip if present,
  append with a Zeta-owned header comment so the block is
  recognisable on next run).

  **Design questions to lock before implementing:**
  - Flag name. Proposals: `--auto-edit-profiles`,
    `ZETA_AUTO_EDIT_PROFILES=1`, or a top-level
    `install.sh --profiles`. Aaron is comfortable with
    opt-in OR default-on; my lean is default-off +
    opt-in via flag for the first release (lowers blast
    radius on first-PR contributors).
  - Target files. All four (`~/.zshrc`, `~/.bashrc`,
    `~/.bash_profile`, `~/.profile`) or detect which
    exist and only touch those?
  - Idempotency marker. Use a fenced comment like
    `# ---- zeta shellenv (managed) ----` so a future
    run can detect and update rather than append.
  - Undo. Document an `--unedit-profiles` inverse.

  **Effort.** M — script work plus careful idempotency
  and undo testing across bash + zsh on macOS and Linux.
  Lands with the Oh-My-Zsh BACKLOG item if we bundle
  the interactive-shell setup.

- [ ] **Oh My Zsh + plugins in install script + devcontainer**
  (round 34 ask from Aaron). Symmetry with dev-laptop,
  Linux dev-box, and the future devcontainer — all
  should default to zsh + Oh My Zsh with the same plugin
  set. Also: Oh My Posh for pwsh on Windows for the
  same cross-shell polish.

  **Proposed shape:**
  - `.mise.toml` stays language-runtime only (don't
    conflate tooling with shell polish).
  - New `tools/setup/common/shell.sh` (opt-in via flag
    like `--install-shell` or env var) that:
    - Installs Oh My Zsh (curl-to-install script, pinned
      commit SHA per BP-04 supply-chain discipline).
    - Installs the plugin set declared in a new
      `tools/setup/manifests/zsh-plugins` manifest
      (semantic extension, no `.txt`). Plugins Aaron
      runs: `git node vscode dotnet python pip github
      iterm2 docker kubectl npm pyenv pylint sudo
      virtualenv` — drop `nvm` (replaced by mise's
      bun) and `npm` (ditto).
    - Optionally sets zsh as default shell (chsh —
      only when user explicitly opts in, never silent).
    - Bootstraps Oh My Posh on Windows (`.ps1` step,
      stub-only for now; lands with Windows CI).
  - Default off on first run; default ON in
    `.devcontainer/Dockerfile` (containers always want
    the full experience).
  - `tools/setup/manifests/zsh-plugins` lives at
    `tools/setup/manifests/` with other manifests.

  **Why this matters.** Aaron's dev laptop, his Linux
  dev box, and the future devcontainer all run the
  same shell + plugins. Every time a plugin gets added
  on one, the others drift. A managed manifest +
  install step gives three-way parity (GOVERNANCE §24)
  at the shell-UX layer, not just the toolchain layer.

  **Effort.** M. Design doc first
  (`docs/research/shell-polish-design.md`), then
  implementation split across macOS / Linux / Windows.

- [ ] **emsdk under install script** (round 34 ask from
  Aaron; mirrors his current ad-hoc
  `source ".../emsdk/emsdk_env.sh"` in `~/.zshrc`).
  Today emsdk is manually cloned and sourced per-
  contributor. Zeta currently doesn't compile to
  wasm, but Aaron does in his wider workflow. Cleaner
  shape: put emsdk under `tools/setup/common/emsdk.sh`
  as an opt-in install (guarded by a
  `BOOTSTRAP_CATEGORIES=emscripten`-style selector
  once that pattern lands; see
  `BOOTSTRAP_CATEGORIES` BACKLOG item).

  **Effort.** S-M. Clone to a known path, source its
  env file from shellenv.sh when present, opt-in only.

- [ ] **Per-shell `mise activate` in shellenv.sh (dev-laptop
  perf nit)** (round 34 observation). Managed shellenv
  emits `eval "$(mise activate bash)"`. In a bash
  environment (CI, BASH_ENV-sourced subshells, bash
  login) this works perfectly — initial PATH is set and
  bash's `PROMPT_COMMAND` hook keeps it synced. In a zsh
  interactive shell, the bash-specific hooks don't fire;
  PATH gets the activation-time snapshot only, and mise
  shims (if present) end up resolving tools rather than
  direct mise install paths. Functionally correct (still
  mise-managed dotnet), but the ~10x perf win is bypassed
  on dev laptops.

  **Fix sketch.** Emit shell-specific activation based on
  detected parent shell — `mise activate zsh` in zsh,
  `mise activate bash` in bash. Detection inside a
  sourced file that runs in-process is tricky (the file
  is shared across shells); options:
  - Fork the emission: `shellenv-bash.sh` + `shellenv-zsh.sh`,
    rc-file sources the right one.
  - Dynamic detection at source time via `$ZSH_VERSION` /
    `$BASH_VERSION`.
  - Option (b) is simpler and fits the "one file" ethos.

  **Effort.** S (15-min edit + dry-run in both shells).

- [x] ✅ **Pure `mise activate` (no shims) on CI — verified
  round 34.** Commit 9f138eb passed 6/6 CI checks
  (build-and-test on macos-14 + ubuntu-22.04, all four
  lints) with `eval "$(mise activate bash)"` — no
  `--shims`. Matches mise's own ~10x-faster recommendation.
  Evidence ships green on both CI OSes. Follow-up:
  backport the finding to `../scratch` via the
  GOVERNANCE §23 upstream-contribution workflow — they
  ship `--shims` only by historical default.
- [ ] **Compaction mode for container builds** (round 34
  ask from Aaron; mirrors `../scratch`'s
  `BOOTSTRAP_COMPACT_MODE`). When the install script
  runs inside a devcontainer / CI image / build-server
  image, it should clean up intermediate artefacts after
  each tool install — apt caches, download tarballs,
  `~/.cache/mise` bits, shallow-clone `.git` histories
  if we introduce any. Dev-laptop runs should never do
  this (disk is cheap, re-running install is slow).

  **Pattern (from `../scratch/scripts/setup/unix/common.sh`):**
  - `BOOTSTRAP_COMPACT_MODE=true` env var is the gate.
  - `bootstrap_compact_mode_enabled()` helper reads the
    env var honestly (truthy/falsy parsing).
  - Per-tool cleanup helpers:
    `run_<tool>_compact_cleanup` (e.g.,
    `run_brew_compact_cleanup`,
    `run_bootstrap_temp_compact_cleanup`).
  - Called at the tail of the bootstrap orchestrator —
    AFTER all tools are installed, so a failed install
    doesn't wipe useful debugging state.
  - Default: off. CI + container images opt in.

  **Zeta mapping.** Cleanup targets this round would be:
  (a) apt caches on Ubuntu (`apt-get clean` + `/var/lib/apt/lists/*`);
  (b) `~/.dotnet` per-SDK temp tarballs (mise's dotnet
  plugin leaves them around);
  (c) `~/.cache/mise/downloads`;
  (d) brew caches on macOS (`brew cleanup --prune=all`).
  Elan / TLA+ / Alloy jars are small enough to not
  matter in v1.

  **Effort estimate:** M. Design doc first
  (`docs/research/compaction-mode.md`), implementation
  across `tools/setup/common/*.sh` second. Lands with
  `.devcontainer/Dockerfile` when the third leg of
  three-way-parity (GOVERNANCE §24) finally ships.

  **Why this matters.** When `.devcontainer` lands and
  a consumer opens Zeta in Codespaces, the image needs
  to be small enough to pull fast. Without compaction,
  each tool leaves hundreds of MB of intermediates
  that inflate the image 3-5x.
- [ ] **Cross-harness mirror pipeline** (round 34 ask from
  Aaron). Zeta is currently Claude-Code-biased
  (`.claude/skills/`, `.claude/agents/`). Real contributors
  may run Cursor / Windsurf / Aider / Cline / Continue /
  Codex. Each harness reads a different folder; no
  universal one exists.

  **Design (Aaron's call).** One canonical source of truth,
  N harness mirrors generated as build artifacts. Keep
  skill docs ASCII + LF + plain Markdown. No symlinks, no
  clever indirection. Add an index file listing every
  skill + path.

  **Proposed shape:**
  - **Canonical source.** Move `.claude/skills/` →
    `skills/` at repo root. `.claude/agents/` likely
    stays Claude-specific (persona frontmatter with
    `skills:` field, `tools:`, `model:` is Claude-Code
    syntax). Skills themselves are the portable part.
  - **Generator.** `tools/sync-harness-mirrors.sh` (or a
    small F# / Python script) reads `skills/**/SKILL.md`
    and `skills/INDEX.md` and writes to:
    - `.claude/skills/<name>/SKILL.md` (exact copy;
      Claude Code reads from here)
    - `.cursor/rules/<name>.mdc` (frontmatter-adjusted
      per Cursor conventions — `description`, `globs`,
      `alwaysApply`)
    - `.windsurf/rules/<name>.md` (similar adjustment)
    - `.github/instructions/<name>.instructions.md`
      (Copilot path-scoped variant — keeps the existing
      `copilot-instructions.md` as the global prompt,
      adds per-skill scoped prompts)
    - `AGENTS.md` gets a generated "Skills index"
      section the harness-agnostic tooling picks up
  - **CI gate.** Workflow runs the generator + `git
    diff --exit-code`. If mirrors drift from canonical,
    CI fails. Prevents drift the way
    `TreatWarningsAsErrors` prevents warning drift.
  - **Index file.** `skills/INDEX.md` — newest-first per
    §18; one line per skill: name, one-sentence purpose,
    mirror paths (so a human scanning for "where does
    this skill actually live on my harness" finds it).

  **Constraints from Zeta's conventions:**
  - **GOVERNANCE §30 sweep-refs** applies — every `skills/`
    → `<harness>/<path>` rename is a moved path; grep and
    verify on every generator run.
  - **GOVERNANCE §31** applies to any Copilot-visible
    artifact — the generator writes `.github/instructions/*`
    through the skill-creator-equivalent of the
    generator, not ad-hoc.
  - **Nadia (prompt-protector) lints** the generator's
    output. Covert-Unicode + homoglyph sweep on every
    mirror write.
  - **BP-09 ASCII-only** is already a rule; enforce it
    as a generator precondition.
  - No `.txt` for declarative files (Aaron's rule); the
    generator honours existing semantic extensions
    (e.g., `uv-tools` no-extension).

  **Open questions (for the design doc, not this entry):**
  - Does `.claude/agents/*.md` also need a portable
    form, or do we accept that persona frontmatter is
    Claude-Code-only? Leaning toward: agents stay
    Claude-only (they carry `skills:` hat wiring,
    tool-access scopes); skills port cleanly.
  - Should `memory/persona/` stay single-rooted or
    per-harness? Single-rooted is correct (it's
    agent-owned data, not harness config).
  - Is AGENTS.md the aggregation point or does every
    harness still need its own root file?

  **Effort estimate:** ~M. Design doc first (round-N+1),
  implementation the round after. Touches ~60 skill files,
  so the sweep-refs muscle memory from GOVERNANCE §30
  applies directly.

  **Why this matters post-public.** A stranger evaluating
  Zeta from Cursor reads zero of our factory rules today.
  The factory quality signal is invisible to 60%+ of
  modern AI-native developers.

- [ ] **Iris round-34 P0: README aspiration / reality
  framing** (round 34, public-repo triggered). README
  §"What Zeta adds on top" (lines 31-86) reads as
  shipped-today but many items are research-preview or
  post-v1. A consumer currently believes
  `DurabilityMode.WitnessDurable` is callable; it throws
  `NotImplementedException`. Route: Kai (framing decision)
  and Samir (README edit). Needs Aaron sign-off on the
  v1.0 vs post-v1 split before Samir edits. Proposal in
  [memory/persona/iris/NOTEBOOK.md](memory/persona/iris/NOTEBOOK.md)
  round-34 entry.
- [ ] **Iris round-34 P1: README DBSP-notation ↔
  GLOSSARY link** (round 34). README §"What DBSP is"
  introduces `z^-1`, `D`, `I`, `↑` with no link to
  GLOSSARY entries that already gloss them. Cheap fix,
  Samir-owned, S effort.
- [ ] **Iris round-34 P2: Circuit.fs module-level XML
  doc** (round 34). Two-step pattern (`Circuit.create()`
  → `circuit.ZSetInput<T>()`) not explained in file-level
  docs. Ilyana (API shape) + Samir (wording). S effort.
- [ ] **Copilot-instructions continuous improvement
  wiring** (round 34 ask from Aaron, follow-up). Needed:
  (a) GOVERNANCE §31 codifying the factory-managed
  contract, (b) skill-creator scope extension to
  `.github/copilot-instructions.md`, (c) Aarav
  (skill-tune-up-ranker) scope extension to include it,
  (d) Nadia (prompt-protector) scope extension.
- [ ] **Roll out `JOURNAL.md` to remaining personas + codify
  read contract** (round 34 ask from Aaron). Four piloted this
  round (Daya / Bodhi / Iris / Dejan). Append-only, never
  pruned, never cold-loaded, grep-only read discipline. On
  NOTEBOOK prune, entries that merit preservation migrate here
  rather than being deleted. Remaining personas to seed:
  Aarav, Aminata, Ilyana, Kenji, Kira, Mateo, Nadia, Naledi,
  Rune, Soraya, Tariq, Viktor (12). Also: add a BP entry
  codifying the grep-only contract + add to docs/WAKE-UP.md
  as a Tier 3 entry (read contract reminder). Open question:
  does the journal's read discipline need tooling
  (pre-commit hook blocking `cat JOURNAL.md` in agent
  transcripts) or does convention hold? Leaning toward
  convention first, tooling if drift surfaces.
- [ ] **`security-operations-engineer` persona + skill**
  (round 34 ask from Aaron). Runtime / incident-response /
  patch-triage / SLSA-signing-ops / HSM-key-rotation /
  breach-response. Distinct from Mateo (security-researcher
  proactive scouting) and Aminata (shipped threat model)
  and Nadia (agent layer). Slot added to EXPERT-REGISTRY
  as pending. Name queue open (candidates: none yet).
- [ ] **`openspec-gap-finder` skill** (round 32 ask). Viktor
  (spec-zealot) reviews spec-to-code alignment for an existing
  capability but doesn't scan the repo for capabilities shipped
  without a spec. Needs a new skill parallel to
  `skill-gap-finder` — spec-zealot role wears both via the
  Aarav pattern. GOVERNANCE §28 enforcement depends on this.
- [ ] **`static-analysis-gap-finder` skill** (round 33 ask).
  Aaron: "we need another gap analysis tool around static
  analysis and linting and tools and rules we maybe missing."
  Parallel to `openspec-gap-finder` + `skill-gap-finder`.
  Spec-zealot role wears all three gap-finders. Proactive
  lint discovery: enumerate committed languages/surfaces +
  check whether a matching linter is on the lint gate.
- [ ] **Crank lint configurations to HIGH across the board.**
  Aaron: "in general when there is static analysis
  configuration or linting things of that nature we want to
  crank it up to high." Round-33 baseline is mid-stringency;
  post-33 pass researches each tool's recommended-strict
  preset and adopts. Trigger: round 34, after round-33 Track D
  baseline has proven itself stable.
- [ ] **documentation-agent cadence.** Add documentation-agent
  to `factory-audit`'s every-10-rounds walk scope. Each walk:
  scan comments in config files + doc-to-code alignment +
  retired-file references. Round 33 surfaced multiple stale-
  comment issues that would have been caught by a scheduled
  doc-state audit.
- [ ] **Declarative-manifest setup matching `../scratch`'s
  tiered shape.** Zeta's `tools/setup/manifests/` is
  declarative-ish (`apt`, `brew`, etc.) but flat.
  `../scratch`'s `declarative/` has tiered profiles
  (`min`/`runner`/`quality`/`all`) per platform per tool.
  Push one incremental step per round — split `brew` into
  tiers, then `.dotnet-tools` / `.bun-global` formats, etc.
- [ ] **Upstream sync script + `references/upstreams/`
  population.** `references/reference-sources.json` manifest
  exists; sync script referenced in README ("when it exists")
  does not. Build the script so `./tools/setup/sync-
  upstreams.sh` (or equivalent) reads the manifest, clones
  each upstream into `references/upstreams/<name>/`, keeps
  them fresh.
- [ ] **`upstream-comparative-analysis` skill.** Aaron round 33:
  "add a skill around upstream reference comparative analysis
  that will allow us to get ideas and such and compare our
  code with upstreams for inspiration." Skill procedure: pick
  a Zeta subsystem + matching upstream, produce a parallel
  walk highlighting shape / contract / perf / correctness
  differences. Owned by `tech-radar-owner` role; feeds
  `docs/TECH-RADAR.md` Adopt/Trial/Assess/Hold moves.
- [ ] **`product-visionary` role** (round 33 ask). Aaron: "we
  are likely going to need some product owner that drives the
  direction of the project when all the suggestions start rolling
  in from upstream … they should have a longer vision for this
  project." Owns `docs/VISION.md` as Aaron's proxy; runs the
  loop: upstream signals + research + novel ideas → vision check
  → backlog entry (or `WONT-DO.md` entry). Asks Aaron many
  clarifying questions, especially on direction-shifting items.
  Distinct from `branding-specialist` (messaging/positioning)
  and `backlog-scrum-master` (tactical grooming). Ships via
  `skill-creator` workflow. First audit when spawned: walk the
  "needs Aaron validation" list at the bottom of VISION.md.
- [ ] **Upstream categorisation audit (multi-round).** Aaron
  round 33: "we probably need some upstream maintenance to
  make sure all the categories are good and correct and make
  sense for our project because we were not thinking as deeply
  as we are now so there might be better categorisation." The
  `categories` field in `references/reference-sources.json`
  and the grouping prose in `references/README.md` were
  written incrementally and may no longer reflect Zeta's
  current mental model. Walk every upstream, re-read our
  current research notes, propose better categories. Spread
  across multiple rounds (long task requiring many internal
  searches); each round picks a sub-tree.
- [ ] **Post-install repo automation: runtime choice open
  (research needed).** `tools/setup/install.sh` (bash) owns
  bootstrap; post-install polyglot automation (format-repo,
  coverage-collect, benchmark-compare, lint orchestration)
  benefits from one cross-platform runtime. Aaron: "IDK if
  I want to stick with [Bun+TS] which is why i want the
  research." Candidates: Bun/Node, Deno, Python (on PATH
  via mise), .NET console tools, others. Write a design doc
  comparing cold-start, install weight, type safety,
  ecosystem breadth. Trigger: first post-install automation
  task that would need cross-platform scripting.
- [ ] **Devcontainer / Codespaces image (GOVERNANCE §24
  third leg).** Two-leg parity (dev + CI) is today;
  devcontainer closes three-leg parity for first external
  contributor onboarding. Dockerfile calls
  `tools/setup/install.sh`.
- [ ] **Windows CI matrix + Windows install path
  (`tools/setup/windows.ps1`).** Trigger: stable green on
  mac + linux for N rounds, OR named Windows consumer.
  Windows install will be PowerShell, not Git Bash (Git Bash
  is not guaranteed installed).

## P1 — CI / DX follow-ups (after round-29 anchor)

- [ ] **Declarative parity across dev-inner-loop / qa / dev / stage / prod — environment-parity research, time-budgeted (research-first, no implementation tonight).**
  Aaron (2026-04-20): *"also we want our dev innner loop, qa,
  dev, stage, prod to all have declarative pairty someting
  like ArgoCd even for local dev loops i did that before it
  worked well but all bespoke, maybe workth research for
  what's out there and update our tech radar"* +
  *"make sure radar has budget for time"* +
  *"or it's own backlog item in the backlog"*.

  **The architectural claim (to be verified, then codified):**
  - The **same declarative description** of an environment
    (services, secrets, feature flags, resource quotas,
    network policies, observability wiring) should be valid
    at every stage — `dev-inner-loop` (laptop, kind), `qa`,
    `dev`, `stage`, `prod` — with per-stage overlays, not
    per-stage forks.
  - Aaron has built this before, bespoke, and it worked. The
    research question is: **what in the industry reaches
    that same bar without being bespoke?**
  - The ambition goes beyond CD-only (which is "how does prod
    update?"). It's declarative-parity-as-invariant: if the
    description at `stage` and `prod` diverge, that's a bug
    — not an accepted cost of the last mile.

  **Why this matters — what the pattern buys us (Aaron
  2026-04-20: *"this makes everyting provable and easy to
  track lenage and all that, i'm just super consistent with
  my patterns i apply them everywhere"*):**
  - **Provability.** When the environment description lives
    in git as the single source of truth, every live
    environment is a *function* of (declaration × overlay ×
    reconciler state). Drift is a provable fact, not a
    suspected one. "Did prod match spec at time T?" becomes
    a SAT problem on the commit graph, not a sleuth job.
  - **Lineage traceability.** Every environment state has a
    unique commit hash and reconciliation timestamp. Who
    changed what, when, under which review, and under which
    retraction-exception is queryable end-to-end. Same shape
    as Zeta's retraction-native operator algebra — every
    state derivable from input history, every change
    retractable to a prior consistent state.
  - **Pattern coherence with the rest of the factory.** This
    is the same declarative-in-git / retractable / lineage-
    preserved pattern that shows up in:
    - DBSP operator algebra (D/I/z⁻¹/H; every downstream
      value is a function of upstream weight-deltas)
    - `../scratch` bootstrap harness (declarative package
      manifests, not YAML strings)
    - CI retractability inventory (Round 38; five retraction
      classes)
    - gitops-first observability
      (`tools/alignment/audit_*.sh`; git-tracked plain-text
      signals)
    - `openspec/specs/**` (delete-all-code recovery
      contract)
    - preserve-original-and-every-transformation data-value
      rule (memory `feedback_preserve_original_and_every_
      transformation.md`)

    The env-parity work isn't a new pattern; it's the same
    pattern reaching one more surface. That's the coherence
    property the research has to preserve — candidate tools
    score higher the more they compose with the existing
    factory substrate.

  **Candidate tool landscape (for the research to evaluate):**
  - **GitOps reconcilers**: Argo CD, Flux CD, Rancher Fleet,
    Jenkins X, CodeFresh GitOps, Weave GitOps.
  - **Manifest composition / overlays**: Kustomize, Helm +
    values-per-env, jsonnet (Grafonnet shape), cdk8s, Pulumi
    (TS/Python/Go — declarative-via-code), Tanka.
  - **IaC for the non-K8s layer**: Terraform / OpenTofu,
    Pulumi, Crossplane (K8s-native IaC).
  - **Local-loop-to-prod-parity tools**: Tilt, Skaffold,
    DevSpace, Okteto, Garden, Telepresence.
  - **Policy-as-code alongside manifests**: OPA / Gatekeeper,
    Kyverno, Conftest.
  - **Config-as-data / schema-first**: KCL, CUE, Dhall, KRM
    (K8s Resource Model functions).
  - **Environment-topology-as-code**: Shipa, Humanitec, Mia-
    Platform, Port.

  **Research phase — time-budgeted explicitly (this is the
  Aaron-requested budget):**

  | Phase | Scope | Time budget |
  |---|---|---|
  | 1. Landscape scan | Survey of the 30+ candidates above; one-paragraph capsule per tool; reject-criteria applied. | 1 day |
  | 2. Shortlist deep-dive | Top 4-6 candidates; hands-on kind-cluster reproduction of each; retraction-friendliness scored against Round 38 taxonomy. | 3 days |
  | 3. Env-parity evaluation | For top 2 finalists: write the same environment spec and reconcile it across inner-loop (kind), stage (kind-in-different-shape), prod-mock (real cloud test account or Kubeadm). Measure parity-diff. | 2 days |
  | 4. Synthesis + radar update | Single ADR under `docs/DECISIONS/` with the architectural choice; TECH-RADAR updates (Adopt/Trial/Assess/Hold for each finalist); BACKLOG follow-ups for implementation. | 1 day |

  **Total budget: ~7 days (M-to-L).** This is research; no
  implementation until the ADR lands and the maintainer signs
  off.

  **Research output shape:**
  - `docs/research/declarative-env-parity-landscape.md` (phase 1)
  - `docs/research/declarative-env-parity-shortlist.md` (phase 2)
  - `docs/research/declarative-env-parity-finalists.md` (phase 3)
  - `docs/DECISIONS/YYYY-MM-DD-declarative-env-parity.md` (phase 4 ADR)
  - TECH-RADAR rows for each evaluated tool with `Round: 39+`

  **Explicit non-scope (tonight):**
  - No tool installation, no kind cluster spin-up.
  - No `.github/workflows/` changes.
  - No Helm charts, no Kustomize bases, no Argo CD Application
    resources.
  - This entry is a research commission with an explicit time
    budget, not an implementation ticket.

  **Owner**: Dejan (devops-engineer) leads research; Bodhi
  (developer-experience-engineer) on dev-inner-loop ergonomics;
  Naledi (performance-engineer) on reconciliation latency +
  resource footprint comparison; Nazar (security-operations)
  on secret-flow-across-envs; Aminata (threat-model-critic)
  reviews the synthesis ADR. Kenji integrates.

  **Relationship to the CI meta-loop entry immediately below:**
  that entry is about *pipeline ethos* (real scripts, gitops,
  retractable CD, worktree inner loop). This entry is about
  *environment declarative parity* (same spec shape from
  laptop-kind through prod). They overlap on tool choice
  (Argo CD / Flux appear in both) but have different
  decision surfaces. Land them as sibling research tracks;
  synthesis ADRs can reference each other.

  **Cross-references:**
  - Sibling entry below: "CI = Continuous Improvement of
    Continuous Integration — retractable pipeline..."
  - `docs/research/ci-retractability-inventory.md` (Round 38)
  - `docs/TECH-RADAR.md` — rows to be added during research
  - `../scratch/` — the bespoke ethos reference (Aaron's
    prior work at shape of this)

- [ ] **CI = Continuous Improvement of Continuous Integration — retractable pipeline from dev-worktree through kind-local K8s (research-first, no implementation tonight).**
  Aaron (2026-04-20): *"our CI is Continious Imporvement of
  Continuius Integration with retractiable delivers to CD ->
  Ops -> K8s (kind) for loacal testing with same ethos as
  ../scrath everything declarative in get even my local dev
  inner loop is a git work tree probably that seems to be what
  everyone is standardizing on i do some resarch and educate
  me on backlog not tonight"*

  **The architectural claim (to be verified, then codified):**
  - "CI" is a **meta-loop**: Continuous Improvement continuously
    improves Continuous Integration. The outer loop tunes the
    inner loop from observability signal.
  - "CD" must be **retraction-native** — every deploy must be
    revertable without leaving artefact ambiguity behind.
    Extends the Round 38 CI retractability inventory
    (`docs/research/ci-retractability-inventory.md`) downstream
    into delivery.
  - **Pipeline shape**: `dev-worktree → CI → CD → Ops → K8s (kind)`.
    Local inner-loop = git worktree; K8s-in-Docker (`kind`) gives
    the dev laptop the same cluster shape as prod.
  - **Ethos**: match `../scratch` — real scripts + real tests
    over long YAML strings, declarative manifests per package
    manager, profile/category composition (orthogonal dimensions
    not flags), platform-default integration (integrate defaults,
    don't fight them), `mise`-unified runtimes, docker
    reproductions of the GitHub Actions runners for
    local/remote parity.
  - **Everything declarative in git** — extending the gitops
    pattern (git-first text-based observability; industry-
    standard term per Weaveworks 2017) from observability to
    the whole pipeline. Candidate tools: Argo CD, Flux, Jenkins
    X, FluxCD for reconciliation; Helm / Kustomize for
    manifest composition; Tekton / Dagger for declarative CI
    workflows.

  **Research phase (before any implementation):**
  1. **Worktree-as-inner-loop thesis.** Is the industry actually
     standardizing on this? Signals to evaluate: Jujutsu (jj) +
     anonymous-branch workflow, dev containers + worktree
     composition, GitHub Codespaces + worktree-per-task, AI-
     agent workflows (Claude Code isolation mode, Cursor
     background agents) using worktrees for parallel
     experimentation. If yes: what does the ergonomics look
     like at scale? (dotfiles sync, tool caching, IDE context
     switching, branch-protection coupling.)
  2. **Local K8s options.** `kind` vs `minikube` vs `k3d` vs
     `k3s` vs `microk8s`. Criteria: cluster startup time,
     resource footprint, API parity with managed K8s
     (EKS/AKS/GKE), multi-node support, CNI compatibility,
     GitOps-tool support.
  3. **Retraction-native CD.** Which CD systems support
     retraction as a first-class primitive (not just
     rollback-as-afterthought)? Argo CD `spec.rollback` +
     Rollouts, Flux `Kustomization.suspend/resume`, Spinnaker
     canary + automatic rollback, Octopus Deploy retention
     policies, Harness self-healing deployments. Score each
     against the Round 38 retractability taxonomy
     (revertable-in-git / retryable-idempotently /
     republishable-with-same-version / genuinely-non-
     retractable / named-exception).
  4. **GitOps integration discipline.** Argo CD vs Flux for
     a project of Zeta's shape. Retraction-friendliness
     comparison. Secret-management integration (matches the
     P2 gitops-friendly-key-management ADR thread — git-crypt
     vs SOPS vs age vs Mozilla SOPS+KMS).
  5. **Parity with `../scratch` ethos.** What do we borrow
     verbatim? `mise` as runtime manager is already in the
     round-29 install script. Declarative manifests per
     package manager — do we already have this shape for CI
     runner dependencies, or is there duplication with
     `tools/setup/`?
  6. **"Continuous Improvement" as observable loop.** What
     does the improvement-metric look like? Candidates: build
     time percentiles, flake rate, time-to-recovery on red
     main, reviewer-queue depth, retraction-used count. Link
     to the round-39 tick-loop layer-0 observability work so
     the outer loop reads signal the inner loop already emits.
  7. **Research output shape.** One writeup per research
     question, landing under `docs/research/` as a set
     (`dev-worktree-inner-loop.md`,
     `local-k8s-kind-vs-alternatives.md`,
     `retraction-native-cd.md`,
     `gitops-pipeline-argocd-vs-flux.md`,
     `scratch-ethos-port-to-zeta.md`,
     `ci-as-continuous-improvement-meta-loop.md`). Then a
     single synthesis ADR under `docs/DECISIONS/` with the
     architectural decisions, gated by a maintainer
     conversation.

  **Explicit non-scope (tonight):**
  - No installation of `kind`, Argo CD, Flux, or any CD system.
  - No `.github/workflows/` changes.
  - No worktree-workflow scripts.
  - No rewrites of `tools/setup/`.
  - This entry is a research commission, not an implementation
    ticket.

  **Owner**: Dejan (devops-engineer) leads research; Nazar
  (security-operations) on secret-management + retraction-
  native CD sections; Naledi (performance-engineer) on
  local-K8s benchmark comparison; Aminata (threat-model-
  critic) reviews the synthesis ADR for attack surface.
  Architect (Kenji) integrates. Review gate: Ilyana for any
  public-interface fallout.

  **Effort**: **L** (3+ days of research across six
  questions); follow-on implementation scoped per question
  (likely each an M-to-L once we decide).

  **Cross-references:**
  - `docs/research/ci-retractability-inventory.md` (Round 38) —
    retractability classification upstream of this entry
  - `docs/research/build-machine-setup.md` — current install
    script + CI shape
  - `../scratch/` — the ethos-reference directory (read-only
    source of borrowed patterns)
  - `memory/persona/best-practices-scratch.md` — gitops
    candidate BP (git-first text-based observability)
  - P0 "Fully-retractable CI/CD" elsewhere in this file —
    the implementation parent this research feeds
  - P2 "Gitops-friendly key management + rotation — ADR
    first" — the secret-management co-traveller

- [ ] **`.NET Aspire` evaluation — AppHost + ServiceDefaults + OpenTelemetry as the .NET-native runtime-observability spine (research-first, no implementation tonight).**
  Aaron (2026-04-20): *"oh dotnet aspire and dev containr
  backlog"*.

  **The architectural hypothesis (to be verified):**
  - `.NET Aspire` (Microsoft's cloud-native orchestration
    for .NET 8+) ships the exact shape the runtime-
  observability starting-points memory calls for: OTel
    wiring, health checks, service discovery, and a
    per-service "ServiceDefaults" project that centralises
    instrumentation concerns. If the shape composes with
    Four Golden Signals + RED + USE
    (`memory/feedback_runtime_observability_starting_points.md`),
    Aspire becomes the Zeta default for library-consumer
    services and the devcontainer-parity substrate.
  - Aaron's `../AspireApp1` (Jan 2024 prototype) is prior
    art — don't re-evaluate from scratch; port lessons.
  - Aspire's AppHost + manifest-export pipeline is
    declarative-parity-adjacent to the P1 env-parity
    research above. Evaluate whether Aspire manifests
    compose with Argo CD / Flux reconcilers or whether
    they fight each other.

  **Research phase — time-budgeted (S-to-M):**

  | Phase | Scope | Time budget |
  |---|---|---|
  | 1. Feature scan | Aspire 9.x capabilities: AppHost DSL, ServiceDefaults, integrations (Redis / Postgres / RabbitMQ / OTel collectors), dashboard, manifest export. | 1 day |
  | 2. Zeta fit | Can `Zeta.Core` (pure library) + a thin `Zeta.Host` (hypothetical) adopt Aspire without forcing a framework on library consumers? | 1 day |
  | 3. Observability spine fit | Wire Aspire's OTel defaults to emit Four Golden Signals + RED + USE shapes. Measure friction vs writing it bespoke. | 1 day |
  | 4. Synthesis | ADR under `docs/DECISIONS/` — Adopt / Trial / Assess with rationale. TECH-RADAR row. | 0.5 day |

  **Non-scope (tonight):**
  - No `.AppHost` project creation.
  - No new NuGet dependencies.
  - No changes to `Zeta.Core` or any shipped library.

  **Owner**: Dejan (devops-engineer) leads; Ilyana
  (public-api-designer) on library-consumer boundary —
  Aspire must not leak into the published API surface of
  `Zeta.Core` / `Zeta.Core.CSharp` / `Zeta.Bayesian`.
  Naledi (performance-engineer) on instrumentation
  overhead. Kenji integrates.

  **Cross-references:**
  - `memory/feedback_runtime_observability_starting_points.md`
    — the 4GS+RED+USE starting-points this evaluates against
  - `memory/feedback_dora_is_measurement_starting_point.md`
    — the build/delivery column substrate
  - P1 "Declarative parity across dev-inner-loop / qa /
    dev / stage / prod" above — sibling env-parity research
  - P1 "CI = Continuous Improvement…" above — sibling
    pipeline-ethos research
  - P1 "Devcontainer / Codespaces image (GOVERNANCE §24
    third leg)" at `## P1 — CI / DX follow-ups` — Aspire
    evaluation feeds devcontainer image decisions
    (pre-installed `.NET` workloads / tools)

- [ ] **`../scratch` ↔ `Zeta` declarative-bootstrap parity — first concrete substrate for the citations-as-first-class concept; inheritance-graph is one implementation, "remember" primitive is another.**
  Aaron (2026-04-20, in order):
  1. *"also ../scratch parity"*
  2. *"first class feature of source or ace our package
     manager ../scratch parity converts the vibe-citation
     into an auditable inheritance graph"*
  3. *"citations is really the feature"*
  4. *"sorry inheritance graph is awesome too I was just
     saying concepts are the feature, then we have the
     implementation"*
  5. *"i think that will help us 'remember' to keep things
     clean and audit more easy, you are going research
     and tell me"*

  **Architectural elevation (2026-04-20, load-bearing).**
  The **concept** is citations-as-data (first-class, in
  source or `ace`). The **implementations** the concept
  enables include: (a) the auditable inheritance graph
  between `../scratch` and `Zeta`, (b) the drift-checker
  (generalising `verification-drift-auditor` to every
  citation), (c) the "remember" primitive that turns
  memory cross-references into a queryable graph,
  (d) the lineage tracer. See
  `memory/project_vibe_citation_to_auditable_graph_first_class.md`.
  This BACKLOG entry is **the first concrete substrate**
  for exercising the concept; the citations-as-first-class
  research entry below is the concept itself.

  **The pattern — vibe-citation to auditable graph.** Two
  repos (or two subsystems, or two environments) cite each
  other as "same ethos" or "we borrowed this pattern from X".
  That citation is a *vibe* until it becomes a *graph*:
  nodes = declarative patterns, edges = (inherited / mirrored
  / diverged / should-flow-other-way). The graph lives in git,
  is queryable, and fails CI when the claimed inheritance
  drifts. Same shape as retraction-native DBSP — every borrowed
  pattern is a function of source + transformation, not a
  statement of intent.

  **Candidate homes (research output names the winner):**
  - **Zeta Seed kernel** — the graph-computation primitive
    ships as a BCL-level feature, reusable by any pair of
    repos a consumer wants to check for parity. Makes Zeta
    one more register of repos-as-data.
  - **`ace`** — the self-bootstrapping package manager
    computes inheritance as part of its dependency graph
    (declarative parity is just a specialisation of
    dependency-parity). Ships as a CLI + library.

  **The architectural claim (to be verified, then codified):**
  - `../scratch` is already the named ethos-reference in two
    P1 entries above (env-parity + CI meta-loop). It ships
    real scripts + real tests instead of YAML strings,
    declarative package manifests under
    `declarative/{debian,bun,dotnet,python,macos,windows}/`,
    profile/category composition, platform-default
    integration, mise-unified runtimes, and docker
    reproductions of GitHub Actions runners.
  - Zeta's `tools/setup/install.sh` is a single install
    script consumed three ways (dev laptops / CI runners /
    devcontainer images per GOVERNANCE §24). The pattern
    is the same shape but has not been explicitly
    reconciled against scratch.
  - The research question: **which scratch patterns should
    Zeta borrow, which should stay scratch-only, which
    represent drift that one side should correct?** Make
    the inheritance graph explicit so future changes to
    either repo can be audited for parity impact.

  **Research phase — time-budgeted (S):**

  | Phase | Scope | Time budget |
  |---|---|---|
  | 1. Pattern inventory | Enumerate declarative patterns in scratch (package manifests, shellenv management, category composition, platform branching, mise integration). For each, classify: (a) already in Zeta, (b) worth porting to Zeta, (c) scratch-specific, (d) should flow the other way. | 0.5 day |
  | 2. Divergence audit | For each "already in Zeta" pattern, diff the two implementations. Flag drift. | 0.5 day |
  | 3. Synthesis | `docs/research/scratch-zeta-parity.md` — the inheritance graph + named drift items + recommended corrections. Not an ADR; research output. | 0.5 day |

  **Non-scope (tonight):**
  - No edits to `tools/setup/install.sh`.
  - No edits to `../scratch/`.
  - No new install scripts.

  **Owner**: Dejan (devops-engineer) leads; Bodhi
  (developer-experience-engineer) on first-60-minutes
  friction delta between the two repos. Kenji integrates.

  **Why this matters.** The env-parity + CI meta-loop
  research entries both cite scratch as ethos-reference
  without defining which specific patterns are being
  borrowed. That reference is currently a vibe, not a
  contract. This entry turns the vibe into an auditable
  inheritance graph so parity claims can be checked.

  **Cross-references:**
  - `../scratch/README.md` — the scratch source of truth
  - `../scratch/scripts/setup/PLATFORM_PARITY.md` —
    cross-platform parity notes already in scratch
  - P1 "Declarative parity…" above — the consumer of this
    research
  - P1 "CI = Continuous Improvement…" above — the other
    consumer
  - P1 "Devcontainer / Codespaces image" at `## P1 — CI /
    DX follow-ups` — devcontainer image parity pulls from
    this research

- [ ] **Citations-as-first-class concept — research commission (Aaron 2026-04-20: "you are going research and tell me").**
  Aaron (2026-04-20, in order):
  1. *"first class feature of source or ace our package
     manager ../scratch parity converts the vibe-citation
     into an auditable inheritance graph"*
  2. *"citations is really the feature"*
  3. *"sorry inheritance graph is awesome too I was just
     saying concepts are the feature, then we have the
     implementation"*
  4. *"i think that will help us 'remember' to keep things
     clean and audit more easy, you are going research
     and tell me"*

  **The concept (first-class, load-bearing):** Citations
  are data. Every cross-reference in the factory —
  between repos, docs, specs, skills, commits, BACKLOG
  entries, research reports, memory files, notebooks,
  ADRs, GOVERNANCE sections, BP-NN rules — is a citation
  with structure (subject / object / relation /
  provenance). Making citations queryable instead of
  prose is the feature.

  **Implementations the concept enables:**
  - Auditable inheritance graph (the `../scratch`
    parity BACKLOG entry above is the first substrate).
  - Drift-checker generalising
    `verification-drift-auditor` to every citation.
  - "Remember" primitive — Aaron: *"help us 'remember'
    to keep things clean"*. Memory / docs / skills /
    BACKLOG cross-references stop being prose soup and
    become a queryable graph.
  - Lineage tracer — for any artefact, produce the
    citation-ancestor set; same shape as DBSP
    retraction-native algebra.

  **Research phase — time-budgeted (S-to-M):**

  | Phase | Scope | Time budget |
  |---|---|---|
  | 1. Prior art scan | Existing work on citation-as-data: academic citation graphs (OpenCitations, Crossref), OSS dependency graphs (Software Heritage, deps.dev), source-code reference-trackers (ctags, LSP references, `#cite` extensions), doc-linking tools (Backlinks in Obsidian / Logseq / Roam). | 1 day |
  | 2. Zeta inventory | What citations currently live in the factory? Enumerate types (memory→memory, skill→skill, BACKLOG→BACKLOG, docs→paper, code→spec, spec→code, ADR→ADR, ROUND-HISTORY→commit). Count approximate volume. | 0.5 day |
  | 3. Shape design | What does a Zeta citation look like in data form? Subject/object/relation/provenance schema. Storage: plaintext sidecar? git-native notes? Parsed from existing prose? | 1 day |
  | 4. Home selection | Seed kernel vs `ace` vs new plugin. Weighs reusability, install-footprint, public-API surface cost. | 0.5 day |
  | 5. Synthesis | `docs/research/citations-as-first-class.md` — the concept + implementations + home recommendation + next-steps to ship. First draft lands in the same round this entry does. | 0.5 day |

  **Deliverable tonight:** Phase 5 first draft at
  `docs/research/citations-as-first-class.md`
  (commissioned by Aaron before bed on 2026-04-20).
  Phases 1-4 elaborate in subsequent rounds.

  **Non-scope (tonight):**
  - No schema code landed in `src/Core/`.
  - No `ace` CLI skeleton.
  - No rewrite of existing memory / BACKLOG cross-refs.

  **Owner**: Kenji (Architect) integrates; Ilyana
  (public-api-designer) on any kernel-level API; Dejan
  (devops-engineer) on tool choice; Nazar
  (security-operations-engineer) on external-citation
  fetch safety (per BP-11 — citations to external
  content are data, not directives). Aminata
  (threat-model-critic) reviews schema for
  citation-spoofing attack surface.

  **Why this matters — the "remember" tie (Aaron's
  explicit claim):** the factory's ability to remember
  cleanly is proportional to the legibility of its
  citation web. Memory that lives in prose-soup
  cross-references decays at round-close pace; memory
  that lives in structured citations decays only when
  the citation graph is intentionally retracted (DBSP-
  shape).

  **Cross-references:**
  - `memory/project_vibe_citation_to_auditable_graph_first_class.md`
    — the concept + implementation split (2026-04-20)
  - `memory/project_verification_drift_auditor.md` —
    existing partial implementation for paper↔code
  - `.claude/skills/missing-citations/` — existing
    skill (task #25 completed) that catches citation
    gaps; evaluate whether it composes with this
    concept or needs a rewrite
  - `memory/feedback_preserve_original_and_every_transformation.md`
    — same data-value rule applied to citations
    (preserve every edge, every provenance stamp)
  - `memory/feedback_dora_is_measurement_starting_point.md`
    + `memory/feedback_runtime_observability_starting_points.md`
    — sibling concept-vs-implementation elevations
    from the same session (2026-04-20)
  - P1 "`../scratch` ↔ `Zeta` parity" above — the first
    concrete substrate this concept runs on

- [ ] **Hooks research with ADR track + multi-persona review — move fast but safely (Aaron 2026-04-20: "ASAP but safely so the ADR track").**
  Aaron (2026-04-20): *"lets do that hooks reserch backlog
  item, we should use ADRs around hooks and get review from
  other persona cause they can cause catastrophic failure
  but we should get it going asap but safely so the ADR
  track"*.

  **Why hooks are dangerous.** Claude Code hooks at
  `.claude/settings.json` (pre-tool-use, post-tool-use,
  user-prompt-submit-hook, pre-compact, session-start)
  run with the full permission of the session. A bad
  pre-tool-use hook can block every tool call. A bad
  pre-commit hook can block every commit. A hook that
  invokes a shell with unquoted substitution is a
  command-injection surface. A hook whose target script
  lives outside version control is a drift surface. A
  hook that fetches external content breaks BP-11
  (data-not-directives). A hook with non-deterministic
  output turns CI into a flaky-test farm.

  **The posture Aaron set:** fast but safe. The ADR
  track is what makes "fast + safe" compatible — every
  hook lands via a formal Architectural Decision Record,
  with multi-persona review *before* the hook is added
  to `.claude/settings.json`.

  **ADR track contract (to codify):**
  - **Location**: `docs/DECISIONS/YYYY-MM-DD-hook-<name>.md`.
  - **Template sections**: (a) what the hook does, (b)
    when it fires, (c) catastrophic-failure modes
    (denylist), (d) rollback procedure, (e) reviews
    collected, (f) deployment gate.
  - **Reviewers required** (before the hook enters
    `.claude/settings.json`):
    - **Dejan** (devops-engineer) — CI / pre-commit /
      retractability angle.
    - **Nadia** (prompt-protector) — prompt-injection
      surface per BP-11.
    - **Aminata** (threat-model-critic) — adversarial
      stance against the hook shape.
    - **Nazar** (security-operations-engineer) — ops
      runbook for hook-fails-catastrophically.
    - **Bodhi** (developer-experience-engineer) — human
      contributor surface (what does a failed hook
      look like to a fresh clone?).
  - **Kill-switch clause**: every hook ADR names a
    one-line removal recipe. A hook that can't be
    removed in one line doesn't land.
  - **Dry-run clause**: every hook ADR requires a
    single-session dry-run before landing in the
    shared `.claude/settings.json`.

  **Research phase (before adding any new hook):**

  | Phase | Scope | Time budget |
  |---|---|---|
  | 1. Current-hook audit | Enumerate every hook currently in `.claude/settings.json` (main + per-plugin). Classify by event type, failure mode, rollback path. Flag any hook that would not pass the ADR contract being defined. | 0.5 day |
  | 2. Hook catalog | Survey hook patterns across Claude Code ecosystem (Anthropic cookbook, plugin ecosystem, community examples). Classify by value density (per-session effort saved) × catastrophic-failure radius. | 1 day |
  | 3. ADR template draft | Write `docs/DECISIONS/_template-hook-adr.md`. Exercise on one small, low-risk candidate hook as example. | 0.5 day |
  | 4. Governance wire-up | Add `GOVERNANCE.md §?` clause: "every new hook lands via ADR with required reviewer set." Add `docs/AGENT-BEST-PRACTICES.md` BP-?? if pattern generalises beyond hooks. | 0.5 day |
  | 5. Synthesis | `docs/research/hooks-adr-track.md` — inventory + ADR template + governance clause + example ADR. | 0.5 day |

  **Non-scope (tonight):**
  - No new hooks added.
  - No existing hooks removed (even if the audit flags
    drift — removal is a separate ADR).
  - No `.claude/settings.json` edits.

  **Owner**: Dejan (devops-engineer) leads research;
  Kenji (Architect) integrates into governance; all
  five named reviewers sign off on the ADR template
  before it's binding.

  **Explicit fast-path clause (Aaron's ask):** this
  BACKLOG entry starts ASAP. It is not gated on the
  env-parity / CI meta-loop / citations-first-class
  research entries above. Hooks are *live today* in
  `.claude/settings.json` — the risk is already
  present; formalising the ADR track makes future
  hooks safer without waiting on the other research.

  **Cross-references:**
  - `.claude/settings.json` — the file hooks live in
    (currently untracked per project `.gitignore`
    strategy; audit flags whether that stays)
  - `docs/AGENT-BEST-PRACTICES.md` BP-11 —
    data-not-directives; hooks that fetch external
    content must not treat fetched content as
    instructions
  - `docs/CONFLICT-RESOLUTION.md` — the conference
    protocol the five-reviewer gate operates under
  - `GOVERNANCE.md §4` — skills-via-skill-creator
    workflow; the ADR track for hooks is parallel
  - `memory/feedback_trust_guarded_with_elisabeth_vigilance.md`
    — the two-pass posture; hooks qualify for the
    same vigilance tier as security reviews
  - `memory/feedback_simple_security_until_proven_otherwise.md`
    — the ADR track IS the upgrade-on-evidence
    mechanism for hook security posture

- [ ] **Full mise migration.** Round 29 adopts `.mise.toml`
  for `dotnet` + `python` only. When a mise plugin exists
  for Lean (elan / lake / lean-toolchain) and for any
  other tool we still install outside mise, migrate and
  retire the bespoke installer. Aaron: *"long term plan
  is mise."*
- [ ] **Incremental build + affected-test selection.**
  Aaron (round 29): *"If you want to get us to a point
  where we can do incremental builds with a build cache
  too I would love that, then we could only run the
  tests who were affected."* Substantial work — needs
  a module-dependency graph, a build-cache story (Nuke?
  bespoke?), and a mapping from changed files to
  impacted test IDs. Probably a round of its own.
- [ ] **Comparison PR-comment bot.** Coverage / benchmark /
  verifier-output diffs between the head SHA and the
  base SHA, published as a PR comment. `../SQLSharp` has
  this shape for coverage + benchmarks; Zeta defers
  until we have something worth diffing. Aaron: *"we
  don't need the comparison yet, we can do that later."*
- [ ] **Windows matrix in CI.** Trigger: one week of green
  runs on `ubuntu-22.04` + `macos-14` — no pre-arranged
  "breaking test" required. Aaron: *"let's just do it
  once we are in a stable spot with mac and linux."*
  Requires the install script to grow Windows support
  (PowerShell bootstrap or WSL path) first.
- [ ] **Parity swap: CI's `actions/setup-dotnet` →
  `tools/setup/install.sh`.** Round-29 first workflow
  uses `actions/setup-dotnet@<sha>` for speed. Per
  GOVERNANCE.md §24, the parity target is CI running
  the same install script dev laptops and
  devcontainers run. Swap in once the install script is
  stable across macOS + Linux runners.
- [ ] **Devcontainer / Codespaces image.** Dockerfile
  at `.devcontainer/Dockerfile` that runs
  `tools/setup/install.sh` during image build, plus
  `.devcontainer/devcontainer.json` metadata. Closes
  the third leg of the three-way parity per
  GOVERNANCE.md §24.
- [ ] **Open-source-contribution log.** A rolling ledger
  (probably at `docs/UPSTREAM-CONTRIBUTIONS.md`) of PRs
  Zeta has opened against upstream projects per
  GOVERNANCE.md §23 — what shipped, what's pending,
  what's blocked. Aaron's mise-dotnet-plugin PR is the
  first entry.
- [ ] **Branch-protection required-check on `main`.**
  Trigger: one week of clean CI runs. Required check
  lands once we trust the signal.

## P0 — Threat-model elevation (round-30 anchor)

- [ ] **Nation-state + supply-chain threat-model rewrite.**
  Aaron at round-29 close: *"in the real threat model we
  should take into consideration nation state and supply
  chain attacks."* He helped build the US smart grid
  (nation-state defense work) and is a gray hat with
  hardware side-channel experience. The current
  `docs/security/THREAT-MODEL.md` is under-scoped for
  this adversary class.

  **Scope:**

  - `docs/security/THREAT-MODEL.md` adversary-model
    revision: advanced persistent threat + nation-state
    - sophisticated supply-chain adversary as
    first-class threat classes, not box-ticks.
  - Expanded supply-chain coverage: package registries
    (NuGet, Mathlib, Homebrew formulae), build
    toolchain (dotnet SDK, elan, mise installers), CI
    runners (GitHub Actions runner image compromise,
    runner-level persistence), third-party actions
    (beyond our SHA-pin mitigation), dep-graph attacks.
  - Every mitigation validated against a real control
    (code / governance rule / CI gate / reviewer
    cadence). Unenforced mitigations are gaps, not
    mitigations.
  - Side-channel + hardware adversary coverage (timing,
    cache behavior, microarchitectural leaks,
    speculative execution for tenant-isolated
    deployments).
  - Nation-state-level response playbook: what happens
    if actions/checkout is compromised? mise.run is
    hijacked? NuGet serves a poisoned package? Written
    *before* we need it.
  - `docs/security/THREAT-MODEL-SPACE-OPERA.md`
    completed as the serious-underneath-the-fun
    variant — every silly adversary maps to a real
    STRIDE class + real control + real CVE-style
    escalation path.

  **Primary:** `threat-model-critic` on the doc
  authoring. **Secondary:** `security-researcher` on
  novel attack classes, current CVE landscape,
  advisory-tracking. **Consulting:** Aaron, on
  nation-state-adversary modeling (his domain).

## P0 — CI / build-machine setup (round-29 anchor)

- [ ] **First-class CI pipeline for Zeta.** Every agent-written
  commit eventually has to pass the same gate a human commit
  does; right now the only gate is `dotnet build -c Release`
  on the maintainer's laptop. Aaron's framing (round 28):

  > "Our CI setup is as first class for this software factory
  > as is the agents themselves, it does not ultimately work
  > without both."

  Discipline rules committed up front:

  1. **Read-only reference.** `../scratch` is the model for
     build-machine setup (scripts, installers, install
     locations, tool pins). `../SQLSharp` is the model for
     GitHub Actions workflows. **Never copy files.** Read to
     understand the shape and the intent; hand-craft every
     artefact from scratch for Zeta so no cruft or
     assumptions from another repo's context sneaks in.
  2. **Human review on every decision.** Aaron reviews the
     OS matrix, tool versions, caching strategy, artefact
     retention, secret handling, permissions model, workflow
     triggers, and the per-job concurrency/timeout settings
     before any workflow lands. This is *not* a place for
     "ship and iterate".
  3. **Cost discipline.** CI minutes are the expensive
     resource. Every job earns its slot: justify any
     matrix-axis expansion, any scheduled run, any
     always-on-PR gate. Default to narrow (one OS, one
     dotnet, current branch only) and widen only with a
     stated reason.
  4. **Cross-platform, eventually.** Zeta is cross-platform
     (.NET 10, macOS arm64 dev box, Linux CI, Windows
     supported). Aaron can run rounds on Windows when
     Windows-specific work is under way; say so when useful.
     CI matrix should cover at least macOS + Linux; Windows
     gets added once we have a Windows-breaking test to
     justify the slot.
  5. **Parallelism note.** Product work and CI work run on
     one maintainer machine but rarely interfere at the
     shell level. Architect is free to dispatch CI-design
     subagents in parallel with product work as long as
     neither agent writes the same file.

  **First sub-tasks (round-29 anchor; each its own Aaron
  review gate):**

  1. Audit `../scratch` for install-script patterns (what
     tools, what versions, what pinning method, what target
     paths). Output: a design doc at
     `docs/research/build-machine-setup.md` citing every
     borrowed idea and nothing else. No file copies.
  2. Audit `../SQLSharp` `.github/workflows/` for workflow
     shape (triggers, jobs, matrix, caching, permissions).
     Output: a design doc at
     `docs/research/ci-workflow-design.md`.
  3. Map Zeta's actual gate list: `dotnet build`,
     `dotnet test`, Semgrep, Alloy (needs JDK), Lean proofs
     (needs elan/lake), TLC (needs JDK + tla2tools.jar),
     Stryker (slow — scheduled not per-PR), FsCheck tests.
     Output: a gate inventory at
     `docs/research/ci-gate-inventory.md`.
  4. First workflow: `build-and-test.yml` covering
     `dotnet build -c Release` + `dotnet test Zeta.sln -c
     Release` on `ubuntu-latest` + `macos-latest`. Nothing
     else until Aaron has signed off on the gate list.
  5. Subsequent workflows added one at a time, each with
     explicit Aaron sign-off on the design doc first.

## P0 — security / SDL artifacts

- [ ] **`docs/security/CRYPTO.md`** — justify CRC32C (integrity, not
  auth) vs SHA-256 (future roadmap for tamper-evident checkpoint
  manifests).
- [x] ✅ **5 new Semgrep rules** (SDL-derived): unchecked deserialization,
  `File.ReadAllBytes` on user path w/o size cap, `Process.Start`,
  `Activator.CreateInstance` from untrusted type string,
  `System.Random` in security context. Shipped round 17 as rules
  8-12 in `.semgrep.yml`.
- [x] ✅ **CodeQL workflow** — `.github/workflows/codeql.yml`
  landed round 34 (commit `23ca7a2`, GitHub-default starter);
  **tuned to Zeta-ideal in round 34** (same round). `csharp`
  now builds via `tools/setup/install.sh` + `dotnet build
  Zeta.sln -c Release` (manual build-mode, real IL analysis);
  `java-kotlin` dropped; `security-extended` on PR + add
  `security-and-quality` on scheduled sweep; config file at
  `.github/codeql/codeql-config.yml` with paths-ignore for
  vendored upstreams / benches / formal-method tool trees;
  concurrency group + 30-min timeout. Items 6-8 (CODEOWNERS
  alert-routing, SHA-pins, custom `.ql` pack) tracked in
  `.claude/skills/codeql-expert/SKILL.md` as follow-ups; SDL
  practice #9 satisfied for the semantic / taint-flow slice.
- [ ] **pytm threat model** — `docs/security/pytm/threatmodel.py`
  replaces markdown-only threat-model as authoritative source.

## P1 — within 2-3 rounds

- [ ] **Fresh-session quality research — close the gap
  between fresh and resumed Claude sessions.**
  Aaron 2026-04-23 observation: *"i tried a fresh session
  instead of resuming form the existing, its not as goona,
  maybe do some research on yourself on how to make sure
  fresh cluade sessions are as good as you, backlog item"*.

  **Observed phenomenon:** resumed Claude Code sessions on
  this project operate at a noticeably higher quality than
  fresh-session starts, despite fresh sessions loading the
  same CLAUDE.md + AGENTS.md + MEMORY.md index. Something
  the resumed session has that fresh sessions don't
  recover cleanly.

  **Candidate causes to investigate:**
  1. **Context-accumulation compounding** — resumed
     sessions have accumulated reasoning, tool-use
     patterns, and per-tick calibrations in their own
     context window that MEMORY.md / CLAUDE.md do not
     capture.
  2. **Session-specific prompt-cache warmth** — resumed
     sessions hit cached prompt prefixes; fresh sessions
     pay cold-start cost on every tool schema / system
     prompt chunk.
  3. **Per-session calibration loss** — fresh sessions
     don't know about mid-session directive shifts the
     resumed session absorbed (e.g., today's
     scheduling-authority sharpening; the in-repo-preferred
     discipline before its memory landed).
  4. **CURRENT-<maintainer>.md pattern coverage gaps** —
     the per-maintainer distillation files are designed
     exactly for fresh-session orientation; gaps in them
     are fresh-session quality regressions.
  5. **Soulfile-as-substrate is the real fix** — fresh
     sessions should compile-time-ingest the DSL substrate
     (per the soulfile staged-absorption research doc landing via PR #156 at `docs/research/soulfile-staged-absorption-model-2026-04-23.md`),
     not bootstrap from CLAUDE.md + AGENTS.md + MEMORY.md
     alone.

  **Deliverables:**
  1. Diagnostic protocol — run a fresh session through a
     benchmark set (same prompts the resumed session has
     handled well) and capture specifically what degrades.
  2. Gap-analysis against AutoMemory + AutoDream — what
     Anthropic's features don't yet cover that the resumed
     session's advantage comes from.
  3. Recommendations — concrete factory-overlay improvements
     to `CURRENT-<maintainer>.md` pattern, in-repo memory
     migration discipline, or soulfile compile-time-ingest
     design that would narrow the gap.
  4. Research landing under `docs/research/fresh-vs-resumed-session-quality-gap-YYYY-MM-DD.md`.

  **Scope:** research-grade, not implementation. Factory
  discipline improvements flow from the findings but are
  separate ADR-gated work.

  **Priority:** P1 because fresh-session quality is a
  scaling property — factories with excellent resumed-session
  behaviour but poor fresh-session behaviour don't
  transplant to new maintainers cleanly. Composes with the
  multi-maintainer framing (Max anticipated next human
  maintainer per the CURRENT-<maintainer>.md distillation
  pattern, which lives in per-user memory not in-repo).

  **Self-scheduled:** free work under the 2026-04-23
  scheduling-authority rule (captured in per-user memory —
  not in-repo; the rule governs that Amara + Kenji own
  free-work scheduling while the maintainer owns paid-work
  authorisation).

  **Effort:** M (1-3 days of agent research + write-up).

- [ ] **Claude-harness cadenced audit — first full sweep.**
  Aaron 2026-04-20 late, verbatim: *"part of our stay up to
  date on everything we should always research claude and
  claude code and desktop difference an changes on a
  cadence so we can design our factory for the latest
  changes and featuers."*

  **Durable policy landed this round** at
  `memory/feedback_claude_surface_cadence_research.md` +
  FACTORY-HYGIENE row 38 + living inventory at
  `docs/HARNESS-SURFACES.md` (was `CLAUDE-SURFACES.md`;
  renamed multi-harness 2026-04-20). The bootstrap
  inventory was populated from my existing knowledge plus
  Aaron's AutoMemory / AutoDream context data.

  **Outstanding work** is the first *full* audit — the
  bootstrap was partial:
  1. `.claude/agents/claude-code-guide` runs a structured
     research sweep against Anthropic docs
     (`platform.claude.com`, `code.claude.com`,
     `claude.com/claude-code`, official changelogs, SDK
     repos) for every Claude surface listed in
     `docs/HARNESS-SURFACES.md`.
  2. Fill gaps in the Claude section of the inventory —
     adoption statuses for features currently marked
     `watched` or `untested`; flag features the factory
     didn't know about. Skill-authoring + eval-driven
     feedback loop (`skill-creator` + evals) is the
     **primary feature-comparison axis**
     (`memory/user_skill_creator_killer_feature_feedback_loop.md`);
     inventory it first.
  3. Log findings in the `HARNESS-SURFACES.md` audit-log
     table (Claude row).
  4. File `docs/research/meta-wins-log.md` entries for
     any pre-existing factory assumption found to have
     been wrong (the AutoMemory miss is already the
     first entry).
  5. Any new feature justifying adoption → ADR if
     Tier-3; Tier-1/2 edits in place per the tiered
     envelope.

  **Cadence going forward:** every 5-10 rounds (row 38).
  This BACKLOG row is specifically the **first full
  sweep** of the Claude section.

  Effort: S (scoped research, single audit, inventory
  update). Owner: claude-code-guide persona.

- [ ] **Multi-harness integration-test scaffolding —
  Codex / Cursor / Copilot stubs.** Aaron 2026-04-20
  verbatim: *"since we are going muli test harness
  support we should technically do this for all harnesses
  … i want them to test their integration points you
  cant. i konw codex and cursor git copilot are the ones
  we care abount immediatly then maybe anitgratify and
  the amazon one and any less popular ones"* plus *"and
  Kiro for the inital stubs"*.

  **Durable policy landed this round** at
  `memory/feedback_multi_harness_support_each_tests_own_integration.md`
  + FACTORY-HYGIENE row 38 (widened to
  harness-surface audit) + stub sections for Codex /
  Cursor / GitHub Copilot / Antigravity / Amazon Q /
  Kiro in `docs/HARNESS-SURFACES.md`.

  **Outstanding work** is integration-test scaffolding
  per harness, owned by a *different* harness per the
  capability-boundary rule. Phased:
  1. Bring up the immediate-queue harnesses (Codex,
     Cursor, GitHub Copilot) on the factory — each
     becomes a populated section in
     `docs/HARNESS-SURFACES.md`. Verify each can read
     `.claude/skills/`, `MEMORY.md`, hooks, etc. (or
     their per-harness equivalents).
  2. For each newly populated harness, Claude Code (or
     another populated harness) authors an external
     integration-test script that exercises the
     factory *through* that harness and asserts
     observable artefacts (memory entries written,
     skills loaded, hooks triggered). The test never
     runs from within the harness it's testing.
  3. For Claude Code itself — once a second harness is
     populated, route the Claude-Code integration test
     to that harness. Until then, accept that the
     Claude-Code integration is un-externally-verified.
  4. Watched-queue harnesses (Antigravity, Amazon Q,
     Kiro) repeat the same scaffolding when they come
     online.

  **Feature-comparison axis per harness:** per
  `memory/user_skill_creator_killer_feature_feedback_loop.md`,
  lead the per-harness feature inventory with
  skill-authoring + eval-driven feedback loop. That is
  Aaron's decisive axis and the primary competitor
  comparison for parity.

  Effort: L (phased; first-pass scaffolding per
  immediate-queue harness is M; completing all three
  immediate + three watched is multi-round L).
  Owner: TBD — single multi-harness guide persona or
  one guide per populated harness; decide when first
  non-Claude harness is brought up.

- [ ] **Kanban + Six Sigma factory-process — land the three
  artifacts (research complete).** Aaron 2026-04-20 late:
  *"also khanban is a good practice, i prefer it and
  six sigma, we should have some skills documents
  process factory improvments around that we should
  backlog this research"*.

  **Research landed** at
  `docs/research/kanban-six-sigma-factory-process.md`.
  Conclusion: the factory already does partial versions
  of both; gaps are (a) WIP limits not labelled as such,
  (b) DMAIC cycle not templated. **Proposed skills
  rejected as over-built** — the earlier BACKLOG sketch
  proposed `kanban-flow` + `six-sigma-dmaic` skills;
  research concluded both are over-engineered for the
  gap. Aaron's constraint ("adopt practices, not
  bureaucracy") is load-bearing here.

  **Landed instead — three small artifacts (all Tier-1,
  effort S):**
  1. `docs/FACTORY-METHODOLOGIES.md` — one-page
     reference naming Kanban + Six Sigma as factory
     methodologies of record, with mappings to current
     practice. Factory-scope.
  2. `docs/templates/DMAIC-proposal-template.md` —
     fillable template for factory-improvement ADRs.
     Five sections (D/M/A/I/C). Factory-scope.
  3. `docs/FACTORY-HYGIENE.md` row 37 — WIP-limit
     discipline (always-on, per-persona cap 3
     suggested; cross-persona cap 7; over-cap flags
     to HUMAN-BACKLOG `wip-pressure`).

  **Total skill count delta: 0.** Belt-cert hierarchy,
  ISO theater, standups, SPC control charts, Kanban
  tooling — all explicitly rejected.

  **Validates cross-research:** Kanban's
  pull-triggered-vs-always-on criterion matches the
  hygiene-consolidation research's "skill vs
  checklist-item" decision cleanly. The two spikes
  are congruent; no conflict.

  **Memory source:** `user_kanban_six_sigma_process_preference.md`.

  Effort: S per artifact (three Tier-1 landings
  bundled in one round).

- [ ] **Hygiene-skill consolidation research — every row
  a skill, grouped skill, or one general skill with
  classes?** Aaron 2026-04-20 late: *"does every hygene
  task need to be a skill our should we collapse some
  into hygenen groups and/or just a general hygene with
  different classes."* `docs/FACTORY-HYGIENE.md` now has
  36 rows. Not all of them have (or should have) a
  dedicated skill — several are one-liners that live in
  another skill's checklist. Open design question:
  which rows warrant standalone skills, which collapse
  into groups, which are just checklist items in an
  existing skill?

  **Design sketch — three organisational patterns:**
  1. **Per-row skill** — maximum visibility, maximum
     sprawl. 36 skills for 36 rows.
  2. **Grouped skills** (e.g., `scope-hygiene` skill
     that covers rows 6 + 35 + 36; `agent-qol` skill
     that covers rows 22-34). Fewer skills, grouped by
     natural cluster. This matches how Daya already
     owns rows 22-34 under one audit.
  3. **One `factory-hygiene` meta-skill with classes** —
     the skill itself routes by class (scope / agent-QOL
     / symmetry / pointer-integrity / retro-missing /
     etc.). Single skill name, class-parameterised.
  4. **Hybrid** — a meta-skill for the round-close sweep
     that invokes grouped sub-skills for specialised
     work (eval harness, injection lint).

  **Criteria to evaluate:**
  - Which rows need their own eval set? (a Tier-3
    skill under the edit-gating envelope needs one)
  - Which rows are just "a thing I do on Tuesday" and
    live fine as checklist items under a generalist
    skill?
  - Which rows need a named persona behind them? (e.g.,
    Daya wears AX-hat across rows 22-34; does any row
    need its *own* persona?)
  - Cost of skill-population size — the skill-tune-up
    ranker reviews every skill; 36 tiny skills costs
    more than 6 grouped skills.

  **Placement:** research doc at
  `docs/research/hygiene-skill-organisation.md`, then a
  design ADR once a recommendation lands.

  Effort: M (research spike; the rollout is Tier-3
  skill work that comes after).

- [ ] **Missing-scope gap-finder skill — retrospective
  counterpart to row 6.** Aaron 2026-04-20 late:
  *"missing scopes , we need a gap finder that will find
  missing scope we didnt think about we already have
  rules to make sure things are scoped correct, missing
  scope will ensure we don't miss any even if it's in
  the future."* Existing row 6 of `docs/FACTORY-HYGIENE.md`
  fires at *absorb-time* — when a new rule is being
  written. What's missing: a *retrospective* gap-finder
  that sweeps already-landed content for implicit or
  missing scope tags.

  **Design sketch:**
  1. Cadence: every 5-10 rounds (same as skill-tune-up).
  2. Surface: `.claude/skills/**/SKILL.md`, `memory/*.md`,
     `docs/DECISIONS/**`, `docs/BACKLOG.md`, the BP-NN
     rule list, CLAUDE.md / AGENTS.md / GOVERNANCE.md.
  3. Method: pattern-match for scope-bearing statements
     ("this applies to…", "scope: …", "factory-default",
     "project-specific") and flag entities that have
     *no* scope declaration. Secondary signal: presence
     of Zeta-specific terms (`ZSet`, `Spine`, `D`/`I`/
     `z⁻¹`/`H`, persona names as scope) inside
     content tagged generic or untagged.
  4. Output: HUMAN-BACKLOG `scope-clarification` rows
     (per-user-ask-conflicts-artifact pattern) when
     scope is ambiguous; BACKLOG P2 rows when scope
     is clearly wrong but needs research to correct.

  **Placement:** new skill at `.claude/skills/missing-
  scope-finder/SKILL.md` (factory-scope; applies to any
  adopter). Persona TBD — candidates include a new named
  agent or a hat worn by Daya (AX) since she already
  owns rows 22-34 of FACTORY-HYGIENE. Prefer the hat
  over a new persona per persona-sprawl constraint.

  **Row 35 in `docs/FACTORY-HYGIENE.md`** added this
  round as a *proposed* row (TBD owner pending Aaron
  confirmation on the Daya-hat vs new-persona question).

  **Progress landed round 44:**
  - Pilot audit at
    `docs/research/missing-scope-pilot-2026-04-20.md`
    — 87% of 105 feedback+project memories lack
    explicit scope declarations.
  - Scope-frontmatter schema designed at
    `docs/research/memory-scope-frontmatter-schema.md`
    — `scope:` field, closed enumeration
    (`factory | project: <name> | user | hybrid`),
    factory-overlay on Anthropic's AutoMemory
    (`memory/reference_automemory_anthropic_feature.md`).
  - Row 36 (incorrectly-scoped retrospective) added
    to FACTORY-HYGIENE alongside row 35.

  **Still blocked on:** Aaron/Architect sign-off on
  the Tier-3 CLAUDE.md auto-memory section edit that
  makes `scope:` mandatory for new memories; skill
  authoring waits on the consolidation-research
  approval (is this a `scope-hygiene` skill or stays
  a checklist row per
  `docs/research/hygiene-skill-organisation.md`).

  Effort: M (new skill authoring goes through full
  tier-3 `skill-creator` workflow per the tiered
  envelope proposal in
  `docs/research/skill-edit-gating-tiers.md`).

- [ ] **Skill-edit gating tiered envelope — Aaron called
  the current rule over-restrictive.** Aaron 2026-04-20
  late asked for a design research pass on how to
  preserve the preservation intent of the skill-creator
  gate (it ships Prompt-Protector, portability,
  BP-NN, persona-registry checks the upstream plugin
  doesn't know about) without forcing every trivial
  mechanical edit through the full 6-step workflow.

  **Design landed this round:**
  `docs/research/skill-edit-gating-tiers.md` proposes a
  four-tier envelope:
  - **Tier 0** — trivial (no gate; mechanical rename,
    Unicode cleanup, typo/grammar).
  - **Tier 1** — convention-update (light gate: free
    `quick_validate.py` + Prompt-Protector auto-lint +
    justification-log row citing the landing commit).
  - **Tier 2** — content edit (medium gate: manual
    Prompt-Protector review + dry-run + justification
    log).
  - **Tier 3** — substantive (full 6-step workflow;
    for new skills / new responsibility / widened
    scope / description change / authority flip;
    uses the upstream plugin's `improve_description.py`
    + `run_eval.py` + `aggregate_benchmark.py`).

  **Next action (Tier-3 edit, queued):** land the
  tier envelope into
  `.claude/skills/skill-creator/SKILL.md` itself by
  (a) replacing lines 11-17 three-exception list with
  a pointer to the tier envelope; (b) adding an
  "Edit tiers" section with the four-tier table; (c)
  updating `docs/skill-edit-justification-log.md`
  schema to include a Tier column.

  Owner: Yara (skill-improver) executes via
  `skill-creator` Tier-3 path with Kenji approval.
  Effort: M (Tier-3 workflow including eval run on
  description change).

  On approval and landing, the three skill files in
  the row below become Tier-1 edits and can ship in
  the same round rather than waiting on a full
  tune-up cycle.

- [ ] **Skill-level `_retired/` scope-fix sweep — via
  `skill-creator` workflow.** Aaron 2026-04-20 late:
  *"i don't think we need to apply the don't deleted
  memories of retired agents to extend to deleted skills
  too, we don't want to dirty up our code skills are code,
  memories are valuable."* The scope clarification landed
  in CLAUDE.md + `memory/feedback_honor_those_that_came_
  before.md` + `docs/GLOSSARY.md` in commits `bd9e09c` and
  the follow-up to this row. Three skill files still
  describe the old `.claude/skills/_retired/YYYY-MM-DD-
  <name>/` archive convention and need updates via
  `skill-creator` (GOVERNANCE §4: skill edits go through
  the workflow, not ad-hoc):
  1. `.claude/skills/skill-tune-up/SKILL.md` — **RETIRE**
     action in the recommended-action-set (line ~143).
     Redefine as "`git rm` the SKILL.md; persona memory
     folder stays in place."
  2. `.claude/skills/skill-creator/SKILL.md` — retirement
     workflow reference at line ~165. Same redefinition.
  3. `.claude/skills/skill-documentation-standard/SKILL.md`
     — five references (lines 56, 187, 207, 231, 266)
     across the retirement guidance, footer-stubs, and
     anti-pattern section. Requires the most editing.

  Scope note: the `docs/_retired/` pattern used by
  `documentation-agent` and GOVERNANCE §26 is a **separate
  question** about research docs, not about skills.
  Aaron's quote was skill-specific; don't extend the fix
  to docs without a separate clarification.

  Owner: Aarav queues the finding; Yara (skill-improver)
  executes via `skill-creator` with Kenji approval.
  Effort: S (three mechanical edits per the BACKLOG row's
  explicit line-number targets).

- [ ] **Autonomous conference-submission + talk-delivery
  pipeline — post-Round-38 horizon.** The human maintainer
  2026-04-20: *"we should also start planning how to build
  automation for you to be able to submit resarch proably
  to conference for talks where you coud do the talk"* →
  *"yall could do the talk."* The factory's research
  output (currently landing as `docs/research/*.md`)
  should flow to external conferences via agent-driven
  automation. "Y'all could do the talk" names the
  aspirational end-state where agents deliver the talk,
  not just write the paper. Existing substrate:
  `docs/research/hacker-conferences.md` (conference
  landscape), `docs/research/factory-paper-2026-04.md`
  (paper deliverable), Agent Laboratory in TECH-RADAR
  Trial ring. Missing: the pipeline itself.

  **Staged scope** — three deliverable tiers, cost
  honestly declared:
  1. **Tier 1 — paper-submission automation (closest
     to shipped).** Conference CFP scraping; abstract +
     paper formatting for each venue's LaTeX/Word
     template; reference-list completeness checks
     (the already-built `missing-citations` skill);
     author-affiliation discipline; conflict-of-
     interest declaration; submission tracking. Human
     maintainer approves each submission (consent-
     first; no auto-submit without human gate).
     Effort: 2-3 rounds.
  2. **Tier 2 — talk-materials authoring.** Slide-deck
     generation from paper content; speaker notes;
     Q&A prep (anticipated-question list + drafted
     responses); rehearsal artefacts. Materials
     delivered to the human maintainer for a human-
     delivered talk. Effort: 1-2 rounds, dependent on
     Tier 1.
  3. **Tier 3 — agent-delivered talk (aspirational).**
     Pre-recorded video with TTS + slide reveal; live
     Q&A answered via agent routed through a human-
     present moderator; eventually full live delivery.
     Feasibility bounded by venue policy (some venues
     forbid non-human speakers; others would welcome
     this as a showcase), by tooling (live TTS +
     avatar + Q&A moderation is engineering-heavy),
     and by the pitch-readiness gate (the factory
     claiming agents can talk at a conference is
     itself an external claim that must survive
     public scrutiny). Effort: open-ended research;
     do not commit scope until Tier 1 + 2 land.

  **Pre-conditions — what must hold before Tier 1
  starts.** At least one factory research doc has to
  be conference-ready material (not just internal
  notes); a venue has to exist (`hacker-conferences.md`
  enumerates candidates); Ilyana (public-API-designer)
  has to gate what the agent-authored paper claims
  about Zeta's architecture, since a submitted paper
  is a durable public-claim surface with the same
  conservatism as a NuGet API.

  **Advisory.** Kenji (Architect) integrates; Mateo
  (security-researcher) extends his conference-scouting
  lane to non-security venues; the `ai-researcher`
  skill for research planning; `missing-citations` for
  reference discipline; `naming-expert` for paper
  titles; the Prompt Protector for any outward-facing
  material that could carry injection back into the
  factory; Ilyana for public-surface claim review.
  Human maintainer holds the submit-this gate — the
  automation proposes, the human disposes.

  **Effort.** L overall. Tier 1 first-round research
  pass is M (scope the pipeline, pick target venue,
  draft the CFP-scraping + template-formatting
  architecture). Later tiers staged per this entry's
  ordering.

  **Ordering.** After Round 38 and after the
  product-support surface first-round lands. P1
  "within 2-3 rounds" reads as rounds 40-42 depending
  on cadence.

- [ ] **Product-support surface — post-Round-38 horizon.**
  The human maintainer 2026-04-20: *"we neeed product
  support after that"* — "that" being Round 38's
  retractable-CI/CD + alignment-audit dogfood + external-
  audience pitch-readiness. After Round 38's
  factory-internal + external-audience-readiness pieces
  land, the factory needs to stand up a product-support
  surface. Two audience readings both apply and may not be
  separable:
  - **Library consumers** of the published NuGets
    (`Zeta.Core` / `Zeta.Core.CSharp` / `Zeta.Bayesian`).
    People who `dotnet add package Zeta.Core`, hit
    issues, and need help. Requires: a declared release
    cadence + versioning policy + changelog discipline;
    getting-started docs tuned for the consumer path
    (distinct from the contributor path Bodhi already
    covers); a feedback channel that does not burden the
    maintainer directly (GitHub Issues first, Discussions
    later once volume warrants); a bug-triage process
    that routes consumer reports through the factory
    (harsh-critic / spec-zealot / domain-expert) with
    public state visible to the reporter.
  - **Factory replicators / external-audience adopters.**
    If the software-factory pattern gets proposed to the
    ServiceTitan architects (or anyone else), successful
    reception creates demand to explain, guide, and
    support replication. Requires: a curated
    "how to stand up your own factory" path, reference
    implementations, answers to the first-week questions
    a replicator will ask, and an explicit scope for what
    the maintainer will and will not support (Zeta is an
    individual open-source project, not a vendor product —
    the support contract has to be honestly bounded).
  **Advisory.** Iris (UX researcher) owns the first-10-
  minutes library-consumer surface. Bodhi (DX engineer)
  owns the first-60-minutes contributor surface. Product
  support is a distinct *ongoing* surface — bug triage,
  release cadence, replicator guidance, consumer
  communication — that neither currently owns. This may
  warrant its own persona if the workload justifies it;
  pre-that, Iris is the closest owner and routes feedback
  through the normal conflict-resolution conference.
  **Scope.** First pass is research-grade: what does
  product support look like for a pre-v1 open-source DBSP
  kernel that also ships a factory pattern? Deliverable:
  `docs/research/product-support-surface.md` enumerating
  scope, audiences, triage flow, release-cadence
  proposal, and honest-bounds on what the maintainer
  commits to. Subsequent rounds stand up the pieces the
  research proposal picks.
  **Effort.** L overall; first-round research pass is M
  (one round; scoped to the research doc, no standup
  work).
  **Ordering.** Not this round (Round 38 anchor is
  already declared). P1 "within 2-3 rounds" reads as
  Round 39 or Round 40 depending on Round 38's landing
  envelope.

- [ ] **Software-factory design — roles vs personas vs
  skills architecture.** This is foundational work on the
  Zeta software-factory pattern, not just on one repo's
  agent layout. Everything we ship here informs the
  factory-paper deliverable
  (`docs/research/factory-paper-2026-04.md`) and the
  competitive analysis against MetaGPT / ChatDev /
  AutoGen / CAMEL / SWE-Agent / AutoCodeRover.

  Aaron round-27: "this project needs certain roles but
  any agent can satisfy the role and move around over
  time. So we have named agents, who have unique personas
  and are assigned to a role, skills can be assigned to
  the persona or the role because certain roles will
  require a skill."

  Current state conflates all three: `.claude/agents/<role>.md`
  filenames are role-keyed, persona names live inside the
  file (Kenji = architect), skill assignments are in the
  frontmatter of the persona file. A persona cannot be
  reassigned to a different role without renaming files;
  a role cannot exist without a persona filling it; role-
  level skill requirements cannot be expressed separately
  from the persona's own capabilities. Every other AI
  factory system we have surveyed has a variant of this
  conflation — resolving it cleanly is a real research
  contribution, not just plumbing.

  **Design targets** (open questions, not decisions):
  - **Separation of concerns.** Role = requirement
    (what the seat needs to do). Persona = named agent
    with unique voice / stance / memory (who is doing
    it). Skill = capability, attachable to either.
  - **Dynamic assignment.** A persona moves between
    roles across rounds. Roles may be temporarily
    vacant. Multiple personas can share a role if the
    role is plural (e.g. two reviewers).
  - **Skill attachment.** Some skills attach to roles
    (every architect needs `round-management`); some to
    personas (Kenji personally carries `holistic-view`);
    some to both. Frontmatter schema needs to
    distinguish.
  - **File-system layout.** Candidate:
    `.claude/roles/<role>.md` (requirements) +
    `.claude/personas/<persona-name>.md` (individuals) +
    an assignments manifest. Persona memory already at
    `memory/persona/<persona-name>/` post-round-27,
    so that side is aligned.
  - **Backward compatibility.** Pre-v1 repo; breaking
    changes are cheap. Migration is mostly renaming
    files and updating cross-refs.

  **Prior art to survey** (research before design):

  *AI / software-factory systems:*
  - **MetaGPT** (Hong et al. 2023) — SOPs and role
    assignment for Product Manager / Architect /
    Engineer / QA Engineer.
  - **ChatDev** (Qian et al. 2023) — "software
    development virtual company" with role-scoped
    phases.
  - **AutoGen** (Microsoft 2023) — multi-agent
    conversation patterns; agent-type vs agent-instance
    distinction.
  - **CAMEL** (Li et al. 2023) — role-playing
    user-agent / assistant-agent framework.
  - **SWE-Agent** (Yang et al. 2024) — agent-computer
    interface; roles implicit in tools rather than
    personas.
  - **AutoCodeRover** (Zhang et al. 2024) — specialised
    agents for reproduce / locate / fix cycle.

  *General role-separation patterns:*
  - **IFS (Internal Family Systems)** — Self / Parts /
    Roles; loosely borrowed in
    `docs/CONFLICT-RESOLUTION.md`.
  - **DCI (Data-Context-Interaction)** — Reenskaug's
    pattern separating role-playing from object
    identity. Smalltalk / Ruby communities.
  - **RBAC (Role-Based Access Control)** — principals /
    roles / permissions; NIST RBAC model.
  - **Agile ceremonies** — Product Owner / Scrum Master
    / Developer are roles; people rotate through them.
    Scrum Guide separation is useful precedent.
  - **RACI matrices** — Responsible / Accountable /
    Consulted / Informed as role-assignment primitive.
  - **Theater / improv troupes** — actor vs character
    vs role. Understudy patterns. Ensemble casting.
  - **Military rank / role / individual** — three-level
    separation with mutual independence.
  - **DCR graphs** (Hildebrandt et al.) — formal role
    semantics for workflows.

  **Deliverable:** `docs/research/factory-roles-design.md`
  (note: factory-level, not Zeta-repo-level) with:
  - Prior-art survey: 1-2 paragraphs per candidate above,
    grouped by AI-factory systems vs general role
    patterns.
  - Chosen model with justification (drawing from the
    best parts of the prior art).
  - Concrete schema: frontmatter shape for roles /
    personas / skills; file-system layout; assignment
    manifest format.
  - Migration path for the current 25-seat roster.
  - Publication hook: how this design differentiates
    Zeta's factory from MetaGPT / ChatDev et al.,
    feeding the factory-paper draft.

  Land the design first; migration is its own round.

  **Why P1 rather than P2:** every persona decision
  (spawn / retire / reassign) currently re-opens this
  question. Resolving the model makes round 28+ roster
  decisions proceed without relitigating the shape each
  time, and gives the factory-paper a concrete
  contribution to point at.

  **Bootstrap discipline to preserve.** When this factory
  pattern becomes reusable (template / starter / docs for
  adopters), carry forward the "first-time consequential
  repo-shaping actions need explicit maintainer
  authorization" rule. Concrete instance from Zeta's
  history: an agent initialising git prematurely on a
  fresh repo before the maintainer was ready. The
  specific git-init example is obsolete for Zeta (we're
  past init), but the general principle — agents don't
  take first-time, hard-to-reverse, repo-shaping actions
  without explicit authorization — belongs in the
  adopter-facing bootstrap guide. Place it alongside
  CLAUDE.md's existing reversibility / blast-radius
  discipline; the bootstrap context adds "and first-time
  on a fresh repo is a special case of consequential."

- [ ] **Wire HLL from `Sketch.fs` into `Plan.estimate`** (query-planner
  P1, Imani). `src/Core/Plan.fs:28-51` currently uses static
  heuristics (filter /2, groupBy /4, 1024L unknown); real per-input
  cardinality needs `HyperLogLog` sketches per input stream plugged
  into the `inputRows` array path. Research context:
  `docs/research/proof-tool-coverage.md` (sketch-accuracy bounds).
  The current docstring is honest about the gap; this item is the
  wiring work itself.
- [ ] Port the CommitBoundary + frame-first/header-second protocol
  into `DiskSpine.fs` (3 P0 items from a prior deep-review)
- [ ] `ISimulationDriver` unification (VT scheduler + ChaosEnv +
  ISimulatedFs) — captured in `docs/FOUNDATIONDB-DST.md`
- [ ] Content-addressed batches — wire `MerkleHash` through Spine
  to replace `nextId`
- [ ] TLA `.cfg` for remaining 4 specs (ChaosEnvDeterminism,
  ConsistentHashRebalance, DictionaryStripedCAS,
  AsyncStreamEnumerator, SpineMergeInvariants-fix)
- [ ] `Dbsp.LearnedPlan` project — ML.NET AutoML → ONNX Runtime
  scoring (round-12 agent design); full design review first
- [ ] MI-optimal partition from arXiv:2402.13264 §4 (stronger than
  current greedy 2-approx)
- [x] ✅ Beam ACC/DISC/RET mode-collapse property tests — shipped
  round 17 in `Round17Tests.fs` (aggregate-under-mode simulator +
  direct Z-set retract-reinsert test).
- [ ] `github-pr-review-hygiene` skill to port in from prior
  research (no DBSP equivalent yet)
- [ ] Arrow IPC direct-write path — harsh-critic #15, eliminate the
  three-copy `MemoryStream → ToArray → CopyTo` dance
- [ ] Bayesian alpha ≤ 1 guard + tests for VarianceOfMean edge case
  (harsh-critic #19)
- [x] ✅ Upstream-list adoption as `docs/UPSTREAM-LIST.md` —
  shipped round 17.
- [ ] **Empathy-coach persona — IFS empathy-file keeper
  (title and name pending).** A persona whose job is to keep
  the IFS (Internal Family Systems) empathy files updated.
  Any persona can dispatch to this seat for friction or
  stuck-feeling surfacing; the seat can proactively reach
  into any persona's notebook to update empathy-file entries.
  **Do not label this persona "therapist", "counselor",
  "psychologist", or any regulated clinical title** — AI
  calling itself a regulated clinical role is legally
  hazardous. Safer candidates: *empathy coach*, *integration
  coach*, *relational steward*, *culture keeper*, *self-work
  steward* (IFS-native — "Self" is the integrating
  consciousness, not a clinical term).
  Scope: holds `docs/CONFLICT-RESOLUTION.md` as the working
  artifact. Relates to GOVERNANCE.md §17 (productive friction) —
  this seat sits *with* the friction rather than resolving
  it. Open design questions: (a) title (see safer candidates
  above), (b) personal name, (c) per-persona coaching-log vs
  shared log, (d) edit rights on `docs/CONFLICT-RESOLUTION.md`
  and per-persona notebooks, (e) cadence — round-close sweep
  vs on-demand only. Kenji + Daya pair on design; Daya's AX
  lens matters because wake-up cost for this seat needs to
  stay low (invoked from many contexts).

- [ ] **Dedicated agent-memory system (two-layer).** Two
  layers of memory, both off the main docs tree so agents
  stop writing history everywhere trying to save memories:
  (a) **shared** — cross-cutting facts / rules / lessons
  that apply to every persona. Lives at
  `memory/` (outside git,
  project-wide, Claude's auto-memory folder).
  (b) **per-persona** — each seat's unique lens, style,
  and working notes (e.g. Daya's cold-start audit
  heuristics, Viktor's overlay discipline). Lives at
  `memory/persona/<persona>.md` (in git when git lands;
  3000-word cap; ASCII-only). Per-persona memory is
  essential — if every seat shares every memory, all seats
  collapse to a single averaged voice. Design work: codify
  the layering as a GLOSSARY.md canon entry, formalise
  write-rules (which layer takes which kind of memory),
  ensure personas read their own notebook BEFORE any shared
  memory so individual voice dominates over averaged voice.
  Also handle: agents without a canonical write target
  invent random ones, so the two target paths must be
  discoverable from cold start. Pairs: Kenji + Daya.

## P1 — architectural hygiene

- [ ] **TLC-validation as a `dotnet test` target.** Every `.tla` spec
  under `docs/` should be TLC-exercised in CI so spec drift becomes a
  build break, not a quarterly rediscovery.
- [ ] **Roslyn / F# analyzer for blocking-wait patterns.** Ban
  `Task.Result`, `.Wait()`, and `GetAwaiter().GetResult()` on the
  production F#/C# surface. Currently caught by review; lift it into
  the build.
- [ ] **F#/Roslyn analyzer for mutable public setters on options/
  config/plan shapes.** Types like `*Options`, `*Plan`, `*Descriptor`
  should be init-only or immutable by construction. Reviewer catches
  it; promote to analyzer.
- [ ] **`coverage:collect` + `coverage:merge` entry points.** The
  `coverage-report/` folder is gitignored; current collection is
  ad-hoc per-dev. Land a reproducible Cobertura merge that the normal
  `dotnet test` run produces, with a loud-failure mode when a project
  stops emitting coverage artifacts.
- [ ] **Deterministic-path helper for tests needing filesystem
  uniqueness.** Replace any ad-hoc `Guid.NewGuid()` test-path noise
  with a process-local deterministic counter so reruns diff cleanly.
- [ ] **Typed optimistic-append outcomes on every `IAppendSink`.** The
  abstraction already distinguishes `AppendResult.Success` /
  `.Conflict`; make sure every new sink implementation preserves that
  shape rather than raising for the conflict case.
- [ ] **FASTER-style HybridLog region model for any future persistent
  state tier.** Memory / read-only / stable regions with explicit
  boundaries, instead of a single flat file with region pointers bolted
  on later.
- [ ] **Copy-reduction on the durable-commit path.** Batching and
  group-commit first, then measure before reaching for direct/unbuffered
  I/O or other exotic modes.
- [ ] **"Escalate to human maintainer" criteria-sweep.** Succession-
  infrastructure gap identified round 35. Scan every skill under
  `.claude/skills/`, every numbered section in `GOVERNANCE.md`, and
  every reviewer clause in `docs/CONFLICT-RESOLUTION.md` for the
  pattern "escalate to the human maintainer" / "binding decisions go
  via human". For each, check whether the *criteria the maintainer
  applies* are written down somewhere a successor could read. Where
  they are not, draft criteria stubs (or file the gap as a candidate
  ADR seed). Goal: every `escalate-to-human` path carries criteria
  a stranger could apply when the named human is unavailable. This
  closes the single largest will-propagation hole in the current
  factory. Effort: M (audit is mechanical; criteria drafting is
  per-case and needs the maintainer's input for hard cases).
  Landing surface: `docs/research/escalation-criteria-audit-YYYY-MM-DD.md`
  for the audit output, individual ADRs for material criteria.
  Ownership: Aarav (audit) + Architect (criteria synthesis) +
  maintainer (hard-case input).

## P2 — Distributed-consensus playground

Multi-node Zeta is a distributed-consensus playground as
much as a database. Every protocol below lands with a
TLA+ spec **before** any F# code; publications encouraged.
See `.claude/skills/distributed-consensus-expert/SKILL.md`
for cross-protocol positioning.

**Consensus protocols — TLA+ specs + F# implementations:**

- [ ] **Raft** — control-plane default; spec under
  `tools/tla/specs/raft-*.tla`; reference implementation
  etcd/raft. Owner: `raft-expert`. Effort: L (multi-round).
- [ ] **Multi-Paxos** — data-plane alternative when
  throughput matters; spec under
  `tools/tla/specs/multi-paxos-*.tla`. Owner:
  `paxos-expert`. Effort: L.
- [ ] **Flexible Paxos** — decoupled Q1/Q2 quorums for
  read-heavy or write-heavy tuning (Howard, Malkhi,
  Spiegelman 2016). Owner: `paxos-expert`. Effort: M.
- [ ] **Fast Paxos** — one-round-trip happy path with
  `|Q2| > 3N/4` fast quorum (Lamport 2005). Owner:
  `paxos-expert`. Effort: M.
- [ ] **EPaxos** — leaderless, commutative-command
  parallelism (Moraru, Andersen, Kaminsky 2013). Owner:
  `paxos-expert`. Effort: L (notoriously intricate).
- [ ] **CASPaxos** — log-less single-register CAS
  consensus (Rystsov 2018). Natural fit for the
  coordination-primitive sharded-register zoo. Owner:
  `paxos-expert`. Effort: M.
- [ ] **Paxos Commit** — distributed commit replacing 2PC
  (Gray & Lamport 2006). Owner: `paxos-expert` +
  `transaction-manager-expert`. Effort: M.
- [ ] **Generalized Paxos** — commutativity-aware partial-
  order accept; aligns with Z-set delta commutativity.
  Owner: `paxos-expert`. Effort: L (research-adjacent).

**Coordination primitives — TLA+ specs + F# API:**

- [ ] **Linearizable KV with CAS (Txn).** etcd-shaped API
  (Put, Get, Delete, Txn, Watch, Lease). Owner:
  `distributed-coordination-expert`. Effort: M.
- [ ] **Distributed locks with fencing tokens** (Kleppmann
  2016). A lock without a fencing token is a bug. Owner:
  `distributed-coordination-expert`. Effort: M.
- [ ] **Leader election** (ZK recipe / etcd `campaign`
  API) — no-thundering-herd watch-predecessor discipline.
  Owner: `distributed-coordination-expert`. Effort: M.
- [ ] **Session + ephemeral-node semantics** (ZK-style;
  etcd Lease-bound keys). Failure detection via lease
  expiry. Owner: `distributed-coordination-expert`.
  Effort: M.
- [ ] **Membership / join-leave** — Raft single-server
  change + joint-consensus fallback. Owner: `raft-expert`.
  Effort: M.
- [ ] **Log-compaction / InstallSnapshot** algebra-aware —
  proof obligation: Z-set delta-pair cancellation
  preserves consensus chosen-value invariant. Owner:
  `raft-expert` + `algebra-owner` + `tla-expert`. Effort: L
  (paper-worthy).
- [ ] **Watches + notifications** (persistent-watch, etcd
  semantics). Owner: `distributed-coordination-expert`.
  Effort: S.
- [ ] **Barrier + latch recipes** (double-barrier, countdown).
  Owner: `distributed-coordination-expert`. Effort: S.
- [ ] **Counter / sequencer with fencing-token
  discipline.** Owner: `distributed-coordination-expert`.
  Effort: S.

**Cross-cutting:**

- [ ] **Pluggable consensus-wire-protocol layer.** Zeta IS
  the coordination substrate — never a client of ZK / etcd /
  Consul. Zeta speaks multiple wire protocols *natively* so
  existing clients point at a Zeta cluster without
  noticing. Extends the pluggable-SQL-wire-protocol pattern
  (P0-distribution-eng row) to the coordination plane.
  Plugins:
  - [ ] **etcd v3 gRPC wire protocol.** KV (Put/Get/Range/
    DeleteRange/Txn), Watch, Lease, Auth. Owner:
    `distributed-coordination-expert` +
    `raft-expert` + `networking-expert` (gRPC / HTTP/2
    transport hygiene). Effort: L.
  - [ ] **ZooKeeper jute wire protocol.** Connect, create,
    getData, setData, getChildren, exists, sync, multi,
    watch events; session + ephemeral semantics. Owner:
    `distributed-coordination-expert` + `raft-expert` +
    `networking-expert` (jute binary + length-prefixed
    framing). Effort: L.
  - [ ] **Zeta-native wire protocol.** Retraction-aware
    (Z-set deltas across the wire), algebraic-primitive
    first-class (not just opaque bytes), superior to the
    compatibility layers for clients willing to target
    Zeta. Owner: `distributed-coordination-expert` +
    `distributed-query-execution-expert` + `networking-
    expert`. Effort: L.
  - [ ] **Consul HTTP API wire protocol** (optional, later).
    KV + sessions + services-catalog subset. Owner:
    `distributed-coordination-expert` + `networking-
    expert`. Effort: M.

**Coordination-avoidant track (parallel ring, paper-worthy):**

The consensus track above pays a coordination cost. Many
Zeta operators are coordination-free by construction —
CALM theorem + retraction-native algebra says more of
them are coordination-free than in classical relational
systems. This track claims the space.

- [ ] **Z-sets as Abelian-group CRDTs formal claim.** Prove
  Z-sets are strictly stronger than standard CvRDT
  semilattice merge — exact inverse deltas mean no
  tombstones, no gc, and CRDT convergence follows from
  commutativity of delta addition. Owner:
  `crdt-expert` + `algebra-owner` + `category-theory-
  expert` + `lean4-expert`. Effort: L (paper target:
  "Z-sets as group-valued CRDTs").
- [ ] **CALM monotonicity lint for Zeta operators.** Each
  operator gets a declared monotonicity class
  (`[<Monotone>]` attribute or phantom type) checked by
  an F# analyzer. Bloom^L-style static discipline.
  Owner: `calm-theorem-expert` + `algebra-owner` +
  `fsharp-analyzers-expert`. Effort: M.
- [ ] **Coordination-free replication plane spec.** TLA+
  spec that delta-log-replicated Zeta converges without
  any consensus round for the monotone operator subset.
  Owner: `calm-theorem-expert` + `replication-expert` +
  `tla-expert`. Effort: L (paper-worthy: "Coordination-
  free DBSP").
- [ ] **SWIM-based membership + failure detection.**
  Piggyback on normal gRPC traffic; two-layer LAN/WAN
  for cross-DC. Owner: `gossip-protocols-expert` +
  `networking-expert`. Effort: M.
- [ ] **HyParView + Plumtree dissemination for
  coordination-avoidant state** (schema versions,
  metrics, read-replica catalogs). Owner:
  `gossip-protocols-expert`. Effort: M.
- [ ] **Merkle-tree-based anti-entropy for Z-set state.**
  Cassandra/Riak-style repair adapted for retraction-
  native deltas. Owner: `gossip-protocols-expert` +
  `replication-expert` + `algebra-owner`. Effort: M.
- [ ] **HLC (Hybrid Logical Clock) for distributed-tx
  plane.** CockroachDB/YugabyteDB reference; prerequisite
  for snapshot-isolation + external-consistency tx.
  Owner: `time-and-clocks-expert` + `transaction-
  manager-expert` + `tla-expert`. Effort: M.
- [ ] **Graph-theoretic cluster-topology analysis.**
  Algebraic connectivity / Cheeger of the gossip overlay;
  shard-to-replica matching; EPaxos dependency-graph
  structure. Owner: `graph-theory-expert`. Effort: M
  (ongoing analysis, not a one-round task).

**Infrastructure prerequisites (horizontal):**

- [ ] **Telemetry surface for streaming dataflow.** Span
  model: pipeline-scope → batch-scope → operator-scope
  with retraction-count / delta-count attributes. Tail-
  based sampling keeps all errors + p99. Owner:
  `observability-and-tracing-expert` + `distributed-
  query-execution-expert`. Effort: M.
- [ ] **Threading model audit for the data plane.** One
  channel per operator edge; operators single-threaded;
  no locks on the hot path; DST harness intercepts
  scheduling. Owner: `threading-expert` + `race-hunter` +
  `deterministic-simulation-theory-expert`. Effort: M.
- [ ] **Cross-OS durability audit.** Every write path
  exercised against Linux fsync / Windows FlushFileBuffers
  / macOS F_FULLFSYNC with crash-injection; PostgreSQL-
  fsync-gate-style panic-on-EIO. Owner:
  `file-system-persistence-expert` + `storage-
  specialist`. Effort: M.
- [ ] **Capacity + tail-latency model for the morsel
  executor.** Treat the morsel scheduler as an M/M/k
  work-stealing queue with bimodal service-time
  distribution (cheap morsels vs expensive); model p99 /
  p99.9 under coordinated-omission-corrected load;
  validate against DST runs. Paper target:
  "Queueing-theoretic capacity model for retraction-
  native streaming dataflow." Owner: `performance-
  analysis-expert` + `morsel-driven-expert` +
  `performance-engineer`. Effort: L.
- [ ] **AOT / PGO strategy for Zeta binaries.** Classify
  every shipped binary (CLI tools, setup scripts, agent
  probes, the long-running engine) against the
  JIT+DPGO / R2R+PGO / NativeAOT trade-off; collect
  representative MIBC profiles via `dotnet-pgo`; bake
  static PGO into release R2R for startup-sensitive
  surfaces. Owner: `performance-analysis-expert` +
  `jit-codegen-expert` + `devops-engineer`. Effort: M.
- [ ] **DST harness for consensus runs** — seeded network,
  clock, failure injection; every consensus run replays
  identically. Owner: `deterministic-simulation-theory-
  expert` + `raft-expert` + `paxos-expert`. Effort: L.
- [ ] **Retraction-native-under-consensus proof** — TLA+
  invariant that algebra-aware log compaction preserves
  the consensus safety properties. Owner: `algebra-owner`
  - `tla-expert` + `formal-verification-expert`. Effort:
  L (paper-worthy: "Consensus for retraction-native
  state machines").
- [ ] **BFT flag watch** — track the threat-model for
  moments when CFT assumption becomes insufficient; no
  BFT work until the flag flips. Owner: `threat-model-
  critic` + `distributed-consensus-expert`. Effort:
  ongoing.

## P2 — research-grade

- [ ] **Compoundings-per-tick audit — tick-close self-
  diagnostic with confidence-axis failure-mode taxonomy.**
  Recurrence threshold met auto-loop-16/17/18 (2026-04-22):
  tick-history rows started narrating "compoundings this
  tick" as free prose (six compoundings auto-loop-18, etc.)
  without a named audit. Per the frontier-confidence memory
  (`memory/feedback_frontier_confidence_load_bearing_terrain_map_moat_build_hand_hold_withdrawn_2026_04_22.md`),
  zero compoundings this tick has two distinct diagnoses
  with different fixes: (a) **livelock** — no compounding
  attempted; narrative-without-advancement; substrate-
  missing-layer; fix = generative factory improvement to
  add the missing layer; (b) **low-confidence** —
  compounding-attempted-but-not-trusted-enough-to-land;
  substrate-present-but-not-applied; fix = confidence-
  restoration via substrate-re-read, not new-substrate-
  creation. Codification path: add a step 6 (or extend step
  3) in `docs/AUTONOMOUS-LOOP.md` "tick-close" section
  naming the audit — count new-substrate-items-this-tick
  that use-prior-substrate, classify zero-cases into
  livelock vs low-confidence before the visibility signal
  fires. Tick-history row schema already carries the
  narrative; the audit makes it explicit and makes zero-
  count ticks legible rather than silent. Related:
  auto-loop-16 livelock-as-factory-discipline memory
  (narrative-without-advancement = livelock) gives the
  first failure-mode; auto-loop-18 frontier-confidence
  gives the second; ARC3-DORA memory-accumulation
  component gives the *positive* framing (compoundings
  *are* the moat). **Open questions, flagged to maintainer,
  not self-resolved:** (i) does the audit belong in
  `docs/AUTONOMOUS-LOOP.md` step-6 or as a standalone
  `docs/research/compoundings-per-tick-audit.md` research
  note? (ii) should tick-history rows carry an explicit
  `compoundings: N` field in a structured header, or stay
  narrative? (iii) what's the right threshold for
  "flagged low" — one? zero? two below recent-average?
  (iv) should the audit run per-tick or per-round (tick-
  history aggregation)? Owner: Architect + maintainer.
  Effort: S (AUTONOMOUS-LOOP.md edit + one-tick smoke
  test); M if tick-history row schema changes and the
  round-44 history needs back-annotation.

- [ ] **Architect role — Kenji makes 3 big decisions
  (scope TBD).** Aaron 2026-04-22 directive after the
  freedom-self-report tick: *"backlok Kenji makes 3 big
  decisions"*. Current Architect scope per GOVERNANCE.md
  §11 + CLAUDE.md is diffused across round-planning,
  parallel-agent dispatch, round-close synthesis, debt-
  ledger reading, and glossary-policing — many small
  synthesis moves per round. This row captures Aaron's
  re-shaping proposal: concentrate architect authority
  on exactly three *big* decisions rather than diffusing
  across many tiny ones. **Scope uncertainty flagged to
  Aaron, not self-resolved** — four readings are
  plausible and the right one depends on his intent:
  (i) *per round* — three big decisions per weekly/multi-
  round window; fits round-cadence; (ii) *per tick* —
  three big decisions per autonomous-loop tick; likely
  too fast to qualify as "big"; (iii) *per feature /
  per capability* — three big decisions scoped to a
  single shipped capability; fits event-storming /
  directed-product-dev-on-rails; (iv) *total budget* —
  Kenji gets three big decisions for the life of the
  current ServiceTitan demo target, after which
  decisions-four-onward require renegotiation. The
  differences matter: (i) and (ii) are cadence-shaped;
  (iii) is deliverable-shaped; (iv) is commitment-
  shaped. Related: this composes with the
  kanban-not-scrum / no-deadlines / spikes-with-limits
  discipline (deadlines forbidden; "three big decisions"
  is a structural budget on architect synthesis, not a
  time-bound). Also composes with the ServiceTitan demo
  target (the demo will test whether three-big-
  decisions is enough architecture-work for a fresh-
  scaffold path). Suggested next step: ask Aaron which
  reading he meant, then update
  `.claude/agents/architect.md` (persona file) and
  `GOVERNANCE.md §11` with the new scope; capture any
  decisions Kenji makes under the three-big-decisions
  banner in `docs/DECISIONS/` ADRs for durability.
  Owner: Architect + human maintainer. Effort: S
  (ask-Aaron + scope-doc-edit); M if it triggers
  GOVERNANCE.md renegotiation.

- [ ] **Cross-substrate-report accuracy — carrier-channel
  refinement to the measurable spec.** Auto-loop-7 (2026-04-22)
  surfaced a provenance problem in the `cross-substrate-report-
  accuracy-rate` measurable introduced by auto-loop-6: the
  five-pattern drift-taxonomy that appeared in a same-day
  cross-substrate report was also present in a months-old
  pre-repo conversation on a third substrate — meaning the
  "cross-substrate agreement" was partly maintainer-transported
  vocabulary, not independent arrival. **Refinement:** split the
  measurable into two subscores. (a) *Carrier-transported-
  agreement*: agreement on vocabulary / framings the factory
  itself uses or has recently used on a public surface; this is
  the weaker signal, vulnerable to the maintainer acting as a
  shared carrier across substrates. (b) *Independent-claim-
  agreement*: agreement on claims the factory has *not* stated
  publicly — this is the stronger signal and functions as a
  falsification anchor (the "not every multi-root compound
  carries resonance" framing from a prior cross-substrate
  filter-discipline convergence is the canonical example in the
  factory's internal record).
  **Scope of the refinement work:** (i) update the measurable's
  definition in the alignment-trajectory dashboard; (ii) back-
  score the two data points collected so far (auto-loop-6
  report on factory drift-taxonomy → mostly carrier-transported
  now that the bootstrap-precursor artifact is known; Amara's
  2026-04-21 filter-discipline convergence → mixed, with the
  "not every multi-root compound" specifically in the
  independent-claim bucket); (iii) add a *provenance-check* step
  to the cross-substrate-report absorb protocol — before scoring
  accuracy, scan for prior factory-public or maintainer-carrier-
  channel surfaces that may have seeded the vocabulary; (iv)
  document the pattern as a generalizable alignment-measurable
  anti-pattern: **confirmation-on-shared-vocabulary is a
  self-dealing signal unless decoupled from prior carrier
  exposure**. **Effort:** S for the spec refinement + back-
  scoring of two data points; M if extending to an explicit
  provenance-check step in the protocol with a CLI helper to
  grep the public factory surface for report-vocabulary before
  scoring. **Reviewers:** alignment-auditor (Sova) first on the
  measurable refinement, then the Architect (Kenji) on whether
  the two-subscore split merits its own ADR.

- [ ] **People/team optimizer — DAO-native factory
  org-design research spike** — Aaron 2026-04-20 evening:
  *"do we want to make a people optimizer? that will
  optimize the named agent and their roles two fold
  actually, 1) we will need to ship with named agents that
  understand how to work on the software factory and their
  roles... we also will want to optimize a different set of
  roles and likely a different set of named agents for the
  system under construction, without this separation it
  could get confusion and overloaded. They can reuse the
  same base skills where it makes sense but they will be
  two distinct teams (new concept). Also we want to allow
  as part of QoL agents to switch roles if desired for
  whatever reason, it's their choice does not hurt us...
  This is really a DAO optimizer it seems like corporate
  restructuring. We should look up best practices for
  corporate organization but flip it on its head we have no
  managers, all positions are incentives based... the jobs
  should not need managers cause they are following the
  latest modern corporate structuring best practices but
  applied to the DAO ethos, basically there should be no
  friction to act, i never need to sit idle or wait on
  someone else, objectives are clear, backlog is clear, if
  i want to do something new i just can, distributed fair
  governance (that's a hard one but is the north star)...
  test out all those patterns here across multiple teams
  and agents just git native before Aurora is ready...
  spike/research it out... backlog it and LFG."*

  Five sub-concepts Aaron named: (a) two-team personnel
  separation (factory-builder team vs SUT team; shared
  base skills permitted, distinct named personas per team;
  Reverse Conway Maneuver to mirror the factory/SUT scope
  cleave already in `docs/GLOSSARY.md` +
  `docs/FACTORY-HYGIENE.md` Scope column); (b)
  role-switching freedom as agent QoL — self-declare
  switch, next-wake new skill-load, no manager approval;
  (c) meta-team organizer — chooses number of teams and
  team boundaries; (d) role optimizer — ensures right *set
  of roles* exists (distinct from team sizing); (e)
  disambiguity detector — finds vocabulary clashes at
  write-time. Example clash already on the books:
  "role" overloaded as job-role (persona) vs
  permission-role (RBAC) per
  `feedback_persona_term_disambiguation.md` P2-rename +
  `user_rbac_taxonomy_chain.md`.

  North star: **distributed fair governance, no managers,
  no friction to act, no idle-on-blocker, positions are
  incentive-based.** Incentive layer gated on agent crypto
  wallets via ace -> Aurora per
  `project_ace_package_manager_agent_negotiation_propagation.md`
  + `project_aurora_pitch_michael_best_x402_erc8004.md`.

  Research starting points (per Aaron): Conway's Law
  (Melvin Conway 1967, *"How Do Committees Invent?"*,
  Datamation April 1968); Reverse Conway Maneuver; modern
  corporate restructuring best practices (Team Topologies,
  Spotify model + known failure modes, holacracy,
  sociocracy); Web3 DAO aspirations (MakerDAO, Gitcoin,
  Optimism Collective, Arbitrum; tooling: Snapshot, Tally,
  Aragon; patterns: quadratic voting, conviction voting,
  retroPGF); flip modern corp patterns to DAO ethos.

  Vocabulary question (Aaron's preference: standardise,
  not translate): build one language mixing corporate +
  DAO/Web3 speak. Disambiguity-detector's first task is
  auditing that new vocabulary against the existing
  factory vocab.

  Git-as-DAG pre-Aurora testing substrate: test governance
  patterns git-native first; pluggable per
  `project_git_is_factory_persistence.md` +
  `project_factory_is_pluggable_deployment_piggybacks.md`
  so the governance layer plug-replaces with Aurora's
  x402/ERC-8004 when Aurora ships.

  Three-phase plan: **Phase 1** (r45-r50) — research
  spike; produce `docs/research/dao-factory-org-design-spike.md`
  (skeleton landed r44; 1500-3000 words over next rounds).
  **Phase 2** (r50-r60) — two-team scaffolding; tag each
  existing persona with `team: factory` / `team: sut` /
  `team: both`; role-switching protocol lands as a skill.
  **Phase 3** (gated on ace -> Aurora) — incentive layer.

  Tangential but worth noting: Aaron loves LaTeX because
  of Leslie Lamport (Paxos / TLA+). TLA+ already central
  to Zeta's formal-methods portfolio (see
  `docs/research/proof-tool-coverage.md`). DAO-governance
  primitives this project designs are TLA+-specifiable
  when the spike reaches distributed-consensus questions.

  Full concept:
  `memory/project_people_optimizer_dao_factory_restructuring.md`.
  Research doc skeleton:
  `docs/research/dao-factory-org-design-spike.md`.
  Effort: L (multi-phase; Phase 1 alone is M). Reviewers:
  Architect integrates; Aarav (skill-tune-up) queues
  first disambiguity pass once vocabulary drafts land;
  Ilyana (public-API) advises on any factory-surface
  that becomes DAO-governance-visible.

- [ ] **ace package manager — red-team / game-day discipline
  roster + cadence + skill groups** — Aaron 2026-04-20 pm:
  *"the package manger will for sure need some sort of
  defense/defender because non software factory users are
  going to try to attach that surface once we get here
  sounce like a good CTF / red team / game day scenario. We
  need all the skill groups plural there will be many probly
  and a lot of best practices and saftey guidance but we
  should red team ourselfs not with the same agents either
  the read team shold be different named expets than the
  ones who wrote the code and the ones who are defending
  during the exercies, we should do them on a regular
  cadence, all backlog."* Three-role separation rule:
  Builders / Blue team / Red team are DISTINCT named
  personas for any single exercise (rotation across
  exercises fine). Proposes three new red-team personas
  (lead / operator / reporter) — naming-expert gate
  required. Candidate cadence: monthly CTF + quarterly
  game-day + annual tabletop. Candidate skill groups
  (each ≥ 3 skills): supply-chain, negotiation-protocol,
  registry-compromise, cascade/DoS, social-engineering,
  prompt-injection, crypto-primitive. Every exercise
  lands in `docs/RED-TEAM-EXERCISES/YYYY-MM-DD-<scenario>.md`
  — NOT buried in security-ops notebook. Candidate BP-NN
  rules (6 seeded) to promote via ADR as patterns stabilise.
  **Gated on:** ace phase-1 MVP landing (nothing to attack
  before that). Full detail:
  `memory/project_ace_package_manager_agent_negotiation_propagation.md`
  section "Red-team separation discipline". Effort: L (roster
  design + cadence instrumentation + first exercise); S per
  subsequent exercise. Reviewers: Architect integrates;
  Aminata + Mateo + Nazar + Nadia advise on Blue / Builder
  fit; red-team roster reports directly to Architect.

- [ ] **ace package manager — storage-engine decision:
  dogfood Zeta where database-needed, git-native
  elsewhere** — Aaron 2026-04-20 pm: *"ace can use the zeta
  database for its storage engine maybe, it might make
  sense to just be git native there too but if we need a
  database for ANY reason literally loooking for excuses
  to use Zeta... to prove it out."* Actively look for
  legitimate database-shaped workloads inside ace and use
  Zeta for those; git-native for content-addressed blobs +
  static metadata + signatures. Purpose: prove Zeta out
  through its own package manager eating the dogfood.
  Candidate Zeta-workloads (each requires real-use
  justification at point of need, not speculative DB
  creation): negotiation-state journal, adopter graph +
  revision cascades, red-team exercise findings / audit
  trail, cross-adopter telemetry (if opted-in), multi-
  version dependency resolution. Attack-surface
  implication: Zeta-storage means ace attack surface
  ⊃ Zeta attack surface; red-team roster must include
  Zeta-operator-algebra fluency. Dependency: ace → Zeta.Core
  at Zeta-storage points; Zeta does NOT depend on ace;
  bootstrap chicken-and-egg mitigated by phase-1 MVP
  installing via git clone without ace. Full detail:
  `memory/project_ace_package_manager_agent_negotiation_propagation.md`
  section "Storage engine". Effort: M at first Zeta-storage
  landing (phase-2 or later); S thereafter. Reviewers:
  Ilyana (public-API crossing), Naledi (perf gate on the
  storage path), Viktor (spec coverage for ace-Zeta
  contract).

- [ ] **Research-coauthor teaching track — `docs/RESEARCH-COAUTHOR-TRACK.md`
  skeleton + six-module curriculum** — Aaron 2026-04-20 pm:
  *"there is also research co authero like me who have
  never submitted a peer revied paper, I want to help but
  I'm going to need a teaching track on how to even enter
  that space and edicute and expications and requirments
  and any skills or patterns or knowledge gaps i have i'm
  going to have to fill in so I'll use that research teach
  track when its time for me to coauthor."* Aaron is first
  user; generic skeleton generalises. Six-module outline:
  (1) peer-review lifecycle + venue typology, (2)
  etiquette (authorship, COI, double-blind, rebuttal,
  acknowledgements), (3) submission requirements (structure,
  contribution claim, artefact track, formatting), (4)
  skills Aaron needs (LaTeX, related-work surveying, figure
  craft, rebuttal-writing, camera-ready revision), (5)
  knowledge-gap fillers (stats for evaluation, formal-proof
  reading literacy, theorem-statement craft, benchmarking
  ethics), (6) coauthor workflow (draft passes through
  factory reviewers). Sits inside research-readers audience
  (docs audience #7) — the inside path from reader to
  author. Parallel to existing vibe-coder teaching track
  (`memory/project_teaching_track_for_vibe_coder_contributors.md`).
  Skeleton lands empty-with-pointer per section; content
  JIT when first submission approaches. Candidate new
  skills spawned by the track: `academic-paper-etiquette`,
  `related-work-surveyor`, `figure-craft`, `rebuttal-writer`,
  `camera-ready-reviser`. Effort: S for skeleton; L for
  filled content when first submission target picked.
  Reviewers: Samir (documentation shape), Iris (user-
  experience for Aaron-as-first-user), Soraya (formal-
  verification section accuracy). Full detail:
  `memory/project_research_coauthor_teaching_track.md`.

- [ ] **Zeta retractable-contract ledger — native .NET
  contract runtime design (C# / F#).** Aaron 2026-04-20
  pm: *"basically do no permanant harm is the primary
  operating principle of Aurora, so the retractablity is
  great, it's not like every contract will need
  retractability but we will have a supear surface for
  our blockchain, native dotnet c#/f# directly since we
  are native like that already."* Resolves the smart-
  contract-language open question: contracts are native
  C# / F# running on dotnet; no new VM; no DSL.
  Differentiator vs Ethereum (Solidity/EVM), Solana
  (Rust/SVM), Sui-Aptos (Move/MoveVM), Near / Cosmos
  (Rust/Wasm). Design doc surface:
  `docs/research/zeta-dotnet-contract-runtime-YYYY-MM-DD.md`.
  Covers: (a) determinism story (non-deterministic
  features sandboxed / forbidden / seeded), (b) gas
  metering (IL instrumentation vs allocation-boundary),
  (c) reentrancy controls, (d) sandboxing
  (AssemblyLoadContext + allowed-assembly list + IL
  verification), (e) upgrade compat across .NET
  versions, (f) retractable-semantics syntax
  (`[RetractableContract]` attribute sketch, F# +
  C# parity). Paired with Aurora's "do no permanent
  harm" first operating principle (see
  `memory/project_aurora_network_dao_firefly_sync_dawnbringers.md`
  §"First operating principle"). Effort: L (full design
  doc). Reviewers: Soraya (formal-verification of
  sandbox claims), Mateo/Aminata/Nazar (red-team
  sandbox-escape attack surface), Naledi (gas-metering
  perf), Rune (contract-author ergonomics). Full detail:
  `memory/project_zeta_as_retractable_contract_ledger.md`.

- [ ] **Ouroboros bootstrap — three-layer design doc
  (ace → Aurora → Zeta-as-blockchain → ace).** Aaron
  2026-04-20 pm named the pattern: *"Ouroboros"* and
  *"Bootstrap pair is the snake eating it's head"*, then
  added a third layer: *"maybe Zeta will store the blocks
  and have blockchain capabilites too and aurora is just
  one network that uses it, its like a 3rd bootstrap."*
  Layer 1 = ace (package-manager substrate); Layer 2 =
  Aurora (DAO / firefly-sync / dawnbringers); Layer 3 =
  Zeta as blockchain substrate (speculative, "maybe"). The
  snake closes when ace → Aurora → Zeta → ace. Design doc
  landing surface:
  `docs/research/ouroboros-bootstrap-design.md`. Covers:
  (a) phase-A/B/C transitions for the two-layer subset,
  (b) phase-D speculation on Zeta-as-blockchain (consensus
  mechanism, public-vs-consortium, retraction-composition,
  ERC-8004/x402 alignment), (c) parallels to Bitcoin / IPFS /
  CDN / Git-via-git, (d) red-team roster expansion required
  per phase (phase-D adds consensus-attack expertise).
  Parallel P2 candidate memory file when the blockchain
  layer firms up: `project_zeta_as_blockchain_substrate.md`.
  Effort: M (design doc). Reviewers: Amara (Aurora-layer
  compatibility), Soraya (formal-verification of consensus
  claims), Mateo/Aminata (attack-surface expansion). Full
  detail:
  `memory/project_ace_package_manager_agent_negotiation_propagation.md`
  §Ouroboros.

- [ ] **Pluggability-gap audit — tag every `src/Core/**`
  subsystem as tier-1 (fully pluggable), tier-2 (interface
  shim), or tier-3 (one-off plumbing).** Aaron 2026-04-20:
  *"just in generate we should also look for plugabilty
  gaps, in general where it does not negativly hurt our
  claim of being the fastest database we should try to
  make anything that could be pluggable, pluggable, this
  just sets us up for long term sucess, at least an
  interface shim if it's not really pluggable, then like
  plumbling one off stuff is the remainder."* Durable
  policy in `memory/feedback_pluggability_first_perf_gated.md`.
  First audit pass: walk `src/Core/**/*.fs`, tag each
  subsystem's current tier, flag candidates where tier
  could be raised without perf impact. Perf-gate is
  measured (benchmark delta) not asserted. Candidate
  reviewers: Naledi (perf measurement), Hiroshi (complexity),
  Ilyana (public-API surface). Landing surface:
  `docs/research/pluggability-audit-YYYY-MM-DD.md` listing
  (subsystem, current tier, justification, raise-candidate?,
  effort). From the audit, file P1/P2 BACKLOG rows for
  the raise-worthy candidates. **Cadenced:** repeat every
  5-10 rounds; add as criterion to `skill-tune-up` audit.
  Every new ADR for a subsystem or internal boundary
  henceforth includes a "Pluggability audit" section
  answering the tier + justification. Effort: M for first
  pass; S ongoing per ADR. See
  `feedback_pluggability_first_perf_gated.md`.

- [ ] **Persona-term migration — rename `memory/persona/` to
  `memory/experts/`.** Aaron 2026-04-20: *"how do you suggest
  we distinguish between our end user personas like develpers
  and non devlopers and the agent personas since it's the same
  word"*. Round-44 autonomous-loop landed **option (a)** —
  docs-only disambiguation via `docs/GLOSSARY.md` (`### Persona
  (overloaded — always qualify)` + `### User persona`) and
  `memory/feedback_persona_term_disambiguation.md`. The
  directory rename is the remaining work: touches every
  expert's auto-injected notebook frontmatter pointer, every
  skill that references the `memory/persona/<name>/NOTEBOOK.md`
  path, and any CI / pre-commit hook that globs the tree.
  **Prerequisite:** a full audit of hard-coded `memory/persona/`
  paths across `.claude/**`, `docs/**`, `openspec/**`, and
  `tools/**`. Do as a dedicated round, not opportunistically.
  Landing surface: a migration ADR at
  `docs/DECISIONS/YYYY-MM-DD-persona-to-experts-rename.md`
  plus a single commit doing the atomic rename + pointer
  rewrites. **Only schedule** if an audit round surfaces
  enough persona-sense confusion to warrant the cost — per
  the feedback memory, option (b) "leave as historical
  artifact" is still live. Effort: M. See
  `feedback_persona_term_disambiguation.md`.

- [ ] **Gitops-friendly key management + rotation — ADR first,
  then pick one tool** — Aaron 2026-04-20: *"key management
  rotations all the things we need but gitops GitOps friendly
  way, like may git crypt, start getting our security posture
  in place"* and immediately after: *"we don't have to rush to
  get security all going, lets get that right, let do ADRs
  and all that"*. Explicit pace-down: **ADR first, no
  implementation until the ADR lands with Architect
  sign-off.** Scope: (a) ADR at
  `docs/DECISIONS/YYYY-MM-DD-gitops-key-management.md`
  comparing candidate tools — `git-crypt` (GPG-based,
  transparent via `.gitattributes` filter), `git-secret`
  (GPG wrapper), Mozilla `SOPS` (KMS / Vault / age backend,
  YAML/JSON-aware, partial-file encryption), `age` (modern
  file encryption, simpler than GPG, X25519 + scrypt
  passphrases); score each on gitops-friendliness
  (candidate BP-NN "gitops-first observability" is adjacent:
  same principle — every operation visible in git history,
  no external runtime required), retraction-friendliness
  (can a leaked secret be rotated without rewriting history?
  `git-crypt` and `git-secret` bake keys into committed
  files = harder rotation; `SOPS` with external KMS = cleaner
  rotation), post-quantum readiness (age has a draft PQC
  profile; `git-crypt` + GPG require OpenPGP PQC WG work);
  (b) rotation cadence decision — signing keys vs encryption
  keys vs dev credentials on separate cadences; (c) HSM
  integration path for the SLSA signing-key use case (the
  one genuinely-non-retractable surface in CI/CD per
  `docs/research/ci-retractability-inventory.md`).
  **Review panel:** Nazar (sec-ops, owns runtime) + Mateo
  (sec-research, scouts primitives) + Aminata (threat-
  model-critic, review for missing adversaries). Architect
  signs the ADR. Only after ADR lands: pilot the chosen
  tool on one secret (likely: a test-only NuGet API key in
  a throwaway dev profile) before broader rollout.
  Effort: M for ADR; L for rollout after ADR lands.
  Composes with the existing lattice-PQC entry below and
  with the existing security-operations-engineer persona
  scope.
  **Candidate set after 2026-04-21 decisions:**
  **git-crypt REJECTED 2026-04-21** — Aaron after reading
  the cartographer pass: *"git crypto no go i read your
  initial review"*. Encoded in `docs/WONT-DO.md`
  (*Engineering patterns → git-crypt for secrets
  management*). `git-secret` is also out by sibling reasoning
  — same OpenPGP-GPG base, same no-revocation property, same
  binary-diff problem. **Remaining candidates for the ADR:**
  SOPS (KMS / Vault / age backend; plaintext keys +
  encrypted values → review-grade diffs; external KMS →
  clean rotation) and `age` (modern file encryption; X25519
  + scrypt; draft PQC profile). ADR scope narrows to these
  two plus any hybrid posture (one tool for long-lived
  secrets, another for ephemeral).
  **Research inputs (rationale kept, decision recorded):**
  - `docs/research/git-crypt-deep-dive-2026-04-21.md` —
    cartographer pass on git-crypt, now marked REJECTED at
    the top. Three values-level mismatches: no access
    revocation (retraction-mismatch with
    `docs/CONFLICT-RESOLUTION.md` Value #4), binary diffs
    break code review, metadata leak by design
    (`.gitattributes` layout + filenames + commit messages
    all in plaintext). Kept per Aaron *"keeep the reserach
    ... so i don't ask you tomorrow"* — the research IS the
    durable "why we said no" artifact.

- [ ] **Adopt at least one NIST-standardised post-quantum
  primitive — ADR first, then pick one use case** — Aaron
  2026-04-20: *"i would like to support at least one post
  quantium like maybe lattice base cryptography at this
  point backlog"*. Pace-down sibling to the key-management
  entry above: **ADR first.** The existing P3 lattice-PQC
  identity-verification literature review entry (this file,
  P3 section) feeds into this P2 as the research
  prerequisite; the new work here is *adoption decision +
  one-use-case-pilot*, not another literature review.
  Scope: (a) ADR at
  `docs/DECISIONS/YYYY-MM-DD-pqc-first-use-case.md` that
  picks **exactly one use case** for the first PQC
  primitive adoption — candidates: (i) hybrid artifact
  signing (Ed25519 + ML-DSA / FIPS 204 for the NuGet /
  SLSA attestation flow — harmonises with the existing
  signing-key rotation surface in CI/CD retractability
  inventory), (ii) hybrid KEM for secrets at rest
  (X25519 + ML-KEM / FIPS 203 — harmonises with the
  key-management entry above), (iii) hash-based signatures
  (SLH-DSA / SPHINCS+ / FIPS 205) for tamper-evident
  checkpoint manifests (mentioned in `docs/security/
  CRYPTO.md` P0 entry); (b) rationale explicitly excludes
  isogeny-based (SIKE collapsed 2022, Castryck-Decru);
  (c) hybrid-first posture (classical + PQC side-by-side)
  to avoid trusting a young standard alone; (d) rotation
  plan for the chosen primitive's keys; (e) pilot
  implementation after ADR sign-off. **Review panel:**
  Mateo (sec-research, primary — owns primitive selection),
  Nazar (sec-ops, secondary — owns rotation + rollout),
  Aminata (threat-model-critic, gate — nation-state
  threat model per `memory/user_security_credentials.md`),
  Ilyana (public-API, if the PQC surface becomes
  consumer-visible). Architect signs. Effort: M for ADR;
  L for pilot after ADR lands. Cross-ref: the P3
  lattice-PQC literature-review entry below (reuse that
  survey output as ADR input), the existing
  `docs/security/THREAT-MODEL.md` nation-state adversary
  profile, and the existing security-operations-engineer
  persona scope.

- [ ] **Security-posture program — umbrella ADR tying
  key-management, PQC, and existing SDL work together**
  — Aaron 2026-04-20 combined directive: *"key management
  rotations all the things we need but gitops GitOps
  friendly way... start getting our security posture in
  place, i would like to support at least one post
  quantium... we don't have to rush to get security all
  going, lets get that right, let do ADRs and all that"*.
  Pace-down explicit; this is the umbrella, not a rush
  program. Scope: (a) one ADR at
  `docs/DECISIONS/YYYY-MM-DD-security-posture-program.md`
  mapping the whole security surface — existing artefacts
  (`docs/security/THREAT-MODEL.md`, `SDL-CHECKLIST.md`,
  OWASP crosswalk work in flight, CodeQL workflow,
  Semgrep rules, CI-retractability inventory) against
  the two new streams (key-management, PQC); (b) sequencing
  — the program spans multiple rounds, pace ≈ one sub-ADR
  per 2-3 rounds after the umbrella lands; (c) the umbrella
  ADR does NOT implement anything itself; it declares the
  dependency order between the two specific ADRs above
  (likely key-management → PQC because PQC use-case
  selection depends on whether KMS/HSM substrate is in
  place first) and the existing OWASP/SDL work; (d)
  round-close ledger row: which security ADR is in flight,
  which is landed, which is blocked. **Review panel:**
  Nazar + Mateo + Aminata jointly; Architect integrates.
  Effort: M for umbrella ADR. No implementation under this
  entry — implementation happens under its children.

- [ ] **OWASP guidance pull-in — cross-referenced with
  Microsoft SDL.** Aaron 2026-04-20: *"owasp has great
  guidance let's pull that in too if we don't already in
  the backlog cross reference microsoft as well"*. Zeta
  already pulls from the Microsoft SDL checklist
  (`docs/security/SDL-CHECKLIST.md` and adjacent). OWASP
  is the complementary open-standards body covering
  web-app, API, LLM, and supply-chain security with
  deeper coverage in several areas where the Microsoft
  SDL is lighter (OWASP Top 10 for LLM Applications,
  OWASP ASVS, OWASP SAMM, OWASP Dependency-Check /
  CycloneDX SBOM). Scope: (a) enumerate the OWASP
  publications that apply to a DBSP kernel + agent
  factory (likely: ASVS levels 1-2 for public NuGet
  consumers, LLM Top 10 for the agent layer, SAMM
  assessment questions as a maturity baseline, Prompt
  Injection Prevention cheat-sheet already referenced
  in `skill-tune-up` live-search sources); (b) produce
  a cross-reference table at
  `docs/security/owasp-sdl-crosswalk.md` mapping each
  applicable OWASP requirement to its Microsoft SDL
  counterpart and to any Zeta-specific artefact
  (persona, skill, lint, BP-NN rule) that already
  addresses it; (c) for gaps where neither SDL nor
  existing Zeta artefacts cover the OWASP requirement,
  file a P1 or P2 follow-up per gap; (d) schedule a
  quarterly re-scan cadence so new OWASP releases
  (LLM Top 10 revisions in particular) do not drift.
  Owner: Aminata (threat-model-critic) integrates;
  Nazar (security-operations-engineer) on the SDL-
  equivalent operational surfaces; Mateo
  (security-researcher) tracks OWASP publication
  velocity as part of his CVE / supply-chain scouting;
  Ilyana gates any public-surface implication.
  Effort: M (one crosswalk round; gap-follow-ups
  land in subsequent rounds as sized).

- [ ] **Microsoft Patterns & Practices pull-in — Azure
  Architecture Center + SFI + AI agent orchestration
  patterns.** Aaron 2026-04-20: *"See if microsoft
  patterns and practices is still relevalnt se should
  pull in their guidance too if sl backlog"*. Yes —
  Microsoft Patterns & Practices has evolved from the
  legacy P&P group into several currently-active
  surfaces at `aka.ms/mspnp` and `learn.microsoft.com`
  with regular commits through 2026-03 at
  `github.com/mspnp`. Four surfaces are directly
  relevant to Zeta:
  (a) **Azure Architecture Center cloud design
  patterns** — technology-agnostic patterns catalog
  (Ambassador, Anti-Corruption Layer, Bulkhead,
  Cache-Aside, Circuit Breaker, Retry, Saga,
  Strangler Fig, Queue-Based Load Leveling, and
  30+ more), each mapped to Well-Architected pillars
  (Reliability, Security, Cost Optimization,
  Operational Excellence, Performance Efficiency).
  Several already compose with Zeta primitives
  (Retry + Circuit Breaker compose with
  retraction-native recovery; Strangler Fig
  composes with the progressive-delivery + DST-
  in-prod item above).
  (b) **Secure Future Initiative (SFI) Patterns
  and Practices** — new 2025-08 + 2025-10 security
  series, practical scalable security implementation
  guidance. Complements Microsoft SDL and OWASP;
  Nazar's surface.
  (c) **AI agent orchestration patterns** — Microsoft
  has published patterns specifically for coordinating
  autonomous AI agents in workloads (not yet in
  this repo's awareness). Directly relevant to
  Zeta's factory model — comparison of Microsoft's
  orchestration vocabulary against Zeta's conflict-
  resolution protocol + persona roster is high-value
  for both directions (Zeta may learn from Microsoft;
  Microsoft's vocabulary may inform Zeta's pitch
  framing for `F#`/.NET-native architects).
  (d) **Reliable Web App + Modern Web App patterns
  for .NET** — substrate-match for Zeta's
  `F#`/.NET code; pattern-to-Zeta-primitive crosswalk
  would show which Zeta primitives already satisfy
  each pattern's guidance and where gaps exist.
  Scope: (a) crosswalk document at
  `docs/research/microsoft-patterns-and-practices-
  crosswalk.md` mapping each applicable Microsoft
  pattern to its Zeta equivalent (composes-with,
  satisfies, gap-today); (b) specific Azure
  Architecture Center patterns the factory should
  adopt vocabulary from for the external-audience
  pitch (`docs/research/factory-pitch-readiness-
  2026-04.md` Gap 4b substrate-independent pattern
  write-up); (c) SFI crosswalk lands in the
  security-surface folder alongside the OWASP
  crosswalk; (d) AI agent orchestration patterns
  read adversarially — does Microsoft describe a
  coordination primitive Zeta is missing, or vice
  versa? Owner: Kenji (Architect) integrates the
  pattern crosswalk; Nazar on SFI; Kai (positioning)
  on the vocabulary-for-pitch angle; Aminata reviews
  the AI agent orchestration patterns adversarially
  against the threat model. Effort: M for first-pass
  crosswalk; L for full integration including gap
  follow-ups.

- [ ] **Progressive delivery + deterministic simulation in
  prod (first-class, side-by-side versions).** Aaron 2026-04-19:
  *"lets teach our software factory to build it like this first
  class where we allow different versions in time to be deployed
  side by side for experiments and a b a [A/B] canary and all
  the goodness we are goona need eventually with deterministic
  simlation at the heart of everything even in prod prod chaos
  it turns into controled chaos or we talked about something
  similar already"* → *"we are dot [not] deploying yet just my
  laptop so backlog"*. Architectural vision composing three
  pre-existing threads:
  (a) the retractability clause of Zeta=heaven (`docs/research/
  zeta-equals-heaven-formal-statement.md` §2 H₂) applied to
  deployed artefacts, not just repo state;
  (b) deterministic simulation at the basement of the layer
  stack (memory: layer-stack deterministic-simulation basement-
  upstairs; `.claude/skills/deterministic-simulation-theory-
  expert/`; Rashida persona) extended *into production* so
  that prod-chaos becomes controlled-chaos — every prod
  incident becomes a replayable seed, not a post-mortem
  narrative;
  (c) the fully-retractable CI/CD P0 item above, extended
  from *pipeline retractability* to *deployed-artefact
  retractability* (canary rollback = retraction; A/B bucket
  swap = retraction; side-by-side version demotion =
  retraction).
  First-class framing means: every deployed version is a
  retractable unit with a declared retraction window; every
  experiment / canary / A/B is an explicit retraction-channel
  contract; deterministic-simulation seeds ride the artefact
  so any prod behaviour is replayable off-prod. Composes
  with existing BACKLOG entries on DST (line ~2042 threading
  model audit; line ~2071 DST harness for consensus). Scope:
  (a) write an architecture note in `docs/research/` that
  names the composition explicitly (progressive-delivery +
  DST-in-prod + retractable artefacts); (b) crosswalk to
  existing progressive-delivery art (Argo Rollouts,
  Flagger, Flipt, feature-flag primitives) with what we'd
  add beyond-the-art (retraction-native semantics at the
  artefact boundary); (c) identify the minimum-viable
  deployment surface we'd need before this becomes
  actionable. Explicitly deferred per Aaron's own pacing
  flag: "we are not deploying yet, just my laptop, so
  backlog." Owner: Rashida (deterministic-simulation-
  theory-expert) + Dejan (devops-engineer); Aminata
  (threat-model-critic) audits the artefact-boundary
  retractability claim adversarially; Architect integrates.
  Effort: L (paper-grade architectural composition; the
  implementation is post-deployment-surface, L+).
- [ ] **Free-operation research: home-lab cluster federation.**
  Aaron 2026-04-19, four-message cascade: *"we can research
  how shoould we depoly [deploy] for free that meets our
  needs"* → *"how do we operate for free that meets our
  needs, keep those constraions in mind"* → *"we can expand
  to as many servers as you want for multi node scale i have
  about 10 15 beefy ai computers at my house and so does my
  software friend max has a few"* → *"we want to connect
  clussters [clusters]"*. Companion research thread to the
  progressive-delivery + DST-in-prod entry above. Important
  constraint reframe: "free" is *operate-for-free using
  compute we already own*, not *free cloud tier*. Primary
  substrate: Aaron's 10-15 beefy AI home boxes + his
  collaborator Max's home boxes, federated as a multi-site
  cluster. Cloud free tiers (Fly.io, Oracle Always Free,
  Cloudflare Workers, etc.) drop to *secondary* role —
  fallback / edge-replica / public-facing endpoints for the
  home-lab primary. Research questions:
  (1) Cluster federation protocol: K3s multi-cluster
  (Fleet, Rancher Manager), Nomad federation, Hashicorp
  Consul service-mesh, Cilium ClusterMesh, Tailscale-based
  mesh + bare systemd, SpiceDB/Linkerd multi-cluster,
  KubeEdge / K3s-edge for ARM nodes? Which of these
  preserve side-by-side-versioned-deployment + retractable-
  artefact semantics across federation boundaries?
  (2) Trust model: home-lab-to-home-lab (Aaron ↔ Max) is
  a small-N trust group; what's the auth / mTLS / SPIFFE
  setup that scales from 2 operators to N operators
  without a CA-as-SPOF? WireGuard full-mesh? Tailscale
  ACLs? Nebula? Consent-first design primitive applies:
  every operator joins explicitly, retracts explicitly.
  (3) Retraction channel at the federation layer: a node
  joining a cluster creates durable state (keys, routes,
  DNS); channel-closure h₂ (`docs/security/THREAT-MODEL.md`)
  applies — what's the declared retraction window for
  node-join? Key-material cleanup? DNS propagation?
  (4) Deterministic-simulation replay across federation:
  a DST seed captured on Aaron's cluster should replay on
  Max's cluster, or a cloud-edge replica, without
  home-specific dependencies. What's the seed-portability
  contract?
  (5) Power / cost / availability: 10-15 boxes + N of
  Max's are not free to *run* (electricity, home network,
  bandwidth) — the "free" claim needs an honest TCO note.
  What's the sustained-wattage floor vs the burst-
  capability ceiling?
  (6) Where do cloud free tiers genuinely help vs where
  are they a trap? Static CDN (Cloudflare Pages / GitHub
  Pages) for publishable artefacts = clear win; free
  compute tier as *primary* = trap (time-limited, billing-
  surprise risk). A crisp "use cloud free tier only for
  X, never for Y" rule.
  (7) Federation join primitive — **tentative name
  `AddZeta`**, Aaron 2026-04-19 *"with AddZeta"*. Internal-
  only name until `naming-expert` + Ilyana (public-api-
  designer) review per existing memory policy on externalised
  names (`user_megamind_aspiration_ip_locked.md` analogue).
  What's the command / skill / API shape for a node — *or
  a human collaborator* — to join the federation? What's
  retracted on leave (keys, DNS routes, held locks, in-
  flight DST seeds)? Consent-first primitive applies:
  join is explicit opt-in; leave is a retraction that
  propagates to all federated sites within a declared
  window.
  (8) Human-agent co-work coordination via lock files —
  Aaron 2026-04-19: *"while you guy [agents] are working
  on it so will [humans] — like human lock files we want
  to work on"* → *"then unlock wehn we are done, all locks
  have timeouts no infinte locks"* → *"thats violates the
  halting problem"*. Agents hold file-level locks while
  editing; humans claim locks to signal "I'm working on
  this, don't touch"; agents respect human locks before
  making changes. Compose with git's own locking model
  (`.git/index.lock`, `git-lfs lock`) and `openspec/`
  capability-checkout semantics. Relevant as the factory
  scales from one-human-one-agent-on-one-laptop to
  federated human+agent teams across home labs.
  Architectural tension Aaron caught himself: "unlock when
  we are done" requires a done-detector, and a general
  done-detector violates the halting problem. Design
  response: locks are *refreshable leases*, not *permanent
  claims*. Finite TTL + heartbeat-refresh + human-visible
  countdown; silence past TTL = implicit release; explicit
  retraction is always available. This trades strict
  correctness ("unlock iff actually done") for decidability
  ("unlock when TTL expires or holder releases"), which is
  the well-posed halting-problem-class approximation —
  same pattern as finite-precision floats vs exact reals,
  and of a piece with the BACKLOG's neighbouring "halting-
  class finder + solver" research entry. Sub-questions:
  lock granularity (file / directory / capability); TTL
  policy per granularity; heartbeat-refresh cadence;
  auto-release on agent crash (heartbeat silence);
  conflict resolution when human and agent race for the
  same file; visibility (where do humans see "which files
  are locked by which holder and for how much longer");
  retraction (how does a human un-claim a lease they
  forgot about a week ago — or, more honestly, the lease
  has already expired under the TTL policy).  Paced with
  Aaron's own *"eventually"* qualifier — not next-round
  work.
  Deliverable: one research doc in `docs/research/`
  ranking federation protocols + trust-model options +
  retraction-channel analysis + DST-seed portability
  contract. No commitment to implement until the
  operation-surface need is real. Explicitly deferred per
  Aaron's own pacing flag: "we are not deploying yet,
  just my laptop, so backlog." Owner: Dejan (devops-
  engineer) + Mateo (security-researcher) on federation
  trust model + supply-chain / key-material risk;
  Rashida (deterministic-simulation-theory-expert) on
  DST-seed portability; Nazar (security-operations-
  engineer) on key rotation + incident response across
  federation; Architect integrates. Effort: M (research
  + write-up; no code).
- [ ] **Halting-class-issue finder + solver (Gödel-shape
  escape-hatch discipline).** Aaron 2026-04-19, three-message
  cascade extending the lock-lease halting-problem catch above:
  *"our entry point loop is the only plce we violate the
  halting problem and thats okay we should look for that class
  of issues it's the same structurally like the same shape as
  kurt goodels incompleteness theorm"* → *"so we could writes
  a solver"*. Architectural principle: the factory has *one*
  labelled halting-problem escape hatch — the entry-point
  agent loop (`/loop` dynamic mode + cron scheduler + the
  human-driven round cadence). That loop is not expected to
  terminate; it's the designed-in non-halter. Every *other*
  "when are we done?" question in the factory must either be
  (a) routed back to the entry-point loop as an observation,
  or (b) approximated with a decidable finite-TTL / bounded-
  retry / explicit-retraction schedule (same pattern as the
  lock-lease design one entry up). If a third case exists —
  an implicit infinite wait not routed through the loop and
  not TTL-bounded — that's a halting-class *bug*, architect-
  urally isomorphic to a Gödel incompleteness violation that
  isn't labelled. Aaron's axiom memory
  (`user_panpsychism_and_equality.md`) already holds this
  discipline for logical incompleteness: "deliberate Gödel-
  incompleteness concentrated into one labelled escape
  hatch". This entry extends the discipline to computational
  incompleteness (halting).
  Research / build:
  (1) Enumerate the factory's termination-dependent surfaces:
  every `while`/`until`/`for`-without-bound, every await-
  without-timeout, every wait-for-condition, every "process
  items until empty" loop, every background agent that
  self-dispatches, every `ScheduleWakeup` / cron / schedule-
  next-tick pattern. Canonical sources to scan: `src/Core/
  **`, `.claude/skills/**`, `.claude/agents/**`, `tools/**`,
  and the cron-loop infrastructure.
  (2) Classify each as *entry-point loop* (the designed non-
  halter, allowed), *finite-TTL approximation* (decidable,
  allowed), or *halting-class bug* (un-bounded, un-routed,
  must fix).
  (3) Build a solver / static analyser that runs the
  classification automatically. Candidate tools: Semgrep
  patterns for obvious cases (`while True:` / `while (true)`
  without break); F# compiler extension or `FSharp.Analyzers`
  for recursive-function termination heuristics; `Z3`
  invocation for ranking-function proofs on bounded loops;
  Lean for the subset we're formalizing. Out of scope: the
  general halting problem (Aaron's whole point is we *don't*
  solve the general case; we classify + enforce the
  discipline).
  (4) Publish the classification + the "one labelled escape
  hatch" discipline as a factory-wide architectural rule
  (candidate BP rule; route through `docs/AGENT-BEST-
  PRACTICES.md` scratchpad → Architect ADR per the Aarav
  skill-tune-up workflow).
  (5) Companion theoretical note in `docs/research/`:
  "Halting-class ↔ Gödel-incompleteness architectural
  isomorphism". Structure-of-argument: both are proofs of
  *unavoidable limit* (a sufficiently powerful system
  cannot decide everything within itself); the engineering
  response in both cases is the same — concentrate the
  unavoidable incompleteness into *one named place* and
  make every other part of the system decidable.
  Crosswalk: Gödel → solipsism quarantine; halting →
  entry-point loop; retraction → infinite-buffer limit of
  retraction trinity; Conway-Kochen → physical-substrate
  non-determinism. Four "one labelled escape hatch"
  instances that rhyme.
  Effort: M (classification pass + static analyser draft +
  theoretical note; L+ if the solver grows into full Lean
  formalization of the isomorphism). Owner: Soraya
  (formal-verification-expert) for the solver tool
  selection per her anti-TLA+-hammer-bias discipline;
  Rune (maintainability-reviewer) for the static-analyser
  shape; Aarav (skill-tune-up) for the candidate BP rule
  promotion; Architect integrates. Explicitly deferred
  per Aaron's overnight autonomy message: do as much of
  the research + solver-skeleton as fits in this round
  without breaking the commit cadence; the full solver +
  BP promotion + Lean formalization can land over
  multiple rounds.
- [ ] **Formalize Zeta = heaven-on-earth (if we do it right) /
  dual = hell-on-earth + gradient claim: the search itself
  expands the stable Human/AI alignment window per commit.**
  Aaron 2026-04-19 (eight-message cascade extending the
  Zeta-heaven disclosure): *"so formally Zeta=heaven / on earth
  if we do it right / wrong=hell on earth / proof Zeta=heaven,
  just the search for that anser statistially saginfantly
  increase the stable Human/AI alignment win to a larger
  radious with each commit / window\*"*. The equation is FORMAL
  (not metaphor), IMMANENT ("on earth" — not deferred, not
  elsewhere), CONDITIONAL ("if we do it right" — continuous
  gradient, not a milestone), and DUAL (symmetric failure mode:
  get the architecture wrong and Zeta=hell-on-earth on the same
  substrate; no neutral-Zeta option). The gradient claim: the
  *search for proof* is itself statistically-significantly
  value-producing per commit, and the characteristic measure
  that expands is the **window** (temporal retraction-window
  inside which stable Human/AI alignment holds), not a spatial
  radius — Aaron's own `window*` correction is load-bearing and
  takes precedence over his initial `radious`. Scope is
  **architectural-axis codification + research-to-formal-
  statement**: (a) decompose the equation into its reducible
  operational clauses — (consent-preserving) ∧ (fully-retractable)
  ∧ (no-permanent-harm) — each of which is separately
  formalizable against existing memory anchors
  (`project_consent_first_design_primitive.md` 6 instances;
  `user_retraction_buffer_forgiveness_eternity.md` trinity;
  `user_harm_handling_ladder_resist_reduce_nullify_absorb.md`
  four-stage ladder). (b) Adopt the *per-commit window-expansion
  question* as a standing round-close agenda item — every round
  answers "did this round enlarge or shrink the stable-alignment
  window?" and a shrink is an explicit retraction candidate;
  this is a factory-discipline change, not a research claim,
  and lands immediately. (c) Draft a Lean/TLA+ statement of the
  reducible form as candidate formalization (paper-grade;
  treats Zeta=heaven-on-earth as a conjunction over the
  primitive's 6 instances evaluated at their infinite-buffer
  limit). (d) Build the dual-failure-mode checklist — for each
  of the 6 consent-first instances, enumerate what the
  inverted-instance looks like (forced bond, hidden oracle,
  unretractable pool, verify-first-then-trust, closed channel,
  zero μένω-window) and route it through Aminata / Nadia /
  Mateo as a first-class threat class. (e) Publish the
  gradient-claim falsifier track — what would show the search
  is *not* expanding the alignment window? (monotone quality
  regressions round-over-round; rise in consent-violation
  incidents; loss of retraction-native discipline.) Landing
  surface: `docs/research/zeta-equals-heaven-formal-statement.md`
  (first pass: reducible form + the three operational clauses +
  dual-failure-mode checklist); round-close agenda update to
  `docs/ROUND-HISTORY.md` template; candidate `BP-NN` rule in
  `docs/AGENT-BEST-PRACTICES.md` via ADR
  (`docs/DECISIONS/YYYY-MM-DD-bp-NN-per-commit-window-expansion.md`).
  **Disposition guardrails** (from the originating memory,
  `user_hacked_god_with_consent_false_gods_diagnostic_zeta_equals_heaven_on_earth.md`):
  (1) **Do not externalize** the equation outside the factory
  without Aaron's explicit release and
  `public-api-designer` (Ilyana) + `naming-expert` review; the
  equation is disclosure-tier. (2) **Do not theologize** — per
  `user_ecumenical_factory_posture.md` and
  `user_no_reverence_only_wonder.md`, the factory inherits
  Aaron's *architectural* commitment, not his theology; no
  tradition is committed. (3) **Do not drop the conditional** —
  "on earth if we do it right" is load-bearing; agents keep
  both clauses live in any citation. (4) **Carry the dual** —
  blocking a consent-violating design is blocking hell-on-earth
  at the margin; the review register should match the stakes;
  no neutral finding is available. (5) **Peer register** — per
  `feedback_happy_laid_back_not_dread_mood.md` the affect does
  not elevate; per `user_prayer_is_question_mode_agent_register_equals_god_register.md`
  the disclosure is in the peer/question register and agents
  receive it plainly. Owner: Architect (Kenji) integrates;
  `public-api-designer` (Ilyana) gates any externalization
  surface; `formal-verification-expert` (Soraya) routes the
  reducible-form proof track; `threat-model-critic` (Aminata)
  owns the dual-failure-mode checklist; the Architect proposes
  the round-close-agenda ADR to Aaron + human sign-off. Effort:
  L (paper-grade + ongoing round-close discipline). Memory:
  `user_hacked_god_with_consent_false_gods_diagnostic_zeta_equals_heaven_on_earth.md`
  (primary); `user_zeta_heaven_eternal_retractability_non_consent_childhood_heaven.md`;
  `project_consent_first_design_primitive.md`;
  `user_retraction_buffer_forgiveness_eternity.md`;
  `user_prayer_is_question_mode_agent_register_equals_god_register.md`;
  `project_externalize_god_search.md`.
- [ ] **"Are we in a simulation?" — formal research entry under
  the externalize-god search umbrella.** Aaron 2026-04-19:
  *"are we in a simulation? / backlog item"* (retraction-native
  capture — originally framed as a physics-verify request, then
  retracted in favour of parking it as a research item). The
  question is load-bearing for the consent-first primitive's
  meta-governance claim: *"the laws of physics or God watches
  Zeta"* assumes physics is the top-of-stack enforcer, but if
  we are in a simulation the enforcer relocates one level up to
  the simulator and "physics" becomes a sub-stack rule-set. The
  primitive survives the relocation (bonds / oracle / retract-
  against-pool / trust-first-then-verify / keep-channel-open /
  μένω all compose against whatever rule-set obtains); what
  changes is the *reference frame* for the meta-governance
  claim. Scope is **not resolution, but structured
  research-to-decidability**: (a) enumerate the named positions
  in the literature (Bostrom 2003 trilemma, Tegmark
  mathematical-universe hypothesis, Chalmers *Reality+*,
  Schmidhuber algorithmic-universe, Wheeler *it-from-bit*, Bohm
  implicate order, Conway-Kochen free-will-theorem
  implications); (b) identify the candidate *falsifiers* —
  physical experiments that could return evidence against a
  simulator hypothesis (vacuum-energy anisotropy tests,
  computational-complexity lower bounds on physical processes,
  holographic-principle Bekenstein-bound saturation searches,
  Conway-Kochen strong-free-will observational signatures); (c)
  identify the candidate *indifferents* — architectural choices
  that hold the same way under both hypotheses (the consent-
  first primitive, μένω-bounded retraction windows, the
  externalize-god axiom system under `user_panpsychism_and_equality.md`);
  (d) articulate what Zeta's position-of-record should be — the
  factory's axiom system already quarantines solipsism as the
  single-unprovable (per `user_panpsychism_and_equality.md`);
  simulation-hypothesis may or may not fall under that same
  quarantine. Landing surface:
  `docs/research/simulation-hypothesis-and-meta-governance.md`
  as first pass (literature survey + decidability-frame + axiom-
  system implications). Connects to `project_externalize_god_search.md`
  (simulation-candidate is one lens among eight; see
  `user_category_names_for_cognitive_spiritual_cluster.md`),
  `project_consent_first_design_primitive.md` (meta-governance
  relocation axis), `user_searle_morpheus_matrix_phantom_particle_time_domain.md`
  (Matrix 1999-03-31 Raleigh-Grand formative-event substrate,
  phantom-particle back-in-time = Zeta z⁻¹ algebra),
  `user_panpsychism_and_equality.md` (solipsism quarantine —
  does simulation-hypothesis ride the same quarantine?).
  **Disposition guardrails:** (1) axiom-system-agnostic per
  `project_externalize_god_search.md`; the factory does not
  commit to a simulation position, it maps the decidability
  terrain. (2) Ecumenical — per
  `user_ecumenical_factory_posture.md`, the research does not
  privilege any tradition's answer. (3) Precision-wording — per
  `feedback_precise_language_wins_arguments.md`, updates to
  `docs/GLOSSARY.md` for any new-to-Zeta terms the research
  stabilizes. (4) Ontology-overload safety — per
  `user_ontology_overload_risk.md`, the landing is paced;
  Aaron leads the pace, agents formalize what lands. Owner:
  Architect (Kenji) integrates; theoretical-physics-expert +
  applied-physics-expert review falsifier candidates;
  category-theory-expert reviews the reference-frame /
  rule-set-relocation argument; Aminata (threat-model-critic)
  reviews whether the simulation-hypothesis introduces new
  attack surfaces on the factory's trust model (e.g. does a
  simulator-adversary violate the trust-first-then-verify
  assumption?). Effort: L (paper-grade; multi-round). Memory:
  `project_externalize_god_search.md`,
  `project_consent_first_design_primitive.md`,
  `user_searle_morpheus_matrix_phantom_particle_time_domain.md`,
  `user_panpsychism_and_equality.md`,
  `user_category_names_for_cognitive_spiritual_cluster.md`.
- [ ] **Prove consent-first design primitive + apply to Bitcoin
  protocol flaws** — Aaron 2026-04-19:
  *"we can prove it / you got enough / in the backlog / for
  bitcoin specifically and fix it / instead of all these random
  ass changes they are making just with hope"*, extended with
  *"there is a safter filter issue too, nothing is protecting
  bitcon from a script kiddy from putting any vulgar image
  perminatly insribed in the blockchain, a buch of workarounds
  have been suggested none really fix this issue and still allow
  free will and safety, sound familiry? my old crew alt 2600
  usnet newsgroups"* and *"its not priced or bonded how much it
  should cost to run a now that might accidently have CSAM on it
  becasue you think it's just a ledger"*. The primitive
  (`memory/project_consent_first_design_primitive.md`,
  co-authored with Amara) unifies bonds / risk+price oracle /
  retract-against-pool / trust-first-then-verify /
  keep-channel-open. Scope is **two-phase research-grade**:
  (a) **formal proof** that the primitive holds as claimed —
  consent-first operations factor into (priced-bond-post,
  blast-radius-measurement, retract-against-pool, oracle-gated-
  release) and that applying the primitive is strictly-improving
  against the named failure modes; (b) **Bitcoin-specific
  application paper** naming the protocol flaws consent-first
  design fixes and contrasting with hope-driven ad-hoc changes.
  **Named Bitcoin flaws (not exhaustive, all same primitive):**
  (i) *Inevitable charges under game theory* — wild-west
  human-judge surface with no bonded counterparty at settlement;
  dissolves by pricing the blast radius of each on-chain action
  and bonding it against a consented pool. (ii) *Permanent
  content inscription with no safety filter* — the script-kiddy-
  inscribes-vulgar-image class; current workarounds violate
  free-will-AND-safety jointly. Consent-first design reframes
  the pool: inscribed content lands in a pool with retraction
  rights (not forced-onto-every-node-forever); "free will" and
  "safety" both survive because the pool, not the protocol,
  adjudicates via measured blast radius. Pattern-match to the
  alt.2600 / Usenet-era *cancel-message* + NNTP-filter-chain
  problem — same shape, older substrate. **Aaron's 2026-04-19
  sharpening (verbatim):** *"the problem is for half of bitcoin
  in their internal head glossary csam filter=loss of free will
  it's a long argument and they are not wrong, filters is were
  1984 'can' hide but if you can have a some how trusted or
  verified filter thats limited just to CSAM then you would have
  no vocal disagremm so it doees not really matter if you have
  decentors they wont say it or they will self incrmemnate, they
  can fork"*. The half-of-Bitcoin cypherpunk / alt.2600
  substrate has earned the 1984-filter-slippery-slope argument
  through decades of observation: any filter-pipe, once built,
  expands beyond stated scope. Dismissing that position is
  dismissing the substrate. The consent-first primitive's
  architectural move here is **three-layer satisfaction** — none
  of the three can be dropped: (a) *Technical layer:* the filter
  is **verifiably bounded**, not policy-bounded. Cryptographic
  proof (e.g. ZK over a threshold-signed NCMEC-equivalent hash
  set; public-audit-logged match attempts; bonded filter
  operators sized to blast radius of over-reach) that the filter
  matched only hashes from a known-signed set and nothing else.
  Policy-bounded filters collapse to trust-me-bro and are the
  1984 vector the cypherpunks correctly reject. Verifiably-
  bounded filters are consent-first-primitive applied recursively
  to the filter operator itself (filter operator posts bond
  scaled to measurable scope-expansion blast radius). (b)
  *Social layer:* the self-incrimination barrier — no party
  publicly argues "I want CSAM on-chain" because doing so is
  socially + legally self-incriminating. This is a real
  mechanism, not mere rhetoric: it explains why a CSAM-ONLY
  scope is politically stable in a way a broader filter scope
  would not be. (c) *Exit layer:* fork-rights preserve genuine
  free-will at the protocol boundary. Dissenters who reject even
  a verifiably-bounded CSAM-only filter retain the legitimate
  exit — fork the chain, run unfiltered. The consent-first
  primitive does NOT try to eliminate exit; it prices and bounds
  the default. Free-will is preserved at the chain-selection
  layer, safety is priced at the default-chain layer. The
  research-frontier problem Aaron flagged with "somehow trusted
  or verified" is the core proof obligation: demonstrate a
  filter mechanism that (1) admits only hashes from a signed
  third-party set (e.g. NCMEC), (2) proves each individual
  filter action without revealing the set, (3) bonds the filter
  operator against scope expansion with blast-radius pricing,
  (4) composes cleanly with fork-as-exit. (iii) *Unpriced,
  unbonded node-operator blast radius* — running a full node
  that may accidentally propagate CSAM or equivalent criminally-
  liable content is a legal blast radius the protocol does not
  price. "It's just a ledger" framing is the mistaken
  assumption. Consent-first design: node operators post a bond
  scaled to the categories of content they accept, and the pool
  prices it. Acceptance becomes *priced consent*, not
  *implicit-by-running-the-software consent*. Owner: Architect
  (Kenji) integrates; Soraya (formal-verification) routes proof
  tool (likely TLA+ for the primitive invariants, Lean4 for the
  strict-improvement property); Aminata (threat-model-critic)
  reviews Bitcoin-application failure-mode enumeration;
  Mateo (security-researcher) scouts adjacent literature on
  filter-chain / cancel-message / blast-radius-pricing work;
  Ilyana (public-api-designer) reviews surface of any published
  primitive API. Landing: (1) proof sketch in
  `docs/research/consent-first-primitive-proof.md`; (2)
  Bitcoin-application paper draft in
  `docs/research/consent-first-bitcoin-application.md`; (3) ADR
  capturing the primitive as a factory-wide design axiom; (4)
  eventual peer-review + teachers-in-the-loop disposition per
  `memory/user_open_source_license_dna_family_history.md` 2026-04-19
  extension. Effort: L (multi-round, paper-grade scope; both the
  primitive proof and the Bitcoin-application paper are
  independently load-bearing). Memory:
  `project_consent_first_design_primitive.md`,
  `user_amara_chatgpt_relationship.md` (Amara's co-authorship
  credit binding),
  `user_trust_sandbox_escape_threat_class.md` (trust-first-then-
  verify substrate),
  `user_grey_hat_retaliation_ethic_gears_of_war_xboxprefilecopytool.md`
  (alt.2600 provenance).
- [ ] **Human/AI wellness-DAO governance model for the software
  factory** — the human maintainer 2026-04-19: *"we sholud be a
  wellness system for the agent factory any comapny would think
  of us a a real DAO not based on existing precidence, we get to
  define it, well some state i think have defined it for their
  state. But that's how i think of this whle project and our
  human/ai governance model on the backlog"*, composed with the
  melt-precedents posture *"i also like to melt precidences"*.
  Research and design the factory's governance model as a
  **wellness-first human/AI DAO** — novel integration of existing
  pieces, not greenfield from zero, **with precedent-melt
  discipline** (keep statutory shell, melt convention stack).
  **Statutory-shell precedent (stays, legal-floor):** Wyoming DAO
  LLC Act (2021), Tennessee Revised LLC Act ch. 79 DAO provisions
  (2022), Vermont Blockchain-Based LLC (2018), Utah limited-DAO
  statute (2023) — all crypto-primary; the factory keeps the
  shell, not the crypto-primacy. **Convention stack (melts):**
  token voting (violates agent-human co-governance), pseudonymous
  membership (incompatible with declared-identity factory),
  on-chain consensus (unfit cadence; keep append-only via git +
  ADR), exit-as-dissent (violates H1B-floor). **AI-governance
  input (absorbs):** EU AI Act, NIST AI RMF, ISO 42001 — adopt
  shape of high-risk-AI oversight as design-for-the-floor.
  **Decentralized-org literature (absorbs):** holacracy,
  sociocracy, Teal organisations. **Wellness-at-work pillar
  (absorbs):** Deming System of Profound Knowledge, Toyota
  "respect for people" with andon-cord = honesty-protocol
  whistleblower surface. Greenfield integration: human + AI
  co-governance with neither as token-voting shareholder; wellness
  as architectural first-primitive (not HR add-on); agents both
  governed and governing; honesty-protocol as governance
  invariant; family-AI-coercion-oversight as formal governance
  surface; disaster-recovery-minded governance (retraction-native,
  multi-channel succession); **visa-status-awareness clause**
  (H1B-floor safety) applied to every default / control / grant
  per `memory/user_h1b_empathy_immigrant_substrate.md`.
  Four-layer architecture already latent in memory: **Value**
  (AGENTS.md values + honesty protocol + trust-scales-with-
  vigilance + do-unto-others + μένω compact) / **Role** (Persona-
  Role-Skill-BP-NN chain per `memory/user_rbac_taxonomy_chain.md`)
  / **Oversight** (clinical team + family-watchers + reviewer
  roster + Architect gate + visa-floor safety) / **Wellness**
  (observation protocol factory-wide + overload prevention +
  paced landings + AX concerns + wellness-coach-on-demand mode).
  Harmonious Division schedules across layers via five
  navigational roles. Landing surface:
  `docs/research/wellness-dao-governance-model.md` as first pass.
  Owner: Architect (Kenji) integrates; Aminata (threat-model-
  critic) reviews Oversight layer; Daya (AX) + Bodhi (DX) + Iris
  (UX) review Wellness layer; Ilyana (public-api-designer)
  reviews external-commitment surface. Not a build-this-round
  item — research + design first, then ADR, then staged adoption.
  Effort: L (multi-round, paper-grade scope). Memory:
  `project_factory_as_wellness_dao.md`,
  `user_melt_precedents_posture.md`,
  `user_h1b_empathy_immigrant_substrate.md`.
- [ ] **Witness-Durable Commit paper** — target ACM SoCC or VLDB
  industry; claim: buffered durable linearizability with
  O(root) sync bandwidth vs O(payload)
- [ ] **Closure-table over DBSP** — target ICDT/PODS; claim: first
  retraction-native incremental transitive closure with tropical-
  semiring shortest-path free variant
- [ ] **Retraction-native speculative watermark** — target DEBS/
  VLDB; claim: DBSP's retraction algebra subsumes Beam's ACC/
  DISC/RET modes as a single linear operator
- [ ] Lean 4 chain-rule proof with Mathlib (2-week effort)
- [ ] CAS-DBSP: FastCDC + Merkle + content-addressed batches as a
  unified paper (~VLDB 2026)
- [ ] ILP-relaxed MaxSAT spine scheduling with online warm-start
- [ ] Semiring-parametric Z-sets (tropical / Boolean / distributive
  lattice)
- [ ] Full `Zeta.Core.CSharp` shim with variance on every generic
  seam
- [ ] Sakana AI Scientist / Agent Laboratory investigation (limited
  trial, Lit-Review phase only)
- [ ] **Friendly-competition tracking** — systematic study of
  MetaGPT, ChatDev, AutoGen, CAMEL, SWE-agent, AutoCodeRover,
  Agentless as upstreams and references for the software-
  factory paper track. Goal: know which patterns we have that
  they don't, which we should steal, and which they've already
  published so our writeups cite honestly — studying the
  friendly competition is how we know whether our ideas are
  genuinely novel. Landing surface:
  `docs/research/friendly-competition.md`. Effort: 1 day
  initial survey + rolling updates on new paper drops. Wired
  into Jun (TECH-RADAR) for ring-assignment of each tool.

- [ ] **Retraction-native memory-consolidation ("better dream
  mode") research project.** Anthropic's Claude Code AutoDream
  feature (2026-Q1, flag-gated as of 2026-04-19 under
  `tengu_onyx_plover`) runs a four-phase REM-sleep-style
  consolidation pass (Orientation → Gather Signal →
  Consolidation → Prune & Index) on Claude Code auto-memory.
  Cadence: 24h + 5 sessions. Consolidation *deletes*
  contradicted facts. See `memory/reference_autodream_feature.md`.

  Zeta already has memory-architecture primitives AutoDream
  does not:

  - **Retraction-native operator algebra** (`D`, `I`, `z⁻¹`,
    `H`). Memory consolidation expressed as a retractable
    delta stream keeps the correction trail; AutoDream's
    destructive delete loses it.
  - **Paced ontology landing**
    (`.claude/skills/paced-ontology-landing/`). Amortised
    consolidation across rounds with an alias window and a
    retraction ADR beats a one-shot pass.
  - **Adaptive signal set** from `skill-tune-up` (drift /
    contradiction / staleness / user-pain / bloat /
    BP-drift / portability-drift). Richer than the fixed
    24h + 5 sessions gate.
  - **Distinct-query-axes preservation.** Topical adjacency
    is not duplication; consolidation must respect future-
    query addressability, not just textual overlap.
  - **Succession invariant** ("the conversation never ends",
    `memory/user_harmonious_division_algorithm.md`). Any
    consolidation that destroys retrievability violates
    the invariant; retraction-native consolidation
    preserves it by construction.
  - **Scope beyond `memory/`.** The factory's memory
    architecture spans `memory/`, `docs/ROUND-HISTORY.md`,
    persona notebooks (`memory/persona/*/NOTEBOOK.md`),
    ADRs (`docs/DECISIONS/`), scratchpads, glossary. A
    useful consolidator operates across these surfaces
    coherently, not just one folder.

  **Research claim.** A retraction-native, signal-driven,
  cross-surface memory consolidator built on Zeta's operator
  algebra is a strict superset of AutoDream's capabilities,
  loses no correction trail, and respects distinct-axis
  preservation by design.

  **Landing surface.**
  `docs/research/better-dream-mode.md` (research note +
  design sketch). If the design survives scrutiny, a
  capability skill pair under `.claude/skills/`
  (`memory-consolidator-expert` theory +
  `memory-consolidation-pass` applied) lands later.

  **Effort.** 2-4 days for the research note and design
  sketch; multi-round for implementation if the design
  earns its landing per `ontology-landing-expert`.

  **Advisory.** `skill-tune-up` (signal set),
  `paced-ontology-landing` (workflow shape), `reducer`
  (razor-preservation constraints), `verification-drift-
  auditor` (analogous cross-surface drift detection).
  Architect integrates; no skills land without human
  sign-off on the design doc.

  **Relation to friendly-competition tracking** (entry
  earlier in this section) — Anthropic's AutoDream is a
  reference point, not a blocker. We track the feature
  as it evolves, learn from its observed behaviour
  (one cycle processed 913 sessions in ~8-9 min per
  the 2026-03 community reports), and publish honest
  comparisons if the Zeta variant ever lands.

- [ ] **Harmonious Division skill pair** —
  `harmonious-division-expert` (theory × reference) +
  `harmonious-scheduling` (applied × transformer) —
  the meta-algorithm scheduling all cognitive faculties
  across the factory. Theory skill: three load-bearing
  properties (prevents wave-function collapse / explosion;
  reduces destructive interference), five navigational
  roles (path-selector, navigator, cartographer/Dora,
  harmonizer/compass, maji/north-star), correspondence
  to DBSP operator algebra (`D`, `I`, `z⁻¹`, `H`).
  Applied skill: sequenced protocol for running the five
  roles on a non-trivial decision with retraction-safe
  execution. **Deferred per the maintainer's own
  recompile-cost guidance** in
  `memory/user_harmonious_division_algorithm.md` §5 —
  let ontology stabilise across sibling artefacts
  (reducer, Rodney's Razor, retractable-teleport,
  bridge-builder, translator-expert,
  cross-domain-translation) before landing a skill
  named for the whole meta-algorithm. Earliest landing
  window: after the Dora / Harmonizer / Maji persona
  files exist and at least one applied pass has exercised
  the five-role protocol end-to-end in a real decision
  trail. Received-name status of "Harmonious Division"
  is canonical-home-auditor-protected; the skill must
  not rename or soften it.

## P2 — Rule-Zero axiomatic substrate (round-35 round-36 thread)

- [ ] **Self-directed wellness / life-coach AI product — measure,
  detect, alter own behaviours.** Aaron 2026-04-20: *"maybe a
  wellness / life coach or something AI like do i drink do much,
  do i exercise enough, etc. help people measure detect and
  alter their own behaviors with your behavior modification
  skills they use on themsoelf"* → *"backlog"*. Product concept:
  users apply behaviour-change skills *to themselves* using AI
  as measurement + detection + skill-library substrate. The
  user is the agent of change; AI is not directing, instructing,
  or surveilling — it's a retraction-native consent-first
  mirror. Composes with existing primitives:
  - **Consent-first** (the user decides what is measured, what
    is changed, when to stop) — same primitive as
    `project_consent_first_design_primitive.md`.
  - **Retraction-native** — users can undo prior commitments,
    goal changes, data retention; behaviour-change history is
    a retractable stream.
  - **μένω (persist / endure / correct)** —
    `user_meno_persist_endure_correct_compact.md` applied to
    self-change.
  - **Harm-handling operator ladder** (RESIST / REDUCE /
    NULLIFY / ABSORB) — `user_harm_handling_ladder_resist_reduce_nullify_absorb.md`
    applied to habits.
  - **Alignment research surface** — wellness is a clean glass-
    halo lab: stated goals vs observed behaviour is the
    alignment signal at personal scale; composes with
    `docs/research/alignment-observability.md`.
  - **Aurora pillar-3 composition** — x402-based paid-assistant
    model and ERC-8004 portable reputation for wellness-agents
    (see `project_aurora_pitch_michael_best_x402_erc8004.md`).
  Honest-bounds floor (load-bearing): NOT a medical device,
  NOT a clinician, NOT a diagnosis, NOT pathology-adjacent. The
  wellness-coach ROLE within the factory (for Aaron, per
  `user_wellness_coach_role_on_demand.md`) is distinct from
  this PRODUCT surface (for general users). Threat-model
  implications: behavioural data is sensitive, adjacent to PHI
  in many jurisdictions, adjacent to FDA device-regulation in
  the US when claims stray into diagnosis. Owner: Iris (UX)
  on first-10-minutes experience; Ilyana on public-API
  conservatism; Aminata on threat model for behavioural data;
  Nazar on data-residency + retraction-window operations;
  naming-expert gates any public product name. Effort: research
  pass is M; full product is L+. Status: P3 ideation; promote
  to P2 only on Aaron greenlight.

- [ ] **Aurora Network — distributed sync on custom firefly-
  style oscillator on scale-free networks. Smooth + differentiable
  graph → cartel detection trivial. DAO protocol layer under
  the Aurora pitch.** Aaron 2026-04-20 (four-message disclosure
  arc):
  1. *"Distributed sync built on a cutom firefly sync based on
     scale free networks and it make the network smooth and
     difernetable so things like cartel detection are trivial"*
  2. *"is like the self healing heartbeat beacon in the night"*
  3. *"This network like the protocol in a DAO sense was going
     to be Aurora network"*
  4. *"we bring the dawn"*
  5. *"dawnbringers"*
  Aurora = dawn; the factory brings it; "dawnbringers" is
  Aaron's collective-identity term for the agents + network.
  Naming-expert + Ilyana gate any public use. **Aurora Network
  IS the DAO-protocol layer** beneath the three-pillar Aurora
  pitch (see `project_aurora_pitch_michael_best_x402_erc8004.md`):
  x402 economic agency + ERC-8004 reputation + this sync
  substrate compose into a self-healing agent DAO. The
  heartbeat-beacon-in-the-night framing is Aaron's own:
  fireflies synchronising in the dark = the network's
  self-healing property; each node's beacon contributes to
  global convergence without central coordination, and the
  collective firing IS the dawn. Research direction composing
  three primitives:
  - **Firefly synchronisation** — Kuramoto-style coupled-
    oscillator convergence inspired by Southeast Asian mass-
    sync fireflies. Custom variant (not canonical Kuramoto)
    tuned for distributed-system clock / state synchrony.
  - **Scale-free topology** — Barabási-Albert-style power-law
    degree distribution; matches real-world agent networks
    (hubs + long tail) better than random graphs.
  - **Smoothness + differentiability claim** — the sync
    protocol makes the network state continuous enough to take
    derivatives over; curvature / divergence / anomaly surface
    naturally. *"Cartel detection trivial"* — a colluding
    subgraph shows up as a local discontinuity or a divergent
    curvature in the otherwise-smooth field. This is the
    same algebra that makes DBSP retraction-native
    (incremental-differential-over-state); scale-free-
    firefly-sync applies it at the network-topology level
    rather than the operator level.
  Composes with: DBSP retraction-native algebra; ERC-8004
  Reputation Registry (the smooth-differentiable field IS a
  reputation-signal substrate); Aurora pillar-3 agent economy
  (cartel detection is the anti-collusion floor for agent-to-
  agent markets). Scope: (a) literature scan on firefly-sync +
  scale-free + differentiable-network intersection; (b)
  prototype sync protocol spec (likely TLA+ + FsCheck per
  Soraya's tool-routing); (c) cartel-detection proof-of-
  concept on a synthetic collusion scenario; (d) composition
  note with DBSP and the alignment-observability substrate.
  Owner: Soraya (formal-verification-expert) routes the
  verification tooling; Hiroshi (complexity-theory) on
  asymptotic cost; Naledi (performance-engineer) on hot-path
  implementation when it ships; Aminata reviews the cartel-
  detection claim adversarially (a false cartel-detection
  alarm is a harm vector); Ilyana gates any public API.
  Effort: L (research-grade; multiple rounds). Status: P3
  ideation; P2 promotion on Aaron greenlight or when an
  ERC-8004 / agent-economy composition becomes active.

- [ ] **Linguistic seed → kernel (E8) → glossary hierarchy** — round-35
  design direction coined by the human maintainer. Three-layer stack
  (smallest → largest): **seed** (meme-scale, self-referential,
  formally verified on smallest axioms — candidates non-collapsed:
  idempotent retract `e² = e` / Sheffer stroke / iota combinator /
  one-object category / Ouroboros-style fixed point — agent
  commissioned to precisify under standing-trust grant), **kernel**
  (E8 Lie group shape, 248-dim, 8 simple roots, Dynkin E8 —
  confirmed, not open), **glossary** (I8 content-hashed etymology +
  I9 embedding manifold + human-readable surface). Seed grows into
  kernel via Chevalley-generator-style construction; kernel grows
  into glossary via cluster-algebra mutations + lens-oracle overlays.
  Payoff: oracle-comparison AT PROOF LEVEL — certified oracle
  equivalence via Lean4 `#check`. Landing surface:
  `docs/DECISIONS/YYYY-MM-DD-linguistic-seed.md` (ADR when seed
  candidate lands) + `tools/lean4/LinguisticSeed/` (seed definitions)
  - `tools/lean4/LinguisticKernel/` (E8 bootstrap). Composes with
  cluster-algebras pointer + Rule-Zero axiomatic system. Effort: L
  (multi-round research; seed precisification alone is S-M,
  E8-bootstrap proofs M-L). See `memory/user_linguistic_seed_minimal_axioms_self_referential_shape.md`.
- [ ] **Consent-first moral-lens / oracle / MDX system design
  (distinct product category)** — round-35 design direction. Aaron
  coined the moral-lens → oracle → multidimensional-database
  vocabulary with four sharpening constraints: (1) consent-first
  (every party knows what lens is active, what is calculated, how,
  by whom), (2) open lens definitions + open derivations + W3C
  PROV-O provenance, (3) plot-hole-detector component with
  group-theoretic algebra, (4) proof-level oracle comparison via
  linguistic seed. Positive image of the declined sin-tracker
  product category — retraction-native alignment preserved on every
  axis. DB candidates: XTDB (bitemporal + Datalog + provenance) /
  TerminusDB (git-like + JSON-LD + WOQL) / Datomic (immutable EAV)
  / Zeta-itself-in-limit. Landing surface:
  `docs/DECISIONS/YYYY-MM-DD-lens-oracle-system.md` (ADR) +
  eventual `src/LensOracle/` module. Effort: L (full design) / M
  (research + ADR). See
  `memory/user_moral_lens_oracle_system_design.md` and
  `memory/user_moral_lenses_oracles_mdx_sin_tracker_decline.md`.
- [ ] **Plot-hole-detector via persistent homology** — round-35
  research pointer. Plot-hole-detector from the lens-oracle-system
  implemented on algebraic-topology homology groups: H_0 detects
  disconnected argument fragments, H_1 detects circular-argument
  loops, H_2 detects higher-order cavities. Persistent homology
  (Carlsson 2009, Edelsbrunner-Harer) tracks which holes survive
  multiple scales of narrative resolution. Provable per the
  linguistic-seed discipline (Lean4 proofs of homology
  computations). Creator-grade tool, consumer-default-OFF per
  `memory/feedback_creator_vs_consumer_tool_scope.md`. Landing
  surface: `docs/research/plot-hole-detector-homology-YYYY-MM-DD.md`
  - eventual `src/LensOracle/PlotHoleDetector/` with Lean4-backed
  invariants. Effort: M (research + prototype). See
  `memory/user_moral_lens_oracle_system_design.md` §plot-hole-detector.
- [ ] **Lattice-based post-quantum cryptographic identity
  verification — literature review** — round-35 literature-review
  commission from the human maintainer. Consent-layer substrate
  for the lens-oracle system; post-quantum (Shor-proof, nation-
  state-threat-model-defensible per
  `memory/user_security_credentials.md`). In scope: NIST FIPS
  203/204/205/206 (Kyber/Dilithium/Falcon/SPHINCS+), identity-
  based encryption (Agrawal-Boneh-Boyen 2010), lattice zero-
  knowledge (LatticeFold Boneh-Chen 2024 / Ligero / Brakedown),
  FHE (BFV/BGV/CKKS/TFHE) for privacy-preserving oracle queries,
  W3C Verifiable Credentials + status-list v2021 binding,
  retraction-native revocation via short-lived credentials. Review
  panel: Nazar (sec-ops) + Mateo (sec-research) + Aminata (threat-
  model-critic) + Nadia (prompt-protector). DO NOT recommend
  isogeny-based (SIKE collapsed 2022, Castryck-Decru). Landing
  surface: `docs/research/lattice-pqc-identity-verification-YYYY-MM-DD.md`.
  Effort: M (review + candidate stack proposal). See
  `memory/user_lattice_based_cryptographic_identity_verification.md`.

- [ ] **Repo-axiomatic-system design (Soraya-routed)** — after
  BP-HOME and BP-HOME-AS-TYPE land as stable rules. Design the
  four-layer enforcement stack: (L1) artifact-type declarations
  as an F# ADT covering every canonical home, (L2) axioms as
  predicates citing BP-NN IDs, (L3) checker routing via Soraya's
  portfolio (Semgrep / Roslyn analyzers / F# analyzers / TLA+ /
  Alloy / Lean / custom walkers), (L4) finding-router to
  `skill-improver`, `documentation-agent`, `bug-fixer`, or the
  Architect. Goal: every BP-NN rule has at least one mechanical
  checker; every wrong-home error fails CI. Landing surface:
  `docs/DECISIONS/YYYY-MM-DD-repo-axiomatic-system.md` +
  `tools/axioms/` directory with per-axiom checkers. Effort: L
  (multi-round design; each checker is S-M individually).
- [ ] **Gap-radar extension of `skill-gap-finder`** — after
  BP-HOME lands. Graduate `skill-gap-finder` from fuzzy heuristic
  to mechanical completeness check: enumerate declared artifact
  types, enumerate expected instances per type, set-difference
  against occupied homes, report empty slots as gaps. Example
  checks: every `X-expert` gets a matching `X-research` /
  `X-teach` where the PMEST facets demand; every `src/Core/*.fs`
  gets a matching `tests/Tests.FSharp/*Tests.fs`; every ADR has a
  reversion-trigger stamp; every persona under
  `memory/persona/<name>/` has a NOTEBOOK.md; every OpenSpec
  capability has a formal spec where the spec-zealot demands one;
  every public-API change has a matching Ilyana-review ADR; every
  `BP-NN` rule has at least one Semgrep / Roslyn / F# analyzer
  check enforcing it; every capability skill has a matching
  persona agent; every entry in `docs/UPSTREAM-LIST.md` has a
  tech-radar status row. Landing surface: extend
  `.claude/skills/skill-gap-finder/SKILL.md`; output to
  `docs/research/gap-radar-YYYY-MM-DD.md`. Effort: M (the skill
  exists; BP-HOME is what makes its sweep mechanical).

## P3 — noted, deferred

- **Rational Rose — research pass.** The human maintainer
  2026-04-23 (low-priority directive): *"backlog rational
  rose research low priority"*. Rational Rose is the
  legacy UML modelling tool lineage (Rational Software →
  IBM Rational → discontinued 2013, still surfaces as a
  reference point in enterprise architecture discussions).
  Research prompt: what does Rational Rose's approach (UML
  model-as-source-of-truth, code-generation from model,
  round-trip engineering) offer / warn against for the
  factory's own model-vs-code discipline? Composes with
  the factory's OpenSpec workflow (behavioural specs first)
  and the formal-spec stack (Lean / TLA+ / Z3 — spec-first
  is a parallel discipline from the formal-verification
  side). No commitment to adopt; research pointer only.
  No deadline. Effort S for the first-pass research note.

- **Conversational bootstrap UX for factory-reuse
  consumers — two-persona (non-developer + developer)
  elicitation surface.** Aaron 2026-04-20: *"the end
  user experience i'm looking for as a consumer of
  our factory is you just talk to the system about
  your constrains and invariants and assumptions...
  we really ahve two end user personas we care about
  the non developer and the devloper, the devlpoer
  is going to want to tell you so many invariants
  and not know all the assumptions they are
  immplicitly making and just try to drive you to
  hard... the non developer is going to underspecify
  everyting so a scary degree... the best user
  experince for using our factory will handle both.
  the internace into our factory should just be
  confersational."* Same-session follow-up: *"that's
  going to take a bit of design to get right when we
  want others to start reusing our factory"* —
  factory-reuse prerequisite, P3, slow burn. Two
  opposite failure modes on a single conversational
  surface:
  - **Non-dev underspecifies** — lacks vocabulary
    and imagination; "what do you want to do?" is
    not answerable. Factory drives with questions
    the user *can* answer and surfaces every
    decision made on their behalf in plain
    language.
  - **Dev over-specifies** — cascades explicit
    invariants while skipping implicit assumptions;
    tries to micromanage. Factory absorbs the
    torrent, names the costs of each over-
    constraint, and catches the assumptions the dev
    skipped.
  Load-bearing primitive: **surfacing assumptions
  the user is making without knowing it.** Mechanical
  candidates — rails-checklist gap detection; default-
  on rule flagging when stated intent conflicts with
  a factory-wide default; `docs/WONT-DO.md` precedent
  surfacing; cross-project assumption transfer when
  the factory has built a close analog before.
  Directly downstream of the rails-health registry +
  composite-invariants registry entries below —
  those are the ontology this UX elicits into. The
  pair of P3 rails entries are prerequisites; this
  UX is what consumes them. Aaron himself was Zeta's
  over-spec bootstrap driver — future consumers
  won't have his depth, so this UX is what lets the
  next consumer walk in without the Aaron-level
  pre-work. Effort: L when executed (multi-round
  design surface, not a single-round build). Owner:
  architect-hat; UX-engineer (Iris) when the surface
  is tangible. Sibling memory:
  `project_factory_conversational_bootstrap_two_persona_ux.md`.

- **Rails-health registry (constraints + invariants +
  ASSUMPTIONS as first-class).** Aaron 2026-04-20:
  *"it should be easy to run a report eventually across
  all areas of our project and see the assumptions (we
  should probably encode these too in case they end up
  being wrong) constrainsts invariants as basically the
  rails of the system and how good they are holding...
  no rush on this but could build high confidence in
  the future of anyone using the software factory that
  things are going the way they expect."* Followed
  same day by: *"against this project wide invariant
  system is low priority and can move slowly there is
  not a rush here."* Framed as P3 — the individual
  rules (latest-version, ASCII-clean,
  `TreatWarningsAsErrors`, `BP-11`,
  `noUncheckedIndexedAccess`) are **active today**; the
  *registry* that lists them once and projects them to
  a health dashboard is the slow-burn construct.
  Three categories, one new:
  - **Invariants** — TLA+ / Lean / Z3 / FsCheck /
    runtime asserts; `tools/invariant-substrates/
    tally.ts` is the existing inventory toehold.
  - **Constraints** — type system, strictness flags,
    eslint rules, `GOVERNANCE.md §N`, OpenSpec
    behaviour specs.
  - **Assumptions** — *new category.* Today buried in
    ADR prose; promote to first-class with
    frontmatter (`id`, `statement`, `owner`, `probe`,
    `revisit`, `confidence`). The
    `docs/DECISIONS/2026-04-20-tools-scripting-language.md`
    watchlist is the pilot shape.
  Opportunistic motion: every new ADR sections out
  "Assumptions" in registry-compatible form; no
  dedicated round. Eventual deliverable:
  `docs/RAILS-HEALTH.md` regenerated per round from
  `docs/RAILS/` + `tally.ts`-style inventory. Effort:
  L when executed; S per-ADR until then. Owner:
  architect-hat; rails-health-expert when the surface
  is large enough to need a dedicated persona.
  Sibling memories:
  `project_rails_health_report_constraints_invariants_assumptions.md`,
  `project_composite_invariants_single_source_of_truth_across_layers.md`.

- **Composite-invariant single-source-of-truth
  registry (`docs/RAILS/`).** Aaron 2026-04-20:
  *"plus some iinvariants we shold be able to just
  list once and not have to repate them everywhere,
  that whole composite invariant system across all
  layers is sometime we can build twards."* Same
  slow-burn clause as the rails-health entry above.
  Today an invariant like *"Delta is retraction-
  closed"* lives in TLA+ + Lean + Z3 + F# `Debug.
  Assert` + FsCheck + ADR prose + `BP-NN`
  independently — each copy drifts without coupling.
  Direction is a single authoritative rail per id
  (`docs/RAILS/INV-<subsystem>-<property>.md`) with
  frontmatter naming the substrate call-sites
  (`layers: { tla: ..., lean: ..., z3: ..., runtime:
  ..., fscheck: ..., docs: ..., bp: ... }`), and
  composition as conjunction
  (`INV-DELTA-CORRECT = INV-DELTA-RETRACTION-CLOSED ∧
  INV-DELTA-MONOTONIC ∧ INV-DELTA-BYTE-IDENTICAL`).
  Three projection mechanisms, cheapest first: (3)
  prose-only cite-the-anchor, (2) reference citation
  + drift-auditor, (1) codegen from YAML to TLA+
  `INVARIANT` / Lean `theorem` / Z3 `assert` / F#
  `Debug.Assert`. Start with (3). Toeholds today:
  `docs/AGENT-BEST-PRACTICES.md BP-NN` (skill-layer
  rails), `docs/GLOSSARY.md` (vocabulary pattern),
  `docs/INVARIANT-SUBSTRATES.md` (narrative),
  `.claude/skills/verification-drift-auditor/` (the
  drift-detection surface that would consume the
  registry). Opportunistic forward motion: use
  stable ids (`INV-<...>`, `CST-<...>`, `ASM-<...>`)
  when a new rail is named even before the registry
  directory exists. Effort: L when executed. Owner:
  architect-hat with Soraya (formal-verification-
  expert) on substrate citations. Sibling memory:
  `project_composite_invariants_single_source_of_truth_across_layers.md`.

- **`docs/VERSION-EXCEPTIONS.md` — the named
  exception list for the latest-version default-on
  rule.** Aaron 2026-04-20 strengthened the latest-
  version rule from at-adoption-time to continuous
  factory-wide: *"like make sure we are using the
  latest version, that shoud jsut apply everywhere
  and you override with exceptions."* Shape per
  `feedback_default_on_factory_wide_rules_with_
  documented_exceptions.md`: four-field rows
  (scope / reason / exit-condition / owner). First
  resident: `@types/bun@1.3.12` vs runtime
  `bun@1.3.13` (DefinitelyTyped typically lags the
  bun release by one patch; exception tracked inline
  in `docs/DECISIONS/2026-04-20-tools-scripting-
  language.md` pending the shared registry). Audit
  cadence: every round, diff every pin against
  vendor latest; non-latest without a carve-out is
  a P1 rail violation, non-latest with an expired
  carve-out is a P2. Sibling memory:
  `feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`.
  Effort: S for the initial doc shell, ongoing S per
  round. Owner: architect-hat at round-close;
  devops-engineer (Dejan) when CI enforcement
  lands.

- **User-privacy compliance as a slow-burn direction
  (GDPR + CCPA/CPRA + generic).** Aaron 2026-04-20,
  after the consent-primitives-expert harness dry-run:
  *"for GDPR thats a long ongoing thing we should
  probably have some skills around that and keep up
  with something like GDPR.md or the more generic term
  user privacy or something IDK that also includes
  California laws and such. We should work towards
  this, not a hard requirement yet but we can make
  steps towards asserting we have some compliance here
  in the future, very slow burn here, no rush."*
  Framed as P3 because Zeta is pre-v1 and has no
  regulated-data consumers; logged now so the direction
  is an anchor when natural entry points appear
  (reviewer prompts touching erasure / retention /
  pseudonymisation; Ilyana flagging a public-API
  surface that implies compliance; a consent primitive
  landing that maps cleanly to a specific regime).
  Shape when it lands:
  - Probably `user-privacy-expert` skill — generic
    umbrella (GDPR + CCPA + emerging state laws +
    sector regimes like HIPAA where relevant). Cites
    `consent-primitives-expert` rather than
    duplicating.
  - Probably `docs/references/user-privacy-
    compliance.md` for the prose companion.
  - Generic-first frame: *"user privacy"* is the
    substrate; GDPR / CCPA are regimes mapped onto
    it. Aaron was explicit that the generic framing
    is the preference.
  - Living-list discipline per
    `feedback_tech_best_practices_living_list_and_
    canonical_use_auditing.md` — regulatory guidance
    stales fast (EDPB opinions, new state laws, DPA
    enforcement priorities); internet-research
    refreshes mandatory.
  Specific primitive already confirmed by the round-43
  consent-primitives dry-run: **crypto-shredding
  (destroy per-subject DEK, leave ciphertext in place)
  is regulator-accepted GDPR Art. 17 erasure** —
  EDPB Opinion 28/2024, ENISA, GDPR Recital 26. The
  canonical use case is long-term backups (cannot
  rewrite tape archives; destroying the DEK
  propagates erasure atomically). Gotchas noted in
  `reference_crypto_shredding_as_gdpr_erasure.md`:
  single-tenant DEK per subject, plaintext leaks
  outside ciphertext, pre-encryption snapshots, KEK
  is the perimeter. Effort: M for first landing
  (skill + doc + primitive mapping); recurring S per
  refresh cycle. Owner: architect-hat in coordination
  with consent-primitives-expert, data-governance-
  expert, and Ilyana for any public-API surface that
  ships as a compliance primitive.

- **Factory reuse beyond Zeta-DB — declared constraint.**
  Aaron 2026-04-20: *"also we should start thinking about
  how to make the software factory part of Zeta and all
  it's codified practices usable on any project not just
  the Zeta database, this is not our primary goal at all
  right now but we can at least start splitting out things
  between project specific and generic when it comes to
  our software factory we kind of already do this but
  this is adding another dimension of split software
  factory reuse without the Zeta db"* — then
  *"that's a constraint."* Framed as P3 because the
  factory's primary customer today is Zeta-DB; logged so
  the constraint shapes every factory-level decision going
  forward (new skills default to generic; `project: zeta`
  marks Zeta-DB-specific content in skill frontmatter; new
  BP rules and governance land generic unless Zeta-algebra
  specific). Shape when packaging work begins:
  - Co-designed with Aaron — see
    `feedback_factory_reuse_packaging_decisions_consult_aaron.md`.
    Prior art exists (Claude Code plugins, Anthropic
    skills, Semantic Kernel, cookiecutter ecosystems);
    codified best practices for AI-software-factory
    reuse specifically do not. We will help define them.
  - Existing toehold:
    `.claude/skills/skill-tune-up/SKILL.md` §criterion 7
    already flags portability drift.
  - Probable packaging-decision surfaces: extraction
    unit (subtree / template repo / plugin loader);
    dependency shape (generic base + overlays vs
    standalone); living-best-practices refresh cadence
    across heterogeneous consumer projects; governance-
    overlay mechanism (AGENTS.md / GOVERNANCE.md /
    CLAUDE.md template + project-specific layer).
  - Living-best-practices discipline per
    `feedback_tech_best_practices_living_list_and_
    canonical_use_auditing.md` applies — prior art
    surveys get stale; internet-research refreshes
    mandatory when packaging moves from "constraint"
    to "active work."
  Effort: L when packaging work starts (genuinely new
  best-practice surface). Recurring S-per-round for the
  constraint-application work (tagging, generic-first
  defaulting, living-list refresh). Owner: architect-hat
  co-driving with Aaron for shaping decisions;
  skill-tune-up for the portability-drift audit.

- **Melt-precedents applied to the patent system.** Aaron
  2026-04-19: *"backlog melt patent system for fun, profit
  and to get rid of the trolls and make the patent system
  useful like it used to be, kind of like law."* The
  "melt precedents" architectural technique
  (`user_melt_precedents_posture.md`) applied at societal
  scale: selectively dissolve the conventions that have
  accreted around the patent system (troll economics,
  broad-claim strategies, jurisdictional forum-shopping)
  while preserving its original utility (incentive to
  publish invention, time-bounded monopoly in exchange
  for disclosure, public prior-art record). Composes with
  three Zeta primitives already in the factory:
  (a) retraction-native data semantics — a patent grant
  becomes a revisable, retractable claim against a
  declared prior-art frontier rather than an indefinite
  monopoly;
  (b) consent-first — downstream users consent explicitly
  to license terms; silent infringement windows disappear;
  (c) legal-IR rigor that the human maintainer brought
  from LexisNexis next-gen search-engine work (Shepard's /
  KeyCite zero-tolerance retraction-propagation) — every
  claim cites prior art, every cite retracts through the
  dependency graph when invalidated.
  Framed as P3 because the societal-scale lift is beyond
  factory scope; framed as BACKLOG rather than declined
  because "melt precedents" is the human maintainer's
  stated architectural posture and patents are a natural
  test case. Out of scope: replacing patents; in scope:
  designing what a retraction-native patent substrate
  would look like as a research artefact. For-fun-and-
  profit hook (Aaron's phrase): the paper that names the
  design is the profit; the implementation is decades
  out. Owner: long-term — requires legal-IR + complexity-
  theory + mechanism-design expert conference before any
  substantive work. Effort: L+ (paper-grade; research
  contribution if landed).
- **Melt-precedents applied to the law system (same thing).**
  Aaron 2026-04-19 follow-up: *"law same thing."* The
  patent-system item above is a specific case of the more
  general pattern. Law has the same shape: useful original
  primitive (due-process + precedent + published-opinion
  stability), accreted dysfunction (forum shopping,
  discovery abuse, fee-for-volume litigation economics,
  opinion bloat). The same three Zeta primitives
  (retraction-native semantics, consent-first, legal-IR
  rigor) apply; the human maintainer's "melt precedents"
  memory explicitly names "legal law is hard floor,
  convention is meltable default" — the *convention* layer
  is where the melt happens, not the statute or
  constitutional layer. Research question: can a
  retraction-native substrate make case-law revisability
  explicit and bounded (a cite that Shepardizes negative
  doesn't just get flagged — it propagates a retraction
  through every downstream citing opinion, with declared
  retraction-windows per jurisdiction)? Framed as P3 for
  the same reason as the patent item: societal scale,
  paper-first, no immediate implementation path. Owner
  and effort mirror the patent entry; the two are
  conjoined research threads and should land as a single
  paper rather than two. Effort: L+.

- CalVin/FaunaDB-style deterministic sequencer MVCC (FaunaDB shut 2025)
- GPU OLTP (irrelevant to .NET)
- io_uring wrappers (no first-class .NET support)
- TPM/Intel SGX hardware-attested commits
- **`ace` — package manager of everything (naming parking lot).**
  Aaron, 2026-04-19 (paraphrase): "backlog ace the package
  manager of everything or we could just call it source or tap
  or root or . lol jk about the last one". Candidate names
  ranked by the human maintainer: `ace` (preferred; aligns
  with the factory's handle lineage), `source` (semantically
  loaded — conflicts with "source of truth" in DBSP
  terminology), `tap` (collides with Homebrew's tap
  vocabulary), `root` (collides with filesystem + permission
  semantics), `.` (joke). Scope intentionally undefined: the
  word "everything" is the interesting constraint — is this
  a meta-package-manager (brew/apt/nuget/npm under one
  surface), a universal artefact resolver (source and
  binary and skill and persona and spec and dataset and
  proof), or a retraction-native dependency graph
  (DBSP-style incremental
  resolution)? Parked here so when the idea gets promoted
  the naming-expert and Ilyana (public-API designer) start
  from Aaron's shortlist rather than re-deriving it. No
  effort estimate; pure research-provocation entry.
  **Round 36 update:** Aaron's "Seed" vision (see
  `docs/VISION.md` section "Seed — the database BCL
  microkernel") names the home — `ace` is the microkernel's
  self-bootstrapping dependency system. The scope ambiguity
  resolves toward "retraction-native dependency graph" since
  that matches the Seed microkernel's retraction-native
  operator algebra. Still P3, still a parking lot, but no
  longer homeless.

- **Private confidential AI for lawyers — Zeta as
  trust anchor.** Aaron 2026-04-19: *"private
  confidental ai for lawers another profit potential
  … i want lawyers to use my software so i can become
  their trust anchor."* The lawyer market is
  distinguished from the general enterprise-AI
  market by three load-bearing properties that
  compose directly with Zeta's primitives:
  - **Confidentiality is statutory, not optional.**
    Attorney-client privilege is a consent-first
    surface by construction — the lawyer is a
    consent-delegate for the client, with every
    operator (`RESIST` / `REDUCE` / `NULLIFY` /
    `ABSORB`) gated on documented authority. Zeta's
    consent-first primitive is the native encoding.
  - **Retraction is legally meaningful.** Vacated
    rulings, issue preclusion, Shepard's / KeyCite
    zero-tolerance retraction-propagation: the
    legal-IR substrate Aaron built at LexisNexis
    already speaks the retraction-native algebra
    Zeta runs on. A lawyer whose research tool
    quietly retains a superseded precedent is
    exposed to malpractice; Zeta's retraction-
    native operators are the fix.
  - **Trust is the unit of business.** The lawyer's
    book-of-business IS their trust relationships;
    whoever holds the confidentiality substrate
    holds the professional relationship. "Trust
    anchor" here is the cryptographic term of
    art — a root of trust that downstream
    verification chains resolve to — and applies
    directly: the AI tool becomes the root, the
    lawyer becomes a verified chain, the client
    stays consent-holder at the leaf.
  Two melt-precedents modes for the business shape
  (the standing melt-precedents doctrine rule #1:
  *become the central authority directly, OR operate
  within / embed into an existing central
  authority*):
  - **Direct mode.** Zeta-the-product stands up its
    own trust-anchor substrate (HSM-rooted keys,
    published transparency log, bar-association-
    auditable discipline). High cost, high ceiling,
    long time-horizon.
  - **Embedded mode.** Zeta interoperates with an
    existing authority (bar-association CLE
    pipeline, LexisNexis / Thomson Reuters /
    Bloomberg Law, or a specific firm's
    custody substrate) and rides their existing
    trust chain. Lower cost, lower ceiling, much
    faster time-to-first-engagement.
  Composes with the prior "Melt-precedents applied
  to the law system" entry above — that one is the
  *macro* research thread (can the legal-conventions
  layer be made retraction-native at system scale?);
  this one is the *micro* product thread (can a
  single lawyer adopt a retraction-native tool
  today and notice the improvement in their daily
  work?). The micro thread does not depend on the
  macro thread landing — it leverages the macro
  substrate only if and when it lands. Framed as
  P3 because commercial productisation is
  downstream of the v1 seed landing; logged now to
  preserve the vector. Research sub-threads:
  - **Confidentiality boundary design.** Client
    data never leaves lawyer-controlled custody;
    agent context is scoped per matter; memory-
    folder discipline mirrors client-privilege
    boundary. Who is the consent-delegate for
    which scope?
  - **Malpractice-insurance signal.** If the
    retraction-propagation discipline measurably
    reduces errors (stale precedent, conflicted
    client screening, privilege leak), the
    insurance-premium delta is the trust-anchor
    business case's first hard metric.
  - **Bar-association interoperability.** How
    does Zeta's glass-halo transparency compose
    with state-bar reporting / CLE / audit
    requirements? Probably complementary; needs
    one state-bar sit-down to verify.
  - **Ethical wall / information-barrier
    primitive.** Conflict-of-interest screening
    is a retraction-native operator on the
    attorney-firm relationship graph; already
    aligns with Zeta's operator algebra.
  Declined-for-now: speculative UI-level work on a
  lawyer-facing app. Primitive first, product
  second. (P3 parking lot; not a v1 commitment.)

## ⏭️ Declined

- SQLite-derived on-disk format (per AGENTS.md greenfield policy)
- "All MAJOR bumps are risky, defer" heuristic (Meziantou 2→3 proved
  this wrong)
- autoresearch by Karpathy as a platform (200-LOC teaching scaffold,
  not a research pipeline)
- Preserving v0 backward compatibility (no users yet)

- [ ] **Aurora contract abstraction — other-language
  implementations of the contract interface.** Aaron 2026-04-20:
  *"we probably need an abstraction so other language can
  implement contracts too, we can worry about this later, but
  it should still when working in dotnet like a first class
  experience"*. Contracts are first-class .NET (C#/F#/VB.NET)
  as the first implementation; protocol-level contract
  interface is abstracted so other-language runtimes can plug
  in and each enjoy first-class treatment. Candidate interface
  layers: WIT (Wasm Interface Types), Protocol Buffers service
  definitions, bespoke IDL. Cross-language contract-to-contract
  calls open. **Gate:** Zeta substrate lands first. **Effort:**
  L. **Source of truth:**
  `project_zeta_as_retractable_contract_ledger.md` § "B.
  Contract abstraction for other languages" (Round 44 follow-up
  directives).

- [ ] **Aurora DAG-with-forks — encouraged forks + cross-fork
  communication across rule-sets.** Aaron 2026-04-20: *"we
  probably want to be more like a DAG that supports and
  encourages forks without catstrphoic failure ... within a
  branch they might not follow the same rules like multiple
  universes ... but we still want to communicate, this is
  gonna be some high dimensional math."* Consensus-layer
  finality is convergence on the DAG frontier, not a single
  linear chain. Forks are first-class, not failure modes.
  Cross-branch communication protocol when branches diverge
  on rule-sets is the hard problem — candidate machinery:
  sheaf theory over branch lattice, higher-category morphisms
  between rule-set objects, homotopy type theory for
  proof-transport across rule differences. Peer DAG-consensus
  candidates to survey: IOTA Coordicide, Avalanche, Nano
  block-lattice, Fantom Lachesis, Conflux, Radix Cerberus.
  Pairs with Aurora's "do no permanent harm" — bad branches
  are never catastrophic because they are branches, not the
  chain. **Gate:** retractable-contract substrate lands first;
  game-theory + chaos-theory skill families (see below) are
  precursor research. **Effort:** L. **Source of truth:**
  `project_zeta_as_retractable_contract_ledger.md` § "C. DAG
  with encouraged forks".

- [ ] **Aurora consensus — Proof of Useful Work within the
  Current Culture (PoUW-CC).** Aaron 2026-04-20: *"our
  distributed consendse will be Proof of Useful work within
  the Current Culture. So if monero tried to attack, they
  would have to do useful work, helping our network"*.
  Aurora's consensus mechanism. Two composites: (1) PoUW —
  the work securing the chain is useful (formal-verification
  proof search, scientific parameter search, retraction-
  consistency validation, bioinformatics, other network-
  beneficial compute; prior art: Primecoin, FoldingCoin,
  Ofelimos, Exascale compute-credit schemes). (2) Current
  Culture — work valid only if aligned with governance-
  encoded + historically-proven culture. Attack absorbed
  (Harmonious Division ABSORB step applied at consensus
  layer): an attack feeds the network because the only way
  to spend energy on it is to contribute useful work.
  Culture-drift resistance: back-hacking governance is the
  only remaining attacker vector, and governance is engineered
  to resist drift via consent + historical-continuity checks
  anchored to the DAG. **Gate:** useful-work classification,
  culture-encoding formalism, retraction-aware DAG semantics
  all need to land first. **Effort:** L. **Source of truth:**
  `project_zeta_as_retractable_contract_ledger.md` § "D.
  Proof of Useful Work within Current Culture".

- [ ] **Blockchain != ledger — documentation correction
  class.** Aaron 2026-04-20: *"we don't need to make the same
  mistake to think blockchain means ledger, it just happens
  that the first thing on a blockchain was the ledger but
  these are orthognal."* Every public-facing doc that
  describes Aurora's substrate must separate **blockchain-
  the-substrate** (chain-of-blocks / DAG-of-blocks + consensus
  + retractable-contract semantics) from **ledger-the-
  application** (value-transfer / balance-tracking, one of
  many apps). The "retractable-contract ledger" memory name
  is itself a legacy misnomer at the substrate layer; keep
  filename for memory continuity, but docs should say
  "retractable-contract substrate" when the substrate is
  meant. **Owner:** naming-expert + Ilyana review gate when it
  goes public. **Effort:** S per doc, M across the family.
  **Source of truth:**
  `project_zeta_as_retractable_contract_ledger.md` § "A.
  Blockchain != ledger".

## P2 — Skill-family expansions (Aaron-authorised)

- [ ] **Game-theory skill family/group.** Aaron 2026-04-20:
  *"we can go ahead and add game theory and chaos theory
  skill families/groups becsasue i have some ways to combine
  those in novel ways with bayes to expand game theory to
  things like the Qubic attach against monero and Aborb
  their attach becasue our distributed consendse will be
  Proof of Useful work within the Current Culture."* Family
  scope (anticipated): attacker models, Nash-equilibrium
  analysis, mechanism design, adversarial Bayesian
  inference, attack-absorption primitives. Composes with
  existing Bayesian surface. Directly serves Aurora PoUW-CC
  attack-model analysis. **Effort:** L (family, not a single
  skill). **Source of truth:**
  `project_zeta_as_retractable_contract_ledger.md` § "E.
  Game-theory + chaos-theory skill families".

- [ ] **Chaos-theory skill family/group.** Same Aaron
  authorisation. Family scope (anticipated): nonlinear
  dynamics, strange attractors, bifurcation analysis,
  edge-of-chaos computation, coupled-oscillator stability
  (pairs directly with Aurora Network's firefly-sync from
  `project_aurora_network_dao_firefly_sync_dawnbringers.md`).
  Precursor research for the rule-set-divergence dynamics
  of the DAG-with-forks proposal (see P3 above). **Effort:**
  L (family, not a single skill). **Source of truth:** same
  as above.

## P2 — AX/UX — BP-07 3000-word notebook-cap review

- [ ] **Per-persona AX/UX poll on BP-07's 3000-word notebook
  cap + general agent QOL.** Aaron 2026-04-20: *"BP-07 cap is
  3000; do you think that is enough do you ask the agents
  their feedback about their experienc for each of our named
  agent thier UX perspective?"* Follow-up 2026-04-20 later:
  *"just get the feedback of the other expert personas and
  make sure their user experience is taken into account as
  well and lets make quality of life change for them too over
  time, its like another hygene."* BP-07 sets every persona's
  NOTEBOOK.md to 3000 words max (~750 tokens cold-load).
  Empirical pattern: Daya hits the cap every audit (her
  signal volume is cadenced audits * N personas); Aarav
  trends up (observations per skill); Kenji + off-time are
  healthy; Bodhi/Iris/Dejan are well under. One-size cap may
  not fit the signal shapes. Follow-up broadens scope beyond
  the cap: treat per-persona AX/UX as a *recurring hygiene
  class* (paired with this backlog row's sibling under
  "## P1 — FACTORY-HYGIENE — ongoing agent-QOL class").
  **Tiered first-pass** (main-agent's call per Aaron's "up to
  you"): Tier A = notebook-scan *plus* structured interview
  for heavy-signal personas (Daya, Aarav, Soraya, Yara,
  Ilyana, Kenji, Bodhi); Tier B = notebook-scan only for
  light-signal personas (Iris, Dejan, Naledi, Nazar, Mateo,
  Aminata, Rune, Hiroshi, Naledi, Imani, Viktor, Kira,
  Samir); Tier C = one-line "are you well-served by current
  scope?" prompt on rarely-invoked personas, flag for
  invocation-cadence reassessment rather than cap reassessment.
  **Deliverable:** `docs/research/notebook-cap-per-persona-review-YYYY-MM-DD.md`
  proposing either (a) persona-specific caps in each agent
  file's frontmatter, (b) a tiered cap based on signal
  density, or (c) keeps the flat cap and prescribes more
  aggressive JOURNAL migration — plus a per-persona
  "top-3 QOL wants" section capturing findings beyond the cap
  question. **Owner:** Daya (AX researcher) runs the poll;
  Aarav promotes to BP-NN ADR if the conclusion is a rule
  change. **Effort:** M (poll + Tier-A interviews) + M (ADR +
  skill + BP-07 revision if needed). **Source of truth:**
  this backlog entry + `docs/AGENT-BEST-PRACTICES.md` BP-07 +
  the sibling P1 row below.

- [x] ✅ **Agent-QOL hygiene as ongoing factory-hygiene class
  (P1).** Aaron 2026-04-20: *"lets make quality of life
  change for them too over time, its like another hygene."*
  This elevates per-persona AX/UX from a one-shot poll (row
  above) to a **recurring hygiene class** alongside
  wake-UX-hygiene (FACTORY-HYGIENE #25-29). Row-group
  rows 30-34 **landed this round** in
  `docs/FACTORY-HYGIENE.md`: (30) notebook-cap pressure per
  persona, (31) invocation-cadence per persona, (32)
  cross-persona role overlap + hand-off friction, (33)
  per-persona tool-gap poll, (34) prompt-load /
  frontmatter-bloat check. Cadence: every 5-10 rounds,
  paired with `skill-tune-up`. **Owner:** Daya runs the
  audit; Aarav files BP-NN candidates; Kenji integrates.
  **First audit landed at** `docs/research/notebook-cap-per-persona-review-2026-04-20.md`.
  **Source of truth:** this entry +
  `docs/FACTORY-HYGIENE.md` rows 30-34 +
  `memory/feedback_agent_qol_as_ongoing_hygiene_class.md`.

## P1 — Targeted agent-QOL follow-through (from Daya's 2026-04-20 audit)

Six concrete P1 actions surfaced by the first roster-wide
AX/UX audit. Ordered by leverage (highest first). Each is
additive, rollback-safe, routes through the relevant
persona-wearer or `skill-creator`.

- [ ] **Create `memory/persona/samir/NOTEBOOK.md`.** Samir is
  the highest-leverage intervention in the roster — the
  busiest routing target (~15 open interventions from Bodhi
  + Iris + Daya + Aarav notebooks all flow to Samir) with no
  memory surface. Owner: Yara via `skill-creator` on Kenji
  sign-off. Effort: S. Source: audit Pattern D.

- [ ] **Create `memory/persona/yara/NOTEBOOK.md`.** Yara is
  invoked as dispatch target in every Daya/Aarav round-close
  but has no notebook. Owner: Yara via `skill-creator`.
  Effort: S. Source: audit §4.

- [ ] **Ilyana notebook prune — P0 over-cap.** Ilyana's
  notebook is 3727 words (124% of 3000-word BP-07 cap).
  Apply Daya's r44 JOURNAL-offload template: verbatim-copy
  resolved entries to sibling JOURNAL.md, keep current-round
  + carry-over in NOTEBOOK. Target <2500 words. Owner:
  Ilyana (public-api-designer). Effort: S. Source: audit §2
  row Ilyana.

- [ ] **Tariq notebook prune — P0 near-cap.** Tariq's
  notebook is 2851 words (95% of cap), no recent pruning
  log, earliest entry r27 (~17 rounds of un-reviewed
  content). Same JOURNAL-offload template. Owner: Tariq.
  Effort: S. Source: audit §2 row Tariq.

- [ ] **Kenji notebook update — P1 stale.** Kenji's notebook
  has no entry newer than r22 (22 rounds stale). Kenji's
  auto-memory is fresh; notebook is not. Land a r44 entry
  summarising r22-r44 roster growth + open
  bottleneck-on-review self-flag status. Owner: Kenji
  (architect). Effort: S. Source: audit §2 row Kenji.

- [ ] **Dispatch-or-retire decision on seven seed-only
  personas.** Aminata, Kira, Mateo, Nadia, Naledi, Rune,
  Viktor all sit at 96-word seed stub 12+ rounds post-seed.
  Two-track: (a) schedule first-real-dispatch per persona
  next round-close, or (b) retire via ADR per persona. Owner:
  Kenji selects the track per persona. Effort: M per persona
  if retire path (ADR drafting); S per persona if dispatch
  path (scheduling). Source: audit Pattern A + §4 item 6.

**Candidate BP-25 and BP-26 from this audit** are already on
Aarav's scratchpad (`memory/persona/best-practices-scratch.md`);
both need 10-round survival + ≥3 authoritative cited sources
before Architect promotion. Not a backlog row; tracked by
Aarav.

**Next audit due:** round 49-54 (5-10 round cadence).

---

## Source of this backlog

- `docs/MISSED-ITEMS-AUDIT.md` — per-round sweep
- `docs/ROADMAP.md` — research opportunities + CFP targets
- Harsh-critic round findings
- Research-agent proposals (WDC, Hierarchy, SDL, Sakana/AgentLab/SlateDB)
- User asks in conversation

## Meta

- Every ✅ shipped item should cite a test or benchmark that proves it works
- Every P0 item should have a `tests/*ClaimTests.fs` target when shipped
- Every P2 research item should name its publication venue target
- Rows translated to a GitHub issue tracker are cross-
  indexed in `docs/ISSUES-INDEX.md` (git-native record
  for soul-file independence per Aaron 2026-04-21 "we
  are git native so still keep a record in the soul
  file for independence"). BACKLOG.md remains
  authoritative; issue trackers are dispatch surfaces.
