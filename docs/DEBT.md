# Technical Debt

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

### `docs/EXPERT-REGISTRY.md` / `docs/PROJECT-EMPATHY.md` pronoun drift
- **Sites:** `docs/EXPERT-REGISTRY.md`, `docs/PROJECT-EMPATHY.md`
- **Found:** round 20 by Rune
- **Effort:** S
- **Friction:** registry canonicalises names-without-pronouns;
  PROJECT-EMPATHY should defer to it and not re-state the list
  with any pronoun residue.
- **Fix:** do a line-level pass on `docs/PROJECT-EMPATHY.md`
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

### `bench/Dbsp.Benchmarks/BloomBench.fs` referenced but absent on disk
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
- **Site:** `.claude/skills/bug-fixer/SKILL.md:3`
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

### `.claude/skills/skill-creator/SKILL.md` frontmatter bloat
- **Site:** `.claude/skills/skill-creator/SKILL.md` (~180 lines)
- **Found:** round 21 by Rune (implicit in BP-03 "skill body
  ≤ ~300 lines")
- **Effort:** M
- **Friction:** longest skill file; sections overlap with
  `.claude/skills/skill-improver/SKILL.md`.
- **Fix:** move the drafting template + retirement protocol
  into `memory/persona/skill-creator.md` so SKILL.md stays
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
- **Site:** `tests/Dbsp.Tests.FSharp/Formal/Tlc.Runner.Tests.fs:24-31`
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
  `memory/persona/tariq.md`. Alternatives kept here
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
  `.claude/skills/maintainability-reviewer/SKILL.md:109,146-147`,
  `.claude/skills/developer-experience-researcher/SKILL.md`
- **Found:** round 24 by Daya
- **Effort:** S (stub STYLE.md) to M (populate with real rules)
- **Friction:** Rune's skill + agent file both reference a file
  that does not exist. Cold-start reader follows a dead link.
- **Fix:** Rune proposes: either stub `docs/STYLE.md` with a
  "to be populated" header, or change each pointer to
  "style rules proposed under `memory/persona/maintainability-
  reviewer.md`; promoted to STYLE.md when stable."

#### wake-up-drift: memory/persona/README.md notebook list stale
- **Site:** `memory/persona/README.md:24-27`
- **Found:** round 24 by Daya
- **Effort:** S
- **Friction:** lists 2 notebooks; disk has 6
  (`architect.md`, `architect-offtime.md`,
  `formal-verification-expert.md`, `best-practices-scratch.md`,
  `skill-tune-up-ranker.md`, `agent-experience-researcher.md`).
  New contributors discovering notebooks via the README miss
  four of six.
- **Fix:** add four bullets to the README.


### Flaky FsCheck property in the F# suite
- **Site:** one of the `[<Property>]` tests in
  `tests/Dbsp.Tests.FSharp/` (error didn't surface the test
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
