# ADR: Scripting-language policy for `tools/` — bun+TypeScript for post-setup, F#/.NET for engine-adjacent, no Python

**Date:** 2026-04-20 (round 43)
**Status:** *Decision: post-setup scripting work in `tools/`
adopts **bun + TypeScript** matching SQLSharp. Pre-setup
surface remains bash + PowerShell (constrained, not chosen).
F#/.NET is retained for engine-adjacent tools that already
inhabit the .NET surface (e.g. Z3Verify). Python is not
adopted as a Zeta-authored tooling language. The in-flight
`tools/invariant-substrates/tally.py` is removed; its
replacement lands as `tools/invariant-substrates/tally.ts`
(bun-run). An interim `tools/invariant-substrates/tally.sh`
may exist transitionally and retires when the bun surface
is scaffolded.*
**Owner:** architect (synthesis), human maintainer
(shaping-decision owner).

**Decision confidence:** *medium* — Aaron initially flagged
this as *"one of the hardest decisoins i've made and i'm
still not sure i made the right one"*, which would read as
low confidence. One later input materially raised the floor:
TypeScript is coming to Zeta anyway for the UI surface, so
**bun is not a net-new runtime dedicated to tooling alone**
— it amortizes across tooling + UI. That converts the
second-runtime objection from a real cost into a reframing:
the UI surface pays for the runtime; tooling rides along.
Aaron verbatim: *"also i know we will end up using
typescrpt for our ui here too eventually so bun is a tool
that's comming no matter what"*. Confidence moves from low
(hardest call) to medium (hardest call + material
amortization argument). Watchlist + revisit triggers still
captured below — medium is not high. Proposal: future ADRs
carry an explicit `decision-confidence` field; this is the
first ADR to do so.

**Revision history:**

- 2026-04-20 v1 — initial draft, deferred bun+TS,
  recommended bash.
- 2026-04-20 v2 — Aaron pushed back: *"i personally don't
  think bash is the right answer post install it's clunky
  and has to use git bash which is slow on windows"*. Bash
  rejected as post-setup default on Windows-performance +
  clunkiness grounds.
- 2026-04-20 v3 — Aaron added the existing-tech-interop rule
  (*"when looking for prior art we shold also take into
  account our existing technologeis ... new teachnoloes
  should only call huge refactors of our existing technologies
  if it's worth it"*). Applied, and Aaron chose bun+TS:
  *"i like bun + TypeScript, it worked for me"*. Recorded.
- 2026-04-20 v4 — Aaron added two clarifications:
  (a) SQLSharp's choice is not a downstream-immutable
  constraint; *"SQLSharp can be updated to use whatever we
  choose though if you think something is better"*.
  Cross-project consistency is a two-way bonus, not a
  one-way pressure. (b) The deeper reason for going outside
  bash/pwsh is the faction-hate problem: *"pwsh is also
  clunky cause some people hate powershell and some hate
  bash which is another reason i tried to go outside those."*
  And the decision is held with explicit low confidence;
  watchlist section added.
- 2026-04-20 v5 — Aaron added the UI-TS amortization
  input: *"also i know we will end up using typescrpt for
  our ui here too eventually so bun is a tool that's
  comming no matter what"*. TypeScript is an inevitable
  Zeta surface (UI), so bun is not a runtime added purely
  for tooling — tooling rides on a runtime the UI already
  needs. The second-runtime cost is amortized across two
  use cases. Confidence lifted from *low* to *medium* on
  this input.
- 2026-05-31 v6 — **triggered revisit** (the watchlist's
  node/deno/bun-landscape trigger): refine to **Node = safe
  cross-harness baseline, Bun = accelerator**. Still bun+TS;
  Node becomes the portable runtime tooling must *run* on,
  Bun the fast lane. Aaron + Max aligned; Node-24 pin landed
  (#6290). Details + proposed Rule-0 text in the Addendum
  at the end.

## Context

On round 43 the architect landed a new aggregator at
`tools/invariant-substrates/tally.py` to back the
`docs/INVARIANT-SUBSTRATES.md` stance (tiered burn-down
counts across every `.claude/skills/*/skill.yaml`). The
file went in as **Python** without an ADR, without a
cross-project check against the sibling repo `SQLSharp`,
and without an internet best-practices sweep. Aaron
flagged it on the same round:

> *"tools/invariant-substrates/tally.py so did you look at
> ../SQLSharp? We want our post-build script to be python?
> not bun/typescript like SQL Sharp. Did we do an ADR and
> investigation? This should be an intentional choice not
> an accidental quick decision. This one of the kind of
> things I was hoping the architect would catch as
> accidental debt using new patterns without explicit
> decisions and ADR and research to try and find the best
> pattern."*

That is exactly the class of miss the
`docs/DECISIONS/2026-04-20-intentional-debt-over-architect-gate.md`
ADR names as **accidental debt** — a new-pattern adoption
that landed without the "is this really the right pattern"
conversation. The fix is to do the ADR retrospectively,
remediate the artifact, and record the standing rule for
every future new-tooling decision.

## What already exists in `tools/`

Enumerated from the live repo (2026-04-20):

- **bash** — dominant across `tools/`. `tools/setup/`
  (install scripts), `tools/lint/` (e.g.
  `safety-clause-audit.sh`), `tools/alignment/`,
  `tools/audit-packages.sh`, `tools/profile.sh`, etc.
  Cross-platform (macOS / Linux / WSL / Windows Git Bash)
  via the same portability discipline SQLSharp documents.
  **Windows note:** Git Bash is the Windows fallback and
  is measurably slow — fork/exec on Windows + filesystem
  case-normalization combine to make multi-call bash
  scripts noticeably sluggish under native Windows.
- **F#/.NET** — `tools/z3verify/` (a real .NET project,
  not a script). Principled choice because Z3Verify sits
  *on* the engine surface — it uses Z3 bindings via the
  .NET interop layer Zeta already depends on.
- **Lean 4** — `tools/lean4/` for Lean proofs. Vendored
  Mathlib brings Python into `tools/lean4/.lake/packages/`
  as a *consumed* dependency; none of those files are
  Zeta-authored, and the vendor boundary is respected.
- **TLA+** — `tools/tla/` for TLA+ specs. Run through the
  `tlc` toolchain; no scripting language carried.
- **Python (Zeta-authored)** — **only** the just-landed
  `tools/invariant-substrates/tally.py`. This ADR is the
  occasion to decide whether that file stays in Python,
  gets rewritten, or gets removed.

## What SQLSharp does — prior-art check

`SQLSharp` (the sibling .NET/F# repo at
`/Users/acehack/Documents/src/repos/SQLSharp`) has a
strong and **explicit** scripting-language policy. Four
pieces of evidence from its committed `AGENTS.md`:

1. **Anti-Python, explicit:**
   *"Do not reintroduce checked-in `.db` fixtures,
   **Python helpers**, or vendor-engine bootstrap tools
   into the normal workflow."*
2. **Pro bun+TypeScript, explicit:**
   *"Prefer repo-local Bun-managed TypeScript tooling
   for JSON/YAML/Markdown/TOML formatting and linting
   over bespoke Python helper scripts when the workflow
   only needs structured-text validation."*
3. **Canonical `bun run` surface:**
   *"Prefer the canonical `bun run …` package-script
   surface for validation, coverage, and benchmark
   orchestration instead of duplicating post-setup
   control flow across `.sh` and `.ps1` wrappers."*
4. **No inline Python/Node shims in shell:**
   *"Keep committed `.sh` and `.ps1` entry points free
   of ad hoc inline Node/Python parser shims for their
   core behavior."*

SQLSharp's on-disk shape matches: `package.json`,
`bun.lock`, `bunfig.toml`, `tsconfig.json`,
`eslint.config.ts`, and a `tools/automation/**/*.ts`
tree of bun-run TypeScript helpers for formatting,
linting, validation, coverage, and benchmarks.

## Internet best-practices sweep — 2026-04-20

Dated, because findings stale. (Re-review cadence:
every 5-10 rounds per `docs/TECH-RADAR.md`.)

- **bash for repo tooling** — still the default for
  simple structured-text aggregation across
  cross-platform .NET repos when the task fits in <200
  lines and doesn't need a parser. GNU vs BSD `awk` /
  `sed` drift is the main trap; POSIX-compatible
  constructs mitigate it. Cross-platform weak point on
  Windows is Git Bash (slow, fork-heavy) or WSL
  (prerequisite install the pre-setup constraint is
  supposed to avoid for earlier scripts).
- **bun + TypeScript for repo tooling** — emerging
  default in 2025-2026 for .NET repos that also ship
  TypeScript artifacts or want static types on their
  automation. Bun ships a runtime, package manager,
  test runner, and bundler in one binary. Native
  Windows binary avoids the Git Bash problem; `bun
  run` is substantially faster to start than
  `node` / `tsx`. Downside: adds a fresh runtime as a
  build dependency (installed once by `tools/setup/`).
  SQLSharp's choice; increasingly idiomatic across
  .NET-adjacent repos.
- **Python for ad-hoc tooling** — remains universal
  but is actively *leaving* the
  JSON/YAML/Markdown/TOML validation niche, which is
  what `tally.py` does. Pulling it in for a 200-line
  aggregator is a large ecosystem commitment (pip /
  venv / pyproject.toml / Python-version pinning) for
  a tiny payoff.
- **F#/.NET console tools** — idiomatic in all-.NET
  shops when the tool sits on the engine surface.
  Overkill for a pure text-aggregation task. Strong
  interop with Zeta's existing `src/` but weak
  ergonomics for quick scripts.
- **.NET CLI global tools** — a middle path; used by
  Z3Verify. Good when the tool wants to be shared
  across solutions but not published as a standalone
  binary.

## Existing-tech-interop weighting

Per the standing rule captured this round
(`feedback_prior_art_weighs_existing_technology_interop.md`),
prior art is evaluated against existing in-repo tech and
with a huge-refactor gate:

1. **Dominant existing stack:** .NET / F# / C# (the
   `src/`, `tests/`, `benchmarks/` surface) + bash
   (the `tools/` surface) + Lean 4 + TLA+.
2. **Interop requirement for post-setup tooling:** the
   post-setup scripting surface (`tools/lint/`,
   `tools/invariant-substrates/`, `tools/alignment/`)
   operates primarily on text artifacts —
   `skill.yaml`, `SKILL.md`, JSON, markdown, YAML. It
   does **not** typically need to call into Zeta's F#
   types at runtime. So deep .NET interop is not a
   load-bearing requirement for this surface.
3. **Huge-refactor gate:** adopting bun+TS does not
   force any existing bash script to rewrite. Existing
   `.sh` files coexist. Over time, new post-setup
   tooling lands in TS; bash scripts are migrated
   opportunistically when they need more than shell
   glue, not in a big-bang refactor.
4. **Therefore:** the interop-lean that would normally
   favor F#-scripts (direct .NET interop) does not
   bind here. The decisive factor is the Windows
   performance + static types + SQLSharp consistency
   combination.

## Options considered

### Option A — keep `tally.py` in Python

- **Pros:** zero work; stdlib-only today.
- **Cons:** introduces Python as a new Zeta-authored
  tooling language for structured-text work, directly
  contradicting SQLSharp's explicit anti-Python policy
  for the same workflow class; no existing Zeta consumer
  of Python tooling to amortize the ecosystem cost; the
  next Python tool pulls in pip / venv / pyproject.toml
  and the surface grows silently.
- **Verdict:** rejected.

### Option B — rewrite in bash

- **Pros:** matches Zeta's current dominant `tools/`
  language; no new runtime today; aligns with
  SQLSharp's cross-platform shell discipline for
  `.sh` entry points.
- **Cons:** **clunky + slow on Windows.** Aaron's
  verbatim objection: *"bash is [not] the right
  answer post install it's clunky and has to use git
  bash which is slow on windows."* Post-setup work
  must be pleasant on all three host OSes, and Git
  Bash under-delivers. Shell-side YAML parsing is
  fragile if the schema grows.
- **Verdict:** rejected as the post-setup default.
  Retained only as transitional glue (existing `.sh`
  scripts are not force-migrated; new work goes to
  Option D).

### Option C — rewrite in F#/.NET

- **Pros:** principled cross-cutting choice for an
  all-.NET repo; strong typing; no new ecosystem;
  **best existing-tech interop** (direct F# type
  access if ever needed).
- **Cons:** overkill for a 200-line text aggregator;
  build-time + first-run latency is high relative to
  bun; `.fsx` scripting ergonomics are rougher than
  `.ts`; would invite similar .NET console tools to
  grow across `tools/` when most post-setup work
  doesn't need runtime interop with the engine.
- **Verdict:** retained specifically for
  engine-adjacent tools (Z3Verify is the canonical
  example); not the post-setup *default*.

### Option D — adopt bun + TypeScript (match SQLSharp)

- **Pros:** cross-project consistency with SQLSharp,
  which is a real Aaron-level value per
  `feedback_factory_reuse_packaging_decisions_consult_aaron.md`;
  static types on automation code; idiomatic
  2025-2026 choice; **native Windows binary** (no Git
  Bash); fast startup; scales cleanly if Zeta grows a
  larger automation surface (formatting, linting,
  validation, coverage, benchmark orchestration).
  Aaron's direct personal endorsement: *"i like bun +
  TypeScript, it worked for me."*
- **Cons:** introduces bun as a second runtime
  alongside .NET — a real ecosystem adoption
  (package.json, bun.lock, bunfig.toml, tsconfig.json,
  eslint.config.ts, a `tools/automation/**/*.ts`
  tree); the huge-refactor gate notes that the
  existing bash scripts are NOT forcibly rewritten —
  this is an additive adoption, not a sweep.
- **Verdict:** **adopted as the post-setup
  scripting default.**

### Option E — PowerShell 7+ cross-platform

- **Pros:** already constrained on Windows pre-setup;
  `pwsh` cross-platform is viable.
- **Cons:** clunky like bash, weaker type story than
  TypeScript, no sibling-project precedent, no Aaron
  endorsement.
- **Verdict:** rejected. Retained as pre-setup only.

## Decision

**Two distinct regimes, separated at the `tools/setup/`
boundary:**

### Pre-setup (constrained)

`tools/setup/**`, `doctor`-style preflight, and any
script a developer runs before their toolchain is
installed is **bash + PowerShell only**. Those
interpreters ship with the OS; any other language is a
chicken-and-egg violation. Non-negotiable — a
user-experience floor, not a preference. Recorded in
`feedback_preinstall_scripts_forced_shell_meet_developer_where_they_live.md`.

### Post-setup (free choice — bun + TypeScript)

Everything past `tools/setup/` is a free choice. The
toolchain is installed; the factory picks the best tool
on the merits (prior art + internet sweep + existing-
in-repo check + interop weighting).

1. **bun + TypeScript is the post-setup default** for
   `tools/` scripting work. Rationale, in order:
   1. **UI-TS amortization.** TypeScript is coming to
      Zeta anyway for the UI surface; bun is then a
      runtime the project needs regardless of tooling.
      Tooling amortizes across a runtime that's
      already paying its rent, not a new one.
   2. **Windows performance.** Native Windows bun
      binary sidesteps the Git Bash fork-heavy
      slowness that made bash untenable as the
      post-setup default.
   3. **Faction-hate sidestep.** Both bash and
      PowerShell have cultural factions that object
      to them. Going outside those two languages
      avoids forcing every contributor into a shell
      camp. Aaron verbatim: *"pwsh is also clunky
      cause some people hate powershell and some
      hate bash which is another reason i tried to
      go outside those."*
   4. **Static types on automation code.** TypeScript
      gives types; bash does not.
   5. **Cross-project consistency bonus.** SQLSharp
      already runs bun+TS. That consistency is a
      two-way bonus — either project can lead if the
      choice changes (Aaron: *"SQLSharp can be
      updated to use whatever we choose though"*) —
      not a one-way pressure.
   `bun run …` is the canonical invocation surface.
2. **F#/.NET is retained for engine-adjacent tools**
   that already inhabit the .NET surface (Z3Verify is
   the canonical example). Adding another F#/.NET
   tool requires justifying the engine-adjacency.
3. **Python is not a Zeta-authored tooling language.**
   Zeta-authored Python files in `tools/` are
   **forbidden** by default. Vendored Python (Mathlib
   under `tools/lean4/.lake/packages/`) is not
   affected — that is a consumed dependency, not an
   authored surface.
4. **Existing bash scripts are NOT force-migrated.**
   The huge-refactor gate applies. Existing `.sh`
   files under `tools/` stay bash until a natural
   trigger (they outgrow shell glue, or they need
   Windows-performance-sensitive work) justifies
   per-script migration. New post-setup tooling work
   defaults to TS.
5. **The in-flight `tools/invariant-substrates/tally.py`
   is removed.** Its replacement lands as
   `tools/invariant-substrates/tally.ts`
   (bun-run). An interim `tally.sh` may coexist
   briefly if the bun surface is not yet scaffolded
   in the same round; it retires at the first
   `package.json` + `tsconfig.json` landing.

## Watchlist — revisit triggers

This decision is held at *medium* confidence. Revisit is
**trigger-driven**, not calendar-driven. Any of the
following is reason enough to open a supersession ADR.
Observations accumulate into `docs/TECH-RADAR.md` under
the bun+TS row; multiple small signals also count.

1. **Bun regresses** — security issue, maintenance
   slowdown, Windows-binary drift, a major breaking
   change in the runtime, or a licensing shift.
2. **A better candidate emerges** — .NET gets
   first-class scripting ergonomics (F# Interactive
   improvements), a new entrant credibly targets this
   niche, or the node/deno/bun landscape consolidates
   around a different winner. Dated internet-best-
   practices sweep every 5-10 rounds per the standing
   rule catches this.
3. **Pain accumulates on the chosen path** — we
   repeatedly fight the type system, the compile step,
   the ecosystem sprawl, or the package-manager
   surface. If writing `.ts` feels *worse* than
   writing bash did, that is the signal.
4. **The UI-TS amortization evaporates** — if Zeta's
   UI surface ends up on a different runtime (Blazor
   WebAssembly, a Rust-based frontend, native .NET
   MAUI), the second-runtime objection re-emerges
   and this ADR needs to be re-evaluated without the
   amortization prop.
5. **SQLSharp changes course** — if the sibling
   project finds bun+TS unsatisfying and pivots, that
   is first-class evidence worth re-evaluating.
   Symmetric: if Zeta wants to change, SQLSharp can
   follow; the two projects are not a rigid
   consortium.
6. **Bun becomes the obvious default (no trigger).**
   If bun wins the market so decisively that nobody
   questions it anymore, that is the converse
   observation — catalogue it but no action needed.

The delegation is explicit: Aaron said *"no rush
whatever you want to do here at this point"*. The
architect owns the watching; Aaron owns the sign-off
if a supersession ADR is proposed.

## Assumptions — registry-compatible block

This ADR makes the following **unstated-at-the-time**
assumptions explicit as first-class rails. Aaron
2026-04-20: *"we should probably encode these too in
case they end up being wrong."* These are the load-
bearing beliefs that, if one day falsified, would
regress or invalidate the decision. Same four-field
shape per
`feedback_default_on_factory_wide_rules_with_documented_exceptions.md`:
**id / statement / probe / revisit-trigger** (with
**plain-language statement** alongside the technical
one, per the conversational-UX memory — these are
future UX inventory).

```yaml
- id: ASM-TOOLS-BUN-TS-STRIP
  statement: bun runs .ts source files directly by
    erasing type syntax (no JS emit, no separate
    build step). The `erasableSyntaxOnly` tsconfig
    flag and `"type": "module"` with no bundler
    presume this.
  plain-language: "Our TypeScript files run straight
    in bun without a compile step. We never ship a
    `.js` artefact next to a `.ts` source."
  confidence: high
  probe: run `bun tools/invariant-substrates/tally.ts`
    with no prior build; if it executes, the
    assumption holds.
  revisit-trigger: any bun release whose notes
    announce an eager compile step, OR any error
    reading "expected .js emit".
  owner: architect

- id: ASM-TOOLS-BUN-GLOB-DOT-DEFAULT
  statement: Bun's Glob.scan() excludes dotfile paths
    by default (discovered 2026-04-20 against
    tally.sh parity — `.claude/` was invisible
    without `{ dot: true }`).
  plain-language: "Any code that walks paths like
    `.claude/**` with Bun's Glob must opt in to
    dotfile matching, or it silently finds nothing."
  confidence: verified (observed 2026-04-20)
  probe: tally.ts round-43 smoke test is the
    regression guard; any future bun path-walk in
    `tools/**` must pass through a dot-aware helper
    or carry the same inline comment.
  revisit-trigger: bun changelog entry altering
    glob defaults OR a tally.ts parity regression.
  owner: architect

- id: ASM-TOOLS-TYPES-BUN-LAG-OK
  statement: DefinitelyTyped's `@types/bun` release
    cadence lags the `bun` runtime by up to one
    patch release, and this lag does not produce
    compile errors under our strict config.
  plain-language: "It's fine for our bun type
    definitions to be one patch behind the bun
    runtime — that's normal and won't break
    compile."
  confidence: medium
  probe: run `bun run tsc --noEmit` against any
    `.ts` script using bun-specific APIs; if the
    compiler rejects a runtime-valid call,
    assumption falsified.
  revisit-trigger: a bun runtime release that
    breaks a surface `@types/bun` had covered, OR
    a `@types/bun` release that goes more than one
    minor version stale relative to bun itself.
  owner: architect

- id: ASM-TOOLS-ESLINT-BUN-LOADER-COMPAT
  statement: ESLint 10.x can load `eslint.config.ts`
    (TypeScript config) natively without a compile
    step when invoked under bun with `--stdin` /
    `--flag unstable_native_nodejs_ts_config`
    equivalent.
  plain-language: "Our ESLint config can be a `.ts`
    file; linting doesn't need a pre-build of the
    config itself."
  confidence: medium
  probe: `bun x eslint --help` + `bun x eslint .`
    against the current `eslint.config.ts`; if the
    parser rejects TypeScript syntax in the config,
    assumption falsified.
  revisit-trigger: ESLint breaking-change note
    about TS config loading, OR a bun-vs-node
    divergence in the loader behaviour.
  owner: architect

- id: ASM-TOOLS-UPSTREAMS-STAY-SIZABLE
  statement: `references/upstreams/` (~13 GB) and
    `tools/lean4/.lake/` (~7 GB) remain the
    performance-critical excludes for every tool
    that walks the tree. The SQLSharp hardening
    shape
    (`defaultRepoPathIgnorePatterns`, doubled root
    + `**/` variants) continues to be necessary.
  plain-language: "Our upstream mirrors and Lean
    build output are huge. Any new tool that reads
    the whole repo must skip those folders or it
    will be painfully slow."
  confidence: high
  probe: `du -sh references/upstreams tools/lean4/.lake`
    at any round-close; if either drops below 1 GB,
    the excludes can relax. Also: any "language
    server is frozen" pain report.
  revisit-trigger: Zeta stops mirroring upstreams
    (unlikely), OR a tool ships that ignores
    exclude lists (TypeScript LSP, eslint, bun's
    Glob all respect them today).
  owner: architect

- id: ASM-TOOLS-MACOS-LINUX-ONLY
  statement: Zeta's maintainers and CI runners are
    macOS or Linux. bun's Windows-from-source
    maturity is not on the critical path.
  plain-language: "Nobody on this project builds
    Zeta on Windows. If that changes, the bun
    decision has to be re-verified."
  confidence: high
  probe: survey `git log --format='%ae' | sort -u`
    vs. maintainer platform inventory; CI runner
    images in `.github/workflows/**`.
  revisit-trigger: any Windows-native-build demand
    from a contributor, OR CI runners shifting to
    include `windows-latest`.
  owner: devops-engineer

- id: ASM-TOOLS-SQLSHARP-TRACKS-LATEST
  statement: SQLSharp (the sibling project) keeps
    its bun+TS toolchain on current-latest pins.
    Zeta inheriting sibling pins as a *starting
    point* (not a conclusion) stays safe so long
    as this holds. Falsified means Zeta's
    latest-version audit becomes more work per
    ADR.
  plain-language: "We lightly trust that SQLSharp
    bumps its pins often. If they let theirs drift,
    we can't use their `package.json` as a
    starting reference anymore — we have to check
    every pin from scratch."
  confidence: medium
  probe: round-close sweep of SQLSharp's
    `package.json` vs. vendor-latest; three
    consecutive rounds of drift falsifies.
  revisit-trigger: SQLSharp freezes pins for a
    long window, OR Zeta discovers a sibling pin
    more than one minor behind latest.
  owner: architect
```

These assumption entries are intentionally in the
shape that the future
`docs/RAILS/ASM-<id>.md` registry will consume
(`project_composite_invariants_single_source_of_truth_across_layers.md`).
Until that registry exists, this inline block is the
single source-of-truth for these assumptions. When
the registry lands, each block becomes one
`docs/RAILS/ASM-<id>.md` file and this section is
replaced with a list of anchor links. The
plain-language field is load-bearing for the
factory-reuse conversational UX
(`project_factory_conversational_bootstrap_two_persona_ux.md`)
— future UX consumers read the plain-language
statement, not the technical one.

## Scaffold sequence

The bun+TS adoption lands as its own round-43 work
item:

1. `package.json` at repo root with `bun` declared as
   package manager, TypeScript as devDep, strict
   linting as devDeps (eslint + prettier matching
   SQLSharp where sensible).
2. `bunfig.toml` + `tsconfig.json` + `eslint.config.ts`
   + `.prettierignore` + `.prettierrc.json` configs —
   **with performance-critical excludes covering
   `references/upstreams/` (~13 GB), `tools/lean4/.lake/`
   (~7 GB), `tools/alloy/`, `tools/tla/`, `.git/`, and
   all `bin/obj/node_modules/BenchmarkDotNet.Artifacts/
   TestResults/artifacts` variants** (see
   "Excludes hardening" section below). SQLSharp
   scaffold lesson: get this wrong and every
   `tsc`/`eslint`/`prettier` invocation walks the
   entire upstream mirror.
3. `tools/automation/invariant-substrates/tally.ts` (or
   `tools/invariant-substrates/tally.ts` — path
   decision when scaffolding) ported from the
   transitional `tally.sh`.
4. `tools/setup/install.sh` extended to install bun
   idempotently (matches the install→ensure rename
   candidate; bun's install script is already
   idempotent on re-run).
5. `docs/TECH-RADAR.md` row added: bun + TypeScript
   for post-setup automation — tier: Adopt (from
   Round 43) — evidence: SQLSharp precedent + Aaron
   personal endorsement + this ADR.
6. `AGENTS.md` tool-stack section updated to declare
   the post-setup scripting default and the
   huge-refactor gate on existing bash scripts.
7. `docs/INVARIANT-SUBSTRATES.md` pointers updated
   when the aggregator moves from `.sh` to `.ts`.

## Latest-version audit — 2026-04-20

Every pin introduced by this adoption was verified
against the registry / vendor latest at ADR time,
per the standing rule
`feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`.
Pins copied verbatim from the sibling `SQLSharp`
`package.json` are treated as candidates, not
conclusions — each was re-verified because
`SQLSharp`'s audit date is not this project's
adoption date.

| package                | pinned | verified latest (2026-04-20) | source                             | action  |
|------------------------|--------|------------------------------|------------------------------------|---------|
| bun (runtime)          | 1.3.13 | 1.3.13                       | `registry.npmjs.org/bun/latest`    | current |
| typescript             | 6.0.3  | 6.0.3                        | `registry.npmjs.org/typescript`    | bumped from SQLSharp's 6.0.2 |
| eslint                 | 10.2.1 | 10.2.1                       | `registry.npmjs.org/eslint`        | bumped from SQLSharp's 10.2.0 |
| typescript-eslint      | 8.59.0 | 8.59.0                       | `registry.npmjs.org/typescript-eslint` | bumped from SQLSharp's 8.58.2 |
| eslint-plugin-sonarjs  | 4.0.3  | 4.0.3                        | `registry.npmjs.org/eslint-plugin-sonarjs` | bumped from SQLSharp's 4.0.2 |
| @eslint/js             | 10.0.1 | 10.0.1                       | `registry.npmjs.org/@eslint/js`    | current |
| prettier               | 3.8.3  | 3.8.3                        | `registry.npmjs.org/prettier`      | bumped from SQLSharp's 3.8.2 |
| prettier-plugin-toml   | 2.0.6  | 2.0.6                        | `registry.npmjs.org/prettier-plugin-toml` | current |
| markdownlint-cli2      | 0.22.0 | 0.22.0                       | `registry.npmjs.org/markdownlint-cli2` | current |
| globals                | 17.5.0 | 17.5.0                       | `registry.npmjs.org/globals`       | current |
| @types/bun             | 1.3.12 | 1.3.12                       | `registry.npmjs.org/@types/bun`    | DefinitelyTyped lags `bun` by 1 patch; typical — exception recorded |
| smol-toml (override)   | 1.6.1  | 1.6.1                        | `registry.npmjs.org/smol-toml`     | current |

**Exceptions:**

- `@types/bun@1.3.12` against `bun@1.3.13` — the
  `@types/bun` package publishes from the
  DefinitelyTyped staging pipeline and typically lags
  `bun` itself by 0-2 patch versions. This exception
  is **permanent with a re-audit cadence of every
  dependency refresh round**. Exit condition: if the
  lag ever exceeds one minor version, escalate.
  Owner: architect.

No other exceptions. Every other pin is current
latest as of audit time.

**Re-audit cadence:** this table is re-run every
5-10 rounds under the same cadence as the dated
internet-best-practices sweep. The standing rule
also promotes the audit from ADR-time-only to
**continuous factory-wide invariant**
(`feedback_latest_version_on_new_tech_adoption_no_legacy_start.md`
was strengthened this same day: *"like make sure
we are using the latest version, that shoud jsut
apply everywhere and you override with exceptions"*).
A dedicated registry at `docs/VERSION-EXCEPTIONS.md`
is filed at P3 backlog as the first rails-health
registry pilot.

## Crank-to-11 audit — 2026-04-20

Per the standing rule
`feedback_crank_to_11_on_new_tech_compile_time_bug_finding.md`,
every new-tech adoption asks: what strictness,
linting, and static-analysis knobs does this
ecosystem expose, and which ones are on?

**TypeScript `tsconfig.json` — every strictness flag
that is off-by-default is turned on:**

| flag                          | value | rationale |
|-------------------------------|-------|-----------|
| `strict`                      | true  | umbrella: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict` |
| `noEmitOnError`               | true  | prevents leaving half-compiled state after a failing build |
| `noImplicitOverride`          | true  | override must be explicit — protects against silent shadowing |
| `noUncheckedIndexedAccess`    | true  | array/record indexing returns `T \| undefined`; the type system surfaces the real nullability |
| `noUnusedLocals`              | true  | dead code is a bug class, not a style nit |
| `noUnusedParameters`          | true  | same |
| `exactOptionalPropertyTypes`  | true  | distinguishes "property is absent" from "property is present and `undefined`" |
| `verbatimModuleSyntax`        | true  | matches bun's per-file erase-semantics; imports stay explicit about value-vs-type |
| `erasableSyntaxOnly`          | true  | matches bun runtime — no TypeScript-specific runtime constructs (enum/namespace) that would require emit |
| `isolatedModules`             | true  | matches bun's per-file compilation model |
| `skipLibCheck`                | true  | standard — lib type errors are noise for application code |

**ESLint — strict superset, not the minimal defaults:**

- `@eslint/js` recommended — baseline.
- `typescript-eslint` **strict-type-checked** AND
  **stylistic-type-checked** — both configs loaded,
  not just the base rules.
- `eslint-plugin-sonarjs` recommended — adds
  code-smell detection on top of `typescript-eslint`.
- `reportUnusedDisableDirectives: "error"` — a
  stale `// eslint-disable-next-line` on a fixed bug
  becomes a lint error. Prevents the "I'll clean up
  the disable comments later" drift.
- `linterOptions.reportUnusedDisableDirectives` at
  error — enforces the above at the linter level.

**Prettier** is loaded for formatting only; not
considered lint (its rules don't overlap eslint's).

**No loosenings recorded.** Per the standing rule,
the burden of proof is on loosening. If any rule
produces >30% false positives in operation, document
in a follow-up ADR appendix and loosen case by case
with rationale.

## Excludes hardening — 2026-04-20

Performance-critical exclude lesson inherited from
`SQLSharp` scaffold hardening, per Aaron's explicit
warning this round: *"make sure to get the exclues
right for bun/typescript or those huge upstreams
folders are gonna kill performance, that happened a
lot until we got it right on sqlsharp."* Zeta's
`references/upstreams/` is ~13 GB across 87 cloned
repos; `tools/lean4/.lake/` is ~7 GB of Lake build
artifacts. Walking those in `tsc`, `eslint`,
`prettier`, or `bun test` turns seconds into
minutes.

**Coverage across all four configuration surfaces:**

- `tsconfig.json` `exclude` — `node_modules`
  (root + `**/`), `.git`, `references/upstreams`,
  every `**/bin/**`, every `**/obj/**`,
  `**/BenchmarkDotNet.Artifacts/**`, `**/TestResults/**`,
  `**/artifacts/**`, `**/.lake/**`,
  `tools/lean4/.lake/**`, `tools/alloy/**`,
  `tools/tla/**`.
- `bunfig.toml` `pathIgnorePatterns` +
  `coveragePathIgnorePatterns` — same set plus
  `**/.git/**`.
- `eslint.config.ts` `ignorePatterns` — same set,
  doubled root-level + `**/` variants for nested
  catches, matching SQLSharp's
  `defaultRepoPathIgnorePatterns` shape.
- `.prettierignore` — same set with `**/` nested
  variants.

Each config carries an inline comment citing the
SQLSharp-hardening lesson so the reason survives
edits.

## Standing architect discipline

This ADR exists because the tally.py landing was
exactly the "accidental debt via new pattern without
explicit decision" miss the architect role is supposed
to catch. Three standing rules are captured as
feedback memory:

- **Prior-art + internet-best-practices checks always
  happen, with cadence re-review** — every new-pattern
  proposal cites (a) what sibling projects do, (b)
  dated internet-best-practices findings. Re-reviewed
  every 5-10 rounds because tech and recommendations
  evolve.
- **Weigh existing-in-repo vs pulling in new tooling.**
  New stuff is welcome when it fills a gap the
  existing stuff doesn't cover or solves it
  meaningfully better. Status-quo wins on tie.
- **Existing-tech interop + huge-refactor gate.** When
  evaluating prior art, weigh how well the candidate
  plays with the existing tech stack (can it call
  existing code directly, or does every boundary need
  a bridge?) and how many existing files would have
  to refactor if adopted. Huge refactors are only
  worth it when the new choice is right for the long
  term; otherwise status-quo wins.

All three rules are recorded in the human maintainer's
auto-memory and surface on every architect-level
pattern decision.

## Terminology note (separate, same round)

While remediating tally.py, the `guess / observed /
verified` confidence triad on `skill.yaml` substrates
is being renamed to `hypothesis / observed / verified`.
`guess` under-sells what a research-grade invariant
substrate is. `hypothesis` reads as a falsifiable
proposition — which is exactly what a pre-evidence
invariant claim is. Sweep across
`docs/INVARIANT-SUBSTRATES.md`, the tally script (in
whatever language it currently is), and
`{prompt-protector, skill-tune-up}/skill.yaml` in this
same round.

## Consequences

- `tally.py` is deleted.
- A transitional `tally.sh` may exist briefly; it
  retires when `tally.ts` + minimal bun scaffold
  lands in a subsequent commit in this same round
  (or early round 44 if scoping pressure is real).
- `docs/INVARIANT-SUBSTRATES.md` points at the
  current tally implementation (`.sh` transitional,
  `.ts` target).
- `docs/BACKLOG.md` carries round-43 rows for: (a)
  bun+TS scaffold work (P1, in-flight), (b) the
  `install-*` → `ensure-*` script-name-honesty
  sweep (P2), (c) the scripts-layer invariant
  substrate candidate (P3).
- Three feedback memories land in the maintainer's
  auto-memory: the prior-art-and-internet-sweep
  rule, the weigh-existing-vs-new rule, and the
  existing-tech-interop + huge-refactor-gate rule.
- Every future architect dispatch that considers a
  new tool / language / framework cites this ADR or
  replaces it.

## Addendum (2026-05-31, triggered revisit): Node = safe cross-harness baseline, Bun = accelerator

**Status:** Proposed — operator (Aaron) + co-maintainer (Max) aligned 2026-05-31; pending
broader product-team ratification per the doctrine-through-agreement discipline. On
acceptance, amend `.claude/rules/rule-0-no-sh-files.md` (proposed text below).

**Trigger:** the watchlist's "node/deno/bun landscape consolidates" revisit-trigger, plus
two independent pulls toward Node — Max wanted Node for other reasons, and cross-harness
portability needs a runtime that is *safe everywhere* (not every harness/CI image ships
Bun; every one ships Node). The Node-24 pin already landed (mise 22→24, "node everywhere
via the single pin; keep bun", #6290).

### The refinement

The 2026-04-20 decision picked **bun + TypeScript** for post-setup tooling. That stays —
the runtime *relationship* is sharpened:

- **Node = the safe cross-harness baseline.** TS tooling must run on Node (present in
  every harness + CI image). Node is what we depend on for portability.
- **Bun = the accelerator.** Bun stays the fast path (fast install, fast `bun test`, fast
  startup) for dev + CI where available. Repositioned from "the host" to "the fast lane,"
  not removed.

Nothing else changes: still TypeScript, still no Python, `.sh` still only for the
pre-setup install-graph, F#/.NET still engine-adjacent. The one new constraint is
**nothing may be Bun-only** — every tool must also run on Node.

### What this requires of TS tooling

| Concern | Status |
|---|---|
| Use `node:` builtins, not Bun-only APIs (`Bun.argv` / `Bun.file` / `Bun.write` / `Bun.Glob` / `Bun.spawn[Sync]` / `Bun.sleep` / `Bun.stdin` / `Bun.$`) | **TARGET, not current state** — a repo search finds **~29 `tools/` files** still on Bun-only APIs (e.g. `tools/dora-classify/cli.ts` `Bun.argv`, `tools/dashboard/generate-metrics.ts` `Bun.write`, the `tools/ci/qemu-*` `Bun.spawnSync`/`Bun.sleep`). The policy *implies migrating* these to `process.argv` / `node:fs` / `node:child_process` / `node:fs.glob` etc. — tracked, not assumed-done (Codex #6293) |
| CLI entry guard `import.meta.main` | **Node 24.2+** supports it (verified; aligns with the Node-24 pin) — runs on both |
| `bun:test` test imports | the accelerator path; for a safe-baseline test run the swap is `node:test` (not required while Bun is in CI/dev) |
| direct `.ts` invocation | Bun runs TS directly; Node 24 type-strips *erasable* TS, but non-erasable constructs (TS `enum`, `namespace`) need `tsx`/a build — verify per tool; Bun stays the simplest direct-run, Node is the portability floor |

### Migration cost (honest — Codex #6293)

The refinement is **not free**: ~29 existing `tools/` files depend on Bun-only runtime
APIs and would need porting to `node:`/`process` equivalents to actually run on the safe
Node baseline. Until they are ported, those specific tools remain Bun-required (they still
*work* — Bun is in CI/dev — they just aren't yet Node-portable). The honest framing for
ratification: this ADR sets the *direction* (new tooling is Node-safe by default; nothing
new may be Bun-only), and the existing-tooling sweep is a **tracked migration** (candidate
backlog row) prioritized by which tools need to run on Node-only harnesses first — not a
big-bang rewrite. The agent-bus (#6283) is the first tool authored to the new convention.

### Proposed Rule-0 refinement (`.claude/rules/rule-0-no-sh-files.md`)

Carved sentence — from:

> TypeScript IS cross-platform DST — deterministic, reproducible, **Bun-hosted.**

to:

> TypeScript IS cross-platform DST — deterministic, reproducible. **Node is the safe
> cross-harness baseline; Bun is the accelerator.** Tooling must *run* on Node (present in
> every harness/CI image); Bun is the fast path where available — **nothing may be
> Bun-only.**

The "run via `bun`" line gains: *"runs on Node (safe baseline) and Bun (accelerator);
prefer `bun` for speed where present, but nothing may be Bun-only."* The
`.sh`-only-for-install-graph rule is unchanged.

### Composes with

* `.claude/rules/rule-0-no-sh-files.md` — the rule this refines (proposed text above)
* `.claude/rules/dep-pin-search-first-authority.md` + the "pin only slow-movers" memory — Node is a slow-mover (LTS cadence) so pinning Node 24 is correct; Bun stays a fast-mover on its own default
* #6290 (mise 22→24, node-everywhere pin — landed) + 081KSGS9H0008QG0R002BC2ZR7 (all-deps current-version sweep)
* the four-language compiler-BFT ADR (2026-05-31) — Node/Bun is the TypeScript runtime leg of the multi-language story
* the agent-bus (081KSXN940008QG0R00171YAZW, #6283) — already Node-safe at the library level (`node:` builtins) with `import.meta.main` CLIs that run on Node 24.2+ — an empirical confirmation the refinement is satisfiable today
