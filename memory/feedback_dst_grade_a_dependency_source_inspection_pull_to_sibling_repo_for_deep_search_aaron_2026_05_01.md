---
name: DST grade-A — when non-determinism can't be tracked, inspect dependency source code (pull to ../sibling repo if needed) (Aaron 2026-05-01)
description: Aaron 2026-05-01 — DST extension. When you have a non-deterministic bug you can't track down, the right move is NOT to accept the non-determinism but to inspect the source code of all dependencies involved, even pulling them down to `../sibling repo` for deep search. DST should hold; pursuing dependency-source-level investigation is what makes us **grade A DST**, not just "we have DST." Composes with Otto-272 DST-everywhere, Otto-281 DST-exempt-is-deferred-bug, retries-are-non-determinism-smell-investigate-first (2026-04-23), pinned-seeds-are-DST-resolution (2026-04-23), reproducibility-first-is-precondition-for-amortization (PR #1116).
type: feedback
---

# DST grade-A — dependency source inspection as the not-giving-up move

## Aaron 2026-05-01 verbatim

> *"DST extension, if you are havibng a non-deterministic bug
> you can't track down, look at the source code of all the
> dependencies involved, even pull it down ../sibling repo if
> you need to search it deeply. DST should hodl and we become
> grade A DST."*

## What this codifies

**The discipline-extending claim**: when DST appears to fail
(non-deterministic bug you can't track down), the right move is
NOT to declare the bug "DST-exempt" or to accept retries as a
solution. Instead:

1. **DST should hold** — that's the assertion, not the question.
2. **Inspect dependency source code** — every dependency
   involved in the non-deterministic path is a candidate cause.
   Read their source.
3. **Pull dependencies down to `../sibling repo`** if needed —
   the depth of inspection should be unconstrained by package-
   manager opacity.
4. **By pursuing this discipline, we become grade A DST** —
   not just "we have DST" but "DST is rigorous all the way
   down."

## Why this matters — the discipline-target named

There are two operational-postures toward non-determinism in
testing:

- **Grade B / lazy DST**: when a test flakes, declare it
  "non-deterministic," add a retry-N config, move on. The
  flake remains; the non-determinism is unaccounted for; the
  retry papers over the bug.
- **Grade A DST** (Aaron's discipline target): when a test
  flakes or reproduces non-deterministically, treat it as a
  bug-to-investigate-not-bug-to-accept. Trace the cause
  through every dependency layer. Read source. Pull repos.
  Find the seed of non-determinism (unpinned RNG, system-time
  read, threading non-determinism, IO ordering) and either
  pin it or expose it as a parameter.

Grade A DST is **DST that doesn't surrender** — DST that
escalates investigation rather than accepting the failure
mode. Aaron's *"DST should hodl"* is the carved sentence
(typo intentional and preserved per Glass Halo + Otto-231
first-party-content; "hodl" is also a Bitcoin-culture
intentional misspelling that semantically aligns).

## Operational protocol — the dependency-source-inspection step

When a non-deterministic bug surfaces and the obvious
root-causes (seeds, time, IO, threading) don't account for it:

1. **List all dependencies on the failing path.** Direct deps
   from `*.fsproj` / `package.json` / `Cargo.toml` / etc.
   Transitive deps via `dotnet list package --include-transitive`
   or equivalent.
2. **Identify which dependencies could plausibly contribute
   non-determinism.** Anything that wraps RNG, time, threading,
   IO, network, or is itself a state machine.
3. **Read the candidate source.** Most package managers expose
   repository URLs and SourceLink debug info. For .NET:
   resolve the repo URL via `nuget.org` package metadata
   or via SourceLink (debugger steps directly into the
   dependency source); decompile via ILSpy / dnSpy / dotPeek
   when source isn't published. For npm: `npm view <pkg>
   repository` for the repo URL; for `pip`: the package's
   PyPI page or `pip show <pkg>` lists Home-page; for cargo:
   `cargo metadata --format-version=1` or `crates.io` metadata.
   The discipline is generic (find the source); the specific
   tooling is per-ecosystem.
4. **If the public source is insufficient**, pull the dependency
   down to `../sibling repo` for deep inspection. Aaron's
   pattern: clone the dep alongside the project (not inside),
   so you can grep / read / debug without polluting the
   project's working tree.
5. **Find the seed of non-determinism.** Once located, either:
   - Pin it (configure the dependency to use a deterministic
     source; e.g., inject a fixed RNG or deterministic clock)
   - Wrap it (introduce a thin abstraction that makes the
     non-determinism explicit and pinnable in tests)
   - Replace it (if the dependency is fundamentally non-
     deterministic with no parameterization escape, find an
     alternative or vendor the deterministic-equivalent)
6. **Document the find** as a memory or BP-NN candidate, so
   the next non-determinism in the same dependency is a
   30-second look-up rather than a 2-hour investigation.

## What this is NOT

- **Not "DST is optional."** The opposite: DST holds, period.
  Grade A DST is "DST holds even when investigation is
  expensive."
- **Not "vendor every dependency."** Pulling to `../sibling
  repo` is for investigation, not for bypassing the dependency.
  The fix lands as a configuration / wrapper / replacement,
  not as a vendored fork (unless the dep is unmaintained and
  the fix has to live somewhere).
- **Not "always pull source."** The pull-to-sibling step is
  the escalation when public source / package-manager source
  is insufficient. Most non-determinism root-causes are
  visible in package source without needing the sibling-
  repo pull.
- **Not a license to extend timelines.** The discipline says
  "investigate the dependency"; it does not say "block the
  factory until the investigation completes." Investigations
  proceed in parallel with other work; the bug is documented
  as `DST-grade-A pending` until found.

## Mechanization — DST-deviation as a meta-checkable class

Aaron 2026-05-01 (follow-up):

> *"the dst rule is a class that can be checked/metachecked by
> our PR review agents too"*

The DST-grade-A discipline is **mechanizable as a class** that
PR review agents (Copilot, Codex, harsh-critic, etc.) can
check. The class signature:

- **Trigger**: any commit / diff that adds `DST-exempt`,
  `// flake-retry`, `// non-deterministic`, `[Retry(N)]`, or
  similar annotations to a test or runtime path.
- **Required evidence**: a citation (memory file, commit, ADR,
  GitHub comment) demonstrating that dependency source was
  inspected and the non-determinism was either (a) found and
  named, or (b) traced to a fundamental property requiring
  this exemption.
- **Failure mode** (what the class flags): annotation lands
  WITHOUT the citation. PR review agent posts a thread:
  *"DST deviation detected. Provide source-inspection
  evidence or remove the annotation."*
- **Enforcement** (Aaron 2026-05-01 follow-up, **verbatim
  quote, typo preserved**): *"with a source attribution the
  code does not max it through"* — Aaron's intended meaning
  (clarified by surrounding context): *without* a source
  attribution, code does NOT make it through; *with*
  attribution, it does. The "max" is a typo for "make"; the
  inversion in the negative direction is what's load-bearing.
  This is enforcement, not just flag-and-resolve. The
  DST-deviation thread becomes a merge-blocking gate:
  required-attribution or merge-rejected. Composes with
  GitHub's `required_conversation_resolution` branch-protection
  — the DST-deviation thread is a category that requires
  explicit citation-resolution before the PR can land.

This is class 14 for the BP-NN-mechanizable-lint-classes
consolidation (081KQGDBJ0008QG0R000E10AAM, proposed in PR #1120). The fix-pattern: every DST-exemption
ships with a citation; the class enforces the citation. The
enforcement bites at merge-time, not just review-time —
which is the stronger discipline shape Aaron is naming.

### The PR convergence loop framing — meta-learning via iteration

Aaron 2026-05-01 (further clarification):

> *"i mean we have the pr convergence loop in the classes that
> the copilot, claude and other agents who review prs the meta
> learning loop on every pr is what i was talking aobut"*

The mechanization isn't just *"a single agent posts a thread."*
It's the **PR convergence loop**: every PR runs through
multiple review agents (Copilot, Claude, harsh-critic via
peer-call, future-Cursor when wired) that collectively iterate
toward consensus. The DST-rule class participates in that
loop — not as a one-shot check but as a **meta-learning
target** the loop converges toward across many PRs.

Three structural properties this composes:

1. **Multiple-agent participation.** Per the harness-bias
   substrate (PR #1119), different agents/harnesses give
   different biases. The DST-rule class gets checked from
   multiple bias-axes; the convergence loop reconciles them.
2. **Iterative refinement.** Per the 7-class PR-thread-
   resolution taxonomy (`memory/feedback_pr_thread_resolution_
   class_taxonomy_2026_04_28.md`), each PR's threads exercise
   the class library; the meta-learning loop is "the agents
   collectively improve their handling of the class library
   across iterations."
3. **Amortization at the meta-layer.** Per the parallelism-
   scaling-ladder amortized-keystone (PR #1116, merged), the
   cost of mechanizing the class is paid once; the meta-
   learning benefit accrues across every future PR. The agent
   pool's understanding of the class library compounds.

This is the multi-agent generalization of the amortized-
keystone: not just "mechanize the check" but **"the agents
that do the checking learn from the iterations and improve."**
The 13 mechanizable lint-classes from 081KQGDBJ0008QG0R000E10AAM (proposed in PR #1120) + the DST-rule
class 14 here all become meta-learning targets — each PR's
iteration is one training-instance for the convergence loop.

**Carved sentence (refined)**: *"The PR convergence loop IS
the meta-learning mechanism. Every class checked is a
training-instance; every PR is an iteration; every merge is
a converged answer."*

**Aaron's challenge to Otto** (same exchange): *"did you look
at source to prove your DST dievation was necessary"* — a
quality-check on whether the documenting-agent walks the
talk. The honest answer (from Otto, 2026-05-01): no DST
deviations have surfaced this session that warranted source
inspection; the bugs hit were lint-class / formatting / phantom-
blocker, not dependency non-determinism. This memory file is
forward-looking documentation, not retrospective application.
**The challenge stands as a future-Otto check**: every time
this discipline is invoked, the citation must be real, not
theoretical.

The carved sentence (now with the meta-checkable extension):
*"DST should hodl. Grade A DST is DST that doesn't surrender —
and the deviation that DOES need to ship is the one that
provides source-level evidence of necessity."*

## Composes with

- `memory/feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`
  — the "investigate first" stance; this memory extends with
  *how deep* to investigate
- `memory/feedback_pinned_seeds_are_DST_resolution_for_property_test_flakiness_2026_04_23.md`
  — pinned seeds are the typical resolution; this memory
  covers the case where seeds aren't the cause
- Otto-272 (DST everywhere) + Otto-281 (DST-exempt is
  deferred-bug) — the policy substrate this discipline
  extends
- `memory/feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
  (PR #1116, merged) — DST is reproducibility-first applied
  to runtime; grade A DST is the quality-of-reproducibility
  discipline
- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  (PR #1116, merged) — the amortized-keystone discipline;
  grade A DST documentation amortizes future investigations
  of the same dependency

## Future-Otto check

Future-Otto encountering a flaky test or non-deterministic bug:

1. **First reflex**: don't accept the non-determinism. DST
   holds.
2. **Standard checks**: pinned seeds? Pinned time? IO
   ordering? Threading?
3. **If not found**: list dependencies on the failing path;
   identify candidates; read source.
4. **If public source insufficient**: pull to `../sibling
   repo`. Grep deeply.
5. **Find the seed; pin/wrap/replace.** Document the find
   as memory or BP-NN candidate.
6. **Result**: grade A DST.

The carved sentence: *"DST should hodl. Grade A DST is DST
that doesn't surrender — investigation escalates through
dependency source until the seed of non-determinism is
found."*
