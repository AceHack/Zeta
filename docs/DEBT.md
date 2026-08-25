# Technical Debt — live ledger

*This file is the **live ledger** of accidental / unintentional
technical-debt entries. For the factory-shipped operator
manual — what debt IS, the full class taxonomy, how the
factory automates discovery and fixes, and how this doubles
as AI instructions — see
[`docs/TECH-DEBT.md`](TECH-DEBT.md) (factory primer) and
[`docs/SYSTEM-UNDER-TEST-TECH-DEBT.md`](SYSTEM-UNDER-TEST-TECH-DEBT.md)
(Zeta-specific variant). Both new docs cite entries from this
ledger as examples; this ledger stays authoritative for
current state.*

Counterpart to `docs/BUGS.md`. The distinction:

- **`docs/BUGS.md`** — things that are *broken or misleading* in
  shipped code or docs. Fix or it stays wrong. A bug entry
  points at a correctness, security, or honesty failure.
- **`docs/DEBT.md`** — things that are *working but in the wrong
  shape*. Readability, maintainability, naming, docstring
  drift, stale references, dead-simple-but-not-done cleanup.
  A debt entry points at a friction cost, not a correctness
  failure. Left unfixed, debt compounds but doesn't lie to
  users.

Both files read **current-state**. When an entry is resolved,
delete it entirely; the narrative goes to `docs/ROUND-HISTORY.md`.
When work on a debt item gets big enough to warrant a feature
effort, move it to `docs/BACKLOG.md` instead.

## Format

```markdown
### <short title>
- **Site:** `file:line` or `<area>`
- **Found:** <round> by <reviewer name>
- **Effort:** S | M | L
- **Friction:** one sentence — who gets slowed down
- **Fix:** one sentence — what to do
```

No severity column (that's bugs). Debt has *effort* instead —
how big a rewrite it is. Kenji picks debt items to knock down
in "build rounds" (see GOVERNANCE.md §12: low bug count → high
feature + debt budget).

---

## Live debt

### `tools/setup/` script organisation less rich than `../scratch`

- **Site:** `tools/setup/` vs `../scratch/scripts/setup/`
- **Found:** round 34 by Aaron — "our script orginization feels
  inadcuate compard to ../scratch, that is the feature richness
  i am looking for eventually here so it's easy to add other
  packages and languages and it's very very very clean"
- **Effort:** L (multi-round). `../scratch/scripts/setup/` is
  ~2,559 lines across unix/linux/macos/ubuntu/debian/windows
  layers; Zeta's is ~250. 10× gap.
- **Friction:** adding a new package type or language runtime
  today means hand-editing `linux.sh` + `macos.sh` + a new
  `common/` script. Scratch's structure makes the same change
  a single file drop in the right declarative dir.
- **Fix:** study `../scratch/scripts/setup/` and incrementally
  port the layering (unix-common + os-specific overlays +
  github-env helpers + profile management + `append_line_if_missing`
  discipline for dotfiles + bash/zsh rc handling). Round-by-round
  ratchet alongside declarative-manifest tiering.

### Shell-profile management is thin vs `../scratch`

- **Site:** `tools/setup/common/shellenv.sh` + user dotfile
  integration
- **Found:** round 34 by Aaron — "they even setup all the bash
  profiles and zsh and all that, you should check my zsh
  profiles are okay on my mac too for all this to work"
- **Effort:** M
- **Friction:** Zeta's shellenv.sh writes `$HOME/.config/zeta/
  shellenv.sh` + emits `BASH_ENV` for CI, but relies on the
  user manually adding the source line to `.zshrc` / `.bash_profile`
  (one-line hint). Scratch auto-appends via `append_unique_line`
  to `.bashrc`/`.bash_profile`/`.profile`/`.zshrc`/`.zprofile`
  with idempotency. Round 34 manually appended Aaron's profiles;
  should be automatic going forward.
- **Fix:** port scratch's profile-management helpers
  (`append_bootstrap_shellenv_line`, `ensure_shell_startup_sources_bootstrap_shellenv`,
  `ensure_bash_env_sources_bootstrap_shellenv`) to
  `tools/setup/common/`. Auto-append on install.sh run;
  detect+skip if already present.

### Semgrep rule 2 `plain-tick-increment` — four `nosemgrep` suppressions

- **Site:** `src/Core/FSharpApi.fs:160,168`, `src/Core/LawRunner.fs:131,189`, `src/Core/PluginHarness.fs:77`
- **Found:** round 30 close — first-ever `gate.yml` `lint` run under `--error` exposed the rule never ran before; real bug at `Circuit.fs:209` fixed in-round, remaining four sites are method-local loop counters suppressed with `// nosemgrep: plain-tick-increment -- method-local loop counter, not shared across threads`.
- **Effort:** S
- **Friction:** rule over-triggers on any `tick <- tick + 1` regardless of scope. Every future method-local counter will either get an inline suppression (noise) or sharpen the rule once.
- **Fix:** sharpen rule 2 to match only `let mutable tick = 0L` at class/module scope (not `let mutable tick = 0` inside a method body). Either via `metavariable-comparison` + class-scope anchor, or by switching the rule to a proper F# parser plugin when `languages: [fsharp]` matures in Semgrep.

### Semgrep rules self-match on `.semgrep.yml` + teaching files

- **Site:** `.semgrep.yml` rule 2 + rule 8 `paths.exclude`
- **Found:** round 30 close — the rules' own pattern literals matched themselves; excluded `.semgrep.yml` + `.claude/**` as a shortcut.
- **Effort:** S
- **Friction:** any new rule that uses a literal antipattern in its `pattern:` block will silently self-match unless the author remembers to add the same exclude. Scales poorly.
- **Fix:** global `paths.exclude` block at the top of `.semgrep.yml` OR `.semgrepignore` file at repo root with `/.semgrep.yml` + `/.claude/skills/**`.

### Stale path `src/Zeta.Core/**` in two Semgrep rules

- **Site:** `.semgrep.yml` rules 1 + 9 — previously `paths.include: "src/Zeta.Core/**/*.fs"`, now corrected to `"src/Core/**/*.fs"`.
- **Found:** round 30 close — `feedback_folder_naming_convention` sweep missed these two stale includes; corrected in-round.
- **Effort:** S — already fixed this round; leave as a marker that the folder-naming rename's sweep missed `.semgrep.yml` when it ran.
- **Friction:** effectively none going forward; remove this entry next round.
- **Fix:** delete this entry in round 31 close.

### `TlcRunnerTests` was pointing at `docs/` for spec files

- **Site:** `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs` — `docsPath` → `specsPath` (`tools/tla/specs/`) in round 30 close.
- **Found:** round 30 close — `gate.yml` failure log exposed 9 TLC tests failing because `.tla` files live under `tools/tla/specs/` not `docs/`, and the test also hard-failed when the jar was absent.
- **Effort:** S — fixed in-round (path + Alloy-style `toolchainReady` skip pattern).
- **Friction:** new TLA+ spec authors might copy the old `docs/` convention from git blame. Low risk; delete this entry next round.
- **Fix:** delete this entry in round 31 close.

### CI parity-swap — `gate.yml` runs `actions/setup-dotnet` not `tools/setup/install.sh`

- **Site:** `.github/workflows/gate.yml:54-57`
- **Found:** round 29 (original landing) — explicitly flagged in the workflow header comment as temporary; exposed again in round 30 close when `TlcRunnerTests` couldn't find the TLC jar on CI runners.
- **Effort:** M
- **Friction:** three-way parity is two-legged until this closes. Any toolchain component installed only by `install.sh` (TLC jar, Alloy jar, Lean toolchain) is invisible to CI; tests that need them skip rather than validate. Today that's the TLC + Alloy suite; tomorrow it bites the first spec that materially enforces a design.
- **Fix:** replace the `setup-dotnet` step with `./tools/setup/install.sh`; gate on `mise trust` CI hardening (round-31 Track B item 4 open-question: allow-list schema vs diff-vs-main vs require human review on any `.mise.toml` change).

### Verifier-jar SHA-256 pinning (round-30 → round-31)

- **Site:** `tools/setup/common/verifiers.sh` + `tools/setup/manifests/verifiers`
- **Found:** round 30 — elevation design doc deferred this to round 31 per Aaron's "accept today, improve over time" TOFU stance
- **Effort:** S
- **Friction:** TOFU on first-use means a DNS-spoof or upstream-account-compromise at the moment of install becomes permanently trusted. Acceptable residual risk today, but concrete gradient step to close the gap exists.
- **Fix:** extend manifest format to `<path> <url> <sha256>`; have `verifiers.sh` compute SHA after download and error-out on mismatch. Re-verify on re-fetch.

### Safety-clause-diff lint on `.claude/skills/**/SKILL.md`

- **Site:** `.semgrep.yml` rule 16 (stubbed, deferred)
- **Found:** round 30 — elevation design called for this; Semgrep generic-mode regex can't cleanly express "file lacks any of these headings"
- **Effort:** M
- **Friction:** XZ-class long-game adversary regresses safety clauses over many PRs; INCIDENT-PLAYBOOK Playbook E assumes we can detect this, but the detector doesn't exist
- **Fix:** bespoke diff-level lint that detects section removal / shrinkage on skill SKILL.md files. Can be a small .NET tool or a jq-over-git-diff script; wire into CI.

### Install-script P1 follow-ups from round-29 harsh-critic review

- **Site:** `tools/setup/common/{shellenv,dotnet-tools,macos,linux,mise}.sh`, `.github/workflows/gate.yml`
- **Found:** round 29 by `harsh-critic`
- **Effort:** S
- **Friction:** five P1s surfaced in the round-29 review that didn't block ship but leave rough edges. (1) `shellenv.sh` claims cross-machine stable output in its header comment — false when `brew` resolves to different absolute paths on Intel vs Apple-Silicon Macs. (2) `gate.yml` concurrency group collapses `workflow_dispatch` onto `refs/heads/main` — manual triage serialises behind PR-less main traffic. (3) `macos.sh` `xcode-select --install || true` silently continues into brew on a fresh dev laptop where CLT is missing and the GUI confirmation is pending. (4) `dotnet-tools.sh` `update -g … >/dev/null 2>&1 || true` swallows every failure including "version not found"; claims "updated if possible" regardless. (5) `linux.sh` `grep -vE '^(#|$)'` passes inline-comment manifest lines (`pkg # reason`) verbatim to `apt-get install`. Brew batch-install vs per-package loop is a cost hit, not correctness.
- **Fix:** per-finding edits per the review; no single sweep. Tracked here so `maintainability-reviewer` can pick them up in a tune-up round.

### CI gate swap requires `mise trust` hardening first

- **Site:** `tools/setup/common/mise.sh`
- **Found:** round 29 by `security-researcher`
- **Effort:** S
- **Friction:** `.mise.toml` supports `[env]` / hook directives that can execute arbitrary commands during `mise install`. The script currently runs `mise trust "$REPO_ROOT/.mise.toml"` unconditionally. Today `gate.yml` uses `actions/setup-dotnet` so CI isn't exposed — but the GOVERNANCE §24 backlog item "Parity swap: CI's `actions/setup-dotnet` → `tools/setup/install.sh`" lands this attack path in CI the moment the swap happens.
- **Fix:** before the parity swap: in CI mode, gate `mise trust` on `.mise.toml` being unchanged vs `main` (or on an allow-list schema that rejects `[env]`/hooks). Block the swap on this fix.

### Skill-file prose polish after GOVERNANCE §27 sweep

- **Site:** `.claude/skills/**/SKILL.md`
- **Found:** round 29 during persona→role sweep for GOVERNANCE §27
- **Effort:** S
- **Friction:** Mechanical sed swept `Persona (role)` → `role` but left awkward prose like "the `role` (role)" duplications, "the `role`'s" with gratuitous backticks, and occasional "the `role`" where bare role name would read cleaner. The abstraction principle is correctly applied — skills reference roles, not personas — but the prose is choppy.
- **Fix:** `maintainability-reviewer` pass across `.claude/skills/**/SKILL.md` to polish the prose: collapse tautologies, drop unnecessary backticks on bare role mentions, soften "the `role`" to "role" where grammar allows. Run `skill-tune-up` cadence-check afterward to verify no semantic drift.

### `LawRunner.check*` takes 8-11 positional args — promote to config record

- **Site:** `src/Core/LawRunner.fs`
- **Found:** round 28 by Rune (maintainability-reviewer)
- **Effort:** S
- **Friction:** call sites stack integer literals with trailing `// seed` / `// samples` comments; the next law (`checkBilinear`) will need 10+ positionals and multiply the drift surface.
- **Fix:** introduce `LinearityConfig<'TIn,'TOut>` / `RetractionConfig<'TIn,'TOut>` records and take one argument. Do it before `checkBilinear` lands.

### `LawViolation.Message` is a string — promote to a structured DU

- **Site:** `src/Core/LawRunner.fs`
- **Found:** round 28 by Kira (harsh-critic)
- **Effort:** S
- **Friction:** tests string-grep on `"Linearity broke"` / `"Retraction incomplete"`; downstream tooling can't pattern-match on cause.
- **Fix:** `type Reason = LinearityBreak of tick:int | RetractionResidual of count:int | BadArgs of string`; keep `Message` as a rendering helper.

### `LawRunner` has no test covering operators that omit the marker tag

- **Site:** `tests/Tests.FSharp/Plugin/LawRunner.Tests.fs`
- **Found:** round 28 by Kira (harsh-critic)
- **Effort:** S
- **Friction:** law runner claims to verify the tag; no test proves the runner doesn't secretly rely on the tag to compile-time dispatch.
- **Fix:** add a fixture that implements `IOperator<_>` directly (no `ILinearOperator` tag) and confirm `checkLinear` runs against it.

### `Op<'T>` implicitly publicised as a plugin subclass-extension point

- **Site:** `src/Core/Circuit.fs` (`Op`, `Op<'T>`) and every subtype under
  `src/Core/Operators.fs`
- **Found:** public-api-designer (Ilyana) first review
- **Effort:** L
- **Friction:** `Circuit.RegisterStream<'T>` accepts `Op<'T>` as a
  parameter, which makes every abstract/virtual member on `Op` and
  `Op<'T>` (`StepAsync`, `Inputs`, `IsStrict`, `Fixedpoint`, `IsAsync`,
  `SetValue`, `.Value` setter) a forever plugin contract — none of
  which were designed as external extension points. Plugin authors
  get no harness to verify their implementations.
- **Fix:** design a narrow plugin-author surface — either an explicit
  `IOperator<'T>` interface Zeta implements, or a builder
  `Circuit.Extend(input, factory)` that constructs the op from a
  closure — and migrate `Zeta.Bayesian` to it. Deprecate direct
  `Op<'T>` subclass registration for external callers. Gate via
  public-api-designer review. Round-26+ work.

### "Round-N fix" historical-voice survivors in source docstrings

- **Sites:** `src/Core/FastCdc.fs:68`, `Residuated.fs:39`,
  `Durability.fs:17`, `Durability.fs:33`, `Recursive.fs:211`,
  `FeatureFlags.fs:43`
- **Found:** round 20 by Rune
- **Effort:** S
- **Friction:** new contributors read "Round-N fix" in a current-
  state file and don't know whether they should trust the present
  claim or hunt for the historical context.
- **Fix:** rewrite each as a present-tense description of the
  invariant; if historical context is worth preserving, put it
  in `docs/ROUND-HISTORY.md` under the round it happened.

### `docs/EXPERT-REGISTRY.md` / `docs/CONFLICT-RESOLUTION.md` pronoun drift

- **Sites:** `docs/EXPERT-REGISTRY.md`, `docs/CONFLICT-RESOLUTION.md`
- **Found:** round 20 by Rune
- **Effort:** S
- **Friction:** registry canonicalises names-without-pronouns;
  CONFLICT-RESOLUTION should defer to it and not re-state the list
  with any pronoun residue.
- **Fix:** do a line-level pass on `docs/CONFLICT-RESOLUTION.md`
  and swap any residual pronoun-declaring phrasing for
  "see `docs/EXPERT-REGISTRY.md`."

### Durability.createBackingStore `invalidOp` message spans 6 lines of prose

- **Site:** `src/Core/Durability.fs:166-174`
- **Found:** round 21 by Kira
- **Effort:** S
- **Friction:** log-grep wraps the message badly; callers can't
  match on a stable prefix; no error code.
- **Fix:** one-line message pointing at `docs/FEATURE-FLAGS.md`.
  Optional upgrade: add a `DbspError.WitnessDurablePreview`
  case so callers can pattern-match instead of string-match.

### `bench/Benchmarks/BloomBench.fs` referenced but absent on disk

- **Site:** referenced in `docs/BUGS.md`, `docs/research/bloom-filter-frontier.md`, `docs/TECH-RADAR.md`
- **Found:** round 21 by Imani
- **Effort:** S (remove refs) to M (ship the bench)
- **Friction:** documented-but-absent bench; the TECH-RADAR
  Bloom row is stuck at Trial until numbers exist.
- **Fix:** either write the bench file (BenchmarkDotNet
  scaffold for `BlockedBloomFilter.Add/MayContain`,
  `CountingBloomFilter.Add/Remove/MayContain`, measured FPR at
  n=10k/100k) or remove the three references. Shipping the
  bench is the higher-value path because it unblocks the radar
  promotion.

### "bug-fixer description has an unprovable claim" (Kira nit)

- **Site:** `.claude/skills/workflows/blueprints/bug-fixer.md:3`
- **Found:** round 21 by Kira
- **Effort:** S
- **Friction:** description says "no bug-fixer expert persona
  exists so no specialist tempted toward a quick hack can
  write the fix" — clever framing, but unprovable; BP-01 says
  descriptions should be keyword-rich routing hints, not
  op-eds.
- **Fix:** tighten to one sentence: "Procedural skill for
  turning a `docs/BUGS.md` entry into a landed fix. Invoked
  by the Architect (Kenji). No persona."

### `.claude/skills/skill-lifecycle/blueprints/skill-creator.md` frontmatter bloat

- **Site:** `.claude/skills/skill-lifecycle/blueprints/skill-creator.md` (~180 lines)
- **Found:** round 21 by Rune (implicit in BP-03 "skill body
  ≤ ~300 lines")
- **Effort:** M
- **Friction:** longest skill file; sections overlap with
  `.claude/skills/skill-lifecycle/blueprints/skill-improver.md`.
- **Fix:** move the drafting template + retirement protocol
  into `memory/<persona>/skill-creator.md` so SKILL.md stays
  lean. Acceptable alternative: keep, and exempt the
  meta-skill from BP-03 in a one-line note.

### CLAUDE.md duplicates commands that live in CONTRIBUTING.md

- **Site:** `CLAUDE.md:54`
- **Found:** round 21 by Rune
- **Effort:** S
- **Friction:** command drift risk; every `dotnet build` phrasing
  has to match everywhere.
- **Fix:** replace inline `dotnet build -c Release` in CLAUDE.md
  with a pointer to `CONTRIBUTING.md#local-validation`.

### `.github/PULL_REQUEST_TEMPLATE.md` missing a Feature-Flag checkbox

- **Site:** `.github/PULL_REQUEST_TEMPLATE.md`
- **Found:** round 21 by Rune
- **Effort:** S
- **Friction:** PRs that add a research-preview gate don't
  trigger a review of `docs/FEATURE-FLAGS.md`.
- **Fix:** add a checkbox — "If this PR adds or changes a
  feature flag, `docs/FEATURE-FLAGS.md` is updated."

### TlcRunnerTests `repoRoot` lookup CWD-brittle

- **Site:** `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs:24-31`
- **Found:** round 22 by Kenji — full-solution `dotnet test`
  occasionally lands with a CWD outside the repo, walk-up never
  finds `Zeta.sln`, every TLC-runner test throws at module init.
- **Effort:** S
- **Friction:** test ordering / harness-level CWD flips can
  fail all 7 TLC-runner tests at once in the same run that the
  per-project invocation passes. Non-deterministic red CI.
- **Fix:** replace the CWD walk with an `AppContext.BaseDirectory`
  walk, or pass the repo root in via an environment variable set
  by the runner script, or hard-code a relative ascent count
  from the test-assembly location. Any fix that doesn't depend
  on CWD.

### BloomFilter.pairOfString hashes UTF-16 bytes, not UTF-8

- **Site:** `src/Core/BloomFilter.fs` — `BloomHash.pairOfString`
- **Found:** round 22 by the bug-fix agent
- **Effort:** S
- **Friction:** the zero-alloc path uses
  `MemoryMarshal.AsBytes(ReadOnlySpan<char>)` which surfaces
  UTF-16 LE raw bytes, not UTF-8. No persistence or cross-
  process cross-validation of Bloom hashes exists today, so the
  behaviour is safe **within a process**. If a future feature
  persists or distributes Bloom state, this silently breaks
  compatibility.
- **Fix:** either document "process-local only" explicitly on
  `CountingBloomFilter` / `BlockedBloomFilter` *or* restore
  UTF-8 byte hashing without allocation using
  `Encoding.UTF8.GetMaxByteCount` + `NativePtr.stackalloc` +
  `Encoding.UTF8.GetBytes(ReadOnlySpan<char>, Span<byte>)`.
  Prefer the latter the first time anyone asks for persistence.

### Lean `IsLinear` predicate too weak for B2 (`linear_commute_zInv`)

- **Site:** `tools/lean4/Lean4/DbspChainRule.lean` §Linearity +
  §Bilinearity sub-lemma `linear_commute_zInv`
- **Found:** round 24 by the Mathlib-closure subagent (during
  T3/T4/B2 closure pass)
- **Effort:** S (pick one option) to M (formalise the stronger
  predicate + re-prove B3 as corollary)
- **Friction:** current `IsLinear` bundles only `map_zero` +
  `map_add` at the stream level. Insufficient to derive
  `f (z-inv s) n = z-inv (f s) n`: at `n = 0` the goal needs
  `f` applied to a non-zero stream at tick 0 to vanish, which
  `map_zero` does not provide; at `n = k+1` the goal needs a
  shift-commutation axiom. The Lean predicate is the
  `AddMonoidHom` slice only; DBSP linearity (Budiu et al. §3.1)
  is additive **and** time-invariant **and** causal. Blocks
  closure of B2, B3, and the full chain rule.
- **Fix:** Tariq's round-26 review picked **option (c) — roll
  `IsDbspLinear` bundling a per-tick `AddMonoidHom` family
  `phi_n : (Fin (n+1) -> G) ->+ H` plus a `pointwise` witness
  that `f s n = phi n (prefix)`.** Rationale: (c) models
  exactly what Zeta operators already satisfy
  (pointwise-at-each-tick, retraction-native); (a) causality
  alone still fails at `n = 0`; (b) shift-commutation
  axiomatises the statement being proven. B2 closes as a
  direct witness application, B3 via `AddMonoidHom.map_sub`,
  B1 via `AddMonoidHom.map_sum`. Estimate half-day to close
  B2, two days for full chain rule. Implementation deferred
  to a dedicated algebra-proof round. Full review at
  `memory/tariq/NOTEBOOK.md`. Alternatives kept here
  as rejected:
  (a) add causality (`f s n` depends only on `s 0 .. s n`);
  (b) add explicit shift-commutation as an axiom
  (`f . z-inv = z-inv . f`); (c) pointwise action
  (`f s n = phi_n (s 0 .. s n)` for per-tick `AddMonoidHom`s).
  (a) is the most general but fails at n=0; (b) cleanest for
  the chain-rule proof but essentially assumes the answer;
  (c) is the most
  explicit model.

### Wake-up-drift category — AX audit findings (Daya)

Entries under the `wake-up-drift` tag defined in
`docs/WAKE-UP.md:11`. Category kept open for future AX audits.

#### wake-up-drift: STYLE.md referenced 3x but absent

- **Site:** `.claude/agents/maintainability-reviewer.md:68,104`,
  `.claude/skills/code-review-and-quality/blueprints/maintainability-reviewer.md:109,146-147`,
  `.claude/skills/experience-and-product/blueprints/developer-experience-engineer.md`
- **Found:** round 24 by Daya
- **Effort:** S (stub STYLE.md) to M (populate with real rules)
- **Friction:** Rune's skill + agent file both reference a file
  that does not exist. Cold-start reader follows a dead link.
- **Fix:** Rune proposes: either stub `docs/STYLE.md` with a
  "to be populated" header, or change each pointer to
  "style rules proposed under `memory/<persona>/maintainability-
  reviewer.md`; promoted to STYLE.md when stable."

#### wake-up-drift: memory/<persona>/README.md notebook list stale

- **Site:** `memory/<persona>/README.md:24-27`
- **Found:** round 24 by Daya
- **Effort:** S
- **Friction:** lists 2 notebooks; disk has 6
  (`architect.md`, `architect-offtime.md`,
  `formal-verification-expert.md`, `best-practices-scratch.md`,
  `skill-tune-up.md`, `agent-experience-engineer.md`).
  New contributors discovering notebooks via the README miss
  four of six.
- **Fix:** add four bullets to the README.

### Flaky FsCheck property in the F# suite

- **Site:** one of the `[<Property>]` tests in
  `tests/Tests.FSharp/` (error didn't surface the test
  name; seeds `(5370856837815825128,13581531945998878741)` and
  `(2518361587550814727,17790701944329487187,23)` reproduce).
- **Found:** round 22 by Kenji during build gate; second run
  green with a different seed
- **Effort:** S (investigate) / M (fix root cause if real)
- **Friction:** red-green-red flakiness hides real regressions.
- **Fix:** identify the property from the seed, either fix the
  counter-example (real bug → moves to BUGS.md) or pin the
  seed if the property is inherently probabilistic (e.g., an
  FPR assertion). Flakiness is not acceptable long-term.

---

## What doesn't belong here

- Correctness bugs → `docs/BUGS.md`
- Security findings → `docs/BUGS.md` (P0 security)
- Features we haven't built yet → `docs/BACKLOG.md`
- Research directions → `docs/BACKLOG.md` §Research projects
- Architecture decisions (closed) → `docs/DECISIONS/`

If an entry here grows to 500+ lines of work, it's a feature;
move it to BACKLOG and delete from here.

## Current-round entry rule

When a reviewer finding is classified:

- **Breaks something** (wrong output, missed race, false FPR) → BUGS.md
- **Dishonest docstring / spec drift** → BUGS.md (honesty is correctness)
- **Cosmetic, naming, dead-reference, split-me-up** → DEBT.md
- **Not yet started, real feature** → BACKLOG.md

When in doubt, put it in DEBT. Migration out of DEBT is cheap;
migration out of BACKLOG is not.
