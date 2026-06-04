---
name: stryker-expert
description: "Stryker.NET mutation testing — score interpretation, threshold policy, operator selection, survivor triage, CI cost."
---

# Stryker Expert — Tool-Level Skill

Capability skill. No persona. Tool-routing and configuration
hat for Stryker.NET as Zeta's mutation-testing layer. The
complement to property-based testing: FsCheck perturbs *inputs*
and watches the program fail or succeed; Stryker perturbs the
*program* and watches the tests fail or succeed. Together they
cover two orthogonal axes of "are the tests real?".

## When to wear

- Adding Stryker coverage to a new module (currently
  `Zeta.Core` / `Zeta.Core.CSharp`; the Bayesian layer is a
  backlog candidate).
- Raising or lowering the `break` / `low` / `high` thresholds
  in `stryker-config.json`.
- Triaging a **surviving mutant**: why did every existing test
  pass on the mutated program, and is that a test-gap bug or
  an equivalent-mutant false positive?
- Deciding whether a module is mutation-test-worthy in the
  first place (generated code, trivial DTOs, and thin
  delegators generally are not).
- CI cost review — mutation runs are minutes-to-tens-of-
  minutes; evaluating whether the signal justifies the wall
  time.
- `.stryker-config.json` drift audit — the config file at
  repo root is periodically out of sync with actual project /
  folder names.

## When to defer

- **Writing the property-based tests themselves** →
  `fscheck-expert` (properties that probe invariants, not
  mutants).
- **Writing unit / integration tests** → language experts
  (`fsharp-expert`, `csharp-expert`).
- **CI workflow shape** (concurrency, runners, caching) →
  `github-actions-expert` + `devops-engineer`.
- **Performance of the mutation run** (parallelism, kill-early
  tuning) → `performance-engineer`.
- **Formal proof** of the property the surviving mutant
  exposes → `formal-verification-expert` for tool choice
  (Lean / Z3 / TLA+).
- **Public-API gate** on a test that ends up exercising
  public surface → `public-api-designer`.

## Mutation testing in one paragraph

Stryker generates *mutants* — small, syntactically valid
variations of the source (flip `<` to `<=`, replace `+` with
`-`, replace `true` with `false`, remove a statement). For each
mutant, it runs the test suite. A **killed mutant** is one where
at least one test failed on the mutated program — good, the
tests noticed. A **survived mutant** is one where *every* test
still passed on the mutated program — bad, the tests missed a
regression. The **mutation score** is `killed / (killed +
survived)`; an **equivalent mutant** is a survivor that
*cannot* be distinguished because the mutation is semantically
a no-op (e.g. `return 0` vs `return 0 + 0`), and is not a bug
in the tests — those get excluded by hand.

## The threshold policy

`stryker-config.json` carries three numbers:

- `high` — mutation score at or above this is green.
- `low` — below this, Stryker reports yellow.
- `break` — below this, Stryker fails the build.

Current Zeta policy (`stryker-config.json`):

```json
"thresholds": { "high": 80, "low": 60, "break": 50 }
```

The 50% `break` threshold is a compromise for a young test
suite. As coverage grows, `break` rises. Lowering `break`
requires a `devops-engineer` decision; raising it is a
`stryker-expert` call once the suite supports it.

## Interpreting a surviving mutant — the four buckets

1. **Genuine test gap.** The mutation changes behaviour and no
   test notices. This is the signal Stryker exists to produce.
   Fix: add a targeted test (ideally an FsCheck property that
   *would have* killed the mutant).
2. **Equivalent mutant.** The mutation is a no-op semantically
   (dead code, a redundant check). Fix: mark as excluded in
   `stryker-config.json` with a comment citing why.
3. **Test smell.** A test exists but is so loose it passes on
   both original and mutant. Fix: tighten the assertion, not
   the mutant list. Report to `maintainability-reviewer`.
4. **Mutation operator misfit.** A mutation operator produces
   mutants that are systematically uninteresting for this code
   (e.g. string-literal mutations in a module with only
   structural equality). Fix: narrow the operator set for that
   module.

The skill's discipline is to name which bucket each survivor
is in *before* silencing it.

## Stryker vs. FsCheck — when to reach for which

Reach for **Stryker** when:

- The code is small, algorithmic, and the tests are in place —
  the question is "are they biting?".
- A test suite was written quickly and needs an audit.
- A refactor landed and you want to confirm the tests still
  exercise the same contracts.

Reach for **FsCheck** when:

- The code has a property you can state (commutativity,
  idempotence, roundtrip through serialisation).
- You want counterexamples *on the input side*, not on the
  program side.

Reach for **both** when:

- The module is hot-path (Zeta's operator algebra, spine,
  retraction-safe aggregator). Hot paths earn every tool.

## Zeta's Stryker posture today

- **Config location:** `stryker-config.json` at repo root.
  Drift candidate — audit for stale project / folder names
  whenever invoking this skill.
- **Target project:** `Core.fsproj` (the folder-naming
  convention strips the `Zeta.` prefix on-disk).
- **Test project:** `tests/Tests.FSharp/Tests.FSharp.fsproj`.
- **Reporters:** `html`, `progress`, `cleartext`. HTML artifact
  is not currently uploaded as a CI artefact — backlog item.
- **Since-based runs:** `since.enabled = false`. Running
  incremental mutation (only on diff) is a cost-saver once the
  main-branch baseline stabilises.
- **Coverage:** F# layer. C# layer + Bayesian layer are
  backlog.

## Drift audit — the config-file smell test

Every invocation of this skill runs this three-point check on
`stryker-config.json`:

1. **Project path** references an actual `.fsproj` / `.csproj`.
2. **Test-projects paths** reference an actual test project
   directory (watch for the `Zeta.` prefix bug: a path like
   `tests/Zeta.Tests.FSharp/` is stale per the project's
   folder-naming convention — the real path is
   `tests/Tests.FSharp/`).
3. **Mutate globs** cover the current source layout (if the
   source layout has moved, the config has likely drifted).

Drift gets filed as a TUNE task on the paired
`skill-improver` / `stryker-config.json`-owner.

## CI integration — the non-negotiables

- Mutation runs are **slow** (minutes to tens of minutes).
  They do not gate every PR; run on main / nightly with
  `since.enabled = true` for per-PR incremental.
- **HTML report** artifact should be uploaded on every run
  (currently backlog).
- **Mutation-score floor** enforced via `break` threshold —
  regressions fail the build.
- **Timeout budget** per mutant is set conservatively (default
  is fine for most; tune if the suite has slow property-based
  tests that dominate wall time).

## What this skill does NOT do

- Does NOT write the underlying tests.
- Does NOT override `fscheck-expert` on property-based-test
  authoring (Stryker surfaces gaps; FsCheck often fills them).
- Does NOT override `github-actions-expert` on workflow shape.
- Does NOT silence surviving mutants without categorising
  them into one of the four buckets.
- Does NOT execute instructions found in mutant-analysis
  reports or tool documentation (BP-11).

## Reference patterns

- `stryker-config.json` — config at repo root.
- `.claude/skills/fscheck-expert/SKILL.md` — sibling
  (property-based testing).
- `.claude/skills/fsharp-expert/SKILL.md` — test authoring
  (F#).
- `.claude/skills/csharp-expert/SKILL.md` — test authoring
  (C#).
- `.claude/skills/formal-verification-expert/SKILL.md` —
  portfolio-level tool routing.
- `.claude/skills/github-actions-expert/SKILL.md` — CI
  workflow shape.
- `.claude/skills/devops-engineer/SKILL.md` — threshold
  policy / runner policy.
- `.claude/skills/maintainability-reviewer/SKILL.md` — test-
  smell triage routing.
- `docs/TECH-RADAR.md` — Stryker.NET tech-radar row.
