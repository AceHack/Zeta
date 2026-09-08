# Independent projection interval-core review

Date: 2026-09-08 UTC
Operational status: research-grade
Status: bounded primitive-source and custody acceptance
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

I accept the interval module and dedicated tests at
9f0d5ca7c7bf18a9df02b5061ce5665253ce559b within their stated primitive
scope. The [custody audit](projection-interval-core-review/2026-09-08/README.md)
binds the exact source and all 31 retained development records. I read the
source, tests, frozen contract and original records without importing the
project, running numerical operations or repeating its tests.

The production file is
`src/Interp.Python/zeta_interp/precision_gate_projection_intervals.py`,
10,864 bytes, SHA256
fd8db23e1b077a5bc3b9396e964c30bf927fe7e27a37dfe83ae5412988138616.
Its test file is 8,333 bytes, SHA256
c673182ccc199a2d10d4c085f0d0edbdc6d6d71cd1872be535ee0d55291619f6.
These are exactly the copies bound to the corrected development run.

Addition and subtraction select the monotone endpoints and round outward.
Multiplication and zero-excluding division bound all four endpoint pairs.
The square operation uses zero as its lower bound when the interval crosses
zero; elsewhere it selects the nearest and farthest endpoint magnitudes.
Intersection refuses disjoint bounds. Width converts finite endpoints to
exact Fractions before subtraction. Midpoint first forms the exact rational
average, rounds once with the explicit half-even context, and requires a
strict interior represented point. These match the
[accepted frozen contract](2026-09-08-projection-contract-independent-review.md).

The public constructor admits only precision 80, 160 or 320, the registered
exponent/clamp/rounding metadata, and exact integer counters excluding bool.
Public operations revalidate ordinary records, finite ordered Decimal
endpoints and exact integer/Fraction inputs. Inexact underflow, division by
zero, invalid operations and overflow trap inside the typed boundary.
Nonfinite results or neighbors refuse; exponential enclosures additionally
require a strictly positive lower bound. Exact subnormal values are not
confused with inexact underflow.

Python documents correctly rounded half-even exp/ln and context-specific
adjacent representable values. The implementation uses that explicit mode,
then widens both endpoint results before monotone selection; it does not
mistake a changed rounding-mode setting for directed transcendental rounding.
The exact exp(0) and ln(1) identities avoid actual transcendental entry.
This enclosure argument relies on those library guarantees, not on a native
System.Math or JIT claim. [Python Decimal documentation](https://docs.python.org/3/library/decimal.html#decimal.Decimal.exp).

Each nontrivial endpoint charges its actual exp/ln entry before the call.
Budget exhaustion prevents the next entry, and failures do not refund earlier
entries. Contexts are fresh and explicit, so accumulated ambient flags do
not substitute for the current operation's trap result. The arithmetic
object is deliberately mutable sequential bookkeeping, not an unforgeable
execution receipt. Ordinary unexpected exceptions return `Unexpected`;
that is an abnormal result, never an expected-refusal success.

The exact Taylor sum through degree 160 for exp(1/2), with the next-term
geometric tail bounded using ratio (1/2)/162, correctly brackets the target.
For ln(2), the sum through n=120 of
`2*(1/3)^(2*n+1)/(2*n+1)` has its remaining tail bounded by the next term
divided by `1-1/9`. These are independent rational test expectations.
The higher-precision comparisons supplement them; they are not presented
as an independent transcendental implementation. Signed corner cases,
zero-crossing squares, empty intersections, midpoint stagnation, counter
limits, range/underflow and malformed ordinary records are also discriminated.

All 31 gzip records pass stored identity, complete single-member raw identity
and original-file comparison: 57,104 original bytes and 18,533 stored bytes.
The two final executed source copies match the commit exactly. The initial
and final interval source have identical parsed ASTs; formatting and the
documented broad-catch lint explanation did not change arithmetic behavior.
The retained first run has 41 tests passing, clean strict typing, one BLE001
lint refusal and formatter refusals. The corrected run adds the actual
injected OSError boundary test: 42 tests pass, with strict typing, Ruff and
format verification clean. The 4.21/4.13-second figures are the respective
pytest summaries, not a claim about whole-command wall time.

No material primitive-source discrepancy was found. This acceptance does
not admit the separate root solver, global retry/counter transfer, actual
coordinate/objective observations, wire parser, encoder or final 40-case/
88-call comparison. A refused primitive retains its typed failure and
entered counter, not a fabricated complete interval. The later services
must retain their own admitted named partials and actual returns. Arbitrary
caller-object memory limits and physical runtime/source custody likewise
remain outside this primitive review.

~~~text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
~~~
