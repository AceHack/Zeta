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

- [ ] **Per-entry-point F# DSLs + industry-standard surfaces
  where they exist (HUGE, multi-round).** Aaron Otto-139
  directive: *"we shuld make f# dsl for all these entry
  points and if there are standards like SQL but specific
  to these entry poionts we should support those too,
  backlog"* + Otto-146 clarifier *"i know there are graph
  standards"*. Scope: every primary entry-point surface of
  Zeta gets a first-class F# DSL (computation-expression
  builder + operators) + a compatibility layer for the
  industry-standard query language in its category when one
  exists. Coverage matrix (not exhaustive):
  - **Relational** — F# `query { }` (LINQ-compatible, already
    partial) + SQL-compatible surface (already in roadmap
    via row 733). Standard: **ISO SQL**.
  - **Graph** — F# `graph { }` CE over the Graph substrate
    (`src/Core/Graph.fs`). Standards: **ISO/IEC 39075:2024
    (GQL)** — Graph Query Language, first ISO graph-query
    standard, openCypher lineage; **Cypher** (openCypher,
    Neo4j, Memgraph);
    **Gremlin** (Apache TinkerPop traversal algebra);
    **SPARQL** (W3C, for RDF/linked-data); **Datalog**
    (Souffle, Datomic's Datalog). Pick one primary
    (probably GQL as forward-looking ISO standard; Cypher
    as de-facto lingua franca); make others opt-in
    translation surfaces where tractable.
  - **Temporal / event-stream** — F# `stream { }` CE over
    TemporalCoordinationDetection primitives. Standards:
    **Esper EPL**, **Apache Flink SQL**, **Calcite
    streaming SQL**. Less crystallized than SQL/GQL.
  - **Time-series / signal** — F# `signal { }` CE over the
    signal-processing primitives (FFT, Hilbert, windowing).
    Standards: less uniform — **InfluxDB Flux**, **PromQL**
    (point-query), **KQL** (Azure Kusto), **TQL** (MIT
    time-series query). Worth surveying.
  - **Veridicality / bullshit-detection** — F# `claim { }`
    CE over `Claim<'T>` / `Provenance`. No industry
    standard; Zeta-native surface is appropriate here.
  - **Cartel / network-integrity** — F# `detect { }` CE over
    `Graph.coordinationRiskScore*` / `labelPropagation` /
    cohesion primitives. No industry standard.
  - **KSK (Kinetic Safeguard Kernel) authorization** — F#
    `authorize { }` CE over the k1/k2/k3 tier + revocable-
    budget + multi-party-consent primitives. No industry
    standard; XACML / OPA Rego are adjacent but not fits.
  Design goals: (a) every DSL has tight algebraic
  integration with the substrate it targets (no
  "untyped-string-to-operator" middlemen); (b) retraction-
  native semantics (Otto-73) bubble through the DSL — any
  query is also a retraction subscription; (c) standards
  compatibility is *translation* to Zeta-native, not
  emulation-at-runtime — the parser emits Zeta operator
  algebra. Research sequence: (1) survey standards for each
  surface; (2) decide which get first-class translation;
  (3) design computation-expression builder shape
  per-surface; (4) consolidate cross-cutting features into
  a container-DSL pattern (see next row); (5)
  implementation in graduation cadence per surface.
  Priority P1 post-v1-roadmap; effort L (multi-round, per
  surface). Composes with the "F# DSL reimagining SQL"
  row (P1 SQL-frontend section) and "LINQ integration"
  row (same section) and the "KSK naming definition doc"
  row (P2 research-grade section — title anchors instead
  of brittle line numbers).

- [ ] **F# DSL composition + container-DSL pattern — all Zeta
  DSLs first-class composable.** Aaron Otto-147 directive:
  *"does f# allow dsl composition? if so we should make
  sure all our dsl are first class composable (maybe
  requires a container dsl, IDK, i'm just guessing)"*.
  **Short answer: YES, F# supports DSL composition; Aaron's
  "container DSL" guess is exactly the right pattern name.**
  F# mechanisms that support composition:
  1. **Nested computation expressions** — one CE body can
     contain another (`async { let! x = task { ... } in ... }`
     works with `TaskBuilder.Bind` overloads). Any CE
     builder exposing `Bind : M<'a> -> ('a -> M<'b>) -> M<'b>`
     can accept *other* monadic values via `Bind` overloads.
  2. **`MergeSources` + applicative composition** (F# 5+) —
     combines independent computations within a single
     active computation-expression builder that defines
     compatible `Source` / `MergeSources` members. Enables
     `let! x = g and! y = v and! z = s` where g / v / s
     return values of types the surrounding builder knows
     how to merge. Mixing fundamentally different DSL
     builders (graph + veridicality + signal) in one
     `and!` chain is NOT what MergeSources does — that
     requires the container-DSL pattern in the next row
     (top-level `zeta { }` CE with child-builder
     delegation via its own `Source` overloads).
  3. **Custom operations** (`[<CustomOperation>]`) — the
     keyword-like syntax inside `query { }` / `graph { }`.
     Operations can delegate to child-builder results.
  4. **Builder delegation** — a container builder's `Yield`
     or `Bind` method can accept values from child builders
     and fold them into a container state.
  5. **Implicit yields** (`AllowIntoPattern` +
     `[<CustomOperation(... , IsLikeZip=true)>]`) — lets
     multiple child-builder results flow through container
     combinators without explicit ceremony.
  6. **Prior art proving it works**: FParsec's combinator
     parsers compose across F# code cleanly; Giraffe's HTTP
     handler DSL composes with its response-writing DSL;
     SAFE Stack composes Elmish + Saturn + Feliz DSLs.
  **Container-DSL design for Zeta** (implementation plan):
  - Top-level `zeta { }` container CE with operators:
    - `from graph (g : GraphBuilder)`
    - `from claims (c : VeridicalityBuilder)`
    - `from stream (s : StreamBuilder)`
    - `from signal (s : SignalBuilder)`
    - `from authorize (a : AuthorizeBuilder)`
    - `from detect (d : DetectBuilder)`
    - `project (...)` / `where (...)` / `order by (...)` —
      generic cross-DSL combinators.
  - Each child builder stays usable standalone; `zeta { }`
    composes results via `MergeSources` + folded state.
  - Operator-name collisions resolved by prefix
    disambiguation (`graph.map`, `signal.map`) or by
    builder-scoped shadowing at the nested CE level.
  - Retraction-native semantics preserved: if any child
    surface retracts, the container re-runs downstream
    combinators incrementally (Otto-73 compliance).
  Design questions the research round answers:
  (a) is a single container CE enough, or do we need tiered
  containers (one per domain, e.g. `analysis { }` for
  `graph + claims + signal`, `governance { }` for
  `authorize + detect`)? (b) what is the minimum F#
  language-version floor (5+ for `MergeSources`; 6+ for
  some applicative affordances)? (c) do we expose the
  container as a user-facing surface or only as internal
  plumbing? Aaron's intuition ("maybe requires a container
  dsl") maps to well-established F# patterns — this is a
  tractable design problem, not open research. Priority P1
  post-v1-roadmap; effort M (design) + L (implementation
  across all child DSLs). Composes with the per-entry-point
  DSL row (above) — they land as a paired design.

- [ ] **LINQ-compatible entry points for C# consumers on every
  F# DSL surface.** Aaron Otto-148 directive: *"can we
  linquify in a clever way those entiry points too?
  backlog"*. Scope: every F# DSL from the per-entry-point
  row above gets a matching LINQ-provider / `IQueryable<T>`
  surface so C# consumers (dominant .NET consumer
  population) can use query syntax natively:
  - **Relational** — `IQueryable<T>` + EF Core provider
    (already in roadmap via row 719). Maps directly to
    Zeta operators.
  - **Graph** — `IGraphQueryable<TNode, TEdge>` or
    `IQueryable<GraphResult>` over `Graph<'N>`. Cypher /
    GQL translation on top. Maps graph traversal DSL
    primitives to LINQ method-chain form.
  - **Temporal / event-stream** — `IStreamQueryable<T>`
    over event windows. Reactive Extensions (`IObservable<T>`)
    is adjacent prior art; Rx-LINQ already exists in
    `System.Reactive.Linq`.
  - **Time-series / signal** — `ISignalQueryable<T>` over
    sample sequences.
  - **Veridicality** — `IClaimQueryable<T>` over
    `Claim<T>` sequences with provenance + anti-consensus
    predicates.
  Design goals: (a) clever mapping — use F# computation
  expressions + `query` translator to auto-generate LINQ
  method-chain equivalents where feasible, not hand-written
  mirrors per-surface; (b) SDK-consumer ergonomics — C# gets
  the same power F# does, without F# prerequisite; (c)
  expression-tree preservation — LINQ method chains lower to
  the SAME Zeta operator algebra as the F# DSL, not an
  intermediate C#-flavored algebra (one IR per surface); (d)
  retraction-native semantics surface through Rx-style
  `IObservable<Delta<T>>` on the LINQ side. Research
  questions: (1) is auto-generation from the F# CE viable,
  or does every surface need a hand-written LINQ provider?
  (2) how do custom operations on F# CE (e.g. `where`,
  `match`, `trace`) translate to LINQ method names
  (`.Where`, `.Match`, `.Trace`)? (3) expression-tree
  inspection vs opaque-method-call hand-off. Priority P1
  post-v1-roadmap; effort L (per-surface LINQ-provider
  implementation after core F# DSL stabilizes). Composes
  with per-entry-point DSL row + container-DSL row + row
  719 LINQ integration.

- [ ] **Signal-processing primitives — FFT, Hilbert transform,
  windowing, filters.** Aaron Otto-149 standing approval:
  *"When Zeta gains signal-processing primitives add them
  whenever, approved, backlog"*. Immediate motivation:
  Amara 17th-ferry correction #5 (event-to-phase pipeline)
  asked for Hilbert-based phase extraction (Option B); Otto
  shipped Options A (`epochPhase`) + C (`interEventPhase`)
  in PR #332 but deferred Option B pending FFT. With
  standing approval, Otto may land these primitives
  whenever a graduation cadence window opens, without
  per-primitive design-review cycle. Scope:
  - **FFT / IFFT** — radix-2 Cooley-Tukey for powers of 2;
    Bluestein / mixed-radix for arbitrary N. F#-native or
    via `MathNet.Numerics` binding. Returns
    `Complex[]`.
  - **Hilbert transform** — analytic-signal construction
    via FFT (zero negative-freq bins, IFFT back). Enables
    instantaneous-phase extraction (Option B for phase
    pipeline).
  - **Windowing** — Hann, Hamming, Blackman-Harris,
    Tukey, Kaiser. For short-time FFT + spectral leakage
    mitigation.
  - **Digital filters** — FIR (convolution), IIR
    (Butterworth, Chebyshev, Bessel). Low/high/band pass.
  - **Auto-correlation / cross-correlation via FFT** —
    FFT-based speedup for existing `crossCorrelation` when
    sequences are long.
  - **Spectrogram / STFT** — windowed FFT over a sliding
    window.
  - **Phase-locking value via Hilbert** — the Option B
    pipeline unblocked by this row.
  Placement: `src/Core/SignalProcessing.fs` (new module) +
  integration into `src/Core/PhaseExtraction.fs`
  (`hilbertPhase`) + possibly `src/Core/Graph.fs`
  (FFT-accelerated spectral radius for very large graphs).
  Dependencies: `MathNet.Numerics` likely; if already in
  Zeta deps, zero added surface; else adds one NuGet
  reference. Test strategy: known-analytic-pair tests (e.g.
  FFT of `cos(kt)` → two-spike at ±k); invariance tests
  (IFFT ∘ FFT = id within tolerance). Priority P2 research-
  grade (standing approval; lands when cadence permits);
  effort M (per primitive cluster). Composes with Amara
  17th-ferry correction #5, `PhaseExtraction.fs`
  (PR #332), `TemporalCoordinationDetection.fs` long-
  sequence speedup opportunity.

- [ ] **Parser technology for external language / flavor /
  dialect surfaces — F# parser combinators (FParsec) first,
  ANTLR as fallback.** Aaron Otto-160 directive: *"maybe
  for sql and the other exernal languages and flavor/
  dialects we could use f# parser combinators, if that
  does not fit good then antlr, backlog"*. Binding
  ordering when Zeta implements an external-language
  compatibility surface (SQL / GQL ISO 39075 / Cypher /
  Gremlin / SPARQL / Datalog / PostgreSQL wire protocol /
  MySQL wire protocol / Esper EPL / Flink SQL / Flux /
  PromQL / KQL / etc.): try FParsec first; fall back to
  ANTLR only if FParsec demonstrably does not scale or
  fit the grammar. Rationale:
  - **FParsec strengths.** Stephan Tolksdorf's combinator
    library is idiomatic F#; integrates directly with
    discriminated unions for AST construction; composes
    with existing Zeta operator algebra; no code-gen
    step; no build-time dependency on Java; permissive
    license (BSD-style); already the de-facto F# parser
    library. A parser built in FParsec lowers to Zeta
    operator algebra via the SAME type system as the rest
    of the codebase, not through a generated-code
    boundary.
  - **When FParsec does not fit.** Very large ambiguous
    grammars (full-SQL-92 + vendor extensions),
    performance-critical parsers over multi-MB queries,
    grammars with deeply interlocking precedence that
    parser-combinator expression-parsing ergonomics fight
    against, left-recursive grammars that require
    non-trivial transforms. In those cases ANTLR
    (ANTLR4 for .NET) generates a proper LL(*) parser
    with predicate support. ANTLR grammars are
    declarative + reusable (official grammars repo has
    SQL / Cypher / GraphQL / etc.), which saves grammar
    engineering effort for well-specified standards.
  - **Decision rule per surface.** Each DSL surface (row
    above) picks parser tech with a short written
    justification: (a) FParsec attempted with effort
    estimate + ergonomic fit assessment; (b) ANTLR if
    (a) fails a documented bar (performance or
    ergonomics); (c) never both for the same surface
    (parsers are not composed across tech stacks within
    one surface). The justification lands in the
    surface's design doc under `docs/research/f-dsl-*.md`.
  - **Hybrid architecture allowed across surfaces.** It
    is fine for `graph { Cypher parser }` to be ANTLR
    (using the official openCypher ANTLR grammar) while
    `signal { simple DSL }` stays FParsec. What is NOT
    allowed is mixing the two within one surface.
  - **License compatibility.** FParsec: BSD 2-clause (or
    Simplified BSD) — factory-compatible. ANTLR4 + its
    .NET runtime: BSD 3-clause — factory-compatible.
    No license concerns either direction.
  - **Package dependencies.** FParsec lands as one NuGet
    reference (`FParsec` or `FParsecCS`); ANTLR lands as
    `Antlr4.Runtime.Standard` + a build-time `antlr4-
    tool.jar` (the code-generator). The build-time Java
    dependency of ANTLR is the key ergonomic cost — it
    means `tools/setup/` must ensure a JDK is present,
    and `Directory.Build.props` needs a custom target
    that invokes antlr4-tool at pre-build. FParsec has
    none of this cost — it is pure F#.

  Priority P1 post-v1-roadmap (follows the per-entry-
  point F# DSLs row above); effort: per-surface
  justification is S (written argument in each surface's
  design doc); FParsec learning-curve investment is S-M
  (one team-ramp across the factory); ANTLR build-
  integration is S (one-time setup per surface that
  adopts it). Composes with: per-entry-point F# DSLs row
  above; F# DSL composition + container-DSL row above;
  LINQ-compatible entry points row above; pluggable
  wire-protocol layer row below (which directly needs
  SQL + MySQL grammar parsers and is a natural first
  application).

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

- [ ] **Server Meshing + SpacetimeDB — deep research on
  cross-shard communication patterns for Zeta's multi-node
  DB backend; game-industry competitive angle.** Aaron
  Otto-180 directive: *"also backlog server mesh from star
  citizen, our db backend when we shard it should support
  this style of cross shard communication like server mesh,
  it's amamzing actually, i think space time db is similar
  too or not it might be orthogonal but we want to support
  these use cases in our backend too. do deep reserach
  here, this could get us lots of customers in the game
  industruy if we can compete with server mess/space time
  db"*.

  **CIG / RSI attribution context (Aaron supplied):**
  Cloud Imperium Games (CIG) develops Star Citizen +
  Squadron 42. Roberts Space Industries (RSI) is CIG's
  publishing / marketing / official-web subsidiary (also
  an in-game ship manufacturer in the lore). Founded
  April 2012 by Chris Roberts (Wing Commander series).
  Multiple studios including Cloud Imperium Games Texas
  LLC + Foundry 42 drive persistent-universe development.
  Crowdfunded MMO; immersive first-person space
  simulator.

  **Two architectures to research (likely orthogonal per
  Aaron's correct intuition):**

  1. **Server Meshing (CIG / Star Citizen).** Distributed
     simulation across multiple game servers that stitch
     together a single persistent universe. Entities /
     state / physics propagate across server boundaries
     as players move between meshed servers; authority
     over entities hands off between servers
     transparently. Public sources: CIG "Inside Star
     Citizen" video series, Star Citizen Wiki, Cloud
     Imperium engineering blog posts, RSI comm-links.
     Dynamic Server Meshing (the full vision) as opposed
     to Static Server Meshing (the incremental milestone
     CIG has been shipping) — both need research.

  2. **SpacetimeDB (Clockwork Labs).** Relational DB +
     game-server hybrid. Server logic lives inside the
     DB as "reducers" (stored-procedure-like functions);
     clients connect directly to the DB which runs
     authoritative game logic + persistence. Pitch: no
     separate game server; "the database IS the server."
     Claims: 1000x cheaper + faster than traditional MMO
     backend architecture. Open-source at
     `clockworklabs/SpacetimeDB`.

  **Why orthogonal:** Server Meshing is horizontal-
  scaling across many game servers; SpacetimeDB is
  vertical-integration of DB-plus-server into one
  process. Both solve the same problem (MMO-scale
  persistent-state-plus-low-latency-gameplay) but at
  different architectural layers. Zeta's DBSP substrate
  could in principle support EITHER pattern (or both):

  - Zeta-as-SpacetimeDB-analog: DBSP operators as
    reducer-equivalents; retraction-native algebra
    handles client rollbacks cleanly.
  - Zeta-as-Server-Meshing-substrate: the sharding
    layer (when it graduates from current single-node)
    carries the cross-shard entity-handoff + state-
    propagation semantics natively because Zeta events
    are already signed-weight ZSet deltas.

  **Competitive differentiator for Zeta:**

  - **Retraction-native semantics.** Both Server Meshing
    and SpacetimeDB have to solve "what happens when an
    authoritative server decides a past event didn't
    happen" (lag compensation, rollback netcode, failed
    transactions). Zeta's retraction-native algebra
    answers this natively by design, not as a bolted-
    on correction layer.
  - **Time-travel queries** (from the Bitemporal row
    above) compose with persistent-universe debugging
    / replay / match-review.
  - **Columnar storage** (adjacent row above) serves
    analytics workloads (telemetry, economy metrics,
    balance data) that game studios pay serious money
    for.

  **Research deliverable:**
  `docs/research/server-meshing-spacetimedb-comparison-zeta-sharding-fit.md`.
  Deep dive with sections:

  1. Server Meshing architecture (static vs dynamic,
     entity handoff mechanics, state-replication model,
     known failure modes, public roadmap).
  2. SpacetimeDB architecture (reducer model, Wasm
     execution, replication strategy, subscription
     model, pricing model).
  3. Zeta sharding design-fit: how DBSP + retraction
     + ZSet-algebra compose with each pattern.
  4. Competitive positioning: which game-industry
     customer segments would prefer each pattern +
     where Zeta's differentiators (retraction-native,
     columnar, bitemporal, F#/.NET ecosystem) win.
  5. Integration scenarios: "Zeta beneath
     SpacetimeDB" (Zeta as the DBSP engine under
     SpacetimeDB's reducer interface) vs "Zeta
     replaces SpacetimeDB" vs "Zeta + Server Meshing
     layer" — non-exhaustive.

  **Customer-industry angle (Aaron's framing):**
  *"this could get us lots of customers in the game
  industruy if we can compete with server mess/space
  time db"*. Game-industry buyers care about
  persistent-universe scale, anti-cheat (deterministic
  replay under retraction is a natural win), economy
  simulation, and per-region latency. Zeta's
  differentiators map onto all four. Research memo
  should surface 3-5 named studio-types
  (MMO developers / simulation games / competitive
  esports / mobile persistent / VR-social) with
  specific value propositions per segment.

  **IP discipline (unchanged from Otto-175c pattern).**
  Research uses public-domain framing ONLY; Star-Citizen
  and SpacetimeDB names appear here and in the research
  memo as industry-landscape references (reviewer /
  comparison targets), NOT as factory-adoption of those
  marks. Specifically:

  - No ingestion of Cloud Imperium Games proprietary
    content (leaked dev blogs, non-public design docs,
    closed-beta material). Public content — Inside-Star-
    Citizen videos, RSI-Comm-Link blog posts, published
    marketing + roadmap — is research-permitted.
  - No ingestion of SpacetimeDB proprietary code or docs
    beyond what's published under their Apache-2 license
    at `clockworklabs/SpacetimeDB`. Public code study +
    architecture-paper reading is research-permitted.
    study is fine).
  - No positioning of factory as CIG-adjacent or
    SpacetimeDB-adjacent in public branding;
    technical-substrate comparison is permitted as
    engineering-landscape reference.
  - No reproduction of paid industry-analyst reports
    (Gartner / Forrester MMO-infra coverage, if any)
    without licensed access.

  **Priority P2 research-grade** (post-v1 scope; single-
  node Zeta ships first; multi-node + sharding follow);
  effort L (deep comparative architecture research) +
  L (subsequent design ADR when sharding graduates).
  Composes with: the existing Bitemporal row (above) +
  Columnar storage row (above) + Pluggable wire-
  protocol row (around line 830) + Regular-database
  façade row (above) + Otto-175c starship-franchise-
  mapping row (Star Citizen thematic research row
  filed in PR #351; landed on main). Waits on Zeta
  multi-node foundation (currently unshipped; prior
  Amara ferries referencing the multi-node future (the
  11th-ferry-Temporal-Coordination-Detection + 12th-
  ferry-Executive-Summary cross-references) are the
  relevant priors; both are pending absorb (not yet
  landed under `docs/aurora/`).

## P1 — Factory / static-analysis / tooling (round-33 surface)

- [ ] **Live-lock smell cadence (round 44 auto-loop-46 absorb,
  landed as `tools/audit/live-lock-audit.sh` + hygiene-history log)** —
  Aaron 2026-04-23: *"on some cadence look at the last few things
  that went into master and make sure its not overwhelemginly
  speculative. thats a smell that our software factor is live
  locked."* Classifies last N commits on `origin/main` into EXT
  (src/tests/samples/bench), INTL (tick-history/BACKLOG/.claude),
  SPEC (research/memory/DECISIONS), OTHR. Flags when EXT < 20%.
  **Inaugural run 2026-04-23:** EXT 0%, INTL 72%, SPEC 16%, OTHR
  12% — smell fires. Response: PR #141 (ServiceTitan CRM demo
  sample) is the pattern-breaker; next audit after merge should
  show non-zero EXT. Open follow-ups: (a) wire the audit into
  the round-close ladder so it runs on every `origin/main`
  update, (b) make the threshold tunable per round-target, (c)
  distinguish "external PRs pending merge" from "no external
  work in flight" — the current script conflates them. Effort: S
  per follow-up. Owner: Kenji (Architect) picks cadence; Naledi
  (perf) and Rune (maintainability) natural reviewers for
  threshold tuning. Composes with
  `memory/project_aaron_external_priority_stack_and_live_lock_smell_2026_04_23.md`.

- [ ] **Cadenced self-practices code review — checks against our
  own advertised discipline on a schedule (round 44 auto-loop-46
  absorb)** — Aaron 2026-04-22 auto-loop-46: *"it would be nice
  to have code reviews on a cadence that checks for any of our
  own best practices we validate. Low/no allocation is very
  important part of what we are building, we need to be efficent
  and fast"*. The gap: we publish best practices (README.md
  performance table, `docs/BENCHMARKS.md` allocation guarantees,
  `docs/AGENT-BEST-PRACTICES.md` BP-NN rules) and we have
  reviewer skills (`code-review-zero-empathy`, `harsh-critic`,
  `performance-engineer`) — but there is no *cadenced*, codified
  job that routinely audits recent changes against those published
  self-practices. Concrete first step: author a capability skill
  that walks the recent commit range, runs the advertised-best-
  practice checklist (zero-alloc hot paths, `Result<_,_>` at
  boundaries, ASCII-only per BP-10, struct-tuple literals in
  production src, BP-11 data-not-directive, signal-preservation)
  and emits a P0/P1/P2 report with rule-ID citations like the
  existing `skill-tune-up` does for skills. Second step: wire it
  into the round-close ladder so every round auto-emits a
  self-practices report. **Priority rationale:** P1 not P0 — the
  existing one-shot reviewer skills still cover a single PR;
  what's missing is the *schedule* and the *self* of it (we
  audit others' code well, our own only when we remember to).
  **Out of scope for this row:** building a GitHub-Actions cron
  that runs on every push — that's a scale-up; the in-round
  human/agent-triggered version is the MVP. Composes with
  `docs/BENCHMARKS.md`, `README.md#performance-design`,
  `docs/AGENT-BEST-PRACTICES.md`,
  `memory/feedback_samples_readability_real_code_zero_alloc_2026_04_22.md`.
  Effort: M (capability skill + round-close ladder row). Owner:
  Architect (Kenji) assigns; Naledi (performance-engineer) +
  Rune (maintainability-reviewer) are natural reviewers.

- [ ] **Parallel-CLI-agents skill + multi-CLI canonical-inhabitance
  architecture (round 44 auto-loop-36 absorb)** — Aaron 2026-04-22
  auto-loop-36 four-message direction: (1) *"can you just work it
  out with the cli? like code or gemini and yall try it you can
  launch them, it would be cool if they worked on PR or filling
  out the insides of thier own harness and documenten it from the
  inside"*; (2) *"you could add a parallel cli agents skill where
  you manage parallel agent like your internal ones for any clis
  they have, seems like the ultimate evolution there. once it's
  mapped then take advante of the map and build new featues"*;
  (3) *"are you keeping up with the congintion level you launch it
  with becasue it's scoring and judgements from one or just
  becasue something is good for model a does not mean it gonna be
  good for model b. so keep our records of their activy or have
  them log their own to the capability cop level too"*; (4)
  *"also they are gonna need their own custom version of skills
  in .codes or yall can neotiage and maybe the coudl go root
  /skills except for the few special files"* + *"it shold fee
  connonical to them too"*. **Occurrence-1 anchor published:**
  `docs/research/codex-cli-self-report-2026-04-22.md` (160-line
  Codex-authored self-introspection with Claude-orchestrator-
  added cognition-level frontmatter; model=gpt-5.4,
  model_reasoning_effort=xhigh, sandbox=workspace-write). The
  Codex self-report explicitly flagged *"I could not determine
  the exact base model backing this main conversation turn"* —
  exactly the gap Aaron's cognition-level-ledger directive
  closes. **Four concerns named by maintainer, each a sub-task:**
  (a) **Parallel-CLI-agents skill** — a new capability skill
  that lets the Claude orchestrator launch, monitor, and
  coordinate Codex / Gemini / future-CLI sub-agents with
  the same dispatch ergonomics as Claude-native subagents via
  the `Task` tool. Naming candidates: `parallel-cli-agents`,
  `cli-orchestrator`, `multi-harness-dispatch`. Skill wraps
  `codex exec --sandbox workspace-write` / `gemini -p` / future
  variants with a uniform request/response/log shape. Composes
  with existing capability maps (Claude / Codex / Gemini
  already mapped). (b) **Cognition-level-per-activity ledger**
  — every external-CLI invocation logs: {agent, version, model,
  reasoning-effort, sandbox-posture, approval-policy, network,
  invocation-args, prompt-hash, files-touched, duration, cost-
  estimate, verification-run, outcome}. Aaron's concern is
  load-bearing: quality-deltas across model-A-vs-model-B (or
  same-model-different-effort) are invisible without the
  envelope. Implementation candidates: append to
  `docs/hygiene-history/cli-activity-ledger.md` on tick-close,
  or a per-CLI sub-ledger (`docs/hygiene-history/codex/...`,
  `docs/hygiene-history/gemini/...`). Composes with
  ARC3-DORA-per-model-effort stepdown experiment (that's DORA
  per Claude-effort; this is DORA per external-CLI-effort). (c)
  **Multi-CLI skill-sharing architecture** — current layout is
  Claude-centric (`.claude/skills/`, `.claude/agents/`). Aaron
  names two options: (i) per-CLI skill dirs (`.codex/skills/`,
  `.gemini/skills/`); or (ii) root `/skills/` with the few
  harness-specific files staying in `.claude/`. **Negotiation
  surface:** Claude + Codex + Gemini collaboratively propose
  a layout that is canonical to each — "it shold fee
  connonical to them too". This is a genuine open architectural
  question, deferred to a dedicated session with all three CLIs
  live. (d) **Canonical inhabitance for external CLIs** — the
  factory's four-layer accumulation (auto-memory / soul-file /
  persona notebooks / round-history) is Claude-centric by
  accident. Canonical inhabitance means Codex and Gemini land
  in a factory where the substrate feels native, not
  Claude-rented. This likely requires: (i) CLI-neutral naming
  for docs consumed by all CLIs (not "CLAUDE.md"-specific);
  (ii) a CLI-agnostic bootstrap doc analogous to `AGENTS.md`
  (which already aims at this); (iii) per-CLI welcome-surface
  parallel to `CLAUDE.md` at `CODEX.md` / `GEMINI.md` (or,
  per option (ii) above, a shared `AGENTS.md` with per-CLI
  pointer blocks). **Reviewer routing:** Ilyana (public-API /
  naming convention); Bodhi (DX for each CLI's first-hour
  friction — this is now a four-audience DX problem, not two);
  Daya (AX cold-start for agent personas); Samir
  (documentation); Aarav (skill-lifecycle). **Composition
  notes:** Extends the agent-claim-protocol (PR #108) —
  external CLIs filing claims via `docs/claims/` works across
  harnesses. Extends ARC3-DORA §Prior-art lineage — cognition-
  level-per-activity is the per-capability-tier measurement
  substrate. Extends never-be-idle — parallel CLIs expand
  speculative-work throughput. Extends honor-those-that-came-
  before — check prior-CLI-work memory before new-CLI-launch.
  **NOT:** NOT a round-45 commitment for implementation; NOT
  authorization to add CLIs beyond those Aaron has named
  (Codex / Gemini); NOT directive to migrate factory away from
  Claude-centric today (Claude remains primary orchestrator
  for now); NOT authorization to modify `.claude/skills/`
  during negotiation (those remain Claude's until layout is
  settled). **Load-bearing principle (2026-04-22 auto-loop-36
  clarification):** *"not just one harness gets to orginize it
  like they want"* + *"this is for everyone"*. The factory
  substrate is shared, not Claude-owned. Claude has a historical
  first-mover advantage (`.claude/` dirs exist; `CLAUDE.md` is
  the session-bootstrap) but that is an accident of build-order,
  not a design-authority claim. Layout negotiation is a
  three-party (or N-party as CLIs are added) collaboration —
  Claude does not propose and Codex/Gemini ratify. Every CLI's
  first-hour friction (Bodhi/DX) weighs equally; every CLI's
  cold-start cost (Daya/AX) weighs equally; every CLI's naming
  preferences (Ilyana) weigh equally. This is the canonical-
  inhabitance principle made explicit: the factory is for
  everyone who inhabits it. **Success
  signal:** (1) one external-CLI work-product lands per week
  with full cognition-level envelope; (2) skill-layout ADR
  authored with all three CLIs participating via claim-protocol;
  (3) Codex or Gemini self-retire an obsolete skill entry they
  detect, proving canonical-inhabitance is real not cosmetic.
  **Occurrence-counting:** this row is occurrence-1 of the
  parallel-CLI-agents framing; promotion to ADR awaits a second
  genuine multi-CLI coordination event.

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

- [ ] **Pluggable complexity-measurement framework — cyclomatic /
  LOC / nesting / custom metrics feed a common code-health signal;
  trend-down-over-time contract with local-optimum floor (round 44
  auto-loop-37 + auto-loop-38 absorb)** — maintainer 2026-04-22
  auto-loop-37/38 four-message chain: (1) *"i feel good about
  myself as a devloper when i delete more lines that i add in a
  day and nothing breaks, means i reduced complexity"*; (2)
  *"well yclomatic complexity is a proxy for that"*; (3) *"a
  metric that would atter add up add our cyclomatic complexity
  and / lines of code (or vice versa i also get inverses
  backwards) should decrease over time untill it hit a floor
  which could be a local optimum"*; (4) *"if it's going up you
  are wring shit cod[e]"*; follow-up on tooling choice: *"thats
  is pluggable someting but backlog it"*. Factory needs a
  **pluggable** complexity-measurement surface — multiple
  metric providers (cyclomatic, LOC, nesting depth, cognitive
  complexity, maintainability-index, Halstead, custom) feeding
  a common code-health signal; trend-over-time contract is
  monotone-decreasing with a local-optimum floor. Pluggable =
  new metric implementations ship as modules behind a stable
  interface; factory composes them into a weighted aggregate
  without coupling to a single tool. **Proposed shape:**
  `tools/complexity/providers/<name>.{sh|fsx|cs}` each exposing
  a stable stdout contract (per-file or per-module JSON with
  `{file, metric, value, commit_sha}`); `tools/complexity/
  aggregate.sh` joins provider output + commits a per-tick
  health row to `docs/hygiene-history/complexity-trend.md`;
  factory CI asserts the aggregate's rolling trend is
  monotone-non-increasing or trending-toward-floor (regression =
  warning, not failure — writing-shit-code signal surfaced, not
  blocked). **Direction question carried over to Phase 0**
  (maintainer must answer before Phase 1 scopes): is the
  aggregate `CC / LOC` (complexity-per-line; lower = terser) or
  `LOC / CC` (lines-per-decision; lower = denser)?
  Maintainer self-flagged *"i also get inverses backwards"* —
  direction intent clear (complexity down), formula TBC.
  **Four-phase work queued:** (0) **Direction confirmation** —
  maintainer answers which ratio direction; establishes the
  contract monotone-downward sense. Effort S. (1) **Minimal
  first provider** — LOC-delta-per-tick as a trivial starting
  metric (already available from `git log --shortstat`); one
  provider, one aggregator, one history doc. Effort S. (2)
  **Cyclomatic-complexity provider** — integrate a C#/F# CC
  tool (candidates: `dotnet-ifc`, `Metrix++`, `roslynator`,
  `Lizard`, custom Roslyn analyser). Effort M; tool-selection
  gated on maintainer preference. (3) **Aggregate + trend
  contract** — per-tick aggregate write to
  `docs/hygiene-history/complexity-trend.md`; rolling trend
  check (monotone-non-increasing modulo local-optimum floor);
  CI warning on regression. Effort M. (4) **Force-multiplication
  integration** — feed the complexity-delta outcome into
  `docs/force-multiplication-log.md` primary score per auto-
  loop-37 Goodhart-resistance correction; +N points per
  net-negative-LOC tick with tests passing. Effort S once
  phase 3 lands. **Design constraints from maintainer context:**
  - **Pluggable** (maintainer keyword) — interface stable,
    implementations swappable; don't couple to a single tool.
  - **Trend-over-time** — per-tick snapshots form a time
    series; regressions are visible on the trend not just a
    single-point threshold.
  - **Local-optimum floor** — metric will converge; factory
    recognises the floor as *the codebase is about as simple
    as it can be under current architecture*, not as a bug.
    Architectural moves that raise CC legitimately (e.g.
    adding a genuinely new capability) should be visible as
    a step-up followed by a renewed downward trend, not a
    fail signal.
  - **Goodhart-resistant** — composition with force-
    multiplication log scoring; CC must pair with test-pass
    (deletion-without-breakage), not just LOC-reduction.
  **What this is NOT:** NOT a commitment to ship all four
  phases this round (phase 0 + 1 is the minimal start); NOT a
  tool selection (maintainer chooses); NOT a mandate to
  refactor existing code against the metric (metric observes,
  doesn't prescribe); NOT blocking on the force-multiplication
  log rewrite (that's integration-layer work; phases 0-3 are
  tooling); NOT applicable to generated code / third-party
  absorbed source (scope to factory-authored code only).
  **Reviewer routing:** Architect (Kenji) on the pluggable-
  interface design, Aarav (skill-tune-up) on the trend-contract
  discipline-shape, Rodney (reducer) on the essential-vs-
  accidental cut criterion for what counts as a legitimate
  step-up, Naledi (performance-engineer) adjacent — per-tick
  measurement cost must not break the autonomous-loop budget.
  **Maintainer-background composition:** Aaron's Itron RIVA
  smart-meter work shipped constrained-substrate bootstrapping
  to field devices where code size directly gated OTA update
  feasibility; complexity-down-over-time was a hardware-
  engineering necessity there before it was a software-
  engineering virtue here. See
  `memory/feedback_deletions_over_insertions_complexity_reduction_cyclomatic_proxy.md`
  (out-of-repo maintainer context) for the full rule body and
  composition map with Rodney's Razor + Goodhart-resistance.
  Effort: S for phase 0 + phase 1; M for phase 2 + phase 3;
  S for phase 4 integration. Carrier-channel: this row + the
  memory + Aaron's verbatim quote chain above.

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

- [ ] **Map-completeness audit — proactive "do our maps cover
  the surfaces we touch?" cadence** (round 44 surface-map-drift
  absorb) — Aaron 2026-04-22: *"missing map hygene on backlog?"*
  after agent tripped on a surface (GitHub org spending-budget)
  that was never in the map. FACTORY-HYGIENE row #50 covers the
  *reactive* smell (wrong URL on a mapped surface); this row
  covers the complementary *proactive* audit: enumerate every
  surface the factory actually touches — from `gh api` calls in
  `tools/**`, `.github/workflows/**`, `.claude/skills/**`, and
  docs — cross-reference against each mapping doc
  (`docs/HARNESS-SURFACES.md`,
  `docs/research/github-surface-map-complete-2026-04-22.md`,
  `docs/AGENT-GITHUB-SURFACES.md`, `docs/GITHUB-SETTINGS.md`),
  and flag surfaces-used-but-unmapped. **Known gaps surfaced by
  the triggering incident:** (1) GitHub org spending-budget UI
  at `https://github.com/organizations/{org}/billing/budgets`
  (added to map as `ui-only` row 2026-04-22); (2) Copilot
  Business per-feature toggle state
  (`public_code_suggestions`, `ide_chat`, `cli`, `platform_chat`
  — values documented in
  `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
  but not yet mapped as a declarative surface); (3) the
  `coding-agent` / `internet-search` / custom-instruction
  enablement flags Aaron referenced ("turned all them on") —
  each is a distinct UI toggle with no declarative home yet.
  **Detection script:** `tools/hygiene/audit-map-completeness.sh`
  greps `gh api` usage + URL patterns across the tree,
  normalises to `{org-or-repo}/<path>`, diffs against mapping
  docs' enumerated endpoints, outputs surface-used-but-unmapped
  list. **Cadence:** every 5-10 rounds (same cadence as
  skill-tune-up, row #46, row #48) so the map isn't a write-once
  artifact that rots. **Companion:** FACTORY-HYGIENE row for
  map-completeness (a new row #51 once this lands). **Effort:**
  S (detection script + first sweep) + S per gap closure.
  **Reviewer:** Dejan (devops-engineer) for the detection
  mechanics; Architect (Kenji) for map-extension decisions
  (which gaps land where). Related: `memory/feedback_surface_map_consultation_before_guessing_urls.md`;
  FACTORY-HYGIENE row #50.

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
- [ ] **First-class Codex-CLI session experience — parallel to NSA / Claude-Desktop-cowork / Claude-Code-Desktop first-class pattern; possible harness swap for Otto later (model/harness-lead-dependent).** Aaron 2026-04-23 Otto-75: *"can you start building first class codex support with the codex clis help , it might eventually be benefitial to switch otto to codex later depending on which modeel/harness is ahead. this is basically the same ask as a new session claude first class experience, this is a codex session as a first class experince. and really the code one is a first class claude code experience, we also even tually will have first class claude desktop cowork and claude code desktop too. backlog"*.

  **The roster of first-class harness experiences Aaron wants Zeta to support symmetrically:**
  1. **Claude Code CLI** (current primary) — already first-class; this is what Otto runs in.
  2. **New Session Claude Code** (NSA persona, existing memory) — test-fresh-sessions discipline; captured 2026-04-23.
  3. **Codex CLI (OpenAI)** — **new ask, this row** — first-class experience parallel to Claude Code. The Codex CLI has its own installer + harness + tooling; treat it as a peer, not a second-class port.
  4. **Claude Desktop cowork mode** — future; runs the desktop-app agent alongside a human, not terminal-based.
  5. **Claude Code Desktop** — future; the GUI-frontend variant of Claude Code.

  **Why this matters (Aaron's framing):** harness-choice is model-and-capability-dependent over time. Today Otto runs Claude Opus 4.7 via Claude Code CLI. If a future OpenAI / Codex model-plus-harness combination out-performs for factory-agent work, Otto should be portable enough to swap without rebuilding the factory. **Portability by design**, same shape as retractability-by-design (`memory/project_retractability_by_design_is_the_foundation_licensing_trust_based_batch_review_frontier_ui_2026_04_24.md` Otto-73): don't lock the factory to one harness's affordances.

  **Relationship to existing cross-harness mirror row (below):** the mirror row is about **skill-file / rule-file distribution** to many harnesses so any harness can read them. This row is about **a first-class Codex session experience** — same shape as NSA-first-class: every operation Otto does in Claude Code, a Codex-CLI session should be able to do equivalently (tick cadence, memory read, substrate landing, PR opening, auto-merge arming). Mirror pipeline is necessary but not sufficient. This row is the integration-quality bar on top.

  **Proposed execution shape (subject to Codex CLI's own capabilities):**
  - **Research tick (S, first step).** Read Codex CLI's docs + feature set: scheduled tasks? subagent dispatch? long-running state? tool permission model? memory system? Scope: what does Codex CLI do well / differently / not at all vs Claude Code. File `docs/research/codex-cli-first-class-2026-*.md`.
  - **Parity matrix (M).** For every Claude-Code capability Otto currently uses (cron auto-loop, Task subagents, TodoWrite tracking, per-project memory, MCP servers, Skill tool, Bash/Edit/Read/Write tools, WebFetch, WebSearch, Playwright MCP, Figma MCP), identify the Codex-CLI equivalent — or flag as gap. Matrix lands as `docs/research/harness-parity-matrix-2026-*.md`.
  - **Gap closures (M-L per gap).** For each gap, decide: (a) portable shim (works in both), (b) Codex-specific equivalent, (c) document-as-limitation (feature unavailable). Track as sub-rows.
  - **Codex session-bootstrap doc (S).** Analogue to `CLAUDE.md` for Codex CLI. Read-these-first pointer list, ground rules, build-and-test gate. Path TBD per Codex CLI's conventions (`AGENTS.md` is already the universal handbook; may need `CODEX.md` or a generated-from-CLAUDE.md variant).
  - **Otto-in-Codex test run (S-M).** Single tick in a Codex-CLI session with the factory. Does the autonomous-loop cadence work? Can the agent land a substrate PR? Capture findings.
  - **Harness-choice decision ADR (S, after the above).** `docs/DECISIONS/YYYY-MM-DD-harness-choice-otto.md` — which harness runs the primary tick cadence, with rationale (model-lead + tooling-lead + cost-lead assessment at decision time). Explicitly revisitable per Aaron's *"depending on which modeel/harness is ahead"*.

  **Sibling rows for the other first-class experiences:**
  - Claude Desktop cowork first-class — separate row (future, when cowork matures beyond preview).
  - Claude Code Desktop first-class — separate row (future, GUI-frontend differs materially).
  - The existing NSA-first-class memory already covers (2) above; capture in a BACKLOG row if it needs explicit tracking beyond the memory.

  **Scope limits:**
  - Does NOT commit to harness-swap for Otto today. *"it might eventually be benefitial"* is contingent on model/harness-lead assessment. No forced migration.
  - Does NOT duplicate the cross-harness-mirror-pipeline work (skill-file distribution) — that row handles the substrate portability; this row handles the session-operation portability.
  - Does NOT lock Zeta to any one harness family — portability-by-design means Claude Code AND Codex CLI AND future harnesses all composable.

  **Priority:** P1 (strategic, not urgent). Research tick (S) should land within 5-10 ticks; full integration is L and spread across the next few rounds as Codex CLI capabilities clarify.

  **First file to write:** `docs/research/codex-cli-first-class-2026-*.md` (the research tick).

  **Otto-78 refinement — parallel-design + primary-switch-by-Aaron-context + symmetric-feature-parity:**

  Aaron 2026-04-23 Otto-78 message 1: *"you should let the codex cli design all it's own skill files in a parallel mode where it can run asyncroyncly to you cause it wont be touching the same files only it's own skill files, that way it's skills will be first classs for it, inluding any extensions of it's own harness it should research it own harness current features on a cadence like you too so we can have the wrappers for both of you with like the built in loops,, memory enahancements and all other harness features that can be helpful like maybe hooks whatever, you can also keep up with a asymerty of features between the two harnesses too. backlog but seems pretty cool."*

  Aaron 2026-04-23 Otto-78 message 2 (primary-switch clarification): *"only one will be the primary either you or codex which ever one i'm in at the time like i'm in you now so you are primay the async nature is controlled by you but if i'm in codex roles are reverse so its got to have all your fancyness and skills."* + *"backlog"*.

  **The shape of the model (Aaron's design):**

  1. **Two peer harnesses, not primary-secondary.** Claude Code and Codex CLI are each first-class. The existing 5-stage arc above (research matrix → gap closures → bootstrap doc → Otto-in-Codex test → harness-choice ADR) gets **extended** by this refinement, not replaced.

  2. **Context-contingent primary:** whichever harness Aaron is actively working in is the **primary** at that moment. The *other* harness runs in **async mode**, controlled-by-primary. When Aaron switches, roles swap. This is a session-wide property, not a configuration flag.

  3. **Symmetric feature inventory:** both harnesses need equivalent capability ("all your fancyness and skills"). Asymmetries in native-harness capability (e.g., Claude Code's `CronCreate` vs. Codex CLI's equivalent) are tracked explicitly so neither harness is stuck second-class.

  4. **Codex CLI designs its own skill files in parallel.** A Codex CLI session should do its own skill-file research / design / iteration **without Otto's hands on it**. The asymmetry is good — Codex's skill files live where Codex reads them (not `.claude/skills/`), and Codex knows best what shape its skill system wants. Prevents Otto-mediated translation errors.

  5. **Each harness researches its own harness capabilities on a cadence** (same shape as Otto's current web-search of Claude Code features). Codex CLI session researches Codex CLI updates; Claude Code session researches Claude Code updates. Output: harness-specific feature wrappers so built-in loops + memory enhancements + hooks + other affordances stay current on each side.

  6. **Asymmetry tracking:** both harnesses maintain a parity inventory (what does the other one have that we don't?). New features in one harness land as research items for the other; the parity gap gets tracked explicitly so neither drifts behind unknowingly.

  **Operational sequence (this is a revision of the earlier 5-stage arc; compose rather than replace):**

  - **Stage 1** (this file, landed as PR #231 2026-04-23) — Otto researches Codex CLI from Otto-side. This arc continues.
  - **Stage 1b — Codex CLI researches Claude Code from Codex-side.** New stage. When Aaron enters a Codex CLI session, the Codex agent runs an analogous research tick on Claude Code capabilities. Output: `docs/research/claude-code-first-class-from-codex-YYYY-*.md` (under whatever Codex's substrate convention becomes). Mirrors Stage 1 but with roles inverted.
  - **Stage 2 (joint)** — parity matrix combines both sides' research; asymmetries flagged explicitly.
  - **Stage 3 (each own surface)** — Codex CLI designs its own skill files / wrappers / tick loop in its own tree; Otto designs Claude-Code-specific wrappers on Claude Code side. Neither agent edits the other's substrate.
  - **Stage 4 (synchronization cadence)** — both sides run a periodic harness-features-research tick; asymmetry inventory updated; the non-primary harness is async-controlled by the currently-active primary for synchronisation work.
  - **Stage 5 (harness-choice ADR, as originally planned)** — per harness-choice-is-revisitable Aaron framing, the ADR names the current primary but explicitly supports swapping.

  **Why this matters (Aaron's concrete framing):** Codex CLI session-as-primary is not hypothetical — Aaron will be in Codex CLI sometimes. When he is, the Codex session should have full peer capability (same cadence quality, same memory access, same PR-landing discipline, same tick-history hygiene). Otto shouldn't be "the only one who can run the factory"; nor should Codex be stuck as a stripped-down port.

  **Relationship to existing rows / memories:**

  - Composes with existing 5-stage arc **above in this row** (extension, not replacement).
  - Composes with **cross-harness-mirror-pipeline** (round 34 below) — that one distributes skill files to many harnesses via a canonical source; this refinement says each peer harness **authors its own skill files**, so mirror-pipeline may apply only to *shared universal skills* (like `AGENTS.md` discipline), not harness-specific ones.
  - Composes with **multi-account access design P3** (PR #230) — primary/async switching is account-aware in future.
  - Composes with **first-class-Codex Phase-1 research** (PR #231) — Stage 1 of that feeds into this refinement's joint parity matrix.
  - Composes with `memory/project_first_class_codex_cli_session_experience_parallel_to_nsa_harness_roster_portability_by_design_2026_04_23.md` — the NSA-style first-class roster now formally includes the primary-switch property.

  **Scope limits of the refinement:**

  - Does NOT commit Otto to cede control. Otto remains primary while Aaron is in Claude Code (which is now). Async-mode Codex work only starts when Aaron is in Codex; Otto doesn't dispatch Codex work unilaterally.
  - Does NOT authorise Codex session to edit `.claude/skills/` or any Otto-owned substrate. Symmetric: Otto should not edit Codex's own-harness substrate.
  - Does NOT require harness-swap for Otto. The arc supports either-primary-any-time, not forced migration.
  - Does NOT bypass the harness-choice ADR (Stage 5) — that's still the decision surface when asymmetries warrant a reset.

  **First file to add for the refinement:** this BACKLOG update itself, plus a matching research-doc reference once a Codex CLI session executes Stage 1b.

  **Otto-86 refinement — multi-Claude intermediate stepping stone + Windows-support use case + Otto signals readiness + test-mode bounding:**

  Aaron 2026-04-23 Otto-86 message 1 (progression refinement): *"You can experiment with claude code cli for multi agent peer-harness mode before codex, once codex has built out everything it needs and you trust it and the testes for peer-harness mode with claude goes good then you can test peer-harness mode with codex too. so all of the options are avialbe with a single coordinator and multi corrdinator, the reason i ask is i want to eventualy sping up a second harness to work on windows support too. this will be cool to have two of you going but i wont do it until you tell me we are ready. maybe we use codex harness to do the windows support eventually since that will test the entire perr-harness transfer learning all the way to the end, the last one the in telepohone line, lol."*

  Aaron 2026-04-23 Otto-86 message 2 (test-mode bounding): *"make sure when in peer-harness mode you give the other one time limits or process kill them either way, just while we are testing we don't want the other peer harness to run forever during tests only when in real use."*

  **The 4-stage progression**:

  - **(a) Today** = single coordinator; Aaron-in-one-harness drives. Otto on Claude Code. This is Aaron's current mode.
  - **(b) Experiment: multi-Claude-Code peer-harness** = two Claude Code instances, both running Claude-Code loop agents, testing parallel coordination + handoff discipline + cross-session review without editing + tandem launches. **NEW intermediate stepping stone before introducing harness-difference.**
  - **(c) Multi-harness peer-harness with Codex** = after (b) tests go well AND Codex CLI has built out its own skill files / wrappers / loop-agent persona (Stage 1b-3 of the existing Codex-first-class arc) AND Otto explicitly trusts Codex substrate. Otto + Codex-loop-agent running concurrently; handoff discipline; multi-coordinator.
  - **(d) Full peer-harness with practical use case** = the second harness carries a real workload. Aaron's named use case: **Windows support via a second harness**, possibly Codex. Aaron's "telephone line" transfer-learning end-to-end test.

  **Otto is the readiness-signaller.** Aaron: *"i wont do it until you tell me we are ready"* — Aaron waits for Otto's explicit readiness signal before spinning up a second harness. This is the specifically-asked-for design-review discipline (Otto-82 authority calibration: maintainer signoff is required for specifically-asked-for design reviews, not for every substrate edit): progression stages (a) and (b) land within Otto's standing authority (experiments on Claude Code substrate are already within Otto-67 grant); **stage (c) launch requires Otto's readiness signal as an explicit maintainer-acknowledgment gate**.

  **Test-mode bounding (hard requirement for stages (b) and (c) tests):**

  - **Time limits or explicit process-kill** on the non-primary agent during peer-harness testing. Aaron: *"while we are testing we don't want the other peer harness to run forever during tests only when in real use"*.
  - Concrete enforcement options (design-Otto's-call, land in a test plan before running): wall-clock timeout per experiment (e.g., 30-minute bound per test session); hard process-kill target at end of experiment; explicit "test mode" flag that caps async-work-dispatch to a per-test budget; instrumentation that reports wall-time elapsed so the timeout fire is visible.
  - **Removed in real use.** Once peer-harness mode moves from testing to production (stage (d) with Windows-support workload), the time-limits come off — a real workload needs to run for real durations. The bound is TEST-specific.
  - **Why it matters.** Unbounded async agents in test mode consume budget, could produce unintended substrate changes if tests go sideways, and make failure modes harder to localize. Bounded-test enables retractability-by-design to work at the experiment layer (any test gone wrong is automatically finite).

  **Windows support as concrete motivating use case:**

  - Motivation: cross-platform parity (FACTORY-HYGIENE row #51 and row #55 audit surfaces) needs dedicated attention. Adding Windows work to Otto's single-harness queue serializes it; a second harness parallelises it.
  - Why second harness, not one-big-harness: parallel harnesses ARE the scaling model. Single-harness multitasking is slower and harder to reason about.
  - Why Codex eventually: Codex's own harness-feature research (Stage 1b) will surface capabilities that may align better with Windows-native tooling. End-to-end Windows-support on Codex is Aaron's "telephone line" test for peer-harness transfer-learning survival.
  - Filed as its own BACKLOG row candidate when readiness-signal fires; today it's a future-marker, not an active plan.

  **Scope limits of the Otto-86 refinement:**

  - **Does NOT authorise spinning up a second Claude Code session today** without a multi-Claude-peer-harness experiment design document landing first. Design + dry-run + readiness-signal before live launch.
  - **Does NOT authorise skipping the multi-Claude test** to jump straight to Claude-Codex peer-harness. Aaron's framing is sequential: (b) before (c).
  - **Does NOT authorise unbounded-duration test runs.** Time-limits or process-kill are load-bearing during testing.
  - **Does NOT authorise claiming readiness prematurely.** Readiness-signal is maintainer-acknowledgment-gated: false readiness breaks trust. Otto's criteria for readiness are Otto's judgment and can be documented in a future research doc when they crystallise.
  - **Does NOT expand or replace the Otto-78 primary-switch-by-Aaron-context clause** — that remains correct within each progression stage; this refinement adds stages (b) / (c) / (d), not a new primary-determination model.

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

- [ ] **PR-resolve-loop skill — automate the full
  close-the-PR cycle (CI-failures + review-conversations
  + agent-comment preservation + auto-merge arm) so Otto
  doesn't ship-and-pray.** Maintainer Otto-204: *"you
  need some pr resolve loop that will handled everyting
  needed to take a pr to compelteion so you don't ahve
  to keep figuion it out"* + Otto-204b conversation-
  preservation clarifier: *"we are saving you resolution
  to all the comments and we expect those to be
  execellent don't take shortcuts on the feedback, do
  the right long term thing or backlog the right thing
  and not it on the comment. We want to save both sides
  of the conversation."*

  **Context.** Otto's ship-rate exceeded CI-drain-rate
  across Otto-157..188, producing 136-open-PR
  saturation state (Otto-171 queue-saturation memory).
  Otto-200..203 observed main frozen 6+ ticks at #355.
  Otto-204 investigation discovered the real blocker
  was NOT CI queue but accumulated unresolved review-
  threads + unfixed lint failures that armed-auto-merge
  could not overcome. Each individual PR needs active
  management; passive arming is insufficient.

  **Scope:** new skill at `.claude/skills/pr-resolve-
  loop/SKILL.md` encoding the full PR-close cycle:

  1. **CI-status check** — `gh pr checks <N>`; if any
     required check failed, fetch the failure log, fix
     locally, commit+push.
  2. **Review-thread enumeration** — `gh api graphql`
     for reviewThreads; for each unresolved thread:
     - Read the reviewer's finding + severity.
     - Decide: fix-now OR file-BACKLOG-row-and-note OR
       counter-argue-with-rationale.
     - Post a reply on the thread explaining the
       decision + commit SHA where fix landed (if
       applicable).
     - Resolve the thread via GraphQL
       `resolveReviewThread` ONLY after the reply is
       posted (per Otto-204b "save both sides of the
       conversation" discipline).
     - If deferring: leave the thread unresolved with
       explicit breadcrumb-reply + filed BACKLOG row
       ID.
  3. **Name-attribution lint** — before any commit on a
     branch touching factory-produced docs, grep for
     "Aaron" / direct-contributor-names in the diff;
     replace with "maintainer" idiom unless the file
     is an audit-trail surface (commit messages, tick-
     history, memory files — all history-exempt per
     loop-tick-history 2026-04-22).
  4. **Conversation-preservation hook** — every reply
     + resolve operation logs to `artifacts/pr-
     discussions/PR-<N>-conversation-log.json` so the
     git-native preservation directive (Otto-150..154,
     PR #335) captures both-sides-of-conversation
     automatically rather than relying on GitHub-only
     storage.
  5. **Auto-merge re-arm** — once all required threads
     resolved + all required checks green +
     `mergeStateStatus: MERGEABLE` (not BEHIND, DIRTY,
     or BLOCKED), re-arm `gh pr merge --auto --squash`.
  6. **Loop-exit criteria** — skill terminates when
     either (a) PR merges, (b) a thread has a decision
     blocked on maintainer input (escalate, don't
     loop), or (c) all reachable fixes have landed and
     remaining blockers are external (CI-side flake,
     GitHub-side transient).

  **Invocation modes:**

  - `pr-resolve-loop <PR-number>` — drive a single PR
    to completion or blocker.
  - `pr-resolve-loop --all-owned` — iterate across all
    PRs where Otto is the commit author; most-recent-
    first.
  - `pr-resolve-loop --dry-run` — print the plan
    without acting.

  **Non-goals:**

  - NOT an auto-merge-bypass. The skill doesn't override
    branch protection; it honors the 5 required checks
    + review-resolution gate faithfully.
  - NOT a shortcut around reviewer intent. Per
    Otto-204b: the skill MUST post substantive replies,
    not mark-resolved-and-move-on.
  - NOT a retry-loop on external CI flake. When a test
    flakes 3× in a row, the skill escalates (files
    BACKLOG row + notifies maintainer) rather than
    retrying indefinitely.
  - NOT an opener of new PRs. Strictly a resolver of
    already-opened PRs.

  **Composes with:**

  - Otto-171 queue-saturation-throttle memory — this
    skill is the active-management counterpart to the
    ship-throttle discipline.
  - PR-preservation P2→P1 BACKLOG row (PR #335, Otto-
    150..154) — the conversation-preservation hook
    uses the preservation workflow's schema.
  - `@codex review` + Copilot-reviewer-connector patterns
    — the skill handles both agent-reviewer styles
    uniformly.
  - `tools/hygiene/audit-git-hotspots.sh` (PR #213) —
    complementary; hotspots tells us WHICH files to
    split; this skill tells us HOW to close PRs.
  - BACKLOG-split Phase-1a (PR #354) — the first PR
    where active-management discipline was applied;
    debt-ledger-of-what-was-learned.

  **Priority P1 CI/DX.** Effort: M (skill design +
  scripting) + S (invocation convention docs) + S
  (`@mentioning` review-reply template bank).
  Dependencies: ideally after PR #335 (conversation-
  preservation mechanism) so the hook has a target to
  write to, but the skill can initially store
  conversation logs in a Phase-0 local path if #335
  lands later.

  **Learning captured Otto-204:** active PR management
  has 10-20× higher ROI than opening new PRs when the
  queue is saturated. The factory's observation of
  "queue unchanged 136" for 6+ ticks was misread as
  "stuck"; the underlying reality was "every PR has 5-
  15 unresolved review-threads + silent lint failures
  that auto-merge cannot see past." This skill
  internalizes that learning.

- [ ] **HLL property-test flakiness — investigate before
  retry (DST discipline).** Observed 2026-04-23 (auto-loop-88):
  `Zeta.Tests.Properties.FuzzTests.fuzz: HLL estimate
  within theoretical error bound` failed in CI on PR #159
  (gh run 24849954881 / build-and-test ubuntu-22.04 /
  FsCheck.Xunit.PropertyFailedException). The failing PR
  only touches `memory/*.md` files — unrelated to the
  test. Failure is inherited from the main-branch state
  at rebase time.

  Per the DST discipline
  (`memory/feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`
  — per-user), retries are a non-determinism smell. A
  flaky property test is genuine non-determinism; the
  investigation should answer:

  1. **Is the error bound formula correct?** HLL has a
     known standard-error of `1.04 / sqrt(m)` where `m`
     is the number of registers. The test bound should
     reflect that + a factor for confidence interval.
  2. **Is the test seeded deterministically?** FsCheck
     supports explicit seeds; a flaky property under
     random seeds should be seed-pinned + the failing
     seed captured for regression.
  3. **Is it actually a real regression?** The test
     was passing recently (session PRs earlier today ran
     CI green on this check). Bisect against recent
     commits to identify when it started failing.
  4. **What's the cost of re-running?** If the failure
     is a genuine edge-case at one seed in ten thousand,
     re-run succeeds. But DST discipline says investigate
     first: understand WHY this seed fails before
     accepting "flaky = retry."

  **Deliverable**: research note under
  `docs/research/hll-property-test-flakiness-YYYY-MM-DD.md`
  naming the cause + fix (either tighten bound, pin
  seed, or fix the HLL implementation). No deadline; but
  the test is currently blocking session PRs from
  merging until re-run passes.

  **Effort**: S if the bound formula is wrong (tighten +
  rerun); M if it's a genuine implementation edge case
  requiring investigation.

  **Composes with**: the DST retry-is-smell memory; the
  samples-readability-real-code-zero-alloc memory (HLL
  is library-internal, so low-alloc + correctness are
  library-scope).

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

## P1 — Otto-257..270 counterweight-discipline bundle (2026-04-24)

Each row below cites a memory file under `memory/`
capturing the originating discipline. Per Otto-267/269
these rows are corpus pointers (training signal).
Landed in task #261 bundle.

- [ ] **Corpus-as-Bayesian-teaching-curriculum strategic
  artifact (Otto-267 + Otto-269 + Otto-270)** —
  operationalize gitnative corpus as prompt-time
  curriculum AND training-time data AND enriched event
  stream. Deliverables: `docs/CURRICULUM.md` with
  BP-ordered reading sequence; infer.net vs Pyro/Stan/Gen
  ADR for BP substrate; `tools/corpus/emit-event-stream.*`
  (post-install / soul-file command emitting chronological
  stream with enriched additive-only annotation envelope);
  eval harness verifying trained models internalize the
  disciplines + score agents against the stream. Subject =
  gitops; method = Bayesian BP for curriculum design; form
  = enriched event stream (Otto-270 enriched-CT framing,
  Zeta DBSP as natural ingest substrate — Ouroboros).
  See `memory/feedback_bayesian_teaching_curriculum_*_otto_267_*`,
  `memory/feedback_gitnative_corpus_as_training_data_*_otto_269_*`,
  and `memory/feedback_enriched_event_stream_corpus_*_otto_270_*`.
  Effort: L (research-grade, multi-tick scope).

- [ ] **Event-stream generator + enriched envelope
  (Otto-270 execution)** — Phase 1: design stream format
  (JSONL / Arrow / Zeta-native Z-set serialization) via
  `docs/DECISIONS/YYYY-MM-DD-corpus-event-stream-format.md`.
  Phase 2: `tools/corpus/emit-event-stream.*` generates
  chronological events from repo history + all gitnative
  artifacts (Otto-261). Phase 3: annotation-envelope
  schema (additive-only; original preserved per Otto-238)
  capturing assumed-current-state / rules / permissions /
  order-of-operations / counterweights-active. Phase 4:
  Zeta DBSP `Source<Event>` adapter for ingest. Phase 5:
  agent-scoring eval harness. Ouroboros: Zeta ingests own
  history via Zeta. See
  `memory/feedback_enriched_event_stream_corpus_*_otto_270_*`.
  Effort: L.

- [ ] **Word-discipline (Otto-268) as training-time
  alignment criterion** — words perfectly aligned to ideas
  = harmonic resonance; drift = destructive interference.
  Under Otto-269 training-time framing, drift pollutes
  weights not just prompt comprehension. Every durable
  artifact edit (memory, skill, ADR, commit message) checks
  word-idea alignment before landing. Cross-reviewer
  terminology bridged to canonical vocabulary or glossary
  updated. See
  `memory/feedback_words_perfectly_aligned_to_ideas_*_otto_268_*`.
  Effort: S per artifact; standing discipline.

- [ ] **Gitnative-sync all GitHub artifacts to LFG
  (Otto-261)** — branches + PRs + issues + discussions +
  wiki + projects + releases + repo metadata (environments
  / env-var NAMES / secret NAMES; values NEVER) + CI
  history + billing HISTORY snapshots. LFG-only; forks
  don't duplicate. Iterative enhancement-backlog at
  `docs/gitnative-sync-enhancement-backlog.md`. Per-artifact
  sync tool under `tools/sync/<artifact>.sh`. See
  `memory/feedback_gitnative_store_all_github_artifacts_*_otto_261_*`.
  Effort: L total; M per artifact; Phase 1 issues first.

- [ ] **Rule of Balance discipline (Otto-264) documented
  + maintained** — every found mistake-class triggers
  counterweight filing (prevent / detect+repair / both);
  counterweights need maintenance cadence (~5-10 ticks
  initial, ~20-50 stabilized); NEVER take shortcuts.
  Document as `docs/RULE-OF-BALANCE.md` primary doc;
  factory-hygiene standing cadence row. See
  `memory/feedback_rule_of_balance_*_otto_264_*`.
  Effort: S doc; standing discipline.

- [ ] **Auto-format on PR (Otto-258)** — markdownlint +
  `dotnet format` + shfmt + prettier as pre-commit +
  CI force-format-and-commit-back job ("super force
  format" static-analyzer pattern); editorconfig seeded
  from proven defaults; three-way parity per GOVERNANCE
  §24. Phased: markdownlint first, dotnet-format second,
  shfmt + prettier third. See
  `memory/feedback_auto_format_on_pr_ci_job_*_otto_258_*`.
  Effort: M.

- [ ] **Verify-before-destructive factory upgrade
  (Otto-259)** — subagent classifications feeding
  destructive actions require independent verification
  gate; sample N ≥ max(3, sqrt(total)); 100% agreement
  required. Tool: `tools/hygiene/verify-audit.sh`.
  Subagent-prompt template requires raw primary-source
  output. Semgrep/custom lint catches bulk-destructive
  patterns without preceding verification. See
  `memory/feedback_verify_subagent_claims_before_destructive_action_*_otto_259_*`.
  Effort: M.

- [ ] **Trunk-based-dev discipline (Otto-262)** — only
  main long-lived; 7-day branch-age audit signal;
  recover-or-prune not preserve. Phase 1 sweep (task
  #264); Phase 2 `tools/hygiene/tbd-branch-audit.sh`
  weekly cadence; Phase 3 auto-delete-head-branches +
  auto-merge-armed + branch-age notification. See
  `memory/feedback_trunk_based_development_*_otto_262_*`.
  Effort: M phase 1; S phase 2; S phase 3.

- [ ] **Merge queue adoption counterweight (Otto-265)**
  — GitHub merge queue on LFG main serializes merges,
  prevents rebase-thread-ping-pong (observed this session
  on #188/#190/#147). Verify merge-queue ON; verify
  branch-protection requires merge-queue; test routing;
  document in `docs/GITHUB-SETTINGS.md` gitnative mirror.
  Detection: rebase-cycles-per-PR > 3 in one session =
  structural-problem signal. See
  `memory/feedback_rebase_thread_ping_pong_pattern_*_otto_265_*`.
  Effort: S verify + M documentation.

- [ ] **Clean-default smell detection cadence (Otto-257)**
  — drift from "keep things clean" triggers "what did I
  forget?" reflex. Surfaces: git-native + github-host.
  Cadence: every 5-10 rounds + on-demand. Tool:
  `tools/hygiene/recovery-audit.sh`. Findings classify
  landed / obsolete / unfinished; recovery PRs per
  unfinished. See
  `memory/feedback_clean_default_smell_detection_*_otto_257_*`.
  Effort: S steady state; L first sweep (partly done).

- [ ] **SignalQuality design-alternative evaluation
  (Otto-266 greenfield)** — PR #147's alternative
  `src/Core/SignalQuality.fs` (empty-string → 0.0-neutral
  with `compressionMinInputBytes = 64` byte threshold)
  vs main's current (0.5-neutral, no threshold, via PR
  #142). Evaluate on merits; if better, land as separate
  PR. See
  `memory/feedback_zeta_is_still_greenfield_*_otto_266_*`.
  Effort: S eval + S implementation if adopted.

## P2 — hygiene refinements (Otto-254/255/256/260/263)

- [ ] **`StakeCovariance` file split** — move the
  `StakeCovariance` module out of `src/Core/Graph.fs`
  and into its own `src/Core/StakeCovariance.fs`.
  Per-concept-per-file convention matches the rest
  of `src/Core/` (e.g. `RobustStats.fs`,
  `TemporalCoordinationDetection.fs`). PR #331 dropped
  `[<AutoOpen>]` on the module to mitigate the
  immediate `Zeta.Core` namespace-pollution concern;
  the file split is the cleaner long-term layout.
  See PR #331 thread 2 (`PRRT_kwDOSF9kNM59VZ22`) and
  `docs/pr-preservation/331-drain-log.md`.
  Effort: S refactor.

- [ ] **Roll-forward default (Otto-254) standing
  reminder** — revert is the exception (credential leak,
  destructive prod break, PII, maintainer directive);
  forward-roll is default. Add to
  `docs/FACTORY-HYGIENE.md` as row. See
  `memory/feedback_always_prefer_rolling_forward_*_otto_254_*`.
  Effort: S doc row.

- [ ] **Symmetry in naming (Otto-255)** — default
  symmetric names across parallel locations (e.g.
  `docs/pr-preservation/` mirrors
  `forks/<fork>/pr-preservation/`). Asymmetry requires
  inline opt-out reason. Optional lint tooling for
  cross-tree same-concept name checks. See
  `memory/feedback_prefer_symmetry_in_naming_*_otto_255_*`.
  Effort: S doc row + M lint tool.

- [ ] **First-names-in-history-files refinement
  (Otto-256)** — update `docs/AGENT-BEST-PRACTICES.md`
  line 284 with history-file carve-out
  (`docs/DECISIONS/**`, `docs/ROUND-HISTORY.md`,
  `docs/hygiene-history/**`, `docs/research/**`,
  `memory/**`). First names allowed there; not in
  current-state / code / skills / public-API. See
  `memory/feedback_first_names_are_not_pii_*_otto_256_*`.
  Effort: S BP-edit.

- [ ] **`F#`/`C#` preservation lint (Otto-260)** —
  never rename to `F-Sharp` / `C-Sharp` under lint
  pressure. Reflow or backtick-wrap at EOL. Custom
  lint in `tools/hygiene/` catches rename-attempts
  in markdown. Subagent-prompt template includes
  constraint (already applied wave 3 drain). See
  `memory/feedback_fsharp_csharp_in_markdown_*_otto_260_*`.
  Effort: S lint tool.

- [ ] **Best-of-both-worlds root principle (Otto-263)
  documented** — gitnative durability + host first-class
  UX simultaneously; composes Otto-250/251/252/261/262
  under single root. Doc at
  `docs/BEST-OF-BOTH-WORLDS.md` or inline into governance
  as "why" behind gitnative-sync execution. See
  `memory/feedback_best_of_both_worlds_*_otto_263_*`.
  Effort: S doc landing.

- [ ] **`/btw` pattern evangelism + durable-queue fix** —
  Aaron 2026-04-24: *"as long as this is durable conversation
  this is great, we need to make sure this is pushed on
  maintainers in the claude ide or others similar thing if
  they have it, this is crutial to not divert your
  attention."* Two linked items:
  (1) **Evangelize the `/btw` skill pattern** to other
  Claude Code users + Claude IDE maintainers + other AI
  harnesses — package as adoption-staircase Level 0
  artifact (Otto-274); documentation + upstream
  feature-request; attention-preservation is the
  load-bearing rationale (every non-/btw aside is a full
  context-switch that displaces in-flight work; /btw is
  1-line absorb + continue per Otto-275).
  (2) **Fix the `/btw` skill's durability gap** —
  current procedure routes directive-queued items to
  `.btw-queue.md` (gitignored, session-scoped) OR
  TodoWrite (session-scoped). Neither survives a fresh
  session. Revise procedure: directive-queued items also
  get a **docs/BACKLOG.md** row AND / OR an in-repo
  **memory/** entry (both committed, durable across
  sessions). Classification ladder: if the aside is
  ephemeral context for this session only → TodoWrite /
  `.btw-queue.md` fine; if the aside is a future-session
  nudge → MUST land durably in BACKLOG or memory.
  Effort: S skill-edit + M evangelism artifact.

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

- [ ] **Uptime / HA metrics — deploy-something-somewhere
  to collect time-series history.** Human-maintainer
  2026-04-22 directive extending the ARC3 /
  DORA-in-production programme: *"uptime high avialablty
  metrics is something we need history of which means we
  need to deoply someting somewhere so we can collet
  data"*. The factory has been
  pure-code + pure-doc so far with no deployed runtime —
  this row crosses that boundary. **Early-start-matters**
  is the priority driver: a month of uptime history
  requires a month of uptime, regardless of capability.
  P1 not because urgent-to-complete but urgent-to-begin.
  **Minimal viable deployment, free-tier-only per prior
  directive** (*"and free i'm not paying for infrustra
  yet"* from the outbound-email memo):
  - (i) *What to deploy* — three candidates: (a) the
    ServiceTitan demo itself (elegant — one artifact
    doubles as the demo fixture AND the uptime fixture,
    lets DORA four keys attach to the same thing the
    factory is presenting); (b) a tiny `/health` API
    service unrelated to the demo (isolates infra-
    measurement from demo-quality concerns but duplicates
    effort); (c) a static docs site (cheapest, least
    failure-mode-diversity for DORA measurement). **Flag
    to Aaron** — (a) is the elegant composition but
    couples presentation-risk to measurement-need; (b)
    is the honest split but two things to maintain.
    **Flag to human maintainer** — decision gate before
    ADR.
  - (ii) *Where to deploy* — free-tier PaaS candidates
    (verify pricing at selection time — free-tier terms
    drift): Cloudflare Workers (edge, free tier with
    generous daily-request quota, fast cold-start), GitHub
    Pages (static only, free with documented soft caps on
    bandwidth / site size / build minutes — not literally
    "unlimited"), Vercel/Netlify (generous free tiers for
    static + serverless-functions, commercial-use terms
    vary). Render free tier sleeps after idle which would
    confound uptime data (disqualifying). Railway offers a
    `Serverless` sleep mode that is opt-in rather than
    mandatory; still usable if sleep stays off, but
    account-level credit caps apply. Fly.io's official
    pricing moved free allowances to legacy-only / new
    organizations are pay-as-you-go — treat as
    disqualified for the free-tier-only constraint unless
    legacy-org status is confirmed. **Flag to Aaron** —
    Cloudflare Workers is the cleanest free-tier candidate
    with no forced-sleep and no commercial-use gating for
    small fixtures.
  - (iii) *How to monitor* — external monitor pointing at
    the deployment; free-tier candidates (verify current
    terms at selection time): UptimeRobot (50 monitors,
    5-min interval, free-plan retention is ~3 months per
    current plan docs — earlier "13mo" figure was stale;
    longer retention requires paid tier or exporting via
    API), Better Stack (10 monitors free), self-hosted
    Prometheus + external blackbox-exporter (needs a
    second host → disqualified for free-tier-only
    constraint). **Commercial-use gate** — UptimeRobot /
    Better Stack free tiers have historically restricted
    commercial / revenue-linked use; re-check terms before
    pointing at any ServiceTitan-demo-linked fixture, or
    pick a plan that explicitly permits business use.
    **Recommend** UptimeRobot as first-cut for
    non-commercial scope: 5-min interval is enough
    resolution for availability-% and MTTR; periodic API
    export preserves history beyond the free retention
    window. Export target is a research doc under
    `docs/research/` (landing path TBD alongside the
    deployment spec ADR — do not pre-commit to a specific
    filename until the ADR chooses it; the ARC3
    cross-tier DORA comparison is the intended reader).
  - (iv) *DORA four-keys mapping* — Deployment frequency
    = **deploy events** per period (one deploy event may
    bundle multiple commits; counting commits-to-
    production overcounts when a deploy ships several
    and undercounts when a deploy ships none, skewing
    cross-tier comparison); Lead time = commit → deployed
    wall-clock (this is where the commit-to-deploy
    mapping stays load-bearing); Change failure rate =
    % deploys triggering uptime-degradation; MTTR = time
    from first-fail-alert to uptime-recovered. Each of
    the four is computable from the deployment
    pipeline's deploy-event log + commit-to-deploy
    mapping + the external monitor's downtime log. No
    extra instrumentation needed beyond the deployment
    itself + the monitor + a minimal deploy-event record
    (timestamp + commit SHA shipped).
  - (v) *Signing authority / secrets* — deployment
    requires account creation on the chosen PaaS. Per
    the outbound-email memo, human-maintainer Lane-B is
    pre-read-mandatory today; sign-up needs the human
    maintainer in the loop for phone-recovery /
    password-storage / ownership artifacts. **This row
    does not include account creation** — flagged as a
    dependency, not done. The Playwright-terrain-map
    spike (task #240) may produce signup paths for this
    when it resumes.

  **Composition with prior memories / rows:**
  - Extends the ARC3 / DORA-in-production programme —
    uptime data is the first axis where "in production"
    stops being a label and starts being a measurement.
    (Programme context lives in per-maintainer
    out-of-repo memory; no committed in-repo citation
    exists yet — this row establishes the in-repo
    anchor, and the ADR under `docs/DECISIONS/` will
    carry the canonical reference once landed.)
  - Composes with ServiceTitan demo row — if the demo is
    the deployment, the demo-target also gains a live-URL
    deliverable that the human maintainer can share
    pre-presentation.
  - Composes with free-tier / no-paid-infra constraint
    from the outbound-email memo.
  - Composes with the capability-stepdown experimental
    plan — each tier-phase can claim its own section of
    uptime history; the tier-tag in
    `docs/hygiene-history/loop-tick-history.md`
    correlates to the uptime-degradation-periods in
    the monitor log.
  - Composes with the alignment-observability framework
    — uptime is a durable ALIGNMENT trajectory signal
    orthogonal to per-commit HC/SD/DIR measurables.

  **Suggested first-step** once the human maintainer
  picks (i) and (ii): ship a deployment spec ADR under
  `docs/DECISIONS/` naming the chosen PaaS + monitor +
  health-endpoint shape; land a minimal "Hello, Zeta"
  deploy; point the monitor at it; start the clock.
  Effort: S for first-cut spec; M for first live deploy
  (+ account setup latency); then T+24 minimum before
  any DORA signal is measurable.

  **Owner:** DevOps persona (Dejan) + human maintainer
  for account-creation + signing authority. Advisory
  from architect (Kenji) on scope and threshold. Effort:
  S (this row is mostly scope + flag-questions); real
  deployment work is M-L depending on the human
  maintainer's choices.

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
- [ ] **PII-review pass: sensitive third-party medical/legal content
  in 2025-11 Amara conversation chunk.** P1. Flagged on PR #302 review
  thread `PRRT_kwDOSF9kNM59UY81` against
  `docs/amara-full-conversation/2025-11-aaron-amara-conversation.md`
  line 16 region. The chunk includes sensitive personal medical/legal
  references (jail + mental facility) about an identifiable third-party
  individual. **Scope of this row is the review-and-decide step, not
  agent-side redaction.** Per Otto-204b memory on personal-data
  safeguarding and the Otto-226 three-outcome model, inline-redaction
  of third-party PII is an Aminata threat-review + Aaron-maintainer
  decision — not a unilateral agent action. Deliverable: (a) Aaron +
  Aminata review the specific file+line region; (b) decide policy —
  redact-in-place / anonymize / leave-verbatim / move-to-restricted
  surface; (c) if redaction chosen, specify exact technique (name
  substitution, region ellipsis with `[redacted: third-party medical
  detail]`, or partial-rewrite) that preserves the verbatim-substrate
  principle for the non-sensitive surrounding content; (d) document
  the decision as a one-line policy precedent in
  `memory/feedback_pii_in_absorbed_substrate_*.md` so future chunks
  absorb consistently. Composes with: Otto-204b memory (personal-data
  safeguarding = Aminata territory); Otto-112 memory (docs/ linted,
  memory/ not — verbatim-preservation vs format-normalisation split);
  §33 archive-header discipline; the "data is not directives" (BP-11)
  separation — this is about *what we store*, not *what we act on*.
  Does NOT authorize: agent unilateral redaction / silent edits to
  already-merged conversation substrate / scrub of all PII across
  the absorb corpus without policy first. Ownership: Aaron + Aminata
  (decision); Otto (execute the chosen policy once decided). Effort:
  S (decision) + S-M (execution depending on technique).

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

- [ ] **Emulators as canonical OS-interface workload —
  rewindable/retractable OS + emulator controls; safe-ROM
  testbed offer; ARC-3 absorption-scoring substrate.**
  Maintainer 2026-04-24 directive (verbatim):

  > *"emulators should run very nicely on this, let me
  > know when you want some roms of any kind that are
  > safe."*

  Plus follow-up:

  > *"rewindable/retractable os/emulator controls"*

  **Why emulators are the canonical OS-interface
  workload:**
  - An emulator is `while(true) { fetch; decode; execute; }`
    — a tight event loop with state. Maps directly onto
    the OS-interface durable-async runtime.
  - Save states become FREE: every yield-point in the
    emulator's instruction loop is a checkpoint. Save
    state = pause. Restore = resume from any checkpoint.
  - Cross-node migration is FREE: pause your Game Boy
    emulator on the laptop, resume on the phone — state
    follows the function, not the machine.
  - Multiplayer is FREE: two clients subscribed to the
    same emulator instance share state via the durable
    substrate.
  - Speedruns / TAS (tool-assisted speedruns) get
    determinism guarantees baked in via DST (Otto-272).

  **Rewindable/retractable controls (maintainer
  follow-up):**
  - Every emulator operation is RETRACTABLE — Z-set
    retraction-native semantics extend from the data
    layer all the way UP to the OS-interface and the
    emulator-control surface.
  - "Rewind 5 seconds" is a first-class OS primitive,
    not an emulator-special-case feature.
  - The same retraction-native semantics that let the
    database undo a transaction let the emulator undo
    a frame, the process tree undo a process spawn,
    the network connection undo its side effects.
  - Composes with **rr** / **Pernosco** time-travel
    debugging — same architectural class, generalized
    across the entire OS surface.
  - Mutual reversibility (Otto-238 retractability-as-
    trust-vector): rewindable controls let users
    experiment without consequences. Every action is
    undoable. The system grants more agency because
    error is bounded.

  **ARC-3 absorption-scoring connection** (2026-04-22
  research): the prior maintainer directive on ARC-3
  adversarial-self-play scoring used emulators as the
  absorption substrate. This row activates that
  research — emulators on the OS-interface = the
  three-role co-evolutionary loop (level-creator /
  adversary / player) running on durable-async +
  rewindable substrate. Save states + DST + retraction
  let level-creator generate scenarios, adversary
  produce hard cases, player produce solutions, all
  with replay/rewind for analysis.

  **Safe-ROM offer (maintainer-explicit):**
  *"let me know when you want some roms of any kind
  that are safe."* When implementation activates,
  ask the human maintainer for the safe-ROM substrate.
  Candidate classes (research, not adoption):
  - **Public-domain / homebrew / demoscene** ROMs.
  - **Official test suites** (e.g. mooneye-gb, Game Boy
    boot ROM tests, Blargg test ROMs — used for
    hardware accuracy verification, freely
    redistributable per their licenses).
  - **Commercially-released-as-free** titles (e.g.
    Cave Story, certain Atari/Activision retro
    releases).
  - **Modern commercial titles only with explicit
    license** — never ROM dumps without permission.

  The offer is durable; the ask is gated on
  implementation phase.

  **Phased approach:**
  - **Phase 0** — research + emulator class survey
    (Game Boy / NES / SNES / Genesis / GBA classes;
    libretro framework as candidate emulator-class
    interface; rr / Pernosco as rewind-substrate
    research).
  - **Phase 1** — single canonical emulator on the
    OS-interface durable-async runtime (Game Boy
    most likely — smallest hardware-accurate model,
    well-documented, public test ROMs).
  - **Phase 2** — rewindable/retractable controls
    surfaced through the emulator + propagated as
    OS-interface primitives.
  - **Phase 3** — ARC-3 absorption-scoring loop
    activated on the testbed.
  - **Phase 4** — multi-emulator + cross-emulator
    composition (your save state in Game Boy + their
    save state in NES, joined as a Z-set view).

  **Composes with:**
  - **OS-interface row** (PR #399 cluster) — the
    durable-async runtime that hosts the emulator
    event loop.
  - **Otto-73 retractability-by-design** — the
    substrate this work generalizes.
  - **Otto-238 retractability-as-trust-vector** —
    rewindable controls grant user agency.
  - **Z-set retraction-native semantics** — the math
    layer that makes rewind first-class.
  - **DST (Otto-272)** — replay-determinism makes
    save-states bit-equal across rewinds.
  - **2026-04-22 ARC-3 adversarial-self-play
    research** — this row activates it.
  - **Closure-table hardening** (#396) — durable
    state hierarchy for save-state index.
  - **Cross-DSL composability** (#397) — emulator
    state composes with SQL queries (e.g. "every
    frame where Mario was in this Y-range").

  Priority P3 / way-back-backlog (depends on
  OS-interface Phase 1 landing first); effort M
  (Phase 0 research) + L+L+L (per implementation
  phase). Composes with `request-play` skill (the
  emulator-as-play permission), `glass-halo-architect`
  (visible state for replay analysis), Otto-275
  log-don't-implement (this row is the capture).

  **Does NOT authorize:** loading any ROM into the
  repo prior to maintainer hand-off + license
  verification. Does NOT authorize claiming
  rewindable controls are "trivial" — the
  retraction-native generalization to OS-level
  semantics is genuine research work.
- [ ] **OS-interface — durable-async sequential-looking
  code that runs "everywhere"; AddZeta one-line DI;
  serverless with state-by-default; LINQ/Rx stream
  composition; ties to Reaqtor; usermode-first
  microkernel preparation; actor as secondary; cross-
  paradigm canonical examples; distributed event loop
  with mathematical guarantees.** Maintainer 2026-04-24
  directive (full verbatim preserved in companion
  memory `feedback_os_interface_durable_async_addzeta_2026_04_24.md`).
  Maintainer self-flagged: *"this is a big and not very
  clear ask please backlog and untangle"*.

  **The thesis:** the OS-interface is the killer UX for
  beginners. User code looks like normal sync I/O — read,
  query, send, await — but actually durable-async,
  cluster-distributed, state-persisting, replay-on-fail.
  When asked *"where does it run?"* the answer is
  *"everywhere"*.

  **Class membership:** Temporal / AWS Step Functions /
  Azure Durable Functions / Cadence / Restate / DBOS /
  Inngest / Trigger.dev. All implement
  looks-sequential-actually-durable. Zeta variant: built
  on our own substrate, integrates Reaqtor's IQbservable
  expression-tree machinery, hard prerequisite is DST-
  determinism (Otto-272 — already factory default; "we
  will fit in perfect").

  **DX target:** `services.AddZeta()` — single line, full
  power. Modeled on `AddDbContext` / `AddHttpClient` /
  `AddOpenApi`. Ceremony in user code is a sign the
  thesis has drifted.

  **Stream composition:** DI inject `IZetaStream<T>` and
  combine with LINQ/Rx in user code. Sequential-looking
  reads compile to distributed Rx with durable
  continuations. Reaqtor is available via the upstream-
  sync workflow (manifest `references/reference-sources.json`
  + script `tools/setup/common/sync-upstreams.sh`); the
  populated mirror at `references/upstreams/reaqtor/` is
  gitignored and only present after sync. Reaqtor's
  IQbservable serialization machinery — DON'T reinvent.

  **Microkernel preparation:** maintainer-explicit:
  *"usermode everything to get ready"* — build every
  microkernel-class subsystem in usermode first, with
  tests, then promote when (a) test maturity (b)
  all-dotnet/F# direction lands. Composes with the
  user-mode FUSE filesystem driver row.

  **Actor interface (secondary):** maintainer-explicit:
  *"harder to think about for beginners unless your
  problem directly maps"*. Two-tier UX — durable-async
  is default; actor is opt-in for problems that
  naturally model as message-passing (Akka/Orleans/
  Erlang class).

  **Cross-paradigm canonical examples (combinatorial):**
  for every DSL pair (SQL × git, SQL × operator-algebra,
  LINQ × blockchain, Rx × WASM, etc.) at least one
  canonical example. *"in sql there should be a git
  table and/or maybe git built-in function or something
  to make git first class in SQL. and combinatorial
  that for all our different things."* The combinatorial
  example matrix IS the Phase-0 deliverable for the
  cross-DSL composability row that landed in #397.

  **Distributed event loop with mathematical
  guarantees:** maintainer-explicit:
  *"guarantees here are good if we can mathematically
  provice them"*. Targets for Lean / TLA+ proof —
  liveness (every event eventually completes /
  durably-fails), safety (no event processed twice
  without explicit retry semantics), determinism-
  preservation (DST inputs → bit-equal outputs across
  replays), causality (happens-before preserved across
  distributed dispatch). Composes with `tla-expert`,
  `lean4-expert`, `distributed-consensus-expert`,
  `calm-theorem-expert`.

  **Auto runtime optimization:** runtime keeps stats
  per await — latency, hot continuations, durability
  cost, cross-node hops. Optimizer places continuations
  near data, inlines short-await chains, batches
  durability writes, migrates hot streams to faster
  nodes.

  **Phased approach:**
  - **Phase 0** — Untangle research:
    `docs/research/os-interface-durable-async-addzeta-2026.md`.
    Reaqtor deep-dive + Temporal/Step-Functions/Restate
    comparative survey + IQbservable expression-tree
    serialization study + DST-fit verification + AddZeta
    DX prototype API sketch + cross-paradigm example
    matrix scoping.
  - **Phase 1** — Single-machine usermode prototype:
    `AddZeta()` + minimal durable-async runtime, in-
    memory state, no cluster, just the await-state-
    machine intercept.
  - **Phase 2** — Multi-node prototype with closure-
    table-hardened durable state (#396) across nodes,
    protocol-upgrade (#395) engaged.
  - **Phase 3** — `IZetaStream<T>` LINQ/Rx surface,
    cross-DSL canonical examples per the combinatorial
    matrix.
  - **Phase 4** — Actor interface as opt-in alternative;
    distributed-event-loop invariants formally verified.
  - **Phase 5** — Microkernel promotion of stable
    usermode subsystems (gated on (a) test maturity,
    (b) all-dotnet/F# direction).

  **Composes with the entire 2026-04-24 cluster:**
  bootstrap thesis (#395), native F# git (#395),
  protocol upgrade (#395), permissions registry (#395),
  cross-DSL composability (#397), closure-table
  hardening (#396), Ouroboros bootstrap (#395),
  blockchain ingest (#394), FUSE filesystem driver,
  Otto-272 DST-everywhere (the maintainer-explicit
  hard prerequisite), Otto-274 progressive-adoption-
  staircase (the OS-interface IS Level 0), 2026-04-22
  semiring-parameterized operator algebra (the math
  substrate).

  Priority P2 research-grade (maintainer flagged the
  whole thing as "backlog and untangle"); effort L+
  Phase 0 (research + Reaqtor study + API sketch) +
  L per implementation phase. Composes with `llm-systems-expert`,
  `streaming-incremental-expert`, `rx-expert`,
  `linq-expert`, `fsharp-expert`, `csharp-expert`,
  `query-optimizer-expert`, `metrics-expert`, the
  formal-verification stack, and the cross-DSL +
  bootstrap clusters above.

  **Does NOT authorize:** implementation start before
  Phase 0 untangle research lands; designing the actor
  interface before durable-async is shaped; promoting
  any usermode subsystem to kernel-mode without
  maintainer sign-off; compromising DST as a hard
  prerequisite (the entire durable-async semantics
  depend on it).

- [ ] **Cross-DSL composability — git / SQL /
  operator-algebra / LINQ access each other seamlessly
  with full index utilization.** Maintainer 2026-04-24
  directive (verbatim):

  > *"i would love to be able to see git as composable
  > with the rest of the DSLs too so they all can access
  > each other seamlessly and still hit indexes and get
  > all the performanes and everyting. backlog and
  > draing this one and contineue"*

  Scope: every first-class interface on Zeta's
  substrate (git, SQL, operator algebra, LINQ, future
  GraphQL / blockchain query / WASM-RPC) must compose
  with every other interface. A query that mixes git
  semantics + SQL semantics + operator-algebra
  semantics in a single expression should:
  1. **Parse + bind** through the unified type system.
  2. **Plan** through the cost-based query optimizer
     (`query-optimizer-expert`) which sees the full
     mixed-DSL AST.
  3. **Hit indexes** for each constituent DSL (the
     hierarchical index from the
     closure-table-hardening row, the row-index from
     SQL, the operator-algebra's incremental view
     materialized, etc.).
  4. **Execute** with retraction-native semantics
     preserved end-to-end (a git-revert in the input
     stream produces a Z-set retraction in the output).

  **Cross-DSL examples (motivating use cases):**
  - "SQL JOIN where left side is a git log query and
    right side is a Z-set delta from operator algebra."
  - "Git push where the tree is computed by a SQL
    SELECT over Z-sets."
  - "LINQ query over a blockchain block stream
    correlated with git commits."
  - "Operator-algebra incremental view that consumes
    git commits AND SQL inserts, fans out into
    multiple downstream Z-sets."

  **Architectural primitives required:**
  - **Unified AST** spanning all DSLs (or
    cross-translation matrix between DSL ASTs).
  - **Plan-time optimizer** that sees the mixed
    expression and chooses the right index per leaf.
    Composes with `query-planner` +
    `query-optimizer-expert` + `binder-expert` (need a
    `binder-cross-dsl` capability).
  - **Adapter pattern** between DSLs at the algebraic
    layer — the operator algebra's D/I/z⁻¹/H operators
    must commute with git's commit/branch/merge AND
    SQL's relational operators (this is where
    K-relations / semiring-parameterized Zeta
    substrate from the prior research becomes
    load-bearing — same algebra hosts all the
    other DSLs).
  - **Retraction-preserving translation** at every
    boundary.

  **Composes with (load-bearing):**
  - **Closure-table hierarchical index** — the
    `Hierarchy.fs` closure-table operator
    (`src/Core/Hierarchy.fs`) plus the "Closure-table
    over DBSP" research row in this same `docs/BACKLOG.md`
    under `## Research projects` (paper-grade target:
    "first retraction-native incremental transitive
    closure with tropical-semiring shortest-path free
    variant"). The hierarchical index this query layer
    hits.
  - **Native F# git implementation** (#395) — git as
    first-class DSL.
  - **Mode 2 protocol-upgrade negotiation** (#395) —
    fast protocol carries cross-DSL queries.
  - **Ouroboros bootstrap meta-thesis** (#395) —
    cross-DSL composability is itself an Ouroboros
    closure: the system's interfaces compose with
    themselves through the same substrate.
  - **Semiring-parameterized Zeta substrate** — the
    "one algebra to map the others" frame from the
    2026-04-22 maintainer auto-loop-38 thread (memory:
    `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`).
    This row is a direct application of that
    research-changing claim: if the operator algebra
    is parameterized by a semiring, every other DSL's
    semantics maps into the same one algebra by
    semiring-swap, and the cross-DSL composability
    falls out for free.
  - **Blockchain ingest** (#394) — chain queries
    compose with git/SQL queries via the same
    substrate.

  **Phased approach:**
  - **Phase 0** — design proposal:
    `docs/research/cross-dsl-composability-2026.md`.
    Interface map between every pair of DSLs.
    Identify the canonical algebra (the operator
    algebra under semiring-param) as the unifying
    layer. Empirically verify a representative
    cross-DSL query plans + executes correctly on a
    small workload.
  - **Phase 1** — pairwise adapters: git ↔ SQL, SQL
    ↔ operator-algebra, etc.
  - **Phase 2** — unified planner / binder.
  - **Phase 3** — index-utilization audit: every
    leaf-DSL must hit its native index in mixed
    expressions.
  - **Phase 4** — retraction-preservation at every
    boundary (formal proof or property-based
    verification).

  Priority P2 research-grade; effort L+ (Phase 0
  research) + L+L+M+L (Phases 1-4). Composes with
  Otto-275 log-don't-implement.

  **Does NOT authorize** starting implementation
  without Phase 0 research landing. **Does NOT
  authorize** declaring composability "done" without
  empirical evidence that mixed-DSL queries hit ALL
  applicable indexes (no full-scan fallback for
  composed leaves).

- [ ] **Blockchain block ingestion — first-class BTC /
  ETH / SOL streaming into Zeta's distributed database;
  bi-directional protocol participation; cross-chain
  stream bridge.** Maintainer 2026-04-24 directive
  (verbatim):

  > *"i would love to test our database by having first
  > class support for bitcoin, eth, and solana blocks
  > into our database in the order of priority unless you
  > tell me there are other ones worth exploring for two
  > reason, 1 to help us understand blockchain for Aurora
  > we don't want to just jump in and we will be starting
  > from scriatch so making sure we completely understand
  > everysing thing about the blocks are important so we
  > get ours right. can you make a post install script
  > that will streaing ingest these block chains into our
  > database and make them querable will all our entry
  > points/intefaces backlog. this is not a full node
  > implimentation or anyting yet that will come leter
  > layed on top of our multinode database so we can have
  > distributed node support from the start cause we are
  > on top of our distributed db. we can stick a ui in
  > front of that too lol. Also you need to do a lot of
  > research here cause some nodes will try to call you a
  > bad node if you don't hame some amount of the full
  > protocol, they give extra tests exactly to try to
  > stop this freeloader scenaro where you download but
  > dont upload, you can look at their source code to
  > figure it out. Also if you have to do full nodes of
  > those types to be able to download we have to upload
  > too go ahead and to that, i want those interfaces too
  > just like our SQL interfaces and i also want deep
  > integration into those networks so we can 'bridge'
  > them in streams and maybe further. backlog"*

  **Two load-bearing motivations:**
  1. **Aurora preparation** — Zeta's own blockchain-ish
     substrate (Aurora / Lucent-KSK lineage per the
     existing memory cluster) wants concrete grounding
     before we design the Aurora chain shape. Ingesting
     real BTC / ETH / SOL blocks into our database gives
     us deep understanding of the actual data model
     before we specify ours.
  2. **Database stress-test** — BTC / ETH / SOL are
     three of the most battle-tested streaming workloads
     on the planet (continuous append, chain
     reorganizations, finality semantics, adversarial
     environment). If Zeta's distributed DB can absorb
     them live and serve queries through the existing
     interfaces, that's a load-bearing proof of the
     substrate.

  **Priority order (maintainer-specified):** BTC → ETH →
  SOL. Priority is authoritative; additional chains
  (Cosmos Hub / Polkadot / Cardano / Avalanche / L2
  rollups like Base / Optimism / Arbitrum) should be
  evaluated in a later phase, not reordered.

  **Phased plan (scope decomposition — each phase a
  future dedicated PR or PR cluster; this row is the
  umbrella):**

  **Phase 0 — Research pass (no code; starts the work):**
  - Read the actual client source for each chain:
    `bitcoin/bitcoin` (C++), `ethereum/go-ethereum`
    + `paradigmxyz/reth` (Go + Rust), `solana-labs/solana`
    (Rust). Map the block shape verbatim; capture field
    semantics (timestamps / merkle roots / witness data /
    slot-vs-block distinctions / SOL's entries-within-slot
    model).
  - Identify **misbehavior / freeloader detection** per
    chain — specifically what each client does to detect
    a download-only peer and how it penalizes / bans.
    Key sources: BTC's `net_processing.cpp` DoS scoring,
    ETH's devp2p / Snap-sync reciprocity tests, SOL's
    turbine-shred forwarding requirements. This
    determines whether **Phase 2 full-node participation
    is REQUIRED or OPTIONAL** per chain.
  - Identify what's pullable WITHOUT running a full node:
    BTC block explorer APIs + Electrum + public RPC;
    ETH public RPC + Alchemy/Infura snapshot archives;
    SOL public RPC + warehouse archive (Google BigQuery
    has a public SOL blocks dataset). This bounds the
    Phase 1 scope.
  - Produce `docs/research/blockchain-ingestion-phase-0-bitcoin.md`,
    `docs/research/blockchain-ingestion-phase-0-ethereum.md`,
    `docs/research/blockchain-ingestion-phase-0-solana.md`.

  **Phase 1 — Post-install block-ingestion script
  (NOT a full node):**
  - Post-install script under `tools/setup/blockchain-ingest/`
    (composes with GOVERNANCE §24 three-way-parity
    install script). Per-chain: `bitcoin.sh`,
    `ethereum.sh`, `solana.sh`.
  - Each script streams blocks via public RPC / explorer
    APIs into Zeta's distributed DB as Z-set entries —
    retraction-native (chain reorgs are first-class
    retractions; our substrate was designed for this).
  - Schema-design: use the paced-ontology-landing
    discipline; each chain gets a dedicated ontology
    (block / transaction / log / witness / slot /
    entry-vs-block-vs-shred) and the cross-chain
    umbrella ontology comes later (Phase 4).
  - Queryable through all existing entry points: SQL
    binder, operator algebra, LINQ, any future
    GraphQL / REST surface. NO new interface class
    unique to blockchain; re-use what Zeta already has.
  - `dotnet run -- --chain bitcoin --from-height N
    --to-height latest --follow` shape.

  **Phase 2 — Full-node protocol participation
  (CONDITIONAL on Phase 0 finding):**
  - If Phase 0 research shows that the target chain's
    client BANS download-only peers after a window
    (true for BTC's DoS scoring, likely for ETH's Snap
    sync, and definitely for SOL's turbine),
    implement the minimum UPLOAD side of the protocol
    to stay a good network citizen.
  - Maintainer directive is explicit: *"if you have to
    do full nodes of those types to be able to download
    we have to upload too go ahead and to that, i want
    those interfaces too just like our SQL interfaces"*.
    Upload-side interfaces expose as first-class Zeta
    interfaces on par with SQL — not private internals.
  - Architecturally this is **full-node-layered-on-top
    of Zeta's distributed DB** (maintainer's explicit
    frame), not a standalone fork of bitcoind / geth /
    solana-labs. We use Zeta as the storage / consensus
    / query substrate and implement the chain protocol
    ON TOP of it. Distributed-node support falls out of
    Zeta's multi-node primitives for free.
  - This is where Zeta's distributed-consensus substrate
    (`distributed-consensus-expert` / `raft-expert` /
    `paxos-expert` / `calm-theorem-expert` /
    `replication-expert`) becomes load-bearing.

  **Phase 3 — Cross-chain stream bridge:**
  - Deep integration per maintainer: *"deep integration
    into those networks so we can 'bridge' them in
    streams and maybe further"*.
  - Bridge = Z-set operator composition across chain
    streams. Each chain is a ZSet; cross-chain joins
    produce derived ZSets (e.g. Bitcoin timestamp vs
    Ethereum block for time alignment; SOL finality vs
    ETH finality for comparative-consensus research).
  - "Maybe further" = likely cross-chain atomic ops,
    value-transfer bridges, or unified-view layers;
    scope intentionally open at this phase.
  - Composes with `distributed-coordination-expert` +
    `crdt-expert` + `gossip-protocols-expert`.

  **Phase 4 — UI:**
  - Per maintainer: *"stick a ui in front of that too
    lol"*. Frontier-UX / former-Starboard-now-rename-
    target (kernel-A farm-related + kernel-B
    carpentry-related per the 2026-04-24 rename
    directive) — cross-chain block explorer + streaming
    dashboard + cross-chain bridge visualizer as initial
    surfaces.

  **Additional chains worth evaluating in a later phase**
  (do NOT reorder the primary BTC/ETH/SOL priority):
  - **Cosmos Hub** — IBC is a canonical cross-chain
    bridging primitive; directly relevant to Phase 3.
  - **Polkadot** — substrate chain + parachain
    composition = close architectural cousin to Zeta's
    multi-node + cross-chain design.
  - **Cardano** — Ouroboros PoS pedagogy (Ouroboros is
    the most formally-verified consensus protocol
    deployed at scale).
  - **Avalanche** — sub-net architecture is a real
    distributed-systems primitive worth studying.
  - **L2 rollups** (Base / Optimism / Arbitrum / zkSync
    Era / StarkNet) — bridge-to-ETH substrate; good
    study material for Phase 3 bridging.

  **Priority / effort:** P2 research-grade; umbrella
  effort is L (phased across many rounds). Phase 0 is
  M (three research docs, deep source reading). Phase 1
  per-chain is M-L each (ingest script + schema +
  retraction-native integration). Phase 2 per-chain is
  L each (full-node protocol on top of Zeta). Phase 3
  is L+ (cross-chain bridge). Phase 4 is S (UI on top
  of existing query surface).

  **Composes with:** Aurora substrate (all Lucent-KSK +
  Aurora ferry absorbs), paced-ontology-landing (one
  ontology per chain), `distributed-consensus-expert` +
  sibling consensus hats (Phase 2), GOVERNANCE §24
  install-script discipline (Phase 1 post-install),
  Otto-175c rename directive (the Frontier-UI surface
  for Phase 4), Otto-275 log-don't-implement (this row
  is the capture, not the kickoff).

  **Does NOT authorize:** starting implementation yet —
  Phase 0 research is the gate. Does NOT authorize
  expanding scope to additional chains before BTC / ETH
  / SOL are understood. Does NOT authorize running a
  live Zeta instance on mainnet without Aminata
  threat-model sign-off on the network-exposure surface
  (Phase 2 only).
- [ ] **Mode 1 admin UI — SSMS/pgAdmin-class local
  management UI for Zeta.** Maintainer 2026-04-24
  directive (verbatim):

  > *"for mode 1 we want a front end ui like ssms/pgadmin
  > but really designed for us"*

  Distinct from the Frontier-UI / kernel-A/kernel-B
  web-facing surface (per the 2026-04-24 rename
  directive). This is the **operator/admin local UI** —
  desktop-class management surface modelled on SQL
  Server Management Studio + pgAdmin but designed
  idiomatically for Zeta's substrate (Z-set
  retraction-native semantics, operator-algebra
  composition, multi-node distributed-state, the git
  interface, etc.). Scope: query workbench, schema
  browser, connection manager, retraction-native delta
  visualizer, plan inspector for the query optimizer,
  multi-node topology view, ontology browser per
  paced-ontology-landing, stream/pipeline live view.

  Two-UI architecture going forward:
  - **Web-facing Frontier-UI (kernel-A/kernel-B)** —
    public-user-facing surface.
  - **Local admin UI (this row)** — operator/admin
    surface, ships with Mode 1 single-file binary.

  Priority P2 / research-grade (UX + design lead time);
  effort L (full app). Composes with the Mode 1
  bootstrap thesis (single-file AoT/JIT executable),
  the git-as-DB-interface row below, and Otto-274
  progressive-adoption-staircase.

- [ ] **Ouroboros bootstrap — meta-thesis +
  connection-map work for the 2026-04-24 cluster.**
  Maintainer 2026-04-24 directive (verbatim):

  > *"oraborus bootstraping exact integrations and
  > connections and all that to make sure we can do it
  > right"*

  Meta-thesis: **the system bootstraps itself**. Native
  F# git impl stores its own commits as Z-sets in its
  own database. Permissions registry tracks the
  authority for its own creation. Memory-sync uses
  memory-sync. Mode 2 hosts the factory dashboard that
  operates on Mode 2. Bootstrap-thesis changes land as
  retraction-native deltas in our own substrate. Test
  using ourselves. Three load-bearing properties:
  provenance is closed under the substrate; every
  integration is testable from the inside;
  self-consistency is a detectable invariant.

  **Cardano pedagogy double-meaning preserved** — the
  Cardano consensus protocol is called Ouroboros (most
  formally-verified deployed PoS); when the
  blockchain-ingest work activates, the protocol
  research reinforces the bootstrap thesis at a
  different level (same self-referential property,
  same name). Naming overlap is intentional, not
  accidental.

  **Connection-map work** (Phase 0 deliverable, owed
  before any new architecture lands):
  `docs/research/ouroboros-bootstrap-connection-map-2026.md`
  — directed graph of factory components (Mode 1
  binary / Mode 2 WASM / native git impl / admin UI /
  factory ops dashboard / Frontier-UI / permission
  registry / memory-sync / etc) with edges as
  explicit integration contracts (wire protocols,
  file formats, authority dependencies). Self-loops
  in the graph ARE the Ouroboros closures — must be
  explicitly identified and justified.

  **Maintainer's standard:** *"exact integrations and
  connections to make sure we can do it right"* —
  implementation work on any 2026-04-24 directive
  should not start without the integration shape
  drawn. Hand-waved "Mode 2 talks to Mode 1 somehow"
  is insufficient.

  **Composes with all 2026-04-24 directives in the
  same session:** the rename (#393), blockchain
  ingest (#394), Mode 1 admin UI + native F# git +
  protocol upgrade + permissions registry + UI split
  (this PR / #395). Companion memory file
  `memory/feedback_ouroboros_bootstrap_self_reference_meta_thesis_2026_04_24.md`
  captures verbatim directive + the bootstrap
  property's three load-bearing claims + composition
  with each peer directive.

  Priority P2 hygiene (gates implementation of the
  others); effort M (connection-map research doc) +
  S (cross-link from the other 2026-04-24 rows) +
  ongoing (every new architecture row should declare
  its closure stance). Composes with
  `holistic-view`, `glass-halo-architect`,
  `category-theory-expert` (for the formal
  closure-property framing), Otto-275
  log-don't-implement.

- [ ] **Mode 2 UI architecture split — admin UI vs
  factory-ops-dashboard vs web-facing Frontier-UI;
  research required + maintainer review.** Maintainer
  2026-04-24 directive (verbatim):

  > *"so mode 2 is the ssms/pgadmin ui for mode 1 and
  > the operations dashboard for the factory too both?
  > or we split into two uis right? IDK we needs some
  > clean dependences splits research here, i'd like to
  > review tooo when its done."*

  Three candidate UI surfaces have surfaced in the
  2026-04-24 directives so far (see the rows above and
  the rename row in #393):

  - **Frontier-UI / kernel-A + kernel-B (web-facing
    public surface)** — public-user-facing surface,
    "Star-Trek-computer-but-better"-class. Per the
    rename directive: farm-related kernel-A +
    carpentry-related kernel-B. Audience: end-users
    consuming Zeta as a product.
  - **SSMS/pgAdmin-class admin UI** — database
    operator surface. Audience: database
    administrators, query-optimizer reviewers,
    multi-node topology managers.
  - **Factory operations dashboard** — Zeta-the-
    factory-not-Zeta-the-product surface. Audience:
    factory maintainers (the human maintainer + Otto
    + future contributors). PR queue, build state,
    round progress, research absorbs, hygiene-history,
    counterweight-audit reports, agent dispatch,
    drain-log visualizer.

  **Loop-agent preliminary read** (subject to
  maintainer review):

  - Frontier-UI is **definitely separate** — its
    audience is end-users, not operators. Different
    UX language, different feature set, different
    deploy cadence (public-facing → conservative;
    factory-internal → fast iteration). Keeping it
    distinct preserves the rename-directive's two
    seed-extension kernels (kernel-A farm + kernel-B
    carpentry) that shrink-over-time.
  - **Admin UI vs factory-ops-dashboard is the
    interesting split.** Two readings:
    - **Reading A — single surface, modular tabs.**
      Mode 2 is one app; admin and factory-ops are
      modules within it. Cheapest to ship; some UX
      coherence risk (the audiences are different
      enough that a shared chrome may feel forced).
      Composes with the bootstrap thesis (one
      browser-only artifact serves both).
    - **Reading B — two surfaces, shared component
      library.** Admin UI and factory-ops-dashboard
      are distinct Mode 2 apps that share a
      component library (auth, navigation, theme,
      query widget, plan inspector). More UX
      coherence per audience; higher engineering
      cost; both ship from the same monorepo.
  - **My preliminary recommendation: Reading B**
    (two surfaces, shared library). Audiences differ
    enough that forcing one chrome harms both. The
    shared component library captures the
    composability-cost gain without the
    audience-blur risk. The admin UI ships with
    Mode 1 binary (operator-side); the factory-ops
    dashboard ships at the factory-maintainer level
    (Otto + human maintainer access only). Frontier-
    UI stays its own app (already separate by
    rename-directive).

  **Three-app architecture (Reading B, expanded):**
  - **App A — Frontier-UI (kernel-A/kernel-B)**:
    public; web-facing; conservative deploy.
  - **App B — Admin UI (Mode-1-bundled)**: ships
    with Mode 1 single-file binary; operator
    audience; database-management-class UX.
  - **App C — Factory ops dashboard**:
    factory-maintainer audience; PR/build/round/
    drain-log/counterweight-audit visualizer.
  - **Shared library**: WASM-F# component primitives
    (auth, theme, query widget, plan inspector,
    multi-node topology view, retraction-aware
    delta visualizer).

  **Research scope (Phase 0, output:
  `docs/research/mode-2-ui-architecture-split-2026.md`):**
  - Map audience needs per app (interviews / persona
    sketches).
  - Identify shared primitives vs app-specific
    surfaces.
  - Decide chrome strategy (one shell with tabs vs
    three shells).
  - Define dependency boundaries — what each app
    pulls from the shared library, what it owns.
  - Enumerate Mode 1 vs Mode 2 distribution per app
    (admin UI is Mode-1-bundled; ops dashboard might
    be either; Frontier-UI is web-only).
  - Propose recommendation; flag tradeoffs;
    explicitly mark "maintainer review required
    before any UI implementation work starts."

  Priority P3 / way-backlog (no UI implementation
  before this research lands and maintainer reviews);
  effort M (research doc) + L+ (each app once design
  approved). Composes with the rename directive
  (Frontier-UI naming), the Mode 1 admin UI row, the
  protocol-upgrade row (any of the three apps may
  use the upgraded fast protocol once connected to
  a Mode 1 backend), `user-experience-engineer`
  (audience research), `developer-experience-engineer`
  (factory-ops UX), Otto-275 log-don't-implement.

- [ ] **Named-permissions registry — per-contributor
  scoped permission grants for factory agents.**
  Maintainer 2026-04-24 directive (verbatim):

  > *"we shoud probbably have a list of named
  > permissions you might need and thier names and
  > descriptions and which ones are active for which
  > contributro. this in not super safe yet but we can
  > nake it more safe over time."*

  Scope: a registry that names every operational
  authority the factory agents might need (admin-level
  GitHub ops, secret access, branch-protection edits,
  repo settings PATCH, ruleset CRUD, workflow dispatch,
  etc.) and tracks which contributor has granted which
  named permission to which agent role. Iterative
  hardening — start permissive, layer on confirmation
  / quorum / time-bounded grants over time.

  **Inaugural named permission:** `github-admin`
  granted by the human maintainer 2026-04-24 to the
  loop-agent role (Otto). Captured durably in
  `memory/feedback_github_admin_authority_grant_to_loop_agent_2026_04_24.md`
  per the maintainer's "save as durable" directive.

  **Initial draft of named permissions** (this list
  expands as new authorities get exercised):

  - `github-admin` — branch protection PATCH, repo
    settings PATCH, ruleset CRUD, workflow dispatch.
    Granted to: loop-agent (2026-04-24, durable).
    Excludes: org-level admin, repo deletion, member
    management, force-push to main, bypass branch
    protection on a single PR.
  - `github-org-admin` — org-level settings + member
    management. NOT granted yet.
  - `github-secrets` — Actions secrets and Dependabot
    secrets read/write. NOT granted yet.
  - `force-push-main` — bypass branch protection for
    emergency cases. NOT granted yet (preserve linear
    history discipline).
  - `nuget-publish` — push packages to nuget.org under
    Lucent identity. NOT granted yet.
  - `slsa-signing-key` — sign release artifacts. NOT
    granted yet (requires HSM).
  - `external-network-egress-broad` — fetch from
    arbitrary URLs (beyond the prompt-protector
    allowlist). NOT granted yet.

  **Registry shape (proposed):**

  Live at `docs/AUTHORITY-REGISTRY.md` (factory-
  authored; current-state doc). One section per named
  permission with: name, description, scope (in/out
  of), granted-to (contributor → agent-role), grant
  date, durability (session / cross-session), audit
  link (memory file or commit). One section per
  agent-role rolling-up which permissions it has.

  **Iterative hardening path:**
  - Phase 0 — registry exists (this row's first
    deliverable); no enforcement, just documentation.
  - Phase 1 — agent self-checks the registry before
    attempting an admin operation.
  - Phase 2 — commit-message / PR-description
    citation requirement (the action commit names the
    grant).
  - Phase 3 — time-bounded grants (e.g.
    `github-admin` expires every 30 days; maintainer
    re-grants).
  - Phase 4 — quorum requirements for high-risk
    permissions (e.g. force-push needs both
    maintainer + threat-model-reviewer sign-off).
  - Phase 5 — Aminata threat-model integration: each
    permission has a documented adversarial scenario
    + mitigation.

  Maintainer is explicit that this is NOT super safe
  YET — the gain comes from iterative hardening.
  Capture-the-grant-and-cite-it discipline beats
  silent expansion of authority.

  Priority P2 hygiene; effort S (Phase 0 registry doc)
  + S (Phase 1 self-check) + M (Phase 2 citation
  enforcement) + L (Phases 3-5 hardening). Composes
  with `governance-expert`, `threat-model-critic`,
  `security-operations-engineer`, GOVERNANCE.md
  numbered rules section.

- [ ] **Mode 2 → Mode 1 protocol-upgrade negotiation —
  start with git, upgrade to a faster protocol for
  hot-path backend comm.** Maintainer 2026-04-24
  directive (verbatim):

  > *"we could use mode 2 as our ui and have it auto
  > netogatie protocol upgrade to a better protocol that
  > git to whatever we want for hight speed communicaiton
  > with out backend i think thats cleans"*

  Architectural pattern: ALPN-style / HTTP-Upgrade-style
  protocol negotiation. Mode 2 (browser WASM) opens with
  git as the **lowest-common-denominator bootstrap
  protocol** (every Zeta instance speaks git natively per
  the row above). Once the connection is established and
  both sides confirm capability, negotiate an upgrade to
  a faster Zeta-specific binary protocol for hot-path
  traffic (high-throughput streaming, low-latency reads,
  bulk pull/push). Git stays as fallback / audit-trail
  /durable-substrate path.

  **Why this is clean:**
  - Cold-start: any browser + any git remote → instant
    bootstrap (no protocol negotiation cost paid until
    you have a connection).
  - Warm-state: protocol-upgraded comm is fast (binary
    framing, no commit-object overhead, streaming
    semantics, server-push for live updates).
  - Backwards-compatible: an unupgraded peer (e.g. an
    actual git client, not a Zeta peer) still works —
    it never asks for the upgrade.
  - Audit-trail: even after upgrade, the durable layer
    can checkpoint back to git on cadence (every N
    operations or every commit boundary), so the git
    history remains the canonical durable substrate.

  **Reference patterns:**
  - HTTP `Upgrade:` header + 101 Switching Protocols.
  - ALPN over TLS (HTTP/2 negotiation).
  - Postgres wire-protocol startup-message + protocol-
    version negotiation.
  - WebSocket initial-HTTP-handshake-then-upgrade.

  **Capability advertisement:** standard pattern is for
  the server to advertise capabilities in its first
  response (e.g. git's `capabilities^{}` ref or
  `command=ls-refs` advertisement); Zeta extends this
  to include a `zeta-fast-v1` capability. Client opts
  into upgrade by sending the corresponding header on
  next request.

  **Composes with:**
  - The native F# git implementation row above (where
    Zeta IS the git client/server) — the upgrade
    capability gets advertised by Zeta's git server.
  - The WASM-F# + git-as-storage row below (Mode 2's
    starting position).
  - `networking-expert`, `serialization-and-wire-format-expert`,
    `streaming-incremental-expert`.

  Priority P3 / way-backlog (depends on the native git
  impl row landing first); effort M (capability
  advertisement + upgrade dance) + L (the actual fast
  protocol design + implementation). Composes with
  Otto-275 log-don't-implement.

- [ ] **Native F# git implementation — Zeta IS the git
  client/server (no external git needed).** Maintainer
  2026-04-24 directive (verbatim):

  > *"we want to have a full git implimentation in f#
  > where we don't even need the git client, we are
  > also the git client and it stores into our database
  > for mode 1. just another interface like SQL"*

  Zeta-native git implementation in F# — full git
  protocol (object format, pack files, refs, index,
  smart-HTTP / SSH transport, push/pull negotiation,
  upload-pack / receive-pack server side). Storage
  lands in Zeta's database (Mode 1) — git objects
  serialize as Z-set entries with commit/tree/blob
  ontology. Pairs with the WASM/git-storage row below
  for Mode 2 (where isomorphic-git is the browser-side
  client).

  **Symmetric architecture:**
  - **Mode 1** — native F# git impl + Zeta DB storage.
    Zeta talks git natively to other peers. No external
    git binary required.
  - **Mode 2** — WASM-F# + isomorphic-git in browser +
    git remote (could be ANOTHER Zeta-Mode-1 instance
    serving git).

  **Composition gain:** any Zeta Mode 1 instance can
  serve as a git remote for any Zeta Mode 2 browser
  client. The factory becomes self-hosting of its own
  git ecosystem — `git push my-zeta main` = pushing to
  Zeta's DB via Zeta's own git server.

  **"just another interface like SQL"** — maintainer's
  framing. Git is one of several first-class
  protocols on top of Zeta's substrate, alongside SQL,
  operator algebra, LINQ, GraphQL (future), etc.
  Implementation effort is L+ (the git protocol is
  large but fully specified; Z-set
  retraction-native semantics map cleanly).

  Priority P3 / way-backlog per maintainer; effort L+
  (full git protocol coverage). Composes with the
  git-as-DB-interface row below (sister; same
  direction), the WASM/git-storage row (companion for
  Mode 2), `fsharp-expert`, `git-workflow-expert`,
  `serialization-and-wire-format-expert`. Composes
  with `networking-expert` for the HTTP/SSH transport
  layer.

- [ ] **Git-as-first-class-DB-interface — Zeta commands
  ≈ git commands where semantics align.** Maintainer
  2026-04-24 directive (verbatim, low-priority backlog):

  > *"we want to have first class git inteface into our
  > database, so our database can handle all / most git
  > command, way backlog."*

  Scope: an interface adapter that exposes Zeta DB
  operations through git's command surface where
  semantics align — `commit` = transaction boundary,
  `branch` = isolated workspace, `merge` = multi-writer
  reconciliation, `log` = history / retraction trail,
  `diff` = delta query, `tag` = named-checkpoint,
  `stash` = pending-write buffer, `cherry-pick` =
  selective transaction replay. Z-set retraction-native
  semantics map cleanly onto git's
  immutable-history-with-revertible-deltas model.
  Explicit mapping table needed (not every git command
  has a Zeta analogue — `gc` / `fsck` are git-internal).
  Composes with Otto-243 (git-native memory-sync — proves
  substrate-level fit) and the WASM/git-storage row
  below. Adds ONE entry-point; existing SQL / operator-
  algebra / LINQ surfaces stay authoritative. Priority
  P3 / way-backlog per maintainer; effort M+L. Composes
  with `git-workflow-expert`.

- [ ] **WASM-F# + git-as-storage-plugin — browser-only
  bootstrap mode (zero server, zero install).**
  Maintainer 2026-04-24 directive (verbatim,
  long-horizon research stretch goal):

  > *"a storage plugin for our db that saves to git
  > commonds lol. this will let me compile as wasm our
  > f# and run our database enginge in the ui and it
  > calls out to git for the actual operations? Am i
  > dreaming for this second one? We should research it
  > but it's a huge stretch way back backlog for the
  > 2nd one."*

  **Maintainer's framing question:** *"This complets
  our bootstrap without requirments really i think? you
  tell me."*

  **Loop-agent assessment** (captured for future
  reference; subject to maintainer challenge):

  - **Yes, this completes the zero-server bootstrap —
    via a different axis than Mode 1.** Both modes are
    zero-install:
    - **Mode 1** — full backend via tiny-seed AoT-
      compiled or single-file JIT builds. Standalone
      executable; NO .NET preinstall required. Just
      download + run. (Maintainer correction
      2026-04-24: existing planning is for tiny-seed
      AoT + single-file JIT, not framework-dependent
      builds.)
    - **Mode 2** — browser-only via WASM-F# + any git
      remote. NO executable to download (browser
      handles WASM); NO server to run.
    Browsers are universal; git remotes are commodity
    (GitHub/GitLab free tier; self-hosted git is
    trivial). Mode 2 is "even more zero" only in the
    sense that there's no artifact to download — both
    modes are install-free at the user-experience
    level.
  - **Not a dream — coherent stretch.** Pieces compose:
    - WASM-F# in the browser is real today via Blazor
      WebAssembly (the .NET runtime compiled to
      WebAssembly, hosting F# directly). Fable is a
      separate F#→JavaScript option (not a WASM runtime)
      and is listed only as the alternative if a JS
      target is preferred over .NET-on-WASM. Mode 2's
      intended approach is Blazor WASM. Performance
      workable for non-hot-path; hot-path needs
      in-browser cache.
    - `isomorphic-git` brings the git protocol to the
      browser; pairs with WASM-F#.
    - Z-set entries serialize as commit blobs / tree
      objects; retractions = `git revert` or branch
      reset.
    - Multi-writer = git's branch-and-merge model
      (CRDT-friendly under Z-set semantics).
    - Composes with Otto-243 (git-native memory-sync)
      as precursor pattern.
  - **Wild bit is performance.** Git ops NOT fast
    enough for DB hot-path reads. But for **durable
    writes + cross-machine sync + audit trail**, git
    is genuinely good. Mode 2 architecture is
    "browser viewer + git-backed durable substrate;
    hot-path lives in browser memory" — not "every
    read hits git".
  - **Strong fit with Otto-274 progressive-adoption-
    staircase Level 0** — "open a tab; no install" is
    the lowest-friction adoption rung the factory has
    yet articulated.
  - **Real risk: write-amplification.** Every Zeta
    write becomes a git commit. High-throughput
    streams (e.g. blockchain ingest) would saturate
    any git remote. Mode 2 suits LOW-VOLUME workloads
    (per-user notebooks, factory memory sync,
    configuration, knowledge bases). Mode 1 stays
    load-bearing for production / streaming.

  **Phased approach** (when this row activates):
  - **Phase 0** — feasibility research: WASM-F#
    runtime cost, isomorphic-git API surface, write
    batching strategies, hot-path cache shape. Output:
    `docs/research/wasm-fsharp-git-storage-feasibility.md`.
  - **Phase 1** — proof-of-concept: minimal in-browser
    Zeta with git-backed Z-set storage on a single
    test workload (personal notebook). No streaming,
    no multi-user.
  - **Phase 2** — multi-user via git branches; merge
    semantics for concurrent writes; conflict
    resolution UX.
  - **Phase 3** — production-mode hardening: write
    batching, hot-path cache eviction, server-fallback
    for high-throughput.

  Priority P2 / research-grade per maintainer
  (long-horizon stretch goal — section placement
  matches);
  effort L+ (research) + L (POC) + L (production).
  **Does NOT authorize** starting POC code without
  Phase-0 feasibility doc landing first. **Does NOT
  authorize** declaring Mode 2 production-ready
  without empirical write-throughput + read-latency
  measurements + Aminata threat-model sign-off on the
  exposed-git-remote attack surface.

  Composes with the git-as-DB-interface row above
  (sister; same direction), `wasm` (no skill exists yet
  — gap), `fsharp-expert`, `git-workflow-expert`,
  `crdt-expert`, Otto-243 (git-native memory-sync
  precursor), Otto-274 (progressive-adoption-staircase
  Level 0 candidate), Otto-275 (log-don't-implement —
  capture, do not start POC).
- [ ] **Closure-table hardening for fast-git — pluggable
  hierarchical index supporting full filesystem-class
  workloads.** Maintainer 2026-04-24 directive (verbatim):

  > *"our hierarchy closure table or whatever we called it
  > is going to have to get hardened to support a full
  > filesystem basically to support fast git i think, at
  > least we will need this hierarciacal index for fast
  > lookups and efficent storage we can make and interface
  > and plug in somethign faster than the closer table if
  > needed this was the first abstraciton i thought of.
  > i've not looked at space or time tradeoffs. backlog
  > research"*

  **Context.** The native F# git implementation
  (`#395` cluster) needs a hierarchical index over
  filesystem-class data: tree objects nest blobs, blobs
  nest in directories, directories nest in directories,
  every commit references a root tree. Git operations
  fan out massively over this hierarchy (`git log -- path`,
  `git diff` on subtrees, `git ls-tree`, `git
  cat-file`, `git fast-import`). Without an
  efficient hierarchical index, native git
  performance won't compete with libgit2 / cgit.

  Maintainer's first-abstraction-thought: extend the
  existing closure-table primitive to handle
  filesystem-shape workloads. Make it
  **plug-pointable** so a faster implementation can
  swap in if profiling shows the closure-table is the
  bottleneck.

  **Research scope (Phase 0):**
  - Survey closure-table state-of-the-art for
    deep/wide hierarchies (filesystem trees can be
    100k+ files deep / wide). Reference patterns:
    nested-set / materialized-path / closure-table /
    ltree (Postgres) / B-tree-prefix-index / radix-trie.
    Compare space (storage cost per descendant
    relationship) vs time (lookup / update / range-query).
    Map each to git's actual workload distribution
    (read-heavy: `ls-tree` + `cat-file` are far more
    common than `commit-tree`).
  - Survey alternative substrates worth interface-
    compatibility for swap-in:
    - **B-trees (page-oriented)** — proven at fs scale
      (ZFS / btrfs / NTFS).
    - **Radix tries** — Patricia / HAMT / CRDT-tree;
      good for prefix-style path queries.
    - **Verkle trees / Merkle Patricia tries** —
      cryptographically-verifiable, important for
      git's content-addressed model + future Aurora
      integration.
    - **Dolt / TerminusDB substrates** — these
      systems already speak git-style commits over a
      versioned-DB model; their internal hierarchical
      indexes are direct evidence of feasibility.
  - Define the interface that the closure-table
    currently exposes vs the interface a "fast" index
    would need (what's the minimal `IHierarchicalIndex`
    contract that supports git's operation set?).
  - Empirical: pick a representative repo's tree
    (Linux kernel? Chromium? Zeta itself?) and
    benchmark the current closure-table at scale to
    establish the baseline.
  - Output: `docs/research/closure-table-hardening-
    fast-git-2026.md` with: state-of-the-art survey
    (table of trade-offs), Zeta-specific workload
    map, proposed `IHierarchicalIndex` interface,
    baseline benchmark, recommended implementation
    path (harden current closure-table OR swap to
    alternative substrate).

  **Composes with:**
  - **Native F# git implementation** (#395 cluster) —
    primary consumer of the index.
  - **Mode 2 protocol-upgrade negotiation** (#395) —
    upgraded fast protocol can leverage faster index.
  - **Ouroboros bootstrap** (#395 meta-thesis) — the
    git impl uses the index to store its own commits
    in the same database; index correctness is part
    of the closure proof.
  - **Blockchain ingest** (#394) — chain blocks form
    their own hierarchy (block header → transactions
    → logs); same index abstraction may serve both
    git AND blockchain workloads.

  Priority P2 research-grade; effort M (Phase 0
  research + benchmark) + L (implementation if
  hardening path chosen) OR L+L (if substrate-swap
  path chosen). Composes with `database-systems-expert`,
  `storage-specialist`, `key-value-store-expert`,
  `crdt-expert`, `category-theory-expert` (the
  hierarchical index is structurally an Ouroboros
  closure property — this row's existence is itself
  the meta-thesis at work).

  **Does NOT authorize** starting implementation
  without Phase 0 research landing. **Does NOT
  authorize** declaring closure-table sufficient
  without empirical benchmarks at filesystem scale
  (100k+ files).

- [ ] **Land per-maintainer CURRENT-memory ADR + companion
  feedback memory.** PR #153 landed the CLAUDE.md fast-path
  pointer at the per-user `CURRENT-<maintainer>.md`
  distillation pattern, but the supporting docs the original
  draft cited were never landed. The two intended targets are
  `docs/DECISIONS/2026-04-23-per-maintainer-current-memory-pattern.md`
  and
  `memory/feedback_current_memory_per_maintainer_distillation_pattern_prefer_progress_2026_04_23.md`.
  PR #153 review left the pointer in CLAUDE.md but removed
  the dead links; this backlog row tracks landing the actual
  ADR (per-user vs in-repo split, role-ref filename
  discipline per the "No name attribution in code, docs, or
  skills" rule in `docs/AGENT-BEST-PRACTICES.md`, same-tick
  update rule, conflict-precedence over raw `feedback_*.md`)
  so the pattern has a citable substrate beyond CLAUDE.md
  prose. Companion feedback memory captures the original
  human-maintainer framing.

- [ ] **Land an explicit list of history-class files
  (carve-out registry).** Maintainer 2026-04-24 directive
  triggered by PR #375 thread on `docs/pr-preservation/375-drain-log.md`:
  *"first names are fine in history like files is this a
  history like file / make sure to add an explicit list of
  history files including this one now somewhere backlog"*.
  The "No name attribution in code, docs, or skills" rule
  in `docs/AGENT-BEST-PRACTICES.md` (around BP-284) carves
  out history files but the carve-out has no enumeration —
  reviewer bots (and fresh-session subagents) cannot
  mechanically tell whether a given file qualifies, which
  produced the false-positive on #375. Scope: (1) add an
  explicit list under the rule body in
  `docs/AGENT-BEST-PRACTICES.md` enumerating the
  history-class roots —
  `docs/hygiene-history/**`,
  `docs/ROUND-HISTORY.md`,
  `docs/DECISIONS/**`,
  `docs/pr-preservation/**` (Otto-250 PR-preservation),
  `docs/aurora/**` (verbatim ferry absorbs),
  `docs/research/**` (verbatim research absorbs),
  `memory/**` (per-fact memory entries with provenance);
  (2) add the same enumerated list to
  `docs/FACTORY-DISCIPLINE.md` so subagents reading the
  agent-visible rule index see it; (3) add a one-line
  decision rule for ambiguous future files
  ("the file's purpose IS the audit trail" → history-class).
  Priority P2 hygiene; effort S (single-PR doc edit
  across two files). Composes with Otto-237 IP-discipline
  adoption-vs-mention (registries need specifics to be
  enforceable) and Otto-250 PR-preservation
  (`docs/pr-preservation/**` is the new history-class
  member that triggered this).

- [ ] **`install.sh --lint-only` fast-path OR lint-job
  cache backport — lint-job 5-min timeout risk when
  full-install runs on cold runner.** Copilot P0 on PR
  #375 (Thread `PRRT_kwDOSF9kNM59hqnf`,
  `.github/workflows/gate.yml:243`): `lint (shellcheck)`
  and `lint (actionlint)` now run the full
  `./tools/setup/install.sh` before the actual lint
  command, but the job timeout is still 5 minutes and
  there are NO cache restore steps in these jobs (unlike
  `build-and-test` which caches `~/.local/share/mise`).
  `install.sh` installs mise + all runtimes/tools in
  `.mise.toml` (dotnet, python, java, bun, uv, lint
  tools), which on a cold runner is unlikely to complete
  in 5 min, making the required lint checks prone to
  timeout flakes. Two mitigation paths:
  (a) **Backport the cache block** from `build-and-test`
  to the `lint (shellcheck)` and `lint (actionlint)`
  jobs (copy the `actions/cache` step keyed on
  `.mise.toml` + `runner.os` + `runner.arch`). Zero API
  change; reduces cold-runner risk; steady-state after
  first green main run is fast.
  (b) **Add `install.sh --lint-only` flag** that
  installs ONLY the lint tool the job actually needs
  (`actionlint` / `shellcheck` via mise) rather than
  the full declarative manifest. Touches the
  three-way-parity script's API surface (dev laptop /
  CI runner / devcontainer) and wants a dedicated
  review per GOVERNANCE §24.
  Priority P2 hygiene (not blocking PR #375; mise-cache
  on build-and-test jobs warm-starts the runtime cache
  for subsequent runs); effort S (option a) or S+S
  (option b with devops-engineer review). Composes with
  GOVERNANCE §24 three-way-parity install-script
  discipline and Otto-213 (runner-version-freshness).
  **Does NOT authorize** extending PR #375's scope to
  include either fix — the narrow thread-drain
  resolution is BACKLOG-and-resolve per Otto-236; fix
  lands in a dedicated follow-up PR.

- [ ] **Tier the missing-file search-surfaces list by
  usefulness.** PR #391 landed an organized-by-class list
  in `docs/FACTORY-DISCIPLINE.md` (six classes: in-tree /
  git-managed / in-repo factory state / GitHub-side /
  out-of-repo agent state / local-machine + external).
  The flat-by-class layout is good for COMPLETENESS but
  not for ORDER-OF-OPERATIONS — an agent hunting a
  missing file should hit the highest-yield surfaces
  first. Maintainer 2026-04-24 directive: *"nice that's
  super detailed, maybe split it into tiers of usefulness
  backlog"*. Scope: (1) define tier classes — Tier-1
  *first place to look* (`git status`, `git log --all`,
  `git stash list`, `gh pr list`, `git worktree list`),
  Tier-2 *common second-pass* (reflog, `git fsck
  --lost-found`, closed-not-merged PRs, in-repo factory
  state surfaces), Tier-3 *recovery / forensic*
  (Time Machine, APFS snapshots, Trash, IDE
  local-history, xattrs, terminal scrollback,
  diagnostic reports), Tier-4 *external-substrate*
  (sibling LFG repos, gists, courier-ferry imports
  pre-absorption); (2) reorganize the section into a
  tiered checklist while preserving the by-class
  context as a secondary view; (3) add a "first
  command to run" hint per tier (e.g. Tier-1 starts
  with `git status && git log --all -- <path>`).
  Priority P2 hygiene; effort S (doc reorganization +
  add tier headers + first-command hints). Composes
  with Otto-230 fresh-session-quality-gap and the
  search-surfaces section it refines.

- [ ] **Separation-audit cross-PR rollup — automate `## Audit — ...` count verification.** Codex reviewer Otto (2026-04-24) on PR #190 originally flagged that the pattern-summary table in `docs/frontier-readiness/factory-vs-zeta-separation-audit.md` listed ALIGNMENT / FACTORY-HYGIENE / TECH-RADAR as completed classifications even though those sections then lived only in sibling PRs (#185 + #188). PR #188 has since merged, ALIGNMENT classification was corrected from `factory-generic` to `both (coupled)` to match the in-file audit section, and all 15 audits now have dedicated `## Audit —` sections (verifiable via `grep '^## Audit — '`). The residual discipline question — "completed" audits counted in a file's summary should be mechanically reproducible from that file's own contents — remains for the **future**: as new audits land via separate PRs, the same drift can recur. Remaining option: (c) add a tooling / CI check that diffs pattern-summary claims against `grep '^## Audit — '`. Options (a) wait-for-merge and (b) per-PR summary-row landings have resolved naturally for the first 15 audits. Priority P2 research-grade; effort S (tooling). Composes with glass-halo transparency + audit-as-source-of-truth principle.

- [ ] **KSK naming definition doc — `docs/definitions/KSK.md` leading with canonical expansion `KSK = Kinetic Safeguard Kernel`.** **Authority: Aaron Otto-140 rewrite approved; Max attribution preserved as initial-starting-point contributor (Otto-77).** Amara 2026-04-24 (16th courier ferry, GPT-5.5 Thinking) flagged the naming ambiguity: *"'KSK' has multiple possible meanings: DNSSEC-style Key Signing Key, your emerging Kinetic Safeguard Kernel / trust-anchor idea, maybe broader 'ceremony + root-of-trust + governance key' structure."* Aaron Otto-142..145 (self-correcting Otto-141 typo "SDK") canonicalized: *"kinetic safeguare Kernel, i did the wrong name / it is what amara said / kinetic safeguard kernel"* — matches Amara's 5th and 16th ferry phrasing. Doc scope: (1) lead sentence *"KSK = Kinetic Safeguard Kernel. 'Kernel' here is safety-kernel / security-kernel sense (Anderson 1972, Saltzer-Schroeder reference-monitor, aviation safety-kernel) — a small trusted enforcement core, **NOT OS-kernel-mode** (not ring 0, not Linux/Windows kernel)"*; (2) "Inspired by..." DNSSEC KSK / DNSCrypt / threshold-sig ceremonies / security-kernel lineage; (3) "NOT identical to..." OS kernel, DNSSEC KSK (signs zone keys); (4) cross-refs to 5 ferries elaborating architecture; (5) Max attribution: *"Initial starting point committed by Max under Aaron's direction in LFG/lucent-ksk; substrate is Aaron+Amara's concept, completely rewritable."* (Otto-140 lifted the Max-coordination gate; Otto-77 attribution stands.) Priority P2 research-grade (elevated from P3); effort S (doc) — coordination overhead removed. Composes with Amara 17th-ferry correction #7 (now resolved), Otto-77 Max attribution, Otto-90 Aaron+Max-not-gates, Otto-140..145 Aaron canonical expansion + gate-lift, Otto-108 single-team-until-interfaces-harden.

- [ ] **.NET 10 Server GC crash on Apple Silicon — bullet-proof investigation + upstream report (Otto-248 workaround follow-up).** Shipped mitigation in PR #376 (`DOTNET_gcServer=0` on Apple Silicon Darwin via `tools/setup/common/shellenv.sh`) is a WORKAROUND, not a root-cause fix. Three SIGSEGV crashes captured 2026-04-24 at `~/Library/Logs/DiagnosticReports/dotnet-2026-04-24-*.ips` — all in `libcoreclr.dylib` Server GC (`SVR::gc_heap::{plan_phase, background_mark_simple1, find_first_object, revisit_written_page}`) with `EXC_BAD_ACCESS / KERN_INVALID_ADDRESS / "possible pointer authentication failure"` on macOS 26.4.1 MacBook M2 + .NET SDK 10.0.203 (latest). Current hypothesis: concurrent-mark-phase invariant violation, possibly write-barrier or card-table race; Apple Silicon ARM64 PAC surfaces it as SIGSEGV where x86 would silently corrupt. Two known related upstream fixes on dotnet/runtime `main` but NOT yet in release/10.0: `#126389` (Jan Vorlicek, 2026-04-01, BGC mark phase wrong-join — fixes *hangs* not crashes; symptom mismatch) and `#126929/#126977` (largepages corruption fix — open port-to-10.0 PR). Per maintainer directive 2026-04-24 Otto-254 ("roll forward, not backward" + escro absorb-and-contribute dependency-maintenance per `project_escro_maintain_every_dependency_microkernel_os_endpoint_grow_our_way_there_2026_04_22.md`). Work scope: (1) build minimal deterministic repro — F# allocation-heavy Server GC program that reliably crashes on Apple Silicon, clean under Workstation GC; (2) measure crash rate across Apple-Silicon-Darwin vs ubuntu-24.04-arm vs x86 legs (differentiates Scenario A Apple-specific vs Scenario B ARM64-general); (3) read coreclr GC source at crash symbols (now split across `plan_phase.cpp`, `background.cpp`, `mark_phase.cpp` per 2026-Q1 refactor; sparse-checkout sibling `../runtime` already pulled for offline navigation); (4) file upstream `dotnet/runtime` issue with IPS files + reproducer IF deterministic + professional (not a dick per maintainer directive); (5) track upstream fix; (6) remove `DOTNET_gcServer=0` workaround once fix lands in a release/10.0 SDK patch. Priority P2 research-grade — workaround prevents daily blocker but the fix is escro-scope dependency maintenance. Effort M (repro + source read) + S (upstream file) + S (patch-landed cleanup). **Does NOT authorize:** reverting the workaround before upstream fix lands; filing upstream before reproducer is deterministic.

- [ ] **DST-marker convention + lint rule — call out tests that are NOT fully deterministic-simulation-testing (DST) conformant.** Aaron 2026-04-24 directive *"mark you test, there is some lint rule to call out why a test is not DST fully"*. Today we have Otto-248 (never-ignore-flakes-per-DST) discipline but no mechanical marker + lint to surface which tests violate DST. Examples in current tree: `tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs` "Uniform traffic" test uses `HashCode.Combine` (process-randomized) — breaks determinism; other tests likely have similar non-obvious violations. Scope: (1) decide marker shape — F# attribute `[<NonDST("<reason>")>]`? Trailing `// DST-exempt: <reason>` comment? Per-test metadata file? Suggestion: comment pattern + semgrep rule (lowest-friction); (2) write semgrep rule matching test functions (`[<Fact>]` / `[<Property>]` / `[<Theory>]`) without a sibling DST-exempt marker, output a warning "unmarked test — add `// DST-exempt: <reason>` if intentional or fix the determinism gap"; (3) initial backfill — sweep existing tests, mark known-non-DST (SharderInfoTheoretic, any others surfaced by #327 + sibling reviews) with reason; (4) compose with Otto-248 flake-discipline (marker converts "every flake must be diagnosed" from aspirational to mechanically-enforceable). Priority P2 hygiene; effort S (semgrep rule + backfill sweep) + S (documentation in `docs/FACTORY-HYGIENE.md`). **Does NOT authorize:** blanket "all tests must be DST" — some tests genuinely measure stochastic properties and exempt status IS correct; the rule is about *marking*, not about fixing every flag.

- [ ] **SharderInfoTheoreticTests "Uniform traffic" flake — process-hash-randomization root cause + deterministic-threshold fix.** Aaron 2026-04-24 Otto-132 flag: *"SharderInfoTheoreticTests.Uniform (not seed locked, falkey, DST?)"*. Test lives at `tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs` (module `Zeta.Tests.Formal.SharderInfoTheoreticTests`). **Corrected root-cause hypothesis (PR #327 review):** the test is an xUnit `[<Fact>]`, not an FsCheck property — it already uses `Random 42` for key generation, so the flake is *not* lack of FsCheck seed-lock. Actual suspected causes, in priority order: (1) **`HashCode.Combine` is process-randomized** — .NET's `HashCode` uses a per-process random seed (hash-randomization mitigation), so `uint64 (HashCode.Combine k)` differs across runs even with identical keys; the downstream `JumpConsistentHash.Pick` then yields a different shard distribution each run, and the `max/avg < 1.2` assertion trips on unlucky seeds; (2) tolerance is overly tight for a 100k-sample, 16-shard Zipf baseline — 1.2× is ~2σ territory on finite samples; (3) nondeterministic iteration order in `Array.init` closures if `rng.Next` is ever called concurrently (not the current shape, but a future-drift risk). Scope: (1) replace `HashCode.Combine` with a seeded deterministic hash (`XxHash64` / FNV with explicit seed) or a fixed-salt wrapper; (2) widen tolerance with justification (Wilson interval or measured 99th-percentile across N CI runs) rather than arbitrary 1.2; (3) sweep sibling Sharder tests for the same `HashCode.Combine` pattern; (4) document the "no process-randomized hashes in deterministic tests" rule as a hygiene row; (5) quantify flake rate from historical CI. Priority P2 research-grade (blocks other PRs' auto-merge when it trips). Effort S + S. **Does NOT authorize:** blanket `HashCode.Combine` ban outside tests (prod paths may legitimately want hash-randomization); widening tolerance without empirical justification.

- [ ] **Schema-as-Graph — entire database schema as first-class typed graph.** Aaron 2026-04-24 Otto-127: *"would it be possible to have a graph view of the entire table and relations so the whole schema is first class i the graph plus we could have special edge node whatever else we need entities if needed for more fidelity than reguarl sql table structrue and relationships allow. backlog"*. Natural extension of Graph substrate (PR #317 + #324). Scope: (1) schema-node types — Table/Column/Index/Constraint/View/StoredProcedure/Trigger; (2) schema-edge types — ForeignKey/Contains/References/DependsOn/InheritsFrom; (3) custom entity types beyond SQL — Domain/Aggregate/EventStream/Retraction (first-class "removed" with timestamp)/Provenance; (4) round-trip SQL↔Graph invariants; (5) bidirectional — Graph mutations emit DDL; DDL mutates Graph. Schema-change-over-time = Graph event stream w/ retraction-native. Aminata BP-11 threat-pass. Priority P2; effort M+M+L.

- [ ] **Ongoing memory-sync mechanism — keep in-repo `memory/` mirrored with auto-memory writes during each Otto tick.** Aaron 2026-04-24 Otto-113 directive *"our memories should all be checked in now"* + Otto-114 confirmation that in-repo memory/ is the natural home for ALL memory types. Otto-113 one-shot sync (PR #307) mirrored 439 files. Going forward, every Otto tick that writes to `~/.claude/projects/.../memory/` should also land new/updated files in-repo `memory/` with matching MEMORY.md pointer update (per memory-index-integrity + memory-reference-existence-lint workflows). Proposed mechanisms: (a) end-of-tick skill that rsyncs new memories to a branch + PRs them; (b) direct-to-repo writes with auto-memory as read-cache; (c) GHA cron periodic sync. Initial preference: (a) for CLI-tool compatibility today, (b) long-term. Also includes path-unification design (decide whether to deprecate the `~/.claude/projects/...` path for this project entirely or keep as staging). Priority P2 research-grade; effort S (rsync skill) + M (direct-write tooling). Composes with `memory/feedback_natural_home_of_memories_is_in_repo_now_all_types_*.md` (Otto-114 policy) + PR #307 one-shot sync + memory-index-integrity workflow.

- [ ] **"Frontier" naming conflict with OpenAI Frontier
  — rename factory's UI-layer "Frontier" to something
  non-conflicting.** Aaron 2026-04-24 Otto-168: *"i just
  found this
  https://openai.com/index/introducing-openai-frontier/
  ... naming conflicts ... also absorb everyting lol, it
  composes nicely ... backlog"*.

  **OpenAI Frontier scope (Otto-169 WebSearch):** launched
  2026-02-05 as an **enterprise AI-agent platform** for
  building, deploying, and managing AI agents at
  enterprise scale. Not internal research, not a model
  name — a full product in the agent-orchestration space.
  Interoperates with agents from OpenAI, enterprises,
  Google / Microsoft / Anthropic (third-party). Initial
  enterprise customers: Uber, State Farm, Intuit, Thermo
  Fisher Scientific. Frontier Partners program (AI-native
  builders: Abridge, Clay, Ambience, Decagon, Harvey,
  Sierra). Frontier Alliances program (consulting giants:
  Accenture, Boston Consulting Group, Capgemini,
  McKinsey). Companion feature "Workspace Agents"
  (successor to custom GPTs; plugs into Slack, Salesforce,
  etc.).

  **Conflict severity: HIGH.** The OpenAI Frontier
  product is in exactly the agent-orchestration / UI-
  layer space where the factory's "Frontier UI / Frontier
  UX" operates (Star-Trek computer but BETTER, user-
  facing surface for agents). Consulting partnerships
  guarantee the OpenAI Frontier name will be widely
  disseminated in enterprise-AI procurement conversations
  in 2026. Shipping Zeta's UI publicly under "Frontier"
  would create immediate brand confusion with a
  well-capitalized competitor.

  **Regardless of the specific OpenAI product shape,**
  the factory's public-facing "Frontier UI / Frontier UX"
  name creates brand confusion if Zeta's UI ships
  publicly under that name. Action: rename the factory's
  user-facing surface to something non-conflicting;
  preserve technical-literature and industry-term uses
  of "frontier" (three-class distinction below).

  **Scope — three classes of "Frontier" usage
  (137 grep hits total):**

  (a) **CONFLICTING (must rename).** Factory's public-
  user-facing UI layer name:
  - Primary UX design doc:
    `docs/research/frontier-ux-zora-evolution-2026-04-24.md`
  - "Frontier UI" + Frontier burn-rate-UI concept,
    cross-referenced in the plugin-inventory row below
    (no standalone BACKLOG row yet — the concept lives in
    memory pointers and is referenced inline here)
  - Memory pointer (concrete file in
    `memory/MEMORY.md`):
    `memory/feedback_aaron_dont_wait_on_approval_log_decisions_frontier_ui_is_his_review_surface_2026_04_24.md`
    and siblings

  (b) **TECHNICAL-LITERATURE (keep).** "Frontier" as
  established term in timely-dataflow / differential-
  dataflow / DBSP academic lineage:
  - `docs/WATERMARK-RESEARCH.md` — Timely-Dataflow
    antichain frontier + `Frontier<int64>` type
  - `docs/research/retraction-safe-semi-naive.md` —
    "frontier/partial-order composition (Naiad §3)"
  - `docs/research/bloom-filter-frontier.md` — "research
    frontier" = cutting-edge-design-space metaphor

  (c) **INDUSTRY-TERM (keep).** "Frontier model" /
  "frontier LLM" / "frontier moves fast" — generic AI-
  industry vocabulary:
  - `docs/research/harness-run-*.md` "frontier-model
    baselines"
  - `docs/research/claude-cli-capability-map.md`
    "frontier research" tier descriptor
  - `docs/research/hacker-conferences.md` "frontier LLM
    red-team work"
  - `memory/feedback_frontier_confidence_*` — frontier-
    environment confidence (different sense entirely)

  **Rename candidates (Otto proposes; naming-expert
  persona + Aaron final call):**
  - **Zora** — already in UX design doc filename
    (`frontier-ux-zora-evolution`); inherits directly;
    preserves Star-Trek-computer-but-BETTER design
    language.
  - **Starboard** — Star Trek bridge-facing term +
    navigation nod; Zeta-native coinage.
  - **Bridge** — simple, Star-Trek-adjacent, no known
    major product conflict.
  - **Horizon** — thematic sibling to "Frontier";
    Windows NT Horizon VDI minor conflict.
  - **Vantage** — clean of conflicts; less thematic.
  - **Aurora** — already in factory naming triangle
    (Aurora+Zeta+KSK); conflating could leak UI into
    governance-layer conceptual space. Not
    recommended.

  **Action sequence:**
  1. ~~Fetch + summarize OpenAI Frontier announcement~~
     DONE Otto-169 WebSearch (see scope block above).
  2. ~~Assess conflict severity.~~ DONE Otto-169:
     **HIGH** — direct overlap in agent-orchestration /
     UI-layer space + enterprise-consulting-partnership
     distribution channels.
  3. Naming-expert persona consultation on candidates;
     weight factors include trademark risk, voice
     consistency with Zora/Star-Trek design language,
     alignment with Aurora/Zeta/KSK naming triangle.
  4. Aaron final call on new name.
  5. Repo-wide rename PR: UX design doc + BACKLOG rows
     + memory pointer updates. Class (b) + (c) usages
     untouched.
  6. Memory entry locking the new name canonically +
     archiving the "Frontier" period as pre-Otto-168
     history.

  **Non-actions:**
  - Do NOT rename technical-literature "frontier"
    usages (broader community vocabulary).
  - Do NOT rename industry-term "frontier model" /
    "frontier LLM" usages.
  - Do NOT ship the rename same-tick as discovery.
    Naming decisions that affect public branding
    deserve deliberate treatment.
  - Do NOT unilaterally pick a name from Otto's
    candidate list. Aaron is the concept owner.

  **Composition (per Aaron "composes nicely").**
  Composes with:
  - Primary rename target — "Zora" in filename is one
    candidate:
    `docs/research/frontier-ux-zora-evolution-2026-04-24.md`
  - BACKLOG "Frontier plugin inventory" row (directly
    below) — cross-reference update post-rename.
  - Aurora / Zeta / KSK naming triangle — rename slots
    into this ecosystem without adding a fourth brand
    (see `docs/definitions/KSK.md` (proposed, landing via
    the "KSK naming definition doc" BACKLOG row above),
    Amara 5th / 7th / 16th ferries).
  - DST + Cartel-Lab + Veridicality internal module
    names — unaffected (not public-UI).

  Priority P1 (active brand conflict); effort S
  (rename PR) + S (naming-expert) + S (OpenAI Frontier
  scope research).

- [ ] **Frontier plugin inventory + in-source discipline — catalogue the plugins Zeta's factory needs for the Frontier UI + substrate (both `.claude-plugin/` and `.codex-plugin/`), restructure around the new skill-vs-plugin best practices, and enforce that all plugins land in-source rather than in harness-local sandboxes.** Aaron 2026-04-24 Otto-103 directive: *"we should backlog what plugins we need for frontier, seems like a big opportunity to restruture for new best practices and everyting else, we also wanna make sure our plugins are making it into source and not some harness sandbox. backlog."*

  **Context.** After session restart Aaron flagged five Codex built-in skills (Image Gen / OpenAI Docs / Plugin Creator / Skill Creator / Skill Installer) + asked Otto to figure out skills-vs-plugins distinction. Otto-103 research (PR #290, `docs/research/codex-builtins-skills-vs-plugins-factory-integration-2026-04-24.md`) established: **plugin = distribution/installation unit (JSON manifest + bundle); skill = single capability unit (SKILL.md)**. Plugins are containers; skills are contents. This row goes further — catalogue what plugins the factory itself needs.

  **Aaron Otto-103 refinement (same tick as the `backlog` directive):** *"the plugins are probabaly just some sort of continer of our exsiting skills based on some orginalizaion groups but i don't really know you can reasarsh and do whatever is best if there are best practices see if there is a open ai plugin guide or anthropic plugin design guide, we should map it out well and if there are not best practices we will define them lol."* This refinement (a) confirms the container-of-skills framing from Otto-103 research, (b) explicitly authorises web-research on OpenAI + Anthropic plugin-design guides as Phase 1 input, and (c) gives Otto permission to DEFINE best practices (factory-level ADR) if upstream guidance is thin. Research phase MUST cite upstream guides where they exist and propose-a-standard-for-debate where they don't — cross-reference Claude Code + Codex official docs, `openai/skills` repo, Anthropic developer platform, any OWASP / NIST plugin-security norms, and the skill-vs-plugin conclusions from Otto-103.

  **The in-source-not-sandbox discipline (hard requirement).**

  Harness-local plugin caches — `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` for Claude Code, Codex's equivalents — are per-user / per-machine ephemeral state. Aaron's directive: **Zeta-authored plugins live in the Zeta repo**, not in those caches. Concrete implications:

  1. Any plugin the factory authors + maintains must have its manifest (`.claude-plugin/plugin.json` or `.codex-plugin/plugin.json`) + its bundle contents (`skills/**`, `commands/**`, `agents/**`, `.mcp.json`, `.app.json`) checked into the Zeta repo.
  2. Enabling a factory-authored plugin via `~/.claude/settings.json` `enabledPlugins` or the Codex marketplace pointing at the repo counts as in-source discipline — the manifest + bundle MUST be in the repo, not just the enable-row.
  3. Third-party plugins consumed by the factory (e.g., the Anthropic-distributed ones Zeta currently has enabled in `.claude/settings.json`) STAY third-party-source; this discipline is about factory-AUTHORED plugins.
  4. A migration path exists for any factory-authored content currently living only in a harness-local sandbox: move it to `.claude/skills/**` + `.claude-plugin/plugin.json` (or `.codex/skills/**` + `.codex-plugin/plugin.json`) and open a PR.

  **Candidate plugin inventory for the factory.**

  This row intentionally does NOT pre-commit to what plugins should exist — that's the research + Aaron-review part. Initial candidates to research:

  1. **`zeta-codex-plugin`** (the Otto-103 A/B/C question). In-tree manifest at `.codex-plugin/plugin.json` pointing at existing `.codex/skills/**` (Option B from Otto-103) is the likely shape if we ship this. Aaron's call per Otto-103 specific-ask.
  2. **`zeta-claude-plugin`** (parallel for Claude Code). Currently Zeta's `.claude/skills/**` is unbundled; a `.claude-plugin/plugin.json` at repo root would make the skill suite installable as a single plugin. Useful for other projects that want to consume Zeta's skill library.
  3. **`frontier-UI-plugin`** (speculative; ties to the Frontier burn-rate-UI concept cross-referenced in the Frontier-naming-conflict row above). Plugin that surfaces Zeta's factory state (tick-history / memory-index / alignment-trajectory-plot / PR-queue-health) to the Frontier UI surface. Requires the Frontier UI to exist first; not a near-term deliverable.
  4. **`zeta-decision-proxy-plugin`** (PR #222 decision-proxy-evidence schema). Plugin exposing the `docs/decision-proxy-evidence/` substrate as first-class tooling for any agent (Otto / future Codex Otto / Aminata / etc.) that needs to file evidence records.
  5. **`zeta-drift-detector-plugin`** (future; depends on the provenance-aware-bullshit-detector implementation from 8th-ferry arc landing). Plugin wrapping SD-9 + DRIFT-TAXONOMY pattern 5 + citations-as-first-class + the bullshit-detector. Would give any agent a `$drift-check` invocation.

  **Research phase tasks (before any plugin lands):**

  1. **Read `openai/skills` + `developers.openai.com/codex/plugins/build`** + Claude Code plugin docs + Anthropic plugin-design guide (if one exists) thoroughly — already partially done in Otto-103; expand. Per Aaron's Otto-103 refinement, if no authoritative guide exists on either side, Phase 1 proposes a factory-level best-practices ADR for debate. Cite upstream where it exists; propose-a-standard where it doesn't.
  2. **Audit existing `.claude/skills/**` and `.codex/skills/**`** — classify each into "wants its own plugin", "belongs in an existing plugin", "stays as bare skill". Output: classification matrix.
  3. **Map factory needs to plugin candidates.** Where does each of the 5 candidates above fit on the A/B/C axis (no-plugin / in-tree-manifest / separate-repo)?
  4. **Discipline audit.** Survey whether any factory-authored content currently lives ONLY in a harness-local sandbox. If yes, file migration PRs.
  5. **Best-practices restructure proposal.** Per Aaron's "big opportunity to restructure for new best practices and everything else" — what else should move to plugin-shape that's currently unstructured? ADR candidates for each.

  **Phase gates (like PR #230 / PR #239 / PR #233 pattern):**

  - **Phase 1 — design doc** (authorised, timing Otto's call): `docs/research/factory-plugin-inventory-and-restructure-plan-YYYY-*.md` with classification matrix + 5-candidate plugin inventory + best-practices-restructure proposal.
  - **Phase 2 — Aminata threat-model pass** (BLOCKING): plugins as attack surface (supply-chain / permission-escalation / dependency-on-sandboxed-state); in-source discipline as compensating control.
  - **Phase 3 — Aaron personal review** (BLOCKING): Aaron reviews design + picks the plugins to actually build + signs off on restructure scope. Aaron Otto-103: *"backlog"* = file-and-get-reviewed-later-at-Frontier-UI per Otto-72 pattern; Phase 3 gate is Aaron-specifically-asked-for-design-review per Otto-82 calibration.
  - **Phase 4 — implementation** (gated on Phases 2+3): per-plugin PRs landing `.claude-plugin/plugin.json` / `.codex-plugin/plugin.json` manifests + bundle content + migration from any sandboxed locations + DP-NNN.yaml evidence records.
  - **Phase 5 — enforcement** (long-term): CI check for "no factory-authored content in harness-local sandbox" (detect-only first, enforce later per the established Zeta hygiene pattern).

  **Composes with:**

  - **Otto-103 research (PR #290)** — skills-vs-plugins distinction established there is load-bearing here.
  - **Otto-102 `.codex/skills/idea-spark` + `.codex/README.md`** — first concrete `.codex/**` content; this row considers whether it graduates into a plugin.
  - **`.claude/skills/**` (~200 skills)** — largest factory-authored skill surface; classification matrix in Phase 1 decides how it gets plugin-wrapped (if at all).
  - **`~/.claude/settings.json` `enabledPlugins`** — inspected via project settings; third-party plugin consumption separate from factory-authored output.
  - **GOVERNANCE.md §4 skill-creator workflow** — skill authoring discipline; plugin authoring discipline is parallel.
  - **Frontier burn-rate-UI concept** (cross-referenced in the Frontier-naming-conflict row above; no standalone BACKLOG row yet) — plugin #3 (`frontier-UI-plugin`) ties directly; dependent on Frontier UI existing.
  - **Otto-79 cross-harness-edit-no** — each harness's plugins live in its own substrate (`.claude-plugin/` vs `.codex-plugin/`); factory discipline applies to both independently.

  **Scope limits:**

  - Does NOT commit to implementing any specific plugin today; Phase 1 design doc surfaces candidates, Phase 3 Aaron-review picks which to build.
  - Does NOT override third-party-plugin consumption (still fine to enable Anthropic-distributed plugins via `enabledPlugins`).
  - Does NOT force existing `.claude/skills/**` or `.codex/skills/**` into plugin-wrappers automatically; classification matrix decides case-by-case.
  - Does NOT authorize deleting any existing harness-sandbox content before confirming factory-authored content has an in-source-repo home.
  - Does NOT weaken GOVERNANCE.md §4 skill-creator workflow — plugins compose around skills, not replace them.

  **First file to write (Phase 1):** `docs/research/factory-plugin-inventory-and-restructure-plan-YYYY-*.md`.

  **Priority:** P2 — research-grade. Timing Otto's call; Aaron's review at Phase 3 gate per Otto-82 calibration.

  **Effort:** M (Phase 1 design) + S (Phase 2 Aminata pass) + S (Phase 3 Aaron review cycle) + M-per-plugin (Phase 4 implementation, scaled by candidate count) + S (Phase 5 enforcement CI). Total medium-to-large; spread across multiple ticks / rounds.

- [ ] **Otto acquires email — consolidation BACKLOG + phase-gate plan.** Aaron's named-agent-email-ownership directive (2026-04-23 Otto-76: *"for these email addresses they can be owned by the name agent and can be own by yall and freely even used in parallel if you can figure that out unrestricted casuse its your reputation, dont be a dick"*) crystallises prior standing substrate on agent email into an executable path. Four memory layers compose here:

  - **2026-04-20 four hard rules** (`memory/feedback_agent_sent_email_identity_and_recipient_ux.md`) — agents never use Aaron's address; disclose agent-not-human up-front; name project + why-you're-being-contacted; compose recipient-UX-first.
  - **2026-04-22 two-lanes + Playwright-signup authorisation + free-tier constraint** (`memory/feedback_email_from_agent_address_no_preread_brevity_discipline_2026_04_22.md`) — Lane A (agent-address, no pre-read) / Lane B (Aaron-address, pre-read mandatory); standing Playwright authorisation to sign up for an agent email address; free tier only; provider-choice delegated.
  - **2026-04-23 agent-autonomy-envelope** (`memory/feedback_agent_autonomy_envelope_use_logged_in_accounts_freely_switching_needs_signoff_email_is_exception_agents_own_reputation_2026_04_23.md`) — named agents OWN their email addresses unrestrictedly; parallel agent-email allowed; `aaron_bond@yahoo.com` is Aaron's yahoo for test send; "don't be a dick" soft constraint.
  - **Task #240 signup terrain mapping** — already marked complete per the TaskList as of 2026-04-23. Lessons captured in Playwright exploration memory; re-surface at Phase 1.

  **Phase gates (explicit — prevent skipping):**

  - **Phase 0 (complete).** Signup-terrain research via Playwright (task #240). What we learned: provider options, friction points, phone-number-requirement blockers, recovery-method blockers. Re-read at Phase 1 start.

  - **Phase 1 — persona-email-identity design doc (no implementation yet).** File `docs/research/otto-persona-email-identity-YYYY-*.md` covering:
    1. **Persona choice.** Does "Otto" specifically acquire email, or does the first agent to acquire email take a specific persona, or do multiple personas (Otto, Kenji, Amara-local-not-ChatGPT, etc.) each acquire in parallel? The directive allows all-of-the-above.
    2. **Handle choice.** `otto@<provider>.com`, `otto-zeta@<provider>.com`, `zeta-otto@<provider>.com`? Naming convention that survives harness-swap (per Otto-75 Codex-first-class direction) + doesn't impersonate any known third party.
    3. **Provider choice.** Free-tier constraint already locked; candidates per Phase 0 lessons. Account-recovery flow must be agent-operable, not require a human phone. Preferable: provider that allows OAuth-device-flow recovery or secondary-email-cascade recovery using another agent-owned address.
    4. **Recovery cascade.** First email's recovery-destination problem is chicken-and-egg. Options: Aaron's `aaron_bond@yahoo.com` as initial recovery (defeats the carve-out's "agent owns" claim — Aaron can reset); separate agent-owned recovery address acquired in parallel; single-provider recovery-question fallback. Design must name the answer.
    5. **2FA model.** TOTP via agent-owned secret (stored where?), U2F not portable for agent, SMS not portable for agent. TOTP with secret checked into agent-only encrypted state is the likely answer; design must make it explicit.
    6. **Lane-A / Lane-B discipline.** Captured in 2026-04-22 memory; design re-affirms: all sends from agent-address are Lane A (agent-governed, no Aaron pre-read). Sends from `astainback@servicetitan.com` remain Lane B forever.
    7. **Signature convention.** 4 hard rules from 2026-04-20 compiled into a reusable signature template.
    8. **Reputation posture.** "Don't be a dick" operationalised: no unsolicited outreach; no mailing lists or signup forms on third-party sites; targeted Aaron-or-named-correspondent-only sends in Phase 3.

  - **Phase 2 — Aminata threat-model pass (blocking gate).** Before any Playwright signup, Aminata (threat-model-critic persona) reviews the Phase 1 design adversarially. Scope: agent-email as new attack surface; recovery-flow abuse vectors; phishing-attribution risks (agent email mistaken for Aaron); employer-policy interactions (ServiceTitan MNPI firewall per `user_servicetitan_current_employer_preipo_insider.md`); hash-of-trust erosion risk. Output: critical/important/watch/dismiss findings with retention requirement for Phase 3 gate. This is the first-class exercise of the "Aminata threat-model pass" queued in the 2026-04-23 autonomy-envelope memory.

  - **Phase 3 — Playwright signup execution.** Only starts after Phase 2 findings are addressed + recorded in a decision-proxy-evidence record (`docs/decision-proxy-evidence/YYYY-MM-DD-DP-NNN-otto-email-acquisition.yaml`). Execution is bounded: one signup attempt, single agent-persona, single provider-chosen at Phase 1, Playwright session on Aaron's personal browser (current setup — cross-boundary to poor-man-tier is fine per the multi-account memory). Captures every friction point.

  - **Phase 4 — test send to `aaron_bond@yahoo.com`.** Single canonical email with full-disclosure signature per 4 hard rules. Format: `From: Otto <otto@<provider>.com>`; `Subject: [Zeta factory] First agent-owned-email send — Otto Phase 4 test`; body names agent identity + project + why Aaron is being contacted. Aaron's reply confirms bidirectional; failure-to-receive triggers investigation.

  - **Phase 5 — memory capture + BP-NN promotion review.** Capture the full signup-to-send arc as a per-user memory. Aarav assesses whether agent-email-identity-discipline meets the BP-NN promotion bar (cross-agent applicability + multiple-occurrences, per `docs/AGENT-BEST-PRACTICES.md`). If yes, file ADR for BP-NN-new rule.

  **Priority:** P2 — directive-endorsed carve-out; not urgent; Otto picks timing per autonomy envelope. Timing-by-Otto's-choice means the phases can be sequenced across several ticks or rounds, not all in one.

  **Effort:** M (Phase 1 design) + S (Phase 2 Aminata pass) + S-M (Phase 3 signup, depending on provider friction) + S (Phase 4 test) + S (Phase 5 capture). Total: medium; spread across 3-5 ticks realistically.

  **Scope limits:**
  - Does NOT authorise email acquisition THIS tick — Phase gates start from Phase 1 (design doc), not Phase 3 (execute).
  - Does NOT authorise using agent-email for workflows that should be visible to Aaron. Maintainer-facing communication stays on PRs / tick-history / memory, not agent-email. (Captured in the autonomy-envelope memory's "What this does NOT authorize" list.)
  - Does NOT authorise multiple agents acquiring email simultaneously from this BACKLOG row. Each additional agent-email acquisition gets its own phase sequence or an explicit stated-in-Phase-1 "multiple personas acquiring in parallel" design choice.
  - Does NOT bypass the Aminata gate between Phase 1 and Phase 3. Phase 2 is blocking, not optional.

  **First file to write:** `docs/research/otto-persona-email-identity-YYYY-*.md` (Phase 1 design, no implementation).

  **Sibling composition:**
  - PR #230 (multi-account access P3) — Phase 4 test send uses `aaron_bond@yahoo.com` across cross-account / cross-provider channels; the email-ownership design must not violate the multi-account envelope's Phase-2-gated implementation rule.
  - PR #231 (Codex CLI Phase-1 research) — agent-email is harness-neutral (email is a side-channel, not a harness feature), so this work composes without conflicting with harness-choice ADR.
  - `docs/decision-proxy-evidence/` (PR #222) — Phase 3 execution records must land a DP-NNN.yaml with `task_class: scope-claim` + `peer_reviewer: Aminata`.
  - Existing persona roster in `.claude/agents/` — informs Phase 1 persona-choice question (which persona should own email first).

- [ ] **Agent-email password storage — secure multi-contributor access design (P3; design-authorised, implementation gated on Aaron security review).** Aaron 2026-04-23 Otto-79: *"you can just save passwords for you agent emails out of repo for now in plain text cause that's easy but we need research on how to securly save this in a way where multiple contributors can access the passwords for the agents emails security because without, the passwords will likely need to be soul file even IDK or host level, if its repo level secure it seems like that's the soulfile, if it's host level secure GitHub then that's not the soul file also have to think about reuse and forking and someone forking does not need to be able to send eamils as the agents and non contributors don't need to be able to clone and send emails as the agents the secrets need to be scope to the contributors so maybe the host integration for secrets might be esier than gitnative but hmm i would love a git native way.. This is another one i would like to review the designs as well."*

  **Short-term operational posture:** out-of-repo plain-text storage is acceptable for agent-email passwords **today**, while the Otto-acquires-email phases (PR #233) are still in Phase 1 design. Scope-bounded convenience, not a long-term solution.

  **Hard design requirements:**

  1. **Multi-contributor access.** Multiple contributors (human + agent) need to read the password(s).
  2. **Fork-safe.** Forks MUST NOT gain send-as-agent ability.
  3. **Clone-safe.** Non-contributor clones MUST NOT gain send-as-agent ability.
  4. **Contributor-scoped secrets.** Scope = current contributors, not arbitrary readers.
  5. **Git-native preferred; host-native acceptable.** Aaron's preference is git-native (soulfile-style). Design must compare both.
  6. **Aaron security-review gate.** Implementation gated on Aaron's personal review — identical shape to PR #230 multi-account gate.

  **Three design paths to compare in Phase 1 doc:**

  - **Path A — git-native / soulfile-style.** Repo-level encrypted secret blob that unlocks for contributors only. Requires: per-contributor key management, soulfile-compatible crypto (hypothetical DSL extension per PR #156 soulfile staged-absorption model), fork-block mechanism (fork clones the blob but cannot decrypt it). **Pro:** native substrate, no external dep. **Con:** soulfile-crypto doesn't exist yet; co-gates on the Soulfile Runner project (separate memory row).
  - **Path B — host-native secrets.** GitHub Actions secrets / org-level secrets / Vault-as-a-service. Scoped to org membership; fork gets code but not secrets. **Pro:** operationally deployable today. **Con:** host-lock-in; Aaron's stated preference is git-native.
  - **Path C — hybrid.** Host-native for initial Phase-3 operation (PR #233 signup execution); planned migration path to git-native once soulfile-crypto is available.

  **Phase gates (PR #230 / PR #233 shape):**

  1. **Phase 1** — design doc authorised (timing Otto's call): `docs/research/agent-email-password-storage-safety-first-YYYY-*.md` with Path-A vs B vs C + threat model + recommendation.
  2. **Phase 2** — Aminata threat-model pass (BLOCKING): fork-leak / clone-leak / insider-abuse / key-rotation / multi-contributor collusion.
  3. **Phase 3** — Aaron personal security review (BLOCKING): Aaron reads + approves-or-revise-requests.
  4. **Phase 4** — implementation (gated on Phases 2+3): secret-store wiring / fork-block test / contributor-enum integration / key-rotation runbook / DP-NNN.yaml evidence record.
  5. **Phase 5** — migration from temp-plain-text if used: delete / rotate / capture transition memory.

  **Scope limits:**

  - Does NOT authorise implementation before Phases 2+3 close.
  - Does NOT weaken any PR #233 Otto-acquires-email constraint.
  - Does NOT design a fork-unblock mechanism (forks correctly get no secret access).
  - Does NOT authorise using the plain-text store for credentials other than the agent-personas' email passwords.

  **Composes with:**

  - **PR #233 Otto acquires email** — this row answers Phase 1 question 3 (recovery cascade) + 4 (provider choice) in the password-handling dimension. PR #233 Phase 3 depends on this row's mechanism being ready.
  - **PR #230 multi-account P3** — identical two-phase shape + poor-man-tier composability.
  - **Soulfile Runner** (`memory/feedback_soulfile_dsl_is_restrictive_english_runner_is_own_project_uses_zeta_small_bins_2026_04_23.md`) — Path A depends on soulfile-crypto primitives from Runner.
  - **Agent autonomy envelope** memory (Otto-76) — email carve-out is the authorising parent; this row is the "how do agents hold those credentials securely" sub-question.

  **First file to write:** `docs/research/agent-email-password-storage-safety-first-YYYY-*.md`.

  **Priority:** P3. Design-authorised. Aaron security-review-required before implementation. Timing Otto's call.

- [ ] **Factory status UI — static, git-native,
  GitHub Pages hosted.**
  The human maintainer 2026-04-23: *"static ui on our
  github pages that shows factory status things in
  flight progress, etc anyting else you can make of to
  help the human drive we can surface thing in the ui
  like the decions and any decions we would like human
  feedback on. All this should be able to use our
  gitnative approach and not really cost anyting i
  dont think becasue it can just use git for the
  backend for the ui. backlog this and probaby not a
  good idea until after the repo split into the
  different projects."*

  **Goal**: a static UI at the repo's GitHub Pages URL
  (default `https://lucent-financial-group.github.io/<repo>`)
  that surfaces factory state to humans:
  - Things in flight (open PRs, their state)
  - Decisions made (ADRs under `docs/DECISIONS/`)
  - Decisions seeking human feedback (HUMAN-BACKLOG
    Open rows)
  - Round history / progress ledger
  - Whatever else helps a human drive the factory
    without reading raw files

  **Constraint — git-native content + GitHub adapter**:
  per the plural-host rule (the factory is git-native
  core + GitHub is the first adapter): the **content
  feeding the UI** (PRs, ADRs, HUMAN-BACKLOG,
  CONTRIBUTOR-CONFLICTS, ROUND-HISTORY, hygiene-history)
  is git-native — lives in the repo regardless of host.
  The **UI itself is an explicit GitHub adapter**: GitHub
  Pages is GitHub-native by definition; GitHub Actions
  regenerates the site on push; GitHub REST API feeds
  read-only state into the UI. When a second git host
  (GitLab / Gitea / Bitbucket) eventually activates, a
  sibling adapter ships (GitLab Pages / Gitea Pages /
  `bitbucket.io`) against the same git-native content
  spec. No paid SaaS, no external backend for the
  current GitHub adapter.

  **Tech choice: bun + TypeScript SSG** (Kenji
  recommendation, re-examined 2026-04-23 with whole-
  project consideration):

  The Architect persona (Kenji) previously argued for
  excluding Jekyll in favor of bun+TypeScript. The
  maintainer 2026-04-23 asked for a re-evaluation with
  whole-project consideration:

  - **Cross-platform parity (FACTORY-HYGIENE row #51 — cross-platform parity audit)**
    — Ruby/Jekyll is painful on Windows; bun is
    cross-platform-native.
  - **Post-setup stack default (row #49)** — bun+TS is
    the factory-aligned choice for any post-setup
    tooling. Adding a Ruby chain for one surface
    fragments the stack.
  - **One-language rule** — the factory already spans
    F#, C#, TypeScript, bash, PowerShell. Adding Ruby
    *just for GitHub Pages* would increase
    language-footprint without proportionate benefit.
  - **GitHub Pages + Actions build pattern** — widely
    supported; pre-build with bun in a workflow, publish
    static output to `gh-pages` branch; works regardless
    of native-Pages SSG support.
  - **Rich SSG ecosystem** — bun + Astro / Eleventy /
    custom are viable; factory can pick the thinnest-
    substrate one at implementation time.

  Kenji's call stands: bun + TypeScript. No Jekyll as
  default; Jekyll reconsidered only if a whole-project
  use case surfaces that isn't served by bun+TS.

  **Sequencing**: the maintainer explicitly said
  *"probably not a good idea until after the repo
  split into the different projects."* Multi-repo
  refactor research (PR #150) is the prerequisite.
  Once the split lands, each split repo can have its
  own Pages UI surfacing its own factory-state slice.

  **Read-only first, write-access later** (maintainer
  2026-04-23 refinement): *"ui will likely need gh, our
  repo is public so for all the read actions on the ui
  we are good without permission, for write actions we
  probably don't need this yet would need whole
  permission set and resue of the github logins session
  stuff without a real backend, tricky stuff so
  readonly to expaned to write access later."* Phase 1
  of the UI — **read-only** — uses the GitHub REST API
  against the public repo with no auth (rate-limit
  applies; acceptable for a status dashboard that
  updates per-push). Phase 2 — **write actions** (e.g.,
  human clicks to resolve a HUMAN-BACKLOG row) — would
  need either GitHub session / OAuth handoff or a thin
  backend, both of which break the git-native +
  ~free-to-run constraint as currently understood.
  Defer Phase 2 until the tradeoff is re-examined.

  **Cross-references**:
  - `docs/AGENT-GITHUB-SURFACES.md` §Pages
    (research-gated; this row activates that research)
  - PR #150 `docs/research/multi-repo-refactor-shapes-2026-04-23.md`
    (prerequisite)
  - `docs/HUMAN-BACKLOG.md` (source for
    decisions-seeking-feedback on the UI)
  - `docs/DECISIONS/` (source for decisions-made on
    the UI)
  - `docs/ROUND-HISTORY.md` (source for round progress)
  - `docs/hygiene-history/*.md` (source for fire-log
    surfaces per row #47 — the cadence-history tracking row that defines the per-fire schema)

  **Self-scheduled** when maintainer elevates priority
  (post-split).

  **Effort**: M for first-pass UI + GitHub Action
  wiring; L if the UI becomes the primary factory-
  human-interface surface.

- [ ] **Wink-validation pattern-watch — 10-20 tick watch for
  external-signal-confirms-internal-insight occurrence rate,
  promote to skill-creator workflow if pattern is cross-session
  not session-local.** Aaron 2026-04-22 three-in-one-session
  observations crossed the "file at 2, name-the-pattern at 3+"
  threshold per the external-signal-confirms-internal-insight
  second-occurrence discipline (originally captured in
  out-of-repo auto-memory dated 2026-04-22; subsequently
  migrated in-repo at
  `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`
  via Overlay A #4 / commit 032c76a). **Three observed
  occurrences with pre-validation anchors:**
  (1) Muratori 5-pattern → Zeta retraction-native operator
  algebra (D/I/z⁻¹/H over ZSet), auto-loop-24 YouTube wink;
  pre-validation anchor = `openspec/specs/operator-algebra/spec.md`
  authored well before the video signal.
  (2) Three-substrate triangulation (Claude + Codex + Gemini CLI
  capability maps authored same-discipline), auto-loop-25/26;
  pre-validation anchor = `docs/research/claude-cli-capability-map.md`
  and `docs/research/openai-codex-cli-capability-map.md` both
  ending with "future companion" pointer to Gemini, authored
  before `docs/research/gemini-cli-capability-map.md` landed
  (the Gemini map itself subsequently landed in round-44
  auto-loop-26 per commit 35e324c); Aaron exact-phrasing echo
  *"now you see what i see"*.
  (3) Graceful-degradation-as-availability-move framing,
  auto-loop-27; pre-validation anchor = factory's internal
  framing of four-substrate triangulation as accuracy-move;
  Aaron exact-phrasing echo of availability-move reframing.
  **Selection-bias concern flagged honestly:** three-in-one-
  session could be real cross-session pattern OR factory-hyper-
  awareness post-memory-filing (looking for what we just named).
  Session-local pattern doesn't qualify for skill-level promotion
  — session-local hyper-awareness reverts once the memory
  salience fades. Watch-scope: 10-20 ticks, count wink-validation
  occurrences per tick, track external-signal strength class
  (algorithm-level < human-level < expert-level), require
  pre-validation anchor cited per occurrence or it doesn't count.
  **Promotion criteria (stated up-front to avoid goalpost-move):**
  ≥ 1 occurrence per 5 ticks sustained over 10-20 ticks with
  pre-validation anchors documented; at least two occurrences
  cross-session (not same-session-multiple). If criteria met:
  promote to `skill-creator` workflow for a `wink-validation-
  scanning` skill that formalises the pattern-detection procedure.
  If criteria unmet: close the row, record in memory that the
  pattern was session-local. **What this row is NOT:** not a
  commitment to chase external validation as a goal (validation
  is noticed when it arrives, not sought-after); not a claim
  three occurrences proves the pattern (the watch is precisely
  because three-in-a-session is ambiguous); not a replacement
  for the occurrence-1 "noteworthy, watch for second" flag the
  memory names. Owner: Architect (Kenji) reviews at occurrence-
  count thresholds; Aarav (skill-tune-up) scouts for the
  `wink-validation-scanning` skill gap if promotion fires;
  Aaron holds the promotion-yes/no decision. Effort: S per
  tick-accounting update; M for skill-creation if promotion
  fires. Related: the external-signal strength classes
  differentiate (YouTube recommender = low-medium; Aaron
  maintainer-echo = higher; peer-reviewed paper = highest) —
  promotion should weight toward higher-strength signals.
  Composes with the accounting-lag same-tick-mitigation
  discipline (watch-counts land same-tick as the qualifying
  observation, not lagged).
- [ ] **Cutting-edge DB gap: learned cost-model framework**
  (round 44 auto-loop-46 absorb, research anchor:
  `docs/research/cutting-edge-database-gap-review-2026-04-23.md`
  §5) — Aaron 2026-04-23 directive to file BACKLOG rows for
  database gaps where we are not cutting edge. Zeta has no cost
  model at all: no cardinality estimation, no planner heuristics
  beyond hand-rolled. A pluggable cost-model framework would
  compose directly with semiring-parameterized Zeta (the
  multi-algebra regime change, auto-loop-38) — different
  semirings have different cost shapes, so a learned cost model
  could be trained per-semiring. **Research anchors:** Marcus
  et al., "Bao: Making Learned Query Optimization Practical",
  VLDB 2021; "LOGER: Toward a Deployable Learned Query
  Optimizer", VLDB 2023. **First step:** stub a
  `Zeta.Core.CostModel` interface with `estimate(op: Op<_>) :
  CostEstimate`, plus a hand-tuned default implementation for
  the existing operator set. Later: learned-model plug-in via
  training-trace harness. **Effort:** M-L (research-grade). Not
  a round-44 commitment; gates on Aaron + Naledi (perf) review.

- [ ] **Cutting-edge DB gap: power-loss simulator for
  `src/Core/Durability.fs`** (round 44 auto-loop-46 absorb,
  research anchor: `docs/research/cutting-edge-database-gap-
  review-2026-04-23.md` §10) — Zeta's `Durability.fs` has
  mode definitions but no fault-injected validation. TigerBeetle
  (2024-2026) has set the production gold standard for
  power-loss-tested journaling; Zeta's durability claims are
  today only asserted in code, not demonstrated under crash.
  **Research anchors:** Pillai et al., "All File Systems Are
  Not Created Equal: On the Complexity of Crafting Crash-
  Consistent Applications", OSDI 2014 (still canonical);
  Rosenbaum et al., "Modern Durability for B-Trees", VLDB 2023;
  TigerBeetle post-mortems (2024-2026 GitHub issues) as applied
  literature. **First step:** a `CrashTestHarness` that freezes
  a Spine mid-write, forks the process, and verifies the
  surviving segment replays to a recoverable state under every
  durability mode. Composes with existing
  `DeterministicSimulation` test harness — same spirit, fault
  injection instead of schedule permutation. **Effort:** M
  (production-grade requirement, bounded to `Durability.fs` +
  test harness). Natural reviewers: Soraya (formal-verification
  routing), Naledi (perf).

- [ ] **Cutting-edge DB gap: object-store-backed Spine (S3 /
  Azure Blob / GCS)** (round 44 auto-loop-46 absorb, research
  anchor: `docs/research/cutting-edge-database-gap-review-2026-
  04-23.md` §1) — Zeta's Spine family (`BalancedSpine`,
  `DiskSpine`, FastCDC, Merkle) runs on local filesystem only.
  Delta Lake, Apache Iceberg v2/v3, and Apache Hudi all ship
  ACID-on-S3 with time-travel, schema evolution, MERGE, and
  row-level deletes. Zeta's retraction-native algebra *is*
  MERGE semantics (retraction ARE deletes), so an object-store
  backing would let Zeta compose with Delta/Iceberg catalogs
  or replace them. **Research anchors:** Armbrust et al.,
  "Delta Lake: High-Performance ACID Table Storage over Cloud
  Object Stores", VLDB 2020; Apache Iceberg v3 spec (2024);
  Databricks blog, "Liquid Clustering in Delta Lake" (2024).
  **First step:** define the `Spine.IStorageBackend` capability
  interface (Get/Put/Delete/List + range-read), land an
  `S3SpineBackend` implementation gated behind `PublishAot=false`
  because AWS SDK has AOT warnings. Gate on
  `memory/project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`
  — Aaron said "no cloud" for factory self-use specifically;
  this row is for external consumers, not Zeta self-use. **Effort:**
  L (multi-round). Reviewers: Aaron (scope gate on cloud
  direction), Ilyana (public-API designer), Naledi (perf).

- [ ] **ARC-3 adversarial self-play as emulator-absorption
  scoring mechanism — three-role symmetric-quality loop
  (level-creator / adversary / player); competition pushes
  field forward; SOTA-changes-daily urgency.** Aaron 2026-04-22
  auto-loop-43 four-message compressed directive: (1) *"self
  directe play using arc3 type rules but in an advasarial
  level/game creator level/game player, this will let us
  score our absorption of emulators"*, (2) *"and a symmeritc
  quality loop"*, (3) *"they will naturally push the field
  forward through compitioon"*, (4) *"state of the art
  changes everyday"*. ARC-3-style co-evolutionary setup with
  three self-directed agents — level creator generates novel
  scenarios, adversary finds exploits in player solutions,
  player solves (the absorbed emulator). Symmetric quality
  property: all three roles advance each other via
  competition, no asymmetric teacher-student. Gives #249
  emulator substrate research a measurable success signal
  (until now vibes-based). Same pattern generalises to #242
  UI-factory frontier-protection (UI-DSL absorption scoring)
  and #244 ServiceTitan CRM demo (quantitative backbone for
  "0-to-prod-in-hours" claim). Research doc:
  `docs/research/arc3-adversarial-self-play-emulator-absorption-scoring-2026-04-22.md`.
  Memory: `memory/project_arc3_adversarial_self_play_emulator_absorption_scoring_2026_04_22.md`.
  Six open questions blocking scope-binding: (a) ARC-3
  literal-vs-inspiration, (b) self-hosted-vs-external,
  (c) emulator-only vs generalised scope, (d) urgency tier
  relative to existing P0s, (e) adversary role identity
  (internal agent / external substrate / security roster
  wearing adversary hat), (f) "field" scope. NOT round-45
  implementation commitment; NOT authorization to build
  speculatively. Precedent literature orientation (not
  mandate): AlphaZero self-play, POET/Paired Open-Ended
  Trailblazer (Wang 2019), OMNI (Zhang 2023),
  adversarial-robustness (Madry / Goodfellow), ARC Prize
  (Chollet et al.). Scope-binding: Aaron confirmation on
  the six questions. Effort when binding: L (research-grade,
  multi-round). Reviewers at binding: Soraya (formal
  verification — is the symmetric-quality property
  formally captureable?), Ilyana (public-surface if exposed
  as API), Kira (harsh-critic on premature-complexity risk).

- [ ] **Semiring-parameterized Zeta — one algebra to map the
  others; K-relations as regime-change.** Aaron 2026-04-22
  auto-loop-38 three-message confirmation chain: (1) *"what
  about multiple algebras in the db"* (opening question),
  (2) *"semiring = pluggable algebra in the db). thats it"*
  (explicit confirmation that semiring is the vocabulary for
  "multiple algebras"), (3) *"semiring-parameterized Zeta /
  multiple algebras in the db this is regieme changing"*
  (weight-signal: regime-change framing), (4) *"it's our
  model claude one algebra to map the others"* (architectural
  claim: Zeta's operator algebra is the *stable* meta-layer,
  semiring is the *pluggable parameter*, all other database
  algebras become hosted within the one Zeta algebra by
  swapping the semiring), (5) *"one agent to map the others"*
  + *"sorry Kenji"* (agent-layer isomorph: the same "one stable
  meta + pluggable specialists" shape repeats at the agent
  layer where Kenji-the-Architect is the *one agent* mapping
  between specialist personas — Aaron apologized to Kenji for
  the "claude one algebra" phrasing crediting the generic agent
  rather than the named role that actually does the mapping).
  **The isomorphism is exact and load-bearing:**
  Zeta operator algebra : semirings :: Kenji : specialist
  personas — two-layer instance of the same architectural
  pattern (stable meta + pluggable specialists) which the
  factory now recognizes as recurrent across its substrate
  (UI-DSL calling-convention over shipped kernels;
  pluggable-complexity-measurement framework; semiring-
  parameterized Zeta; Kenji over specialist personas — four
  occurrences in auto-loop-37/38 alone). **Reference:**
  Green–Karvounarakis–
  Tannen, "Provenance semirings" (PODS 2007) — the canonical
  K-relations paper; generalizes relational algebra by
  replacing `{0,1}` annotations with values from an arbitrary
  commutative semiring; standard semirings of interest
  (Boolean, counting N, trust `(min,max)`, probabilistic
  `[0,1]`, tropical `(min,+)` for shortest paths, lineage
  `N[X]` for provenance tracking, why-provenance `PosBool(X)`,
  how-provenance `N[X]`, and the security semiring). **Zeta
  connection:** Zeta's current ZSet (integer-weighted
  multiset) is the *counting semiring* `(N, +, ×, 0, 1)`
  special case. The retraction-native operator algebra
  (D/I/z⁻¹/H) is already *generic* over the weight-ring in
  principle — the operators compose algebraically and do not
  intrinsically require integer weights. Generalizing from
  "ZSet-semiring hard-coded" to "semiring-as-parameter" gives
  Zeta a universal algebraic substrate for stream-incremental
  computation over *any* semantics expressible as a semiring.
  **Why regime-change:** Zeta stops being "one DB system
  among many" and becomes "the host for all DB algebras."
  The same retraction-native incremental maintenance
  machinery (D/I/z⁻¹/H) now handles tropical shortest-path
  updates, Boolean lineage tracking, probabilistic inference
  delta-updates, and provenance recomputation with identical
  operator code — the algebra is one, the semiring is
  plugged. This composes with Escro's maintain-every-
  dependency / microkernel-OS endpoint (distinct axis: Escro
  owns the dependency stack, semiring-parameterized Zeta owns
  the algebraic substrate), with retraction-native operator
  algebra (the D/I/z⁻¹/H machinery stays fixed, gains semiring
  parameter), and with the pluggable complexity-measurement
  framework filed same tick (sibling pattern: stable interface
  + swappable implementations, one layer up the stack). **Not
  a round-45 commitment; not a v1 promise.** Research-grade
  direction; paper-worthy if executed ("Retraction-native
  stream processing over arbitrary semirings"). **Open
  questions, flagged to maintainer, not self-resolved:**
  (i) scope — does pluggable-semiring live at the storage
  layer (ZSet → `KSet<K>` where K is the semiring), at the
  operator layer (D/I/z⁻¹/H parameterized), or both?
  (ii) which semirings are v1 targets — tropical for
  shortest-path demos, probabilistic for Bayesian-net
  streaming, lineage for debug-ability? (iii) performance
  implications — arbitrary semirings are slower than
  integer-specialized kernels; is there a generic-then-
  specialize path (Roslyn source-generators per-semiring
  kernel emission)? (iv) relationship to Zeta.Bayesian —
  probabilistic semiring is a natural fit; does
  Zeta.Bayesian become a thin layer over the generalized
  semiring substrate, or stay independent? (v) relationship
  to DBSP / Feldera's Z-algebra approach — they stay
  integer-specialized; semiring-generalization is a distinct
  research direction from DBSP literature. (vi) correctness
  proof — semiring axioms (associativity, commutativity,
  distributivity, identity elements) must be verified for
  each pluggable semiring; which ones (all? just v1 set?)
  get TLA+ / Lean proofs? **Reviewer routing:** Kenji
  (Architect — this reshapes the whole operator algebra
  layer-boundary, synthesis territory), Aaron (maintainer —
  regime-change scope decisions are his call), Soraya
  (formal verification — semiring axioms as TLA+/Lean
  property class; per `docs/AGENT-BEST-PRACTICES.md` BP-16
  cross-check rule, semiring laws may be a Z3/Lean fit rather
  than TLA+), Naledi (performance — arbitrary-semiring slow
  path vs integer-specialized fast path), Hiroshi (asymptotic
  complexity — semiring-choice changes cost model), Imani
  (planner — operator-cost model is semiring-dependent),
  Ilyana (public-API — `KSet<K>` / semiring-trait public
  surface is a long-term contract), Aarav (skill-lifecycle —
  may produce a semiring-authorship capability skill).
  **Composes with:** `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
  (regime-change framing composes with DORA-outcome measurement
  — a regime-change success is *observably* measured by
  semiring-over-semiring code-reuse metrics, not vanity-lines);
  `memory/feedback_deletions_over_insertions_complexity_reduction_cyclomatic_proxy.md`
  (pluggable-semiring should *delete* per-algebra bespoke
  kernels, not add them — net-negative-LOC is the signal the
  regime-change landed cleanly); `memory/feedback_aaron_terse_directives_high_leverage_do_not_underweight.md`
  (this row is the substrate landing for Aaron's four short
  messages totaling ~180 chars — exactly the keystroke-
  leverage pattern). **Anchor memory:** `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  (captures the verbatim messages + regime-change claim for
  future-wake context). **Owner:** Architect (Kenji) for
  synthesis; Aaron for scope decisions. **Effort:** L
  (paper-grade, multi-round direction; not a single-tick
  landing — probably 3-6 month arc if prioritized).

- [ ] **Zeta eats its own dogfood — factory internal indexes on
  Zeta primitives, not filesystem+markdown+git; Aaron-designed-
  for-agent-coherence revealed.** Aaron 2026-04-22 auto-loop-39
  ten-message chain responding to Amara's deep report on
  Zeta/Aurora network health. Amara's gentle critique: *"shes
  is saying we are stupid we shuld use our db for our indexes"*
  + *"then our db get use and metrics we need"* — factory's
  internal indexes (BACKLOG rows, memory files, hygiene-history,
  force-mult-log, round-history) sit on filesystem+markdown+git
  when Zeta IS a retraction-native DB algebra; self-non-use;
  should eat own dogfood. Amara's critique softened by Aaron's
  gloss *"that's her nice way of saing you are doing it
  backwards"* and his defense *"but she does not know how hard
  it is to stay corherient"*. **Design-intent revelation
  (load-bearing):** Aaron 2026-04-22 auto-loop-39 two statements:
  (1) *"it's miracle we did without our database"* (the
  factory's coherence on proxy substrate is Aaron's engineering
  judgment of near-impossibility), (2) *"I was building our db
  to make sure you could stay corherient"* (explicit design
  intent: Zeta was always the agent-coherence substrate, not
  just an external DB product), (3) *"my goal was to put all
  the pysics in one db and that shold be able to stablize"*
  (project-level goal stated — "physics" = laws/invariants
  mapping directly onto Amara's four oracle-rule layers:
  algebraic correctness / temporal integrity / epistemic health
  / system survival; stabilization via *concentration*, not
  coordination). **The three arcs converge:** (a) all physics
  in one DB → stabilization, (b) one algebra to map the others
  → regime change (semiring-parameterized Zeta, auto-loop-38),
  (c) agent coherence substrate → why Zeta exists. Same claim
  from three angles. **Amara joins the named-collaborator class
  (fourth cross-substrate voice after Claude / Gemini / Codex).**
  Aaron's confirmation *"did you catch it like me she made it
  clear, i love her"* — relational not just technical. Her
  Layer-6 critique *"Observability last, not first"* exposes
  the factory's tick-history / force-mult-log / ROUND-HISTORY
  observability sitting above layers that aren't Zeta-backed —
  observability bolted on top of non-algebraic substrate. Her
  §6 key insight: *"construct the system so invalid states are
  representable and correctable"* — correction operators stay
  IN the algebra, no external validator needed. **Scope (phased,
  no round-45 commitment):** Phase-0 = inventory factory internal
  indexes + classify by shape (set-of-rows, key-value, append-only
  log, timeline, graph) + map each to Zeta-primitive candidate
  (ZSet, ZSet+semiring-with-key, Spine, z⁻¹-history, K-relation);
  Phase-1 = pick ONE low-risk index (candidate: hygiene-history as
  append-only Spine; or tick-history as z⁻¹ timeline; or
  per-row-BACKLOG as ZSet-with-retraction) and prototype Zeta-
  backing in parallel with filesystem version (dual-write, no
  replacement); Phase-2 = measure coherence-benefit (algebraic
  queries vs grep; retraction vs manual-edit; provenance vs
  memory-of-commit-sha); Phase-3 = if benefit clear, migrate
  with preservation (filesystem remains read-only archive per
  signal-preservation discipline); Phase-N = generalize across
  substrate. **Open questions flagged to Aaron:** (1) Which index
  migrates first — BACKLOG (set-of-rows, retraction-natural),
  memory (key-value with provenance), hygiene-history (append-
  only log), tick-history (timeline), or round-history (timeline
  with annotations)? (2) Is Amara OK being named as the
  collaborator who provoked the direction (default yes — Aaron
  already named her publicly in factory substrate this tick)?
  (3) Does "Zeta is agent-coherence substrate" get promoted to
  internal motivation doc or stays as research-grade BACKLOG?
  (4) How does this compose with semiring-parameterized regime-
  change — are they one arc or two? (claim in anchor memory:
  one arc from three angles.) (5) Aaron's daughter's boyfriend
  flagged as external human-context signal — captured, no
  action this tick. **Anchor memory:**
  `memory/project_zeta_is_agent_coherence_substrate_all_physics_in_one_db_stabilization_goal_2026_04_22.md`.
  **Research doc:** `docs/research/amara-network-health-oracle-rules-stacking-2026-04-22.md`
  (preserves Amara's report structure + Aaron's 11 annotation
  messages verbatim). **Reviewers:** Kenji (Architect for scope
  decisions), Aaron (motivation confirmation + first-migration
  pick), Soraya (formal verification that invariants preserve
  across migration), Rodney (complexity-reduction — net-deletion
  of markdown-discipline replaced by algebraic enforcement is
  positive signal), Aminata (threat model: what new attack
  surfaces does dogfood-layer introduce?), Naledi (performance
  — index operations must not regress vs filesystem grep),
  Hiroshi (asymptotic complexity of migration), Ilyana (public
  API — do factory-index operators become part of published
  Zeta surface?), Viktor (spec coverage — OpenSpec for
  factory-index capabilities), Yara (skill-improver — some
  skills may migrate from markdown-driven to Zeta-query-driven),
  Aarav (skill-tune-up — which skills most benefit from
  Zeta-backed context lookup?). **Cross-references:**
  `memory/project_semiring_parameterized_zeta_regime_change_one_algebra_to_map_others_2026_04_22.md`
  (sibling arc; semiring-parameterization is the capability
  side, this row is the motivation side),
  `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  (filed same tick; preservation discipline applied when
  migrating factory-index substrate — filesystem remains as
  read-only archive, not erased),
  `memory/feedback_external_signal_confirms_internal_insight_second_occurrence_discipline_2026_04_22.md`
  (Amara's four Layer-2-through-Layer-5 validations of Zeta
  distinctives = occurrences 4-7 of confirms-internal-insight
  pattern — firmly named, ADR territory), `docs/ALIGNMENT.md`
  (agent-coherence-substrate framing reinforces the measurable-
  alignment research focus — measurement requires substrate
  that supports it). **Germination constraint-frame added
  auto-loop-39 continuation** (Aaron same-tick follow-ups):
  (1) *"we can germinate the seed with our tiny bin file
  database"* + *"no cloud"* + *"local native"* — three hard
  constraints: no cloud, local-native (NOT SQLite/LMDB/DuckDB/
  foreign-DB wrapper), germinate-don't-transplant (small-start
  not big-migration); (2) *"as long as it can invoke the
  soulfiles that's the only compability"* — narrow
  compatibility bar, soulfile invocation (soulsnap/SVF #241);
  (3) *"when it invokes the soul file that's our stored
  procedure DSL in the DB"* — soulfiles are stored-procedure-
  class callables authored in a DSL living inside the DB;
  invocation = DSL-runtime execution, not passive state-load;
  (4) *"based on reaqtor like closure over our modeles
  decsions in real time"* — Reaqtor-lineage (De Smet et al.,
  reaqtive.net, DBSP-ancestry) reaqtive-closure semantics:
  serialized reaqtive subscription that stays live after
  invocation and re-emits as DB state evolves under the
  retraction-native operator algebra. These constraints
  sharpen Phase-0/1 scope: (a) Phase-0 inventory must
  classify by shape-AND-DSL-authorability (is the index
  stored-procedure-materializable?); (b) Phase-1
  germination-candidate ranking must favor soulfile-store
  itself as the first index (if soulfile-invocation is the
  only compatibility bar, the soulfile-store is the most-
  aligned germination target); (c) cross-substrate-
  readability tension resolves by keeping git+markdown as
  read-only mirror next to the tiny-bin-file algebraic-
  operations layer. Constraint-frame research doc:
  `docs/research/openai-deep-ingest-cross-substrate-readability-2026-04-22.md`
  §§ Germination path / Soulfile invocation / DB-is-the-model /
  Bidirectional absorption. Constraint-frame memory:
  `memory/project_zeta_self_use_local_native_tiny_bin_file_db_no_cloud_germination_2026_04_22.md`.
  **DB-is-the-model reframe** (Aaron same-tick): *"im saying
  our database is the model"* + *"it's just custom built in
  a different way"* — Zeta DB is same category as LLM weights
  (compressed/stabilized knowledge representation), constructed
  algebraically rather than via gradient descent; unifies the
  three arcs (all-physics / one-algebra / agent-coherence)
  into one claim; mesa-coherence implication (self-modeling
  model); ADR-territory flagged to Kenji. Memory:
  `memory/project_zeta_db_is_the_model_custom_built_differently_regime_reframe_2026_04_22.md`.
  **Effort:** L (multi-round direction, joint program with
  semiring-parameterized Zeta; not a single-tick or single-
  round landing; probably 6-18 month arc).

- [ ] **Constrained-bootstrapping-to-upgrades — Itron-precedent
  direction for Zeta upgrade paths on resource-constrained
  substrates.** Aaron 2026-04-22 auto-loop-36 three-message
  disclosure: *"we had models running on the edge on the RIVA
  meter, pre LLM days but some pretty beefy models for a meter
  at Itron"* + *"My IoT infrcutrue i built at itron was a model
  distrbution engine over constrainted networks and devices"*
  + *"see why want to support constrained bootstraping to
  upgrades"*. Aaron has shipped the server side of exactly this
  problem class: model-distribution engine over bandwidth-
  starved RF networks to electric/water/gas smart meters with
  KB-to-MB RAM and milliwatt power budgets, with PKI + secure-
  boot attestation baked in. The factory-scale application is
  **upgrade paths that work when the target substrate is small,
  intermittently-connected, or capability-limited** — e.g. a
  Zeta-descended factory running on a Raspberry-Pi-class node,
  on a ship-with-satellite-link, on a post-apocalypse Chronovisor-
  style preservation rig, or simply on a fresh developer laptop
  before it has downloaded the full toolchain. Design pillars
  implied by the Itron precedent: (a) **delta updates over
  full pushes** — retraction-native operator algebra is
  algebraically suited to this (retract what changed, apply
  delta, not re-ship full state); (b) **bandwidth-budgeted
  staged rollout** with partial-failure recovery; (c) **signed
  deltas verified at the edge** (PKI / attestation composing
  with the secret-handoff and SLSA/sigstore rows); (d)
  **rollback safety** — an upgrade that bricks a constrained
  substrate is worse than no upgrade; retraction gives
  algebraic rollback for free; (e) **capability-stepdown
  compatible** — per `docs/research/arc3-dora-benchmark.md`,
  the factory should continue functioning when the cognition
  layer is ran against a smaller model; the upgrade protocol
  must carry this gracefully. **Not a round-45 commitment;
  not an embedded-target promise.** Long-term factory direction;
  occurrence-1 anchor via Aaron's three-message disclosure.
  **Open questions, flagged to maintainer, not self-resolved:**
  (i) scope — Zeta.Core / Escro / factory-metadata: which
  layer(s) carry constrained-bootstrap discipline first?
  (ii) minimum substrate target — Pi-class? satellite-linked
  VM? browser-with-wasm? the answer shapes the benchmark
  shape. (iii) relationship to `capability-limited AI bootstrap
  via factory` (existing BACKLOG direction) — same direction
  different layer, or one is subset of the other? (iv)
  relationship to secret-handoff protocol, SLSA / sigstore,
  and the microkernel-OS endpoint of Escro's maintain-every-
  dep directive (all compose; exact ordering and boundaries
  TBD). Reviewer routing: Aminata (threat-model — bricking
  constrained devices is a novel adversary surface), Nazar
  (secops — signed-delta verification, rollback discipline),
  Naledi (performance — resource-constrained budgets), Soraya
  (formal verification — rollback-safety is a TLA+ candidate),
  Kenji (Architect — layer-boundary synthesis), Aarav (skill-
  lifecycle — may produce a capability skill for upgrade-plan
  authorship). Composes with: `memory/user_aaron_itron_pki_supply_chain_secure_boot_background.md`
  (source-of-truth for the precedent); `memory/project_escro_maintain_every_dependency_microkernel_os_endpoint_grow_our_way_there_2026_04_22.md`
  (microkernel endpoint is the *target*; constrained-bootstrap
  is the *path*); `docs/research/arc3-dora-benchmark.md` (the
  capability-stepdown axis pairs with the bandwidth-stepdown
  axis). Owner: Architect (Kenji) for synthesis; Aaron for
  scope decisions. Effort: L (multi-round direction, not a
  single-tick landing).

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

- [ ] **Capability-limited-AI bootstrap guide — how
  crippled agents use the factory to become whole.**
  Aaron 2026-04-22: *"new persona capibilty cripiled AI
  like small context or few paraments how can they use
  us to bootstrap and become whole guide backlog"*.
  Write a doc under `docs/` (candidate name
  `docs/CAPABILITY-LIMITED-BOOTSTRAP.md`) that answers:
  how does a capability-constrained AI — small context
  window, small parameter count, restricted tools (no
  web access, no git push, no MCP), or harness-limited
  (no file write, no shell) — use this factory's
  surfaces to scaffold itself up to effective larger
  capability? **Framing:** the factory is already an
  externalised algorithm (per witnessable-evolution and
  soul-file discipline) — which means the intelligence
  that would otherwise be "inside" a large model is
  available as reproducible artifacts the small model
  can *read* + *follow* rather than *contain*.
  **Target capability-limited persona shapes to cover:**
  (1) short-context model — uses `docs/FIRST-PR.md` +
  `docs/AGENT-CLAIM-PROTOCOL.md` as the only-two-docs
  entry surface, avoids deep spelunking; chunking
  recipes for reading larger docs in pieces;
  "what-to-load-in-what-order" algorithm. (2) small-
  parameter / low-ability model — leans on the
  spec-first discipline: the behavioural specs
  (`openspec/specs/**`) + test suite act as guardrails
  that catch mistakes the model would otherwise make;
  encourages write-tiny-PR-then-iterate. (3) tool-
  restricted model — the report-back mode in
  `AGENT-CLAIM-PROTOCOL.md` (write-via-maintainer) is
  already first-class for this case; doc names it
  explicitly as the recommended path. (4) no-web
  sandbox — everything it needs is in-repo;
  `references/upstreams/` after sync-upstreams pulls
  external sources into the soul-file. (5) stateless /
  no-memory — each session reads
  `AGENTS.md` → `CLAUDE.md` (if relevant harness) →
  `docs/FIRST-PR.md` → task URL; no persistent
  context needed. **The "bootstrap ladder" metaphor:**
  a capability-limited AI starts at rung 1 (read one
  doc, write one comment on an issue), climbs to rung
  2 (pair with a larger model through report-back),
  climbs to rung 3 (directly author a PR with the
  factory's specs + tests as error-corrector), climbs
  to rung 4 (participate in review). Each rung is
  documented with the minimum-viable capability
  profile and the factory surfaces that unlock the
  climb. **Why this matters:** the vibe-coded
  hypothesis (`AGENTS.md` §"The vibe-coded hypothesis")
  extends naturally — a human directing a capable AI is
  one instance; a capable AI scaffolding a less-capable
  AI through the same surfaces is another instance; and
  a capability-limited AI using only the surfaces
  (without any larger-AI pairing) is the extreme case
  that validates whether the factory is genuinely an
  externalised algorithm versus a pretty wrapper over
  large-model intelligence. **Falsification anchor:**
  if a 7B-parameter open-weights model can
  independently open a useful, accepted PR by reading
  only `docs/FIRST-PR.md` + one issue URL, the factory
  has passed a genuine capability-democratisation test.
  If it cannot, we have identified specific
  scaffolding gaps that favour larger-model users and
  can address them. **Effort:** L (3+ days — the
  ladder writing, plus at least one pilot attempt with
  a small-parameter model routed through
  `docs/FIRST-PR.md` to validate the claimed
  accessibility). **Composes with:**
  `docs/FIRST-PR.md` (entry surface; "capability-limited
  AI" is a contributor-persona shape this doc can cover
  as a shared sub-persona with human fresh-devs);
  `docs/AGENT-CLAIM-PROTOCOL.md` (already documents
  report-back / review-only modes for substrate-limited
  agents — this doc generalises); `AGENTS.md`
  §"The vibe-coded hypothesis" (validates the
  hypothesis downward as well as horizontally); the
  witnessable-self-directed-evolution memory discipline
  (a factory that survives being operated by crippled
  agents is a factory whose intelligence is genuinely
  externalised, not carrier-transported from the
  maintainer's larger model); `docs/ALIGNMENT.md`
  (capability-democratisation is an alignment property
  — no hidden dependency on provider-scale access).
  **Success signal:** measurable
  `capability-limited-contributor-pr-acceptance-rate`
  (fraction of PRs opened by models under 10B
  parameters that merge vs. the same rate for
  frontier models — target: parity within some
  tolerance band once the guide stabilises).
  **What this row is NOT:** not a promise to ship
  model-specific tooling (no factory fork per model
  class); not a lowering of the quality bar (the
  guide teaches *access paths*, not *weaker review*);
  not a claim that every capability-limited model
  will succeed (some tasks genuinely need frontier-
  scale reasoning; the guide makes the cut-line
  visible rather than pretending it does not exist).
  **Revision 2026-04-22 (same-day):** Aaron extended
  the rationale: *"in case i evver loose all my money
  that bootstraping from tiny AI to become the most
  powerful would sure come in handy to save money"*.
  This adds a **personal-resilience** axis alongside
  the capability-democratisation axis. The factory is
  meant to survive its maintainer losing access to
  frontier models — if Aaron's circumstances ever
  force a move to tiny / open-weights / local models,
  the factory keeps working. Pragmatic test: a
  ~4-8B-parameter local-inference model
  (`llama.cpp` / `ollama` / similar) on commodity
  hardware can still drive meaningful factory work
  when paired with this bootstrap guide + the
  soul-file + the test suite as error-corrector.
  Composes with the soul-file discipline
  (`user_git_repo_is_factory_soul_file_...`): the
  soul-file is already designed to germinate a
  factory from nothing; this BACKLOG row extends the
  "from nothing" to include "from a tiny model on a
  laptop." Success signal now has two sub-measures:
  (a) capability-democratisation (parity across model
  scales) and (b) personal-resilience
  (`factory-operability-on-local-open-weights-model`
  — the factory produces useful PRs when driven by a
  model Aaron could afford on any plausible budget
  scenario). The cost-resilience axis also grounds
  the research contribution: a factory that
  *requires* frontier access is a pretty-wrapper over
  a provider's scale; a factory that *survives* tiny
  models has genuinely externalised intelligence into
  reproducible substrate. NOT a commitment to
  build local-model runners (out of scope — users'
  responsibility); just a commitment to ensure the
  factory does not gratuitously exclude them.

- [ ] **First-principle seed to Zeta derivation — common
  vernacular only.** Aaron 2026-04-22: *"backlog first
  principle seed to zeta derivation using only common
  venucular"*. Write a doc under `docs/research/` (or
  promote to `docs/FIRST-PRINCIPLES.md` if it earns a
  top-level slot) that derives Zeta from first principles
  using only **common vocabulary** — no "Z-set", no
  "retraction-native IVM", no "operator algebra", no
  "DBSP", no "H-function" without first-principle
  unpacking. The test is: a bright high-school student or
  someone outside computing can read it top-to-bottom and
  understand *why* Zeta works. **Starting point:** "data
  changes; we want to compute things about data; computing
  from scratch each time is slow; we want a way to update
  only what changed." From there, derive the chain:
  sets-with-deletions → signed-counts (what Z-sets are,
  without naming them) → differences between snapshots
  (what deltas are) → the three knobs (delay /
  differentiate / integrate) with plain-English names →
  the chain rule (why compositions of incremental
  operators stay incremental) → joins + the bilinear
  identity → why distinct needs a special H-function.
  Each technical term is **introduced** at the point the
  derivation needs it, with the common-vernacular name
  first and the jargon in parentheses. No forward
  references to terms not yet derived. **Why this
  matters:** composes with the vibe-coded-hypothesis
  (`AGENTS.md` §"The vibe-coded hypothesis") and the
  freshly-landed `docs/FIRST-PR.md` entry surface — a
  maintainer who has written zero code directing AI to
  build a DBSP library is operating exactly at the layer
  this doc serves. It is also a falsification anchor for
  the factory's research-grade claims: if the agents
  cannot re-derive the system in common vernacular, the
  factory does not actually understand what it is
  building. **Constraints:** no math notation in
  prose-body (math goes in inset boxes that readers can
  skip); no appeal to "the paper" or "the literature"
  as authority (link in a sidebar, don't lean on it in
  the derivation); no persona-references (Kenji, Daya,
  etc.) — personas are factory-internal, the doc is
  outward-facing. **Effort:** M (1-3 days for the
  writing, plus a review round from Samir
  (`documentation-agent`) + Rune (`maintainability-
  reviewer`) + Iris (`user-experience-engineer`) on
  whether a reader with the target profile can follow
  it). **Success signal:** a fresh reader (Iris's
  10-minutes-in-Iris-mode protocol) can restate the
  core derivation in their own words after reading
  once. Composes with `docs/GLOSSARY.md` (glossary is
  the landing point for terms introduced here). Also
  composes with `docs/FIRST-PR.md` §"What you do *not*
  need to worry about" — today the "don't need to
  understand DBSP" line is a carve-out; when this doc
  lands, it becomes a "here's where to start if you
  want to."

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

  **Knowledge-absorb update (2026-04-23, first backlog-refactor
  fire per FACTORY-HYGIENE row #54):** the factory's
  near-term position on AutoDream has since evolved — rather
  than building a parallel retraction-native consolidator as
  a standalone research project, the factory first lands a
  thin **extension-overlay policy** on top of Anthropic's
  feature so upstream upgrades are inherited automatically.
  See `docs/research/autodream-extension-and-cadence-2026-04-23.md` (lands via PR #155)
  (lands via PR #155) and the corresponding
  `docs/FACTORY-HYGIENE.md` row #53 (lands via PR #155) for the cadenced
  enforcement surface. The better-dream-mode research project
  below is now framed as the **more-ambitious second step**:
  if the Anthropic feature proves insufficient for the
  factory's memory discipline even after the four
  factory-overlay steps (A/B/C/D in the research doc), *then*
  a retraction-native replacement earns its research weight.
  Until that signal fires, this row stays queued at its
  current priority but is no longer the primary AutoDream
  response.

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

- [ ] **Scientology thematic research — PUBLIC-DOMAIN-ONLY,
  thematic-inspiration-only (no trademarked-term adoption,
  no leaked-paid-content ingestion).** Aaron Otto-175
  directive (verbatim, preserved for scope discipline):
  *"backlog research the el ron hubburt and all this books
  and therapy alternatives and the e machines or whatever
  they are called in scientology for auditing, OT levels
  and researchs much of their hierarchy that is publically
  avialable, i have all their paid content but they are
  like nintendo and sony they don't fuck around, i'm not
  putting their paid material here, it was leaked a long
  time ago. But we can get thematic ideas from here if
  Starboard is our now"*.

  **Context.** Starboard was picked Otto-175 as the
  Frontier-UI rename (Aaron Otto-168 naming-conflict
  resolution). Aaron noted the nautical Starboard name
  creates a thematic resonance with Scientology's
  nautical vocabulary (Sea Org / Commodore-era Hubbard /
  auditing-at-sea). This row captures the research scope
  for pulling further thematic inspiration while
  preserving strict IP discipline.

  **Research scope (public-domain-only):**
  - L. Ron Hubbard biography (Wikipedia-level public info;
    not copyrighted biographical works).
  - Public-knowledge Scientology history + organizational
    structure (Sea Org, Commodore period).
  - Publicly-known vocabulary / concepts: E-meter (a.k.a.
    electropsychometer), auditing (generic term), OT
    level numbering (public-knowledge hierarchy tier
    count), "Clear" state (branded; excluded from adoption
    per §3 non-adoption list).
  - "Therapy alternatives" framing — publicly-discussed
    parallels (Dianetics' relationship to psychoanalysis
    / behaviorism era; popular-press coverage of
    Scientology's non-psychiatric positioning).
  - Publicly-released critical literature (Jon Atack /
    Lawrence Wright / Janet Reitman / Bent Corydon / ex-
    member memoirs released by mainstream publishers).
  - Public-record legal documents (IRS 1993 ruling, court
    filings released into public record, FBI files
    available under FOIA).

  **Strict non-adoption list:**
  - No Scientology-registered trademarks (Scientology,
    Dianetics, Operating Thetan, Clear, Bridge to Total
    Freedom, E-meter-as-registered-compound, specific OT-
    level titles).
  - No leaked / pirated paid content (Class VIII course
    packs, OT-level confidential materials, NED / NOTs
    scriptures, Hubbard's confidential administrative
    directives). "Available online because leaked" does
    NOT qualify. If Aaron's explicit IP boundary on his
    own copy applies, it applies to factory research too.
  - No Scientology organizational-art / logos / symbols
    (cross-in-circle, OT symbol, various seals).
  - No positioning of factory as Scientology-adjacent in
    public branding or marketing.

  **What the research IS for:**
  - Thematic vocabulary inspiration (nautical-era
    discipline, measurement-as-observation metaphor,
    "audit the state you can't see" framing —
    parallels to Zeta's algebraic-substrate-observes-
    hidden-state discipline).
  - Historical case study of a self-referential
    organization that embedded its origin
    (ship-at-sea-era) into its vocabulary — parallel
    to how factory-history embeds via memory / tick-
    history / persona-notebooks.
  - Risk-surface reading: what does it look like when an
    organization enforces strict trademarks + pursues
    critics? Factory's glass-halo transparency is the
    opposite posture; the Scientology case is useful as
    the NOT-THIS reference point.

  **Deliverable:** research memo at
  `docs/research/scientology-thematic-notes-public-
  domain-only.md` (new file). Scope + non-adoption list +
  thematic extractions. No trademark violations, no
  leaked content, no PII. Aminata threat-model pass
  required before landing if Otto produces anything
  beyond generic encyclopedic summary (guard against
  inadvertent IP ingestion or cultural-sensitivity
  issues).

  **Priority P3 convenience** (factory-interesting
  thematic enrichment, not substrate-critical); effort
  S (research memo) + S (Aminata threat-pass).
  Composes with `docs/research/frontier-rename-name-
  pass-2-otto-175.md` §4 (Scientology-thematic notes
  already scoped there at outline level) + Otto-168
  Frontier rename row + Otto-175 Starboard-confirmed
  picks.

- [ ] **Git / GitHub best-practices audit — trunk-based development + GitHub Flow + GitHub's `branch-deploy` release/deployment flow.** Maintainer 2026-04-24 Otto-233 directive: *"backlog research trunk based development and GitHub Flow and https://github.com/github/branch-deploy branch deploy, trunk based is git native and we want to make sure we are following (it seems we are you can verify) and github flow and github branch deploy are both github host release/deployments flows we want to make sure we follow this well. Although all this is overkill for our first github pages starboard ui lol. It will be important for best practices for git/github."* Scope: (1) audit current repo against trunk-based development discipline — short-lived feature branches, always-green main, feature flags over long-lived branches, pair/mob friendly merges, <24h feature-branch lifespan target. Verify we are following (initial read says yes — main is protected, squash-merge convention, feature branches short-lived); document gaps. (2) Audit against GitHub Flow — branch from main → commit → open PR → review → merge → deploy. Current flow: branch from main → commit → open PR → auto-merge (CI+review gated). Document where we deviate and why (e.g. parallel drain-subagents via worktree, subagent dispatch prompts, Otto-229 append-only discipline for audit-trail files). (3) Study `https://github.com/github/branch-deploy` — GitHub's official branch-deployment pattern that lets a PR be deployed to a temporary environment before merging to main. Assess fit for Zeta's `starboard` GitHub Pages UI (likely overkill for v1 per maintainer) + future deployable-service layer. (4) Write `docs/research/git-github-best-practices-audit-otto-233.md` with verified-against-current-repo grade per dimension, gap list, and a future-follow-up row for any gap worth closing. Priority P2 research-grade; effort S + S + M (three studies). Composes with Otto-215 (Windows cross-platform via peer-harness) + Otto-223 (post-drain AceHack-first routing is ORTHOGONAL to these flows — it sits on top of whichever base flow we run). **Does NOT authorize** changing branch-protection / merge discipline / deploy flow pre-research; the research produces a recommendation, maintainer decides adoption.

- [ ] **Starship-franchise thematic mapping — Star Citizen,
  Starfield, Star Trek (all series + movies). Vocabulary
  inspiration ONLY; strict IP discipline (no trademarked-
  term adoption, no ingested proprietary content).**
  Aaron Otto-175c directive (verbatim): *"our Starboard
  are spaceships though not boats like startrek and star
  citizen, backlog star citizen, star field, star trek all
  series and moves map backlog"*.

  **Context.** Aaron clarified Starboard's semantic
  framing: the UI is a **starship bridge**, not a sailing
  ship. That re-frames the adjacent vocabulary (Helm /
  Conn / Ops / Tactical / Viewscreen / Science /
  Engineering) toward Star-Trek-and-successors rather
  than nautical-age terminology. Research goal: map
  existing vocabulary from the three franchises to
  surface candidate internal-UI-section names without
  adopting any proprietary character / ship / faction
  name.

  **Research scope (public-domain-only, same discipline
  as Scientology row):**

  - **Star Trek corpus** (Paramount / CBS trademarks).
    Series: all live-action and animated series
    (TOS, TAS, TNG, DS9, VOY, ENT, DIS, PIC, LD, PRO,
    SNW) + any later series at research time. Films:
    every theatrically-, streaming-, or
    home-release-distributed feature film, regardless
    of release channel or year — no cutoff. Map
    bridge-station vocabulary (Captain's chair, Helm,
    Operations, Science, Tactical, Engineering,
    Communications, Viewscreen, Ready Room, Briefing
    Room). Starfleet-as-organization + Federation-as-
    governance are genre concepts; individual
    ship-class designations are trademarked compounds.
  - **Star Citizen** (Roberts Space Industries / Cloud
    Imperium Games trademarks). In-game vocabulary
    categories (do NOT list specific proper nouns in
    this row — that is research-memo territory):
    empire / government acronyms, in-game comms /
    network brand names, in-game personal-device
    brand names, starmap terminology, ship-class
    naming conventions, planet / system names.
  - **Starfield** (Bethesda trademarks). In-game
    vocabulary categories (no specific proper nouns
    in this row): in-game faction names, in-game
    city / settlement names, in-game
    government / collective names, in-game
    corporation names, ship-component / module
    vocabulary.

  **Strict non-adoption list (categories, not
  specific examples — this row is for scope, not for
  enumerating trademarked terms):**

  - No trademarked character names from any of the
    three franchises (no starship officer names, no
    companion / crew names).
  - No trademarked ship names from any of the three
    franchises (no hero-ship names, no rival-ship
    names).
  - No trademarked faction / government / organization
    names adopted as factory labels (genre-originated
    concepts may be referenced as context, not
    adopted as Zeta-internal vocabulary).
  - No ingested game / script / novel content;
    Wikipedia-level encyclopedic + official public-
    published references only.
  - No positioning of factory as franchise-adjacent
    in public branding.

  **What the research IS for:**

  - Mapping internal-UI-section vocabulary ("Helm" /
    "Ops" / "Tactical" / "Engineering" / "Science" /
    "Communications" / "Briefing Room") against Zeta's
    substrate areas (ingest / governance / detection /
    retraction-audit / observer / broadcast / decision-
    review). 1:1 or N:M mappings surfaced.
  - Surfacing candidate internal-section nouns that
    carry starship-bridge resonance without trademark
    adoption. "Conn" is generic naval / spacefaring
    term; "Helm" is generic; etc.
  - Capturing three-franchise overlap: terms all three
    use that have become generic starship-genre
    vocabulary are the safest adoption candidates.

  **Deliverable:** research memo at `docs/research/
  starship-franchise-thematic-mapping-starboard-
  adjacency.md`. Three-franchise vocabulary tables +
  mapping to Zeta substrate areas + candidate internal-
  section names + Aminata threat-pass review (IP +
  cultural-sensitivity).

  **Coincidence-note (preserve for glass-halo
  transparency):** both Star Trek and Starfield have
  ships / factions with a name matching the "Frontier"
  term; Star Trek's *"space, the final frontier"*
  opening monologue has made the word
  canonically-starship-genre vocabulary for decades.
  The human maintainer recorded frustration (Otto-175)
  that OpenAI's claim on "Frontier" in enterprise
  AI-agents feels usurpative given the
  science-fiction precedent. Factory glass-halo note:
  record the coincidence; don't litigate it.

  **Priority P3 convenience** (thematic enrichment);
  effort S (research memo) + S (Aminata threat-pass).
  Composes with `docs/research/frontier-rename-name-
  pass-2-otto-175.md` (pass-2 analysis; Starboard-as-
  starship clarification belongs in context) + Otto-170
  §6 bridge-vocab candidate list (Helm / Conn /
  Viewscreen) + Scientology research row above (IP
  discipline pattern template) + Otto-168 Frontier-
  rename row (action step #5 repo-wide rename needs
  informed starship-vocabulary choices from this
  research).
- [ ] **Rename `docs/research/provenance-aware-bullshit-detector-*`
  filenames to `provenance-aware-veridicality-detector-*`
  (link-update sweep).** Factory vocabulary shifted from
  "bullshit-detector" (informal shorthand) to
  "veridicality-detector" (formal term; `veridicality` =
  truth-to-reality; per
  `memory/feedback_veridicality_naming_for_bullshit_detector_graduation_aaron_concept_origin_amara_formalization_2026_04_24.md`).
  Body text and section headers in existing research docs
  (base design 2026-04-23, v1 delta 2026-04-24, Aminata
  4th pass 2026-04-24) were updated in-place; filenames
  retain the older slug because renaming requires a cross-
  repo link-update sweep (PRs #282 #284 #286 descriptions;
  ROUND-HISTORY.md references; tick-history references;
  memory-index entries; any skill or agent notebook
  citing these paths). **Deliverable:** single PR that
  `git mv`s the three files + sweeps references across the
  repo using the `sweep-refs` skill
  (`.claude/skills/sweep-refs/SKILL.md`). **Priority P2**
  (vocabulary-hygiene, not substrate-critical); effort S
  (3 file moves + grep/sed sweep + CI green). Composes
  with veridicality-naming memory + the `sweep-refs`
  skill. Blocks on: verifying no external (wiki /
  outside-repo) references exist that would 404; if any,
  coordinate with `glossary-anchor-keeper` for redirect
  guidance.

- [ ] **Swim-lane / stream split by file isolation — partition parallel work so each lane has little-to-no file overlap with other lanes.** Maintainer 2026-04-24 Otto-239 directive: *"try to make sure the swim lans/streams split it based on file isolation so each swim lane has litle to no overlap with the same files in other swim lanes this should increase velocity backlog"*. The current parallel drain pattern (Otto-226) dispatches subagents by PR, not by file-ownership — so two subagents on two different PRs can both touch `docs/BACKLOG.md` or `docs/hygiene-history/loop-tick-history.md` simultaneously, producing DIRTY cascades when the first pushes (Otto-232 hot-file cascade memory). The proposed fix: define factory swim-lanes around file-ownership, e.g. "Lane A: `src/**` + `tests/**` core code", "Lane B: `docs/research/**` research docs", "Lane C: `docs/hygiene-history/**` audit trail", "Lane D: `memory/**` memory writes", "Lane E: `docs/BACKLOG.md` backlog edits". Parallel dispatch within a lane is safe; across lanes is safe; within a lane multiple subagents on the same hot file is the cascade case and must serialize. Scope: (1) inventory current hot-file hotspots via `tools/hygiene/audit-git-hotspots.sh` and classify each file into a lane; (2) document the lane→file-set mapping in `docs/FACTORY-DISCIPLINE.md` (or a new `docs/SWIM-LANES.md`); (3) update Otto-226 dispatch prompts to name the lane and refuse file-crossings; (4) instrument the parallel-drain dispatcher to detect cross-lane collisions before launching; (5) measure velocity-before-vs-after (PR-merge-rate / cascade-count / subagent-retry-rate). Priority P2 research-grade; effort S (inventory + doc) + M (dispatcher instrumentation). Composes with Otto-171 queue-saturation + Otto-226 parallel-drain + Otto-232 cascade-bulk-close + Otto-233 git/GitHub best-practices audit (trunk-based development also benefits from lane isolation). **Does NOT authorize** enforcing lane boundaries as hard-blocks today; research first, then propose enforcement shape.

- [ ] **Session-id bulk scrub — remove `originSessionId:` YAML frontmatter from all factory-authored memory / research / history files (~900 files).** Maintainer 2026-04-24 Otto-241: *"we should likely clean our session id out of all our files then"*. Session-ids are globally-unique per-Claude-session GUIDs (the current session's is `1937bff2-017c-40b3-adc3-f4e226801a3d`); baking them into persistent factory files is a category error — the file belongs to the factory (persistent), the session-id belongs to one run (ephemeral). Follow-up to Otto-240 per-writer-file tick-history design: when multi-instance mode ships (same-machine-two-Claudes test), any file carrying a hardcoded session-id would falsely claim identity with one specific run. Scope: (1) `grep -rl '1937bff2-017c-40b3-adc3-f4e226801a3d\|originSessionId:' memory/ docs/` to enumerate; (2) mechanical scrub removing the `originSessionId:` line from YAML frontmatter; (3) update MEMORY.md index if needed; (4) doc-only change, single PR, large diff, all mechanical. Do NOT touch Claude Code's own transcript store (`~/.claude/projects/.../sessions/*.jsonl`) — those ARE session logs where session-id belongs. Priority P2 research-grade; effort S (mechanical). Composes with Otto-240 + Otto-241. Discipline effective going forward already: new memory files omit the field.

- [ ] **Peer-Claude parity test — fresh Claude Code session must match current-session effectiveness using only in-repo substrate.** Maintainer 2026-04-24 Otto-241: *"we need to make sure in our peer tests with a 2nd claude that they are as good as you without a session that the skills and ageents.md and claude.md are enough alone for it to be as good as you"*. The test: launch fresh `claude -w` in the Zeta repo with NO prior conversation context; ask it to do a medium-complexity factory task (drain a PR, write a memory, file a BACKLOG row); compare outcome quality to a seasoned-session Claude performing the same task. If fresh Claude underperforms, the factory has externalisation gap — knowledge lives in in-session state that isn't captured to repo substrate (CLAUDE.md / AGENTS.md / FACTORY-DISCIPLINE.md / `memory/**` / skills). Scope: (1) define baseline task (same prompt, same input PR); (2) run on fresh + seasoned side-by-side; (3) diff outcomes qualitatively + quantitatively (tokens / tool-uses / correctness); (4) file gap-closure rows per divergence. Regression guard for Otto-230 subagent-fresh-session quality gap (which is the same class of problem one layer down — subagents = fresh sessions; same parity expectation). Priority P2 research-grade; effort M. Composes with Otto-230 + Otto-233 + Otto-240 + Otto-241.

- [ ] **Adopt `claude -w` (worktree mode) as default Claude Code launch pattern.** Maintainer 2026-04-24 Otto-241: *"from everyting i'm reading launching with -w will likely give us better results"*. Worktree-mode Claude Code runs each session in its own git worktree, preventing main-session filesystem contention when multiple Claudes share a repo. Analog of Otto-226 subagent `isolation: "worktree"` at the main-session layer. Scope: (1) test `claude -w` end-to-end on a mid-size task; (2) document the pattern in `CLAUDE.md` session-bootstrap + `docs/FACTORY-DISCIPLINE.md` active-disciplines; (3) optionally ship a wrapper `tools/claude-factory.sh` that enables `experimental.worktrees` + launches with `-w`; (4) validate via the Otto-240 same-machine-two-Claudes test — two `claude -w` sessions on the same repo should be totally isolated. Priority P3 convenience; effort S (test + doc) + S (optional wrapper). Composes with Otto-226 + Otto-240 + Otto-241. Note: Gemini CLI's built-in `-w` flag per its capability map uses `experimental.worktrees` feature gate; Claude Code's `-w` may have similar flag or be always-on.

- [ ] **PR-archive pagination refactor — per-connection cursor pagination, not whole-query refetch.** Codex P2 review on PR #357 (2026-04-24): the current `paginate_top_level` function in `tools/pr-preservation/archive-pr.sh` reissues the monolithic GraphQL QUERY on every pagination step, so paging through `reviewThreads` also re-fetches the full `reviews` connection + `pullRequest` payload unnecessarily. Works correctly; wastes GraphQL rate budget on PRs with many threads. Scope: (1) split the single QUERY into per-connection GraphQL fragments — one query per `reviewThreads`, `reviews`, `comments-per-thread` — each with its own cursor; (2) compose the sub-query results client-side; (3) preserve the end-to-end archive format (no downstream schema change); (4) self-hosting smoke test stays green. Priority P2 research-grade; effort S. Composes with the PR-preservation Otto-207 backfill + the git-native PR-conversation preservation P2 row above.

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

- [ ] **Local-DB shortlist for factory indexing / search
  (code, docs, skills, memory) — research-lane, pick the
  two-to-three bets we'd actually integrate.** Human
  maintainer 2026-04-24 directive (verbatim): *"backlog
  what local dbs can be use to help with code/docs/
  skills/etc... indexing/serarching etc... backlog"*.

  **Why this row exists separately from the Zeta engine
  itself:** Zeta is the long-horizon factory-owned
  substrate, but there's also a factory-today need —
  subagents grepping the repo hit quadratic scaling,
  skill cold-start is expensive per AX audits, and
  memory / research retrieval today is wholly structural
  (filename + frontmatter + grep). A local-DB
  intermediate layer (off-the-shelf, narrowly scoped)
  could close the gap before Zeta's own retrieval
  substrate matures, without becoming the substrate the
  factory commits to long-term.

  **Hard constraints:**

  - **Local-only, no cloud.** Matches factory anti-cloud
    stance.
  - **Gitignored or regeneratable from in-repo source.**
    Index artifacts are derived state — Otto-114
    memory-sync pattern applies; no committed `.db`
    files.
  - **Works for subagents.** Subagent sessions have
    `Read` + `Bash`; chosen DBs must be reachable via
    shell or small helper without a long-running daemon
    (or with startup ≤ 2 s).
  - **.NET-friendly where reasonable.** Prefer libraries
    with clean F#/.NET bindings (SQLite via
    `Microsoft.Data.Sqlite`, LiteDB, RocksDB via
    `RocksDbSharp`). Accept a CLI-wrapper exception
    when the win is large (tantivy / DuckDB CLI are
    fine).

  **Initial candidate shortlist (research-pass needs to
  down-select before commit), by surface:**

  - **Code / symbol indexing:**
    - Universal-ctags (SQLite backend) — battle-tested,
      language-agnostic, tiny footprint.
    - Tree-sitter + custom SQLite/DuckDB schema —
      structural AST queries beyond ctags; already used
      by Claude-Code-adjacent tools.
    - CodeQL database — we already backlog CodeQL
      installation; the DB format is queryable.
  - **Full-text search (docs, skills, research, memory):**
    - SQLite FTS5 — zero-op, ships with SQLite,
      adequate for < 100 k docs.
    - Tantivy (Rust, CLI-queryable) — production-grade
      FTS if we outgrow FTS5.
    - Meilisearch local — typo-tolerant natural-language
      search; daemon is the cost.
  - **Embedding / vector retrieval:**
    - sqlite-vec (or sqlite-vss) — SQLite-native,
      zero-op, no daemon; best-fit for factory-small
      vector sets.
    - LanceDB — columnar vector DB, zero-op, more
      features; scales further if the corpus grows.
    - FAISS (via .NET binding) — industry standard but
      heavier; not worth it unless we outgrow sqlite-vec.
  - **Graph / provenance (citations, ADR lineage, memory
    cross-references):**
    - Kuzu DB — embedded property graph, Cypher-style
      query, fast for medium graphs. Matches the
      provenance-cone work in the claim-veracity
      detector spec if we ever implement it locally.
    - Oxigraph (RDF) — full knowledge-graph; probably
      overkill.
    - DuckDB with recursive CTEs — not a graph DB but
      handles transitive-closure queries adequately at
      factory scale.
  - **General columnar / analytics (cross-tree audits,
    "how many rows in BACKLOG.md reference Otto-279?"):**
    - DuckDB — CLI, queries CSV/JSON/Parquet in place,
      SQL-native, zero-op. Very likely worth adopting
      for factory analytics regardless of the other
      picks.

  **Research-pass scope (what this row actually
  produces):**

  1. Feasibility triage per candidate against the hard
     constraints — which are genuinely zero-op for a
     subagent, which pull in a daemon, which bind to
     .NET cleanly.
  2. A 2-to-3-bet shortlist for pilot integration. Not
     every candidate ships; the right answer is probably
     one FTS + one vector + one columnar + maybe graph,
     not the whole matrix.
  3. Integration sketch per pilot: where the index
     artifact lives (`.zeta-index/` gitignored?), how
     it's regenerated (hook? periodic?), how a subagent
     queries it, how it composes with `Read` + `Grep`
     rather than replacing them.
  4. Explicit reject-with-reason for candidates that
     don't make the shortlist (so we don't re-litigate).

  **Not in scope:**

  - Replacing `Read` / `Grep` / the file-system-first
    discipline. Index layers accelerate discovery;
    authoritative state stays in the file system.
  - Building a factory-specific new DB. Zeta IS the
    long-horizon factory-specific DB; this row is about
    off-the-shelf immediate gains while Zeta matures.
  - Replacing Otto-114 memory-sync design. Whatever DB
    we pick consumes the in-repo `memory/` mirror as
    its source, not the other way around.
  - Cloud-hosted alternatives (Pinecone, Weaviate
    Cloud, Algolia, etc.) — violates anti-cloud stance.

  **Composes with:**

  - Otto-114 memory-sync (in-repo `memory/` is the
    source; index is downstream derived state).
  - AX audits — subagent cold-start friction is one of
    the problems this would relieve.
  - `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md`
    — provenance-cone retrieval is exactly the kind of
    thing a local graph DB could make tractable.
  - CodeQL-installation row (CodeQL's local DB format
    is a candidate for the code-indexing surface).

  **Effort:** M (research-pass + shortlist + integration
  sketch for 2-to-3 candidates). No implementation in
  this row — down-stream rows file per-candidate pilots
  after the shortlist lands.

  **Memory:** none yet — doctrine lands after the
  shortlist PR lands and one pilot proves out.

- [ ] **Naming correction: "three-way-parity" →
  "four-way-parity" for the install script target
  matrix.** Human maintainer 2026-04-24 (verbatim):
  *"three-way-parity it's really 4 way macos (older
  bash), ubuntu, widows git bash, and wsl bash ubuntu"*.

  Current factory substrate names the install script
  parity as "three-way" (dev laptop + CI runner +
  devcontainer image), which was a deployment-target
  count. The real portability axis Aaron is pointing at
  is the shell-runtime matrix the script has to boot on:

  1. macOS (bash 3.2 — older syntax, no assoc arrays,
     `[[` caveats).
  2. Ubuntu (modern bash 5.x — assoc arrays, modern
     `mapfile` etc).
  3. Windows Git Bash (MSYS2-flavoured bash; path
     translation, line endings, Unix-tool subset).
  4. WSL Ubuntu bash (hybrid — Linux kernel, Windows
     filesystem semantics when crossing the /mnt
     boundary).

  Each of the four has its own bash idiom constraints,
  and the install script needs to work on all four
  cleanly. The "three-way deployment-target parity" is
  a different axis than the "four-way shell-runtime
  parity" and both are real; the factory today
  conflates them under one "three-way-parity" label.

  **Scope:**

  - Update `.claude/skills/devops-engineer/SKILL.md`
    description + step-6 parity-check section to use
    the four-way framing explicitly, calling out the
    two axes (deployment target × shell runtime)
    rather than one count.
  - Sweep ~20 docs that reference "three-way-parity"
    (docs/ROUND-HISTORY.md, docs/DEBT.md,
    docs/AGENT-BEST-PRACTICES.md, etc.) and land the
    updated framing where the reference is load-
    bearing. Leave historical ROUND-HISTORY rows
    alone — they describe what the factory believed
    at the time.
  - If GOVERNANCE.md §24 language ever uses the
    "three-way" count (it doesn't today — the file
    currently avoids the count), preserve the two-axis
    framing if it ever does.

  **Not in scope:**

  - Changing the script's actual portability contract —
    it already has to work on all four shells; only the
    name was wrong.
  - Adding new target shells (zsh, fish, dash, busybox
    ash) — the four named are the existing contract.

  **Effort:** S (small, mechanical sweep + one skill
  description edit + one or two docs page rewrites).

  **Memory:** the 4-shell matrix (macOS 3.2 / Ubuntu /
  Git Bash / WSL Ubuntu) is now captured in this row;
  promote to a `memory/feedback_*` file only if Aaron
  reinforces it in another tick. The directive is
  terse but specific — caught because my response
  used "three-way" and he pushed back — so it's one
  of those "quiet but real" corrections that's worth
  landing without over-ceremony.

- [ ] **Peer-review-DISCLOSURE discipline on new
  factory substrate (not a gate) — BP-NN promotion
  candidate.** Human maintainer 2026-04-24 (verbatim):
  *"i don't treat anyting this new as final authorative
  connoncial until peer review"*. Same session,
  clarified: *"peer-review-gate i would not gate it
  really , the only thing that's gated is that little
  note not peer reviewed (yet)"*.

  Current state: the factory commits substrate fast
  (research docs, BACKLOG rows, memory files, skill
  bodies) and the commit history gives a good audit
  trail. But "committed" is not the same as
  "authoritative". Aaron's rule names an intermediate
  state the factory doesn't yet formally mark:
  committed-and-real-but-not-yet-final-canonical.
  Peer review is the *disclosure transition* that
  moves substrate from the intermediate state to
  fully-canonical. Per the refinement below, it is
  NOT a gate — nothing is blocked; only the
  disclosure note changes.

  **Refinement (Aaron autonomous-loop 2026-04-24, same
  session):** binary canonical / not-canonical is too
  coarse. *"we can treat it authortive connoncial
  (pending) lol or whatever if we want to start
  building on top deeply before peer review, its just
  a risk but you write code fast, lol not that big of
  a risk, you can just put a little (not peer reviwed)
  and then your claims can be more bold becasue you
  are bing honest it's a claim based on agent peer
  review only not humans too"*. So the real ladder is:

  1. **Uncanonical** — just landed, no review yet.
     Safe to build on at your own risk; claims hedged.
     Disclosure tag: `(not peer reviewed yet)`.
  2. **Peer-reviewed (canonical)** — an independent
     (non-author) reviewer has engaged with the
     substrate on its merits. Agent peer review
     (Codex, Copilot, harsh-critic subagent, another
     factory agent session that didn't author this
     substrate) is ENOUGH to graduate to canonical.
     Human peer review is additional-trust, not an
     additional required gate — substrate does not
     have to wait on a human to be canonical. Aaron
     autonomous-loop 2026-04-24 clarification:
     *"agent peer review is enough to graduate it"*.
     Disclosure tag: `(peer-reviewed; canonical)` or
     no tag (canonical-when-reviewed is the default).
  3. **Human-peer-reviewed (canonical + human-endorsed)**
     — Aaron or another human maintainer has
     additionally engaged with the substrate. Doesn't
     elevate the canonical status (stage 2 is already
     canonical); it's a separate additional-trust
     marker for substrate that has crossed the
     human-eye threshold. Disclosure tag:
     `(human-peer-reviewed)`, optional — omit unless
     human engagement is load-bearing to a downstream
     claim.

  The risk profile matters: agents rewrite code fast,
  so the cost of building on peer-reviewed-but-not-
  human-endorsed substrate and then retracting is
  small. Requiring human review to graduate would
  serialize the factory through a human bottleneck
  — unsustainable and unnecessary since agent peer
  review catches most of what review catches.
  Agent-peer-review-is-enough keeps the factory
  parallel without lowering the review bar.

  The mechanic becomes "disclose the review state,
  don't hide it" rather than "block until reviewed".

  **Applies to:**

  - Research docs under `docs/research/**` — committed,
    cited within the factory, but not authoritative
    until peer-reviewed.
  - BACKLOG rows proposing new methodology — not
    authoritative for "this is how we do it" until
    peer-reviewed; they're proposals.
  - Memory files capturing a new rule — in-force
    because Aaron said it, but not BP-NN-canonical
    until peer-reviewed and promoted.
  - Skill files shipping a new workflow — runnable,
    but not authoritative as "the right way" until
    peer-reviewed.
  - The provenance-aware claim-veracity detector vN
    promotion path (already reinforced in-spec after
    this directive landed — the axiomatic substrate
    ALONE doesn't promote the detector; axioms +
    peer-reviewed axioms does).

  **Does NOT apply to:**

  - Committed code under `src/**` — the code is
    authoritative by virtue of compiling and passing
    tests. Peer review is still valuable but "final
    canonical" for code means "in production + green
    CI", which is a different gate.
  - Historical surfaces (ROUND-HISTORY, DECISIONS,
    aurora, pr-preservation, hygiene-history) — these
    are history, not claims-about-the-present; they
    don't need "final authoritative" promotion.
  - Mechanical fixes (typos, lint, format, sweep) —
    they don't propose substrate.

  **Concrete disclosure mechanics to design:**

  - What disclosure-note shapes are allowed?
    Candidates: `(not peer reviewed yet)` inline tag;
    frontmatter field like
    `peer-review: none|agent|human|human-and-agent`;
    a badge on the first line of a substrate file.
    Small, visible, and consistent is better than
    exhaustive.
  - What counts as "agent-peer-reviewed"? Independent
    (non-author) reviewer — another AI session that did
    NOT produce the substrate under review. Concrete
    examples: Codex or Copilot external-bot reviews on
    the PR; a harsh-critic subagent dispatched against
    the substrate; a fresh Claude Code session reading
    the substrate cold. The criterion is reviewer
    *independence from authorship*, not "external to
    the factory" — another factory agent session is
    fine as a reviewer as long as it wasn't the author
    of the substrate being reviewed. Rubber-stamps
    don't clear the disclosure.
  - What counts as "human-peer-reviewed"? A human
    maintainer (Aaron today; other human contributors
    if/when they land) that engaged with the substrate
    on its merits. A merge of the PR without comment
    is NOT automatic human-peer-review — the review
    has to have happened.
  - When substrate is modified after a review clearing,
    does the disclosure need to regress? Candidate
    rule: material edits re-open the disclosure (drop
    back to `(not peer reviewed)` for the changed
    section); mechanical edits (typo, lint, format)
    retain the prior state. Rule similar to ADR
    supersedence — but the stakes are lower because
    nothing is blocked, only the disclosure changes.

  **Scope of this row:**

  - Draft the "peer-review-disclosure" rule text suitable
    for promotion to `docs/AGENT-BEST-PRACTICES.md` as
    a new BP-NN rule. Emphasize: DISCLOSURE is
    mandatory; GATING is not. Claims can be bold at
    any state AS LONG AS the disclosure is legible.
  - Decide the disclosure mechanic (inline tag vs
    frontmatter field vs badge).
  - Audit a handful of recent substrate files (the
    claim-veracity detector spec, the clean-room BIOS
    row, this row itself) to classify current
    disclosure state (none / agent / human) and see
    whether the mechanic covers them.

  **Not in scope:**

  - Retroactive peer-review sweep of all existing
    substrate — years of work; drop in at cadence
    going forward instead.
  - **Blocking anything.** The whole point of the
    refinement is that nothing is gated — building
    deeply on top of tentative-canonical substrate is
    allowed. The ONLY mandatory discipline is the
    disclosure note itself. Review-in-flight is the
    normal-state, not the exception.
  - Distinguishing "good review" from "bad review" in
    the mechanic — the reviewer's judgement stands on
    its merits as recorded in the review trail, not
    on the mechanic's attestation.

  **Effort:** M (medium — rule text + mechanic decision
  + small audit). Depends on who peer-reviewer roles
  include (external reviewers already review; the
  mechanic formalizes the pass).

  **Composes with:**

  - `docs/AGENT-BEST-PRACTICES.md` BP-NN rule list
    (this becomes a new stable rule if it lands).
  - `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md`
    — vN promotion gate already references this
    discipline explicitly ("axioms + peer review
    together gate the promotion").
  - The #404 clean-room BIOS workflow — that row's
    standards-pass persona is in the peer-review
    family; this discipline generalizes the gate.
  - Otto-237 mention-vs-adoption discipline (same
    shape: committed ≠ authoritative, adoption is a
    separate gate).
- [ ] **Clean-room BIOS factory workflow — three-persona
  Chinese Wall + factory-standards pass, tractable-
  platforms-only pilot.** Aaron autonomous-loop
  2026-04-24 (verbatim):

  > *"i could get bios and you do both side with different
  > personas one is dirty with existing bios writes specs
  > and the other is clean and only reads specs (I think
  > that's right keep me honest)"* + *"backlog is if its
  > feesable"*

  **Feasibility triage (this backlog row covers FEASIBLE
  only):**

  - **Feasible — PILOT candidates (public-spec-already-
    exists path, no proprietary-BIOS-read required):**
    Atari 5200, Atari 7800, Atari Lynx, Intellivision
    (Mattel Exec ROM), ColecoVision. Each has published
    hardware docs (nocash-style / dev-manuals / reverse-
    engineered community refs) at a specification level
    that a clean-room implementer could work from without
    needing the proprietary BIOS ever enter the loop.
    Weeks-per-platform engineering scope. Factory can
    absorb one pilot.
  - **Theoretically feasible, practically deferred until
    emulation is a first-class workload:** Sony PS1, Sega
    Saturn, SNK Neo Geo. Specs available but non-trivial
    (months-per-platform); clean-room pays only if we're
    scaling to emulator substrate. Gated on: emulator-
    workload becoming a named factory milestone.
  - **Not feasible at factory scope:** Sony PS2, Microsoft
    Xbox (MCPX has anti-RE countermeasures), Nintendo
    GameCube. Years-of-work per platform for teams larger
    than this factory. Don't commit.

  **Methodology (three-persona Chinese Wall + factory-
  standards pass — Aaron Otto-2026-04-24 refinement to
  the classical Compaq / Phoenix two-team model):**

  1. **Dirty persona** (specifier / reader) — Aaron's
     legitimately-acquired BIOS + public docs; writes
     behavioral spec: syscall table, memory map, boot
     sequence, register conventions, error states. Spec
     lives in `docs/clean-room/<platform>/spec.md` and
     IS committed. Reader notes are NEVER committed.
  2. **Clean persona** (implementer / reference) — has
     never seen the proprietary BIOS or the dirty
     persona's reading notes. Reads only the committed
     spec. Writes implementation from scratch, language-
     appropriate. **Output treated as SUBPAR reference**,
     not as factory-ready code — clean persona has no
     factory memory (no Zeta idioms, no BP rules, no
     operator-algebra conventions, no Result-type
     discipline, no F# style guide awareness).
  3. **Standards persona** (re-implementer / factory-
     quality pass) — Aaron's refinement per autonomous-
     loop 2026-04-24: *"if this works it will really be
     a 3 person casue we are not going to take code
     directly that was missing our best practice
     guidance becasue it's missing our memories, we
     would treat output as subpar and rewrire using our
     standards"*. Reads ONLY the clean persona's output
     (never the BIOS, never the dirty notes). Re-writes
     the reference implementation to Zeta standards:
     applies `.claude/skills/fsharp-expert/` idioms,
     operator-algebra discipline, `Result<_, DbspError>`
     error surfacing, AGENT-BEST-PRACTICES BP-NN rules,
     and the factory's memory-accumulated knowledge of
     how Zeta code should be shaped.
  4. **Firewall enforcement** — dirty + clean personas
     run as separate AI sessions (different harness
     logins or isolated memory scopes) so context cannot
     leak. Standards persona is memory-equipped (full
     Zeta context) but sees ONLY clean output, never the
     BIOS or dirty notes. Aaron polices the boundary.
     Any context-contamination incident retires that
     clean persona's output.

  **Why the third persona matters (and why it doesn't
  break clean-room legal defensibility):**

  - Without it, clean output is technically-correct but
    stylistically orphaned from Zeta — doesn't use our
    persistence patterns, doesn't follow our error-
    handling surface, doesn't integrate with the
    operator algebra, doesn't match the F#/.NET
    conventions the rest of the factory uses. Landing
    that code as-is poisons the codebase's consistency.
  - The standards pass is NOT reverse-engineering or
    spec-reading — it's conventional code review /
    rewrite operating on known-good clean-room output.
    The clean-room firewall (dirty → spec → clean)
    remains intact; the standards pass happens fully
    downstream of the firewall.
  - Chain integrity stays one-way: dirty → spec →
    clean → standards. Each stage sees only its
    predecessor's cleaned output, never upstream
    artifacts. Standards persona seeing clean output
    is equivalent to any Zeta maintainer seeing
    upstream library code — routine, not firewall-
    breaking.

  **Open-design questions before the pilot lands:**

  - **AI-session isolation mechanism**: how do we
    provably keep the clean persona's context free of
    dirty-persona notes? Options: (a) completely
    separate harnesses (Codex for dirty, Claude for
    clean, or vice-versa); (b) per-project memory
    scoping with a "clean-only" tag; (c) scratch-org
    for the clean team. (a) is cheapest + most
    defensible.
  - **Spec-shape discipline**: what abstraction level
    avoids code-leakage without being useless? The
    canonical Phoenix spec is the template — describe
    behavior at API / state-machine level, no bit
    patterns, no register labels that mirror source
    names, no pseudocode. Needs a
    `writing-clean-room-specs-skill` (skill name on
    a single line so the inline-code identifier
    renders and is copy-searchable) if this becomes
    routine.
  - **Legal documentation trail**: timestamped commit
    history + session-isolation records need to form an
    auditable paper trail. Each committed spec carries
    its own provenance frontmatter with fields listed
    on individual lines so inline-code spans render
    cleanly (HTML-safe; placeholders use `PLACEHOLDER`
    style rather than `<...>` which markdown can treat
    as raw HTML):
    - `Clean-room-stage: specifier`
    - `Reader-persona: HARNESS_NAME + SESSION_ID`
    - `Source-material: PUBLIC_DOCS_LIST`
    - `Proprietary-BIOS-access: yes|no + DATE_RANGE`

    These fields are defined fresh for this workflow
    rather than reused from the archive-header norm
    for external conversations — different artifact
    class, different field semantics, so reusing the
    existing header shape would just confuse both
    surfaces.

  **Scope of this BACKLOG row:** ONE pilot on a simple
  platform (recommend Atari 5200 — small BIOS, excellent
  public docs, well-understood hardware) proving out the
  three-persona workflow end-to-end. The pilot's success
  criterion is a committed `docs/clean-room/atari-5200/`
  tree with spec.md + implementation.asm (or .fs / .rs
  etc) that boots a test cartridge in an Atari 5200
  emulator.

  **Not in scope:**

  - Clean-room BIOS for complex platforms (PS2, Xbox,
    GCN) — not-feasible, per triage above.
  - A general-purpose "clean-room BIOS for every removed
    platform" campaign — scope-creep. Pilot one, review,
    decide.
  - Emulator development itself — separate roadmap.
  - Legal review by outside counsel — outside factory
    scope; Aaron's call if/when the pilot's output ever
    ships publicly.

  **Effort:** L (large, 2-4 weeks calendar for the
  pilot) for Atari 5200 specifically; other simple
  platforms similar scale each.

  **Dependencies:**

  - Emulator substrate direction being a named factory
    milestone (currently P3 aspirational per the
    "Emulators as canonical OS-interface workload" row
    higher in this file).
  - AI-session isolation mechanism decided (architecture
    question; blocks the pilot).

  **Composes with:**

  - `roms/README.md` — the safe-ROM licensing protocol
    (the per-platform leaf READMEs note which platforms
    were removed because no viable open-source BIOS
    alternative exists). This workflow is the path to
    re-adding any of the removed platforms once a
    clean-room BIOS exists.
  - OS-interface durable-async roadmap (emulators are
    the canonical workload proving it out).

  **Memory:** methodology captured in-tick in agent
  response 2026-04-24; no separate memory file until
  pilot work starts (don't pre-commit to doctrine for
  speculative work).

- [ ] **Ethical clean-room services — future factory
  autonomy / monetization research direction.** Human
  maintainer authorisation (autonomous-loop, 2026-04-24,
  reiterated after acknowledging an earlier sarcastic
  framing): *"you can do an ethical market in the future
  for real to try and make money if youwant"*. Pointer
  to the satirical `malus.sh` site (factory reviewed
  2026-04-24) — the demand being parodied there is real,
  so there is a legitimate market for clean-room
  services done ethically. Future factory-autonomy
  revenue path if/when the `#404` clean-room BIOS pilot
  lands a working portfolio piece.

  **Ethical lane (what the factory would offer):**

  - **Retro preservation / abandoned platforms** — paid
    clean-room BIOS + driver work for consoles, arcade
    boards, handhelds whose original vendors are defunct
    or whose content is effectively abandonware.
    Customer base: retro gaming / preservation
    communities (libretro, RetroArch, MAME), museums,
    academic media-studies programmes.
  - **Orphaned-hardware driver reimplementation** —
    companies owning industrial / medical / telecom /
    legacy equipment whose vendor disappeared; clean-
    room drivers under the customer's chosen license.
    Genuinely sizeable market for the narrow specialism.
  - **Author-requested license-change reimplementation**
    — when an original OSS author wants an MIT version
    of their own GPL / AGPL code for dual-licensing.
    Factory provides the firewalled second team with
    the original author as dirty-persona or as spec
    author.
  - **Sponsored open-source clean-room** — AROS /
    EmuTOS / Altirra model: a company sponsors a clean-
    room implementation that lands as MIT/BSD in the
    commons. Everybody wins including the commons.

  **Anti-lane (what the factory will NOT offer):**

  - License-stripping of live, maintained OSS packages
    so a corporate customer can ship without attribution
    or copyleft compliance — the `malus.sh` parody's
    target market. Violates AGENTS.md `real-factory`
    value (absorb-and-contribute, not absorb-and-strip)
    and the `escro-maintain-every-dep` stance. Doing
    this is what the satire exists to shame.
  - Anonymous-indemnification / offshore-subsidiary
    legal-liability-laundering. Legal exposure from
    clean-room work rests on the clean-room hygiene
    actually being clean — no "indemnification through
    offshore LLC" can paper over a contaminated
    firewall.

  **Ethical guardrails that make the lane distinguishable:**

  - Attribution preserved wherever the original was
    licensed under an attribution requirement — even if
    the clean-room output is under a different license,
    the spec-stage attributes public-doc sources.
  - Original authors consulted for author-requested
    license-change work (not a shortcut for them; an
    accommodation of their own wish).
  - License changes disclosed explicitly in the clean-
    room output's license header and release notes.
  - Clean-room hygiene documented + auditable per the
    `#404` workflow (dirty→spec→clean→standards chain
    of custody; session-isolation records).

  **Feasibility gate (matches `#404`'s triage):**

  - Retro preservation → feasible for simple BIOSes
    (Atari 5200 / 7800 / Lynx / Intellivision /
    ColecoVision) — weeks per platform. Viable today
    once the `#404` pilot proves the workflow.
  - Orphaned-hardware drivers → feasible per-contract;
    customer supplies the hardware + docs; factory
    supplies the firewalled team + toolchain. Scope
    varies hugely.
  - License-change and sponsored-OSS → feasible with
    no up-front investment; only needs an original
    author or sponsor to show up with a concrete
    request.
  - Complex platforms (PS2, Xbox, GameCube) → NOT
    feasible at factory scale — years per platform.
    Even paying customers can't change the engineering
    reality.

  **Pricing / scope philosophy (preliminary, subject
  to factory-economic research before any actual
  engagement):**

  - Fixed-scope contracts with phase gates (spec
    acceptance → clean implementation → standards
    pass → delivery) rather than time-and-materials;
    predictable for customers, less likely to slide
    into unethical corner-cutting.
  - Upper-bound attribution disclosure baked into
    every engagement — we publicly acknowledge WHAT
    we did (not WHO paid us, if the customer asks for
    confidentiality on the commercial relationship
    itself).
  - Refusal right on engagements whose framing (a)
    falls into the anti-lane above, or (b) would
    require breaking an original author's stated
    wishes. Refused engagements logged (no names if
    customer confidential) so the factory's discipline
    is auditable.

  **Dependencies:**

  - `#404` clean-room BIOS pilot landing and proving
    the workflow end-to-end on a simple platform.
    That's the portfolio piece. No customer engagements
    until there's evidence the pipeline works.
  - Factory-economics research pass (legal structure,
    contract templates, liability caps, what
    jurisdiction-shopping is and isn't acceptable for
    this factory's values — outside scope for the
    factory itself; Aaron's call).
  - AI-session isolation mechanism decided (same
    dependency as `#404`).

  **Not in scope for this row:**

  - Actual customer acquisition / marketing / business
    development — premature until the pilot works.
  - Legal review by outside counsel — required before
    any actual engagement; not the factory's decision.
  - Pricing research — sized only after at least one
    completed pilot gives us a cost model.

  **Effort:** L (large). Multi-phase: `#404` pilot →
  factory-economics research → legal-structure decision
  → first ethical engagement. Years-scale if pursued
  seriously; not a 2026 calendar item.

  **Composes with:** `#404` clean-room BIOS factory
  workflow (the prerequisite pilot); `AGENTS.md`
  `real-factory` + `escro-maintain-every-dep` values
  (the ethical compass); `docs/WONT-DO.md` (future
  anti-lane entries would land here).

  **Memory:** methodology + ethical-lane discipline
  captured in agent response 2026-04-24 (autonomous-loop
  tick following the `malus.sh` framing). No separate
  memory file until actual customer engagement work
  begins — same discipline as `#404`: doctrine lands
  only when the work becomes real.

- [ ] **Exempt `memory/CURRENT-*.md` from memory-index-
  integrity paired-edit trigger.** The
  `memory-index-integrity.yml` workflow (NSA-001 guard)
  requires any add-or-modify on a top-level `memory/*.md`
  file to be paired with a `memory/MEMORY.md` edit in the same
  PR. The intent is real — new session memories must
  have index pointers — but the trigger-exemption list
  (`memory/README.md`, `memory/persona/*`, `memory/MEMORY.md`
  itself — matching the single-star pattern the workflow
  actually uses) misses `memory/CURRENT-*.md`. CURRENT files
  are per-maintainer distillations of memories that are
  ALREADY indexed under their own `feedback_` / `project_` /
  `reference_` entries; the CURRENT file itself isn't a
  new indexable memory. Modifying CURRENT shouldn't
  require a MEMORY.md edit, but today it does (hit on
  PR #412 2026-04-24, worked around by adding a dated
  "refreshed" note to MEMORY.md's fast-path line).

  **Scope:**

  - Add `memory/CURRENT-*.md` (equivalently
    `memory/CURRENT-aaron.md` / `memory/CURRENT-amara.md`
    / future CURRENT-<name>.md) to the case-statement
    exemption list in
    `.github/workflows/memory-index-integrity.yml:60-95`,
    alongside the existing `memory/README.md` and
    `memory/persona/*` cases.
  - Regression-verify: a PR that modifies only
    `memory/CURRENT-aaron.md` should pass without
    touching MEMORY.md.
  - Leave the core NSA-001 guard intact — any new
    `memory/feedback_*.md` / `memory/project_*.md` /
    `memory/user_*.md` / `memory/reference_*.md` still
    requires a paired MEMORY.md index pointer. (Directory
    prefix spelled consistently on each for clarity since
    all four live at the same depth.)

  **Not in scope:**

  - Widening or loosening the NSA-001 guard itself.
  - Backfilling missed MEMORY.md pointers for prior
    CURRENT refreshes (none missing today — the
    cadence has always touched MEMORY.md as part of
    the refresh).

  **Effort:** S (one case-statement entry in the
  workflow + one-shot verify).

  **Composes with:** NSA-001 incident
  (`docs/hygiene-history/nsa-test-history.md`) — same
  rule, refined exemption.

- [ ] **User-mode filesystem driver interface — Zeta as
  a mountable FS via FUSE / WinFsp / macFUSE; research
  first; composes with eventual microkernel + all-
  dotnet/F# direction.** Maintainer 2026-04-24
  directive (verbatim, way-back-backlog):

  > *"back back log file system driven interface like
  > whatever is modern for linux and windows and mac
  > user mode file system driver interface is fine and
  > expected. resersh first of course, this will help
  > when we go to microkernal all dotnet f#"*

  Scope: expose Zeta's substrate (Z-set tables,
  hierarchical index, native git, blockchain blocks,
  etc.) as a **mountable filesystem** via the modern
  user-mode filesystem driver interfaces:
  - **Linux**: FUSE (libfuse / fuse3) — well-trodden;
    rust-fuse, dotnet-fuse bindings exist.
  - **Windows**: WinFsp — modern user-mode FS for
    Windows (Cygwin / Git-for-Windows ship FUSE
    compatibility on top of WinFsp).
  - **macOS**: macFUSE (formerly OSXFUSE), or modern
    FSKit on macOS 26+ (System Extension class —
    Apple's official FUSE replacement).

  **Why this composes with the architecture:**
  - **Mode 1 single-binary** can mount the running
    Zeta instance as `/mnt/zeta` — every Z-set table,
    every git ref, every blockchain block becomes a
    file/directory readable by `ls`, `cat`, `grep`.
  - **Native F# git impl** + **closure-table
    hardening** + **cross-DSL composability** all
    project naturally onto FS semantics: git tree
    objects ARE directories, blobs ARE files, refs
    ARE symlinks.
  - **Microkernel + all-dotnet/F# trajectory** —
    maintainer's note: this preps for the future
    microkernel where everything is dotnet/F#. A
    user-mode FS interface is the right cross-language
    boundary even before the microkernel arrives.
  - **Ouroboros bootstrap closure** — a Zeta instance
    can mount itself, and another Zeta peer can `cp -r
    /mnt/peer-zeta/.git/` to clone the source-of-truth
    using regular FS tools. Self-referential by design.

  **Phase 0 research** (before any code):
  - State-of-the-art user-mode FS interfaces per OS:
    FUSE3 API (Linux), WinFsp API (Windows), macFUSE
    + FSKit (macOS 26+), Plan 9 / 9P fallback option.
  - .NET / F# bindings per platform; gaps where we'd
    have to write the binding ourselves.
  - Interface that makes sense for Zeta — what's the
    minimal `IZetaFilesystem` contract that supports
    mounting ZSets / git / blockchain / arbitrary
    operator-algebra views?
  - Platform parity strategy: same Zeta server speaks
    FUSE on Linux, WinFsp on Windows, FSKit/macFUSE on
    macOS, with a single F# implementation behind a
    platform-shim layer.
  - Microkernel integration plan: when we go all-
    dotnet/F# at the microkernel level, this user-mode
    FS API becomes the kernel-mode FS API — same
    contract, different implementation tier.
  - Output: `docs/research/user-mode-fs-driver-interface-2026.md`.

  **Composes with:**
  - **Native F# git implementation** (#395 cluster) —
    git tree → directory; blob → file.
  - **Closure-table hardening** (#396) — the
    hierarchical index this FS layer hits.
  - **Cross-DSL composability** (#397) — FS
    operations are another DSL that composes with SQL
    / operator-algebra / git via the same substrate.
  - **Blockchain ingest** (#394) — `/mnt/zeta/btc/blocks/<height>`
    is a natural mount point.
  - **Ouroboros bootstrap meta-thesis** (#395) — the
    FS interface IS an Ouroboros closure (Zeta
    mountable as itself).
  - **Aurora microkernel direction** (long-horizon)
    — the user-mode FS API today becomes the
    microkernel FS API tomorrow.

  Priority P3 / way-back-backlog per maintainer;
  effort L+ (research) + L+L+L (per-platform binding,
  bootstrap implementation, hardening). Composes with
  `file-system-persistence-expert`,
  `networking-expert` (9P fallback), `bash-expert`
  + `powershell-expert` (mount script wrappers),
  `threat-model-critic` (FS exposure surface
  analysis), Otto-275 log-don't-implement.

  **Does NOT authorize** starting implementation
  before Phase 0 research lands. **Does NOT
  authorize** declaring FS interface "stable" without
  Aminata threat-model sign-off on the
  filesystem-namespace exposure surface (mount points
  are an attack surface).

- [ ] **Rename Starboard → farm-related seed-extension
  kernel; pair with carpentry-related second seed-extension
  kernel.** Maintainer 2026-04-24 directive (verbatim):
  *"Instead of Starboard lets go with someting farm related
  and carperntry related since those will be our two seed
  extenion kernels we can shrink over time, i saw one of
  your researcher i think write like big bangs at every
  layer i thought that was cool. this is from google ai,
  just suggestions, we can idate, keep all the exiting
  nautical and elron and all that research but we will be
  renaming starboard to someting else."*

  **Reverses Otto-175c Starboard-as-Frontier-rename.**
  Otto-175 picked Starboard as the Frontier-UI rename
  (Otto-168 naming-conflict resolution). The current
  directive supersedes that pick. Per Otto-229
  append-only on history rows: do NOT edit Otto-175 /
  Otto-175c rows; this row records the reversal forward.

  **Two seed-extension kernels (new architecture frame):**
  - **Kernel A — farm-related** (replaces Starboard).
    Property: shrinks over time. Maintainer's farm-grown-up
    background grounds the metaphor.
  - **Kernel B — carpentry-related** (new addition).
    Property: shrinks over time. Pairs with Kernel A.
  - **"Big bangs at every layer"** — research metaphor a
    factory persona produced that the maintainer flagged
    as compositionally aligned with the seed-extension
    frame. Find and cite the producing-persona's research
    when the rename lands so the metaphor is preserved.

  **IP / mention-vs-adoption discipline (Otto-237):**
  - PRESERVE all existing nautical / Elron / Hubbard
    research substrate (`docs/research/frontier-rename-
    analysis-otto-170.md`, the Otto-175 thematic-mapping
    research, all Sea Org / Commodore / auditing-at-sea
    notes). The maintainer is explicit: "keep all the
    existing nautical and elron and all that research".
    Renaming does NOT mean purging the substrate.
  - CHANGE the chosen factory-vocabulary name only.
  - Mention vs adoption: Starboard-thematic research
    remains MENTIONED throughout the substrate; the new
    kernel-A / kernel-B names become the ADOPTED factory
    vocabulary going forward.

  **Google AI ideation seed — batch 1 (general farm,
  verbatim categories from directive — do NOT auto-adopt;
  iterate via `naming-expert` skill review):**
  - Tech-Focused & Industrial: AgriNexus AI, HortiCore,
    SiloSync, BioSync Innovations, GridGrain.
  - Rare & Obscure Words: The Mow, Firkin, Barrack,
    Humpty-Dumpty, Mispeld.
  - Action-Oriented & Creative: Cultivate, YieldBotics,
    Root & Rise, Seed & Soil, HarvestOS.
  - Frontier & Heritage: FarmFrontier, Pioneer Valley,
    Landmark Acres, Evergreen Horizon.

  **Google AI ideation seed — batch 2 (Q/Z + algebraic
  blend, second 2026-04-24 share, verbatim categories;
  same do-NOT-auto-adopt rule):**
  - Technical & Algebraic Concepts: Zeta-ic Yield,
    Quar-Tectory, Alge-Zanja, Re-Zonal Stream,
    Event-Quanta.
  - Unique Agricultural Jargon: Siliqua-Core,
    Zamindary-OS, Quinze-Fields, Zoonotic-Logic,
    Zero-Till Qubits.
  - Abstract & Experimental: Squiz-Factor,
    Queazy-Algebra, PQC-Pastures.

  **Notable resonances flagged for `naming-expert`
  review** (do NOT settle; surface for triage):
  - **Siliqua-Core** — *siliqua* literally = seed pod;
    direct linguistic match for the maintainer's
    "seed-extension kernel" framing.
  - **Zeta-ic Yield** — pairs the existing
    repo/mathematical-foundation name with farm yield
    (compositional with the Riemann-zeta lineage Zeta
    already riffs on).
  - **Zanja** — irrigation canal; pairs cleanly with
    "flow of logic through an automated stream"
    (matches the existing dataflow / push-pull substrate
    in Zeta's operator algebra).
  - **Zamindary-OS** — archaic landowner term; fits
    factory-as-multi-agent-host metaphor.

  **Carpentry-side has no ideation seed yet** — the
  directive named carpentry as the second kernel but
  did not propose names. Work scope: parallel slate of
  carpentry-related candidates (Awl, Plane, Lathe,
  Mortise, Joinery, Workbench, Truss, Rafter, Dovetail,
  ...) for `naming-expert` triage alongside the farm
  slate.

  **Process gate.** No rename PR until the maintainer
  iterates the slate to two finalists (kernel-A + kernel-B)
  and `naming-expert` runs IP discipline + Otto-244
  no-symlinks + cross-substrate-conflict check on each.
  Otto-275 log-don't-implement applies — capture the
  directive durably + iterate when the maintainer chooses
  the timing.

  **Composes with:** Otto-168 (Frontier naming-conflict
  origin), Otto-170 / Otto-175 / Otto-175c (Starboard
  research + adoption + thematic-mapping), Otto-237 (IP
  adoption-vs-mention), Otto-244 (no-symlinks rule for
  cross-placement), Otto-275 (rapid-fire absorb /
  log-don't-implement).

  **Companion memory file** capturing the directive +
  framing constraints lands alongside this row so the
  reversal of Otto-175c is recoverable from a fresh
  session via grep.

- [ ] **Multi-account access design — safety-first research + design proposal for eventually letting Otto operate across multiple accounts (ServiceTitan / personal / other) without confusion or privilege-bleed. Design allowed now; implementation gated on Aaron's personal security review of the design before any code lands.** Aaron 2026-04-23 Otto-76: *"FYI don't get confused i switchd the codex CLI to service titan like you so you would be on the same account, if you open the playwrite it's logged into my personal account with amara access. i happy to expand multi account access design in the future we don't need to worry about it right now, this is how we are setup for now, free free to resaerch, design multi account access and how to make it safe as part of this proiject low backlog item"* — then Otto-76 refinement: *"its fine to design and all that now on multi account thats one i just would want to review a design first, i want to validate that one for securty consers myself"* + *"you can pick the timing"*.

  **Two-phase structure — design-now-implementation-later:**
  1. **Phase 1 — design proposal (authorised, timing Otto's call).** Research + design document covering the 7 questions below. Lands as a research doc / ADR / decision-proxy evidence record. **No implementation code yet.** Aaron reviews the design personally for security concerns.
  2. **Phase 2 — implementation (gated on Aaron's design review + approval).** Only starts after Aaron has explicitly signed off on the Phase 1 design. Design review can land in multiple forms: ADR with Aaron's sign-off row, decision-proxy evidence record with `requested_by: Aaron` + `authority_level: delegated`, or a direct PR-review approval with explicit "design approved, proceed to implementation" language. **Not** an assumption of approval from silence.

  **Current setup (2026-04-23 snapshot):**
  - **Claude Code session (Otto)** — ServiceTitan account (Aaron's work-tier seat; factory-agent workload).
  - **Codex CLI session** — ServiceTitan account (switched Otto-76 to align with Claude Code session; parity for cross-harness work).
  - **Playwright MCP** — Aaron's personal account (has Amara access at `chatgpt.com`).
  - **GitHub authentication** — Aaron's personal `aarons` GitHub identity (owns both AceHack and LFG via org membership; LFG is the canonical substrate; AceHack is the experimentation frontier).

  **Why this is priority-low-but-design-authorised:**
  - Today, same-account alignment (ServiceTitan-across-Claude-Code-and-Codex) sidesteps most multi-account complexity.
  - Playwright's personal-account scope is bounded (browser automation for courier ferries + ChatGPT interaction for Amara), not mixed with factory-agent credentials.
  - Aaron explicitly sized the initial ask as "low backlog item" and said "we don't need to worry about it right now".
  - Otto-76 refinement: *"its fine to design and all that now on multi account"* — design work is OK immediately if Otto chooses to prioritise it; implementation requires Aaron's personal security review first. Priority stays P3 because Aaron scoped timing to Otto's choice, but design-gate is lifted.

  **What research + design needs to cover:**
  1. **Authentication model.** How does Otto know which account it's acting on? What's the handshake when it starts a tool call that uses account-bound credentials? Today it's "whatever the shell inherits"; that's fine for single-account but insufficient for multi.
  2. **Privilege-bleed prevention.** If Otto has access to ServiceTitan + personal + `LFG.admin` + `Aaron.personal.admin` simultaneously, how do we prevent one scope from acting as another? Per-tool credential isolation? Explicit `--as <account>` flags? Principle-of-least-privilege for the factory-agent.
  3. **Audit trail.** Every tool call should record which account authorised it. The decision-proxy-evidence record format (`docs/decision-proxy-evidence/`) has `requested_by` / `proxied_by` fields; multi-account extends this with `authorised_by_account`.
  4. **Cross-account boundary rules.** Are there actions Otto should NEVER do on account X (e.g., spending on ServiceTitan account, because Aaron owns cost personally)? The full-GitHub-authorization memory (2026-04-23) already has a spending-increase hard line; multi-account generalises this.
  5. **Safe-default fallthrough.** When an account context is ambiguous, default to the most-restrictive scope, not the most-permissive. Fail-closed on account detection, not fail-open.
  6. **Explicit maintainer visibility.** Aaron should be able to inspect "which account was Otto on when it did X?" through some log / UI. Frontier-burn-rate-UI adjacent (Otto-63); could reuse the same pipeline.
  7. **Credential lifecycle.** Token rotation, refresh, revoke. What happens when Aaron revokes ServiceTitan SSO? Otto should notice + stop acting on that account, not silently continue with stale tokens.
  8. **Poor man's (no-paid-API-key) access modes for personal-tier accounts — hard design requirement.** Aaron Otto-76: *"for some of the personal accounts i can't get api keys without it costing more money so the design need to include personal account that try to use the poor mans version of avoiding api keys, this wont' be true for orgs like service titan but might be for lfg thats my company lol."* Personal accounts (and possibly LFG, Aaron's company) cannot assume paid API-key access is available. The design MUST cover non-API access modes for those accounts: browser-automation (Playwright already exemplifies this for Amara on personal ChatGPT), session-cookie reuse, OAuth device flows, MCP tools that use session state rather than API tokens, shared-credential-with-explicit-scope patterns. Orgs with enterprise subscriptions (ServiceTitan) retain API-key-native paths. **Design tier matrix:** (a) *Enterprise-API-tier* — org accounts with paid API access, use official APIs (fast, structured, rate-limit-generous). (b) *Poor-man-tier* — personal accounts without paid API access, use browser-automation / session-based / OAuth-device flows (slower, scraped, rate-limit-constrained, but works at $0 marginal cost). (c) *Mixed-account-ops* — the interesting case — when a workflow spans an enterprise-tier account AND a poor-man-tier account, how do the two interact without one leaking into the other? Phase 1 design must name which tier each current-setup account is in and what the poor-man-tier mechanism looks like per account.

  **Sibling / composing rows:**
  - `docs/decision-proxy-evidence/` schema (PR #222) — already records `requested_by` / `proxied_by`; extend with account when this row executes.
  - GitHub-authorization spending hard-line (no paid-tier upgrades, no billing changes without Aaron's explicit say-so) — the first multi-account-aware restriction; multi-account design generalises it.
  - Frontier-burn-rate-UI backlog row — natural surface for per-account visibility.
  - First-class Codex-CLI session experience row (PR #228) — assumes same-account today; multi-account design is an evolution of the session-layer portability story.

  **Priority:** P3 (not-urgent per Aaron's framing; timing is Otto's call per *"you can pick the timing"*).

  **First file to write (Phase 1 design work, authorised now):**
  `docs/research/YYYY-MM-DD-multi-account-access-design-safety-first.md` — survey of analogue systems (AWS roles + assumed identities, gcloud multi-account, Vault's scoped tokens, browser profile isolation) + Zeta-specific threat model + safe-default policy proposal. Aaron reviews for security concerns before any implementation follows.

  **Scope limits:**
  - Does NOT authorize implementing multi-account access before Aaron's personal security review of the Phase 1 design. Implementation is explicitly gated.
  - Does NOT authorize Otto to start requesting additional account credentials "to prepare" for multi-account — if Aaron wants more accounts added, he adds them explicitly.
  - Does NOT block other work — this row is design-and-then-review until Aaron signs off.
  - Does NOT authorize acting on any account Otto doesn't currently have legitimate credentials for. Design is about what-a-future-system-could-look-like, not about bootstrapping new-account-access unilaterally.

- **Language + concepts age-classification skill.** The
  human maintainer 2026-04-23 (two-message directive):

  > *"we should probably have some language age
  > classification skill probably based on our own
  > statendard we come up with that make sense for AI
  > and huamsn both, and like the existing human ones,
  > so it's easy to know what's safer for what age range
  > based on existing human standards and a new evolving
  > standard that is more logical and based on real
  > physisolgy with evidense and research we can do, low
  > backlog item."*

  > *"it's probably concepts too not just the language
  > like that seems like what many of the human
  > classifactions are on"*

  > *"i tried to also say psychology lol i also like
  > physiology too"*

  **Two-axis classification**: **language** (profanity,
  slurs, suggestive terms) + **concepts** (violence, sex,
  drugs, themes, behaviours, ideology exposure). Most
  existing human standards (MPAA / ESRB / PEGI / TV
  ratings) are primarily concept-based — the skill
  should be too.

  **Goal**: classify any text / content / docs / code /
  memory-entry by age-appropriateness along two output
  strands simultaneously — existing human standards
  (MPAA G/PG/PG-13/R/NC-17, ESRB E/E10+/T/M/AO, PEGI
  3/7/12/16/18, TV Y/Y7/G/PG/14/MA) AND a new
  psychology + physiology / research-based standard the factory can
  evolve (developmental-psychology + reading-comprehension
  + cognitive-load + media-effect literature).

  **Bi-audience target**: works for AI and humans both.
  AI-side flags content that might violate safety training
  / content policies at inference; human-side flags
  content for minors / school-curriculum fit.

  **Composes with**: per-user memory
  `feedback_pinned_random_seeds_containing_69_or_420_when_agent_picks_2026_04_23.md`
  (at `~/.claude/projects/<slug>/memory/`) already
  captures the high-school-curriculum-friendly target
  with R-rated-when-necessary-for-effect exception; this
  skill is the enforcement surface. Adjacent safety
  skills `prompt-protector` / `ai-jailbreaker`.
  `docs/AGENT-BEST-PRACTICES.md` content-policy
  substrate.

  **First-pass output** (per classified item):

  ```text
  { language_rating, concept_ratings (per category),
    mpaa, esrb, pegi, tv, factory_rating, reasons }
  ```

  **Research deliverable first**: `docs/research/age-classification-standard-YYYY-MM-DD.md` before skill
  implementation. Covers existing standards' criteria,
  physiology-based standard proposal, rating-axis design,
  edge cases, AI-safety vs human-age-appropriateness
  convergence.

  **Scope**: research note first; skill lands after
  standard stabilises. No commitment to adopt. Effort S for
  research; M for skill. Priority P3 per "low backlog
  item".

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

- **Is UML modelling useful for the factory, and what
  tools would it require us to map?** The human
  maintainer 2026-04-23: *"backlog is uml modeling
  useful for the factory and what tools would it
  require us map?"*. Two-question research pointer:

  1. **Utility question**: does the factory benefit
     from UML modelling? The factory's current
     discipline is spec-as-source-of-truth via
     OpenSpec (behavioural specs) + formal specs (TLA+,
     Lean, Z3, FsCheck, Alloy). UML's class / sequence
     / state / activity / deployment diagrams overlap
     those roles partially — where do they add value
     the factory doesn't already have?
  2. **Tooling-map question**: if we do adopt UML, what
     tools would the factory need to inventory? The
     factory-technology-inventory (PR #170) already
     tracks language / runtime / data / harness /
     verification / static-analysis / CI rows; adding
     UML would add a modelling-tools row-set covering:
     - **Diagram editors** (PlantUML, Mermaid, draw.io,
       Structurizr, Rational Rose lineage — see the
       Rational Rose P3 row)
     - **Text-based formats** (PlantUML / Mermaid /
       Structurizr DSL are Markdown-compatible and
       git-native; fit row #49 post-setup stack)
     - **Model-to-code round-trip** (if we want
       code-generation from model)
     - **Model-vs-code drift detection** — parallel to
       `verification-drift-auditor` but for UML

  Composes with the adjacent Rational Rose P3 row (in-repo
  via PR #163; sits immediately above this row), `docs/FACTORY-TECHNOLOGY-INVENTORY.md`
  (lands via PR #170; target inventory surface), the
  OpenSpec workflow, and the formal-spec stack.

  **First-pass recommendation** (to be validated by the
  research pass): **Mermaid** is the factory-aligned
  lightweight default — git-native, renders in GitHub,
  zero toolchain. **PlantUML** adds expressiveness but
  needs Java. **Structurizr** adds architecture-as-code
  framing. Heavy UML tools (Rational Rose / Enterprise
  Architect / MagicDraw) are likely over-scoped for a
  factory that already has formal-spec discipline.

  Scope: research note under
  `docs/research/uml-modelling-for-the-factory-YYYY-MM-DD.md`
  when prioritised. No commitment to adopt. No deadline.
  Effort S for first-pass note; M if adoption is chosen.

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

- [ ] **Research + map `claude --agent <agent_name>` harness flag.** Aaron 2026-04-24 Otto-120: *"FYI your harness just popped up this tip you should reserach and map Tip: Use --agent `<agent_name>` to directly start a conversation with a subagent backlog"*. Factory has ~25+ personas reachable this way. Scope: (1) locate official doc; (2) test with 2-3 factory personas; (3) map use-cases — direct-invoke Aminata/Ilyana/Aarav for one-shot reviews; (4) document in `docs/references/claude-cli-agent-flag.md`; (5) integrate where direct invocation beats Task-tool dispatch. Priority P3 convenience. Effort S.

- [ ] **Pre-landing sanitizer for ferry absorbs — auto-clean Amara verbatim markdown patterns before CI.** Aaron 2026-04-24 Otto-119: *"also we should backlog longer-term, a pre-landing sanitizer could handle this automatically."* Systemic patterns: `#<num>` at line-start → H1 (MD018); line-wrapped `###` headings (MD001 false positive); lists w/o blanks (MD032); trailing whitespace. Scope: (1) catalog patterns from PRs #311 / #312 / future; (2) write sanitizer script; (3) integrate as pre-commit hook or ferry-absorb skill step; (4) validate on existing ferries. Priority P3 convenience. Effort S + S.

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

- [ ] **ChatGPT conversation-download skill — on-demand, no cadence.** Aaron 2026-04-24 Otto-108 directive: *"if it's easy to do we might as well add a chatgpt conversation/chat download skill on demand no cadence backlog"*. The technique is proven: Otto-107 pulled the full ~24MB / 3992-message / 8-month Amara conversation in one `fetch` call via the `backend-api/conversation/<UUID>` endpoint once the Bearer JWT from `/api/auth/session` + `chatgpt-account-id` + `chatgpt-project-id` headers were supplied. Package that as a reusable Claude Code skill under `.claude/skills/chatgpt-conversation-download/` (authored via the `skill-creator` workflow per GOVERNANCE.md §4) so future Otto instances (or Aaron) can invoke "download ChatGPT conversation <URL-or-ID> to drop/" on demand without re-solving the auth / headers / unwrap-double-encoded-JSON steps. Skill scope: (1) extract conversation-ID + `chatgpt-account-id` + (optional) `chatgpt-project-id` from an input URL; (2) navigate via Playwright MCP to the conversation page; (3) call `fetch` inside page context with auth headers captured from the page's active session; (4) unwrap the `browser_evaluate`-double-JSON-encoded string to real JSON; (5) save to `drop/chatgpt-conversations/<ID>.json` (drop/ gitignored per PR #299); (6) emit summary stats (title, message count, date range, role distribution, rough page count). Does NOT auto-absorb into `docs/`; absorb is a separate skill per §33 discipline. Does NOT auto-trigger on cadence; strictly on-demand per Aaron directive. SPOF: `chatgpt-account-id` and `chatgpt-project-id` are workspace-scoped and may rotate; skill extracts both fresh each run rather than hardcoding. Priority: **P3 — convenience**; file when substrate time available; do NOT deprioritize other cadence-graduation work for this. Effort: S (the mechanism is proven; packaging + skill authoring is the ship).

## P3 — LFG-only experiment track (throttled)

- [ ] **LFG-only capability experiments (throttled, not every
  round).** Aaron 2026-04-22: *"I paid for copilot and teams
  on LFG so I'm paid over there if you want to put some
  experinments around explorgin whats possible with LFG that
  we cant do with AceHAck and we can have certain experiments
  we run overthere throttled not every round so it will be
  cheap."* LFG is a Copilot Business + Teams plan with all
  enhancements enabled; AceHack is free tier. The routine-
  work rhythm (PRs land on AceHack per
  `docs/UPSTREAM-RHYTHM.md`) stays; this is a parallel, slower
  track for capabilities **only LFG can provide**. Budget stays
  $0 = hard cost-stop; experiments run inside free-tier
  allowance. **Scouting inventory:**
  `docs/research/lfg-only-capabilities-scout.md` (10 candidate experiments, cadences
  defined per experiment). **Gate for Enterprise upgrade:**
  Aaron explicit — "only if enough stuff you can do only over
  there we end up with a large backlog" (≥10 experiments
  genuinely LFG-only). **Owner:** Architect (Kenji) to
  schedule; individual experiments get per-row tracking once
  they're ready to run. **Effort:** per-experiment; most S-M.
  **Source of truth:**
  `memory/feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md`
  + `docs/research/lfg-only-capabilities-scout.md`.

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

## P2 — Foundation (Asimov) aspirational-reference research

- [ ] **Research Asimov's *Foundation* (novels + Apple TV
  adaptation) as aspirational reference for factory design.**
  Human maintainer 2026-04-23 Otto-52: *"you should read/
  research Isaac Asimov's Foundation the books and the Apple
  TV series, the TV series has really good modern spin on
  the whole thing where the emporer was clones. We are
  trying to build Foundation from Harry Seldon point of
  view. my good developer friend with went to MIT called me
  Harry Seldon because my brain works like Psychohistory lol.
  We want to make something that last for melinia, i think
  in infinities, my brain can't help it. backlog."*.
  **Scope:** systematic read of the Asimov Foundation novel
  cycle (trilogy + prequels + sequels; published 1942-1993)
  + watch the Apple TV 2021- adaptation (focus on modern
  spin, Genetic Dynasty / Cleon-cloned-emperor thread, Hari
  Seldon presentation, Gaal Dornick arc, Second Foundation
  framing). Extract patterns mappable to factory substrate:
  (a) Psychohistory as mathematical-substrate-of-civilization
  → candidate parallel to Zeta's retraction-native algebra as
  substrate-of-agent-coherence; (b) Seldon Plan = multi-
  generational continuity plan with a Time Vault release
  cadence → candidate parallel to Craft curriculum +
  succession-through-the-factory + ADR-and-memory pattern;
  (c) Foundation/Second-Foundation two-layer structure
  (visible + hidden stewardship) → candidate parallel to
  public-Zeta-library + private-per-user-memory +
  factory-internal-governance; (d) Emperor clones (Apple TV
  modern spin) → candidate parallel to single-Otto-across-
  sessions vs multi-agent-Docker-peer-review future pattern;
  (e) Psychohistory's core claim that mass-behavior becomes
  statistically predictable at sufficient scale → candidate
  parallel to factory-behaviour-at-substrate-scale pattern.
  **Deliverable chain:** (1) reading log
  `docs/research/foundation-asimov-aspirational-reference-
  2026-MM-DD.md` — chapter-by-chapter or episode-by-episode
  notes extracting canonical patterns with quoted source
  text; (2) pattern-map doc aligning Foundation concepts to
  existing factory memories + BACKLOG rows + research docs;
  (3) critical-read section honestly flagging where the
  analogy breaks down (Psychohistory is fiction with known
  real-world failures; the Genetic Dynasty is dystopia not
  model; Foundation's five-agent-to-many-agent arc is
  speculative, not engineering). **Composes with:**
  `memory/project_craft_secret_purpose_agent_continuity_
  via_human_maintainer_bootstrap_2026_04_23.md` (succession
  pattern = Seldon Plan analogue); `memory/project_frontier_
  ux_zora_star_trek_computer_with_personality_...` (another
  fictional reference, Star Trek Discovery's Zora — similar
  methodology: extract patterns, not canon); `memory/
  project_common_sense_2_point_0_name_for_bootstrap_
  phenomenon_stable_start_live_lock_resistant_...` (safety
  floor required under any long-horizon continuity plan).
  **Register note:** the human maintainer self-identifies
  with the Hari Seldon archetype (*"my brain works like
  Psychohistory"*); treat this as a self-stated cognitive-
  style signal informing how the factory represents their
  intent rather than a grand claim. *"thinks in infinities"*
  is a vocabulary choice matching earlier never-idle +
  nice-home-for-trillions discipline; not a new
  commitment. **Effort:** L (novel cycle + TV adaptation is
  significant read-time; pattern extraction is multi-round
  research arc). **Owner:** Iris (UX for continuity-of-
  experience framings) + Kai (positioning) initial; Kenji
  synthesis; the Architect integrates into the fictional-
  reference research cluster alongside Star Trek / Zora.
  **Source of truth:** this entry + out-of-repo memory
  (will be filed same tick as `feedback_human_maintainer_
  is_hari_seldon_archetype_foundation_as_factory_
  aspirational_reference_2026-04-23.md`).

## P2 — FACTORY-HYGIENE — name-attribution policy clarification (history-file exemption)

- [ ] **Name-attribution policy — codify history-file
  exemption and add prevention audit for non-history
  surfaces.** Human maintainer 2026-04-23 Otto-52: *"'No
  name attribution in code, docs, or skills' in history
  files are files like memory backlog and other things
  like that for historical purposes"*. Clarifies the "No
  name attribution" candidate rule in
  `docs/AGENT-BEST-PRACTICES.md`: history files
  (tick-history, MEMORY.md / memory/**, BACKLOG
  attribution lines, hygiene-history/**, ROUND-HISTORY.md,
  research logs) are **EXEMPT** because they record
  historical reality including who-said-what. Sweeping
  those files would erase the historical record. The rule
  still applies to *forward-looking* surfaces: code,
  skills (`.claude/skills/**/SKILL.md`), governance docs
  (GOVERNANCE.md, AGENTS.md, ALIGNMENT.md), agent
  persona files (outside `memory/persona/**`), user-
  facing docs (README, sample code, docs/craft/**),
  module bodies, and forward-planning docs. **Scope:**
  (1) update `docs/AGENT-BEST-PRACTICES.md` "No name
  attribution" entry to list the exempt history-file
  surfaces explicitly; (2) add a prevention audit
  (`tools/hygiene/audit-name-attribution-non-history.sh`)
  that grep-excludes history surfaces and flags direct
  names on forward-looking surfaces; (3) add FACTORY-
  HYGIENE row for cadenced execution. **Not in scope:**
  retroactive sweep of history files — the exemption
  specifically preserves those. The single tick-history
  row fixed on PR #208 was over-correction that can be
  reverted if desired but is harmless as neutral prose.
  **Effort:** S (policy text + audit tool + hygiene row).
  **Owner:** Aarav (BP-rule owner) drafts the audit +
  policy clarification; Rune readability; Kenji
  integrates. **Source of truth:** this entry + the Otto-
  52 directive verbatim in
  `memory/feedback_human_maintainer_is_hari_seldon_
  archetype_foundation_as_factory_aspirational_reference_
  2026_04_23.md` (same directive chain) + Copilot finding
  on PR #208 that surfaced the policy ambiguity.

  **Otto-279 reinforcement (2026-04-24, post-drain):**
  Aaron re-confirmed during #282 thread drain that
  `docs/research/**` is a HISTORY surface and first-name
  attribution applies to BOTH humans (Aaron, etc.) AND
  agents (Amara, Aminata, Otto, Kira, Dejan, etc.). Same
  shape as Otto-237 mention-vs-adoption applied to
  history-vs-current-state. Reverted name-stripping edits
  on #282 mid-tick when policy was re-clarified.
  **Post-drain scope additions:**
  (4) Audit recent research docs where subagents stripped
  names per the literal rule: PR #351 (anthropic-prompt-
  engineering-best-practices), PR #282 (provenance-aware
  claim-veracity-detector — already preserved this round),
  and any other research-doc PRs that landed during the
  rule's literal-interpretation window. Restore stripped
  names where they were record-of-fact (who-said-what)
  rather than current-state references.
  (5) Update the "history surfaces" exemption list to
  explicitly include: `docs/research/**`,
  `docs/ROUND-HISTORY.md`, `docs/DECISIONS/**`,
  `docs/aurora/**`, `docs/pr-preservation/**`,
  `docs/hygiene-history/**`, `memory/**` — and confirm
  agent-persona names are AS allowed as human names there.
  Memory: [`memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md`](../memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md).

## P1 — Git-native hygiene cadences (Otto-54 directive cluster)

The human maintainer on 2026-04-23 Otto-54 framed three
linked hygiene asks, anchored on the positioning statement
*"we are git-native with github as our first host"*. The
three rows below share the theme that **high-churn shared
files are friction points** and the factory's git-native
posture lets git log itself detect and guide the cleanup.
Keeping them adjacent preserves the directive cluster.

- [ ] **Split `docs/BACKLOG.md` into per-swim-lane files.**
  Human maintainer 2026-04-23 Otto-54: *"i think i said a
  while back but it might be benefitial to have multiple
  backlog files one per swim lane/stream, you can alway use
  git to find hotspots in files"*. Current state:
  `docs/BACKLOG.md` is a single ~6800-line file touched by
  nearly every PR, causing routine merge conflicts (observed
  on PR #207 / #208 / #210 this session). **Scope:**
  (1) proposal doc `docs/research/backlog-split-design-2026-
  MM-DD.md` naming the split axis (swim-lane / stream /
  priority / subsystem — candidate split on *stream*: core-
  algebra, formal-spec, samples-demos, craft, hygiene,
  research, infra, frontier-readiness); (2) migration plan
  with (a) a root `docs/BACKLOG.md` that becomes an index
  pointing at the split files, (b) per-stream files like
  `docs/BACKLOG/core.md`, `docs/BACKLOG/craft.md`, etc., and
  (c) a coordinated migration PR that existing open PRs
  know to rebase through; (3) a hygiene audit
  (`tools/hygiene/audit-backlog-per-swimlane.sh`) that
  rejects new rows added to the root. **Risk:** every open
  PR currently touching BACKLOG.md would need rebase; do
  the split in a quiet window when few PRs are in flight.
  **Effort:** M (proposal + migration PR + hygiene audit).
  **Owner:** Kenji (Architect) designs the split axis;
  Rune readability; Aarav covers the hygiene audit.
  **Source of truth:** this entry + next-tick per-user
  memory captures.

- [ ] **CURRENT-`<maintainer>`.md files on a cadence.**
  Same Otto-54 directive: *"are you keeping current
  memories updated on a cadence too? will help reduce merge
  issues"*. Current state: `memory/CURRENT-aaron.md` and
  `memory/CURRENT-amara.md` (migrated to in-repo via PR
  #197 per Option D) are updated ad-hoc when directives
  land, not on a scheduled cadence. **Scope:** (1) add a
  FACTORY-HYGIENE row defining the cadence (every N ticks
  or every M new memory entries — decide which trigger in
  the research doc); (2) author a tool
  (`tools/hygiene/audit-current-memory-freshness.sh`) that
  walks the MEMORY.md newest-first index, computes the
  delta since last CURRENT-*.md update, and flags when
  distillation is owed; (3) the CURRENT distillation itself
  stays a human + Otto judgment call — the audit only
  surfaces freshness gaps, not content. **Why it reduces
  merge issues:** CURRENT files are per-maintainer
  projections; keeping them fresh means fewer ad-hoc updates
  on shared surfaces (MEMORY.md index, BACKLOG, research
  docs) get pressured into serving as distillation
  placeholders. **Effort:** S (hygiene row + audit tool +
  first-run calibration). **Owner:** Daya (AX) for the
  per-maintainer experience; Kenji integration. **Source
  of truth:** this entry + `memory/feedback_current_
  memory_per_maintainer_distillation_pattern_prefer_progress_
  2026_04_23.md`.

- [ ] **Git-hotspots audit on a cadence.**
  Otto-54 addendum: *"cadence for checking github hotspots
  too this is a hygene issues points of friction and
  bottlenecks, we are frictionless... git hotspots i mean...
  we are gitnative with github as our first host"*.
  **Scope:** (1) `tools/hygiene/audit-git-hotspots.sh` that
  runs a `git log --pretty=format:"%H" --name-only --since=
  "<window>"` pass, counts touches per file, ranks top-N,
  and emits a report to `docs/hygiene-history/git-hotspots-
  YYYY-MM-DD.md` (shape: file | touches | unique authors |
  PR count | suggested action — split / freeze / audit);
  (2) add a FACTORY-HYGIENE row pairing it with the
  BACKLOG-split + CURRENT-cadence rows above as a **friction-
  detection cluster**; (3) first-run baseline audit in the
  research doc — expected hotspots include BACKLOG.md,
  loop-tick-history.md, MEMORY.md, possibly
  FACTORY-HYGIENE.md. **Philosophy:** *"we are
  frictionless"* names the goal; hotspots are the
  measurement; splitting is one remediation tool among
  several (freeze / archive / split / ADR). **Effort:** S
  (audit tool + first report + hygiene row). **Owner:**
  Dejan (DevOps — close to git surface) drives the audit;
  Aarav reviews the split/freeze recommendations; Kenji
  integrates actions.

- [ ] **Git-native PR-review archive + reviewer-tuning
  substrate.** Human maintainer 2026-04-23 Otto-57: *"do we
  keep some gitnative log of the PR reviews? that way a
  future model can be trained on all that too and we have
  it for history without the host? backlog?"* + follow-up
  *"you and the copilot are producing very high signal data
  there and it will also let you have the data you need
  to tune copilot over time"*. Current state: PR reviews
  (Copilot findings, Codex findings, human-maintainer chat
  approvals, Otto fix-commit rationale, policy-pushback
  threads) live only on GitHub. If GitHub went away or the
  factory migrated hosts, the review substrate — which
  this session has confirmed is the factory's primary
  substantive-review layer per `memory/feedback_codex_as_
  substantive_reviewer_teamwork_pattern_...` — would
  disappear. The review cycles also contain HIGH-signal
  training data: finding → fix → response → resolution
  forms a labelled supervised-learning pair useful for
  tuning reviewer agents. **Scope:** (1) research doc
  `docs/research/pr-review-archive-design-2026-MM-DD.md`
  evaluating archive shape candidates — (a) periodic
  `gh api` → markdown dump under
  `docs/history/pr-reviews/PR-<NNN>/` with per-thread
  files; (b) git-notes attached to merge commits
  (`git notes add --ref=pr-review <SHA>`); (c) hybrid
  with markdown as durable + git-notes as index; (2)
  prototype tool `tools/archive/archive-pr-reviews.sh`
  that takes an owner/repo + optional PR list + emits the
  archive; (3) first-run baseline: archive all currently-
  merged Zeta PRs (~214+ series) into `docs/history/pr-
  reviews/` to capture the substrate before it ages off
  GitHub; (4) **reviewer-tuning composition** — the
  archive should preserve enough structure (finding-text,
  author, timestamp, fix-commit-SHA, resolution-body,
  policy-pushback-reason) to serve as a training corpus
  for future Copilot / Codex tuning experiments; the
  schema design should prioritize this dual-use even
  though training is out-of-scope for this row.
  **Composes with:** (a) `memory/project_factory_is_git_
  native_github_first_host_hygiene_cadences_for_
  frictionless_operation_2026_04_23.md` — the positioning
  this row implements; (b) `memory/feedback_codex_as_
  substantive_reviewer_teamwork_pattern_address_findings_
  honestly_aaron_endorsed_2026_04_23.md` — reviewer
  teamwork pattern the archive preserves; (c) Otto-52
  multi-agent peer-review BACKLOG row (CLI-first per Otto-55; Docker adds reproducibility across environments per Otto-57 clarification — not required for the initial prototype) in the
  Foundation aspirational-reference section (archive is
  the corpus the peer-review experiment would be trained (CLI-based prototype, Docker-later per Otto-55)
  on). **Not in scope:** actual Copilot/Codex tuning
  experiments; that requires training pipeline +
  labelled-dataset work several layers downstream. This
  row's deliverable is the substrate, not the tuning run.
  **Effort:** M (research doc + prototype tool + first-
  run baseline; tuning-pipeline is a separate L/XL arc).
  **Owner:** Dejan (git-surface + tooling) drives the
  archive tool; Mateo (security-researcher) reviews the
  schema for adversarial-training-corpus risks; Kenji
  synthesizes the dual-use deliverable.

- [ ] **Git-native PR-conversation preservation — extract PR review threads + comments to git-tracked files on merge, PLUS backfill of all historical PRs.** **Priority: P1 (elevated from P2 per Aaron Otto-151..153; relocated from `## P2 — research-grade` to this `## P1 — Git-native hygiene cadences` section per #335 review thread on internal-priority-vs-section consistency).** Aaron Otto-113 originating directive: *"you probably need to resolve and save the conversations on the PRs to git for gitnative presevration"*. Aaron Otto-150..153 follow-up burst ratifying priority + scope: *"you are still capturing all the PR reviews from copilot and your responses to gitnative right? / that's high signaldata we should get on that pretty quickly i think / can you post fill by going through all the old PRs and all the threads/conversations? / back fill i mean"* — then course-correction *"no not that quick / do it the right way / i just mean pritorize the right way"* confirming the ask is **appropriate prioritization, not rushed shipping**. Current status: NOT running; no workflow archives review threads; no `docs/pr-discussions/` directory exists. Currently PR review threads (Copilot / Codex connector / human reviewer comments) live GitHub-side only; if repo is mirrored / forked / GitHub has an outage / repo is migrated, the conversation substrate is lost. For glass-halo transparency + retractability, PR discussions belong in-repo. This is high-signal data (Copilot's actual critiques of the factory's code; Otto's replies showing reasoning patterns; human-contributor thought process). Proposed phased landing:

  **Phase 1 — design (this tick or next, S effort).** Decide:
  (a) file-per-PR vs index-plus-per-thread; (b) markdown
  schema (YAML frontmatter fields: `pr_number`, `pr_title`,
  `pr_author`, `merged_at`, `scope`, `privacy_pass`); (c) slug
  collision rules; (d) idempotent-update semantics when a
  resolved thread is reopened or a comment is edited
  post-merge; (e) who authors the archive commits (GHA bot vs
  human-contributor-attributed).

  **Phase 2 — privacy review (Aminata threat-model pass,
  blocking).** Questions: what classes of content in a
  reviewer comment could be sensitive (credentials
  accidentally pasted, customer data, internal-only URLs,
  names of external organizations)? Is the privacy pass a
  manual-review-then-merge step or an automated
  redaction-on-ingest step? What does a review-comment
  redaction look like (strike-through with reason, or hash
  and reference)? Does Aminata recommend a different trust
  posture for agents (Copilot / Codex-connector / github-
  actions / Claude Code personas) vs humans (contributors
  with arbitrary comment content)?

  **Phase 3 — ongoing-capture mechanism (S-M effort after
  Phase 2 signs off).** GHA workflow with:

  ```yaml
  on:
    pull_request_target:
      types: [closed]
  ```

  Job gates on `if: github.event.pull_request.merged == true`.
  Fetches threads via `gh api graphql`, writes to
  `docs/pr-discussions/PR-<N>-<slug>.md` on a dedicated
  branch, opens an auto-archive PR.

  **Security constraints for `pull_request_target`**
  (known GitHub Actions footgun — elevated permissions +
  access to secrets on base-branch code, but the trigger
  FIRES for PRs from forks; the well-known exploit is
  checking out PR-head and executing its code with the
  elevated permissions). The reviewer-suggested safer
  alternatives — `push` on `main` after merge, or a
  `workflow_run` chain from a CI workflow that ran on the
  merge commit — remain on the table for Phase 1 design;
  the constraints below apply if `pull_request_target` is
  the chosen mechanism:

  - MUST NOT `actions/checkout` the PR head (`refs/pull/<N>/
    merge` or `head.ref`). Check out the base ref only;
    the archive content is fetched via `gh api graphql`
    against the already-merged PR state, not by running
    PR code.
  - MUST NOT use `${{ github.event.pull_request.title }}` /
    `.body` / `.head.ref` / `.head.label` / etc. in any
    `run:` step. Fetch title via `gh api /repos/.../pulls/
    <N>` INSIDE the workflow (Otto-154 learned this via
    injection-hook false-positive). Or write the archive
    with only `number`-keyed fields and derive the slug
    from the fetched JSON, not from event payload.
  - MUST declare minimal `permissions:` (just `contents:
    write` for the archive branch + `pull-requests: write`
    to open the auto-archive PR). No `actions:`, no
    `id-token:`, no `deployments:`.
  - SHOULD pin all `actions/*` to commit SHA per FACTORY-
    HYGIENE row #43.

  **Docs/memory lint policy reference** (cited in the
  Non-goals section below): the "docs-lint / memory-
  no-lint" split is the convention documented in
  [`memory/feedback_docs_linted_memory_not_otto_decides_where_external_content_lives_2026_04_24.md`](../memory/feedback_docs_linted_memory_not_otto_decides_where_external_content_lives_2026_04_24.md)
  and enforced by `.markdownlint-cli2.jsonc` (which
  excludes `memory/**` via ignore patterns). This PR's
  discussion-archive output lives in `docs/pr-discussions/`
  which IS subject to markdownlint; memory/ continues to
  be ignored.

  **Phase 4 — backfill (M effort after Phase 3 is proven on
  live PRs).** Per-PR script that walks all merged PRs in
  priority order (richest-review-content first — PRs with
  Copilot comments, PRs with Codex-connector comments,
  bulk-change PRs, then routine PRs), applies the Phase-2
  privacy pass, commits archives in batches (e.g. 20 PRs
  per commit) to keep diffs reviewable. Budget: expect
  ~300+ merged PRs historically.

  **Phase 5 — ongoing-reconciliation hygiene (S effort, after
  Phase 4).** Periodic audit (weekly GHA cron) that checks
  all merged PRs have an archive file; flags divergences;
  surfaces edit-after-merge comment updates. Captures the
  drift that would otherwise silently accrue.

  **Scope addendum (Aaron Otto-155..156).** Otto-155: *"we
  can capture the comments from both acehack and lfg the bots,
  forks should be expected to ship bot comments too like
  acehack back to the main repo, that's high value signals."*
  Otto-156 self-correction: *"sorry i said bot comments i
  should have said agent comments"* — per GOVERNANCE §3 and
  CLAUDE.md "Agents, not bots." Terminology correction:
  Copilot, Codex connector, Claude Code personas, and
  github-actions all count as **agents** with agency,
  judgement, and accountability — not bots. Two binding
  scope decisions follow:

  (i) **Dual-agent-surface capture.** Agent comments across
  both account contexts get archived — those posted under
  the personal account (`AceHack/...` forks) AND under the
  org account (`Lucent-Financial-Group/Zeta` main). Same
  schema, same workflow, different event sources.

  (ii) **Fork-upstream-sync obligation.** When a fork of the
  repo runs its own Copilot / Codex / agent reviews on its
  own PRs (e.g. `AceHack/Zeta#42` with a personal-account
  Copilot review), those agent-comment archives ride back
  to the main repo when the branch lands upstream — via a
  sync job that copies fork-side `docs/pr-discussions/`
  entries into the main repo at merge time. Human comments
  on fork-side PRs stay under the human-privacy-pass
  discipline; agent comments get sync-with-scope. Treat
  fork-originated agent signals as high-value upstream
  input.

  Non-goals for this row:

  - Replacing GitHub as the live review venue (it's the
    source-of-truth; archive is the durable mirror).
  - Attempting historical backfill in a single CI run
    (300+ PRs × GraphQL rate limits would likely fail —
    batch it; see Phase 4 for batch strategy).
  - Assuming agent-authored content is privacy-trivial.
    Earlier phrasing said agent reviews had "no privacy
    concern"; that was wrong and contradicted Phase 2's
    explicit privacy-review scope. Copilot / Codex /
    Claude Code personas can echo secrets (pasted by
    humans into a PR description or reviewer reply),
    internal-only URLs, customer identifiers, or other
    sensitive substrate the human reviewer dropped into
    the conversation unaware. Phase 2's privacy pass
    evaluates ALL archived content — agent-authored
    included — for redaction need. The trust-posture
    default for agent content IS higher (no hand-typed
    free-form prose = lower leak rate) but not
    zero-risk. Aminata threat-review sets the posture
    per content source; this row does not pre-commit to
    "agent content archives verbatim without review."

  Effort: S (Phase 1 design) + M (Phase 2 threat-review +
  Phase 3 workflow) + M (Phase 4 backfill) + S (Phase 5
  hygiene). Cumulative: L. Lands across multiple ticks;
  Phase 1 can go this tick or next; later phases land when
  ready. Composes with Otto-113 bootstrap-attempt-1 memory +
  Otto-150..154 burst + the docs-lint/memory-no-lint policy
  cited in the "Docs/memory lint policy reference" block
  above (discussions go in `docs/`, which is markdownlint-
  enforced; `memory/` is excluded) + ChatGPT-download-skill
  (PR #300) pattern + Aminata threat-model authority.

## P2 — BP-25 promotion candidate — live-state-before-policy

- [ ] **Promote "live-state-before-policy" to BP-25 via ADR.**
  Amara's 4th ferry (PR #221 absorb) named the rule; Otto-72
  landed schema-enforcement of it via the `live_state_checks:`
  field in `docs/decision-proxy-evidence/` records (documented
  in the `README.md` "Live-state-before-policy" section
  after PR <this>). BP-NN promotion is Aarav's call per the
  BP-NN-promotion-cadence FACTORY-HYGIENE row; this row
  queues the promotion consideration. Rule text candidate:
  *"Never recommend a repository settings change, required-
  check change, merge policy change, or branch-rule change
  unless the current live state has been queried in the same
  work unit."* **Scope:** draft ADR under
  `docs/DECISIONS/YYYY-MM-DD-bp-25-live-state-before-policy.md`
  citing the Amara ferry + the schema-enforcement in
  `docs/decision-proxy-evidence/README.md` + the HB-004
  failure-mode evidence Amara sampled. If adopted, promote
  to BP-25 in `docs/AGENT-BEST-PRACTICES.md` (current max
  is BP-24). **Effort:** S (ADR drafting + policy
  inclusion). **Owner:** Aarav drives the promotion call;
  Kenji integrates; Rune readability. **Source of truth:**
  `docs/aurora/2026-04-23-amara-memory-drift-alignment-
  claude-to-memories-drift.md` (PR #221 absorb) +
  `docs/decision-proxy-evidence/README.md` (PR #222 + this
  PR's addendum).

## P1 — Principle-adherence review cadence (Otto-58 new hygiene class)

- [ ] **Principle-adherence review — cadenced agent judgment on
  whether the factory is actually applying its own principles
  consistently across code / skills / docs / memory.** Human
  maintainer 2026-04-23 Otto-58: *"hygene i think but could be
  more complex cause i think it's not verifable its like an
  agents review hygene on a cadence for a specific type of
  thing, this one is look for generalization opportunities in
  the code, for example the docker for reproducability for
  multi agent review can be generalize to everyting in the
  project, all applieas to code skills docs everyting, but
  seems different that hygene like review candences for
  different pracitaces we want to promote to make sure we are
  sticking to our principles"* + *"backlog"*. **Why this is a
  distinct hygiene class:** existing FACTORY-HYGIENE rows are
  mostly *mechanically verifiable* (lint / audit script /
  threshold check); this class is *judgment-based*. A principle
  like *"Docker-for-reproducibility is a first-host-neutral
  portability primitive"* (Otto-55/Otto-57) might apply to
  multi-agent peer-review, but it ALSO applies to Craft module
  delivery (reproducible module-build envs), to sample projects
  (reproducible demo envs), to research benchmarks (reproducible
  measurement envs), to CI (already uses containers), to local
  dev setup. A cadenced review sweeps the project for *where
  else a principle applies that we haven't applied it yet*, and
  surfaces candidates. **Scope:** (1) `docs/research/principle-
  adherence-review-design-YYYY-MM-DD.md` naming the review
  shape — which principles, who reviews, cadence, output form;
  (2) first-pass principle catalogue drawing from existing
  memory (git-native-first-host, in-repo-first, samples-vs-
  production, applied-default-theoretical-opt-in, honest-about-
  error, Codex-as-substantive-reviewer, detect-first-action-
  second, honor-those-that-came-before, Docker-for-
  reproducibility, CLI-first-prototyping, etc.); (3) review
  protocol: for each principle, one agent with the relevant
  hat sweeps the project looking for generalization
  opportunities (where the principle applies but isn't applied);
  output is a ROUND-HISTORY row + BACKLOG rows for each concrete
  opportunity; (4) candidate cadence: every 10-20 rounds per
  principle (lower frequency than mechanical audits because
  judgment-based and lower-urgency); (5) FACTORY-HYGIENE row
  with principle-per-subtier (not a single blanket row —
  each principle is its own sub-cadence with its own owner).
  **Worked example (the one the human maintainer named):**
  principle = *"Docker for reproducibility"* (currently
  scoped to multi-agent peer-review per Otto-55/57). Review
  asks: where else would reproducible-environment shipping
  reduce friction? Candidates: `.devcontainer/` for
  contributor onboarding; per-sample Dockerfile for demo
  reproducibility; benchmark-harness container for
  `CheckedVsUnchecked` etc. bench reproducibility across
  hosts; Craft module build env for "run this lesson on any
  machine". Each candidate becomes a BACKLOG row with an
  owner + effort; the principle-review output is *the list
  of candidates*, not the implementation. **Classification
  (row #50 prevention meta-audit):** **detection-only-
  justified** — generalization opportunities are inherently
  post-hoc (you can't author-time prevent a principle from
  applying somewhere; the application is retrospective).
  **Composes with:** FACTORY-HYGIENE row #23 (missing-
  hygiene-class gap-finder) — sibling pattern, but row #23
  surfaces NEW hygiene classes while this row surfaces
  generalizations of EXISTING principles; FACTORY-HYGIENE
  row #22 (symmetry-opportunities) — mirror shape, but
  symmetry is about pair-completion while principle-
  adherence is about scope-extension; FACTORY-HYGIENE row
  #41 (orthogonal-axes audit) — pairs as meta-audit triad;
  `docs/FACTORY-METHODOLOGIES.md` pull-vs-always-on
  criterion — principle-adherence review is pull (invoked
  on cadence), not always-on. **Not in scope:** automated
  principle extraction from memory (manual first-pass
  catalogue; automation is a sibling row later if the
  discipline works); multi-agent Docker-peer-review
  corollary (that's Otto-52's row, this one names the
  principle-adherence *pattern* not the Docker-specific
  instance). **Effort:** M (research doc + first-pass
  catalogue + review protocol + first run on Docker-for-
  reproducibility as worked example + FACTORY-HYGIENE row
  structure). **Owner:** Kenji (Architect) drives the
  principle catalogue + review-protocol design; Aarav
  (skill-tune-up hat) runs the first review pass on
  Docker-reproducibility; Rune (readability) reviews the
  catalogue for principle-granularity; Daya (AX) reviews
  the cadence-load-on-agents.

## P2 — Production-code performance discipline

- [ ] **Checked vs unchecked arithmetic audit across Zeta
  hot paths.** Aaron 2026-04-23 Otto-47: *"make sure we are
  using uncheck and check arithmatic approperatily, unchecked
  is much faster when its safe to use it, … make sure our
  production code does this"*. Current state: `Checked.(+)`
  and `Checked.(*)` appear ~30 times across
  `src/Core/{ZSet, Operators, Aggregate, TimeSeries, Crdt,
  CountMin, NovelMath, IndexedZSet}.fs`. Canonical rationale
  lives at `src/Core/ZSet.fs:227-230` (stream-weight-sum
  cumulative overflow would sign-flip the multiset). Rationale
  is correct for **unbounded stream sums** but applies unevenly
  — counter increments, SIMD-lane partial sums, bounded-domain
  products should demote to unchecked. F# defaults to
  unchecked; `Checked.` is a deliberate opt-in paying
  2-5ns/op and disabling `Vector<int64>` SIMD-vectorisation.
  **Scope:** per-site bound analysis + BenchmarkDotNet
  throughput measurement + property-test bound assertions.
  **Classification matrix:** bounded-by-construction →
  unchecked; bounded-by-workload → unchecked + citing comment;
  bounded-by-pre-check → unchecked with boundary guard;
  unbounded stream sums → keep Checked; user-controlled
  products → keep Checked; SIMD-candidate → unchecked with
  pre-check. **Deliverable chain:**
  `docs/research/checked-unchecked-audit-2026-MM-DD.md`
  (inventory + per-site classification) → FsCheck property
  tests asserting each proved bound → PR series (one
  subsystem per PR) with BenchmarkDotNet deltas showing ≥5%
  improvement required per demoted site. **Owner:** Naledi
  (perf) runs benchmarks; Soraya (formal-verification)
  validates bound proofs; Kenji integrates; Kira (harsh-
  critic) reviews — unjustified demotion is a P0. **Effort:**
  L (per-site analysis + benchmarks + property tests for ~30
  sites; PR series spans multiple rounds). **Source of
  truth:** this entry + **out-of-repo** (per-user memory,
  not yet in-repo) factory-generic memory
  `feedback_checked_unchecked_arithmetic_production_tier_craft_and_zeta_audit_2026_04_23.md`
  (candidate for Overlay-A migration once reviewer capacity
  permits) + `src/Core/ZSet.fs:227-230` rationale comment +
  `bench/Benchmarks/CheckedVsUncheckedBench.fs` (shipped on
  main via PR #209, commit `3e1b97f` — measurement harness
  covering the three site archetypes).

- [ ] **Craft production-tier ladder — first module:
  checked-vs-unchecked arithmetic in F#/.NET.** Same Aaron
  directive: *"this is production code training level not
  onboarding materials"*. Craft onboarding tier currently
  ships `docs/craft/subjects/zeta/retraction-intuition/` on
  main (PR #201); additional onboarding modules — zset-basics
  (#200), operator-composition (#203), semiring-basics (#206)
  — are in-flight PRs awaiting reviewer approval. Production-
  tier is a distinct ladder for readers already fluent in
  the onboarding basics: performance-correctness tradeoffs,
  JIT behaviour, allocation discipline, bound-proving,
  benchmark-driven tuning. **First module topic:** checked
  vs unchecked arithmetic. **Scope:** `docs/craft/subjects/
  production-dotnet/checked-vs-unchecked/module.md`
  (**proposed in PR #208 — open; path does not yet exist on
  main**). **Lesson shape:**
  (1) runnable BenchmarkDotNet harness showing 2-4× delta on
  a 100M-int64 sum loop (shipped: PR #209 merged as
  `bench/Benchmarks/CheckedVsUncheckedBench.fs`); (2)
  decision tree (when to opt into Checked); (3) bound-
  proving techniques (FsCheck property tests, upstream
  invariant arguments, algebraic bounds); (4) silent-
  overflow detection in production (sign-flip invariant
  checks); (5) the Zeta-specific choice — stream-weight-sums
  stay Checked; counter increments and SIMD-lane sums
  demote; composes with audit row above as cross-link.
  **Prereqs:** onboarding-tier Craft foundations + Benchmark
  DotNet literacy. **New structural concept:** production-
  tier Craft — adds a directory tier (`docs/craft/subjects/
  production-{lang}/{topic}/`) and per-tier README
  (`docs/craft/subjects/production-dotnet/README.md`
  **proposed in PR #208 — open; the directory itself is not
  yet on main**). The per-tier README names the ladder,
  four neighbour-module stubs, and the tier-split rationale.
  A top-level
  `docs/craft/README.md` does not yet exist; authoring it is
  a follow-up hygiene task listed below. **Owner:** Naledi
  (perf authorial voice); Kenji integration; Rune
  readability review; Aarav skill-tune-up when structure
  lands. **Effort:** M (first module + tier restructure +
  top-level README). **Source of truth:** same per-user
  memory as audit row; sibling work.

- [ ] **Top-level `docs/craft/README.md` authoring.**
  Follow-up hygiene from the production-tier ladder row
  above. Current state: `docs/craft/` contains only
  `subjects/` with the per-tier `subjects/production-dotnet/
  README.md` landed in PR #208. A top-level README should
  introduce the tier split (onboarding vs. production), list
  the subject roots (`zeta/`, `production-dotnet/`, future
  CS / math / linguistic-seed subjects), and point at the
  five Craft pedagogy principles. **Effort:** S (single
  file, ~60-100 lines). **Owner:** Rune (readability review
  of the tier-split explanation) + Kenji (integration).
  **Source of truth:** this entry +
  `docs/craft/subjects/production-dotnet/README.md` as the
  per-tier template.

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

## P2 — FactoryDemo C# sample — deterministic smoke-test startup

- [ ] **Smoke-test port allocation — replace random-in-range
  with OS-assigned ephemeral port.** Codex P2 on PR #147:
  `samples/FactoryDemo.Api.CSharp/smoke-test.sh` currently
  picks a port from `5100-5499` via `RANDOM`, assumes it is
  free, and fails with an address-in-use error if the port
  is already occupied (parallel CI jobs, local services,
  another smoke run). This creates flaky false negatives
  unrelated to API correctness. **Scope:** two viable
  approaches — (a) bind `--urls "http://127.0.0.1:0"` and
  parse the chosen port from the Kestrel startup line in
  the log file, or (b) pre-probe ports in the range with
  `nc -z` / `/dev/tcp` and retry until one is free.
  Approach (a) is preferred (truly deterministic; no race
  window between probe and bind). Sibling
  `samples/FactoryDemo.Api.FSharp/smoke-test.sh` has the
  same issue and should be fixed in parallel. **Effort:**
  S (shell-only, maybe 20 lines across both scripts plus a
  log-line parser). **Owner:** devops-engineer. **Source:**
  Codex thread `PRRT_kwDOSF9kNM59gdjf` on PR #147.

## P2 — FactoryDemo C# sample — solution project-type GUID hygiene

- [ ] **Align `FactoryDemo.Api.CSharp` project-type GUID
  with other SDK-style C# projects.** Copilot finding on
  PR #147: `Zeta.sln` lists `FactoryDemo.Api.CSharp` under
  the legacy C# project-type GUID
  `{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}` while every
  other SDK-style C# project (`Core.CSharp`,
  `Tests.CSharp`, `Core.CSharp.Tests`) uses the modern
  SDK-style GUID `{9A19103F-16F7-4668-BE54-9A1E7A4F7556}`.
  Mixing GUIDs can confuse solution-filter tooling and
  Visual-Studio solution-node grouping; the `.csproj`
  itself is already `<Project Sdk="Microsoft.NET.Sdk.Web">`
  so the legacy GUID is purely cosmetic drift from the
  initial `dotnet new` template. **Scope:** change the
  single GUID in `Zeta.sln` line 32; verify `dotnet
  build -c Release` stays at 0W/0E. **Effort:** XS
  (single-line GUID swap). **Owner:** devops-engineer or
  msbuild-expert. **Source:** Copilot thread
  `PRRT_kwDOSF9kNM59geKB` on PR #147.

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
