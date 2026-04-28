---
name: Pinned seeds are the DST resolution for property-test flakiness; retry-until-green is the non-DST path and explicitly rejected
description: Aaron 2026-04-23 *"yeah pinned seeds is from DST ... to make them deterministic"*. Sharpens the DST retries-are-smell discipline specifically for property-based tests (FsCheck / QuickCheck / Hypothesis). When a property test fails at a random seed, the correct response is pin-the-failing-seed (regression-capture) rather than retry-with-another-seed. Flaky property tests ARE genuine non-determinism by construction; pinning the seed converts the test into a deterministic regression check against that specific failing case.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Pinned seeds are the DST resolution for property-test flakiness

## Verbatim (2026-04-23)

> yeah pinned seeds is from DST
> to make them deterministic

## What this sharpens

Per the parent DST rule
(`feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`):
retries mask non-determinism instead of root-causing it.
Property-based testing is a specific intersection where
the non-determinism is **structural** — the test uses a
random number generator to explore input space.

This memory adds: **when a property test fails at a random
seed, the DST-aligned fix is to PIN the seed**, not retry
until a different seed passes. Pinning:

1. Converts the flaky case into a deterministic
   regression (same seed → same failure or same pass).
2. Captures the specific counter-example for
   investigation.
3. Lets fixes be verified against the known-bad case.
4. Allows future property runs to explore *new* seed
   space without losing the counter-example.

## Concrete application — HLL property test (2026-04-23)

The `Zeta.Tests.Properties.FuzzTests.fuzz: HLL estimate
within theoretical error bound` test failed on a CI run
at an unspecified random seed. The temptation is to
re-run CI and hope it passes. The DST-aligned action is:

1. **Capture the failing seed** from the `FsCheck.Xunit.PropertyFailedException`
   message (FsCheck prints the `{ Replay = ... }` in the
   exception).
2. **Pin that seed** as a regression-ensuring inline
   test attribute: `[<Property(Replay = "<seed-string>")>]`.
3. **Either fix the bound** (if the HLL error-bound
   formula is too tight) or **fix the HLL implementation**
   (if the estimate is genuinely wrong at this seed).
4. **Keep the broader random exploration** alongside
   the pinned regression — both tests together cover
   regression + novel exploration.

The BACKLOG P1 row (PR #175) queues this work explicitly.

## Why "flaky = retry" is non-DST

A retry loop against random seeds:

- **Hides** the counter-example (what seed failed? lost
  on re-run)
- **Allows** a latent bug to re-fail at unpredictable
  future times
- **Breaks** the test's ability to serve as a
  regression gate
- **Moves** the failure from CI (where it's visible) to
  production (where it's expensive)

Per the DST discipline, these are all non-determinism
masks. Pinning the seed is the inversion: turn the
non-determinism into determinism by fixing the input.

## FsCheck-specific mechanics

FsCheck's property-test runner:

- **Default**: generates random seeds per run. Unpredictable.
- **`Replay`**: accepts a specific seed as string, reruns
  the exact failing case. Deterministic.
- **Shrinking**: when a counter-example fails, FsCheck
  shrinks it to a minimal counter-example — pin the
  minimal, not the original.
- **`MaxTest`**: configurable iteration count. Increase
  when exploring; pin to 1 when regression-checking.

Idiomatic pin-then-explore pattern:

```fsharp
// Regression check at the failing seed
[<Property(Replay = "(123456789, 987654321)", MaxTest = 1)>]
let ``HLL estimate at known-bad seed stays in bound`` () = ...

// Continue exploring broader space
[<Property>]
let ``HLL estimate within theoretical error bound`` () = ...
```

This gives both: a deterministic regression gate + an
ongoing random-space exploration.

## What this is NOT

- **Not a ban on property-based tests.** Property tests
  are high-value; this rule is about handling their
  failures deterministically.
- **Not a mandate to pin every property test upfront.**
  Pinning is the response to observed failure, not a
  precondition.
- **Not a claim that pinned-seed coverage is complete.**
  A pinned seed proves you fixed ONE counter-example. The
  random exploration alongside catches new ones.
- **Not a rejection of random seed generation in general.**
  Random exploration is the point of property-based
  testing; the rule is about what to do when exploration
  finds a bug.
- **Not a suggestion to increase `MaxTest` to mask
  flakiness.** Increasing iteration count explores more
  seeds but doesn't make the test deterministic; the
  failing seed is still unpinned.

## Composes with

- `feedback_retries_are_non_determinism_smell_DST_holds_investigate_first_2026_04_23.md`
  (the parent DST rule; this memory sharpens it for
  property-based-test flakiness)
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  (the DST discipline skill)
- `.claude/skills/fscheck-expert/SKILL.md` (FsCheck
  mechanics; should document the pin-then-explore
  pattern)
- `docs/BACKLOG.md` HLL property-test row (PR #175)
- `docs/MATH-SPEC-TESTS.md` (FsCheck as one of the
  verification layers)
- `feedback_greenfield_until_deployed_then_backcompat_learning_mode_DORA_cost_2026_04_23.md`
  (flaky tests during greenfield hit DORA metrics via
  change-failure-rate — same cost accounting applies)
