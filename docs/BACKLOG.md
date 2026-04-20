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

- [ ] **Memory folder restructure: `memory/role/persona/`** — Aaron
  2026-04-19: *"can we add a memory 2nd level folder so it's
  memory/role/persona that makes roles fist class defined of what
  we need too in the memory definition"*. Today persona notebooks
  live flat under `memory/persona/<name>/NOTEBOOK.md`. Aaron wants
  roles elevated to a first-class directory level: e.g.
  `memory/security/aminata/NOTEBOOK.md`,
  `memory/verification/soraya/NOTEBOOK.md`,
  `memory/architect/kenji/NOTEBOOK.md`. Makes the role taxonomy
  self-documenting from `ls memory/`. Scope: (a) define the role
  axis (crosswalk `docs/EXPERT-REGISTRY.md` → role directories);
  (b) move existing notebooks under their role folder; (c) update
  all pointers (skill `reference patterns:` blocks, CLAUDE.md,
  AGENTS.md §18, BP-07/BP-08 rule text if it cites paths, any
  `memory/persona/<name>` path in agents / skills). Mechanical
  rename + pointer rewrite; the memory-folder audit should verify
  completeness before merge. Owner: Kenji (Architect) integrates;
  Aarav (skill-tune-up) audits post-rename for BP-drift on skills
  that cited the old path. Effort: M (mechanical but wide surface —
  every skill that names a notebook needs a pointer update).
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
    - `playwright` — browser automation; no in-repo use.
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
    - `huggingface-skills`, `playwright`, `postman`,
      `frontend-design` — off-project for Zeta.Core but
      harmless to keep installed; flag for retirement if
      they start adding hook noise.
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

- [ ] **Untested serializer tiers — `SpanSerializer` +
  `MessagePackSerializer`.** `src/Core/Serializer.fs` defines
  three tiered serializers with strong docstring claims
  ("zero-copy by definition" on `SpanSerializer`,
  "30-60 ns/entry, source-gen AOT-clean" on MessagePack tier)
  but only `ArrowSerializer` currently has a dedicated test
  file (`tests/Tests.FSharp/Storage/ArrowSerializer.Tests.fs`
  — landed round 34 DB Arc). Both unlanded tiers are claims-
  tester candidates:
  - `SpanSerializer` — verify zero-copy with an allocation
    assertion (BenchmarkDotNet MemoryDiagnoser on a tight
    loop; any boxing or LOH allocation fails the zero-copy
    claim). Wire format is `[4B count][count × sizeof
    (ZEntry<'K>) bytes]`; round-trip test on blittable `int`
    / `int64` / `float` Z-sets; endian behaviour must be
    single-host-only as documented.
  - `MessagePackSerializer` — verify the 30-60 ns/entry
    claim with BenchmarkDotNet; round-trip test on
    non-blittable shapes (records, strings, nested); verify
    negative-weight retraction-native invariant holds on
    the wire.

  Route to claims-tester; effort S per serializer (~2h
  including a BenchmarkDotNet harness). Worth doing
  before the query surface round lands because the tiered
  dispatch (`src/Core/Serializer.fs:28-29`: "auto-detection
  at Circuit.Build()") is a documented extension point
  that will rely on these claims being honest.

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

## ⏭️ Declined

- SQLite-derived on-disk format (per AGENTS.md greenfield policy)
- "All MAJOR bumps are risky, defer" heuristic (Meziantou 2→3 proved
  this wrong)
- autoresearch by Karpathy as a platform (200-LOC teaching scaffold,
  not a research pipeline)
- Preserving v0 backward compatibility (no users yet)

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
