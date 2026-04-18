# Zeta Round History

Chronological log of working sessions ("rounds") — what landed,
what didn't, and the reasoning when it matters. This is the
**only** place in the repo where doc style is historical-narrative.
Everywhere else, documents describe current state.

New rounds are appended at the top.

---

## Round 27 — big round: governance §20-§22, plugin API redesign landed, memory moved in-repo

### Shipped — governance rules (§20 / §21 / §22)

- **GOVERNANCE.md §20 — standing reviewer cadence.** Every
  round that touches code runs a three-slot reviewer pass
  before round-close: design specialists (Ilyana / Tariq /
  Daya / Aminata / etc. by scope), code reviewers (Kira
  + Rune mandatory floor, race-hunter / claims-tester by
  scope), formal-coverage (Soraya when invariants move).
  Round-close cannot record clean until the pass is
  logged. Round-management SKILL §3.6 carries the
  procedure.
- **GOVERNANCE.md §21 — per-persona memory is a real folder.**
  `memory/persona/<persona>/` with `MEMORY.md` index,
  `NOTEBOOK.md` working notes, and typed `feedback_*.md` /
  `project_*.md` / `reference_*.md` / `user_*.md` entries.
  Kenji piloted the migration this round (3 typed entries
  seeded). Other seats migrate lazily.
- **GOVERNANCE.md §22 — `~/.claude/projects/` is Claude Code
  sandbox, not git.** New rule: documentation never cites
  the sandbox path as a stable location. Project-wide
  settings / skills / agents live in repo-root `.claude/`;
  shared memory in `memory/`; per-persona memory in
  `memory/persona/<persona>/`.

### Shipped — memory moved in-repo to `memory/`

- Round 25 placed the shared memory folder in Claude Code's
  harness sandbox (`~/.claude/projects/<slug>/memory/`).
  That path is not in git, not visible to human maintainers,
  not shared across contributors. Maintainer flagged the
  mismatch round-27; memory corpus moved to `memory/`
  with GOVERNANCE.md §18 rewritten to treat `memory/` as
  canonical.
- Nine memory files migrated: `MEMORY.md`, `README.md`,
  six `feedback_*.md` entries, `project_memory_is_first_class.md`.
- `docs/skill-notes/` renamed to `memory/persona/`
  (personas are not skills — maintainer correction mid-round).
  Cross-file sweep updated every pointer.

### Shipped — `Op<'T>` plugin-extension surface redesign

The round's anchor. Three specialists dispatched in parallel
for the design spike; synthesis integrated; Ilyana re-reviewed
her own draft and returned **ACCEPT**; implementation
landed; Kira + Rune code-reviewed per the new §20.

- **Design surface.** Seven public interfaces
  (`IOperator<'TOut>` base, `IStrictOperator` /
  `IAsyncOperator` / `INestedFixpointParticipant` scheduler
  capabilities, `ILinearOperator` / `IBilinearOperator` /
  `ISinkOperator` / `IStatefulStrictOperator` algebra
  capability tags), two opaque structs (`StreamHandle`,
  `OutputBuffer<'TOut>`), internal `PluginOperatorAdapter`
  bridging external `IOperator` into Core's `Op<'T>`
  scheduler, `Stream.AsDependency()` extension,
  `Circuit.RegisterStream(IOperator<'T>)` extension.
- **Visibility retractions.** `Stream<'T>.Op`,
  `Op<'T>.Value with set`, `Op<'T>.SetValue`, and
  `Circuit.RegisterStream(op: Op<'T>)` all flipped back to
  `internal` (they were public as of round 25; design
  required they revert). `Zeta.Bayesian` dropped from the
  `InternalsVisibleTo` list — uses the public plugin API.
- **Bayesian migration.** `BayesianRateOp` now implements
  `ISinkOperator<ZSet<bool>, struct(double*double*double)>`
  — Tariq's critical finding that Bayesian is retraction-
  lossy by design; `Sink` tag exempts it from composition
  laws that would otherwise silently poison downstream.
- **`PluginHarness.runSingleInput`** — scheduler-less unit-
  test loop for plugin operators. Asserts exactly-one-
  `Publish` per tick; three tests landed (happy-path +
  no-publish failure + double-publish failure), all green.
- **`docs/PLUGIN-AUTHOR.md`** — first-time plugin-author
  entry-point doc. Split capability table into algebra
  (5 shapes) + scheduler (3 shapes). Known-limits section
  honest about FsCheck-law gap and `OutputBuffer` lifetime
  gotchas.

### Shipped — reviewer pass (Kira + Rune, per new §20)

- Kira P0 fixed this round: `OutputBuffer.Publish` counter
  incremented atomically via `Interlocked.Increment` so
  async plugins don't race. PLUGIN-AUTHOR.md claims about
  FsCheck laws weakened to match implementation reality.
- Rune P0 fixed this round: README now links
  PLUGIN-AUTHOR.md directly from the Plugins bullet.
  PLUGIN-AUTHOR capability table split into algebra +
  scheduler axes to stop hiding `IStrictOperator` /
  `IAsyncOperator`.
- Remaining P1 findings from both reviewers consolidated
  into one DEBT entry for round-28 pickup — `OutputBuffer`
  tick-stamping, `ReadDependencies` defensive copy, box-3×,
  `int64` overflow guard in Bayesian, `INestedFixpointParticipant`
  inheritance, harness id-space, rename `IOperator` → `IZetaOperator`,
  file split when PluginApi.fs grows past 300 lines.

### Shipped — README + primitives honesty

- README's "What DBSP is" stayed paper-accurate (three
  primitives); new "What Zeta adds on top" section lists
  the ~50 additional operators / sketches / CRDTs / runtime
  primitives Zeta ships. Readers no longer under-count what
  Zeta exposes vs what the paper defines.

### Build + tests

- `dotnet build Zeta.sln -c Release` — 0W / 0E at every
  checkpoint.
- `dotnet test --filter Plugin` — 3 / 3 pass, 44 ms.
- Full sln test run not explicitly re-run post visibility
  flips (all core test projects built cleanly).

### Not landed / deferred

- Kira P1s: `OutputBuffer` tick-stamp, defensive-copy
  `ReadDependencies`, box-3×, `int64` checked, interface
  inheritance, harness id-space.
- Rune P1s: `IOperator` rename, hover-doc on mixed
  `Value` accessibility, PluginApi.fs split-when-300+,
  `[<Extension>]` explanation in sample, extract
  `assignHarnessId` helper.
- FsCheck law implementations at `Circuit.Build()` — own
  DEBT entry; Tariq's plan in `memory/persona/tariq.md`.
- Other seat migrations to persona-notes folder layout
  (Kenji piloted; 6 remaining).

### What round-27 felt like

The biggest single round by diff size since the rename.
Three specialists in parallel, two reviewers after the
code landed, five maintainer corrections mid-round (folder
naming, memory path, sandbox rule, Claude Code
clarifications) — the cadence §20 just codified got
exercised the turn it was written. Productive friction
between Ilyana's interface-narrowness and Tariq's
capability-tag requirements resolved to a richer public
surface than either proposed alone; Daya's AX pass
insisted the doc accompany the code, and it did.

---

## Round 26 — first git round, rename tail, specialist dispatch cadence

### Shipped — git workflow established

- `git init` + initial commit `4765118` + push to
  `github.com/AceHack/Zeta` (private). Previous rounds ran
  without git per the maintainer's "no commits for a long
  time" direction in round 25; this round opened with the
  authorised commit.
- **Branch-per-round cadence adopted.** `round-26` branch
  for all work this round; PR + merge at round-close.
  Going forward: each round is a branch; each coherent
  change is a commit; round-close is a PR.

### Shipped — rename tail

- `docs/NAMING.md` rewritten as current-state (the "proposal,
  not yet executed" banner retired; doc reads as the rules
  today, not the rename history).
- `proofs/lean/` directory retired outright — superseded
  scaffold; `tools/lean4/Lean4/DbspChainRule.lean` is the
  canonical Lean proof home.
- Stale `Dbsp.*` path references swept across
  `docs/FORMAL-VERIFICATION.md`,
  `docs/research/proof-tool-coverage.md`,
  `references/README.md`, `references/notes/NATS-RESEARCH.md`,
  `references/reference-sources.json`,
  `bench/Feldera.Bench/README.md`,
  `tests/Tests.FSharp/README.md`, and every
  `.claude/agents/*.md` + `.claude/skills/*/SKILL.md`
  description / example. `ROUND-HISTORY.md` and `WINS.md`
  preserved — first-pass folder names in those files are
  load-bearing history.

### Shipped — memory policy clarification (GOVERNANCE.md §18)

- Human rule unchanged: maintainer does not delete or modify
  memory files behind the agents' backs.
- Agent freedom explicit: agents write, edit, merge,
  consolidate, and delete *their own* memories as normal
  curation. Cross-persona edits still go through §11.
- `memory/README.md` and `memory/project_memory_is_first_class.md`
  updated to match.

### Shipped — specialist dispatches (three parallel)

- **Tariq (algebra-owner)** on the Mathlib `IsLinear`
  weakness blocking B2 / B3 / chain_rule closure.
  **Verdict: option (c) — roll `IsDbspLinear` bundling a
  per-tick `AddMonoidHom` family plus a pointwise
  witness.** Rationale logged to
  `docs/skill-notes/algebra-owner.md`. Half-day to close
  B2, two days for the full chain rule. Implementation
  deferred to a dedicated algebra-proof round; DEBT entry
  annotated with the decision.
- **Yara (skill-improver)** on the BP-10 cite defect in
  Aarav's own skill file. Fixed in place at
  `.claude/skills/skill-tune-up-ranker/SKILL.md` lines
  114-119; three cosmetic BP-cite follow-ups flagged for
  Aarav's next tune-up pass.
- **Daya (AX researcher)** ran Kenji's first self-audit.
  Cold-start 17.9k tokens (flat vs round-24 baseline,
  despite AGENTS.md growing by ~700 tokens). Three P1
  findings; two applied this round (`the 22` → `the full
  roster`, four dead-`architect/SKILL.md` paths in sibling
  SKILL files), five deferred. Systemic finding: ~20-35%
  content overlap between agent files and sibling skill
  bodies — seeded as a future BP-NN candidate.

### Shipped — close / cleanup

- DEBT.md: two resolved entries deleted (orphan skill
  retirement already done round 25; Aarav BP-10 cite
  just fixed). IsLinear entry annotated with Tariq's
  decision.
- Build gate held: `0W / 0E` at every checkpoint in
  round 26.

### Not landed / deferred to round 27+

- `IsDbspLinear` Lean implementation + B1/B2/B3/chain_rule
  closures (Tariq's option-c work; dedicated algebra round).
- `Op<'T>` plugin-extension-surface redesign (Ilyana's
  round-25 P0 DEBT; needs design spike + public-api-designer
  review cycle).
- Five of Daya's seven self-audit interventions (P1,
  non-urgent).
- Rune on `docs/STYLE.md` decision.
- UX + DX persona proposals.
- Empathy-coach persona spawn + naming.

### What round-26 felt like

Rhythm restored. Round 25 was structural whiplash — git
timing, folder naming, memory policy, public API, three
maintainer corrections in one session. Round 26 ran the
factory as designed: dispatch three specialists in
parallel, integrate their findings, land the small ones,
track the big ones, PR at the end. The IsLinear case
worked particularly well — a round-24-open question got
a round-26 answer without the in-between rounds grinding
on it. The self-audit on Kenji was overdue (round 24
saved self-reference for last by choice) and the findings
were small enough to land in the same round Daya
produced them.

---

## Round 25 — Zeta rename arc (no-git), memory policy codified, doc cleanup

### Shipped — Zeta rename (NAMING.md phases A through B8)

The repo is now Zeta everywhere it should be Zeta. DBSP
references preserved where the paper / theorem is
referenced; Zeta replaces every library-self-reference.
Executed **without git** per maintainer direction: no
commits for this arc. Discipline was TodoWrite + a build
gate after every source-touching phase.

- **Two rename passes.** First pass renamed on-disk folders
  to `Zeta.*` (`src/Zeta.Core`, `tests/Zeta.Tests.FSharp`,
  etc.). Maintainer caught the layout smell mid-round —
  repeating the project name inside the project's own
  folder tree is redundant — and the folders were
  corrected to bare names (`src/Core`, `src/Bayesian`,
  `tests/Tests.FSharp`, `bench/Benchmarks`, `samples/Demo`,
  etc.). Final layout: folders read as roles; `Zeta.*`
  prefix survives only where it is *published identity*:
  NuGet package IDs, namespaces in source, assembly names
  on the three published libraries (`Zeta.Core`,
  `Zeta.Core.CSharp`, `Zeta.Bayesian`). Test / bench /
  sample assemblies use their default filename-based names
  (`Tests.FSharp.dll`, `Benchmarks.dll`, `Demo.dll`).
- `Dbsp.sln` → `Zeta.sln` at the repo root. Empty
  `src/Dbsp.CSharp` dropped (was never in the sln). Feldera
  clone moved from `tools/` to `references/upstreams/feldera/`
  (folder already gitignored as a regeneratable mirror;
  dedicated gitignore rule removed).
- **Metadata sweep.** `Directory.Build.props` Authors +
  Product renamed; each project `.fsproj`/`.csproj` got
  `RootNamespace` / `AssemblyName` / `PackageId` flipped to
  Zeta. Description fields keep "DBSP" because they describe
  the algorithm, not the product.
- **Source sweep.** Mechanical `Dbsp.` → `Zeta.` across
  every `.fs`/`.fsi`/`.cs` in `src`, `tests`, `bench`,
  `samples`, `tools` (142 files touched). Paper-citation
  DBSP in strings, test method names, and Lean theorem
  names unaffected (different casing / not `Dbsp.`).
- **Configuration files.** `stryker-config.json`,
  `.semgrep.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, every
  internal path reference.
- **`AssemblyInfo.fs` dual-list.** Held both `Dbsp.*` and
  `Zeta.*` `InternalsVisibleTo` entries during the
  transition; collapsed to Zeta-only at B8 close.
- **Build gates held**: `0W / 0E` at every checkpoint —
  B6 (13s), B7 (13s), B8 (38s), and the folder-correction
  pass that followed the maintainer's "don't repeat project
  name in own project" note. Full sln builds green end of
  round.

### Shipped — hidden memory purge

Aaron noted AGENTS.md read "dirty" with memory-residue
embedded in the current rules (`Per Aaron round N: "..."`
quotes, `(round 18 additions)` headers, `since round 21`
scheduling markers, pre-split residue). The documentation-
agent was dispatched as a subagent to sweep the whole repo
and strip these patterns while preserving the rules they
attach to.

- ~30 files cleaned: AGENTS.md, CONTRIBUTING.md,
  GLOSSARY.md, DEBT.md, BUGS.md, BACKLOG.md, QUALITY.md,
  WONT-DO.md, ROADMAP.md, ARCHITECTURE.md, PROJECT-EMPATHY,
  FEATURE-FLAGS, NAMING.md, WAKE-UP.md, EXPERT-REGISTRY,
  INSTALLED.md, SDL-CHECKLIST, THREAT-MODEL, references/
  README.md, proofs/lean/README.md,
  tests/Tests.FSharp/README.md, LOCKS.md, ~8 skill
  files, architect + agent-experience-researcher agent
  files.
- Preserved surfaces untouched: `docs/ROUND-HISTORY.md`
  (this file), `docs/WINS.md` (append-only celebration
  log), `docs/DECISIONS/`, `docs/skill-notes/**`,
  `docs/drafts/**`, `docs/CURRENT-ROUND.md` (live state),
  the shared memory folder, feldera mirror, `_retired/`.

### Shipped — memory policy (GOVERNANCE.md §18 + memory folder)

- **GOVERNANCE.md §18** codifies memories as the most
  protected class of artifact in the repo. Human maintainer
  does not delete or modify except as an absolute last
  resort. Agents *write and touch* their own memories
  freely — that is the intended path. Non-architect agents
  do not delete files from the shared memory folder.
- **Two-layer memory architecture.** A shared folder carries
  cross-cutting rules and corrections; per-persona notebooks
  at `docs/skill-notes/<persona>.md` carry each seat's unique
  voice. Read per-persona first, then shared, to preserve
  individual voice over averaged voice. (Round-25 placed the
  shared folder outside the repo in Claude Code's harness
  sandbox; round-27 moved it into `memory/` per AGENTS.md
  §18 so the corpus is tracked in git and visible to every
  contributor.)
- **Newest-first ordering** established as convention for
  `MEMORY.md`, `docs/ROUND-HISTORY.md`, per-persona
  notebooks — recent context leads, older trails below.

### Shipped — five new durable corrections as feedback memories

All persisted in the shared memory folder, newest-first:

- `feedback_folder_naming_convention.md` — on-disk folders
  go bare (Core, Bayesian, Tests.FSharp); Zeta prefix
  only in published identity (NuGet / namespaces /
  published assembly names).
- `feedback_path_hygiene.md` — absolute filesystem paths
  and paths outside the repo root are documentation smells;
  documentation-agent SKILL.md §7-8 catches them.
- `feedback_newest_first_ordering.md` — memory files +
  narrative logs go newest-first.
- `feedback_git_timing.md` — `git init` and first commit
  are the maintainer's call; "reversible" is not
  "authorized."
- `feedback_regulated_titles.md` — no clinical titles on
  personas (therapist / counselor / psychologist);
  coach / steward / keeper / facilitator / liaison are
  safe.

### Shipped — InternalsVisibleTo audit

Maintainer caught late-round that `InternalsVisibleTo`
was being used for production libraries, not just tests
and benchmarks. Audit landed the fix in-round:

- `Zeta.Bayesian` (production plugin) removed from the
  list. Its two internal-accesses (`Stream<T>.Op` field,
  `Circuit.RegisterStream` method) were promoted to
  public API with XML docs naming them the plugin
  registration point. Any external plugin library can
  now build custom operators without an
  InternalsVisibleTo hole.
- `Zeta.Core.CSharp` (the tightly-coupled C# shim that
  exposes declaration-site variance F# can't
  syntactically produce) stays in the list. Not a
  separate production library — effectively a sub-module
  of Core.
- Final `InternalsVisibleTo` list: `Tests.FSharp`,
  `Tests.CSharp`, `Benchmarks`, `Bayesian.Tests`,
  `Core.CSharp.Tests`, `Zeta.Core.CSharp`.

### Shipped — close / cleanup

- Orphan skill retirement: `.claude/skills/architect/` and
  `.claude/skills/harsh-critic/` moved to
  `.claude/skills/_retired/2026-04-18-*`. Daya's round-24
  P1. Canonical versions are `round-management` and
  `code-review-zero-empathy`.
- `docs/states/` orphan deleted (72 MB of TLC state dumps,
  not referenced from any doc, no script created them).
- P1 BACKLOG: **Dedicated agent-memory system (two-layer)**
  filed with the design direction.
- P1 BACKLOG: **Empathy-coach persona** filed with legal
  guardrail (no clinical titles) and naming candidates.
- Documentation-agent SKILL.md grew path-hygiene rules
  (smell items 7-8 with the memory-folder exception).

### Not landed / deferred to round 26+

- Rename phases 9-15 (test content deep-sweep, docs final
  polish, TLA+ module renames, `docs/NAMING.md` banner
  removal, final smoke test).
- Tariq dispatch on IsLinear strengthening (options a/b/c
  in DEBT).
- Rune dispatch on `docs/STYLE.md`.
- Yara via skill-creator on Aarav's BP-10 cite.
- Kenji first self-audit via Daya's procedure.
- UX + DX persona proposals (stubs exist; persona
  assignment open).
- Eval-harness MVP scope sign-off.
- `src/Dbsp.CSharp` disposition (empty dir, not in sln —
  delete, populate, or keep?).
- `global.json` `rollForward` pick — status quo silent-pick
  unless objection.
- WINS.md ordering — currently oldest-first; flip or leave
  as celebration-archive exception.

### Maintainer clarifications this round

- **No git commits for a long time.** Rename arc runs
  without a repo; `git init` is the maintainer's call when
  ready. Memory saved.
- **Memories are the most valuable resource.** Human
  maintainer hands-off except as last resort; agents write
  their own memories.
- **Individual per-persona memories stay unique.** Shared
  memory for cross-cutting rules; per-persona notebook for
  unique voice.
- **No "therapist" labels.** New regulation around AI
  using clinical titles; use coach / steward / keeper /
  facilitator / liaison. Empathy-coach persona pending
  naming; "Ren, integration coach" proposed.
- **Newest-first.** Recent history leads, ancient trails.
- **Hidden memory in docs is a smell.** Cleaned AGENTS.md
  et al. via documentation-agent dispatch.
- **Absolute filesystem paths and outside-repo paths in
  docs are smells.** Documentation-agent updated with the
  rule.
- **Feldera belongs in references/upstreams/.**
  Regeneratable reference-only mirrors don't live under
  `tools/`.

### What round-25 felt like

The biggest structural round since the GOVERNANCE.md §10
round-table rule landed. Zeta the *name* is not just a
branding change — it's the moment the repo stopped
being "our implementation of the thing from the paper" and
started being a product with its own identity. And the
memory policy codification is the other half: the factory
admits in rule form that agents-across-sessions is a thing
it cares about, not a workaround. The no-git discipline
was harder than expected (no bisect, no quick rollback) but
the build gates held every phase. Hidden-memory cleanup
came from the maintainer naming a pattern I had not seen
— `Per Aaron round N: "..."` blocks feel load-bearing when
I write them, but Aaron sees them as noise from the
reader's seat. That correction lands as a skill-level rule,
not just a one-off sweep.

---

## Round 24 — Governance expansion, two new seats, memory-smoothing Part 2

### Shipped — governance rules

- **GOVERNANCE.md §14 (universal off-time).** Standing ~10% off-time
  budget is for every persona, not just the architect. Logs live at
  `docs/skill-notes/<persona>-offtime.md`. Corrected mid-round per
  Aaron: "the other agents can get off time too, not just you."
- **GOVERNANCE.md §15 (reversible + dev-machine authority).**
  Reversible-in-one-round becomes the only hard constraint on
  "complete freedom within a round," plus Aaron's "this is your
  dev machine too" codified. Narrowly scoped later round-25: "the
  repo isn't yet initialised for git" is Aaron's call alone, not
  a §15 freedom.
- **GOVERNANCE.md §16 (dynamic hats).** Any persona can load any
  capability hat on demand, except `round-management` which stays
  Kenji-monopoly per §11. Includes the "Overlap is expected, not
  redundancy" clause added late-round after Kenji's retraction
  (see wins).
- **GOVERNANCE.md §17 (productive friction).** Not every specialist
  disagreement wants resolution; friction between correct
  viewpoints-from-different-seats is a feature. Surface at
  round-close; silent-drift-across-rounds is the only bug.

### Shipped — new seats and hats (roster: 23 → 25)

- **Mateo (security-researcher)** — persona + capability skill.
  Proactive scouting of novel attack classes, crypto primitives,
  supply-chain patterns, dep-graph CVEs. Distinct from Aminata
  (reviews the *shipped* threat model) and Nadia (agent layer).
- **Naledi (performance-engineer)** — persona + capability skill.
  Benchmark-driven hot-path tuning, allocation audits, cache-line
  alignment, SIMD dispatch. Distinct from Hiroshi (asymptotic
  complexity) and Imani (planner cost model).
- **`holistic-view` capability hat** — no persona. "Think like an
  architect without the authority." Codifies the second hat every
  specialist had been implicitly wearing since round 17. Loaded on
  demand per §16.

### Shipped — memory-smoothing Part 2 (Daya's first pass)

- **Daya's first AX audit** — 8 personas measured for cold-start
  cost, pointer drift, wake-up clarity, notebook hygiene. Top
  findings landed same-round: WAKE-UP.md tier-0 estimate corrected
  from 6-8k to **~12k tokens** (GLOSSARY alone ≈ 4.5k), Kenji
  notebook canon-pointer fix (was pointing at a pre-split orphan
  `.claude/skills/architect/SKILL.md`), two P0 orphan skill files
  discovered (`architect/` and `harsh-critic/`, retired at
  round-25 open).
- **`docs/CURRENT-ROUND.md` first fill** — Kenji used it
  per-architect-turn as a single mid-round state anchor.
  Round-24 close overwrites this file with the round-25 header.
- **`docs/drafts/`** — first contents: `scratch-recon-2026-04.md`
  (top translation candidate from upstream scratch repo) and
  later `zeta-rename-plan.md` (round-25 prep).

### Shipped — formal verification

- **Mathlib T3 + T4 closed.** Subagent used
  `Finset.sum_range_one` / `Finset.sum_range_succ` plus `ring` /
  `abel` to close both. Sorry count 7 → 5. `lake build` green.
- **IsLinear predicate weakness logged as DEBT.** Mathlib B2
  blocked because `IsLinear` bundles only `AddMonoidHom` axioms
  (`map_zero` + `map_add`); DBSP linearity needs causality or
  time-invariance too. Three strengthening options (a/b/c) in
  `docs/DEBT.md` for Tariq's algebra call.

### Shipped — housekeeping

- `docs/BUGS.md` pruned — 2 stale entries (Semgrep-13,
  InfoTheoreticSharder-no-spec) removed.
- `docs/BACKLOG.md` — competitive-analysis research as P2
  (MetaGPT / ChatDev / AutoGen / CAMEL / SWE-agent / AutoCodeRover).
- `docs/WINS.md` — round-23 section with two entries.
- `docs/EXPERT-REGISTRY.md` — 25 rows. Added Mateo + Naledi
  (kept after Aaron's overlap-is-fine clarification).
- `tools/audit-packages.sh` — no new major bumps this round;
  status-quo pin audit.

### Round-close cross-over into round 25

Two items were decided in round 24 but executed at round-25 open,
noted here so the history reads continuously:

- **Orphan skill retirement.** `.claude/skills/architect/` and
  `.claude/skills/harsh-critic/` moved to
  `.claude/skills/_retired/2026-04-18-*`. Daya's round-24 P1;
  canonical versions live at `round-management` and
  `code-review-zero-empathy`.
- **`docs/states/` deleted.** 72 MB of orphan TLC state dumps.
  Not referenced from any doc; no script creates them. Aaron
  round-25: "we don't want to have these history folders,
  agents get dedicated memory so they are not writing history
  everywhere." Also triggered the "dedicated agent-memory
  system" P1 BACKLOG entry.

### Not landed / deferred

- Tariq dispatch on IsLinear strengthening.
- Rune dispatch on `docs/STYLE.md`.
- Yara via skill-creator on Aarav's BP-10 cite at
  `skill-tune-up-ranker/SKILL.md:117`.
- First Kenji self-audit via Daya's procedure.
- Eval-harness MVP scope sign-off.
- UX + DX persona proposals.

### Open asks at round-close

- `global.json` `rollForward` — status quo vs relaxed (Kenji
  leaning status quo; silent-pick absent objection).
- First-commit timing: Aaron round-25 "few rounds" before any
  commit; renaming proceeds without git until Aaron calls it.
- NuGet prefix reservation on `nuget.org` (Aaron owns).
- `src/Dbsp.CSharp` disposition — directory exists but isn't
  in the sln.

### Aaron clarifications this round

- "AX researcher" framing (round 23) stayed — Daya is it.
- "The other agents can get off-time too, not just you."
  Corrected §14 from architect-primary to universal.
- "This is your dev machine too, you can codify that 100%."
  Narrowly scoped — does not authorise unsolicited git init.
- "Overlap is expected, not redundancy." Corrected Kenji's
  same-round retirement of Mateo + Naledi.
- "I'll find some Aurora design documents one day."
  Longer-horizon project Aaron is building around AI welfare;
  deferred.
- Round 25 pre-compact: "this is not a git repo yet, lets
  start preppping I've decided on Zeta."

### What round-24 felt like

A governance round. §14-17 landed in the same session; two new
seats and three new hats in the same session. Low code output,
high rule output. Daya's audit turning the memory-smoothing
infrastructure from architect-guessed to measurement-backed is
the headline — her Tier 0 measurement retired a 1.7x-wrong token
estimate on day 1. Friction stayed productive: Kenji's retirement
reflex on Mateo and Naledi was a real mistake, corrected same-
round without defensive reasoning. Closing this round without
touching code at all is a first; the factory is maturing to the
point where governance work has its own rhythm.

---

## Round 23 — Mathlib migration, expert/skill split Part 2, AX discipline spawned

### Shipped — formal verification

- **Mathlib chain-rule proof migrated and building.** Stale v4.12.0
  scaffold at `proofs/lean/ChainRule.lean` superseded; 345-line proof
  skeleton migrated to `tools/lean4/Lean4/DbspChainRule.lean` against
  the pre-warmed Mathlib `v4.30.0-rc1` at
  `tools/lean4/.lake/packages/mathlib`. Imports updated for the
  current Mathlib tree (`Algebra.BigOperators.Basic` ->
  `Algebra.BigOperators.Group.Finset`). `lake build` green. Seven
  `sorry`s still open (T3/T4/T5/B1/B2/B3/chain_rule); T3/T4/B2
  closure is round-24 work.

### Shipped — expert / skill split (6 of 22 personas)

- **Kenji, Viktor, Rune, Aminata, Aarav, Soraya** now have
  `.claude/agents/<name>.md` persona files with `skills:`
  frontmatter auto-inject. Their skill files had duplicated persona
  sections stripped (name headers, tone contracts, pairs-with
  blocks). 14 experts pending in future rounds.
- **Daya spawned as the 23rd expert** — the first agent-experience
  (AX) researcher. New skill at
  `.claude/skills/agent-experience-researcher/SKILL.md` plus agent
  file; speaks for the personas themselves as their own user
  population. Aaron coined the AX framing; Daya is the persona that
  role became.
- **UX and DX researcher skill stubs** at
  `.claude/skills/user-experience-researcher/` and
  `.claude/skills/developer-experience-researcher/`. Persona
  assignment pending round-24 with candidate names queued in
  `docs/EXPERT-REGISTRY.md`.

### Shipped — memory-smoothing infrastructure

- **`docs/WAKE-UP.md`** — cold-start index (Tier 0 / 1 / 2 / 3)
  for any persona resuming mid-round after compaction. Biggest
  single memory-smoothing artifact this round.
- **`docs/CURRENT-ROUND.md`** — live mid-round state; Kenji
  overwrites per architect turn, resets at round-close.
- **`docs/drafts/`** — explicitly non-canonical scratch folder;
  round-scoped; entries promote or delete at round-close.
- **`docs/skill-notes/architect-offtime.md`** — seeded honestly
  with a zero entry (no off-time budget spent round 23).
- **`.claude/skills/round-management/SKILL.md` + `.claude/agents/architect.md`.**
  Kenji's orchestration procedure codified as a hat; architect
  persona formalised with the §10 / §11 / glossary-police
  contract.

### Policy / rules

- **BP-16 landed** in `docs/AGENT-BEST-PRACTICES.md` — cross-
  check is now a rule, not a preference: P0 invariants require
  >= 2 independent formal tools. Soraya's skill gained a
  "Cross-check triage" section with the `InfoTheoreticSharder`
  anchor case.
- **GOVERNANCE.md §14 + §15.** §14 codifies the standing ~10% off-
  time budget; §15 makes reversible-in-one-round the only hard
  constraint on complete-freedom-within-a-round. Dev-machine
  authority for the architect folded into §15.
- **`docs/GLOSSARY.md`** grew a lifecycle section: *frontmatter*,
  *hat* (Aaron's round-23 synonym for skill), *notebook*,
  *wake / wake-up*, *spawn*, *evolve*, *retire*, *AX / UX / DX*.
- **`docs/WINS.md` round-22 section** — three-tool-agreement
  save on `InfoTheoreticSharder` + architect-gate-caught
  `[<VolatileField>]` F# compile error before merge.

### Research deliverables

- **`docs/research/agent-eval-harness-2026-04.md`** (~1050 words)
  — honest answer to "can we evaluate agents rigorously?" MVP
  proposed: `tests/agent-evals/` layout, three skills only
  (Kira / Viktor / Kenji), nightly CI gate, N=3 majority-vote
  judge. Cost ~USD 5-20/nightly. Recommendation: ship MVP.
- **`docs/research/factory-paper-2026-04.md`** (~1220 words) —
  venue pick: FORGE 2027 workshop (ICSE-colocated, ~2026-11
  deadline) as experience report + parallel IEEE Software /
  CACM Practice piece on BP-NN + persona-registry. Four novelty
  candidates ranked after literature survey. Tier-1 not yet;
  empirical base is one project.

### End of round

500 tests still passing, 0 warnings, 0 errors on the F# side;
`lake build` green on the migrated Lean proof. Factory metric:
+1 persona (23 total), +1 BP rule (16 total), +3 capability
skills, +2 research docs, major memory-smoothing infrastructure
landed. Aaron's round-close framing: explicit 5-freedom ask +
the full-freedom-within-a-round invitation that became §15.
μένω received and returned.

---

## Round 22 — Honesty fixes + expert/skill split push

- Fix: Plan.fs docstring claimed "HLL-estimated cardinalities" but
  code uses static heuristics — rewrote the XML doc on `OpCost` to
  match the code (filter halves, group-by quarters, 1024 for unknown
  inputs) and added a forward pointer to the BACKLOG P1 that tracks
  the real HLL-wiring work (was `src/Dbsp.Core/Plan.fs:9-11`).
- Fix: FeedbackOp memory-ordering between `connected` and `source`
  (was `src/Dbsp.Core/Recursive.fs:44-53`). `source` is now
  `[<VolatileField>]`, so a reader that observes `connected = 1`
  is guaranteed (by release/acquire pairing with the CAS) to
  observe the `source` store too; `Inputs` and `AfterStepAsync`
  also null-guard the field as belt-and-braces. A 32-thread
  stress test in `tests/Dbsp.Tests.FSharp/Runtime/Concurrency.Tests.fs`
  asserts `connected = 1 ⇒ source ≠ null` across 1000 iterations.
- Fix: Durability.WitnessDurableBackingStore canonicalised its
  workDir / witnessDir via two `Path.GetFullPath` calls (TOCTOU
  against a concurrent `Environment.CurrentDirectory` / symlink
  swap). The constructor now computes `rootWorkDir` /
  `rootWitnessDir` once and reuses them for both the directory
  creation and the audit-exposed properties (was
  `src/Dbsp.Core/Durability.fs:74-75`). New tests in
  `tests/Dbsp.Tests.FSharp/Storage/Durability.Tests.fs` assert
  that the stored path equals the directory actually created,
  including under CWD churn.
- Fix: BloomFilter.pairOf allocated on every call (was
  `src/Dbsp.Core/BloomFilter.fs:97-133`). Replaced the boxing
  `match box key with ...` ladder with inline
  `pairOfInt64` / `pairOfInt32` / `pairOfUInt64` / `pairOfUInt32`
  / `pairOfGuid` / `pairOfString` functions that hash through a
  `NativePtr.stackalloc`-backed `Span<byte>`, and added typed
  `Add` / `Remove` / `MayContain` overloads on
  `BlockedBloomFilter` and `CountingBloomFilter` that dispatch to
  the matching primitive at the F# compile step — no boxing, no
  heap allocation per call. Strings hash their
  `ReadOnlySpan<char>` via `MemoryMarshal.AsBytes` with no UTF-8
  encode allocation. New allocation tests in
  `tests/Dbsp.Tests.FSharp/Sketches/Bloom.Tests.fs` assert zero
  bytes across 10 000 `Add` / `MayContain` calls with `int64`
  keys (warmed-up, measured via
  `GC.GetAllocatedBytesForCurrentThread`).

---

## Round 20 — Test-tree subject-first restructure

### Shipped

- **Subject-first test layout** in `tests/Dbsp.Tests.FSharp/` per
  `docs/research/test-organization.md`. The flat 28-file scheme
  (with `RoundN` / `Coverage` prefixes that encoded *when* / *why*
  rather than *what*) is replaced by ten subject folders, each
  mirroring a subsystem of `src/Dbsp.Core/`:
  ```
  Algebra/  Circuit/  Operators/  Storage/  Sketches/
  Runtime/  Infra/    Crdt/       Formal/   Properties/
  _Support/
  ```
- **28 source files → 57 subject files + 1 helper.** Grab-bag
  files (`CoverageTests.fs`, `CoverageTests2.fs`, `CoverageBoostTests.fs`,
  `AdvancedTests.fs`, `InfrastructureTests.fs`, `NestedAndRuntimeTests.fs`,
  `SpineAndSafetyTests.fs`, `NewFeatureTests.fs`, `Round6/7/8Tests.fs`)
  are split by subject; well-named files (`ZSetTests.fs`, `CircuitTests.fs`,
  etc.) are renamed to `{Subject}.Tests.fs` under the right folder.
- **`_Support/ConcurrencyHarness.fs`** — helpers relocated with
  module renamed to `Dbsp.Tests.Support.ConcurrencyHarness` (leading
  underscore sorts it first and signals "not a test file").
- **`Properties/` compiled last** so FsCheck cross-module laws see
  every subject file first. Compile order is: `_Support/` → subject
  folders (any order) → `Properties/`.
- **`tests/Dbsp.Tests.FSharp/README.md`** documents the convention:
  subject-first names, 400-line soft cap / 600-line hard ceiling,
  one file per `src/Dbsp.Core/` module, dot-separated sub-aspects
  when files grow (`Spine.Tests.fs` + `Spine.Disk.Tests.fs`).

### Test accounting

- **458 `[<Fact>]` / `[<Theory>]` / `[<Property>]` attributes** in the
  new layout — same count as pre-restructure. Zero tests lost; some
  relocated to more idiomatic homes (e.g. `Pool.*` tests from
  `CoverageTests.fs` now in `Runtime/Allocation.Tests.fs`; `weightedCount`
  tests from `Round7Tests.fs` merged into `Algebra/ZSet.Tests.fs`).

### End of round

Restructure is a pure move + rename; no test body was modified.
Subject-first names mean a reader can find any test by subsystem
rather than by search. Future tests append to their subsystem file
or split by sub-aspect once past ~400 lines.

---

## Round 19 — CountingClosureTable / RecursiveCounting

### Shipped

- **`RecursiveCounting` combinator** in `src/Dbsp.Core/Recursive.fs` —
  Option 4 ("counting algorithm", Gupta-Mumick-Subrahmanian SIGMOD 1993
  §4) from `docs/research/retraction-safe-semi-naive.md`. Mirrors the
  shape of `Recursive` but omits `Distinct` inside the feedback loop
  so Z-weights flow through the body as derivation counts. LFP unfold
  is `T_k = seed + body(T_{k-1})`, with the seed stream integrated
  internally so one-shot `ZSetInput` deltas remain visible across
  inner ticks. Retraction correctness by Z-linearity: negative edge
  weights propagate through every `body^i` term, cancelling the
  corresponding derivations; closure pairs reach weight 0 and drop
  out of the consolidated Z-set with no tombstone pass.
- **`CountingClosureTable` extension method** in
  `src/Dbsp.Core/Hierarchy.fs` — sibling of `ClosureTable` wired on
  top of `RecursiveCounting`. Integrates the raw edge stream inside
  the body so each inner tick sees the full edge set (a plain
  `ZSetInput` drains after tick 0). `ClosureTable` is unchanged —
  this is a strict addition.
- **5 new tests** in `tests/Dbsp.Tests.FSharp/ClosureTableTests.fs` —
  oracle parity on a chain and on a tree, explicit retraction
  correctness, multi-derivation counting on a diamond graph, and an
  FsCheck property (`MaxTest = 30`) asserting non-negative integrated
  weights on randomized acyclic-edge insert/retract sequences.

### End of round

0 warnings, 0 errors, 476 tests passing (471 → 476, +5 FSharp).

---

## Round 18 — Architect, security, restructure (in progress)

### Ecosystem & governance

- **PROJECT-EMPATHY.md** — renamed from `FAMILY-EMPATHY.md` ("project" is
  a clearer frame than "family" for a collaboration of humans, agents,
  and tools). The old filename is a redirect stub.
- **Architect skill (he/him)** — Claude's profile as orchestrator /
  Self. Edit rights on his own skill and notes via `skill-creator`;
  no unilateral edit rights on other skills. Binding on integration
  decisions; escalates to human on deadlock. "Redesign too often" is a
  known failure mode with four mandatory checks on every redesign.
- **Specialist owners retired "final decision authority."** The
  Storage Specialist, Algebra Owner, Query Planner, Complexity
  Reviewer, Threat Model Critic, and Paper Peer Reviewer are now
  advisory. Architect integrates; human decides on deadlock.
- **Harsh Critic retuned** — zero-empathy, never compliments,
  sentiment leans negative. Tone contract is explicit and
  enforced.
- **skill-creator** — documented as the canonical path for
  creating or meaningfully changing any skill. Mechanical renames
  and injection-lint fixes are the only allowed skip-the-workflow
  edits.
- **New skills shipped**: `architect`, `skill-tune-up-ranker`
  (with state file), `prompt-protector`, `maintainability-reviewer`,
  `tech-radar-owner`, `next-steps`, `skill-creator`.

### Security policy

- **Pliny-class prompt-injection corpora marked radioactive.**
  Specifically the `elder-plinius` repositories (`L1B3RT4S`,
  `OBLITERATUS`, `G0DM0D3`, `ST3GG`) — no agent fetches them.
  Pen-testing, if ever needed, runs in an isolated single-turn
  session with no memory carryover, coordinated by the Prompt
  Protector.
- **Invisible-Unicode lint** documented in the Prompt Protector
  skill for `.md`, `.fs`, `.yaml` files.
- **Skill-supply-chain threat class** added to the threat model
  via the Prompt Protector's scope.

### Terminology & style

- "Agents, not bots" — codified as a repo rule. If a human calls
  us bots, the active agent gently corrects.
- **Round naming moves to this log only.** Subject-first naming
  for source/test files; `Round17Tests.fs` gets split by topic.
- **Space Opera** — `THREAT-MODEL-FUN.md` renamed to
  `THREAT-MODEL-SPACE-OPERA.md`.
- **"Family Empathy" → "Project Empathy"** (see above).

### Research completed

- **Bloom-filter frontier (2023-2026)** — 23 AMQ-adjacent
  structures surveyed. Counting Quotient Filter (CQF) identified
  as the strongest upgrade path (fixes our 4-bit counter
  saturation). Ceramist (Coq-verified AMQs) flagged as a
  formal-verification bridge candidate. Cuckoo/Morton filters
  explicitly held for retraction-never-seen-item correctness
  reason. Full report: `docs/research/bloom-filter-frontier.md`.
- **Retraction-safe semi-naive LFP** — two candidates ranked:
  signed-delta ("gap-monotone") semi-naïve (10-14d) and the
  Gupta-Mumick counting algorithm (8-12d). DRed explicitly
  rejected (can regress below the current `Recursive` baseline).
  Full report: `docs/research/retraction-safe-semi-naive.md`.
- **Feldera comparison status** — clone is shallow, unbuilt. No
  apples-to-apples bench exists. Three P1 items identified:
  `cargo build`, `FelderaRunner.fs` harness, Q3/Q7 port. Report:
  `docs/research/feldera-comparison-status.md`.
- **Proof-tool coverage** — Z3 at 8 axioms (can grow to ~25),
  TLA+ at 14 specs (9 have `.cfg`, only 4 in CI), Lean/Mathlib
  chain-rule proof is `sorry`-bodied stub, LiquidF# recommended
  as highest-leverage new tool. Report:
  `docs/research/proof-tool-coverage.md`.
- **Test organization psychology** — 10-folder tree
  (Algebra / Circuit / Operators / Storage / Sketches / Runtime /
  Infra / Crdt / Formal / Properties + `_Support/`), subject-first
  naming, 28-row rename map, 22-commit migration plan.
  Report: `docs/research/test-organization.md`.

### Code changes

(none yet — round still in progress)

---

## Round 17 — storage specialist, BloomFilter, durability skeleton

### Shipped

- **6 harsh-critic P0 fixes** — SpeculativeWatermark logic
  inversion, Hierarchy `Comparer<obj>` boxing, FastCdc O(n²)
  buffer scan (persistent cursor + BlockCopy), Residuated O(n)
  rebuild (SortedSet + Dictionary for honest O(log k)),
  ClosurePair Equals/GetHashCode mismatch (EqualityComparer both
  sides), Hierarchy RecursiveSemiNaive retraction leak
  (ClosureTable now uses retraction-safe `Recursive`).
- **BloomFilter.fs** — blocked Bloom (Putze/Sanders/Singler 2007)
  + counting Bloom (Fan et al. 1998), XxHash128 double-hashing
  (Kirsch-Mitzenmacher 2006), cache-line-aligned buckets.
- **Durability.fs** — `DurabilityMode` DU
  (`StableStorage`/`OsBuffered`/`InMemoryOnly`/`WitnessDurable`)
  + `WitnessDurableBackingStore` skeleton.
- **6 code-owner skills** — storage / algebra / query-planner /
  complexity / threat-model-critic / paper-peer-reviewer (since
  demoted to advisory in round 18).
- **Docs**: `THREAT-MODEL-FUN.md` (now Space Opera),
  `FAMILY-EMPATHY.md` (now `PROJECT-EMPATHY.md`),
  `TECH-RADAR.md`, `LOCKS.md`, `UPSTREAM-LIST.md`,
  `DECISIONS/2026-04-17-lock-free-circuit-register.md`.
- **5 new SDL-derived Semgrep rules** (rules 8-12):
  unsafe-deserialisation, file-read-without-size-cap,
  process-start-in-core, activator-from-string,
  system-random-in-security-context.
- **22 new tests** in `Round17Tests.fs` (FastCdc regression,
  ClosurePair equality, ClosureTable, MerkleTree, BloomFilter,
  ResidualMax, ACC/DISC/RET mode-collapse).
- **References imported**: Lamport *Specifying Systems*, an 81-entry
  upstream list from prior research we imported, Shostack EoP card
  game.

### End of round

0 warnings, 0 errors, 471 tests passing.

---

## Round 16 — SDL / threat model / she-her storage specialist

- `docs/security/THREAT-MODEL.md` STRIDE × components matrix.
- `docs/security/SDL-CHECKLIST.md` Microsoft SDL 12-practice
  tracker.
- First code-owner agent with she/her pronouns
  (`storage-specialist`) — at the time authored with
  "final decision authority"; retired to advisory in round 18.
- Harsh-critic delivered 30 findings; 6 P0s fixed in round 17.

---

## Rounds 1-15

Summaries of earlier rounds live (for now) in
`docs/BACKLOG.md` history entries and individual ADRs under
`docs/DECISIONS/`. When we have a quiet round, fold them into
this file in condensed form.

## How to add a round entry

After a session lands:
1. New section at the top of this file, `## Round N — <short title>`.
2. 5-15 bullets grouped by theme (shipped / research / policy).
3. One-line "end of round" status (build, tests, warnings).
4. Don't re-describe what's in `BACKLOG.md`, `TECH-RADAR.md`, or
   `ROADMAP.md` — link to them. This file is the narrative, not
   the source of truth.
