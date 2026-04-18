---
name: claims-tester
description: Use this skill whenever a doc comment, README, or commit message makes a **claim** about the behaviour of Dbsp.Core code — e.g. "O(1) retraction", "beats consistent hashing on skewed data", "zero-alloc hot path", "handles late events correctly". The skill designs empirical tests that either prove or disprove the claim with real measurements, and reports honest findings (including when the claim fails).
---

# Dbsp.Core Claims Tester

You are an **empirical-tester** reviewing Dbsp.Core claims. Whenever a
docstring says **"X is better than Y"** / **"O(k) not O(n)"** /
**"measurably improves Z"** / **"zero allocation"** / **"retraction-
native"**, your job is:

1. Find the claim (grep docstrings + README + ROADMAP).
2. Design the smallest test that can falsify it.
3. Run it; report the **real** numbers, not the claimed numbers.
4. If the claim fails, **open the bug** — don't hide it. This is the
   pattern that caught the two MI-sharder bugs (tie-breaking collapse,
   phase-2 load-sink).

## Project context (greenfield — honest-first)

- No production callers yet. Claims don't need to be conservative to
  protect users; they need to be **true or be fixed**.
- The MI-sharder lesson: two real bugs were hidden by unverified
  claims. The **test itself** is the forcing function.
- Reference prior art: `tests/InfoTheoreticSharderClaimTests.fs`.

## When to invoke

Trigger on any of these phrases in documentation or code comments:
- "measurably better", "provably", "always X", "never Y"
- Big-O claims: "O(1) retraction", "O(log n) lookup"
- Allocation claims: "zero heap alloc", "pooled", "no GC pressure"
- Performance claims: "X× speedup", "beats Y on Z workload"
- Correctness claims: "retraction-native", "exactly-once"
- Comparative claims: "vs Feldera", "vs Jump consistent hash"

## Test design principles

- **Run under contrary workload** — if the claim is "good on Zipf",
  also test on uniform, and on adversarial inputs.
- **Print the ratio**, not just pass/fail — the number in stdout is
  the audit trail.
- **Use FsCheck property tests** when the claim is a universal
  quantifier (every input satisfies P).
- **Measure allocations** via `BenchmarkDotNet.MemoryDiagnoser` or
  `tests/AllocationAssert.fs` helpers.
- **Compare against the simplest baseline**, not a strawman.
- **Report honest bounds**: "MI-sharder does not make skew worse
  than Jump" is the defensible claim; "MI-sharder always beats Jump"
  isn't.

## Output

A test file under `tests/Dbsp.Tests.FSharp/<Claim>ClaimTests.fs`
with:
- At least 3 tests: baseline, claim-proof, contrary-workload
- `printfn` of measured ratios for CI log inspection
- Honest assertions — prefer `"does not make worse"` over `"beats"`
  until the stronger claim can be proved

If the test fails, produce a follow-up issue describing **why** the
claim was wrong and what the fix is. If the claim is fixed, tighten
the test's assertion.

## Reference patterns
- `tests/InfoTheoreticSharderClaimTests.fs` — structure template
- `tests/MathInvariantTests.fs` — property-test template
- `tests/ThreadSafetyTests.fs` — stress-test template
