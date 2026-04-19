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
- [ ] **SpeculativeWindow test coverage** — still pending; covered by
  SpeculativeWatermark tests in `Round17Tests.fs` but the
  `Window.fs` speculative path has no direct test.
- [ ] **ArrowInt64Serializer tests** — still pending; harsh-critic
  #28 remainder.

## Research projects

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
- [ ] **Finish Lean 4 + Mathlib chain-rule proof**.
  `proofs/lean/ChainRule.lean` is a `sorry`-bodied stub.
  `docs/research/proof-tool-coverage.md` is explicit this is the
  single highest-leverage prover move we can make. 2 weeks.
- [ ] **LiquidF# refinement-types trial**. Would catch the
  off-by-one / bad-index class that keeps reappearing in
  `FastCdc.fs`, `Crdt.fs`, SIMD merge. Effort: 1 week for
  evaluation, then incremental adoption per module.
- [ ] **Feldera apples-to-apples benchmark**. Three concrete
  steps from `docs/research/feldera-comparison-status.md`:
  (a) `cargo build --release` in `references/upstreams/feldera/`,
  (b) write `bench/Dbsp.Feldera.Bench/FelderaRunner.fs` shell-out
  helper + `FelderaCompare.fs` diff harness,
  (c) port Nexmark Q3 (hash join) + Q7 (windowed top-1) on our
  side (Window.fs wiring pending). Target: measured numbers in
  `docs/BENCHMARKS.md` by end of round 20.

## P1 — Factory / static-analysis / tooling (round-33 surface)

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
  declarative-ish (`apt.txt`, `brew.txt`, etc.) but flat.
  `../scratch`'s `declarative/` has tiered profiles
  (`min`/`runner`/`quality`/`all`) per platform per tool.
  Push one incremental step per round — split `brew.txt` into
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
- [ ] **CodeQL workflow** — `.github/workflows/codeql.yml`, SDL
  practice #9.
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
    `docs/PROJECT-EMPATHY.md`.
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
  Scope: holds `docs/PROJECT-EMPATHY.md` as the working
  artifact. Relates to GOVERNANCE.md §17 (productive friction) —
  this seat sits *with* the friction rather than resolving
  it. Open design questions: (a) title (see safer candidates
  above), (b) personal name, (c) per-persona coaching-log vs
  shared log, (d) edit rights on `docs/PROJECT-EMPATHY.md`
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

## P2 — research-grade

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

## P3 — noted, deferred

- CalVin/FaunaDB-style deterministic sequencer MVCC (FaunaDB shut 2025)
- GPU OLTP (irrelevant to .NET)
- io_uring wrappers (no first-class .NET support)
- TPM/Intel SGX hardware-attested commits

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
