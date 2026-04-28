---
name: DST-EXEMPT IS DEFERRED-BUG — never a safe state, no comment that says "DST-exempt" should ship without a deadline; the SharderInfoTheoreticTests case: a previous tick marked the test "DST-exempt: uses HashCode.Combine which is process-randomized" + filed a BACKLOG row, treated as containment; in reality the exemption masked the determinism violation which compounded into 3 unrelated flakes this session (#454 / #458 / #473) before Aaron 2026-04-25 surfaced the rule "see how that one DST exception caused the flake, this is why DST is so important, when we violate, we introduce random failures"; ship the FIX (Otto-281: detHash via XxHash3), not the EXEMPTION; counterweight to Otto-272 DST-everywhere
description: Otto-281 counterweight memory. DST exemptions are not containment; they are deferred bugs. The SharderInfoTheoreticTests "DST-exempt" comment masked a flake that fired 3 times on unrelated PRs before getting fixed. Pattern: when tempted to write "DST-exempt", instead either fix the determinism or delete the test. Never ship a long-lived DST-exempt tag.
type: feedback
---
## The rule

**"DST-exempt" is not a safe state. It is a deferred bug.**

When a test or code path is marked "DST-exempt" with a comment
that says "uses X which is process-randomized" or "depends on
environment Y", that is NOT containment. It is *masking* the
determinism violation behind a label that sounds like an escape
hatch.

Aaron's verbatim framing 2026-04-25:

> *"see how that one DST exception caused the fake [flake],
> this is why DST is so important, when we violate, we
> introduce random failures."*

## The case that triggered the rule

`tests/Tests.FSharp/Formal/Sharder.InfoTheoretic.Tests.fs`
contained three uses of `HashCode.Combine k` for hashing
integer keys:

```fsharp
let h = uint64 (HashCode.Combine k)
let s = JumpConsistentHash.Pick(h, shards)
```

`System.HashCode.Combine` is **process-randomized by .NET
design** to deter hash-flooding attacks on dictionaries. So
the same int produces different hashes in different processes.
Jump-consistent-hash output depends on the input hash, so
shard assignments varied across CI runs. The
`< 1.2 max/avg ratio` assertion sometimes held, sometimes
didn't.

A previous tick (Aaron 2026-04-24 directive territory) added
this comment above one of the tests:

```fsharp
// DST-exempt: uses `HashCode.Combine` which is process-randomized
// per-run. Flake analysis + fix pipeline tracked in docs/BACKLOG.md
// "SharderInfoTheoreticTests 'Uniform traffic' flake" row. DST
// marker convention + lint rule: docs/BACKLOG.md "DST-marker
// convention + lint rule" row (Aaron 2026-04-24 directive).
```

**That comment treated the issue as contained.** It identified
the cause (`HashCode.Combine` process-randomization), filed a
BACKLOG row, and added a "DST-marker convention" idea — all of
which are good housekeeping. But it left the determinism
violation in the test code.

## What the masking cost

The "Uniform traffic: consistent-hash is already near-optimal"
test flaked **three times in this session** on unrelated PRs:

- **#454** (FSharp.Core 10.1.202 → 10.1.203) — pure dep bump,
  failed on a probabilistic sharder test.
- **#458** (System.Numerics.Tensors 10.0.6 → 10.0.7) — same.
- **#473** (Dependabot grouping config) — yaml-only change,
  same flake.

Three unrelated PRs each had to be diagnosed, the flake ruled
"unrelated to this change", and the job rerun. Three rerun
cycles of compute. Three opportunities for an autonomous-loop
agent to misidentify a real bug as "the same flake — rerun"
and ship a regression. Three eyeball-time costs for the
maintainer.

**That's the compounding cost of a DST exemption left to live.**
The exemption didn't contain the cost — it spread the cost
across N PRs and N reruns instead of concentrating it on one
fix.

## The correct response patterns

**When you encounter a flake that uses non-deterministic
primitives:**

1. **Fix the determinism.** Replace the non-deterministic
   primitive with a deterministic one of the same kind.
   For `HashCode.Combine` → `XxHash3.HashToUInt64` (Otto-281).
   For `Random` (no seed) → `Random seed`. For `DateTime.UtcNow`
   inside a property check → fixed `DateTimeOffset` constant.

2. **If the determinism cannot be fixed, delete the test.** A
   test that is *probabilistic in CI* is not a test — it's a
   coin flip that gets logged. Either commit to fixing the
   determinism or delete the test entirely. Don't ship a
   dual-state "sometimes-pass-sometimes-fail" thing under a
   "DST-exempt" label.

3. **If the determinism cannot be fixed AND the test cannot be
   deleted (e.g., it tests an inherently-stochastic property
   like a Monte Carlo bound), wrap the entire test body in a
   loop with a fixed seed and assert the *aggregate* property
   over N runs.** That converts the stochastic property into a
   deterministic-meta-property over fixed seeds.

**Never** leave the test in CI with a "DST-exempt" comment. The
comment doesn't make the determinism violation safe — it just
defers the cost.

## The fix shape (Otto-281)

```fsharp
open System.IO.Hashing

let private detHash (k: int) : uint64 =
    XxHash3.HashToUInt64 (ReadOnlySpan (BitConverter.GetBytes k))

// All three call sites changed:
//   let h = uint64 (HashCode.Combine k)
// becomes:
//   let h = detHash k
```

Three iterations in separate processes — all pass with
identical output. Determinism restored. PR #478.

## Composes with

- **Otto-272** *DST-ify the stabilization process* — counterweight
  discipline must be deterministic. Same energy: don't carve
  out exceptions; fix the root.
- **Otto-248** *never ignore flakes* — flakes ARE the determinism
  violation, not "transient infra noise". Same shape applied
  to test-side code.
- **Otto-264** *rule of balance* — every found mistake triggers
  a counterweight. This memory IS the counterweight to the
  "DST-exempt" mistake.
- **GOVERNANCE.md §section on DST** — DST-everywhere as the
  default mode, not the special mode.

## Pre-commit-lint candidate

A grep for `DST-exempt` / `DST exempt` / `dst-exempt` in
comments inside `tests/**` should fire as a warning at
pre-commit time. Each occurrence is a deferred bug that
needs a deadline. The lint comment can include the DST
discipline reminder: "DST-exempt is not containment — fix or
delete; don't ship dual-state tests."
