---
name: DST AND DETERMINISM ARE NOT EDGE-CASE AVOIDANCE — when a non-deterministic test catches a real algorithmic edge case, the right fix is to HANDLE the edge case in the algorithm, NOT to make the test deterministic so the case stops happening; pinning a seed / freezing time / removing entropy so a flake "goes away" is cheating; the only legitimate use of determinism is to satisfy an algorithm's actual input invariant (e.g., HLL needs uniform-distributed hashes, so route through XxHash3 not HashCode.Combine — that's not avoiding an edge case, that's matching the algorithm's contract); ALWAYS ask: does my "make it deterministic" fix MASK a real edge case the algorithm should handle, or does it INVOKE the algorithm's actual guarantees? Aaron Otto-285 2026-04-25 "we never want to use random seed pins to cheat by not fully testing if you understand what I mean" + "I guess the general rule is dont use DST and determinism to avoid edge cases handling"
description: Otto-285 general rule on DST/determinism discipline. The legitimate use of DST is to satisfy an algorithm's input invariants (uniform hashing, fixed time domain, controlled randomness), NOT to artificially avoid edge cases the algorithm should handle. Pinning a seed to make a flake disappear is cheating. The discriminator: does the fix invoke the algorithm's actual contract, or does it shrink the test's coverage?
type: feedback
---

## The rule

When a non-deterministic test catches a real algorithmic
edge case, the right fix is to **handle the edge case in
the algorithm**, not to make the test deterministic so the
case stops happening.

Aaron's verbatim framing 2026-04-25:

> *"we never want to use random seed pins to cheat by not
> fully testing if you understand what I mean."*

> *"I guess the general rule is dont use DST and
> determinism to avoid edge cases handling."*

This is the meta-principle behind Otto-281
(`feedback_dst_exempt_is_deferred_bug_not_containment_otto_281_2026_04_25.md`)
and Otto-272 (DST-everywhere). Otto-281 said "fix the
determinism" — Otto-285 says **make sure the determinism
fix isn't itself a cheat**.

## The framing — deterministic tests of a chaotic real world

Aaron's deeper articulation 2026-04-25:

> *"like the tests are all deterministic but the real world
> is [non-deterministic], our tests are trying to test all
> the edge cases of the real world but in a deterministic
> way not reduce scope by eliminating edge cases of the
> real world in our tests with determinism. that will lead
> to more robust tests."*

**The point of DST is not to escape chaos — it is to
reproduce chaos reproducibly.**

The real world is non-deterministic: random timing, byzantine
inputs, network failures, leap seconds, concurrent races,
hash collisions, timestamp orderings, adversarial users.
Production code will encounter all of it.

A test's job is to deterministically exercise every flavor
of that chaos that the algorithm needs to handle. The
*reproduction* is deterministic so the bug, when found, can
be replayed. The *coverage* is the chaos — every edge case
the real world will throw at the algorithm.

Determinism is the **way** we test chaos reproducibly. It
is not the **reason** to skip the chaos.

The mental model:

```
real-world chaos (broad, non-deterministic)
        ↓ encode-as-deterministic-input-generator (FsCheck, fixed seeds, replay logs)
deterministic test (reproduces every chaos case the real world produces)
        ↓
algorithm handles every encoded case correctly
```

The trap Otto-285 prevents:

```
real-world chaos (broad, non-deterministic)
        ↓ encode-as-deterministic
        ↓ but oh wait some cases fail
        ↓ shrink the encoding to skip those cases
narrower-deterministic test (only tests the easy cases)
        ↓
algorithm "passes" but real world still breaks it
```

Robust tests come from the first shape. The second shape
ships bugs to production with a green CI badge.

## The two kinds of "make it deterministic" fixes

There are two cases that look the same on the surface,
but they are opposite in spirit:

**LEGITIMATE — invoking the algorithm's actual contract:**

The algorithm has documented input invariants. A
non-deterministic input violates those invariants. The
"fix" routes through a primitive that satisfies the
invariant. The algorithm's edge-case behavior is preserved
because the algorithm WAS NEVER MEANT to handle that input.

Example: HLL's correctness theorem assumes uniform 64-bit
hashes. `HashCode.Combine` produces 32-bit hashes with
process-randomized salt. The flake was the test exercising
HLL outside its input contract. The fix routes through
`XxHash3` which gives uniform 64-bit avalanche. The test
still covers all `n` values FsCheck generates; the
algorithm's actual edge cases (small-n bias correction,
linear counting transition) are still exercised.

**CHEAT — shrinking coverage to make the flake disappear:**

The algorithm's contract permits the input. The test
caught a genuine edge case where the algorithm fails. The
"fix" pins a seed, freezes time, or hardcodes inputs so
the case never recurs in tests. The algorithm still fails
on that case in production; the test just stops asking.

Example anti-pattern: "the test was flaking due to leap
second handling at midnight UTC. Fixed by pinning the test
clock to noon — never crosses midnight, never hits a leap
second." That's a cheat — the algorithm still has a leap-
second bug; the test just doesn't test for it any more.

The legitimate fix would be to handle leap seconds in the
algorithm.

## The discriminator question

When tempted to reach for "make it deterministic", ALWAYS
ask:

> Does this fix INVOKE the algorithm's actual contract, or
> does it SHRINK the test's coverage of what the algorithm
> is supposed to handle?

If invoke-contract → fine. If shrink-coverage → cheat.

A useful subquestion: **what fraction of the input space
am I now NOT testing?** If the answer is "I'm now testing
the same input space, just via a deterministic-input
primitive" → fine. If the answer is "I'm now testing a
narrower input space because the broader one revealed
problems" → cheat.

## Examples — legitimate vs cheat

| Situation | LEGITIMATE | CHEAT |
|---|---|---|
| HLL fuzz test flakes on `HashCode.Combine` | Route through `XxHash3` (HLL needs uniform hashes per its contract; we're invoking the contract, not narrowing inputs) | Pin a hash-function seed that happens to give error <4% (narrows input space artificially) |
| Concurrency test races | Add proper synchronization to the algorithm so it's correct under concurrent inputs | Force the test to single-threaded sequential execution |
| Float comparison test flakes | Use the algorithm's documented epsilon tolerance | Pin float inputs to values that don't trigger rounding edge cases |
| `Random` unseeded → unpredictable test | Seed with a fixed value AND extend test to also sweep multiple seeds (DST + breadth) | Pin one seed and call it done |
| DateTime.UtcNow → leap-second flake | Handle leap seconds in the algorithm | Freeze clock to noon |

The legitimate fixes either *invoke the algorithm's
contract* (the algorithm doesn't have to handle inputs it
didn't promise to) or *fix the algorithm to handle the
edge case it was caught failing on*. The cheats narrow
test coverage to make symptoms disappear.

## How my Otto-281 fix this session relates

PR #482 (HLL fuzz test fix) is a LEGITIMATE case per the
discriminator:

- HLL's correctness theorem (Flajolet et al. 2007) requires
  uniformly-distributed hashes. That is the algorithm's
  documented input contract.
- `HashCode.Combine` is a 32-bit per-process-salted
  hash — its output is non-uniform across processes (each
  process sees a different mapping for the same int).
- The fuzz test was exercising HLL outside its input
  contract. The flake was real but represented a
  contract-violation, not an algorithmic edge case.
- The fix routes through `XxHash3.HashToUInt64` which
  satisfies the contract. Same `n` values are still
  generated by FsCheck; the algorithm's small-cardinality
  edge cases (linear counting, bias correction) are still
  exercised.

Empirical verification (sweep, 500 trials × 5 starting
offsets): max error 1.96%, far below the 4% bound. With
contract satisfied, the bound holds.

The fix would have been a CHEAT if instead it had:

- Pinned `n.Get` to a fixed sequence that didn't trigger
  the flake (narrows coverage).
- Pinned the FsCheck seed (narrows coverage).
- Increased the tolerance to 8% to "always pass" (changes
  the test's actual claim).
- Added `[<Skip>]` or a "DST-exempt: HLL is probabilistic"
  comment (Otto-281 deferred bug).

None of those would have addressed the actual contract
violation. The legitimate fix did.

## Composes with

- **Otto-281** *DST-exempt is deferred bug* — Otto-285 is
  the meta-rule above Otto-281. Otto-281 says "fix the
  determinism"; Otto-285 says "make sure your determinism
  fix isn't a cheat that narrows coverage."
- **Otto-272** *DST-everywhere* — DST is the substrate
  that lets us reproduce flakes. It's a tool for
  *characterizing* edge cases, not for *avoiding* them.
- **Otto-264** *rule of balance* — every "make it
  deterministic" fix should pair with verification that
  the test's coverage didn't shrink.
- **Otto-282** *write the why* — when applying a
  determinism fix, comment WHY: "routes through XxHash3
  because HLL's contract requires uniform hashes" makes
  the discriminator visible to future readers.
- **Otto-248** *never ignore flakes* — flakes ARE the
  signal that something violates the algorithm's contract
  (or the algorithm has a real edge case). Investigation
  finds which; Otto-285 is the rule for the fix-shape.

## CLAUDE.md candidacy

Otto-285 is a meta-principle that applies to every test-
flake fix. It belongs alongside Otto-281 in CLAUDE.md or
the agent-best-practices substrate.

Decision (Otto 2026-04-25, per Otto-283): **defer
elevation to maintainer discretion**. Memory entry is
sufficient for now; revisit at next governance pass.

## Pre-commit-lint candidate

Hard to mechanize. The discriminator question is judgment-
heavy. But a simple heuristic: any commit that adds
`Random N` (with N != 0 / N != fixed seed marker) AND
removes a previously-failing test case OR narrows a test
range should fire a manual-review flag. Same for any
commit adding `[<Fact(Skip = ...)>]` paired with a comment
about non-determinism.
